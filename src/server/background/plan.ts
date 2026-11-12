/**
 * What a timer would do, decided from state read at fire time. Pure on purpose: a timer is a
 * wake-up, never a decision (docs/product/background-work.md), so every handler reads the current
 * state, runs it through one of these functions and only then acts.
 *
 * Shadow mode uses exactly the same functions and stops before acting, which is what makes
 * "shadow never claims, never posts, never calls Stripe" true by construction rather than by
 * care.
 */
import {
  ORDER_EXPIRE_DELAY_MS,
  PRESENCE_CHECK_INTERVAL_MS,
  type TimerDisposition,
  type TimerKind,
} from '../../contracts/background';

/** How far apart two timestamps may be and still be the same instant. See `sameInstant`. */
export const EPOCH_TOLERANCE_MS = 1;

/**
 * `queued_at` travels as a timestamptz in one direction and as
 * `floor(extract(epoch from queued_at) * 1000)` in the other, and that multiplication happens in
 * double precision, so the two can disagree by a millisecond. Two real queue epochs are always
 * seconds apart (a re-queue writes `clock_timestamp()`), so a millisecond of slack cannot hide a
 * stale timer.
 */
export const sameInstant = (a: number, b: number): boolean =>
  Math.abs(a - b) <= EPOCH_TOLERANCE_MS;

/** A plan recheck while something else owns the work: the shortest useful wake-up. */
export const PENDING_RECHECK_MS = 60_000;
/** Something answered no (Discord refused, a row was locked): look again this much later. */
export const SHORT_RETRY_MS = 30_000;
/** A drain that made progress and still has eligible rows continues almost at once. */
export const DRAIN_CONTINUE_MS = 5_000;
/** `claim_payment_settlements` stops at this many attempts, and so does the timer. */
export const SETTLE_ATTEMPT_CAP = 20;
/** The 20 s the SQL due predicate leaves so nobody is pinged for a link that is about to die. */
export const POST_WINDOW_GUARD_MS = 20_000;

/**
 * `act` is the only action that touches anything. The other four are the dispositions of
 * src/contracts/background.ts, decided before any write.
 */
export type PlanAction = 'act' | 'done' | 'stale' | 'retry' | 'pending';

export interface TimerPlan {
  action: PlanAction;
  /** Required for `retry` and `pending`: when to look again. */
  at?: number;
  note?: string;
}

const plan = (action: PlanAction, note?: string, at?: number): TimerPlan => ({
  action,
  ...(at === undefined ? {} : { at }),
  ...(note === undefined ? {} : { note }),
});

/** The line shadow mode writes instead of doing the work. */
export function shadowLine(
  kind: TimerKind,
  ref: string,
  would: string,
  note?: string,
): string {
  return `[timer-shadow] ${kind} ${ref} would=${would}${note ? ` (${note})` : ''}`;
}

/** What shadow mode reports it would have done: the act label, or the disposition. */
export const wouldLabel = (result: TimerPlan, act: string): string =>
  result.action === 'act'
    ? act
    : result.at === undefined
      ? result.action
      : `${result.action}@${result.at}`;

/** The disposition of a plan that is not going to act. */
export function plannedDisposition(result: TimerPlan): TimerDisposition {
  const note = result.note ? { note: result.note } : {};
  if (result.action === 'retry' || result.action === 'pending')
    return { status: result.action, at: result.at ?? 0, ...note };
  if (result.action === 'stale') return { status: 'stale', ...note };
  return { status: 'done', ...note };
}

// ---------------------------------------------------------------- orders

export interface OrderState {
  status: string;
  /** timestamptz text from PostgREST. */
  queued_at: string | null;
}

const ms = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export interface OrderPostFacts {
  epoch: number;
  order: OrderState | null;
  /** A streaming booking has no public post deadline at all. */
  streaming: boolean;
  /** True when public.discord_order_posts_due lists this order right now. */
  due: boolean;
  now: number;
}

/** Set once the order is known to be queued for this epoch, so the caller can re-arm. */
export interface OrderWindow {
  queuedAt: number;
  expiresAt: number;
}

/** When the SQL due predicate does not list the order yet: something else owns the post. */
export const orderPostPending = (
  bounds: OrderWindow,
  now: number,
  note: string,
): TimerPlan =>
  plan('pending', note, Math.min(now + PENDING_RECHECK_MS, bounds.expiresAt));

/** Discord refused; try again until the order expires, which ends the timer by itself. */
export const orderPostRetry = (bounds: OrderWindow, now: number): TimerPlan =>
  plan(
    'retry',
    'Discord refused the post',
    Math.min(now + SHORT_RETRY_MS, bounds.expiresAt),
  );

/**
 * Whether this order may be posted now is decided by one authority only:
 * `public.discord_order_posts_due`, the exact predicate the 10 s tick uses, which already covers
 * the 100 s delay, priority picks through `order_public_queued_at`, team seat order, open or
 * fresh `posting` claims and the 20 s guard. The handler never re-derives any of that.
 *
 * The cost is that "not due yet" carries no deadline, so a held order is rechecked every 60 s
 * instead of exactly when the pick window closes: `order_teammate_picks` has no service_role read
 * grant (20261026160000_perks.sql:91), and reading it would also mean a second copy of
 * `order_public_queued_at` that could disagree with the first. An order lives 5 minutes, so this
 * is at most four extra wake-ups, and "not eligible yet" is never terminal (oai-review F1).
 */
export function orderPostPlan(facts: OrderPostFacts): {
  plan: TimerPlan;
  bounds: OrderWindow | null;
} {
  const bounds = orderWindow(facts.epoch, facts.order);
  if ('plan' in bounds) return { plan: bounds.plan, bounds: null };
  if (facts.streaming)
    return { plan: plan('stale', 'streaming booking, no public post'), bounds };
  // The SQL predicate leaves 20 s so nobody is pinged for a link that is about to die; past that
  // point this order can never be posted, which is terminal rather than something to recheck.
  if (bounds.expiresAt <= facts.now + POST_WINDOW_GUARD_MS)
    return { plan: plan('stale', 'too late to post'), bounds };
  if (!facts.due)
    return {
      plan: orderPostPending(bounds, facts.now, 'not eligible yet'),
      bounds,
    };
  return { plan: plan('act'), bounds };
}

export function orderExpirePlan(facts: {
  epoch: number;
  order: OrderState | null;
  now: number;
}): { plan: TimerPlan; bounds: OrderWindow | null } {
  const bounds = orderWindow(facts.epoch, facts.order);
  if ('plan' in bounds) return { plan: bounds.plan, bounds: null };
  if (bounds.expiresAt > facts.now)
    return {
      plan: plan('retry', 'fired before the deadline', bounds.expiresAt),
      bounds,
    };
  return { plan: plan('act'), bounds };
}

/** The order still has to be the queued order this key was written for. */
function orderWindow(
  epoch: number,
  order: OrderState | null,
): OrderWindow | { plan: TimerPlan } {
  if (!order) return { plan: plan('stale', 'order gone') };
  if (order.status !== 'queued')
    return { plan: plan('stale', `order is ${order.status}`) };
  const queuedAt = ms(order.queued_at);
  if (queuedAt === null) return { plan: plan('stale', 'no queued_at') };
  if (!sameInstant(queuedAt, epoch))
    return { plan: plan('stale', 'queued again since') };
  return { queuedAt, expiresAt: queuedAt + ORDER_EXPIRE_DELAY_MS };
}

/** A sweep ran: either this order left the queue, or the row was locked by someone else. */
export const orderExpireAfterSweep = (
  order: OrderState | null,
  epoch: number,
  now: number,
): TimerPlan => {
  const gone =
    !order ||
    order.status !== 'queued' ||
    !sameInstant(ms(order.queued_at) ?? 0, epoch);
  return gone
    ? plan('done', 'expired')
    : plan('retry', 'the sweep skipped a locked row', now + SHORT_RETRY_MS);
};

// ---------------------------------------------------------------- retry ladders

/**
 * The next step of a fixed retry ladder measured from the state that failed, so a handler needs no
 * counter of its own: +30 s, +2 min, +10 min, then null, which means the fixer owns it from here.
 */
export function nextRetryStep(
  delays: readonly number[],
  epoch: number,
  now: number,
): number | null {
  for (const delay of delays) if (epoch + delay > now) return epoch + delay;
  return null;
}

export interface PaymentState {
  settle: string;
  attempts: number;
}

export function settleRetryPlan(payment: PaymentState | null): TimerPlan {
  if (!payment) return plan('stale', 'no payment row');
  if (payment.settle === 'none') return plan('stale', 'already settled');
  // The claim path gives up at 20 attempts and so do we: those rows are a monitoring query, not a
  // silent retry (oai-review F6).
  if (payment.attempts >= SETTLE_ATTEMPT_CAP)
    return plan('stale', 'attempts exhausted');
  return plan('act');
}

/** After a settle attempt: settled is done, anything else walks the ladder. */
export function settleRetryAfter(
  payment: PaymentState | null,
  delays: readonly number[],
  epoch: number,
  now: number,
): TimerPlan {
  if (!payment || payment.settle === 'none') return plan('done', 'settled');
  if (payment.attempts >= SETTLE_ATTEMPT_CAP)
    return plan('done', 'attempts exhausted');
  const at = nextRetryStep(delays, epoch, now);
  return at === null
    ? plan('done', 'left to the fixer')
    : plan('retry', 'still pending', at);
}

// ---------------------------------------------------------------- analytics

export const analyticsRetryPlan = (eligible: number): TimerPlan =>
  eligible > 0 ? plan('act') : plan('done', 'outbox drained');

/**
 * After a bounded drain. Eligible rows left with a healthy PostHog mean a backlog, so continue
 * almost at once; eligible rows left after a failure wait for the ladder (oai-review F19).
 */
export function analyticsRetryAfter(facts: {
  eligible: number;
  failed: boolean;
  delays: readonly number[];
  epoch: number;
  now: number;
}): TimerPlan {
  if (facts.eligible === 0) return plan('done', 'outbox drained');
  if (!facts.failed)
    return plan('retry', 'more facts waiting', facts.now + DRAIN_CONTINUE_MS);
  const at = nextRetryStep(facts.delays, facts.epoch, facts.now);
  return at === null
    ? plan('done', 'left to the fixer')
    : plan('retry', 'the drain failed', at);
}

// ---------------------------------------------------------------- presence

/**
 * `fresh` is the count of teammates whose desk is online *and* whose heartbeat is newer than the
 * 20 s staleness window, the same rule as `presenceFresh` and the `roles` SQL predicate. A browser
 * that dies leaves `online = true` behind forever, so counting the raw column had the singleton
 * answer `retry` every 20 s for the rest of time (production bug: six such rows).
 *
 * The plan always acts, whatever the count: with nobody fresh, whoever just went stale is still
 * wearing the Online role in Discord, and this is the only thing left that will take it off them.
 * It still never writes presence: the staleness rule stays the only thing that decides who is
 * online (oai-review F5).
 */
export const presenceCheckPlan = (fresh: number): TimerPlan =>
  plan('act', fresh > 0 ? undefined : 'nobody fresh: one last sync');

/**
 * After that sync. Someone fresh means keep watching the desk; nobody fresh ends the timer, and
 * the next online event registers it again.
 */
export const presenceCheckAfter = (fresh: number, now: number): TimerPlan =>
  fresh > 0
    ? plan('retry', 'someone is still online', now + PRESENCE_CHECK_INTERVAL_MS)
    : plan('done', 'nobody online');
