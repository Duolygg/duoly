import type { APIRoute } from 'astro';
import type Stripe from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';
import { mutation } from '../auth/handlers';
import type { Viewer } from '../../contracts/account';
import { viewerCurrency } from '../currency';
import { adminFor, paymentsConfig, stripeFor } from '../payments/config';
import {
  PRO_METADATA_KIND,
  PRO_MONTHLY_CENTS,
  PRO_PRICE_LOOKUP_KEY,
  PRO_TRIAL_DAYS,
  proEnabled,
  proPortalConfiguration,
} from './config';
import { syncProSubscription } from './webhook';

type Rpc = (
  fn: string,
  args?: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: unknown }>;
// bound: supabase-js rpc reads `this`, so a detached `client.rpc` throws before any request
const rpcOf = (client: SupabaseClient) =>
  client.rpc.bind(client) as unknown as Rpc;

/** Pure: R1 price check. Refuses anything but 9.99 EUR every month. */
export function isProPrice(price: Stripe.Price | null | undefined): boolean {
  return (
    !!price &&
    price.active &&
    price.type === 'recurring' &&
    price.currency === 'eur' &&
    price.unit_amount === PRO_MONTHLY_CENTS &&
    price.recurring?.interval === 'month' &&
    price.recurring.interval_count === 1
  );
}

/** The catalog price (€9.99) and its product, which a USD customer's own euro amount also uses. */
export interface ProCatalogPrice {
  id: string;
  product: string;
}

let cachedPrice: (ProCatalogPrice & { at: number }) | null = null;
export async function proCatalogPrice(
  stripe: Stripe,
): Promise<ProCatalogPrice | null> {
  if (cachedPrice && Date.now() - cachedPrice.at < 10 * 60_000)
    return { id: cachedPrice.id, product: cachedPrice.product };
  const list = await stripe.prices.list({
    lookup_keys: [PRO_PRICE_LOOKUP_KEY],
    active: true,
    limit: 1,
  });
  const price = list.data[0];
  const product =
    typeof price?.product === 'string' ? price.product : price?.product?.id;
  if (!isProPrice(price) || !product) return null;
  cachedPrice = { id: price!.id, product, at: Date.now() };
  return { id: price!.id, product };
}

/**
 * Pure: what PRO charges a month, always in EUR. A customer who uses USD sees $9.99 and pays the
 * euro equivalent at the customer rate (the rate the site shows USD prices at), like dollar tips;
 * that euro amount is fixed when they subscribe.
 */
export function proMonthlyEurCents(usdRate?: number): number {
  return usdRate && usdRate > 0.5 && usdRate < 2
    ? Math.round(PRO_MONTHLY_CENTS / usdRate)
    : PRO_MONTHLY_CENTS;
}

const MONTHLY = { interval: 'month' as const, interval_count: 1 };

/**
 * Pure: the 7-day trial, started without a card. When it ends without one, Stripe pauses the
 * subscription (PRO switches off); adding a card in Manage PRO resumes it (webhook,
 * customer.updated) and the monthly billing starts.
 */
export function proTrialParams(input: {
  customerId: string;
  userId: string;
  price: ProCatalogPrice;
  eurCents: number;
}): Stripe.SubscriptionCreateParams {
  return {
    customer: input.customerId,
    items: [
      input.eurCents === PRO_MONTHLY_CENTS
        ? { price: input.price.id, quantity: 1 }
        : {
            price_data: {
              currency: 'eur',
              product: input.price.product,
              unit_amount: input.eurCents,
              recurring: MONTHLY,
              tax_behavior: 'inclusive',
            },
            quantity: 1,
          },
    ],
    trial_period_days: PRO_TRIAL_DAYS,
    trial_settings: { end_behavior: { missing_payment_method: 'pause' } },
    payment_settings: { save_default_payment_method: 'on_subscription' },
    metadata: { kind: PRO_METADATA_KIND, user_id: input.userId },
  };
}

/** Pure: the subscription Checkout Session for a customer who already had their trial. */
export function proSessionParams(input: {
  customerId: string;
  userId: string;
  price: ProCatalogPrice;
  eurCents: number;
  origin: string;
}): Stripe.Checkout.SessionCreateParams {
  const metadata = { kind: PRO_METADATA_KIND, user_id: input.userId };
  return {
    ui_mode: 'elements',
    mode: 'subscription',
    customer: input.customerId,
    line_items: [
      input.eurCents === PRO_MONTHLY_CENTS
        ? { price: input.price.id, quantity: 1 }
        : {
            price_data: {
              currency: 'eur',
              product: input.price.product,
              unit_amount: input.eurCents,
              recurring: MONTHLY,
              tax_behavior: 'inclusive',
            },
            quantity: 1,
          },
    ],
    payment_method_collection: 'always',
    subscription_data: { metadata },
    metadata,
    return_url: `${input.origin}/dashboard?pro=welcome#pro`,
  };
}

async function proCustomer(
  stripe: Stripe,
  admin: SupabaseClient,
  user: { id: string; email: string | null },
): Promise<string | null> {
  const rpc = rpcOf(admin);
  const existing = await rpc('pro_billing_customer', { p_user: user.id });
  if (existing.error) return null;
  if (typeof existing.data === 'string' && existing.data) return existing.data;
  const customer = await stripe.customers.create(
    {
      ...(user.email ? { email: user.email } : {}),
      metadata: { user_id: user.id },
    },
    { idempotencyKey: `pro_customer_${user.id}` },
  );
  const linked = await rpc('pro_link_customer', {
    p_user: user.id,
    p_customer: customer.id,
  });
  if (linked.error || typeof linked.data !== 'string') return null;
  return linked.data;
}

type CustomerRequest =
  | { failure: Response }
  | {
      failure: null;
      account: Awaited<ReturnType<typeof mutation>>['account'];
      config: NonNullable<ReturnType<typeof paymentsConfig>>;
      viewer: Viewer;
      accountCurrency: string | null;
    };

async function customerRequest(
  context: Parameters<APIRoute>[0],
): Promise<CustomerRequest> {
  const { account, body, failure } = await mutation(context);
  // mutation() always sets failure when there is no body.
  if (failure || !body) return { failure: failure as Response };
  const config = paymentsConfig();
  if (!proEnabled() || !config)
    return {
      failure: account.json({ error: 'Duoly PRO isn’t available yet.' }, 404),
    };
  const identity = await account.identity();
  if (!identity)
    return {
      failure: account.json({ error: 'Sign in to get Duoly PRO.' }, 401),
    };
  if (identity.viewer.role !== 'customer')
    return {
      failure: account.json(
        { error: 'Duoly PRO is for customer accounts.' },
        403,
      ),
    };
  return {
    failure: null,
    account,
    config,
    viewer: identity.viewer,
    accountCurrency: identity.profile.currency ?? null,
  };
}

/** POST /api/pro/checkout: a subscription Checkout Session for the /pro page (client secret). */
export const proCheckout: APIRoute = async (context) => {
  try {
    const request = await customerRequest(context);
    if (request.failure) return request.failure;
    const { account, config, viewer, accountCurrency } = request;
    const admin = adminFor(config);
    const { usdRate } = await viewerCurrency(context.cookies, accountCurrency);
    const eurCents = proMonthlyEurCents(usdRate);
    const status = await rpcOf(admin)('pro_status_dto', { p_user: viewer.id });
    const state = status.data as {
      member?: boolean;
      trial_eligible?: boolean;
      subscription?: { status?: string } | null;
    } | null;
    if (status.error || !state)
      return account.json(
        { error: 'Duoly PRO is unavailable. Try again.' },
        503,
      );
    if (state.member)
      return account.json({ error: 'You already have Duoly PRO.' }, 409);
    // A subscription waiting for a card update is fixed in the portal, never doubled.
    if (
      ['past_due', 'unpaid', 'incomplete', 'paused'].includes(
        state.subscription?.status ?? '',
      )
    )
      return account.json(
        { error: 'Update your card in Manage PRO to switch PRO back on.' },
        409,
      );
    const stripe = stripeFor(config);
    const price = await proCatalogPrice(stripe);
    if (!price)
      return account.json(
        { error: 'Duoly PRO is unavailable. Try again.' },
        503,
      );
    const customerId = await proCustomer(stripe, admin, viewer);
    if (!customerId)
      return account.json(
        { error: 'Duoly PRO is unavailable. Try again.' },
        503,
      );
    if (state.trial_eligible === true) {
      // The trial needs no card: start it here and record it now, so the dashboard shows it at once
      const subscription = await stripe.subscriptions.create(
        proTrialParams({
          customerId,
          userId: viewer.id,
          price,
          eurCents,
        }),
        { idempotencyKey: `pro_trial_${viewer.id}` },
      );
      await syncProSubscription(stripe, admin, subscription.id);
      return account.json({ started: true, trial: true });
    }
    const session = await stripe.checkout.sessions.create(
      proSessionParams({
        customerId,
        userId: viewer.id,
        price,
        eurCents,
        origin: config.origin,
      }),
    );
    if (!session.client_secret)
      return account.json(
        { error: 'Duoly PRO is unavailable. Try again.' },
        503,
      );
    return account.json({ client_secret: session.client_secret, trial: false });
  } catch {
    return new Response(
      JSON.stringify({ error: 'Duoly PRO is unavailable. Try again.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    );
  }
};

/** POST /api/pro/portal: Stripe Customer Portal to cancel or change the card. */
export const proPortal: APIRoute = async (context) => {
  try {
    const request = await customerRequest(context);
    if (request.failure) return request.failure;
    const { account, config, viewer } = request;
    const admin = adminFor(config);
    const customer = await rpcOf(admin)('pro_billing_customer', {
      p_user: viewer.id,
    });
    if (customer.error)
      return account.json(
        { error: 'Duoly PRO is unavailable. Try again.' },
        503,
      );
    if (typeof customer.data !== 'string' || !customer.data)
      return account.json({ error: 'You don’t have Duoly PRO yet.' }, 404);
    const configuration = proPortalConfiguration();
    const session = await stripeFor(config).billingPortal.sessions.create({
      customer: customer.data,
      return_url: `${config.origin}/dashboard#pro`,
      ...(configuration ? { configuration } : {}),
    });
    return account.json({ url: session.url });
  } catch {
    return new Response(
      JSON.stringify({ error: 'Duoly PRO is unavailable. Try again.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    );
  }
};
