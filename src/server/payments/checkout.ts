import type { APIRoute } from 'astro';
import type Stripe from 'stripe';
import { z } from 'zod';
import { eurToUsd, FALLBACK_EUR_TO_USD } from '../fx';
import { mutation } from '../auth/handlers';
import { accountContext } from '../auth/context';
import { calculateQuote } from '../pricing';
import { checkoutRefCode } from '../referrals';
import { selectCreatorCode } from '../creators/code';
import { proEnabled } from '../pro/config';
import { applyOrderDiscounts } from '../pro/discounts';
import { isProMember } from '../pro/status';
import { billingCustomer } from './customer';
import {
  checkCheckoutPerks,
  freeCoachingIntentRow,
  freeCoachingOutcome,
} from '../perks/checkout';
import { servicesFor } from '../../design-reference/lib/catalog.js';
import { GAMES } from '../../design-reference/lib/games.js';
import { MoodSchema } from '../../contracts/orders';
import { StreamerQuoteSchema, streamPrice } from '../../contracts/streaming';
import {
  AUTHORIZE_ONLY_METHODS,
  adminFor,
  paymentsConfig,
  stripeFor,
} from './config';

/** Stripe's minimum Checkout Session lifetime. */
export const SESSION_MINUTES = 30;

export const CheckoutRequestSchema = z
  .strictObject({
    gameId: z.string().max(8),
    serviceId: z.string().max(64),
    units: z.number().int().min(1).max(10),
    server: z.string().max(60),
    rank: z.string().max(40).optional(),
    edition: z.enum(['Java', 'Bedrock']).optional(),
    ign: z.string().trim().min(2).max(40),
    note: z.string().trim().max(200).optional(),
    voice: z.boolean().optional(),
    // How the session should feel; left out means no preference (20261101120000_order_moods).
    mood: MoodSchema.optional(),
    creatorCode: z.string().max(40).optional(),
    useWallet: z.boolean().default(true),
    // Platinum and Diamond: this month's free 1-hour coaching (migration 20261026160000).
    // The free order pays nothing, so it never takes wallet money, a PRO or creator discount.
    freePerk: z.boolean().optional(),
    // Twitch streaming: the handle of a live streamer from /api/home/streamers. With it,
    // serviceId is 'stream' and units are the booked hours (migration 20261105100000).
    streamer: z.uuid().optional(),
  })
  .refine((request) => !(request.freePerk && request.useWallet), {
    message: 'The free coaching order does not use the wallet.',
    path: ['useWallet'],
  })
  .refine(
    (request) =>
      (request.streamer !== undefined) === (request.serviceId === 'stream') &&
      !(request.streamer && request.freePerk),
    { message: 'A streamer booking is its own order.', path: ['streamer'] },
  );
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
      // Social sessions are calls, so they are always on voice.
      voice: request.gameId === 'social' || (request.voice ?? false),
      // Social sessions are a chat, not a match, so they carry no mood.
      ...(request.mood && request.gameId !== 'social'
        ? { mood: request.mood }
        : {}),
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

/**
 * Pure: a Twitch streaming booking, priced from the streamer's own hourly rate (the database
 * confirmed they are live, stream this game and offer this many hours). 60% to the streamer
 * like every order; no PRO or creator discount, the wallet can still pay.
 */
export function buildStreamCheckout(
  request: CheckoutRequest,
  streamer: { streamerId: string; name: string; rateEurCents: number },
  rate: number = FALLBACK_EUR_TO_USD,
) {
  const game = (GAMES as { id: string; name: string }[]).find(
    (entry) => entry.id === request.gameId,
  );
  if (!game || request.gameId === 'social' || request.serviceId !== 'stream')
    throw new Error('not a streaming game');
  const price = streamPrice(streamer.rateEurCents, request.units, rate);
  const region =
    request.gameId === 'mc'
      ? `${request.server.trim()} · ${request.edition ?? 'Java'}`
      : request.server.trim();
  if (region.length < 2) throw new Error('server required');
  const title = `Twitch stream with ${streamer.name}`.slice(0, 80);
  const hours = `${request.units} hour${request.units === 1 ? '' : 's'}`;
  return {
    row: {
      game: request.gameId,
      service: 'stream',
      title,
      units: request.units,
      unit: 'hour' as const,
      gg: false,
      rank: request.rank ?? '',
      region: region.slice(0, 80),
      ign: request.ign.trim(),
      note: request.note?.trim() ?? '',
      voice: request.voice ?? false,
      ...(request.mood ? { mood: request.mood } : {}),
      amount_eur_cents: price.amountEurCents,
      payout_usd_cents: price.payoutUsdCents,
      booking_fx: rate,
    },
    streamer: {
      streamer_id: streamer.streamerId,
      streamer_name: streamer.name,
      streamer_rate_eur_cents: streamer.rateEurCents,
    },
    productName: `${title} · ${hours}`,
    description: [game.name, region].join(' · '),
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
  /** The account's Stripe customer: offers "save this card" (used by Play again). */
  stripeCustomer?: string | null;
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
    // With the account's Stripe customer, Stripe's form offers an optional "save my payment
    // details" box (the customer's consent) and prefills cards saved that way next time. Play again
    // (docs/product/play-again.md) pays with such a card.
    ...(input.stripeCustomer
      ? {
          customer: input.stripeCustomer,
          saved_payment_method_options: {
            payment_method_save: 'enabled' as const,
          },
        }
      : input.email
        ? { customer_email: input.email }
        : {}),
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
    const admin = adminFor(config);
    // Bound on first use, so nothing touches the admin client before it's needed.
    const rpc = (fn: string, args: Record<string, unknown>) =>
      (
        admin.rpc as unknown as (
          fn: string,
          args: Record<string, unknown>,
        ) => PromiseLike<{ data: unknown; error: unknown }>
      ).call(admin, fn, args);
    let built: ReturnType<typeof buildCheckout>;
    let streamer: ReturnType<typeof buildStreamCheckout>['streamer'] | null =
      null;
    try {
      const fx = (await eurToUsd()).rate;
      if (parsed.data.streamer) {
        // The database says whether this streamer is live right now, for this game and length.
        const quoted = await rpc('streamer_checkout_quote', {
          p_handle: parsed.data.streamer,
          p_game: parsed.data.gameId,
          p_hours: parsed.data.units,
          // their own unfinished checkout for this streamer doesn't block a retry
          p_customer: identity.viewer.id,
        });
        const refusal = (quoted.data as { error?: { message?: unknown } })
          ?.error;
        if (quoted.error || !quoted.data)
          return account.json(
            { error: 'Checkout is unavailable. Try again.' },
            503,
          );
        if (refusal)
          return account.json(
            {
              error:
                typeof refusal.message === 'string'
                  ? refusal.message
                  : 'That streamer can’t be booked right now.',
            },
            409,
          );
        const quote = StreamerQuoteSchema.safeParse(quoted.data);
        if (!quote.success)
          return account.json(
            { error: 'Checkout is unavailable. Try again.' },
            503,
          );
        const stream = buildStreamCheckout(parsed.data, quote.data, fx);
        built = stream;
        streamer = stream.streamer;
      } else built = buildCheckout(parsed.data, fx);
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
    const free = parsed.data.freePerk === true;
    const perkCheck = await checkCheckoutPerks(
      account.client!.rpc.bind(account.client!) as unknown as (
        fn: string,
        args?: Record<string, unknown>,
      ) => PromiseLike<{ data: unknown; error: unknown }>,
      {
        free,
        gameId: parsed.data.gameId,
        serviceId: parsed.data.serviceId,
        units: parsed.data.units,
        gg: built.row.gg,
        voice: built.row.voice,
      },
    );
    if (!perkCheck.ok)
      return account.json({ error: perkCheck.error }, perkCheck.status);
    const now = Math.floor(Date.now() / 1000);
    if (free) {
      // Free monthly coaching: no Stripe, no wallet, no PRO or creator discount and no creator
      // code. The database checks the level and the month again and records the claim.
      const { data: freeIntent, error: freeError } = await admin
        .from('checkout_intents')
        .insert(
          freeCoachingIntentRow(built.row, {
            customerId: identity.viewer.id,
            expiresAt: new Date(
              (now + SESSION_MINUTES * 60 + 60) * 1000,
            ).toISOString(),
          }),
        )
        .select('id')
        .single();
      if (freeError || !freeIntent)
        return account.json(
          { error: 'Checkout is unavailable. Try again.' },
          503,
        );
      const created = await rpc('create_free_coaching_order', {
        p_intent_id: freeIntent.id,
      });
      const outcome = freeCoachingOutcome(created);
      if (!outcome.ok) {
        if (outcome.status === 503)
          await rpc('checkout_release_wallet', {
            p_intent_id: freeIntent.id,
            p_status: 'failed',
          });
        return account.json({ error: outcome.error }, outcome.status);
      }
      return account.json({
        intent_id: freeIntent.id,
        order_id: outcome.orderId,
        url: `/queue/${outcome.orderId}`,
        free_perk: true,
      });
    }
    // Explicit input wins, including an empty value to remove the link. No cookie is written.
    // The existing intent trigger and paid-order trigger resolve and record attribution once.
    const refCode = streamer
      ? null
      : selectCreatorCode(
          parsed.data.creatorCode,
          checkoutRefCode(context.cookies, config.origin.startsWith('https:')),
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
    if (proEnabled() && !streamer) {
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
        ...(streamer ?? {}),
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
    // Saving a card is optional: without a Stripe customer the checkout still works, just without it.
    const stripeCustomer = await billingCustomer(stripe, admin, {
      id: identity.viewer.id,
      email: identity.viewer.email,
    }).catch(() => null);
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
          stripeCustomer,
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
