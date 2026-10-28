import type Stripe from 'stripe';

/** Pure Stripe helpers for Connect payouts. No I/O, so every rule here is unit tested. */

export const PAYOUT_METADATA_KIND = 'duoly_payout';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface AccountFacts {
  accountId: string;
  detailsSubmitted: boolean;
  payoutsEnabled: boolean;
  transfersActive: boolean;
  disabledReason: string | null;
  requirementsDue: number;
}

/** What connect_account_sync() needs from a Stripe account object. */
export function accountFacts(object: unknown): AccountFacts | null {
  if (!object || typeof object !== 'object') return null;
  const account = object as Partial<Stripe.Account>;
  if (typeof account.id !== 'string' || !/^acct_[A-Za-z0-9]+$/.test(account.id))
    return null;
  const requirements = account.requirements;
  const due = new Set([
    ...(requirements?.currently_due ?? []),
    ...(requirements?.past_due ?? []),
  ]);
  return {
    accountId: account.id,
    detailsSubmitted: account.details_submitted === true,
    payoutsEnabled: account.payouts_enabled === true,
    transfersActive: account.capabilities?.transfers === 'active',
    disabledReason:
      typeof requirements?.disabled_reason === 'string'
        ? requirements.disabled_reason.slice(0, 120)
        : null,
    requirementsDue: Math.min(due.size, 500),
  };
}

/**
 * Connected account for one teammate (Accounts v2): Express Dashboard, recipient of transfers
 * only, individual, Stripe collects KYC and bank. Stripe refuses v1 `type: 'express'` for new
 * platforms; the platform is fees and losses collector (separate transfers, platform profile
 * loss-liability acknowledged by the owner 2026-10-28). Accounts v2 needs a contact email, so
 * null when the teammate has none. v1 retrieve and account links keep working on these ids.
 */
export function accountCreateParams(input: {
  teammateId: string;
  email: string | null;
  country: string;
}): Stripe.V2.Core.AccountCreateParams | null {
  if (!input.email) return null;
  return {
    contact_email: input.email,
    dashboard: 'express',
    identity: {
      country: input.country.toLowerCase(),
      entity_type: 'individual',
    },
    defaults: {
      responsibilities: {
        fees_collector: 'application',
        losses_collector: 'application',
      },
    },
    configuration: {
      recipient: {
        capabilities: {
          stripe_balance: { stripe_transfers: { requested: true } },
        },
      },
    },
    metadata: { kind: 'duoly_teammate', teammate_id: input.teammateId },
  };
}

export interface PreparedTransfer {
  id: string;
  lineId: string;
  accountId: string;
  currency: 'eur' | 'usd';
  amountMinor: number;
  amountUsdCents: number;
  idempotencyKey: string;
  teammate: string;
  week: string;
  resumed: boolean;
}

/** Reads payout_stripe_prepare()'s answer; null when it is not a complete transfer. */
export function preparedTransfer(value: unknown): PreparedTransfer | null {
  const t = (value as { transfer?: Record<string, unknown> } | null)?.transfer;
  if (!t || typeof t !== 'object') return null;
  if (
    typeof t.id !== 'string' ||
    !UUID.test(t.id) ||
    typeof t.lineId !== 'string' ||
    !UUID.test(t.lineId) ||
    typeof t.accountId !== 'string' ||
    !/^acct_[A-Za-z0-9]+$/.test(t.accountId) ||
    (t.currency !== 'eur' && t.currency !== 'usd') ||
    !Number.isInteger(t.amountMinor) ||
    (t.amountMinor as number) <= 0 ||
    !Number.isInteger(t.amountUsdCents) ||
    (t.amountUsdCents as number) < 1000 ||
    typeof t.idempotencyKey !== 'string' ||
    !t.idempotencyKey.startsWith(`duoly-payout-${t.lineId}-`)
  )
    return null;
  return {
    id: t.id,
    lineId: t.lineId,
    accountId: t.accountId,
    currency: t.currency,
    amountMinor: t.amountMinor as number,
    amountUsdCents: t.amountUsdCents as number,
    idempotencyKey: t.idempotencyKey,
    teammate: typeof t.teammate === 'string' ? t.teammate : 'Teammate',
    week: typeof t.week === 'string' ? t.week : '',
    resumed: t.resumed === true,
  };
}

/** The Transfer for one payout line. Metadata lets the webhook find the row again. */
export function transferParams(
  prepared: PreparedTransfer,
): Stripe.TransferCreateParams {
  return {
    amount: prepared.amountMinor,
    currency: prepared.currency,
    destination: prepared.accountId,
    transfer_group: `payout_line_${prepared.lineId}`,
    description: `Duoly payout, week of ${prepared.week}`.slice(0, 120),
    metadata: {
      kind: PAYOUT_METADATA_KIND,
      payout_line_id: prepared.lineId,
      payout_transfer_id: prepared.id,
      amount_usd_cents: String(prepared.amountUsdCents),
    },
  };
}

/**
 * refused: Stripe answered and did not create the transfer (safe to record as failed and try
 * again with a new attempt). unknown: no clear answer (timeout, 5xx, rate limit, idempotency
 * conflict); keep the pending row and retry with the same key.
 */
export function transferErrorKind(error: unknown): 'refused' | 'unknown' {
  const e = error as { type?: unknown; statusCode?: unknown } | null;
  const type = typeof e?.type === 'string' ? e.type : '';
  const status = typeof e?.statusCode === 'number' ? e.statusCode : 0;
  if (
    (type === 'StripeInvalidRequestError' ||
      type === 'StripePermissionError' ||
      type === 'StripeCardError') &&
    status >= 400 &&
    status < 500 &&
    status !== 409 &&
    status !== 429
  )
    return 'refused';
  return 'unknown';
}

export function stripeErrorText(error: unknown): string {
  const e = error as { code?: unknown; message?: unknown } | null;
  const code = typeof e?.code === 'string' ? e.code : 'stripe_error';
  const message = typeof e?.message === 'string' ? e.message : '';
  return `${code}${message ? ': ' + message : ''}`.slice(0, 300);
}

export interface TransferFacts {
  transferId: string;
  rowId: string | null;
  destination: string | null;
  amount: number;
  currency: string;
  amountReversed: number;
}

/** A Transfer we created for a payout line (metadata kind duoly_payout), else null. */
export function transferFacts(object: unknown): TransferFacts | null {
  if (!object || typeof object !== 'object') return null;
  const t = object as {
    id?: unknown;
    destination?: unknown;
    amount?: unknown;
    currency?: unknown;
    amount_reversed?: unknown;
    metadata?: Record<string, unknown> | null;
  };
  if (typeof t.id !== 'string' || !/^tr_[A-Za-z0-9]+$/.test(t.id)) return null;
  if (t.metadata?.kind !== PAYOUT_METADATA_KIND) return null;
  if (!Number.isInteger(t.amount) || typeof t.currency !== 'string')
    return null;
  const rowId = t.metadata?.payout_transfer_id;
  const destination =
    typeof t.destination === 'string'
      ? t.destination
      : t.destination &&
          typeof t.destination === 'object' &&
          typeof (t.destination as { id?: unknown }).id === 'string'
        ? (t.destination as { id: string }).id
        : null;
  return {
    transferId: t.id,
    rowId: typeof rowId === 'string' && UUID.test(rowId) ? rowId : null,
    destination,
    amount: t.amount as number,
    currency: t.currency,
    amountReversed: Number.isInteger(t.amount_reversed)
      ? (t.amount_reversed as number)
      : 0,
  };
}
