import type { APIRoute } from 'astro';
import type Stripe from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';
import { adminFor, paymentsConfig, stripeFor } from './config';
import { settlePending } from './settle';
import { sendEmail } from '../email/send';
import { GAME } from '../../design-reference/lib/games.js';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });

const METHOD_LABELS: Record<string, string> = {
  card: 'Card',
  paypal: 'PayPal',
  klarna: 'Klarna',
  amazon_pay: 'Amazon Pay',
  revolut_pay: 'Revolut Pay',
  link: 'Link',
  eps: 'EPS',
  ideal: 'iDEAL',
  bancontact: 'Bancontact',
  sepa_debit: 'SEPA Direct Debit',
  p24: 'Przelewy24',
  twint: 'TWINT',
  wero: 'Wero',
  mb_way: 'MB WAY',
  mobilepay: 'MobilePay',
  bizum: 'Bizum',
  satispay: 'Satispay',
  alipay: 'Alipay',
  wechat_pay: 'WeChat Pay',
  pay_by_bank: 'Pay by Bank',
};

export function refundedPaymentIntentId(
  type: string,
  object: unknown,
): string | null {
  if (!object || typeof object !== 'object') return null;
  const value = object as {
    status?: unknown;
    refunded?: unknown;
    payment_intent?: unknown;
  };
  if (type.startsWith('refund.') && value.status !== 'succeeded') return null;
  if (type === 'charge.refunded' && value.refunded !== true) return null;
  const intent = value.payment_intent;
  if (typeof intent === 'string') return intent;
  if (intent && typeof intent === 'object' && 'id' in intent) {
    const id = (intent as { id?: unknown }).id;
    return typeof id === 'string' ? id : null;
  }
  return null;
}

export type DisputeAction = 'block' | 'unblock' | 'forfeit';

export interface DisputeFacts {
  disputeId: string;
  chargeId: string;
  paymentIntentId: string;
  status: string;
  reason: string;
  action: DisputeAction;
}

const stripeId = (value: unknown): string | null => {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id;
    return typeof id === 'string' ? id : null;
  }
  return null;
};

/** Pure: reduce a Stripe dispute into the database action it requires. */
export function disputeFacts(object: unknown): DisputeFacts | null {
  if (!object || typeof object !== 'object') return null;
  const value = object as {
    id?: unknown;
    charge?: unknown;
    payment_intent?: unknown;
    status?: unknown;
    reason?: unknown;
  };
  const disputeId = stripeId(value.id);
  const chargeId = stripeId(value.charge);
  const paymentIntentId = stripeId(value.payment_intent);
  if (
    !disputeId?.startsWith('dp_') ||
    !chargeId?.startsWith('ch_') ||
    !paymentIntentId?.startsWith('pi_') ||
    typeof value.status !== 'string'
  )
    return null;
  const action: DisputeAction =
    value.status === 'lost'
      ? 'forfeit'
      : value.status === 'won' || value.status === 'warning_closed'
        ? 'unblock'
        : 'block';
  return {
    disputeId,
    chargeId,
    paymentIntentId,
    status: value.status,
    reason: typeof value.reason === 'string' ? value.reason : 'unknown',
    action,
  };
}

export interface PaymentFacts {
  intentId: string;
  paymentIntentId: string;
  amountMinor: number;
  currency: string;
  eurAmountCents: number | null;
  method: string;
  state: 'authorized' | 'captured' | 'processing' | 'failed';
}

/** Pure: reduce a completed session plus its PaymentIntent to what we store. */
export function paymentFacts(
  session: Stripe.Checkout.Session,
  intent: Stripe.PaymentIntent,
): PaymentFacts | null {
  const intentId = session.client_reference_id ?? session.metadata?.intent_id;
  if (!intentId || !/^[0-9a-f-]{36}$/i.test(intentId)) return null;
  const charge =
    typeof intent.latest_charge === 'object' ? intent.latest_charge : null;
  const method =
    charge?.payment_method_details?.type ??
    intent.payment_method_types[0] ??
    '';
  // Adaptive Pricing: the session may be presented in another currency; the
  // conversion block carries the original EUR amount we priced.
  const eurAmountCents =
    session.currency === 'eur'
      ? session.amount_total
      : session.currency_conversion?.source_currency === 'eur'
        ? session.currency_conversion.amount_total
        : null;
  const state =
    intent.status === 'requires_capture'
      ? 'authorized'
      : intent.status === 'succeeded'
        ? 'captured'
        : intent.status === 'processing'
          ? 'processing'
          : 'failed';
  return {
    intentId,
    paymentIntentId: intent.id,
    amountMinor: intent.amount,
    currency: intent.currency,
    eurAmountCents,
    method,
    state,
  };
}

async function confirmEmail(
  admin: SupabaseClient,
  orderId: string,
  email: string | null,
  method: string,
) {
  if (!email) return;
  const { data: order } = await admin
    .from('orders')
    .select(
      'public_reference, game, title, units, unit, region, rank, amount_eur_cents, customer_name, created_at',
    )
    .eq('id', orderId)
    .single();
  if (!order) return;
  const game = (GAME as Record<string, { name: string; img: string }>)[
    order.game
  ];
  const total = { cents: order.amount_eur_cents, currency: 'EUR' as const };
  await sendEmail({
    template: 'order_confirmed',
    to: email,
    idempotencyKey: `order_confirmed:${order.public_reference}`,
    data: {
      firstName: String(order.customer_name).split(' ')[0] || 'there',
      order: {
        id: order.public_reference,
        game: { name: game?.name ?? order.game, icon: game?.img ?? '' },
        service: order.title,
        units: order.units,
        unit: order.unit,
        region: order.region,
        ...(order.rank ? { rank: order.rank } : {}),
      },
      lines: [{ label: order.title, amount: total }],
      total,
      paidWith: METHOD_LABELS[method] ?? 'Online payment',
      paidAt: new Intl.DateTimeFormat('en-GB', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Europe/Vienna',
      }).format(new Date(order.created_at)),
    },
  });
}

async function fulfil(
  stripe: Stripe,
  admin: SupabaseClient,
  sessionId: string,
): Promise<string> {
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.status !== 'complete') return 'session_not_complete';
  const paymentIntentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id;
  if (!paymentIntentId) return 'no_payment_intent';
  const intent = await stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ['latest_charge'],
  });
  const facts = paymentFacts(session, intent);
  if (!facts) return 'unknown_intent';
  const { data: row } = await admin
    .from('checkout_intents')
    .select('id, amount_eur_cents, status, stripe_session_id')
    .eq('id', facts.intentId)
    .single();
  if (!row || row.stripe_session_id !== session.id) return 'intent_mismatch';
  if (facts.state === 'processing') {
    await admin
      .from('checkout_intents')
      .update({
        status: 'processing',
        stripe_payment_intent_id: facts.paymentIntentId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
      .eq('status', 'open');
    return 'processing';
  }
  if (facts.state === 'failed') return 'payment_failed';
  // The price is ours; Stripe must have collected exactly that.
  if (facts.eurAmountCents !== row.amount_eur_cents) return 'amount_mismatch';
  const { data: result, error } = await admin.rpc('create_paid_order', {
    p_intent_id: row.id,
    p_payment_intent: facts.paymentIntentId,
    p_amount_minor: facts.amountMinor,
    p_currency: facts.currency,
    p_method: facts.method,
    p_state: facts.state,
  });
  if (error) throw new Error('create_paid_order failed');
  const outcome = result as {
    order_id?: string;
    created?: boolean;
    conflict?: boolean;
  };
  if (outcome.conflict) {
    // Second paid checkout while an order is open: give the money back at once.
    if (intent.status === 'requires_capture')
      await stripe.paymentIntents.cancel(
        intent.id,
        { cancellation_reason: 'duplicate' },
        { idempotencyKey: `void_conflict_${row.id}` },
      );
    else if (intent.status === 'succeeded')
      await stripe.refunds.create(
        { payment_intent: intent.id, reason: 'duplicate' },
        { idempotencyKey: `refund_conflict_${row.id}` },
      );
    return 'conflict_released';
  }
  if (outcome.created && outcome.order_id)
    await confirmEmail(
      admin,
      outcome.order_id,
      session.customer_details?.email ?? session.customer_email ?? null,
      facts.method,
    ).catch(() => undefined);
  return outcome.created ? 'order_created' : 'order_exists';
}

export const stripeWebhook: APIRoute = async ({ request }) => {
  const config = paymentsConfig();
  if (!config?.webhookSecret) return json({ error: 'not_configured' }, 503);
  const signature = request.headers.get('stripe-signature');
  const body = await request.text();
  if (!signature || body.length > 512_000)
    return json({ error: 'bad_request' }, 400);
  const stripe = stripeFor(config);
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      config.webhookSecret,
    );
  } catch {
    return json({ error: 'invalid_signature' }, 400);
  }
  const admin = adminFor(config);
  const seen = await admin
    .from('stripe_events')
    .select('id')
    .eq('id', event.id)
    .maybeSingle();
  if (seen.data) return json({ received: true, duplicate: true });
  let outcome = 'ignored';
  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        outcome = await fulfil(stripe, admin, event.data.object.id);
        break;
      case 'checkout.session.async_payment_failed':
        await admin
          .from('checkout_intents')
          .update({ status: 'failed', updated_at: new Date().toISOString() })
          .eq('stripe_session_id', event.data.object.id)
          .in('status', ['open', 'processing']);
        outcome = 'failed';
        break;
      case 'checkout.session.expired':
        await admin
          .from('checkout_intents')
          .update({ status: 'expired', updated_at: new Date().toISOString() })
          .eq('stripe_session_id', event.data.object.id)
          .eq('status', 'open');
        outcome = 'expired';
        break;
      case 'charge.dispute.created':
      case 'charge.dispute.updated':
      case 'charge.dispute.closed': {
        const dispute = disputeFacts(event.data.object);
        if (!dispute) break;
        const result = await admin.rpc('record_stripe_dispute', {
          p_dispute_id: dispute.disputeId,
          p_charge_id: dispute.chargeId,
          p_payment_intent: dispute.paymentIntentId,
          p_status: dispute.status,
          p_reason: dispute.reason,
        });
        if (result.error) throw new Error('record_stripe_dispute failed');
        outcome = `dispute_${dispute.action}`;
        break;
      }
      case 'charge.refunded':
      case 'refund.created':
      case 'refund.updated': {
        const paymentIntent = refundedPaymentIntentId(
          event.type,
          event.data.object,
        );
        if (!paymentIntent) break;
        const result = await admin.rpc('record_payment_refund', {
          p_payment_intent: paymentIntent,
          p_reason: 'Refund received from Stripe',
        });
        if (result.error) throw new Error('record_payment_refund failed');
        outcome = 'refund_recorded';
        break;
      }
      default:
        break;
    }
  } catch {
    // Not recorded: Stripe retries, and every step above is idempotent.
    return json({ error: 'processing_failed' }, 500);
  }
  await admin.from('stripe_events').insert({ id: event.id, type: event.type });
  return json({ received: true, outcome });
};

/** Scheduled by pg_cron: expire stale queue orders, then settle money actions. */
export const paymentsTick: APIRoute = async ({ request }) => {
  const config = paymentsConfig();
  const auth = request.headers.get('authorization') ?? '';
  if (!config?.tickSecret || auth !== `Bearer ${config.tickSecret}`)
    return json({ error: 'unauthorized' }, 401);
  const admin = adminFor(config);
  const sweep = await admin.rpc('sweep_expired_orders', { p_limit: 100 });
  const settled = await settlePending(stripeFor(config), admin, 50);
  return json({ expired: sweep.data ?? null, settled: settled.processed });
};

/** Best-effort immediate settlement after accept/cancel; the tick is the backstop. */
export async function settleSoon(): Promise<void> {
  const config = paymentsConfig();
  if (!config) return;
  await Promise.race([
    settlePending(stripeFor(config), adminFor(config), 10),
    new Promise((resolve) => setTimeout(resolve, 4000)),
  ]);
}
