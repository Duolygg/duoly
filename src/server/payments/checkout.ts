import type { APIRoute } from 'astro';
import type Stripe from 'stripe';
import { z } from 'zod';
import { mutation } from '../auth/handlers';
import { accountContext } from '../auth/context';
import { calculateQuote } from '../pricing';
import { servicesFor } from '../../design-reference/lib/catalog.js';
import { GAMES } from '../../design-reference/lib/games.js';
import {
  AUTHORIZE_ONLY_METHODS,
  adminFor,
  paymentsConfig,
  stripeFor,
} from './config';

/** Until a persisted ECB rate exists, payouts use the brief's fallback rate. */
export const FALLBACK_EUR_TO_USD = 1.08;
/** Stripe's minimum Checkout Session lifetime. */
const SESSION_MINUTES = 30;
/** Stripe Tax product code "General - Services". */
const SERVICES_TAX_CODE = 'txcd_20030000';

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
});
export type CheckoutRequest = z.infer<typeof CheckoutRequestSchema>;

interface CatalogMode {
  id: string;
  cat: string;
  title: string;
  unit: 'game' | 'hour';
}

/** Pure: everything the intent row and Checkout Session need, priced on the server. */
export function buildCheckout(request: CheckoutRequest) {
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
    { eurToUsd: FALLBACK_EUR_TO_USD, customerCurrency: 'EUR' },
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
      booking_fx: FALLBACK_EUR_TO_USD,
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
  /** Stripe Tax and post-purchase invoices; test mode only until VAT is registered. */
  taxAndInvoices: boolean;
}): Stripe.Checkout.SessionCreateParams {
  const metadata = { intent_id: input.intentId, customer_id: input.customerId };
  // Prices stay tax-inclusive so the customer pays exactly our quote and the
  // webhook's amount check still holds; Stripe carves VAT out of the total.
  const taxAndInvoices: Partial<Stripe.Checkout.SessionCreateParams> =
    input.taxAndInvoices
      ? {
          automatic_tax: { enabled: true },
          tax_id_collection: { enabled: true },
          invoice_creation: {
            enabled: true,
            invoice_data: {
              description: `Duoly · ${input.productName}`,
              metadata,
              rendering_options: {
                amount_tax_display: 'include_inclusive_tax',
              },
            },
          },
        }
      : {};
  const authorizeOnly = Object.fromEntries(
    AUTHORIZE_ONLY_METHODS.map((method) => [
      method,
      { capture_method: 'manual' },
    ]),
  ) as Stripe.Checkout.SessionCreateParams.PaymentMethodOptions;
  return {
    ui_mode: 'embedded_page',
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
          ...(input.taxAndInvoices
            ? { tax_behavior: 'inclusive' as const }
            : {}),
          product_data: {
            name: input.productName,
            description: input.description,
            ...(input.taxAndInvoices ? { tax_code: SERVICES_TAX_CODE } : {}),
          },
        },
      },
    ],
    payment_method_options: authorizeOnly,
    payment_intent_data: {
      description: `Duoly · ${input.productName}`,
      metadata,
      ...(input.email ? { receipt_email: input.email } : {}),
    },
    metadata,
    expires_at: input.nowSeconds + SESSION_MINUTES * 60 + 60,
    locale: 'auto',
    ...taxAndInvoices,
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
      built = buildCheckout(parsed.data);
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
    const stripe = stripeFor(config);
    const now = Math.floor(Date.now() / 1000);
    const { data: intent, error } = await admin
      .from('checkout_intents')
      .insert({
        ...built.row,
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
    const session = await stripe.checkout.sessions.create(
      sessionParams({
        intentId: intent.id,
        customerId: identity.viewer.id,
        email: identity.viewer.email,
        origin: config.origin,
        amountEurCents: built.row.amount_eur_cents,
        productName: built.productName,
        description: built.description,
        nowSeconds: now,
        taxAndInvoices: config.testMode,
      }),
      { idempotencyKey: `checkout_${intent.id}` },
    );
    await admin
      .from('checkout_intents')
      .update({
        stripe_session_id: session.id,
        stripe_client_secret: session.client_secret,
        updated_at: new Date().toISOString(),
      })
      .eq('id', intent.id);
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
