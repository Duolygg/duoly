import type { APIRoute } from 'astro';
import type Stripe from 'stripe';
import { z } from 'zod';
import { eurToUsd, FALLBACK_EUR_TO_USD } from '../fx';
import { mutation } from '../auth/handlers';
import { accountContext } from '../auth/context';
import { calculateQuote } from '../pricing';
import { checkoutRefCode } from '../referrals';
import { proEnabled } from '../pro/config';
import { applyOrderDiscounts } from '../pro/discounts';
import { isProMember } from '../pro/status';
import { servicesFor } from '../../design-reference/lib/catalog.js';
import { GAMES } from '../../design-reference/lib/games.js';
import {
  AUTHORIZE_ONLY_METHODS,
  adminFor,
  paymentsConfig,
  stripeFor,
} from './config';

/** Stripe's minimum Checkout Session lifetime. */
const SESSION_MINUTES = 30;

export const CheckoutRequestSchema = z.strictObject({
  gameId: z.string().max(8),
  serviceId: z.string().max(64),
  units: z.number().int().min(1).max(10),
  server: z.string().max(60),
  rank: z.string().max(40).optional(),
  edition: z.enum(['Java', 'Bedrock']).optional(),
  ign: z.string().trim().min(2).max(40),
  note: z.string().trim().max(200).optional(),
  voice: z.boolean().optional(),
  useWallet: z.boolean().default(true),
});
export type CheckoutRequest = z.infer<typeof CheckoutRequestSchema>;

interface CatalogMode {
  id: string;
  cat: string;
  title: string;
  unit: 'game' | 'hour';
}

/** Creator link first-order discount (owner decision 2026-10-27, docs/product/creators.md). */
export const CREATOR_FIRST_ORDER_PERCENT = 10;

/**
 * Pure: 10% off the customer price, rounded to the cent. Duoly covers it, so the teammate
 * payout is unchanged. Never takes the price below Stripe's 0.99 EUR order minimum.
 */
export function applyCreatorDiscount<
  T extends { row: { amount_eur_cents: number } },
>(
  built: T,
): Omit<T, 'row'> & {
  row: T['row'] & { first_order_discount_cents: number };
  discountCents: number;
} {
  const amount = built.row.amount_eur_cents;
  const discount = Math.min(
    Math.round((amount * CREATOR_FIRST_ORDER_PERCENT) / 100),
    Math.max(0, amount - 99),
  );
  return {
    ...built,
    row: {
      ...built.row,
      amount_eur_cents: amount - discount,
      first_order_discount_cents: discount,
    },
    discountCents: discount,
  };
}

/** Pure: everything the intent row and Checkout Session need, priced on the server. */
export function buildCheckout(
  request: CheckoutRequest,
  rate: number = FALLBACK_EUR_TO_USD,
) {
  const quote = calculateQuote(
    {
      gameId: request.gameId,
      serviceId: request.serviceId,
      units: request.units,
      server: request.server,
      ...(request.rank ? { rank: request.rank } : {}),
      ...(request.edition ? { edition: request.edition } : {}),
      ign: request.ign,
    },
    { eurToUsd: rate, customerCurrency: 'EUR' },
  );
  const service = (
    servicesFor(request.gameId) as { modes: CatalogMode[] }
  ).modes.find((mode) => mode.id === request.serviceId)!;
  const game = (GAMES as { id: string; name: string }[]).find(
    (entry) => entry.id === request.gameId,
  )!;
  const region =
    request.gameId === 'mc'
      ? `${request.server.trim()} · ${request.edition}`
      : request.server;
  const units = `${request.units} ${quote.unit}${request.units === 1 ? '' : 's'}`;
  return {
    row: {
      game: request.gameId,
      service: service.id,
      title: service.title.slice(0, 80),
      units: request.units,
      unit: quote.unit,
      gg: service.cat === 'gg',
      rank: request.rank ?? '',
      region: region.slice(0, 80),
      ign: request.ign.trim(),
      note: request.note?.trim() ?? '',
      voice: request.voice ?? false,
      amount_eur_cents: quote.amountEurMinor,
      payout_usd_cents: quote.teammate.amountMinor,
      booking_fx: rate,
    },
    productName: `${service.title} · ${units}`,
    description: [game.name, region, request.rank ? `from ${request.rank}` : '']
      .filter(Boolean)
      .join(' · '),
  };
}

export function sessionParams(input: {
  intentId: string;
  customerId: string;
  email: string | null;
  origin: string;
  amountEurCents: number;
  productName: string;
  description: string;
  nowSeconds: number;
}): Stripe.Checkout.SessionCreateParams {
  const authorizeOnly = Object.fromEntries(
    AUTHORIZE_ONLY_METHODS.map((method) => [
      method,
      { capture_method: 'manual' },
    ]),
  ) as Stripe.Checkout.SessionCreateParams.PaymentMethodOptions;
  return {
    // Our own UI around Stripe's Payment and Express Checkout Elements.
    ui_mode: 'elements',
    mode: 'payment',
    return_url: `${input.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
    client_reference_id: input.intentId,
    ...(input.email ? { customer_email: input.email } : {}),
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'eur',
          unit_amount: input.amountEurCents,
          product_data: {
            name: input.productName,
            description: input.description,
          },
        },
      },
    ],
    payment_method_options: authorizeOnly,
    payment_intent_data: {
      description: `Duoly · ${input.productName}`,
      metadata: { intent_id: input.intentId, customer_id: input.customerId },
      ...(input.email ? { receipt_email: input.email } : {}),
    },
    metadata: { intent_id: input.intentId, customer_id: input.customerId },
    expires_at: input.nowSeconds + SESSION_MINUTES * 60 + 60,
  };
}

export const createCheckout: APIRoute = async (context) => {
  const { account, body, failure } = await mutation(context);
  if (failure || !body) return failure!;
  const config = paymentsConfig();
  if (!config)
    return account.json({ error: 'Payments are not set up yet.' }, 503);
  try {
    const identity = await account.identity();
    if (!identity)
      return account.json({ error: 'Sign in to book a teammate.' }, 401);
    if (identity.viewer.role !== 'customer')
      return account.json(
        { error: 'Teammate and admin accounts can’t book orders.' },
        403,
      );
    const { csrf: _csrf, ...input } = body;
    void _csrf;
    const parsed = CheckoutRequestSchema.safeParse(input);
    if (!parsed.success)
      return account.json({ error: 'Check your order details.' }, 400);
    let built: ReturnType<typeof buildCheckout>;
    try {
      built = buildCheckout(parsed.data, (await eurToUsd()).rate);
    } catch {
      return account.json({ error: 'That option isn’t available.' }, 400);
    }
    const active = await account.client!.rpc('customer_active_order');
    const activeOrder = (
      active.data as { order?: { id: string } | null } | null
    )?.order;
    if (activeOrder)
      return account.json(
        {
          error: 'You already have an open order.',
          order_id: activeOrder.id,
        },
        409,
      );
    const admin = adminFor(config);
    // Blocked by an admin (Customers): no new bookings, checked before any Stripe session exists.
    const blocked = await admin
      .from('customer_blocks')
      .select('user_id')
      .eq('user_id', identity.viewer.id)
      .maybeSingle();
    if (blocked.error)
      return account.json(
        { error: 'Checkout is unavailable. Try again.' },
        503,
      );
    if (blocked.data)
      return account.json(
        {
          error:
            'Your account can’t book right now. Contact us at hello@duoly.gg.',
        },
        403,
      );
    const now = Math.floor(Date.now() / 1000);
    // Creator code from the server-set referral cookie only; the database resolves it to an
    // active creator and attributes the customer once the order is paid (ledger #28).
    const refCode = checkoutRefCode(
      context.cookies,
      config.origin.startsWith('https:'),
    );
    // First order through an active creator's link: 10% off (decided in the database).
    let creatorEligible = false;
    if (refCode) {
      const eligible = await (
        admin.rpc as unknown as (
          fn: string,
          args: Record<string, unknown>,
        ) => PromiseLike<{ data: unknown; error: unknown }>
      )('referral_first_order_discount_eligible', {
        p_customer: identity.viewer.id,
        p_code: refCode,
      });
      creatorEligible = !eligible.error && eligible.data === true;
    }
    // Duoly PRO: 10% off, from the subscription state in the database only (ledger #39).
    let proMember = false;
    if (proEnabled()) {
      try {
        proMember = await isProMember(admin, identity.viewer.id);
      } catch {
        return account.json(
          { error: 'Checkout is unavailable. Try again.' },
          503,
        );
      }
    }
    // One discount only, before the wallet split; docs/product/pro.md.
    const priced = applyOrderDiscounts(
      built,
      { pro: proMember, creator: creatorEligible },
      CREATOR_FIRST_ORDER_PERCENT,
    );
    const { data: intent, error } = await admin
      .from('checkout_intents')
      .insert({
        ...priced.row,
        ...(refCode ? { ref_code: refCode } : {}),
        customer_id: identity.viewer.id,
        expires_at: new Date(
          (now + SESSION_MINUTES * 60 + 60) * 1000,
        ).toISOString(),
      })
      .select('id')
      .single();
    if (error || !intent)
      return account.json(
        { error: 'Checkout is unavailable. Try again.' },
        503,
      );

    const rpc = admin.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>,
    ) => PromiseLike<{ data: unknown; error: unknown }>;
    let cardEurCents = priced.row.amount_eur_cents;
    if (parsed.data.useWallet) {
      const reserved = await rpc('checkout_reserve_wallet', {
        p_intent_id: intent.id,
      });
      const split = reserved.data as {
        wallet_eur_cents?: number;
        card_eur_cents?: number;
      } | null;
      if (
        reserved.error ||
        !split ||
        !Number.isInteger(split.card_eur_cents) ||
        !Number.isInteger(split.wallet_eur_cents) ||
        split.card_eur_cents! < 0 ||
        split.wallet_eur_cents! < 0 ||
        split.card_eur_cents! + split.wallet_eur_cents! !==
          priced.row.amount_eur_cents
      ) {
        await rpc('checkout_release_wallet', {
          p_intent_id: intent.id,
          p_status: 'failed',
        });
        return account.json(
          { error: 'Checkout is unavailable. Try again.' },
          503,
        );
      }
      cardEurCents = split.card_eur_cents!;
      if (cardEurCents === 0) {
        const paid = await rpc('create_wallet_order', {
          p_intent_id: intent.id,
        });
        const result = paid.data as {
          order_id?: string;
          conflict?: boolean;
          error?: string;
        } | null;
        if (paid.error || !result || result.error) {
          await rpc('checkout_release_wallet', {
            p_intent_id: intent.id,
            p_status: 'failed',
          });
          return account.json(
            { error: 'Checkout is unavailable. Try again.' },
            503,
          );
        }
        if (result.conflict)
          return account.json(
            { error: 'You already have an open order.' },
            409,
          );
        if (!result.order_id) {
          await rpc('checkout_release_wallet', {
            p_intent_id: intent.id,
            p_status: 'failed',
          });
          return account.json(
            { error: 'Checkout is unavailable. Try again.' },
            503,
          );
        }
        return account.json({
          intent_id: intent.id,
          order_id: result.order_id,
          url: `/queue/${result.order_id}`,
          wallet_only: true,
        });
      }
    }

    const stripe = stripeFor(config);
    let session: Stripe.Checkout.Session;
    try {
      session = await stripe.checkout.sessions.create(
        sessionParams({
          intentId: intent.id,
          customerId: identity.viewer.id,
          email: identity.viewer.email,
          origin: config.origin,
          amountEurCents: cardEurCents,
          productName: built.productName,
          description: built.description,
          nowSeconds: now,
        }),
        { idempotencyKey: `checkout_${intent.id}` },
      );
    } catch {
      await rpc('checkout_release_wallet', {
        p_intent_id: intent.id,
        p_status: 'failed',
      });
      return account.json(
        { error: 'Checkout is unavailable. Try again.' },
        503,
      );
    }
    const updated = await admin
      .from('checkout_intents')
      .update({
        stripe_session_id: session.id,
        stripe_client_secret: session.client_secret,
        updated_at: new Date().toISOString(),
      })
      .eq('id', intent.id);
    if (updated.error) {
      await stripe.checkout.sessions.expire(session.id).catch(() => undefined);
      await rpc('checkout_release_wallet', {
        p_intent_id: intent.id,
        p_status: 'failed',
      });
      return account.json(
        { error: 'Checkout is unavailable. Try again.' },
        503,
      );
    }
    return account.json({
      intent_id: intent.id,
      url: `/checkout/${intent.id}`,
    });
  } catch {
    return account.json({ error: 'Checkout is unavailable. Try again.' }, 503);
  }
};

/** Polled by the return page until the webhook has created the order. */
export const checkoutStatus: APIRoute = async (context) => {
  const account = accountContext(context.request, context.cookies);
  const id = z.uuid().safeParse(context.params.id);
  if (!id.success) return account.json({ error: 'Not found.' }, 404);
  try {
    const identity = await account.identity();
    if (!identity || !account.client)
      return account.json({ error: 'Sign in first.' }, 401);
    const { data, error } = await account.client.rpc(
      'customer_checkout_status',
      { p_intent_id: id.data },
    );
    if (error || !data || (data as { error?: string }).error)
      return account.json({ error: 'Not found.' }, 404);
    return account.json(data);
  } catch {
    return account.json({ error: 'Unavailable.' }, 503);
  }
};
