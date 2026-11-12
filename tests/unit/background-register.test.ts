import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  REGISTER_HORIZON_MS,
  REGISTER_BACKDATE_MS,
  verifyBackgroundBody,
} from '../../src/contracts/background';
import { registerTarget } from '../../src/server/background/config';
import {
  registerTimer,
  registerTimerIfEnabled,
  registerTimersIfEnabled,
  resetRegisterMemory,
  type TimerRegistration,
} from '../../src/server/background/register';

const SECRET = 'duoly-background-register-secret-0123456789';
const NOW = Date.parse('2026-11-12T12:00:00.000Z');
const ORDER = 'b1a77e3c-0f2a-4a6e-9c21-9e4f0a1d3b55';
const target = {
  url: 'https://worker.example.workers.dev/timers',
  secret: SECRET,
};

const timer = (over: Partial<TimerRegistration> = {}): TimerRegistration => ({
  kind: 'settle-retry',
  ref: ORDER,
  epoch: NOW,
  at: NOW + 30_000,
  ...over,
});

let logs: string[];
const log = (line: string) => logs.push(line);

/** One worker answer, plus the request it was given. */
function worker(answer: { status?: number; body?: unknown } = {}): {
  fetchImpl: typeof fetch;
  seen: Request[];
} {
  const seen: Request[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    seen.push(new Request(url, init));
    return new Response(
      JSON.stringify(
        answer.body ?? {
          key: 'settle-retry:x:0',
          at: NOW + 30_000,
          stored: 'stored',
        },
      ),
      { status: answer.status ?? 200 },
    );
  }) as unknown as typeof fetch;
  return { fetchImpl, seen };
}

/** Only what registerTimerIfEnabled reads: one row of public.background_switches. */
const switches = (mode: string | null) =>
  ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: mode === null ? null : { mode },
            error: null,
          }),
        }),
      }),
    }),
  }) as unknown as SupabaseClient;

beforeEach(() => {
  logs = [];
  resetRegisterMemory();
});

describe('register target', () => {
  it('needs an https base URL with no path and a long enough secret', () => {
    const ok = {
      BACKGROUND_TIMERS_URL: 'https://duoly-discord-gateway.duoly.workers.dev',
      BACKGROUND_REGISTER_SECRET: SECRET,
    };
    expect(registerTarget(ok)?.url).toBe(
      'https://duoly-discord-gateway.duoly.workers.dev/timers',
    );
    expect(
      registerTarget({
        ...ok,
        BACKGROUND_TIMERS_URL: `${ok.BACKGROUND_TIMERS_URL}/`,
      })?.url,
    ).toBe('https://duoly-discord-gateway.duoly.workers.dev/timers');
    expect(
      registerTarget({ ...ok, BACKGROUND_TIMERS_URL: 'http://x.dev' }),
    ).toBeNull();
    expect(
      registerTarget({ ...ok, BACKGROUND_TIMERS_URL: 'https://x.dev/timers' }),
    ).toBeNull();
    expect(
      registerTarget({ ...ok, BACKGROUND_REGISTER_SECRET: 'short' }),
    ).toBeNull();
    expect(registerTarget({ BACKGROUND_REGISTER_SECRET: SECRET })).toBeNull();
  });
});

describe('registerTimer', () => {
  it('signs the exact bytes it sends, so the worker can verify them', async () => {
    const { fetchImpl, seen } = worker();
    expect(
      await registerTimer(timer(), { target, fetchImpl, now: NOW, log }),
    ).toBe('stored');
    const sent = seen[0]!;
    const body = await sent.text();
    expect(JSON.parse(body)).toStrictEqual({
      kind: 'settle-retry',
      ref: ORDER,
      epoch: NOW,
      at: NOW + 30_000,
    });
    expect(sent.headers.get(TIMESTAMP_HEADER)).toBe(String(NOW));
    expect(
      await verifyBackgroundBody({
        secret: SECRET,
        signature: sent.headers.get(SIGNATURE_HEADER),
        timestamp: sent.headers.get(TIMESTAMP_HEADER),
        body,
        now: NOW,
      }),
    ).toStrictEqual({ ok: true });
  });

  it('sends no key, because the worker derives it from the three fields', async () => {
    const { fetchImpl, seen } = worker();
    await registerTimer(timer(), { target, fetchImpl, now: NOW, log });
    expect(Object.keys(JSON.parse(await seen[0]!.text()))).toStrictEqual([
      'kind',
      'ref',
      'epoch',
      'at',
    ]);
  });

  it('reports what the worker did with the key', async () => {
    for (const stored of ['stored', 'kept', 'refused'] as const) {
      const { fetchImpl } = worker({
        body: { key: 'settle-retry:x:0', at: NOW + 30_000, stored },
      });
      expect(
        await registerTimer(timer(), { target, fetchImpl, now: NOW, log }),
      ).toBe(stored);
    }
  });

  it('refuses a ref with a colon, which would break the key', async () => {
    const { fetchImpl, seen } = worker();
    expect(
      await registerTimer(timer({ ref: 'order:1' }), {
        target,
        fetchImpl,
        now: NOW,
        log,
      }),
    ).toBe('invalid');
    expect(seen).toHaveLength(0);
  });

  it('refuses a wake-up outside the window instead of sending it', async () => {
    const { fetchImpl, seen } = worker();
    const far = { target, fetchImpl, now: NOW, log };
    expect(
      await registerTimer(
        timer({ at: NOW + REGISTER_HORIZON_MS + 60_000 }),
        far,
      ),
    ).toBe('invalid');
    expect(
      await registerTimer(
        timer({ at: NOW - REGISTER_BACKDATE_MS - 60_000 }),
        far,
      ),
    ).toBe('invalid');
    expect(seen).toHaveLength(0);
    expect(logs).toHaveLength(2);
  });

  it('skips in silence while the worker is not configured yet', async () => {
    expect(await registerTimer(timer(), { target: null, now: NOW, log })).toBe(
      'skipped',
    );
    expect(await registerTimer(timer(), { target: null, now: NOW, log })).toBe(
      'skipped',
    );
    // One line per process, not one per order.
    expect(logs).toHaveLength(1);
    expect(logs[0]).toContain('BACKGROUND_TIMERS_URL');
  });

  it('treats a refused or unreadable answer as a failed registration', async () => {
    const refused = worker({ status: 401, body: { error: 'unauthorized' } });
    expect(
      await registerTimer(timer(), {
        target,
        fetchImpl: refused.fetchImpl,
        now: NOW,
        log,
      }),
    ).toBe('failed');
    const nonsense = worker({ body: { ok: true } });
    expect(
      await registerTimer(timer(), {
        target,
        fetchImpl: nonsense.fetchImpl,
        now: NOW,
        log,
      }),
    ).toBe('failed');
  });

  it('never throws when the worker cannot be reached', async () => {
    const fetchImpl = (async () => {
      throw new Error('timed out');
    }) as unknown as typeof fetch;
    expect(
      await registerTimer(timer(), { target, fetchImpl, now: NOW, log }),
    ).toBe('failed');
    expect(logs[0]).toContain('timed out');
  });
});

describe('registering behind the switch', () => {
  it('does nothing at all while the kind is legacy', async () => {
    const { fetchImpl, seen } = worker();
    expect(
      await registerTimerIfEnabled(switches('legacy'), timer(), {
        target,
        fetchImpl,
        now: NOW,
        log,
      }),
    ).toBe('legacy');
    expect(seen).toHaveLength(0);
  });

  it('registers in shadow and in live', async () => {
    for (const mode of ['shadow', 'live']) {
      const { fetchImpl, seen } = worker();
      expect(
        await registerTimerIfEnabled(switches(mode), timer(), {
          target,
          fetchImpl,
          now: NOW,
          log,
        }),
      ).toBe('stored');
      expect(seen).toHaveLength(1);
    }
  });

  it('reads a missing row as legacy, so nothing happens before the migration', async () => {
    const { fetchImpl, seen } = worker();
    expect(
      await registerTimerIfEnabled(switches(null), timer(), {
        target,
        fetchImpl,
        now: NOW,
        log,
      }),
    ).toBe('legacy');
    expect(seen).toHaveLength(0);
  });

  it('keeps several registrations independent', async () => {
    const { fetchImpl, seen } = worker();
    const outcomes = await registerTimersIfEnabled(
      switches('shadow'),
      [
        timer({ kind: 'order-post' }),
        timer({ kind: 'order-expire' }),
        timer({ ref: 'bad:ref' }),
      ],
      { target, fetchImpl, now: NOW, log },
    );
    expect(outcomes).toStrictEqual(['stored', 'stored', 'invalid']);
    expect(seen).toHaveLength(2);
  });

  it('uses the switch of the dispatcher that owns the same work today', async () => {
    const read = vi.fn(async () => ({ data: { mode: 'legacy' }, error: null }));
    const kinds: string[] = [];
    const db = {
      from: () => ({
        select: () => ({
          eq: (_column: string, value: string) => {
            kinds.push(value);
            return { maybeSingle: read };
          },
        }),
      }),
    } as unknown as SupabaseClient;
    await registerTimersIfEnabled(
      db,
      [
        timer({ kind: 'order-post' }),
        timer({ kind: 'order-expire' }),
        timer({ kind: 'settle-retry' }),
        timer({ kind: 'analytics-retry' }),
        timer({ kind: 'presence-check', ref: 'desk', epoch: 0 }),
      ],
      { target, now: NOW, log },
    );
    expect(kinds).toStrictEqual([
      'orders',
      'payments',
      'payments',
      'analytics',
      'roles',
    ]);
  });
});
