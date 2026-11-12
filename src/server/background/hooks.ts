/**
 * The event half of the event-driven background work (docs/product/background-work.md).
 *
 * The timers in `./handlers.ts` cover the deadlines. These hooks cover the events: the moment an
 * order is accepted, cancelled or expired, the moment an analytics fact is enqueued, the moment a
 * settle attempt failed, the moment a checkout died holding wallet money, the moment the last desk
 * tab went away. Each one runs after the response (`./after.ts`), never changes it, and never
 * throws.
 *
 * Two kinds of hook, and the difference is what shadow mode does:
 *
 * - **Registration hooks** (`settle-retry`, `analytics-retry`, `presence-check`, the next team
 *   seat's `order-post`) run in `shadow` and in `live`. A registration writes nothing anybody can
 *   see, and shadow exists precisely to prove that the registrations arrive and that their fire
 *   times match what the 10 s dispatcher did.
 * - **Acting hooks** (closing a Discord post, draining the analytics outbox, releasing a wallet
 *   hold) run only in `live`. In `shadow` they write one
 *   `[event-shadow] <kind> <ref> would=<act>` line and touch nothing, which is the same rule the
 *   timer handlers follow (oai-review F12).
 *
 * In `legacy` nothing new happens at all: the 10 s dispatcher owns every one of these jobs today
 * and keeps owning it.
 *
 * Nothing here is the durable boundary. Every hook has a backstop in `public.background_overdue()`,
 * so a failed hook is a log line and a slower outcome, never lost work (oai-review F3, F6, F10).
 */
import type { APIRoute } from 'astro';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  ANALYTICS_RETRY_DELAYS_MS,
  PRESENCE_CHECK_INTERVAL_MS,
  SETTLE_RETRY_DELAYS_MS,
  type SwitchKind,
  type SwitchMode,
} from '../../contracts/background';
import {
  orderPostsConfig,
  runOrderPosts,
  supabaseOrderPostStore,
  type OrderPostsResult,
} from '../discord/order-post-tick';
import { drainConfig, drainOnce, type DrainResult } from '../analytics/drain';
import { supportService } from '../support/store';
import { afterResponse } from './after';
import { nextRetryStep, SETTLE_ATTEMPT_CAP } from './plan';
import { registerTimer, type TimerRegistration } from './register';
import { backgroundMode } from './switches';

/**
 * A failed drain and a failed settle both walk the ladder from the state that asked for the retry.
 * A settle has one (`order_payments.updated_at`); a drain has none, so the hook buckets `now` into
 * 30 s steps. Two failures inside one bucket are then the same key instead of two timers, which
 * keeps a burst of requests from writing a timer each.
 */
export const RETRY_EPOCH_BUCKET_MS = 30_000;

export const retryEpoch = (now: number): number =>
  Math.floor(now / RETRY_EPOCH_BUCKET_MS) * RETRY_EPOCH_BUCKET_MS;

/** The settle state a retry is measured from. */
export interface SettleState {
  settle: string;
  attempts: number;
  /** `order_payments.updated_at` in milliseconds: the commit that asked for the retry. */
  updatedAt: number;
}

/**
 * Everything a hook may touch. One implementation knows about the database and the existing
 * modules; the tests use their own, so every hook path is checked without Discord, PostHog,
 * Stripe, a worker or a database.
 */
export interface HookPorts {
  now(): number;
  log(line: string): void;
  mode(kind: SwitchKind): Promise<SwitchMode>;
  register(timer: TimerRegistration): Promise<unknown>;
  /** Edits every open post whose order moved on. Null when order posts are switched off. */
  closePosts(): Promise<OrderPostsResult | null>;
  /** The queued seat of this order's team that may be posted next, if there is one. */
  nextTeamSeat(orderId: string): Promise<{ id: string; epoch: number } | null>;
  /** Null when analytics are switched off. */
  drainAnalytics(): Promise<DrainResult | null>;
  /** Rows the drain could still claim right now. */
  eligibleAnalytics(): Promise<number>;
  settleState(orderId: string): Promise<SettleState | null>;
  releaseWalletHold(intentId: string): Promise<boolean>;
}

const shadow = (
  ports: HookPorts,
  kind: SwitchKind,
  ref: string,
  would: string,
): void => {
  ports.log(`[event-shadow] ${kind} ${ref} would=${would}`);
};

// ---------------------------------------------------------------- the real ports

const ms = (value: unknown): number | null => {
  if (typeof value !== 'string') return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export function hookPorts(db: SupabaseClient, site: string): HookPorts {
  return {
    now: () => Date.now(),
    log: (line) => console.warn(line),
    mode: (kind) => backgroundMode(db, kind),
    register: (timer) => registerTimer(timer),

    closePosts: async () => {
      const config = orderPostsConfig();
      if (!config) return null;
      const store = supabaseOrderPostStore(config);
      // Closing only. Posting an order is the `order-post` timer's job and needs the 100 s delay,
      // the claim and the queue epoch; an event hook that posted here would be a second owner.
      return runOrderPosts(config, site, {
        store: { ...store, due: async () => [] },
      });
    },

    nextTeamSeat: async (orderId) => {
      const mine = await db
        .from('orders')
        .select('team_id')
        .eq('id', orderId)
        .maybeSingle();
      const team = (mine.data as { team_id?: unknown } | null)?.team_id;
      if (mine.error || typeof team !== 'string') return null;
      const seats = await db
        .from('orders')
        .select('id, queued_at')
        .eq('team_id', team)
        .eq('status', 'queued')
        .order('seat', { ascending: true })
        .limit(1);
      const next = Array.isArray(seats.data)
        ? (seats.data[0] as { id?: unknown; queued_at?: unknown } | undefined)
        : undefined;
      const epoch = ms(next?.queued_at);
      if (seats.error || typeof next?.id !== 'string' || epoch === null)
        return null;
      return { id: next.id, epoch };
    },

    drainAnalytics: async () => {
      const config = drainConfig();
      if (!config) return null;
      return drainOnce(db, config);
    },

    eligibleAnalytics: async () => {
      const { count, error } = await db
        .from('analytics_outbox')
        .select('id', { count: 'exact', head: true })
        .is('sent_at', null)
        .is('failed_at', null)
        .or(
          `claimed_until.is.null,claimed_until.lte.${new Date().toISOString()}`,
        );
      // Same direction as background_overdue(): an unreadable predicate reads as work to do.
      if (error) return 1;
      return count ?? 0;
    },

    settleState: async (orderId) => {
      const { data, error } = await db
        .from('order_payments')
        .select('settle, attempts, updated_at')
        .eq('order_id', orderId)
        .maybeSingle();
      if (error || !data) return null;
      const row = data as {
        settle?: unknown;
        attempts?: unknown;
        updated_at?: unknown;
      };
      const updatedAt = ms(row.updated_at);
      if (typeof row.settle !== 'string' || updatedAt === null) return null;
      return {
        settle: row.settle,
        attempts: typeof row.attempts === 'number' ? row.attempts : 0,
        updatedAt,
      };
    },

    releaseWalletHold: async (intentId) => {
      const { error } = await db.rpc('checkout_release_wallet', {
        p_intent_id: intentId,
        p_status: 'failed',
      });
      return !error;
    },
  };
}

// ---------------------------------------------------------------- orders: close the post

/**
 * Accept, customer cancel, admin cancel, reroll and expiry all mean "this post is now a dead
 * link". `public.discord_order_posts_to_close()` already decides which posts those are and which
 * wording each one gets, so the hook runs exactly the closing half of the 10 s tick and nothing
 * else. Editing a known message is the safe repeated operation (oai-review F12): running this twice
 * costs one PATCH that answers 200 and writes nothing new.
 *
 * Then team progression. Closing a seat's post is what makes the next seat eligible, and the SQL
 * predicate only lets one post per team be open at a time, so the hook pulls the next seat's
 * `order-post` wake-up forward to now. Registration keeps the earliest `at`, so this moves the
 * sibling's existing timer rather than adding a second one (oai-review F1).
 */
export async function closeOrderPostsAfter(
  ports: HookPorts,
  orderId?: string | null,
): Promise<void> {
  const mode = await ports.mode('orders');
  if (mode === 'legacy') return;
  const ref = orderId ?? 'all';
  if (mode === 'shadow') return shadow(ports, 'orders', ref, 'close');
  const result = await ports.closePosts();
  if (!result) return;
  if (result.failed > 0)
    ports.log(`[background] ${result.failed} order posts would not close`);
  if (result.closed === 0 || !orderId) return;
  const next = await ports.nextTeamSeat(orderId);
  if (!next) return;
  await ports.register({
    kind: 'order-post',
    ref: next.id,
    epoch: next.epoch,
    at: ports.now(),
  });
}

// ---------------------------------------------------------------- analytics: drain the outbox

/**
 * Marketplace facts are enqueued by database triggers, so the insert has already happened by the
 * time the request that caused it answers. The hook drains it at once instead of waiting for the
 * 60 s poll, and a drain that failed or still has rows left registers `analytics-retry` so the
 * ladder (+30 s, +2 min, +10 min) carries it.
 *
 * Facts with no app request behind them (the `auth.users` signup trigger, the nightly reconcile,
 * the hourly money jobs) have no hook at all and wait for the fixer. That reporting delay is named
 * in the doc's latency table and accepted by the owner (oai-review F3).
 */
export async function drainAnalyticsAfter(ports: HookPorts): Promise<void> {
  const mode = await ports.mode('analytics');
  if (mode === 'legacy') return;
  if (mode === 'shadow') return shadow(ports, 'analytics', 'outbox', 'drain');
  let failed = false;
  let result: DrainResult | null = null;
  try {
    result = await ports.drainAnalytics();
  } catch {
    // An unreadable drain leaves the outbox state unknown, so walk the ladder rather than assume.
    failed = true;
  }
  // Switched off: no drain, no retry timer, and nothing for the fixer to find either.
  if (!failed && result === null) return;
  if (result && result.failed > 0) failed = true;
  const left = failed ? 1 : await ports.eligibleAnalytics();
  if (left === 0) return;
  const now = ports.now();
  const epoch = retryEpoch(now);
  const at = nextRetryStep(ANALYTICS_RETRY_DELAYS_MS, epoch, now);
  if (at === null) return;
  await ports.register({ kind: 'analytics-retry', ref: 'outbox', epoch, at });
}

// ---------------------------------------------------------------- payments: settle again

/**
 * Accept captures and cancel releases right away (`settleSoon`), and the timer covers the attempt
 * that did not stick. The ladder is measured from `order_payments.updated_at`, the commit that
 * recorded the failed attempt, so the handler needs no counter of its own and a second hook for the
 * same attempt is the same key.
 *
 * A row the claim path has given up on (`attempts >= 20`) gets no timer: those are a monitoring
 * query, not a silent retry (oai-review F6). The durable producer stays
 * `duoly_dispatch_has_work('payments')`, which sees transitions no request ever reported.
 */
export async function settleRetryAfter(
  ports: HookPorts,
  orderId: string,
): Promise<void> {
  const mode = await ports.mode('payments');
  if (mode === 'legacy') return;
  const state = await ports.settleState(orderId);
  if (!state || state.settle === 'none') return;
  if (state.attempts >= SETTLE_ATTEMPT_CAP) return;
  const now = ports.now();
  const at = nextRetryStep(SETTLE_RETRY_DELAYS_MS, state.updatedAt, now);
  if (at === null) return;
  await ports.register({
    kind: 'settle-retry',
    ref: orderId,
    epoch: state.updatedAt,
    at,
  });
}

// ---------------------------------------------------------------- payments: give the hold back

/**
 * A checkout that reserved wallet money and then died leaves the balance held. Both named failure
 * paths release it themselves; this hook covers the unexpected throw, which today only
 * `checkout_stale_wallet_holds` finds, 10 minutes after the session's own lifetime ran out.
 *
 * `src/server/payments/checkout.ts` is not touched: it is a protected file and its release paths
 * are already there (`:621-648`, oai-review F7). The hook is wired into the play again flow, which
 * reserves the same holds through the same function and is not protected. `checkout_release_wallet`
 * is idempotent (it only reverses holds that are still open) and refuses a paid intent, so running
 * it after a request that did succeed is a no-op rather than a refund.
 */
export async function releaseWalletHoldAfter(
  ports: HookPorts,
  intentId: string,
): Promise<void> {
  const mode = await ports.mode('payments');
  if (mode === 'legacy') return;
  if (mode === 'shadow') return shadow(ports, 'payments', intentId, 'release');
  if (!(await ports.releaseWalletHold(intentId)))
    ports.log(`[background] the wallet hold of ${intentId} would not release`);
}

// ---------------------------------------------------------------- roles: watch presence

/**
 * Role syncs already run right after every event that changes wanted roles (`syncRolesAfter`). The
 * gap is a browser that dies, because nothing tells us the teammate went offline.
 *
 * The desk's last tab sends a beacon on `pagehide` and going online is an event too; both register
 * the one `presence-check:desk:0` singleton, one freshness window out. The timer reads presence and
 * syncs roles, and re-arms itself while anyone is online. It never writes presence: `pagehide` also
 * fires on an ordinary navigation and on closing one of several tabs, so a persistent offline write
 * would be a visible regression (oai-review F5). The 20 s heartbeat staleness rule stays the only
 * thing that decides who is online.
 */
export const PRESENCE_CHECK_REF = 'desk';

export async function presenceCheckAfter(ports: HookPorts): Promise<void> {
  const mode = await ports.mode('roles');
  if (mode === 'legacy') return;
  await ports.register({
    kind: 'presence-check',
    ref: PRESENCE_CHECK_REF,
    // A recurring singleton: one key for the whole desk, whoever asked for it.
    epoch: 0,
    at: ports.now() + PRESENCE_CHECK_INTERVAL_MS,
  });
}

// ---------------------------------------------------------------- wiring

/** The ports built from the service-role client, or null when the app has no database. */
export function hooksFor(
  db: SupabaseClient | null,
  site: string,
): HookPorts | null {
  return db ? hookPorts(db, site) : null;
}

export interface BackgroundEvent {
  /** The order that moved on: close its post, then progress its team. */
  order?: string | null;
  /** Register `settle-retry` for this order while its money action is still pending. */
  settle?: string | null;
  /** Drain the outbox, because a database trigger just enqueued a fact. */
  analytics?: boolean;
  /** Give this checkout intent's wallet hold back. */
  walletHold?: string | null;
  /** Look at desk presence one freshness window from now. */
  presence?: boolean;
}

/**
 * One event, every hook it implies, after the response. They run together on purpose: one switch
 * in `legacy`, or one hook that fails, never hides another.
 */
export async function backgroundEventAfter(
  ports: HookPorts | null,
  event: BackgroundEvent,
): Promise<void> {
  if (!ports) return;
  const work: Promise<unknown>[] = [];
  if (event.order) work.push(closeOrderPostsAfter(ports, event.order));
  if (event.settle) work.push(settleRetryAfter(ports, event.settle));
  if (event.analytics) work.push(drainAnalyticsAfter(ports));
  if (event.walletHold)
    work.push(releaseWalletHoldAfter(ports, event.walletHold));
  if (event.presence) work.push(presenceCheckAfter(ports));
  for (const result of await Promise.allSettled(work))
    if (result.status === 'rejected')
      ports.log(
        `[background] a hook failed: ${result.reason instanceof Error ? result.reason.message.slice(0, 200) : 'unknown error'}`,
      );
}

/** Build the ports from the service-role client and run the event, after the response. */
export async function backgroundEvent(
  event: BackgroundEvent,
  site: string,
  deps: { ports?: HookPorts | null } = {},
): Promise<void> {
  await afterResponse(() =>
    backgroundEventAfter(
      deps.ports === undefined ? hooksFor(supportService(), site) : deps.ports,
      event,
    ),
  );
}

const originOf = (request: Request): string => {
  try {
    return new URL(request.url).origin;
  } catch {
    return 'https://duoly.gg';
  }
};

/**
 * Runs the hooks after a route answered 200, the way `withRoleSync` does for Discord roles. The
 * scope function may not fail the request: anything it gets wrong means no hook, never a worse
 * answer for the customer or the teammate.
 */
export function withBackground(
  handler: APIRoute,
  scope: (context: Parameters<APIRoute>[0]) => BackgroundEvent | null,
  deps: { ports?: HookPorts | null } = {},
): APIRoute {
  return async (context) => {
    const response = await handler(context);
    if (response.status !== 200) return response;
    const event = (() => {
      try {
        return scope(context);
      } catch {
        return null;
      }
    })();
    if (event) await backgroundEvent(event, originOf(context.request), deps);
    return response;
  };
}
