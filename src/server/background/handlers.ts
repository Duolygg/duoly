/**
 * The five timer handlers behind POST /api/internal/timer (docs/product/background-work.md).
 *
 * Every handler has the same two phases:
 *   1. plan: read the current state and decide, with the pure functions in ./plan.
 *   2. act:  run the existing server code for that work, then decide again from what it returned.
 * Shadow mode stops after phase 1 and writes one log line, which is what makes "shadow never
 * claims a ledger row, never posts to Discord and never calls Stripe" structural (oai-review F12).
 *
 * No handler contains business logic of its own. Posting is `runOrderPosts`, expiry is
 * `sweep_expired_orders`, settlement is `settlePending`, analytics is `drainOnce` and roles are
 * `syncDiscordRoles`, each exactly as the 10 s dispatcher calls it today. The only thing the timer
 * changes is when that code runs.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  ANALYTICS_RETRY_DELAYS_MS,
  ORDER_POST_DELAY_MS,
  SETTLE_RETRY_DELAYS_MS,
  type SwitchMode,
  type TimerDisposition,
  type TimerFire,
} from '../../contracts/background';
import {
  orderPostsConfig,
  runOrderPosts,
  supabaseOrderPostStore,
  type OrderPostsResult,
} from '../discord/order-post-tick';
import { roleSyncConfig, syncDiscordRoles } from '../discord/role-sync';
import { drainConfig, drainOnce, type DrainResult } from '../analytics/drain';
import { adminFor, paymentsConfig, stripeFor } from '../payments/config';
import { settlePending } from '../payments/settle';
import { closeOrderPostsAfter, hookPorts } from './hooks';
import {
  analyticsRetryAfter,
  analyticsRetryPlan,
  orderExpireAfterSweep,
  orderExpirePlan,
  orderPostPending,
  orderPostPlan,
  orderPostRetry,
  plannedDisposition,
  presenceCheckAfter,
  presenceCheckPlan,
  settleRetryAfter,
  settleRetryPlan,
  shadowLine,
  SHORT_RETRY_MS,
  wouldLabel,
  type OrderState,
  type PaymentState,
  type TimerPlan,
} from './plan';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Dispositions carry a note of at most 200 characters (src/contracts/background.ts). */
const note = (text: string) => ({ note: text.slice(0, 200) });

/**
 * Everything a handler is allowed to touch. The default implementation below is the only place
 * that knows about the database and the existing modules, so every handler path is unit testable
 * without Stripe, Discord, PostHog or a database.
 *
 * A read that fails throws: the endpoint then answers 503 and the worker retries on its own
 * schedule. Only a real absence is reported as `null`, because that is what makes a timer stale.
 */
export interface TimerPorts {
  now(): number;
  log(line: string): void;
  order(ref: string): Promise<OrderState | null>;
  streamingBooking(ref: string): Promise<boolean>;
  /** Does public.discord_order_posts_due list this order right now? */
  orderDue(ref: string): Promise<boolean>;
  /** Null when order posting is switched off; otherwise the result for this one order. */
  postOrder(ref: string): Promise<OrderPostsResult | null>;
  sweepExpired(): Promise<boolean>;
  /**
   * Edits the posts the expiry just turned into dead links. Behind the `orders` switch of its own,
   * because `order-expire` is gated by `payments`: with `orders` still legacy the 10 s dispatcher
   * keeps closing posts and this does nothing.
   */
  closePosts(ref: string): Promise<void>;
  payment(ref: string): Promise<PaymentState | null>;
  /** Null when payments are not configured. */
  settleNow(): Promise<boolean | null>;
  eligibleAnalytics(): Promise<number>;
  drainAnalytics(): Promise<DrainResult | 'off' | 'error'>;
  onlineTeammates(): Promise<number>;
  /** Null when the role sync is not configured. */
  syncRoles(): Promise<boolean | null>;
}

const failed = (what: string, error: unknown): never => {
  throw new Error(
    `${what}: ${error instanceof Error ? error.message : 'unknown error'}`,
  );
};

/** The real ports: the service-role client plus the handlers the 10 s dispatcher already calls. */
export function timerPorts(db: SupabaseClient, site: string): TimerPorts {
  return {
    now: () => Date.now(),
    log: (line) => console.warn(line),

    order: async (ref) => {
      const { data, error } = await db
        .from('orders')
        .select('status, queued_at')
        .eq('id', ref)
        .maybeSingle();
      if (error) failed('read order', error);
      return (data as OrderState | null) ?? null;
    },

    streamingBooking: async (ref) => {
      const { data, error } = await db
        .from('order_streamer_bookings')
        .select('order_id')
        .eq('order_id', ref)
        .limit(1);
      if (error) failed('read streaming booking', error);
      return Array.isArray(data) && data.length > 0;
    },

    orderDue: async (ref) => {
      const { data, error } = await db.rpc('discord_order_posts_due', {
        p_after_seconds: Math.round(ORDER_POST_DELAY_MS / 1000),
      });
      if (error) failed('read due orders', error);
      return (
        Array.isArray(data) &&
        data.some((row) => (row as { id?: unknown }).id === ref)
      );
    },

    postOrder: async (ref) => {
      const config = orderPostsConfig();
      if (!config) return null;
      const store = supabaseOrderPostStore(config);
      // One order, and no closing: closing open posts is event driven (accept, cancel, expire)
      // and the fixer's reconcile runs the unfiltered tick, so a timer stays bounded work.
      return runOrderPosts(config, site, {
        store: {
          ...store,
          due: async (after) =>
            (await store.due(after)).filter((order) => order.id === ref),
          toClose: async () => [],
        },
      });
    },

    sweepExpired: async () => {
      const { error } = await db.rpc('sweep_expired_orders', { p_limit: 100 });
      return !error;
    },

    closePosts: (ref) => closeOrderPostsAfter(hookPorts(db, site), ref),

    payment: async (ref) => {
      const { data, error } = await db
        .from('order_payments')
        .select('settle, attempts')
        .eq('order_id', ref)
        .maybeSingle();
      if (error) failed('read payment', error);
      return (data as PaymentState | null) ?? null;
    },

    settleNow: async () => {
      const config = paymentsConfig();
      if (!config) return null;
      await settlePending(stripeFor(config), adminFor(config), 10);
      return true;
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

    drainAnalytics: async () => {
      const config = drainConfig();
      if (!config) return 'off';
      try {
        return await drainOnce(db, config);
      } catch {
        return 'error';
      }
    },

    onlineTeammates: async () => {
      const { count, error } = await db
        .from('teammate_presence')
        .select('user_id', { count: 'exact', head: true })
        .eq('online', true);
      // Nobody online ends the timer; the next online event registers it again. An unreadable
      // read is treated the same way on purpose, so a broken query cannot re-arm forever.
      if (error) return 0;
      return count ?? 0;
    },

    syncRoles: async () => {
      if (!roleSyncConfig()) return null;
      try {
        await syncDiscordRoles(null);
        return true;
      } catch {
        return false;
      }
    },
  };
}

// ---------------------------------------------------------------- per kind

interface Prepared {
  plan: TimerPlan;
  /** What shadow mode reports it would have done. */
  act: string;
  run?: () => Promise<TimerDisposition>;
}

async function prepareOrderPost(
  fire: TimerFire,
  ports: TimerPorts,
): Promise<Prepared> {
  if (!UUID.test(fire.ref))
    return { plan: { action: 'stale', note: 'not an order id' }, act: 'post' };
  const order = await ports.order(fire.ref);
  const queued = order?.status === 'queued';
  const { plan, bounds } = orderPostPlan({
    epoch: fire.epoch,
    order,
    streaming: queued ? await ports.streamingBooking(fire.ref) : false,
    due: queued ? await ports.orderDue(fire.ref) : false,
    now: ports.now(),
  });
  if (plan.action !== 'act' || !bounds) return { plan, act: 'post' };
  return {
    plan,
    act: 'post',
    run: async () => {
      const result = await ports.postOrder(fire.ref);
      if (!result)
        return { status: 'done', ...note('order posts are switched off') };
      if (result.posted > 0) return { status: 'done', ...note('posted') };
      if (result.failed > 0)
        return plannedDisposition(orderPostRetry(bounds, ports.now()));
      return plannedDisposition(
        orderPostPending(bounds, ports.now(), 'the claim went elsewhere'),
      );
    },
  };
}

async function prepareOrderExpire(
  fire: TimerFire,
  ports: TimerPorts,
): Promise<Prepared> {
  if (!UUID.test(fire.ref))
    return {
      plan: { action: 'stale', note: 'not an order id' },
      act: 'expire',
    };
  const { plan } = orderExpirePlan({
    epoch: fire.epoch,
    order: await ports.order(fire.ref),
    now: ports.now(),
  });
  if (plan.action !== 'act') return { plan, act: 'expire' };
  return {
    plan,
    act: 'expire',
    run: async () => {
      if (!(await ports.sweepExpired()))
        return {
          status: 'retry',
          at: ports.now() + SHORT_RETRY_MS,
          ...note('the sweep failed'),
        };
      // The order is gone from the queue, so its public post is a dead link. Closing it is event
      // driven, like accept and cancel; the fixer's unfiltered tick is the backstop.
      await ports.closePosts(fire.ref);
      return plannedDisposition(
        orderExpireAfterSweep(
          await ports.order(fire.ref),
          fire.epoch,
          ports.now(),
        ),
      );
    },
  };
}

async function prepareSettleRetry(
  fire: TimerFire,
  ports: TimerPorts,
): Promise<Prepared> {
  if (!UUID.test(fire.ref))
    return {
      plan: { action: 'stale', note: 'not an order id' },
      act: 'settle',
    };
  const plan = settleRetryPlan(await ports.payment(fire.ref));
  if (plan.action !== 'act') return { plan, act: 'settle' };
  return {
    plan,
    act: 'settle',
    run: async () => {
      if ((await ports.settleNow()) === null)
        return { status: 'done', ...note('payments are not configured') };
      return plannedDisposition(
        settleRetryAfter(
          await ports.payment(fire.ref),
          SETTLE_RETRY_DELAYS_MS,
          fire.epoch,
          ports.now(),
        ),
      );
    },
  };
}

async function prepareAnalyticsRetry(
  fire: TimerFire,
  ports: TimerPorts,
): Promise<Prepared> {
  const plan = analyticsRetryPlan(await ports.eligibleAnalytics());
  if (plan.action !== 'act') return { plan, act: 'drain' };
  return {
    plan,
    act: 'drain',
    run: async () => {
      const result = await ports.drainAnalytics();
      if (result === 'off')
        return { status: 'done', ...note('analytics are switched off') };
      return plannedDisposition(
        analyticsRetryAfter({
          // An unreadable drain leaves the outbox state unknown, so walk the ladder.
          eligible: result === 'error' ? 1 : await ports.eligibleAnalytics(),
          failed: result === 'error' || result.failed > 0,
          delays: ANALYTICS_RETRY_DELAYS_MS,
          epoch: fire.epoch,
          now: ports.now(),
        }),
      );
    },
  };
}

async function preparePresenceCheck(
  _fire: TimerFire,
  ports: TimerPorts,
): Promise<Prepared> {
  const plan = presenceCheckPlan(await ports.onlineTeammates());
  if (plan.action !== 'act') return { plan, act: 'sync' };
  return {
    plan,
    act: 'sync',
    run: async () => {
      if ((await ports.syncRoles()) === null)
        return { status: 'done', ...note('the role sync is not configured') };
      return plannedDisposition(presenceCheckAfter(ports.now()));
    },
  };
}

const PREPARE: Record<
  TimerFire['kind'],
  (fire: TimerFire, ports: TimerPorts) => Promise<Prepared>
> = {
  'order-post': prepareOrderPost,
  'order-expire': prepareOrderExpire,
  'settle-retry': prepareSettleRetry,
  'analytics-retry': prepareAnalyticsRetry,
  'presence-check': preparePresenceCheck,
};

/**
 * One fire, one disposition. `legacy` answers before reading anything at all; `shadow` plans,
 * logs and answers `disabled`; `live` plans and then acts. A thrown read is the caller's problem:
 * the endpoint turns it into a 503 so the worker keeps the timer and retries.
 */
export async function handleTimerFire(
  fire: TimerFire,
  ports: TimerPorts,
  mode: SwitchMode,
): Promise<TimerDisposition> {
  if (mode === 'legacy') return { status: 'disabled', mode: 'legacy' };
  const prepared = await PREPARE[fire.kind](fire, ports);
  const would = wouldLabel(prepared.plan, prepared.act);
  if (mode === 'shadow') {
    ports.log(shadowLine(fire.kind, fire.ref, would, prepared.plan.note));
    return { status: 'disabled', mode: 'shadow', ...note(`would=${would}`) };
  }
  if (!prepared.run) return plannedDisposition(prepared.plan);
  return prepared.run();
}
