import { describe, expect, it } from 'vitest';
import { buildPlan } from '../../scripts/posthog/plan.mjs';
import { ApiClient, upsert, matches } from '../../scripts/posthog/lib.mjs';
import {
  EVENT_CATALOGUE,
  SERVER_EVENT_CATALOGUE,
} from '../../src/contracts/analytics-events';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

describe('PostHog analysis plan', () => {
  it('only references real catalogue or built-in events, including SQL literals', () => {
    const known = new Set([
      ...Object.keys(EVENT_CATALOGUE),
      ...Object.keys(SERVER_EVENT_CATALOGUE),
      '$pageview',
      '$autocapture',
      '$exception',
      '$web_vitals',
      '$rageclick',
      '$dead_click',
      '$ai_generation',
    ]);
    for (const insight of buildPlan().insights) {
      for (const name of insight.events)
        expect(known.has(name), name).toBe(true);
      const query = insight.query;
      for (const series of query.series ?? [])
        expect(known.has(series.event)).toBe(true);
      if (query.kind === 'HogQLQuery') {
        for (const match of query.query.matchAll(/event\s*=\s*'([^']+)'/g))
          expect(known.has(match[1])).toBe(true);
        for (const match of query.query.matchAll(/event\s+IN\s*\(([^)]+)\)/g)) {
          for (const name of match[1].matchAll(/'([^']+)'/g))
            expect(known.has(name[1])).toBe(true);
        }
      }
    }
    expect(buildPlan().events.map((e: { name: string }) => e.name)).toEqual(
      expect.arrayContaining([
        ...Object.keys(EVENT_CATALOGUE),
        ...Object.keys(SERVER_EVENT_CATALOGUE),
        '$ai_generation',
        '$ai_span',
      ]),
    );
  });
  it('contains no embedded secrets in scripts (including generated reports)', () => {
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
      );
    for (const file of walk('scripts/posthog'))
      expect(readFileSync(file, 'utf8')).not.toMatch(
        /ph[xc]_[a-zA-Z0-9]{20,}|Bearer\s+[a-zA-Z0-9_-]{20,}|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
      );
  });
  it('retries 429 and 503 with Retry-After, without leaking credentials', async () => {
    const delays: number[] = [];
    const replies = [
      new Response('{}', { status: 429, headers: { 'Retry-After': '2' } }),
      new Response('{}', { status: 503 }),
      new Response('{"ok":true}'),
    ];
    const api = new ApiClient({
      key: 'unit-only',
      apply: true,
      fetchImpl: async () => replies.shift()!,
      sleep: async (ms: number) => {
        delays.push(ms);
      },
    });
    expect(await api.request('/api/environments/329587/dashboards/')).toEqual({
      ok: true,
    });
    expect(delays[0]).toBe(2000);
    expect(delays[1]).toBeGreaterThanOrEqual(2000);
  });
  it('upserts a stable name, reads back writes and creates zero on second run', async () => {
    const objects: { id: number; name: string }[] = [];
    const calls: string[] = [];
    const api = new ApiClient({
      key: 'unit-only',
      apply: true,
      fetchImpl: async (
        _url: string | URL | Request,
        init: RequestInit = {},
      ) => {
        const method = init.method ?? 'GET';
        calls.push(method);
        if (method === 'POST') {
          const payload = JSON.parse(init.body as string);
          objects.push({ id: 1, ...payload });
          return Response.json(objects[0]);
        }
        if (method === 'PATCH') {
          Object.assign(objects[0]!, JSON.parse(init.body as string));
          return Response.json(objects[0]);
        }
        return Response.json(objects[0]);
      },
    });
    await upsert(api, 'dashboards', [], { name: '[duoly] board' });
    await upsert(api, 'dashboards', objects, { name: '[duoly] board' });
    expect(calls.filter((c) => c === 'POST')).toHaveLength(1);
    expect(calls.filter((c) => c === 'GET')).toHaveLength(2);
    expect(objects).toHaveLength(1);
  });
  it('accepts the API InsightVizNode wrapper without changing the native source', () => {
    expect(
      matches(
        {
          query: {
            kind: 'InsightVizNode',
            source: { kind: 'TrendsQuery', series: [] },
          },
        },
        { query: { kind: 'TrendsQuery', series: [] } },
      ),
    ).toBe(true);
  });
  it('compares tag membership independently of server sorting', () => {
    expect(
      matches(
        { name: '[duoly] event', tags: ['acquisition', 'duoly'] },
        { name: '[duoly] event', tags: ['duoly', 'acquisition'] },
      ),
    ).toBe(true);
  });
  it('finds renamed insights by their stable management key', async () => {
    const api = new ApiClient({ key: 'unit-only' });
    const existing = { id: 1, name: '[duoly] 08-tools Previous title' };
    const result = await upsert(api, 'insights', [existing], {
      name: '[duoly] 08-tools New title',
    });
    expect(result.id).toBe(1);
    expect(api.counts.plannedCreates).toBe(0);
    expect(api.counts.plannedUpdates).toBe(1);
  });
  it('defaults to dry run and refuses duplicate stable names', async () => {
    const api = new ApiClient({
      key: 'unit-only',
      fetchImpl: async () => {
        throw new Error('must not write');
      },
    });
    expect(api.apply).toBe(false);
    await upsert(api, 'dashboards', [], { name: '[duoly] dry run' });
    expect(api.counts.creates).toBe(0);
    await expect(
      upsert(
        api,
        'dashboards',
        [
          { id: 1, name: '[duoly] duplicate' },
          { id: 2, name: '[duoly] duplicate' },
        ],
        { name: '[duoly] duplicate' },
      ),
    ).rejects.toThrow('Duplicate');
  });
  it('stores both Web Analytics goal views and exactly three heatmap entries', () => {
    const plan = buildPlan();
    expect(plan.heatmapSettings.url_allowlist).toEqual([
      'https://duoly.gg/',
      'https://duoly.gg/games/*',
      'https://duoly.gg/pro',
    ]);
    expect(
      plan.insights
        .filter(
          (i: { query: { kind: string } }) =>
            i.query.kind === 'WebOverviewQuery',
        )
        .map(
          (i: { query: { conversionGoal: { customEventName: string } } }) =>
            i.query.conversionGoal.customEventName,
        ),
    ).toEqual(['user_signed_up', 'order_funded']);
    expect(
      plan.insights.some((i: { key: string }) => i.key === '02-first-repeat'),
    ).toBe(true);
  });
  it('defines eight populated dashboards without exceeding the free alert cap', () => {
    const plan = buildPlan();
    expect(plan.dashboards.map((d: { number: number }) => d.number)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8,
    ]);
    for (const board of plan.dashboards) {
      expect(
        plan.insights.some((i: { board: number }) => i.board === board.number),
      ).toBe(true);
    }
    expect(plan.alerts.length).toBeLessThanOrEqual(5);
    expect(plan.alerts.length).toBe(5);
  });
});
