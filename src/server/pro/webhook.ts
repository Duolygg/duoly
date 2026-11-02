import type Stripe from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';
import { PRO_METADATA_KIND } from './config';

/**
 * Duoly PRO webhook handling (ledger #39). Kept apart from src/server/payments/webhook.ts so
 * other money steps can change that file without touching this one. Every handler re-reads
 * the subscription from Stripe and writes through one idempotent service-role RPC, so replays,
 * retries and out-of-order events are safe.
 */
export const PRO_SUBSCRIPTION_EVENTS = [
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
] as const;
export const PRO_INVOICE_EVENTS = [
  'invoice.paid',
  'invoice.payment_failed',
] as const;

type Rpc = (
  fn: string,
  args?: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: unknown }>;
// bound: supabase-js rpc reads `this`, so a detached `client.rpc` throws before any request
const rpcOf = (client: SupabaseClient) =>
  client.rpc.bind(client) as unknown as Rpc;

const idOf = (value: unknown): string | null => {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id;
    return typeof id === 'string' ? id : null;
  }
  return null;
};
const iso = (seconds: unknown): string | null =>
  typeof seconds === 'number' && Number.isFinite(seconds)
    ? new Date(seconds * 1000).toISOString()
    : null;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True for a Checkout Session we created for PRO (marked by metadata, never by mode alone). */
export function isProCheckoutSession(object: unknown): boolean {
  if (!object || typeof object !== 'object') return false;
  const session = object as { metadata?: { kind?: unknown } };
  return session.metadata?.kind === PRO_METADATA_KIND;
}

export interface SubscriptionFacts {
  subscriptionId: string;
  customerId: string;
  status: string;
  trialStart: string | null;
  trialEnd: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
  endedAt: string | null;
  metadataUser: string | null;
  cardFingerprint: string | null;
}

/** Pure: reduce a Stripe subscription to what pro_apply_subscription stores. */
export function subscriptionFacts(
  subscription: Stripe.Subscription,
): SubscriptionFacts | null {
  const sub = subscription as Stripe.Subscription & {
    current_period_end?: number;
  };
  const customerId = idOf(sub.customer);
  if (
    !sub.id?.startsWith('sub_') ||
    !customerId?.startsWith('cus_') ||
    sub.metadata?.kind !== PRO_METADATA_KIND
  )
    return null;
  // Since API 2025-03-31 the period lives on the item; older payloads keep it on the root.
  const item = sub.items?.data?.[0] as
    (Stripe.SubscriptionItem & { current_period_end?: number }) | undefined;
  const periodEnd = item?.current_period_end ?? sub.current_period_end ?? null;
  const method =
    sub.default_payment_method && typeof sub.default_payment_method === 'object'
      ? sub.default_payment_method
      : null;
  // R4 per card: cards (also Apple Pay and Google Pay) and SEPA debits carry a fingerprint.
  const fingerprint =
    method?.card?.fingerprint ?? method?.sepa_debit?.fingerprint ?? null;
  const metadataUser = sub.metadata?.user_id ?? null;
  return {
    subscriptionId: sub.id,
    customerId,
    status: sub.status,
    trialStart: iso(sub.trial_start),
    trialEnd: iso(sub.trial_end),
    currentPeriodEnd: iso(periodEnd),
    // The portal may schedule the end with cancel_at instead of cancel_at_period_end.
    cancelAtPeriodEnd: sub.cancel_at_period_end === true || !!sub.cancel_at,
    canceledAt: iso(sub.canceled_at),
    endedAt: iso(sub.ended_at),
    metadataUser: metadataUser && UUID.test(metadataUser) ? metadataUser : null,
    cardFingerprint:
      fingerprint && /^[A-Za-z0-9]{8,64}$/.test(fingerprint)
        ? fingerprint
        : null,
  };
}

/** Pure: the subscription an invoice belongs to (new parent shape first, then the old field). */
export function invoiceSubscriptionId(object: unknown): string | null {
  if (!object || typeof object !== 'object') return null;
  const invoice = object as {
    parent?: { subscription_details?: { subscription?: unknown } | null };
    subscription?: unknown;
  };
  const id =
    idOf(invoice.parent?.subscription_details?.subscription) ??
    idOf(invoice.subscription);
  return id?.startsWith('sub_') ? id : null;
}

/** Records a subscription the server just created (the trial start), like its webhook would. */
export function syncProSubscription(
  stripe: Stripe,
  admin: SupabaseClient,
  subscriptionId: string,
): Promise<string> {
  return syncSubscription(
    stripe,
    admin,
    subscriptionId,
    Math.floor(Date.now() / 1000),
  );
}

/**
 * A card saved in Manage PRO (the customer's default payment method): put it on their PRO
 * subscription, and resume one the trial paused for lack of a card. Billing starts now.
 */
async function cardAdded(
  stripe: Stripe,
  object: unknown,
): Promise<string | null> {
  const customer = object as {
    id?: unknown;
    invoice_settings?: { default_payment_method?: unknown } | null;
  };
  const customerId = idOf(customer.id);
  const method = idOf(customer.invoice_settings?.default_payment_method);
  if (!customerId?.startsWith('cus_') || !method?.startsWith('pm_'))
    return null;
  const list = await stripe.subscriptions.list({
    customer: customerId,
    status: 'all',
    limit: 10,
  });
  const pro = list.data.filter(
    (s) =>
      s.metadata?.kind === PRO_METADATA_KIND &&
      ['trialing', 'paused', 'past_due', 'unpaid'].includes(s.status),
  );
  if (!pro.length) return null;
  for (const sub of pro) {
    if (idOf(sub.default_payment_method) !== method)
      await stripe.subscriptions.update(
        sub.id,
        { default_payment_method: method },
        { idempotencyKey: `pro_card_${sub.id}_${method}` },
      );
    if (sub.status === 'paused')
      // resuming starts a new monthly period today (Stripe's default anchor) and bills it now
      await stripe.subscriptions.resume(
        sub.id,
        {},
        { idempotencyKey: `pro_resume_${sub.id}_${method}` },
      );
  }
  return 'pro_card_added';
}

async function syncSubscription(
  stripe: Stripe,
  admin: SupabaseClient,
  subscriptionId: string,
  eventCreated: number,
): Promise<string> {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ['default_payment_method'],
  });
  const facts = subscriptionFacts(subscription);
  if (!facts) return 'pro_not_ours';
  const rpc = rpcOf(admin);
  const applied = await rpc('pro_apply_subscription', {
    p_event_created: iso(eventCreated),
    p_subscription: facts.subscriptionId,
    p_customer: facts.customerId,
    p_status: facts.status,
    p_trial_start: facts.trialStart,
    p_trial_end: facts.trialEnd,
    p_current_period_end: facts.currentPeriodEnd,
    p_cancel_at_period_end: facts.cancelAtPeriodEnd,
    p_canceled_at: facts.canceledAt,
    p_ended_at: facts.endedAt,
    p_metadata_user: facts.metadataUser,
  });
  if (applied.error) throw new Error('pro_apply_subscription failed');
  const result = applied.data as {
    ignored?: string;
    status?: string;
    duplicate?: boolean;
    trial_check_needed?: boolean;
  } | null;
  if (!result) throw new Error('pro_apply_subscription returned nothing');
  if (result.ignored) return `pro_${result.ignored}`;
  if (result.duplicate) {
    // A second live membership for the same account (two checkouts at once): end the new one.
    await stripe.subscriptions.cancel(
      facts.subscriptionId,
      {},
      { idempotencyKey: `pro_cancel_duplicate_${facts.subscriptionId}` },
    );
    return 'pro_duplicate_cancelled';
  }
  if (result.trial_check_needed) {
    // R4, one trial per card: a card that already had a trial on another account pays now.
    // Without a card yet, a later event (with the card attached) runs the check.
    if (!facts.cardFingerprint) return 'pro_trial_card_pending';
    const claim = await rpc('pro_claim_trial_card', {
      p_subscription: facts.subscriptionId,
      p_fingerprint: facts.cardFingerprint,
    });
    if (claim.error) throw new Error('pro_claim_trial_card failed');
    if (claim.data === false) {
      await stripe.subscriptions.update(
        facts.subscriptionId,
        { trial_end: 'now', proration_behavior: 'none' },
        { idempotencyKey: `pro_end_trial_${facts.subscriptionId}` },
      );
      return 'pro_trial_card_reused';
    }
  }
  return `pro_${result.status ?? facts.status}`;
}

/**
 * Handles a verified event when it belongs to PRO. Returns null for everything else, so the
 * caller keeps its own handling. Throws on failure; the caller then answers 500 and Stripe
 * retries.
 */
export async function handleProEvent(
  stripe: Stripe,
  admin: SupabaseClient,
  event: Stripe.Event,
): Promise<string | null> {
  const object = event.data.object as unknown;
  if (
    event.type === 'checkout.session.completed' ||
    event.type === 'checkout.session.async_payment_succeeded'
  ) {
    if (!isProCheckoutSession(object)) return null;
    const subscriptionId = idOf(
      (object as { subscription?: unknown }).subscription,
    );
    if (!subscriptionId) return 'pro_session_without_subscription';
    return syncSubscription(stripe, admin, subscriptionId, event.created);
  }
  if ((PRO_SUBSCRIPTION_EVENTS as readonly string[]).includes(event.type)) {
    const subscriptionId = idOf(object);
    if (!subscriptionId?.startsWith('sub_')) return 'pro_not_ours';
    return syncSubscription(stripe, admin, subscriptionId, event.created);
  }
  if (event.type === 'customer.updated') return cardAdded(stripe, object);
  if ((PRO_INVOICE_EVENTS as readonly string[]).includes(event.type)) {
    const subscriptionId = invoiceSubscriptionId(object);
    const invoice = object as {
      id?: unknown;
      amount_paid?: unknown;
      amount_due?: unknown;
      currency?: unknown;
    };
    const invoiceId = idOf(invoice.id);
    if (!subscriptionId || !invoiceId?.startsWith('in_')) return 'pro_not_ours';
    const synced = await syncSubscription(
      stripe,
      admin,
      subscriptionId,
      event.created,
    );
    if (synced === 'pro_not_ours' || synced === 'pro_unknown_customer')
      return synced;
    const paid = event.type === 'invoice.paid';
    const amount = paid ? invoice.amount_paid : invoice.amount_due;
    const recorded = await rpcOf(admin)('pro_record_invoice', {
      p_event_created: iso(event.created),
      p_invoice: invoiceId,
      p_subscription: subscriptionId,
      p_state: paid ? 'paid' : 'failed',
      p_amount_minor:
        typeof amount === 'number' && amount >= 0 ? Math.round(amount) : 0,
      p_currency:
        typeof invoice.currency === 'string' ? invoice.currency : 'eur',
    });
    if (recorded.error) throw new Error('pro_record_invoice failed');
    return paid ? 'pro_invoice_paid' : 'pro_invoice_failed';
  }
  return null;
}
