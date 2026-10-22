import type Stripe from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';
import { releaseInvoice, type InvoiceRelease } from './invoice';

/**
 * Applies pending money actions that the order state machine requested:
 * accept → capture the authorization; cancel → release (void, or refund when the
 * method was charged at checkout) and correct the invoice if Checkout issued one.
 * Idempotent: Stripe calls carry idempotency keys and rows stay pending until a
 * terminal state is written.
 */
interface PendingPayment {
  order_id: string;
  stripe_payment_intent_id: string;
  state: string;
  settle: 'capture' | 'release' | 'none';
}

export type SettleOutcome =
  | 'captured'
  | 'voided'
  | 'refunded'
  | 'capture_failed'
  | 'release_failed'
  | 'retry';

/**
 * The money already moved, so an invoice failure never turns into a retry (that
 * would repeat the refund); it is kept in `last_error` for follow-up instead.
 */
async function withInvoice(
  stripe: Stripe,
  row: PendingPayment,
  state: 'voided' | 'refunded',
  release: InvoiceRelease,
): Promise<{ state: SettleOutcome; error?: string }> {
  try {
    await releaseInvoice(stripe, row.stripe_payment_intent_id, release, {
      key: row.order_id,
      reason: 'order_change',
    });
    return { state };
  } catch (error) {
    const message =
      error instanceof Error ? error.message.slice(0, 180) : 'stripe error';
    return { state, error: `invoice: ${message}` };
  }
}

export async function settleOne(
  stripe: Stripe,
  row: PendingPayment,
): Promise<{ state: SettleOutcome; error?: string }> {
  const id = row.stripe_payment_intent_id;
  try {
    const intent = await stripe.paymentIntents.retrieve(id);
    if (row.settle === 'capture') {
      if (intent.status === 'succeeded') return { state: 'captured' };
      if (intent.status !== 'requires_capture')
        return {
          state: intent.status === 'processing' ? 'retry' : 'capture_failed',
          error: `payment intent is ${intent.status}`,
        };
      await stripe.paymentIntents.capture(
        id,
        {},
        { idempotencyKey: `capture_${row.order_id}` },
      );
      return { state: 'captured' };
    }
    if (row.settle === 'release') {
      // Also reached on a retry after the void itself went through.
      if (intent.status === 'canceled')
        return withInvoice(stripe, row, 'voided', { kind: 'void' });
      if (intent.status === 'requires_capture') {
        await stripe.paymentIntents.cancel(
          id,
          { cancellation_reason: 'abandoned' },
          { idempotencyKey: `void_${row.order_id}` },
        );
        return withInvoice(stripe, row, 'voided', { kind: 'void' });
      }
      if (intent.status === 'succeeded') {
        const refund = await stripe.refunds.create(
          {
            payment_intent: id,
            reason: 'requested_by_customer',
            metadata: { order_id: row.order_id },
          },
          { idempotencyKey: `refund_${row.order_id}` },
        );
        return withInvoice(stripe, row, 'refunded', {
          kind: 'refund',
          refundId: refund.id,
        });
      }
      return { state: 'retry', error: `payment intent is ${intent.status}` };
    }
    return { state: 'retry', error: 'nothing to settle' };
  } catch (error) {
    const message =
      error instanceof Error ? error.message.slice(0, 200) : 'stripe error';
    return { state: 'retry', error: message };
  }
}

/** Claims and settles up to `limit` pending payments. Never throws. */
export async function settlePending(
  stripe: Stripe,
  admin: SupabaseClient,
  limit = 20,
): Promise<{ processed: number; outcomes: SettleOutcome[] }> {
  try {
    const { data, error } = await admin.rpc('claim_payment_settlements', {
      p_limit: limit,
    });
    if (error || !Array.isArray(data)) return { processed: 0, outcomes: [] };
    const outcomes: SettleOutcome[] = [];
    for (const row of data as PendingPayment[]) {
      const result = await settleOne(stripe, row);
      outcomes.push(result.state);
      await admin.rpc('finish_payment_settlement', {
        p_order_id: row.order_id,
        p_state: result.state,
        p_error: result.error ?? null,
      });
    }
    return { processed: outcomes.length, outcomes };
  } catch {
    return { processed: 0, outcomes: [] };
  }
}
