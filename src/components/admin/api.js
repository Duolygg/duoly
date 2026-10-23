// Browser client for the admin API. Every POST carries the CSRF token; the server re-checks
// the admin role and the database re-checks it again inside each command.

const toMs = (value) => (value ? Date.parse(value) : null);

export function adminApi(csrf) {
  async function request(path, init) {
    let res;
    try {
      res = await globalThis.fetch(path, {
        credentials: 'same-origin',
        redirect: 'error',
        cache: 'no-store',
        ...init,
      });
    } catch {
      return { ok: false, error: 'Can’t reach Duoly right now. Try again.' };
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok)
      return {
        ok: false,
        status: res.status,
        error: body.error || 'That didn’t work. Try again.',
      };
    return { ok: true, data: body };
  }
  return {
    get: (path) => request(path, { method: 'GET' }),
    post: (path, body) =>
      request(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, csrf }),
      }),
  };
}

/** Server account → what the Users screen renders (times in ms like the original). */
export function account(a) {
  return {
    ...a,
    name: a.name && a.name !== 'Player' ? a.name : '',
    lastSeen: toMs(a.lastSeen),
    firstSeen: toMs(a.firstSeen),
    roleAt: toMs(a.roleAt),
  };
}

const STATUS = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
};
/** Server application → the original card shape. */
export function application(a) {
  return {
    ...a,
    status: STATUS[a.status] || a.status,
    submittedAt: toMs(a.submittedAt),
    decidedAt: toMs(a.decidedAt),
  };
}

export function auditEntry(x) {
  return { ...x, at: toMs(x.at) };
}

const ORDER_STATUS = {
  queued: 'Queued',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};
const PAY = {
  card: 'Card',
  link: 'Link',
  paypal: 'PayPal',
  apple_pay: 'Apple Pay',
  google_pay: 'Google Pay',
  klarna: 'Klarna',
  revolut_pay: 'Revolut Pay',
  amazon_pay: 'Amazon Pay',
  eps: 'EPS',
  ideal: 'iDEAL',
  bancontact: 'Bancontact',
  sepa_debit: 'SEPA Debit',
  mobilepay: 'MobilePay',
  twint: 'TWINT',
  blik: 'BLIK',
  p24: 'Przelewy24',
};
/** Server order -> the original Orders screen shape (amounts in EUR/USD, times in ms). */
export function order(o) {
  const created = toMs(o.createdAt);
  const accepted = toMs(o.acceptedAt);
  const method = o.payment
    ? PAY[o.payment.method] || o.payment.method || 'Online payment'
    : 'Not paid through Stripe';
  return {
    ...o,
    status: ORDER_STATUS[o.status] || o.status,
    games: o.units,
    amount: o.amountCents / 100,
    payoutUsd: o.payoutUsdCents / 100,
    refund: (o.refundCents || 0) / 100,
    pay: method,
    createdAt: created,
    queuedAt: toMs(o.queuedAt),
    acceptedAt: accepted,
    completedAt: toMs(o.completedAt),
    cancelledAt: toMs(o.cancelledAt),
    waitSec: accepted
      ? Math.max(0, Math.round((accepted - toMs(o.queuedAt)) / 1000))
      : 0,
    customerAv: o.customerAv || '/assets/avatars/avatar-1.png',
    teammateAv: o.teammateAv || '/assets/avatars/avatar-1.png',
  };
}
