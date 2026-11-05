import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  drainAuthorized,
  drainConfig,
  drainOnce,
  toCapture,
  type OutboxRow,
} from '../../src/server/analytics/drain';
import { OUTBOX_EVENT_CATALOGUE } from '../../src/contracts/analytics-events';
import { readFileSync } from 'node:fs';

const CONSENTED = '11111111-1111-4111-8111-111111111111';
const REFUSED = '22222222-2222-4222-8222-222222222222';
const OWNER = '33333333-3333-4333-8333-333333333333';
const config = {
  key: 'phc_test',
  host: 'https://eu.i.posthog.com',
  internalIds: new Set([OWNER]),
};
let next = 1;
const row = (over: Partial<OutboxRow> = {}): OutboxRow => ({
  id: next++,
  event: 'order_funded',
  occurred_at: '2026-11-05T10:00:00.000Z',
  user_id: CONSENTED,
  uuid: '019a0000-0000-7000-8000-' + String(next).padStart(12, '0'),
  properties: { funding: 'card', funded_eur_cents: 1500, game: 'lol' },
  ...over,
});

function fakeDb(
  batches: OutboxRow[][],
  consent = [
    { user_id: CONSENTED, analytics: true },
    { user_id: REFUSED, analytics: false },
  ],
  consentError = false,
) {
  const calls: { fn: string; args: unknown }[] = [];
  const queue = [...batches];
  const db = {
    rpc: vi.fn(async (fn: string, args: unknown) => {
      calls.push({ fn, args });
      if (fn === 'analytics_outbox_claim')
        return { data: queue.shift() ?? [], error: null };
      return { data: null, error: null };
    }),
    from: () => ({
      select: () => ({
        in: async () =>
          consentError
            ? { data: null, error: new Error('down') }
            : { data: consent, error: null },
      }),
    }),
  };
  return { db: db as unknown as SupabaseClient, calls };
}
const posthog = (status: number | Error) => {
  const sent: {
    url: string;
    body: {
      api_key: string;
      batch: { distinct_id: unknown; properties: Record<string, unknown> }[];
    };
  }[] = [];
  const fetcher = vi.fn(async (url: string, init: { body: string }) => {
    if (status instanceof Error) throw status;
    sent.push({ url, body: JSON.parse(init.body) });
    return { status };
  });
  return { fetcher, sent };
};

describe('outbox delivery identity', () => {
  it('uses the account only with Analytics consent', () => {
    const consented = new Set([CONSENTED]);
    const a = toCapture(row(), consented, new Set())!;
    expect(a.distinct_id).toBe(CONSENTED);
    expect(a.properties).not.toHaveProperty('$process_person_profile');
    const b = toCapture(row({ user_id: REFUSED }), consented, new Set())!;
    expect(b.distinct_id).not.toBe(REFUSED);
    expect(
      (b.properties as Record<string, unknown>).$process_person_profile,
    ).toBe(false);
    const c = toCapture(row({ user_id: null }), consented, new Set())!;
    expect(
      (c.properties as Record<string, unknown>).$process_person_profile,
    ).toBe(false);
  });
  it('personless ids are per fact, never a reusable account key', () => {
    const r1 = row({ user_id: REFUSED });
    const r2 = row({ user_id: REFUSED });
    const a = toCapture(r1, new Set(), new Set())!;
    expect(toCapture(r1, new Set(), new Set())!.distinct_id).toBe(
      a.distinct_id,
    );
    expect(toCapture(r2, new Set(), new Set())!.distinct_id).not.toBe(
      a.distinct_id,
    );
    expect(JSON.stringify(a)).not.toContain(REFUSED);
  });
  it('keeps the row uuid and time so PostHog deduplicates retries', () => {
    const r = row();
    const c = toCapture(r, new Set([CONSENTED]), new Set())!;
    expect(c.uuid).toBe(r.uuid);
    expect(c.timestamp).toBe(r.occurred_at);
  });
  it('only declared properties survive; text and ids are dropped', () => {
    const c = toCapture(
      row({
        properties: {
          funding: 'card',
          funded_eur_cents: 1500,
          note: 'my discord is x',
          order_id: 'abc',
          game: 'League of Legends!',
          units: -1,
        },
      }),
      new Set([CONSENTED]),
      new Set(),
    )!;
    expect(c.properties).toEqual({
      funding: 'card',
      funded_eur_cents: 1500,
      source: 'outbox',
      $lib: 'duoly-outbox',
      $geoip_disable: true,
    });
  });
  it('drops uncatalogued events and marks owner accounts internal', () => {
    expect(
      toCapture(row({ event: 'something_else' }), new Set(), new Set()),
    ).toBeNull();
    const c = toCapture(row({ user_id: OWNER }), new Set(), new Set([OWNER]))!;
    expect((c.properties as Record<string, unknown>).internal).toBe(true);
  });
  it('every trigger event in the migration is catalogued', () => {
    const sql = readFileSync(
      'supabase/migrations/20261106110000_analytics_outbox.sql',
      'utf8',
    );
    const enqueued = new Set(
      [...sql.matchAll(/analytics_enqueue\(\s*'([a-z_]+)'/g)].map((m) => m[1]!),
    );
    for (const m of sql.matchAll(/then '([a-z_]+)'/g))
      if (Object.hasOwn(OUTBOX_EVENT_CATALOGUE, m[1]!)) enqueued.add(m[1]!);
    expect(enqueued.size).toBeGreaterThan(10);
    for (const e of enqueued)
      expect(Object.keys(OUTBOX_EVENT_CATALOGUE)).toContain(e);
  });
});

describe('outbox drain', () => {
  it('sends a batch and marks rows sent only after 200', async () => {
    const rows = [
      row(),
      row({ user_id: REFUSED }),
      row({ event: 'tip_paid', properties: { amount_eur_cents: 300 } }),
    ];
    const { db, calls } = fakeDb([rows]);
    const { fetcher, sent } = posthog(200);
    const result = await drainOnce(db, config, fetcher);
    expect(result).toMatchObject({
      claimed: 3,
      sent: 3,
      failed: 0,
      status: 200,
    });
    expect(sent[0]!.url).toBe('https://eu.i.posthog.com/batch/');
    expect(sent[0]!.body.api_key).toBe('phc_test');
    expect(sent[0]!.body.batch.map((b) => b.distinct_id)[0]).toBe(CONSENTED);
    expect(
      calls.find((c) => c.fn === 'analytics_outbox_mark_sent')!.args,
    ).toEqual({
      p_ids: rows.map((r) => r.id),
    });
  });
  it('rate limits release rows for the next run and stop the loop', async () => {
    const { db, calls } = fakeDb([[row(), row()], [row()]]);
    const { fetcher } = posthog(429);
    const result = await drainOnce(db, config, fetcher);
    expect(result).toMatchObject({ sent: 0, failed: 2, rateLimited: true });
    expect(calls.filter((c) => c.fn === 'analytics_outbox_mark_sent')).toEqual(
      [],
    );
    expect(
      calls.filter((c) => c.fn === 'analytics_outbox_mark_failed'),
    ).toHaveLength(2);
    expect(calls.filter((c) => c.fn === 'analytics_outbox_claim')).toHaveLength(
      1,
    );
  });
  it.each([500, 503, new Error('offline')])(
    'outage %s never marks sent',
    async (status) => {
      const { db, calls } = fakeDb([[row()]]);
      const { fetcher } = posthog(status as number | Error);
      const result = await drainOnce(db, config, fetcher);
      expect(result.sent).toBe(0);
      expect(
        calls.filter((c) => c.fn === 'analytics_outbox_mark_sent'),
      ).toEqual([]);
      const failed = calls.find(
        (c) => c.fn === 'analytics_outbox_mark_failed',
      )!;
      expect((failed.args as { p_error: string }).p_error).toMatch(
        /^(http 50[03]|network)$/,
      );
    },
  );
  it('consent lookup failure sends everyone personless', async () => {
    const { db } = fakeDb([[row()]], [], true);
    const { fetcher, sent } = posthog(200);
    await drainOnce(db, config, fetcher);
    expect(sent[0]!.body.batch[0]!.distinct_id).not.toBe(CONSENTED);
    expect(sent[0]!.body.batch[0]!.properties.$process_person_profile).toBe(
      false,
    );
  });
  it('drains several batches until the queue is empty', async () => {
    const { db } = fakeDb([[row(), row()], [row()], []]);
    const { fetcher } = posthog(200);
    expect((await drainOnce(db, config, fetcher)).sent).toBe(3);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('uncatalogued rows are retired without being sent', async () => {
    const bad = row({ event: 'nope' });
    const { db, calls } = fakeDb([[bad]]);
    const { fetcher } = posthog(200);
    expect((await drainOnce(db, config, fetcher)).dropped).toBe(1);
    expect(fetcher).not.toHaveBeenCalled();
    expect(
      calls.find((c) => c.fn === 'analytics_outbox_mark_sent')!.args,
    ).toEqual({ p_ids: [bad.id] });
  });
});

describe('drain endpoint guards', () => {
  const secret = 'x'.repeat(40);
  it('needs the exact bearer secret of at least 32 characters', () => {
    expect(
      drainAuthorized(`Bearer ${secret}`, { ANALYTICS_DRAIN_SECRET: secret }),
    ).toBe(true);
    expect(
      drainAuthorized(`Bearer ${secret}y`, { ANALYTICS_DRAIN_SECRET: secret }),
    ).toBe(false);
    expect(drainAuthorized(null, { ANALYTICS_DRAIN_SECRET: secret })).toBe(
      false,
    );
    expect(
      drainAuthorized('Bearer short', { ANALYTICS_DRAIN_SECRET: 'short' }),
    ).toBe(false);
  });
  it('is off unless analytics is enabled with a key', () => {
    expect(
      drainConfig({
        PUBLIC_ANALYTICS_ENABLED: 'false',
        PUBLIC_POSTHOG_KEY: 'phc_x',
      }),
    ).toBeNull();
    expect(
      drainConfig({
        PUBLIC_ANALYTICS_ENABLED: 'true',
        PUBLIC_POSTHOG_KEY: 'phc_x',
        PUBLIC_POSTHOG_HOST: 'https://eu.i.posthog.com/',
      })?.host,
    ).toBe('https://eu.i.posthog.com');
  });
});
