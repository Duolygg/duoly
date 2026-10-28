import type { APIRoute } from 'astro';
import type Stripe from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';
import { mutation } from '../auth/handlers';
import { adminFor, paymentsConfig, stripeFor } from '../payments/config';
import {
  PRO_METADATA_KIND,
  PRO_MONTHLY_EUR_CENTS,
  PRO_PRICE_LOOKUP_KEY,
  PRO_TRIAL_DAYS,
  proEnabled,
  proPortalConfiguration,
} from './config';

type Rpc = (
  fn: string,
  args?: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: unknown }>;
const rpcOf = (client: SupabaseClient) => client.rpc as unknown as Rpc;

/** Pure: R1 price check. Refuses anything but 4.99 EUR every month. */
export function isProPrice(price: Stripe.Price | null | undefined): boolean {
  return (
    !!price &&
    price.active &&
    price.type === 'recurring' &&
    price.currency === 'eur' &&
    price.unit_amount === PRO_MONTHLY_EUR_CENTS &&
    price.recurring?.interval === 'month' &&
    price.recurring.interval_count === 1
  );
}

let cachedPrice: { id: string; at: number } | null = null;
export async function proPriceId(stripe: Stripe): Promise<string | null> {
  if (cachedPrice && Date.now() - cachedPrice.at < 10 * 60_000)
    return cachedPrice.id;
  const list = await stripe.prices.list({
    lookup_keys: [PRO_PRICE_LOOKUP_KEY],
    active: true,
    limit: 1,
  });
  const price = list.data[0];
  if (!isProPrice(price)) return null;
  cachedPrice = { id: price!.id, at: Date.now() };
  return price!.id;
}

/** Pure: the subscription Checkout Session (Stripe hosted page). */
export function proSessionParams(input: {
  customerId: string;
  userId: string;
  priceId: string;
  origin: string;
  trial: boolean;
}): Stripe.Checkout.SessionCreateParams {
  const metadata = { kind: PRO_METADATA_KIND, user_id: input.userId };
  return {
    mode: 'subscription',
    customer: input.customerId,
    line_items: [{ price: input.priceId, quantity: 1 }],
    // Collect a payment method up front, also for the trial.
    payment_method_collection: 'always',
    subscription_data: {
      metadata,
      ...(input.trial
        ? {
            trial_period_days: PRO_TRIAL_DAYS,
            trial_settings: {
              end_behavior: { missing_payment_method: 'cancel' },
            },
          }
        : {}),
    },
    metadata,
    custom_text: {
      submit: {
        message: input.trial
          ? 'Free for 7 days, then €4.99 a month until you cancel. Cancel anytime from your dashboard.'
          : '€4.99 a month until you cancel. Cancel anytime from your dashboard.',
      },
    },
    success_url: `${input.origin}/dashboard?pro=welcome#pro`,
    cancel_url: `${input.origin}/dashboard#pro`,
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

async function customerRequest(context: Parameters<APIRoute>[0]) {
  const { account, body, failure } = await mutation(context);
  if (failure || !body) return { failure: failure! } as const;
  const config = paymentsConfig();
  if (!proEnabled() || !config)
    return {
      failure: account.json({ error: 'Duoly PRO isn’t available yet.' }, 404),
    } as const;
  const identity = await account.identity();
  if (!identity)
    return {
      failure: account.json({ error: 'Sign in to get Duoly PRO.' }, 401),
    } as const;
  if (identity.viewer.role !== 'customer')
    return {
      failure: account.json(
        { error: 'Duoly PRO is for customer accounts.' },
        403,
      ),
    } as const;
  return { account, config, viewer: identity.viewer } as const;
}

/** POST /api/pro/checkout: start (or restart) a PRO membership on Stripe's hosted page. */
export const proCheckout: APIRoute = async (context) => {
  try {
    const request = await customerRequest(context);
    if ('failure' in request) return request.failure;
    const { account, config, viewer } = request;
    const admin = adminFor(config);
    const status = await rpcOf(admin)('pro_status_dto', { p_user: viewer.id });
    const state = status.data as {
      member?: boolean;
      trial_eligible?: boolean;
      subscription?: { status?: string } | null;
    } | null;
    if (status.error || !state)
      return account.json({ error: 'Duoly PRO is unavailable. Try again.' }, 503);
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
    const priceId = await proPriceId(stripe);
    if (!priceId)
      return account.json({ error: 'Duoly PRO is unavailable. Try again.' }, 503);
    const customerId = await proCustomer(stripe, admin, viewer);
    if (!customerId)
      return account.json({ error: 'Duoly PRO is unavailable. Try again.' }, 503);
    const session = await stripe.checkout.sessions.create(
      proSessionParams({
        customerId,
        userId: viewer.id,
        priceId,
        origin: config.origin,
        trial: state.trial_eligible === true,
      }),
    );
    if (!session.url)
      return account.json({ error: 'Duoly PRO is unavailable. Try again.' }, 503);
    return account.json({ url: session.url });
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
    if ('failure' in request) return request.failure;
    const { account, config, viewer } = request;
    const admin = adminFor(config);
    const customer = await rpcOf(admin)('pro_billing_customer', {
      p_user: viewer.id,
    });
    if (customer.error)
      return account.json({ error: 'Duoly PRO is unavailable. Try again.' }, 503);
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
