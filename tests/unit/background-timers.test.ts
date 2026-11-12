import { describe, expect, it } from 'vitest';
import {
  FIRE_RETRY_DELAYS_MS,
  MAX_FIRE_ATTEMPTS,
  REGISTER_BACKDATE_MS,
  REGISTER_HORIZON_MS,
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  TimerFireSchema,
  TimersHealthSchema,
  signedRequestHeaders,
  timerKey,
  verifyBackgroundBody,
  type TimerFire,
} from '../../src/contracts/background';
import worker from '../../workers/discord-gateway/src/index';
import {
  FIRE_PATH,
  KEEPALIVE_INTERVAL_MS,
  KEEPALIVE_RETRY_MS,
  MAX_DUE_BATCH,
  MIN_REARM_MS,
  SECRET_HOLD_MS,
  armAlarm,
  cronTick,
  emptyByKind,
  fireResolution,
  firePayload,
  keepAliveTick,
  registerTimer,
  runAlarm,
  timersHealth,
  type TimerDeps,
  type TimerEnv,
  type TimerRow,
  type TimerStats,
  type TimerStore,
} from '../../workers/discord-gateway/src/timers';

/** 2026-11-12T09:00:00Z, inside the schemas' allowed instant range. */
const START = 1_793_005_200_000;
const order = 'b1a77e3c-0f2a-4a6e-9c21-9e4f0a1d3b55';
const fireSecret = 'duoly-background-fire-secret-0123456789';
const registerSecret = 'duoly-background-register-secret-0123456789';
const healthSecret = 'duoly-background-health-secret-0123456789';
const keepAliveUrl = 'https://db.supabase.co/rest/v1/rpc/presence_public_count';
const keepAliveKey = 'sb_publishable_0123456789abcdefghijklmnop';

/** The same semantics as the Durable Object's SQLite store, in a Map. */
function memoryStore(): TimerStore & { rows: Map<string, TimerRow> } {
  const rows = new Map<string, TimerRow>();
  const meta = new Map<string, string>();
  return {
    rows,
    read: (key) => rows.get(key) ?? null,
    write: (row) => void rows.set(row.key, { ...row }),
    remove(key, version) {
      const row = rows.get(key);
      if (!row || row.version !== version) return false;
      rows.delete(key);
      return true;
    },
    reschedule(key, version, at, attempt) {
      const row = rows.get(key);
      if (!row || row.version !== version) return false;
      rows.set(key, { ...row, at, attempt, version: version + 1 });
      return true;
    },
    due: (now, limit) =>
      [...rows.values()]
        .filter((row) => row.at <= now)
        .sort((a, b) => a.at - b.at)
        .slice(0, limit)
        .map((row) => ({ ...row })),
    earliestAt: () =>
      rows.size === 0
        ? null
        : Math.min(...[...rows.values()].map((row) => row.at)),
    stats(now): TimerStats {
      const byKind = emptyByKind();
      let due = 0;
      let oldestDueAt: number | null = null;
      for (const row of rows.values()) {
        byKind[row.kind] += 1;
        if (row.at <= now) {
          due += 1;
          oldestDueAt =
            oldestDueAt === null ? row.at : Math.min(oldestDueAt, row.at);
        }
      }
      return { pending: rows.size, due, byKind, oldestDueAt };
    },
    meta: (key) => meta.get(key) ?? null,
    setMeta: (key, value) => void meta.set(key, value),
  };
}

type Reply = (fire: TimerFire, call: number) => Promise<Response>;
type Call = { url: string; headers: Record<string, string>; body: string };

interface Harness {
  deps: TimerDeps;
  store: TimerStore & { rows: Map<string, TimerRow> };
  fires: (Call & { fire: TimerFire })[];
  others: Call[];
  alarm(): number | null;
  clearAlarm(): void;
  now(): number;
  advance(ms: number): void;
  reply(next: Reply): void;
  answer(disposition: unknown): void;
}

function harness(env: Partial<TimerEnv> = {}): Harness {
  const store = memoryStore();
  const fires: (Call & { fire: TimerFire })[] = [];
  const others: Call[] = [];
  let clock = START;
  let alarm: number | null = null;
  let reply: Reply = async () => Response.json({ status: 'done' });

  const deps: TimerDeps = {
    store,
    env: {
      appBaseUrl: 'https://duoly.gg',
      fireSecret,
      keepAliveUrl: undefined,
      keepAliveKey: undefined,
      ...env,
    },
    fetch: async (input, init) => {
      const url = String(input);
      const call = {
        url,
        headers: (init?.headers ?? {}) as Record<string, string>,
        body: String(init?.body ?? ''),
      };
      if (!url.endsWith(FIRE_PATH)) {
        others.push(call);
        return new Response('1', { status: 200 });
      }
      const fire = TimerFireSchema.parse(JSON.parse(call.body));
      fires.push({ ...call, fire });
      return reply(fire, fires.length);
    },
    getAlarm: async () => alarm,
    setAlarm: async (at) => void (alarm = at),
    clearAlarm: async () => void (alarm = null),
    now: () => clock,
    random: () => 0.5,
    log: () => {},
  };

  return {
    deps,
    store,
    fires,
    others,
    alarm: () => alarm,
    clearAlarm: () => void (alarm = null),
    now: () => clock,
    advance: (ms) => void (clock += ms),
    reply: (next) => void (reply = next),
    answer: (disposition) =>
      void (reply = async () => Response.json(disposition)),
  };
}

const request = (over: Record<string, unknown> = {}) => ({
  kind: 'order-post',
  ref: order,
  epoch: START,
  at: START + 100_000,
  ...over,
});

const row = (over: Partial<TimerRow> = {}): TimerRow => ({
  key: timerKey({ kind: 'order-post', ref: order, epoch: START }),
  kind: 'order-post',
  ref: order,
  epoch: START,
  at: START,
  attempt: 0,
  version: 1,
  ...over,
});

describe('registering a timer', () => {
  it('stores a new timer under its key and arms the alarm at its due time', async () => {
    const h = harness();
    const answer = await registerTimer(h.deps, request());

    expect(answer.status).toBe(200);
    expect(answer.body).toEqual({
      key: `order-post:${order}:${START}`,
      at: START + 100_000,
      stored: 'stored',
    });
    expect(h.store.rows.get(`order-post:${order}:${START}`)).toEqual(
      row({ at: START + 100_000 }),
    );
    expect(h.alarm()).toBe(START + 100_000);
  });

  it('accepts the key when the caller sends one and rejects one that disagrees', async () => {
    const h = harness();
    const key = `order-post:${order}:${START}`;
    expect((await registerTimer(h.deps, request({ key }))).status).toBe(200);

    const bad = await registerTimer(
      h.deps,
      request({ key: `order-expire:${order}:${START}` }),
    );
    expect(bad.status).toBe(400);
    expect(bad.body).toMatchObject({ error: expect.stringContaining('key') });
  });

  it('keeps the earliest due time, so a dependency event can only pull a wake-up forward', async () => {
    const h = harness();
    await registerTimer(h.deps, request({ at: START + 100_000 }));

    const later = await registerTimer(h.deps, request({ at: START + 300_000 }));
    expect(later.body).toEqual({
      key: `order-post:${order}:${START}`,
      at: START + 100_000,
      stored: 'kept',
    });
    expect(h.store.rows.get(`order-post:${order}:${START}`)?.version).toBe(1);

    const earlier = await registerTimer(
      h.deps,
      request({ at: START + 40_000 }),
    );
    expect(earlier.body).toMatchObject({
      at: START + 40_000,
      stored: 'stored',
    });
    expect(h.store.rows.get(`order-post:${order}:${START}`)).toMatchObject({
      at: START + 40_000,
      attempt: 0,
      version: 2,
    });
    expect(h.alarm()).toBe(START + 40_000);
  });

  it('starts delivery attempts again when a wake-up is pulled forward', async () => {
    const h = harness();
    h.store.write(row({ at: START + 100_000, attempt: 2, version: 3 }));

    await registerTimer(h.deps, request({ at: START + 50_000 }));
    expect(h.store.rows.get(`order-post:${order}:${START}`)).toMatchObject({
      attempt: 0,
      version: 4,
    });
  });

  it('a newer epoch is a different timer, so the old one can only answer stale', async () => {
    const h = harness();
    await registerTimer(h.deps, request());
    await registerTimer(h.deps, request({ epoch: START + 60_000 }));

    expect([...h.store.rows.keys()]).toEqual([
      `order-post:${order}:${START}`,
      `order-post:${order}:${START + 60_000}`,
    ]);
  });

  it('refuses a due time outside the 7 day to 90 day window without storing anything', async () => {
    const h = harness();
    const far = await registerTimer(
      h.deps,
      request({ at: START + REGISTER_HORIZON_MS + 60_000 }),
    );
    expect(far.body).toMatchObject({ stored: 'refused' });

    const old = await registerTimer(
      h.deps,
      request({ at: START - REGISTER_BACKDATE_MS - 60_000 }),
    );
    expect(old.body).toMatchObject({ stored: 'refused' });
    expect(h.store.rows.size).toBe(0);
    expect(h.alarm()).toBe(null);
  });

  it('accepts a backdated registration and fires it at once', async () => {
    const h = harness();
    await registerTimer(h.deps, request({ at: START - 60_000 }));
    expect(h.alarm()).toBe(START);
  });

  it('answers 400 for a body the contract rejects and stores nothing', async () => {
    const h = harness();
    for (const body of [
      null,
      {},
      request({ kind: 'order-posts' }),
      request({ ref: `team:${order}` }),
      request({ ref: '' }),
      request({ at: START + 0.5 }),
      request({ epoch: -1 }),
      { ...request(), extra: 1 },
    ])
      expect((await registerTimer(h.deps, body)).status).toBe(400);
    expect(h.store.rows.size).toBe(0);
  });
});

describe('firing a timer', () => {
  it('sends only due timers, signed with the fire secret over the exact body', async () => {
    const h = harness();
    h.store.write(row({ at: START }));
    h.store.write(
      row({
        key: `order-expire:${order}:${START}`,
        kind: 'order-expire',
        at: START + 60_000,
      }),
    );

    await runAlarm(h.deps);

    expect(h.fires).toHaveLength(1);
    const sent = h.fires[0]!;
    expect(sent.url).toBe('https://duoly.gg' + FIRE_PATH);
    expect(sent.fire).toEqual({
      key: `order-post:${order}:${START}`,
      kind: 'order-post',
      ref: order,
      epoch: START,
      at: START,
      attempt: 1,
      firedAt: START,
    });
    expect(sent.headers[TIMESTAMP_HEADER]).toBe(String(START));
    await expect(
      verifyBackgroundBody({
        secret: fireSecret,
        signature: sent.headers[SIGNATURE_HEADER] ?? null,
        timestamp: sent.headers[TIMESTAMP_HEADER] ?? null,
        body: sent.body,
        now: START,
      }),
    ).resolves.toEqual({ ok: true });
    await expect(
      verifyBackgroundBody({
        secret: registerSecret,
        signature: sent.headers[SIGNATURE_HEADER] ?? null,
        timestamp: sent.headers[TIMESTAMP_HEADER] ?? null,
        body: sent.body,
        now: START,
      }),
    ).resolves.toEqual({ ok: false, reason: 'signature' });
  });

  it('forgets the timer on done, stale and disabled, and arms the alarm for what is left', async () => {
    for (const disposition of [
      { status: 'done' },
      { status: 'stale', note: 'order is not queued any more' },
      { status: 'disabled', mode: 'shadow' },
      { status: 'disabled', mode: 'legacy' },
    ]) {
      const h = harness();
      h.store.write(row());
      h.answer(disposition);

      await runAlarm(h.deps);

      expect(h.store.rows.size).toBe(0);
      expect(h.alarm()).toBe(null);
      expect(timersHealth(h.deps).lastFireAt).toBe(START);
      expect(timersHealth(h.deps).dropped).toBe(0);
    }
  });

  it('re-arms on retry and on pending at the time the handler named', async () => {
    for (const status of ['retry', 'pending']) {
      const h = harness();
      h.store.write(row());
      h.answer({ status, at: START + 20_000 });

      await runAlarm(h.deps);

      expect(h.store.rows.get(row().key)).toMatchObject({
        at: START + 20_000,
        attempt: 0,
        version: 2,
      });
      expect(h.alarm()).toBe(START + 20_000);
      expect(h.fires).toHaveLength(1);
    }
  });

  it('never re-arms into the past, so a retry cannot spin the alarm', async () => {
    const h = harness();
    h.store.write(row());
    h.answer({ status: 'retry', at: START - 60_000 });

    await runAlarm(h.deps);

    expect(h.store.rows.get(row().key)?.at).toBe(START + MIN_REARM_MS);
    expect(h.alarm()).toBe(START + MIN_REARM_MS);
  });

  it('does not delete a registration that pulled the key forward while the fire was in flight (oai-review F11)', async () => {
    const h = harness();
    h.store.write(row());
    h.reply(async () => {
      await registerTimer(h.deps, request({ at: START - 10_000 }));
      return Response.json({ status: 'done' });
    });

    await runAlarm(h.deps);

    expect(h.store.rows.get(row().key)).toMatchObject({
      at: START - 10_000,
      version: 2,
    });
    expect(h.alarm()).toBe(START);
  });

  it('does not re-arm over a registration that pulled the key forward either', async () => {
    const h = harness();
    h.store.write(row());
    h.reply(async () => {
      await registerTimer(h.deps, request({ at: START - 10_000 }));
      return Response.json({ status: 'retry', at: START + 600_000 });
    });

    await runAlarm(h.deps);

    expect(h.store.rows.get(row().key)).toMatchObject({
      at: START - 10_000,
      version: 2,
    });
  });

  it('answers kept for a later wake-up on a key that is firing, and forgets the finished work', async () => {
    // The same key is the same kind, ref and epoch, so it is the same piece of work. A caller that
    // wants a later wake-up for work already in flight is asking for nothing; a handler that wants
    // one answers retry or pending instead of registering.
    const h = harness();
    const answers: unknown[] = [];
    h.store.write(row());
    h.reply(async () => {
      answers.push(
        (await registerTimer(h.deps, request({ at: START + 30_000 }))).body,
      );
      return Response.json({ status: 'done' });
    });

    await runAlarm(h.deps);

    expect(answers).toEqual([{ key: row().key, at: START, stored: 'kept' }]);
    expect(h.store.rows.size).toBe(0);
  });
});

describe('a fire that does not reach a disposition', () => {
  const failures: [string, Reply][] = [
    ['no response', async () => Promise.reject(new Error('network down'))],
    ['a 500', async () => new Response('boom', { status: 500 })],
    ['a 404', async () => new Response('gone', { status: 404 })],
    ['an unreadable answer', async () => new Response('<html>')],
    [
      'an answer that is not a disposition',
      async () => Response.json({ status: 'ok' }),
    ],
  ];

  for (const [name, reply] of failures)
    it(`backs off and finally drops after ${name}`, async () => {
      const h = harness();
      h.store.write(row());
      h.reply(reply);

      for (const [index, delay] of FIRE_RETRY_DELAYS_MS.entries()) {
        await runAlarm(h.deps);
        expect(h.store.rows.get(row().key)).toMatchObject({
          at: h.now() + delay,
          attempt: index + 1,
        });
        expect(h.alarm()).toBe(h.now() + delay);
        h.advance(delay);
      }

      await runAlarm(h.deps);
      expect(h.fires).toHaveLength(MAX_FIRE_ATTEMPTS);
      expect(h.fires.at(-1)?.fire.attempt).toBe(MAX_FIRE_ATTEMPTS);
      expect(h.store.rows.size).toBe(0);
      const health = timersHealth(h.deps);
      expect(health.dropped).toBe(1);
      expect(health.lastFireAt).toBe(null);
      expect(health.lastError).toContain(row().key);
    });

  it('jitters the backoff by a tenth either way', () => {
    const failure = { failure: 'network down' };
    expect(fireResolution(row(), failure, START, 0).at).toBe(START + 27_000);
    expect(fireResolution(row(), failure, START, 1).at).toBe(START + 33_000);
    expect(fireResolution(row(), failure, START, 0.5).at).toBe(START + 30_000);
  });

  it('lets one poison timer fail without touching the others', async () => {
    const h = harness();
    for (let i = 0; i < 4; i += 1)
      h.store.write(
        row({
          key: `settle-retry:order-${i}:${START}`,
          kind: 'settle-retry',
          ref: `order-${i}`,
          at: START - i,
        }),
      );
    h.reply(async (fire) =>
      fire.ref === 'order-2'
        ? new Response('boom', { status: 500 })
        : Response.json({ status: 'done' }),
    );

    await runAlarm(h.deps);

    expect([...h.store.rows.keys()]).toEqual([`settle-retry:order-2:${START}`]);
    expect(h.store.rows.get(`settle-retry:order-2:${START}`)?.attempt).toBe(1);
  });

  it('never throws out of the alarm, even when storage itself fails', async () => {
    const h = harness();
    h.store.write(row());
    h.store.due = () => {
      throw new Error('sqlite is unhappy');
    };

    await expect(runAlarm(h.deps)).resolves.toEqual([]);
    expect(timersHealth(h.deps).lastError).toBe('sqlite is unhappy');
    expect(h.alarm()).toBe(START);
  });
});

describe('bounded batches', () => {
  it('fires at most one batch and comes straight back for the rest', async () => {
    const h = harness();
    const total = MAX_DUE_BATCH + 3;
    for (let i = 0; i < total; i += 1)
      h.store.write(
        row({
          key: `analytics-retry:fact-${i}:${START}`,
          kind: 'analytics-retry',
          ref: `fact-${i}`,
          at: START - total + i,
        }),
      );

    await runAlarm(h.deps);
    expect(h.fires).toHaveLength(MAX_DUE_BATCH);
    expect(h.store.rows.size).toBe(3);
    expect(h.alarm()).toBe(START);

    await runAlarm(h.deps);
    expect(h.fires).toHaveLength(total);
    expect(h.store.rows.size).toBe(0);
    expect(h.alarm()).toBe(null);
  });

  it('takes the oldest due timers first', async () => {
    const h = harness();
    for (let i = 0; i < MAX_DUE_BATCH + 1; i += 1)
      h.store.write(
        row({
          key: `analytics-retry:fact-${i}:${START}`,
          kind: 'analytics-retry',
          ref: `fact-${i}`,
          at: START - i,
        }),
      );

    await runAlarm(h.deps);
    expect(h.fires.map((sent) => sent.fire.ref)).not.toContain('fact-0');
    expect(h.store.rows.has(`analytics-retry:fact-0:${START}`)).toBe(true);
  });
});

describe('a half configured worker', () => {
  it('fires nothing without the fire secret, keeps the timers and looks again later', async () => {
    const h = harness({ fireSecret: undefined });
    h.store.write(row());

    await runAlarm(h.deps);

    expect(h.fires).toHaveLength(0);
    expect(h.store.rows.get(row().key)).toEqual(row());
    expect(h.alarm()).toBe(START + SECRET_HOLD_MS);
    expect(timersHealth(h.deps).lastError).toContain('BACKGROUND_FIRE_SECRET');
  });

  it('treats a secret under the minimum length as unset', async () => {
    const h = harness({ fireSecret: 'too-short' });
    h.store.write(row());

    await runAlarm(h.deps);
    expect(h.fires).toHaveLength(0);
    expect(h.store.rows.size).toBe(1);
  });
});

describe('the alarm', () => {
  it('sits at the earliest due time and clears when nothing is left', async () => {
    const h = harness();
    h.store.write(row({ at: START + 300_000 }));
    h.store.write(
      row({ key: `order-expire:${order}:${START}`, at: START + 60_000 }),
    );
    expect(await armAlarm(h.deps)).toBe(START + 60_000);

    h.store.rows.clear();
    expect(await armAlarm(h.deps)).toBe(null);
    expect(h.alarm()).toBe(null);
  });

  it('does not rewrite an alarm that is already where it belongs', async () => {
    const h = harness();
    let writes = 0;
    const setAlarm = h.deps.setAlarm;
    h.deps.setAlarm = async (at) => {
      writes += 1;
      await setAlarm(at);
    };
    h.store.write(row({ at: START + 60_000 }));

    await armAlarm(h.deps);
    await armAlarm(h.deps);
    expect(writes).toBe(1);
  });

  it('never asks for a wake-up in the past', async () => {
    const h = harness();
    h.store.write(row({ at: START - 600_000 }));
    expect(await armAlarm(h.deps)).toBe(START);
  });
});

describe('health', () => {
  it('reports counts per kind, the oldest due timer and the last fire', async () => {
    const h = harness();
    h.store.write(row({ at: START - 5_000 }));
    h.store.write(
      row({
        key: `order-expire:${order}:${START}`,
        kind: 'order-expire',
        at: START + 200_000,
      }),
    );
    h.store.write(
      row({
        key: `presence-check:desk:0`,
        kind: 'presence-check',
        ref: 'desk',
        epoch: 0,
        at: START - 1_000,
      }),
    );

    const health = TimersHealthSchema.parse(timersHealth(h.deps));
    expect(health).toEqual({
      now: START,
      pending: 3,
      due: 2,
      byKind: {
        'order-post': 1,
        'order-expire': 1,
        'settle-retry': 0,
        'analytics-retry': 0,
        'presence-check': 1,
      },
      oldestDueAt: START - 5_000,
      lastFireAt: null,
      lastErrorAt: null,
      lastError: null,
      dropped: 0,
      keepAliveAt: null,
    });
  });

  it('is all zeros on a fresh object', () => {
    const h = harness();
    expect(TimersHealthSchema.parse(timersHealth(h.deps))).toMatchObject({
      pending: 0,
      due: 0,
      oldestDueAt: null,
      dropped: 0,
    });
  });
});

describe('the Supabase keep-alive read', () => {
  const configured = { keepAliveUrl, keepAliveKey };

  it('makes one authenticated read and records when it happened', async () => {
    const h = harness(configured);

    expect(await keepAliveTick(h.deps)).toBe('ok');
    expect(h.others).toHaveLength(1);
    expect(h.others[0]).toMatchObject({
      url: keepAliveUrl,
      headers: {
        apikey: keepAliveKey,
        authorization: `Bearer ${keepAliveKey}`,
      },
      body: '{}',
    });
    expect(timersHealth(h.deps).keepAliveAt).toBe(START);
  });

  it('reads once a day, not once a minute', async () => {
    const h = harness(configured);
    expect(await keepAliveTick(h.deps)).toBe('ok');

    h.advance(60_000);
    expect(await keepAliveTick(h.deps)).toBe('skipped');
    h.advance(KEEPALIVE_INTERVAL_MS);
    expect(await keepAliveTick(h.deps)).toBe('ok');
    expect(h.others).toHaveLength(2);
  });

  it('tries again in an hour when the read fails', async () => {
    const h = harness(configured);
    h.deps.fetch = async () => new Response('down', { status: 503 });

    expect(await keepAliveTick(h.deps)).toBe('failed');
    expect(timersHealth(h.deps).keepAliveAt).toBe(null);
    expect(timersHealth(h.deps).lastError).toContain('keep-alive');

    h.advance(KEEPALIVE_RETRY_MS - 1_000);
    expect(await keepAliveTick(h.deps)).toBe('skipped');
    h.advance(1_000);
    expect(await keepAliveTick(h.deps)).toBe('failed');
  });

  it('does nothing at all while the keep-alive secrets are missing', async () => {
    const h = harness();
    expect(await keepAliveTick(h.deps)).toBe('unconfigured');
    expect(h.others).toHaveLength(0);
    expect(timersHealth(h.deps).keepAliveAt).toBe(null);
  });
});

describe('the one minute cron tick', () => {
  it('does the keep-alive read and puts a lost alarm back', async () => {
    const h = harness({ keepAliveUrl, keepAliveKey });
    h.store.write(row({ at: START + 100_000 }));
    h.clearAlarm();

    expect(await cronTick(h.deps)).toBe('ok');
    expect(h.alarm()).toBe(START + 100_000);
  });

  it('leaves the alarm alone when there is nothing to fire', async () => {
    const h = harness();
    expect(await cronTick(h.deps)).toBe('unconfigured');
    expect(h.alarm()).toBe(null);
  });
});

describe('the fire payload and resolution, on their own', () => {
  it('numbers attempts from one and never past the contract maximum', () => {
    expect(firePayload(row(), START).attempt).toBe(1);
    expect(firePayload(row({ attempt: 3 }), START).attempt).toBe(
      MAX_FIRE_ATTEMPTS,
    );
    expect(TimerFireSchema.safeParse(firePayload(row(), START)).success).toBe(
      true,
    );
  });

  it('turns every disposition into exactly one storage action', () => {
    expect(fireResolution(row(), { status: 'done' }, START).action).toBe(
      'forget',
    );
    expect(fireResolution(row(), { status: 'stale' }, START).action).toBe(
      'forget',
    );
    expect(
      fireResolution(row(), { status: 'disabled', mode: 'shadow' }, START)
        .action,
    ).toBe('forget');
    expect(
      fireResolution(row(), { status: 'retry', at: START + 60_000 }, START),
    ).toMatchObject({ action: 'rearm', at: START + 60_000, attempt: 0 });
    expect(
      fireResolution(row(), { status: 'pending', at: START + 60_000 }, START),
    ).toMatchObject({ action: 'rearm', at: START + 60_000, attempt: 0 });
    expect(
      fireResolution(row({ attempt: 3 }), { failure: 'answered 500' }, START),
    ).toMatchObject({ action: 'drop' });
  });

  it('carries the handler note into the log line', () => {
    expect(
      fireResolution(row(), { status: 'done', note: 'posted 1' }, START).note,
    ).toBe('done (posted 1)');
  });
});

// The worker's own routing: the gateway keeps /status, the timer routes are authenticated at the
// edge so an unsigned call never wakes the Durable Object, and the one minute cron wakes both.
type WorkerEnv = Parameters<typeof worker.fetch>[1];
type Woken = { binding: string; name: string; url: string; body: string };

function workerEnv(secrets: Record<string, string | undefined> = {}) {
  const woken: Woken[] = [];
  const namespace = (binding: string) => ({
    idFromName: (name: string) => ({ binding, name }),
    get: (id: unknown) => ({
      fetch: async (input: Request | string) => {
        const { binding: from, name } = id as {
          binding: string;
          name: string;
        };
        woken.push({
          binding: from,
          name,
          url: typeof input === 'string' ? input : input.url,
          body: typeof input === 'string' ? '' : await input.text(),
        });
        return Response.json({ reached: name });
      },
    }),
  });
  const env = {
    DISCORD_BOT_TOKEN: 'bot-token',
    BACKGROUND_REGISTER_SECRET: registerSecret,
    BACKGROUND_HEALTH_SECRET: healthSecret,
    ...secrets,
    BOT: namespace('BOT'),
    TIMERS: namespace('TIMERS'),
  } as unknown as WorkerEnv;
  return { env, woken };
}

const registration = JSON.stringify({
  kind: 'order-post',
  ref: order,
  epoch: START,
  at: START + 100_000,
});

const post = async (
  secret: string,
  body = registration,
  now = Date.now(),
): Promise<Request> =>
  new Request('https://duoly-discord-gateway.duoly.workers.dev/timers', {
    method: 'POST',
    headers: await signedRequestHeaders(secret, body, now),
    body,
  });

describe('the worker routes', () => {
  it('still answers /status from the gateway object and 404s everything unknown', async () => {
    const { env, woken } = workerEnv();

    const status = await worker.fetch(
      new Request('https://gateway/status'),
      env,
    );
    expect(status.status).toBe(200);
    expect(woken).toEqual([
      { binding: 'BOT', name: 'bot', url: 'https://bot/status', body: '' },
    ]);

    for (const request of [
      new Request('https://gateway/'),
      new Request('https://gateway/timers'),
      new Request('https://gateway/timers/health', { method: 'POST' }),
      new Request('https://gateway/timers/register', { method: 'POST' }),
    ])
      expect((await worker.fetch(request, env)).status).toBe(404);
    expect(woken).toHaveLength(1);
  });

  it('forwards a correctly signed registration to the timers object unchanged', async () => {
    const { env, woken } = workerEnv();

    const answer = await worker.fetch(await post(registerSecret), env);

    expect(answer.status).toBe(200);
    expect(woken).toEqual([
      {
        binding: 'TIMERS',
        name: 'timers',
        url: 'https://timers/register',
        body: registration,
      },
    ]);
  });

  it('refuses a registration that is not signed with the register secret', async () => {
    const { env, woken } = workerEnv();
    const unsigned = new Request('https://gateway/timers', {
      method: 'POST',
      body: registration,
    });

    for (const [request, reason] of [
      [unsigned, 'timestamp'],
      [await post(fireSecret), 'signature'],
      [
        await post(registerSecret, registration, Date.now() - 600_000),
        'window',
      ],
      [await post(registerSecret, 'x'.repeat(4096)), 'body-too-large'],
    ] as [Request, string][]) {
      const answer = await worker.fetch(request, env);
      expect(answer.status).toBe(401);
      await expect(answer.json()).resolves.toEqual({
        error: 'unauthorized',
        reason,
      });
    }
    expect(woken).toHaveLength(0);
  });

  it('refuses every registration while the register secret is unset', async () => {
    const { env, woken } = workerEnv({
      BACKGROUND_REGISTER_SECRET: undefined,
    });

    const answer = await worker.fetch(await post(registerSecret), env);
    expect(answer.status).toBe(401);
    await expect(answer.json()).resolves.toMatchObject({ reason: 'secret' });
    expect(woken).toHaveLength(0);
  });

  it('asks for the health bearer before reading the queue', async () => {
    const { env, woken } = workerEnv();
    const health = (authorization?: string) =>
      worker.fetch(
        new Request('https://gateway/timers/health', {
          headers: authorization ? { authorization } : {},
        }),
        env,
      );

    expect((await health()).status).toBe(401);
    expect((await health(`Bearer ${fireSecret}`)).status).toBe(401);
    expect((await health(healthSecret)).status).toBe(401);
    expect(woken).toHaveLength(0);

    expect((await health(`Bearer ${healthSecret}`)).status).toBe(200);
    expect(woken).toEqual([
      {
        binding: 'TIMERS',
        name: 'timers',
        url: 'https://timers/health',
        body: '',
      },
    ]);
  });

  it('wakes the gateway and the timers object on the one minute cron', async () => {
    const { env, woken } = workerEnv();
    const pending: Promise<unknown>[] = [];

    await worker.scheduled({}, env, {
      waitUntil: (promise) => void pending.push(promise),
    });
    await Promise.all(pending);

    expect(woken.map((call) => call.url)).toEqual([
      'https://bot/status',
      'https://timers/cron',
    ]);
  });
});
