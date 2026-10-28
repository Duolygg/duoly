import type { APIRoute } from 'astro';
import type Stripe from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';
import { adminFor, paymentsConfig, stripeFor } from './config';
import { settlePending } from './settle';
import { handleProEvent, isProCheckoutSession } from '../pro/webhook';
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

export interface TipPaymentFacts {
  paymentIntentId: string;
  tipId: string;
  amountCents: number;
  currency: string;
}

/** A succeeded, server-labelled tip PaymentIntent. */
export function tipPaymentFacts(object: unknown): TipPaymentFacts | null {
  if (!object || typeof object !== 'object') return null;
  const value = object as {
    id?: unknown;
    status?: unknown;
    amount_received?: unknown;
    currency?: unknown;
    metadata?: { tip_id?: unknown };
  };
  const id = stripeId(value.id);
  const tipId = value.metadata?.tip_id;
  if (
    !id?.startsWith('pi_') ||
    value.status !== 'succeeded' ||
    typeof tipId !== 'string' ||
    !/^[0-9a-f-]{36}$/i.test(tipId) ||
    !Number.isInteger(value.amount_received) ||
    (value.amount_received as number) < 100 ||
    (value.amount_received as number) > 10_000 ||
    value.currency !== 'eur'
  )
    return null;
  return {
    paymentIntentId: id,
    tipId,
    amountCents: value.amount_received as number,
    currency: value.currency,
  };
}

export function tipRefundFacts(object: unknown): {
  paymentIntentId: string;
  refundedCents: number;
} | null {
  if (!object || typeof object !== 'object') return null;
  const value = object as {
    payment_intent?: unknown;
    amount_refunded?: unknown;
  };
  const paymentIntentId = stripeId(value.payment_intent);
  if (
    !paymentIntentId?.startsWith('pi_') ||
    !Number.isInteger(value.amount_refunded) ||
    (value.amount_refunded as number) < 0
  )
    return null;
  return {
    paymentIntentId,
    refundedCents: value.amount_refunded as number,
  };
}

export function tipDisputeFacts(object: unknown): {
  disputeId: string;
  paymentIntentId: string;
  status: string;
} | null {
  if (!object || typeof object !== 'object') return null;
  const value = object as {
    id?: unknown;
    payment_intent?: unknown;
    status?: unknown;
  };
  const disputeId = stripeId(value.id);
  const paymentIntentId = stripeId(value.payment_intent);
  if (
    !disputeId?.startsWith('dp_') ||
    !paymentIntentId?.startsWith('pi_') ||
    typeof value.status !== 'string'
  )
    return null;
  return { disputeId, paymentIntentId, status: value.status };
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

async function releaseSessionWallet(
  admin: SupabaseClient,
  sessionId: string,
  status: 'expired' | 'failed',
) {
  const { data } = await admin
    .from('checkout_intents')
    .select('id')
    .eq('stripe_session_id', sessionId)
    .maybeSingle();
  if (!data?.id) return;
  const result = await admin.rpc('checkout_release_wallet', {
    p_intent_id: data.id,
    p_status: status,
  });
  if (result.error) throw new Error('checkout_release_wallet failed');
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
    .select('id, amount_eur_cents, wallet_eur_cents, status, stripe_session_id')
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
  if (facts.state === 'failed') {
    await admin.rpc('checkout_release_wallet', {
      p_intent_id: row.id,
      p_status: 'failed',
    });
    return 'payment_failed';
  }
  // The price is ours; Stripe must have collected exactly the card part.
  if (facts.eurAmountCents !== row.amount_eur_cents - row.wallet_eur_cents)
    return 'amount_mismatch';
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
        // Duoly PRO subscription sessions are handled in src/server/pro/webhook.ts.
        if (isProCheckoutSession(event.data.object)) {
          outcome = (await handleProEvent(stripe, admin, event)) ?? 'ignored';
          break;
        }
        outcome = await fulfil(stripe, admin, event.data.object.id);
        break;
      case 'checkout.session.async_payment_failed':
        await releaseSessionWallet(admin, event.data.object.id, 'failed');
        outcome = 'failed';
        break;
      case 'checkout.session.expired':
        await releaseSessionWallet(admin, event.data.object.id, 'expired');
        outcome = 'expired';
        break;
      case 'payment_intent.succeeded': {
        const tip = tipPaymentFacts(event.data.object);
        if (!tip) break;
        const result = await admin.rpc('order_tip_record_payment', {
          p_payment_intent: tip.paymentIntentId,
          p_tip_id: tip.tipId,
          p_amount_cents: tip.amountCents,
          p_currency: tip.currency,
        });
        if (result.error) throw new Error('order_tip_record_payment failed');
        outcome = 'tip_paid';
        break;
      }
      case 'payment_intent.payment_failed':
      case 'payment_intent.canceled': {
        const intent = event.data.object as Stripe.PaymentIntent;
        if (!intent.id?.startsWith('pi_') || !intent.metadata?.tip_id) break;
        const result = await admin.rpc('order_tip_record_failure', {
          p_payment_intent: intent.id,
          p_status:
            event.type === 'payment_intent.canceled' ? 'canceled' : 'failed',
          p_error: intent.last_payment_error?.code ?? event.type,
        });
        if (result.error) throw new Error('order_tip_record_failure failed');
        outcome = 'tip_payment_failed';
        break;
      }
      case 'charge.dispute.created':
      case 'charge.dispute.updated':
      case 'charge.dispute.closed': {
        const dispute = disputeFacts(event.data.object);
        if (!dispute) break;
        const lookup = await admin.rpc('order_tip_for_intent', {
          p_payment_intent: dispute.paymentIntentId,
        });
        if (lookup.error) throw new Error('order_tip_for_intent failed');
        if (
          typeof lookup.data === 'string' &&
          /^[0-9a-f-]{36}$/i.test(lookup.data)
        ) {
          const tipResult = await admin.rpc('order_tip_record_dispute', {
            p_dispute_id: dispute.disputeId,
            p_payment_intent: dispute.paymentIntentId,
            p_status: dispute.status,
          });
          if (tipResult.error)
            throw new Error('order_tip_record_dispute failed');
          outcome = `tip_dispute_${dispute.action}`;
          break;
        }
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
        const lookup = await admin.rpc('order_tip_for_intent', {
          p_payment_intent: paymentIntent,
        });
        if (lookup.error) throw new Error('order_tip_for_intent failed');
        if (
          typeof lookup.data === 'string' &&
          /^[0-9a-f-]{36}$/i.test(lookup.data)
        ) {
          let refundedCents = tipRefundFacts(event.data.object)?.refundedCents;
          if (refundedCents === undefined) {
            const intent = await stripe.paymentIntents.retrieve(paymentIntent, {
              expand: ['latest_charge'],
            });
            refundedCents =
              intent.latest_charge && typeof intent.latest_charge === 'object'
                ? intent.latest_charge.amount_refunded
                : undefined;
          }
          if (!Number.isInteger(refundedCents))
            throw new Error('tip refund total unavailable');
          const tipResult = await admin.rpc('order_tip_record_refund', {
            p_payment_intent: paymentIntent,
            p_refunded_cents: refundedCents,
          });
          if (tipResult.error)
            throw new Error('order_tip_record_refund failed');
          outcome = 'tip_refund_recorded';
          break;
        }
        const result = await admin.rpc('record_payment_refund', {
          p_payment_intent: paymentIntent,
          p_reason: 'Refund received from Stripe',
        });
        if (result.error) throw new Error('record_payment_refund failed');
        outcome = 'refund_recorded';
        break;
      }
      default:
        // Duoly PRO: customer.subscription.* and invoice.paid / payment_failed.
        outcome = (await handleProEvent(stripe, admin, event)) ?? 'ignored';
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
  const stripe = stripeFor(config);
  const sweep = await admin.rpc('sweep_expired_orders', { p_limit: 100 });
  const stale = await admin.rpc('checkout_stale_wallet_holds', { p_limit: 20 });
  const staleRows = Array.isArray(stale.data)
    ? (stale.data as { id: string; stripe_session_id?: string | null }[])
    : [];
  for (const row of staleRows) {
    if (row.stripe_session_id)
      await stripe.checkout.sessions
        .expire(row.stripe_session_id)
        .catch(() => undefined);
    await admin.rpc('checkout_release_wallet', {
      p_intent_id: row.id,
      p_status: 'expired',
    });
  }
  const settled = await settlePending(stripe, admin, 50);
  return json({
    expired: sweep.data ?? null,
    walletHoldsReleased: staleRows.length,
    settled: settled.processed,
  });
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
