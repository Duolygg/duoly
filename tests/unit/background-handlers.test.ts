import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  ANALYTICS_RETRY_DELAYS_MS,
  ORDER_EXPIRE_DELAY_MS,
  ORDER_POST_DELAY_MS,
  PRESENCE_CHECK_INTERVAL_MS,
  SETTLE_RETRY_DELAYS_MS,
  TimerDispositionSchema,
  TimerFireSchema,
  timerKey,
  type TimerFire,
  type TimerKind,
} from '../../src/contracts/background';
import {
  handleTimerFire,
  timerPorts,
  type TimerPorts,
} from '../../src/server/background/handlers';
import { PRESENCE_STALE_MS } from '../../src/server/discord/role-sync';
import {
  DRAIN_CONTINUE_MS,
  PENDING_RECHECK_MS,
  SETTLE_ATTEMPT_CAP,
  SHORT_RETRY_MS,
  nextRetryStep,
  orderPostPending,
  plannedDisposition,
  sameInstant,
  shadowLine,
  wouldLabel,
} from '../../src/server/background/plan';
import type { DrainResult } from '../../src/server/analytics/drain';

const NOW = Date.parse('2026-11-12T12:00:00.000Z');
const ORDER = 'b1a77e3c-0f2a-4a6e-9c21-9e4f0a1d3b55';
/** Queued exactly 100 s ago, so an `order-post` timer is due this instant. */
const QUEUED = NOW - ORDER_POST_DELAY_MS;
const EXPIRES = QUEUED + ORDER_EXPIRE_DELAY_MS;

const iso = (at: number) => new Date(at).toISOString();

function fire(over: Partial<TimerFire> = {}): TimerFire {
  const base = {
    kind: 'order-post' as TimerKind,
    ref: ORDER,
    epoch: QUEUED,
    at: QUEUED + ORDER_POST_DELAY_MS,
    attempt: 1,
    firedAt: NOW,
    ...over,
  };
  return TimerFireSchema.parse({ ...base, key: timerKey(base) });
}

const drained: DrainResult = {
  claimed: 0,
  sent: 0,
  dropped: 0,
  failed: 0,
  status: 200,
  rateLimited: false,
};

let logs: string[];

/** Every port answers "nothing to do" unless a test says otherwise. */
function ports(over: Partial<TimerPorts> = {}): TimerPorts {
  return {
    now: () => NOW,
    log: (line) => logs.push(line),
    order: async () => null,
    streamingBooking: async () => false,
    orderDue: async () => false,
    postOrder: async () => ({ posted: 0, closed: 0, skipped: 0, failed: 0 }),
    sweepExpired: async () => true,
    closePosts: async () => undefined,
    payment: async () => null,
    settleNow: async () => true,
    eligibleAnalytics: async () => 0,
    drainAnalytics: async () => drained,
    onlineTeammates: async () => 0,
    syncRoles: async () => true,
    ...over,
  };
}

const queued = (over: Partial<{ status: string; queued_at: string }> = {}) => ({
  status: 'queued',
  queued_at: iso(QUEUED),
  ...over,
});

beforeEach(() => {
  logs = [];
});

describe('plan helpers', () => {
  it('treats a millisecond of epoch drift as the same queue epoch', () => {
    expect(sameInstant(QUEUED, QUEUED)).toBe(true);
    expect(sameInstant(QUEUED, QUEUED - 1)).toBe(true);
    expect(sameInstant(QUEUED, QUEUED + 2)).toBe(false);
  });

  it('walks a retry ladder from the state that failed and then gives up', () => {
    const [first, second, third] = SETTLE_RETRY_DELAYS_MS;
    expect(nextRetryStep(SETTLE_RETRY_DELAYS_MS, NOW, NOW)).toBe(NOW + first);
    expect(nextRetryStep(SETTLE_RETRY_DELAYS_MS, NOW, NOW + first)).toBe(
      NOW + second,
    );
    expect(nextRetryStep(SETTLE_RETRY_DELAYS_MS, NOW, NOW + second)).toBe(
      NOW + third,
    );
    expect(nextRetryStep(SETTLE_RETRY_DELAYS_MS, NOW, NOW + third)).toBeNull();
  });

  it('never recommends a recheck after the order has expired', () => {
    const bounds = { queuedAt: QUEUED, expiresAt: EXPIRES };
    expect(orderPostPending(bounds, NOW, 'x').at).toBe(
      NOW + PENDING_RECHECK_MS,
    );
    expect(orderPostPending(bounds, EXPIRES - 1_000, 'x').at).toBe(EXPIRES);
  });

  it('writes one shadow line per fire and labels what it would have done', () => {
    expect(shadowLine('order-post', ORDER, 'post', 'ready')).toBe(
      `[timer-shadow] order-post ${ORDER} would=post (ready)`,
    );
    expect(wouldLabel({ action: 'act' }, 'post')).toBe('post');
    expect(wouldLabel({ action: 'stale' }, 'post')).toBe('stale');
    expect(wouldLabel({ action: 'pending', at: 7 }, 'post')).toBe('pending@7');
  });

  it('maps every plan to a disposition the worker understands', () => {
    for (const result of [
      { action: 'done' as const },
      { action: 'stale' as const, note: 'gone' },
      { action: 'retry' as const, at: NOW + 1_000 },
      { action: 'pending' as const, at: NOW + 1_000, note: 'waiting' },
    ])
      expect(
        TimerDispositionSchema.safeParse(plannedDisposition(result)).success,
      ).toBe(true);
  });
});

describe('the switch decides who acts', () => {
  it('reads nothing at all in legacy', async () => {
    const order = vi.fn(async () => queued());
    expect(
      await handleTimerFire(fire(), ports({ order }), 'legacy'),
    ).toStrictEqual({ status: 'disabled', mode: 'legacy' });
    expect(order).not.toHaveBeenCalled();
  });

  it('plans and logs but never acts in shadow', async () => {
    const postOrder = vi.fn(async () => ({
      posted: 1,
      closed: 0,
      skipped: 0,
      failed: 0,
    }));
    const answer = await handleTimerFire(
      fire(),
      ports({
        order: async () => queued(),
        orderDue: async () => true,
        postOrder,
      }),
      'shadow',
    );
    expect(answer).toStrictEqual({
      status: 'disabled',
      mode: 'shadow',
      note: 'would=post',
    });
    expect(logs).toEqual([`[timer-shadow] order-post ${ORDER} would=post`]);
    expect(postOrder).not.toHaveBeenCalled();
  });

  it('reports a stale plan in shadow too, with its reason', async () => {
    const answer = await handleTimerFire(fire(), ports(), 'shadow');
    expect(answer).toMatchObject({ status: 'disabled', note: 'would=stale' });
    expect(logs).toEqual([
      `[timer-shadow] order-post ${ORDER} would=stale (order gone)`,
    ]);
  });

  it('never claims, settles, drains or syncs in shadow, whatever the kind', async () => {
    const touched: string[] = [];
    const spies = (now: number) =>
      ports({
        now: () => now,
        order: async () => queued(),
        orderDue: async () => true,
        payment: async () => ({ settle: 'capture', attempts: 0 }),
        eligibleAnalytics: async () => 3,
        onlineTeammates: async () => 1,
        postOrder: async () => {
          touched.push('post');
          return { posted: 1, closed: 0, skipped: 0, failed: 0 };
        },
        sweepExpired: async () => {
          touched.push('sweep');
          return true;
        },
        settleNow: async () => {
          touched.push('settle');
          return true;
        },
        drainAnalytics: async () => {
          touched.push('drain');
          return drained;
        },
        syncRoles: async () => {
          touched.push('sync');
          return true;
        },
      });
    const kinds: [TimerKind, string, number][] = [
      ['order-post', 'post', NOW],
      ['order-expire', 'expire', EXPIRES],
      ['settle-retry', 'settle', NOW],
      ['analytics-retry', 'drain', NOW],
      ['presence-check', 'sync', NOW],
    ];
    for (const [kind, would, now] of kinds) {
      const sent = fire(
        kind === 'presence-check'
          ? { kind, ref: 'desk', epoch: 0, at: NOW }
          : kind === 'order-expire'
            ? { kind, at: EXPIRES }
            : { kind },
      );
      const answer = await handleTimerFire(sent, spies(now), 'shadow');
      expect(answer).toMatchObject({ status: 'disabled', mode: 'shadow' });
      expect(logs.at(-1)).toContain(`would=${would}`);
    }
    expect(touched).toEqual([]);
  });
});

describe('order-post', () => {
  const live = (over: Partial<TimerPorts> = {}) =>
    handleTimerFire(fire(), ports(over), 'live');

  it('is stale when the order is gone', async () => {
    expect(await live()).toStrictEqual({ status: 'stale', note: 'order gone' });
  });

  it('is stale when the order left the queue', async () => {
    expect(
      await live({ order: async () => queued({ status: 'in_progress' }) }),
    ).toStrictEqual({ status: 'stale', note: 'order is in_progress' });
  });

  it('is stale when the order was queued again since', async () => {
    const answer = await live({
      order: async () => queued({ queued_at: iso(QUEUED + 5_000) }),
    });
    expect(answer).toStrictEqual({
      status: 'stale',
      note: 'queued again since',
    });
  });

  it('accepts the millisecond of drift between the two epoch encodings', async () => {
    const answer = await live({
      order: async () => queued({ queued_at: iso(QUEUED + 1) }),
      orderDue: async () => true,
      postOrder: async () => ({ posted: 1, closed: 0, skipped: 0, failed: 0 }),
    });
    expect(answer).toStrictEqual({ status: 'done', note: 'posted' });
  });

  it('is stale for a streaming booking, which has no public post', async () => {
    const answer = await live({
      order: async () => queued(),
      streamingBooking: async () => true,
    });
    expect(answer).toStrictEqual({
      status: 'stale',
      note: 'streaming booking, no public post',
    });
  });

  it('is stale once the 20 s guard before expiry has passed', async () => {
    const late = fire({ at: QUEUED + ORDER_POST_DELAY_MS });
    const answer = await handleTimerFire(
      late,
      ports({
        now: () => EXPIRES - 10_000,
        order: async () => queued(),
        orderDue: async () => true,
      }),
      'live',
    );
    expect(answer).toStrictEqual({
      status: 'stale',
      note: 'too late to post',
    });
  });

  it('waits when the SQL predicate does not list the order yet', async () => {
    const answer = await live({ order: async () => queued() });
    expect(answer).toStrictEqual({
      status: 'pending',
      at: NOW + PENDING_RECHECK_MS,
      note: 'not eligible yet',
    });
  });

  it('never waits past the expiry, which ends the timer by itself', async () => {
    const answer = await handleTimerFire(
      fire(),
      ports({ now: () => EXPIRES - 30_000, order: async () => queued() }),
      'live',
    );
    expect(answer).toMatchObject({ status: 'pending', at: EXPIRES });
  });

  it('posts through the existing runner and is done', async () => {
    const postOrder = vi.fn(async () => ({
      posted: 1,
      closed: 0,
      skipped: 0,
      failed: 0,
    }));
    const answer = await live({
      order: async () => queued(),
      orderDue: async () => true,
      postOrder,
    });
    expect(answer).toStrictEqual({ status: 'done', note: 'posted' });
    expect(postOrder).toHaveBeenCalledWith(ORDER);
  });

  it('retries soon when Discord refused the post', async () => {
    const answer = await live({
      order: async () => queued(),
      orderDue: async () => true,
      postOrder: async () => ({ posted: 0, closed: 0, skipped: 0, failed: 1 }),
    });
    expect(answer).toStrictEqual({
      status: 'retry',
      at: NOW + SHORT_RETRY_MS,
      note: 'Discord refused the post',
    });
  });

  it('waits when the claim went to the tick or another worker', async () => {
    const answer = await live({
      order: async () => queued(),
      orderDue: async () => true,
      postOrder: async () => ({ posted: 0, closed: 0, skipped: 1, failed: 0 }),
    });
    expect(answer).toStrictEqual({
      status: 'pending',
      at: NOW + PENDING_RECHECK_MS,
      note: 'the claim went elsewhere',
    });
  });

  it('is done, not retried, while order posting is switched off', async () => {
    const answer = await live({
      order: async () => queued(),
      orderDue: async () => true,
      postOrder: async () => null,
    });
    expect(answer).toStrictEqual({
      status: 'done',
      note: 'order posts are switched off',
    });
  });

  it('is stale when the ref is not an order id', async () => {
    const order = vi.fn(async () => queued());
    const answer = await handleTimerFire(
      fire({ ref: 'not-a-uuid' }),
      ports({ order }),
      'live',
    );
    expect(answer).toStrictEqual({
      status: 'stale',
      note: 'not an order id',
    });
    expect(order).not.toHaveBeenCalled();
  });
});

describe('order-expire', () => {
  const expiry = (over: Partial<TimerPorts> = {}, now = EXPIRES) =>
    handleTimerFire(
      fire({ kind: 'order-expire', at: EXPIRES }),
      ports({ now: () => now, ...over }),
      'live',
    );

  it('is stale when the order already left the queue', async () => {
    expect(
      await expiry({ order: async () => queued({ status: 'completed' }) }),
    ).toStrictEqual({ status: 'stale', note: 'order is completed' });
  });

  it('re-arms itself when it fired before the deadline', async () => {
    const answer = await expiry(
      { order: async () => queued() },
      EXPIRES - 20_000,
    );
    expect(answer).toStrictEqual({
      status: 'retry',
      at: EXPIRES,
      note: 'fired before the deadline',
    });
  });

  it('runs the existing sweep and is done once the order is gone', async () => {
    const sweepExpired = vi.fn(async () => true);
    let status = 'queued';
    const answer = await expiry({
      sweepExpired: async () => {
        status = 'expired';
        return sweepExpired();
      },
      order: async () => queued({ status }),
    });
    expect(answer).toStrictEqual({ status: 'done', note: 'expired' });
    expect(sweepExpired).toHaveBeenCalledOnce();
  });

  it('retries when the sweep skipped a locked row', async () => {
    const answer = await expiry({ order: async () => queued() });
    expect(answer).toStrictEqual({
      status: 'retry',
      at: EXPIRES + SHORT_RETRY_MS,
      note: 'the sweep skipped a locked row',
    });
  });

  it('retries when the sweep itself failed', async () => {
    const answer = await expiry({
      order: async () => queued(),
      sweepExpired: async () => false,
    });
    expect(answer).toStrictEqual({
      status: 'retry',
      at: EXPIRES + SHORT_RETRY_MS,
      note: 'the sweep failed',
    });
  });
});

describe('settle-retry', () => {
  const [first, second] = SETTLE_RETRY_DELAYS_MS;
  const settle = (over: Partial<TimerPorts> = {}, now = NOW + first) =>
    handleTimerFire(
      fire({ kind: 'settle-retry', epoch: NOW, at: NOW + first }),
      ports({ now: () => now, ...over }),
      'live',
    );

  it('is stale without a payment row', async () => {
    expect(await settle()).toStrictEqual({
      status: 'stale',
      note: 'no payment row',
    });
  });

  it('is stale once the money action is settled', async () => {
    const answer = await settle({
      payment: async () => ({ settle: 'none', attempts: 3 }),
    });
    expect(answer).toStrictEqual({
      status: 'stale',
      note: 'already settled',
    });
  });

  it('leaves exhausted rows to the monitoring query', async () => {
    const settleNow = vi.fn(async () => true);
    const answer = await settle({
      payment: async () => ({
        settle: 'capture',
        attempts: SETTLE_ATTEMPT_CAP,
      }),
      settleNow,
    });
    expect(answer).toStrictEqual({
      status: 'stale',
      note: 'attempts exhausted',
    });
    expect(settleNow).not.toHaveBeenCalled();
  });

  it('settles through the existing claim path and is done', async () => {
    let settled = false;
    const answer = await settle({
      settleNow: async () => {
        settled = true;
        return true;
      },
      payment: async () =>
        settled
          ? { settle: 'none', attempts: 2 }
          : { settle: 'capture', attempts: 1 },
    });
    expect(answer).toStrictEqual({ status: 'done', note: 'settled' });
  });

  it('walks to the next rung while the action is still pending', async () => {
    const answer = await settle({
      payment: async () => ({ settle: 'capture', attempts: 1 }),
    });
    expect(answer).toStrictEqual({
      status: 'retry',
      at: NOW + second,
      note: 'still pending',
    });
  });

  it('hands over to the fixer after the last rung', async () => {
    const answer = await settle(
      { payment: async () => ({ settle: 'capture', attempts: 3 }) },
      NOW + SETTLE_RETRY_DELAYS_MS[2],
    );
    expect(answer).toStrictEqual({
      status: 'done',
      note: 'left to the fixer',
    });
  });

  it('is done while payments are not configured', async () => {
    const answer = await settle({
      payment: async () => ({ settle: 'capture', attempts: 1 }),
      settleNow: async () => null,
    });
    expect(answer).toStrictEqual({
      status: 'done',
      note: 'payments are not configured',
    });
  });
});

describe('analytics-retry', () => {
  const [first, second] = ANALYTICS_RETRY_DELAYS_MS;
  const drain = (over: Partial<TimerPorts> = {}, now = NOW + first) =>
    handleTimerFire(
      fire({
        kind: 'analytics-retry',
        ref: 'outbox',
        epoch: NOW,
        at: NOW + first,
      }),
      ports({ now: () => now, ...over }),
      'live',
    );

  it('is done when the outbox has nothing eligible', async () => {
    const drainAnalytics = vi.fn(async () => drained);
    expect(await drain({ drainAnalytics })).toStrictEqual({
      status: 'done',
      note: 'outbox drained',
    });
    expect(drainAnalytics).not.toHaveBeenCalled();
  });

  it('drains and is done when nothing is left', async () => {
    let left = 5;
    const answer = await drain({
      eligibleAnalytics: async () => left,
      drainAnalytics: async () => {
        left = 0;
        return { ...drained, sent: 5, claimed: 5 };
      },
    });
    expect(answer).toStrictEqual({ status: 'done', note: 'outbox drained' });
  });

  it('continues almost at once while a healthy drain still has a backlog', async () => {
    const answer = await drain({
      eligibleAnalytics: async () => 500,
      drainAnalytics: async () => ({ ...drained, sent: 200, claimed: 200 }),
    });
    expect(answer).toStrictEqual({
      status: 'retry',
      at: NOW + first + DRAIN_CONTINUE_MS,
      note: 'more facts waiting',
    });
  });

  it('walks the ladder when the drain failed', async () => {
    const answer = await drain({
      eligibleAnalytics: async () => 7,
      drainAnalytics: async () => ({
        ...drained,
        claimed: 7,
        failed: 7,
        status: 503,
      }),
    });
    expect(answer).toStrictEqual({
      status: 'retry',
      at: NOW + second,
      note: 'the drain failed',
    });
  });

  it('walks the ladder when the drain could not even be read', async () => {
    const answer = await drain({
      eligibleAnalytics: async () => 7,
      drainAnalytics: async () => 'error',
    });
    expect(answer).toStrictEqual({
      status: 'retry',
      at: NOW + second,
      note: 'the drain failed',
    });
  });

  it('hands a stubborn backlog to the fixer after the last rung', async () => {
    const answer = await drain(
      {
        eligibleAnalytics: async () => 7,
        drainAnalytics: async () => 'error',
      },
      NOW + ANALYTICS_RETRY_DELAYS_MS[2],
    );
    expect(answer).toStrictEqual({
      status: 'done',
      note: 'left to the fixer',
    });
  });

  it('is done while analytics are switched off', async () => {
    const answer = await drain({
      eligibleAnalytics: async () => 2,
      drainAnalytics: async () => 'off',
    });
    expect(answer).toStrictEqual({
      status: 'done',
      note: 'analytics are switched off',
    });
  });
});

describe('presence-check', () => {
  const presence = (over: Partial<TimerPorts> = {}) =>
    handleTimerFire(
      fire({ kind: 'presence-check', ref: 'desk', epoch: 0, at: NOW }),
      ports(over),
      'live',
    );

  it('syncs once and ends the timer when nobody is fresh', async () => {
    const syncRoles = vi.fn(async () => true);
    expect(await presence({ syncRoles })).toStrictEqual({
      status: 'done',
      note: 'nobody online',
    });
    // The desk that just went stale still wears the Online role: one sync takes it off.
    expect(syncRoles).toHaveBeenCalledOnce();
  });

  it('syncs roles and looks again in 20 s while someone is online', async () => {
    const syncRoles = vi.fn(async () => true);
    const answer = await presence({
      onlineTeammates: async () => 2,
      syncRoles,
    });
    expect(answer).toStrictEqual({
      status: 'retry',
      at: NOW + PRESENCE_CHECK_INTERVAL_MS,
      note: 'someone is still online',
    });
    expect(syncRoles).toHaveBeenCalledOnce();
  });

  it('keeps watching even when the sync itself failed', async () => {
    const answer = await presence({
      onlineTeammates: async () => 1,
      syncRoles: async () => false,
    });
    expect(answer).toMatchObject({ status: 'retry' });
  });

  it('is done while the role sync is not configured', async () => {
    const answer = await presence({
      onlineTeammates: async () => 1,
      syncRoles: async () => null,
    });
    expect(answer).toStrictEqual({
      status: 'done',
      note: 'the role sync is not configured',
    });
  });

  it('never syncs in shadow, whatever the presence count', async () => {
    for (const fresh of [0, 2]) {
      const syncRoles = vi.fn(async () => true);
      const answer = await handleTimerFire(
        fire({ kind: 'presence-check', ref: 'desk', epoch: 0, at: NOW }),
        ports({ onlineTeammates: async () => fresh, syncRoles }),
        'shadow',
      );
      expect(answer).toMatchObject({ status: 'disabled', mode: 'shadow' });
      expect(logs.at(-1)).toContain('would=sync');
      expect(syncRoles).not.toHaveBeenCalled();
    }
  });
});

describe('the presence port counts fresh presence only', () => {
  const row = (user_id: string, online: boolean, seenMsAgo: number | null) => ({
    user_id,
    online,
    last_seen_at: seenMsAgo === null ? null : iso(Date.now() - seenMsAgo),
  });

  /**
   * Only what `onlineTeammates` reads: a `count` over public.teammate_presence that applies the
   * filters it asks for. `fails` answers the way an unreadable table does.
   */
  function presenceDb(
    rows: ReturnType<typeof row>[],
    fails = false,
  ): { db: SupabaseClient; asked: string[] } {
    const asked: string[] = [];
    const answer = (left: ReturnType<typeof row>[]) => ({
      eq(column: 'online', value: boolean) {
        asked.push(`${column}=${value}`);
        return answer(left.filter((it) => it[column] === value));
      },
      gt(column: 'last_seen_at', value: string) {
        asked.push(column);
        return answer(left.filter((it) => (it[column] ?? '') > value));
      },
      then: (resolve: (result: unknown) => void) =>
        resolve(
          fails
            ? { count: null, error: { message: 'presence is unreadable' } }
            : { count: left.length, error: null },
        ),
    });
    const db = {
      from: (table: string) => ({
        select: () => {
          asked.push(table);
          return answer(rows);
        },
      }),
    } as unknown as SupabaseClient;
    return { db, asked };
  }

  const count = (db: SupabaseClient) =>
    timerPorts(db, 'https://duoly.gg').onlineTeammates();

  it('ignores a dead browser that left online = true behind', async () => {
    const { db, asked } = presenceDb([
      row('beating', true, 5_000),
      row('dead-browser', true, 3 * 60 * 60_000),
      row('never-seen', true, null),
      row('offline', false, 1_000),
    ]);
    expect(await count(db)).toBe(1);
    expect(asked).toStrictEqual([
      'teammate_presence',
      'online=true',
      'last_seen_at',
    ]);
  });

  it('uses the same 20 s window as the role sync', async () => {
    const inside = presenceDb([row('a', true, PRESENCE_STALE_MS - 5_000)]);
    const outside = presenceDb([row('b', true, PRESENCE_STALE_MS + 5_000)]);
    expect(await count(inside.db)).toBe(1);
    expect(await count(outside.db)).toBe(0);
  });

  it('reads an unreadable table as nobody online', async () => {
    const { db } = presenceDb([row('beating', true, 1_000)], true);
    expect(await count(db)).toBe(0);
  });
});

describe('every answer is a disposition the worker can apply', () => {
  it('parses for all five kinds, in all three modes', async () => {
    const all = ports({
      order: async () => queued(),
      orderDue: async () => true,
      payment: async () => ({ settle: 'capture', attempts: 1 }),
      eligibleAnalytics: async () => 1,
      onlineTeammates: async () => 1,
      postOrder: async () => ({ posted: 1, closed: 0, skipped: 0, failed: 0 }),
    });
    const kinds: TimerKind[] = [
      'order-post',
      'order-expire',
      'settle-retry',
      'analytics-retry',
      'presence-check',
    ];
    for (const kind of kinds)
      for (const mode of ['legacy', 'shadow', 'live'] as const) {
        const sent = fire(
          kind === 'presence-check'
            ? { kind, ref: 'desk', epoch: 0, at: NOW }
            : { kind },
        );
        const answer = await handleTimerFire(sent, all, mode);
        expect(
          TimerDispositionSchema.safeParse(answer),
          `${kind} in ${mode}`,
        ).toMatchObject({ success: true });
      }
  });
});
