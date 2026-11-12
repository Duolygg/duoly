import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ANALYTICS_RETRY_DELAYS_MS,
  PRESENCE_CHECK_INTERVAL_MS,
  SETTLE_RETRY_DELAYS_MS,
  TimerRequestSchema,
  timerKey,
  type SwitchKind,
  type SwitchMode,
} from '../../src/contracts/background';
import { afterResponse } from '../../src/server/background/after';
import {
  backgroundEventAfter,
  closeOrderPostsAfter,
  drainAnalyticsAfter,
  presenceCheckAfter,
  releaseWalletHoldAfter,
  retryEpoch,
  settleRetryAfter,
  withBackground,
  type HookPorts,
} from '../../src/server/background/hooks';
import { SETTLE_ATTEMPT_CAP } from '../../src/server/background/plan';
import type { TimerRegistration } from '../../src/server/background/register';
import type { DrainResult } from '../../src/server/analytics/drain';
import type { OrderPostsResult } from '../../src/server/discord/order-post-tick';

const NOW = Date.parse('2026-11-12T12:00:14.000Z');
const ORDER = 'b1a77e3c-0f2a-4a6e-9c21-9e4f0a1d3b55';
const SEAT = 'c2b88f4d-1e3b-4b7f-8d32-af5e1b2c4d66';
const INTENT = 'd3c99a5e-2f4c-4c80-9e43-b06f2c3d5e77';

const closed = (over: Partial<OrderPostsResult> = {}): OrderPostsResult => ({
  posted: 0,
  closed: 0,
  skipped: 0,
  failed: 0,
  ...over,
});

const drainResult = (over: Partial<DrainResult> = {}): DrainResult => ({
  claimed: 0,
  sent: 0,
  dropped: 0,
  failed: 0,
  status: 200,
  rateLimited: false,
  ...over,
});

let logs: string[];
let registered: TimerRegistration[];
let touched: string[];

/**
 * Every port answers "nothing to do" and records that it was asked, so a test can prove both what
 * a hook did and what it never even read.
 */
function ports(
  mode: SwitchMode | Partial<Record<SwitchKind, SwitchMode>>,
  over: Partial<HookPorts> = {},
): HookPorts {
  const modes = typeof mode === 'string' ? null : mode;
  return {
    now: () => NOW,
    log: (line) => logs.push(line),
    mode: async (kind) => {
      touched.push(`mode:${kind}`);
      return modes ? (modes[kind] ?? 'legacy') : (mode as SwitchMode);
    },
    register: async (timer) => {
      registered.push(timer);
      return 'stored';
    },
    closePosts: async () => {
      touched.push('closePosts');
      return closed();
    },
    nextTeamSeat: async () => {
      touched.push('nextTeamSeat');
      return null;
    },
    drainAnalytics: async () => {
      touched.push('drainAnalytics');
      return drainResult();
    },
    eligibleAnalytics: async () => {
      touched.push('eligibleAnalytics');
      return 0;
    },
    settleState: async () => {
      touched.push('settleState');
      return null;
    },
    releaseWalletHold: async () => {
      touched.push('releaseWalletHold');
      return true;
    },
    ...over,
  };
}

beforeEach(() => {
  logs = [];
  registered = [];
  touched = [];
});

/** Nothing may be registered that the worker would refuse. */
const onlyValidRegistrations = () => {
  for (const timer of registered)
    expect(
      TimerRequestSchema.safeParse({ ...timer, key: timerKey(timer) }).success,
    ).toBe(true);
};

describe('closeOrderPostsAfter', () => {
  it('does nothing at all in legacy: the 10 s dispatcher still owns closing', async () => {
    await closeOrderPostsAfter(ports('legacy'), ORDER);
    expect(touched).toStrictEqual(['mode:orders']);
    expect(logs).toStrictEqual([]);
    expect(registered).toStrictEqual([]);
  });

  it('only logs in shadow, and never touches Discord', async () => {
    await closeOrderPostsAfter(ports('shadow'), ORDER);
    expect(touched).toStrictEqual(['mode:orders']);
    expect(logs).toStrictEqual([`[event-shadow] orders ${ORDER} would=close`]);
  });

  it('names the whole list in shadow when no order is given', async () => {
    await closeOrderPostsAfter(ports('shadow'));
    expect(logs).toStrictEqual(['[event-shadow] orders all would=close']);
  });

  it('closes the posts in live', async () => {
    await closeOrderPostsAfter(ports('live'), ORDER);
    expect(touched).toStrictEqual(['mode:orders', 'closePosts']);
    expect(logs).toStrictEqual([]);
  });

  it('stays quiet when order posts are switched off', async () => {
    await closeOrderPostsAfter(
      ports('live', { closePosts: async () => null }),
      ORDER,
    );
    expect(touched).toStrictEqual(['mode:orders']);
    expect(registered).toStrictEqual([]);
  });

  it('reports a post that would not close, because the fixer has to pick it up', async () => {
    await closeOrderPostsAfter(
      ports('live', { closePosts: async () => closed({ failed: 2 }) }),
      ORDER,
    );
    expect(logs).toStrictEqual(['[background] 2 order posts would not close']);
  });

  it('asks for the next team seat only once a post really closed', async () => {
    await closeOrderPostsAfter(
      ports('live', { closePosts: async () => closed({ closed: 0 }) }),
      ORDER,
    );
    expect(touched).not.toContain('nextTeamSeat');
    expect(registered).toStrictEqual([]);
  });

  it('pulls the next seat’s order-post forward to now', async () => {
    const epoch = NOW - 120_000;
    await closeOrderPostsAfter(
      ports('live', {
        closePosts: async () => closed({ closed: 1 }),
        nextTeamSeat: async (orderId) => {
          expect(orderId).toBe(ORDER);
          return { id: SEAT, epoch };
        },
      }),
      ORDER,
    );
    expect(registered).toStrictEqual([
      { kind: 'order-post', ref: SEAT, epoch, at: NOW },
    ]);
    onlyValidRegistrations();
  });

  it('registers nothing for a single order with no team', async () => {
    await closeOrderPostsAfter(
      ports('live', { closePosts: async () => closed({ closed: 1 }) }),
      ORDER,
    );
    expect(touched).toContain('nextTeamSeat');
    expect(registered).toStrictEqual([]);
  });

  it('never looks for a team when the event names no order', async () => {
    await closeOrderPostsAfter(
      ports('live', {
        closePosts: async () => {
          touched.push('closePosts');
          return closed({ closed: 3 });
        },
      }),
    );
    expect(touched).toStrictEqual(['mode:orders', 'closePosts']);
  });
});

describe('drainAnalyticsAfter', () => {
  const first = ANALYTICS_RETRY_DELAYS_MS[0];

  it('does nothing at all in legacy', async () => {
    await drainAnalyticsAfter(ports('legacy'));
    expect(touched).toStrictEqual(['mode:analytics']);
  });

  it('only logs in shadow, so no outbox row is ever marked', async () => {
    await drainAnalyticsAfter(ports('shadow'));
    expect(touched).toStrictEqual(['mode:analytics']);
    expect(logs).toStrictEqual(['[event-shadow] analytics outbox would=drain']);
  });

  it('drains in live and registers nothing when the outbox is empty', async () => {
    await drainAnalyticsAfter(ports('live'));
    expect(touched).toStrictEqual([
      'mode:analytics',
      'drainAnalytics',
      'eligibleAnalytics',
    ]);
    expect(registered).toStrictEqual([]);
  });

  it('registers no retry when analytics are switched off', async () => {
    await drainAnalyticsAfter(
      ports('live', {
        drainAnalytics: async () => {
          touched.push('drainAnalytics');
          return null;
        },
      }),
    );
    expect(touched).toStrictEqual(['mode:analytics', 'drainAnalytics']);
    expect(registered).toStrictEqual([]);
  });

  it('continues through a timer while the outbox still has eligible rows', async () => {
    await drainAnalyticsAfter(
      ports('live', { eligibleAnalytics: async () => 7 }),
    );
    const epoch = retryEpoch(NOW);
    expect(registered).toStrictEqual([
      { kind: 'analytics-retry', ref: 'outbox', epoch, at: epoch + first },
    ]);
    onlyValidRegistrations();
  });

  it('walks the ladder after a failed batch without reading the outbox again', async () => {
    await drainAnalyticsAfter(
      ports('live', {
        drainAnalytics: async () => {
          touched.push('drainAnalytics');
          return drainResult({ failed: 4 });
        },
      }),
    );
    expect(touched).toStrictEqual(['mode:analytics', 'drainAnalytics']);
    expect(registered[0]?.kind).toBe('analytics-retry');
  });

  it('treats a drain that threw as a failure rather than as silence', async () => {
    await drainAnalyticsAfter(
      ports('live', {
        drainAnalytics: async () => {
          throw new Error('posthog said no');
        },
      }),
    );
    expect(registered).toStrictEqual([
      {
        kind: 'analytics-retry',
        ref: 'outbox',
        epoch: retryEpoch(NOW),
        at: retryEpoch(NOW) + first,
      },
    ]);
  });

  it('buckets the epoch, so a burst of failures is one key and not one timer each', async () => {
    const bucket = retryEpoch(NOW);
    expect(NOW - bucket).toBeGreaterThan(0);
    for (const now of [bucket, bucket + 1, NOW, bucket + 29_999])
      expect(retryEpoch(now)).toBe(bucket);
    expect(retryEpoch(bucket + 30_000)).toBe(bucket + 30_000);
    // The first ladder step is therefore always still ahead of now.
    expect(bucket + first).toBeGreaterThan(NOW);
  });
});

describe('settleRetryAfter', () => {
  const [first, second, third] = SETTLE_RETRY_DELAYS_MS;
  const settle = (
    over: Partial<
      NonNullable<Awaited<ReturnType<HookPorts['settleState']>>>
    > = {},
  ) =>
    ports('live', {
      settleState: async () => ({
        settle: 'capture',
        attempts: 1,
        updatedAt: NOW,
        ...over,
      }),
    });

  it('does not even read the payment row in legacy', async () => {
    await settleRetryAfter(ports('legacy'), ORDER);
    expect(touched).toStrictEqual(['mode:payments']);
  });

  it('registers in shadow too: a registration writes nothing anybody can see', async () => {
    await settleRetryAfter(
      ports('shadow', {
        settleState: async () => ({
          settle: 'release',
          attempts: 0,
          updatedAt: NOW,
        }),
      }),
      ORDER,
    );
    expect(registered).toStrictEqual([
      { kind: 'settle-retry', ref: ORDER, epoch: NOW, at: NOW + first },
    ]);
    expect(logs).toStrictEqual([]);
  });

  it('registers the first ladder step from the commit that recorded the attempt', async () => {
    await settleRetryAfter(settle(), ORDER);
    expect(registered).toStrictEqual([
      { kind: 'settle-retry', ref: ORDER, epoch: NOW, at: NOW + first },
    ]);
    onlyValidRegistrations();
  });

  it('skips ladder steps that are already in the past', async () => {
    await settleRetryAfter(settle({ updatedAt: NOW - first - 1 }), ORDER);
    expect(registered[0]?.at).toBe(NOW - first - 1 + second);
    registered = [];
    await settleRetryAfter(settle({ updatedAt: NOW - second - 1 }), ORDER);
    expect(registered[0]?.at).toBe(NOW - second - 1 + third);
  });

  it('leaves an exhausted ladder to the fixer', async () => {
    await settleRetryAfter(settle({ updatedAt: NOW - third - 1 }), ORDER);
    expect(registered).toStrictEqual([]);
  });

  it('registers nothing without a payment row, or once it is settled', async () => {
    await settleRetryAfter(ports('live'), ORDER);
    await settleRetryAfter(settle({ settle: 'none' }), ORDER);
    expect(registered).toStrictEqual([]);
  });

  it('leaves a row the claim path gave up on to the monitoring query', async () => {
    await settleRetryAfter(settle({ attempts: SETTLE_ATTEMPT_CAP }), ORDER);
    expect(registered).toStrictEqual([]);
    registered = [];
    await settleRetryAfter(settle({ attempts: SETTLE_ATTEMPT_CAP - 1 }), ORDER);
    expect(registered).toHaveLength(1);
  });
});

describe('releaseWalletHoldAfter', () => {
  it('does nothing at all in legacy', async () => {
    await releaseWalletHoldAfter(ports('legacy'), INTENT);
    expect(touched).toStrictEqual(['mode:payments']);
  });

  it('only logs in shadow, so no wallet entry is written', async () => {
    await releaseWalletHoldAfter(ports('shadow'), INTENT);
    expect(touched).toStrictEqual(['mode:payments']);
    expect(logs).toStrictEqual([
      `[event-shadow] payments ${INTENT} would=release`,
    ]);
  });

  it('releases in live', async () => {
    await releaseWalletHoldAfter(ports('live'), INTENT);
    expect(touched).toStrictEqual(['mode:payments', 'releaseWalletHold']);
    expect(logs).toStrictEqual([]);
  });

  it('reports a release that failed, because the fixer has the 10 minute backstop', async () => {
    await releaseWalletHoldAfter(
      ports('live', { releaseWalletHold: async () => false }),
      INTENT,
    );
    expect(logs).toStrictEqual([
      `[background] the wallet hold of ${INTENT} would not release`,
    ]);
  });
});

describe('presenceCheckAfter', () => {
  it('does nothing at all in legacy', async () => {
    await presenceCheckAfter(ports('legacy'));
    expect(registered).toStrictEqual([]);
  });

  it('asks for the singleton one freshness window out, in shadow and in live', async () => {
    for (const mode of ['shadow', 'live'] as const) {
      registered = [];
      await presenceCheckAfter(ports(mode));
      expect(registered).toStrictEqual([
        {
          kind: 'presence-check',
          ref: 'desk',
          epoch: 0,
          at: NOW + PRESENCE_CHECK_INTERVAL_MS,
        },
      ]);
      expect(timerKey(registered[0]!)).toBe('presence-check:desk:0');
      onlyValidRegistrations();
    }
  });
});

describe('backgroundEventAfter', () => {
  it('does nothing without a database', async () => {
    await backgroundEventAfter(null, { order: ORDER, analytics: true });
    expect(touched).toStrictEqual([]);
  });

  it('runs every hook the event implies, each behind its own switch', async () => {
    await backgroundEventAfter(
      ports({ orders: 'live', payments: 'live', analytics: 'legacy' }),
      { order: ORDER, settle: ORDER, analytics: true },
    );
    expect(touched).toContain('closePosts');
    expect(touched).toContain('settleState');
    expect(touched).not.toContain('drainAnalytics');
  });

  it('asks for nothing the event did not name', async () => {
    await backgroundEventAfter(ports('live'), { analytics: true });
    expect(touched).toStrictEqual([
      'mode:analytics',
      'drainAnalytics',
      'eligibleAnalytics',
    ]);
  });

  it('logs a hook that threw and still runs the others', async () => {
    await backgroundEventAfter(
      ports('live', {
        closePosts: async () => {
          throw new Error('Discord is down');
        },
      }),
      { order: ORDER, analytics: true },
    );
    expect(logs).toStrictEqual(['[background] a hook failed: Discord is down']);
    expect(touched).toContain('drainAnalytics');
  });
});

describe('withBackground', () => {
  const route = (status: number) => async () => new Response('{}', { status });
  const context = {
    request: new Request('https://duoly.gg/api/orders/x/cancel'),
    params: { id: ORDER },
  } as unknown as Parameters<Parameters<typeof withBackground>[0]>[0];

  it('runs the hooks after a 200 and answers exactly what the route answered', async () => {
    const injected = ports('live');
    const handler = withBackground(route(200), () => ({ order: ORDER }), {
      ports: injected,
    });
    const response = await handler(context);
    expect(response.status).toBe(200);
    expect(touched).toContain('closePosts');
  });

  it('runs nothing when the route refused', async () => {
    const handler = withBackground(route(409), () => ({ order: ORDER }), {
      ports: ports('live'),
    });
    expect((await handler(context)).status).toBe(409);
    expect(touched).toStrictEqual([]);
  });

  it('runs nothing when the scope has no event', async () => {
    const handler = withBackground(route(200), () => null, {
      ports: ports('live'),
    });
    await handler(context);
    expect(touched).toStrictEqual([]);
  });

  it('never lets a broken scope change the answer', async () => {
    const handler = withBackground(
      route(200),
      () => {
        throw new Error('no params');
      },
      { ports: ports('live') },
    );
    expect((await handler(context)).status).toBe(200);
    expect(touched).toStrictEqual([]);
  });
});

describe('afterResponse', () => {
  const SYMBOL = Symbol.for('@vercel/request-context');

  it('awaits the work where there is no request context', async () => {
    let done = false;
    await afterResponse(async () => {
      done = true;
    });
    expect(done).toBe(true);
  });

  it('hands the work to waitUntil on Vercel instead of blocking the answer', async () => {
    const waitUntil = vi.fn();
    (globalThis as Record<symbol, unknown>)[SYMBOL] = {
      get: () => ({ waitUntil }),
    };
    try {
      let done = false;
      await afterResponse(async () => {
        done = true;
      });
      expect(waitUntil).toHaveBeenCalledTimes(1);
      await waitUntil.mock.calls[0]![0];
      expect(done).toBe(true);
    } finally {
      delete (globalThis as Record<symbol, unknown>)[SYMBOL];
    }
  });

  it('logs work that threw and never rejects', async () => {
    await expect(
      afterResponse(
        async () => {
          throw new Error('Discord is down');
        },
        (line) => logs.push(line),
      ),
    ).resolves.toBeUndefined();
    expect(logs).toStrictEqual(['[background] a hook failed: Discord is down']);
  });
});
