import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  ORDER_EXPIRE_DELAY_MS,
  ORDER_POST_DELAY_MS,
  SIGNATURE_WINDOW_MS,
  TimerDispositionSchema,
  signedRequestHeaders,
  timerKey,
  type TimerKind,
} from '../../src/contracts/background';

/**
 * The endpoints read the service client through supportService(), so one fake database serves the
 * switch read and every handler read behind it. Everything else in the path is the real code.
 */
let db: SupabaseClient | null = null;
vi.mock('../../src/server/support/store', () => ({
  supportService: () => db,
}));

const { reconcileTick, timerFire } =
  await import('../../src/server/background/endpoints');

const FIRE_SECRET = 'duoly-background-fire-secret-0123456789';
const RECONCILE_SECRET = 'duoly-background-reconcile-secret-0123456789';
const ORDER = 'b1a77e3c-0f2a-4a6e-9c21-9e4f0a1d3b55';
/**
 * Relative to the real clock, never a literal date. These tests run the real ports, which read
 * `Date.now()`, so a fixed `queued_at` would be a time bomb: the SQL due predicate refuses to post
 * an order with less than 20 s of its 5 minutes left, so a hard-coded queue epoch stops being
 * postable about 4 minutes 40 seconds after the date it names, and the shadow assertion below
 * would flip from `would=post` to `would=stale` for everybody after that.
 */
const NOW = Date.now();
const QUEUED = NOW - ORDER_POST_DELAY_MS;

type Row = Record<string, unknown>;

/** Enough of the PostgREST builder for the chains these endpoints use. */
function fakeDb(
  tables: Record<string, Row[]> = {},
  rpc: Record<string, unknown> = {},
): { client: SupabaseClient; rpcCalls: string[] } {
  const rpcCalls: string[] = [];
  const query = (table: string) => {
    const filters: ((row: Row) => boolean)[] = [];
    let counting = false;
    const run = () => {
      const data = (tables[table] ?? []).filter((row) =>
        filters.every((keep) => keep(row)),
      );
      return counting
        ? { data: null, error: null, count: data.length }
        : { data, error: null, count: null };
    };
    const builder = {
      select(_columns: string, options?: { count?: string; head?: boolean }) {
        counting = Boolean(options?.count);
        return builder;
      },
      eq(column: string, value: unknown) {
        filters.push((row) => row[column] === value);
        return builder;
      },
      is(column: string, value: unknown) {
        filters.push((row) => (row[column] ?? null) === value);
        return builder;
      },
      or() {
        return builder;
      },
      limit() {
        return builder;
      },
      async maybeSingle() {
        const answer = run();
        return {
          data: (answer.data as Row[] | null)?.[0] ?? null,
          error: null,
        };
      },
      then<T>(resolve: (value: ReturnType<typeof run>) => T) {
        return Promise.resolve(run()).then(resolve);
      },
    };
    return builder;
  };
  return {
    client: {
      from: (table: string) => query(table),
      rpc: async (name: string) => {
        rpcCalls.push(name);
        return { data: rpc[name] ?? null, error: null };
      },
    } as unknown as SupabaseClient,
    rpcCalls,
  };
}

const switchRows = (mode: string) =>
  ['orders', 'payments', 'analytics', 'roles'].map((kind) => ({ kind, mode }));

const context = (request: Request) =>
  ({ request }) as unknown as Parameters<typeof timerFire>[0];

async function post(
  body: unknown,
  { secret = FIRE_SECRET, now = Date.now(), headers = {} } = {},
): Promise<Response> {
  const text = JSON.stringify(body);
  const response = await timerFire(
    context(
      new Request('https://duoly.gg/api/internal/timer', {
        method: 'POST',
        headers: {
          ...(await signedRequestHeaders(secret, text, now)),
          ...headers,
        },
        body: text,
      }),
    ),
  );
  return response as Response;
}

const firePayload = (over: Partial<Record<string, unknown>> = {}) => {
  const base = {
    kind: 'order-post' as TimerKind,
    ref: ORDER,
    epoch: QUEUED,
    at: QUEUED + ORDER_POST_DELAY_MS,
    attempt: 1,
    firedAt: Date.now(),
    ...over,
  };
  return {
    ...base,
    key: timerKey(base as { kind: TimerKind; ref: string; epoch: number }),
  };
};

beforeEach(() => {
  process.env.BACKGROUND_FIRE_SECRET = FIRE_SECRET;
  process.env.BACKGROUND_RECONCILE_SECRET = RECONCILE_SECRET;
  db = fakeDb().client;
});

afterEach(() => {
  delete process.env.BACKGROUND_FIRE_SECRET;
  delete process.env.BACKGROUND_RECONCILE_SECRET;
  vi.restoreAllMocks();
});

describe('POST /api/internal/timer', () => {
  it('answers 405 to anything but POST', async () => {
    const response = (await timerFire(
      context(
        new Request('https://duoly.gg/api/internal/timer', { method: 'GET' }),
      ),
    )) as Response;
    expect(response.status).toBe(405);
    expect(response.headers.get('Allow')).toBe('POST');
  });

  it('refuses an unsigned call', async () => {
    const response = (await timerFire(
      context(
        new Request('https://duoly.gg/api/internal/timer', {
          method: 'POST',
          body: JSON.stringify(firePayload()),
        }),
      ),
    )) as Response;
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      reason: 'timestamp',
    });
  });

  it('refuses a signature made with the wrong secret', async () => {
    const response = await post(firePayload(), {
      secret: 'duoly-background-some-other-secret-0123456789',
    });
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      reason: 'signature',
    });
  });

  it('refuses a replay outside the 5 minute window', async () => {
    const response = await post(firePayload(), {
      now: Date.now() - SIGNATURE_WINDOW_MS - 1_000,
    });
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ reason: 'window' });
  });

  it('refuses every call while the fire secret is unset', async () => {
    delete process.env.BACKGROUND_FIRE_SECRET;
    const response = await post(firePayload());
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ reason: 'secret' });
  });

  it('refuses a body that is signed but not a timer', async () => {
    expect((await post({ kind: 'order-post' })).status).toBe(400);
    expect(
      (await post({ ...firePayload(), key: 'order-post:x:0' })).status,
    ).toBe(400);
    expect((await post({ ...firePayload(), extra: true })).status).toBe(400);
  });

  it('answers 400 to a signed body that is not JSON', async () => {
    const text = 'not json';
    const response = (await timerFire(
      context(
        new Request('https://duoly.gg/api/internal/timer', {
          method: 'POST',
          headers: await signedRequestHeaders(FIRE_SECRET, text, Date.now()),
          body: text,
        }),
      ),
    )) as Response;
    expect(response.status).toBe(400);
  });

  it('answers 503, never a 2xx, when the database is unavailable', async () => {
    db = null;
    expect((await post(firePayload())).status).toBe(503);
  });

  it('does nothing before the migration, because no switch row exists', async () => {
    const response = await post(firePayload());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toStrictEqual({
      status: 'disabled',
      mode: 'legacy',
    });
  });

  it('runs the whole shadow path over the real ports', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    db = fakeDb(
      {
        background_switches: switchRows('shadow'),
        orders: [
          {
            id: ORDER,
            status: 'queued',
            queued_at: new Date(QUEUED).toISOString(),
          },
        ],
        order_streamer_bookings: [],
      },
      { discord_order_posts_due: [{ id: ORDER }] },
    ).client;
    const response = await post(firePayload());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toStrictEqual({
      status: 'disabled',
      mode: 'shadow',
      note: 'would=post',
    });
    expect(warn).toHaveBeenCalledWith(
      `[timer-shadow] order-post ${ORDER} would=post`,
    );
  });

  it('answers stale in live mode when the order has left the queue', async () => {
    db = fakeDb({
      background_switches: switchRows('live'),
      orders: [{ id: ORDER, status: 'completed', queued_at: null }],
    }).client;
    const response = await post(firePayload());
    expect(response.status).toBe(200);
    const answer = await response.json();
    expect(answer).toStrictEqual({
      status: 'stale',
      note: 'order is completed',
    });
    expect(TimerDispositionSchema.safeParse(answer).success).toBe(true);
  });

  it('answers 503 when a read fails, so the worker keeps the timer', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    db = {
      from: (table: string) => {
        if (table !== 'background_switches')
          throw new Error('connection reset');
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { mode: 'live' },
                error: null,
              }),
            }),
          }),
        };
      },
      rpc: async () => ({ data: null, error: null }),
    } as unknown as SupabaseClient;
    const response = await post(
      firePayload({ kind: 'order-expire', at: QUEUED + ORDER_EXPIRE_DELAY_MS }),
    );
    expect(response.status).toBe(503);
  });

  it('expires through the existing sweep in live mode', async () => {
    const fake = fakeDb({
      background_switches: switchRows('live'),
      orders: [
        {
          id: ORDER,
          status: 'queued',
          queued_at: new Date(
            Date.now() - ORDER_EXPIRE_DELAY_MS - 1_000,
          ).toISOString(),
        },
      ],
    });
    db = fake.client;
    const queuedAt = Date.now() - ORDER_EXPIRE_DELAY_MS - 1_000;
    const response = await post(
      firePayload({
        kind: 'order-expire',
        epoch: queuedAt,
        at: queuedAt + ORDER_EXPIRE_DELAY_MS,
      }),
    );
    expect(response.status).toBe(200);
    // The handler calls the real RPC name; the row stays queued in the fake, so it re-arms.
    expect(fake.rpcCalls).toContain('sweep_expired_orders');
    await expect(response.json()).resolves.toMatchObject({ status: 'retry' });
  });
});

describe('POST /api/internal/reconcile', () => {
  const call = async (
    body: unknown,
    authorization = `Bearer ${RECONCILE_SECRET}`,
    method = 'POST',
  ) =>
    (await reconcileTick(
      context(
        new Request('https://duoly.gg/api/internal/reconcile', {
          method,
          headers: authorization ? { authorization } : {},
          ...(method === 'POST' && body !== undefined
            ? { body: JSON.stringify(body) }
            : {}),
        }),
      ),
    )) as Response;

  it('answers 405 to anything but POST', async () => {
    const response = await call(undefined, `Bearer ${RECONCILE_SECRET}`, 'GET');
    expect(response.status).toBe(405);
  });

  it('needs the reconcile bearer', async () => {
    expect((await call({}, '')).status).toBe(401);
    expect((await call({}, 'Bearer nope')).status).toBe(401);
    delete process.env.BACKGROUND_RECONCILE_SECRET;
    expect((await call({}, `Bearer ${RECONCILE_SECRET}`)).status).toBe(401);
  });

  it('refuses a body it does not understand', async () => {
    expect((await call({ kinds: ['nope'] })).status).toBe(400);
    expect((await call({ reason: 'x'.repeat(41) })).status).toBe(400);
    expect((await call({ surprise: true })).status).toBe(400);
  });

  it('runs the kinds the fixer found, and says what each one did', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const response = await call({
      reason: 'overdue',
      kinds: ['orders', 'roles'],
    });
    expect(response.status).toBe(200);
    // Nothing is configured in a unit test run, so every handler reports itself off.
    await expect(response.json()).resolves.toStrictEqual({
      reason: 'overdue',
      ran: { orders: 'off', roles: 'off' },
    });
    expect(warn).toHaveBeenCalledWith(
      '[background-fix] reconciling orders, roles (overdue)',
    );
  });

  it('runs all four kinds when the body names none', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const response = await call({});
    expect(Object.keys((await response.json()).ran)).toStrictEqual([
      'orders',
      'payments',
      'analytics',
      'roles',
    ]);
  });

  it('accepts an empty body, which is what a hand call sends', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const response = await call(undefined);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ reason: 'manual' });
  });

  it('ignores the switches: the fixer is the backstop in every mode', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    db = fakeDb({ background_switches: switchRows('legacy') }).client;
    const response = await call({ kinds: ['payments'] });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toStrictEqual({
      reason: 'manual',
      ran: { payments: 'off' },
    });
  });
});
