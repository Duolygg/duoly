import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  BRACKETS,
  BRACKET_COLORS,
  bracketRoleName,
  TeammatePerformanceSchema,
  AdminPerformanceSettingsSchema,
} from '../../src/contracts/performance';
import {
  planPerformanceRoles,
  syncPerformanceRoles,
  performanceSync,
  type PerformanceStore,
  type PerformanceSyncRow,
} from '../../src/server/performance/roles';
import { PerformanceView } from '../../src/components/teammate/PerformanceCard';

const config = {
  token: 'bot-token',
  guildId: '1561145343943376896',
  supabaseUrl: 'https://x.supabase.co',
  supabaseSecretKey: 'secret',
};
const IDS = { 1: 'r1', 5: 'r5', 10: 'r10', 25: 'r25', 50: 'r50' } as const;

describe('brackets', () => {
  it('uses the exact role names and colours', () => {
    expect(BRACKETS.map(bracketRoleName)).toEqual([
      'Performance | TOP 1%',
      'Performance | TOP 5%',
      'Performance | TOP 10%',
      'Performance | TOP 25%',
      'Performance | TOP 50%',
    ]);
    expect(BRACKET_COLORS).toEqual({
      1: '#C6A6FF',
      5: '#9B8AFB',
      10: '#718CEB',
      25: '#55A9C9',
      50: '#648D91',
    });
  });

  it('keeps exactly one performance role and never touches other roles', () => {
    expect(planPerformanceRoles(['x', 'r50', 'r25'], IDS, 10)).toEqual({
      add: ['r10'],
      remove: ['r50', 'r25'],
    });
    expect(planPerformanceRoles(['x', 'r10'], IDS, 10)).toEqual({
      add: [],
      remove: [],
    });
    expect(planPerformanceRoles(['x', 'r5'], IDS, null)).toEqual({
      add: [],
      remove: ['r5'],
    });
  });

  it('only accepts weights that add up to 100', () => {
    const base = {
      csrf: 't',
      action: 'settings',
      wRetention: 45,
      wSatisfaction: 35,
      wOrders: 20,
      windowDays: 90,
      minOrders: 10,
      minReviews: 5,
      minCustomers: 3,
    };
    expect(AdminPerformanceSettingsSchema.safeParse(base).success).toBe(true);
    expect(
      AdminPerformanceSettingsSchema.safeParse({ ...base, wOrders: 25 })
        .success,
    ).toBe(false);
  });
});

describe('Discord sync', () => {
  function discord(existing: { id: string; name: string }[]) {
    const calls: { method: string; url: string; body?: unknown }[] = [];
    const members: Record<string, string[] | null> = {
      '111111111111111111': ['x', 'r50'],
      '222222222222222222': null,
    };
    let next = 900;
    const fetchImpl = vi.fn(
      async (
        url: string,
        init: {
          method: string;
          body?: string;
          headers: Record<string, string>;
        },
      ) => {
        const body = init.body ? JSON.parse(init.body) : undefined;
        calls.push({ method: init.method, url, body });
        if (url.endsWith('/roles') && init.method === 'GET')
          return Response.json(existing);
        if (url.endsWith('/roles') && init.method === 'POST')
          return Response.json({ id: 'new' + next++, name: body.name });
        const member = /members\/(\d+)$/.exec(url);
        if (member && init.method === 'GET') {
          const roles = members[member[1] ?? ''];
          return roles
            ? Response.json({ roles })
            : Response.json({ message: 'Unknown Member' }, { status: 404 });
        }
        return new Response(null, { status: 204 });
      },
    );
    return { calls, fetchImpl };
  }
  const store = (targets: Awaited<ReturnType<PerformanceStore['targets']>>) => {
    const saved: PerformanceSyncRow[] = [];
    return {
      saved,
      store: {
        targets: async () => targets,
        save: async (rows: PerformanceSyncRow[]) => {
          saved.push(...rows);
        },
      } satisfies PerformanceStore,
    };
  };

  it('creates missing roles in their colour and syncs one role per teammate', async () => {
    const { calls, fetchImpl } = discord([
      { id: 'r50', name: 'Performance | TOP 50%' },
      { id: 'x', name: 'Teammate' },
    ]);
    const { saved, store: s } = store([
      { userId: 'a', discordId: '111111111111111111', bracket: 10 },
      { userId: 'b', discordId: '222222222222222222', bracket: 25 },
      { userId: 'c', discordId: null, bracket: 50 },
    ]);
    const result = await syncPerformanceRoles(
      config,
      s,
      fetchImpl as never,
      async () => {},
    );
    const created = calls.filter((c) => c.method === 'POST');
    expect(created.map((c) => (c.body as { name: string }).name)).toEqual([
      'Performance | TOP 1%',
      'Performance | TOP 5%',
      'Performance | TOP 10%',
      'Performance | TOP 25%',
    ]);
    expect((created[0]?.body as { color: number }).color).toBe(0xc6a6ff);
    // a: TOP 50% removed, the new TOP 10% role added, "Teammate" untouched
    const changes = calls.filter(
      (c) => c.method === 'PUT' || c.method === 'DELETE',
    );
    expect(
      changes.map((c) => c.method + ' ' + c.url.split('/roles/')[1]),
    ).toEqual(['DELETE r50', 'PUT new902']);
    expect(saved).toEqual([
      { userId: 'a', status: 'synced', detail: '' },
      { userId: 'b', status: 'not_member', detail: '' },
      { userId: 'c', status: 'no_discord', detail: '' },
    ]);
    expect(result).toEqual({ synced: 1, skipped: 2, errors: 0 });
  });

  it('marks everyone as an error when the roles cannot be read', async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({ message: 'Missing Access' }, { status: 403 }),
    );
    const { saved, store: s } = store([
      { userId: 'a', discordId: '111111111111111111', bracket: 1 },
    ]);
    const result = await syncPerformanceRoles(
      config,
      s,
      fetchImpl as never,
      async () => {},
    );
    expect(result.errors).toBe(1);
    expect(saved[0]?.status).toBe('error');
  });

  it('refuses the sync endpoint without the tick secret', async () => {
    vi.stubEnv('DISCORD_ROLES_TICK_SECRET', 's'.repeat(32));
    const post = (auth?: string) =>
      performanceSync({
        request: new Request('https://duoly.gg/api/performance/sync', {
          method: 'POST',
          headers: auth ? { authorization: auth } : {},
        }),
      } as never) as Promise<Response>;
    expect((await post()).status).toBe(401);
    expect((await post('Bearer wrong')).status).toBe(401);
    const get = await (performanceSync({
      request: new Request('https://duoly.gg/api/performance/sync'),
    } as never) as Promise<Response>);
    expect(get.status).toBe(405);
    vi.unstubAllEnvs();
  });
});

describe('teammate dashboard card', () => {
  const run = {
    at: new Date(Date.now() - 2 * 3600_000).toISOString(),
    eligible: 40,
    windowDays: 90,
    weights: { retention: 45, satisfaction: 35, orders: 20 },
  };
  const me = {
    reason: '',
    completedOrders: 58,
    reviews: 31,
    avgRating: 4.87,
    customers: 22,
    returningCustomers: 9,
    retentionRate: 0.4091,
    retentionScore: 40.91,
    satisfactionScore: 96.75,
    ordersScore: 82.05,
    score: 68.68,
    rank: 6,
    percentile: 15,
    bracket: 25 as const,
  };

  it('shows ranking, score, metrics and progress to the next bracket', () => {
    const data = TeammatePerformanceSchema.parse({
      ranked: true,
      run,
      requirements: { orders: 10, reviews: 5, customers: 3 },
      me,
      next: { bracket: 10, score: 71.2, reachable: true },
    });
    const html = renderToStaticMarkup(
      React.createElement(PerformanceView, { data }),
    );
    for (const text of [
      'TOP 25%',
      '68.7',
      'rank 6 of 40',
      'Completed orders',
      '★ 4.87',
      '41%',
      '9',
      'of 22 customers',
      'Next: TOP 10%',
      '2.5 points to go',
      'Retention 45%',
    ])
      expect(html).toContain(text);
  });

  it('shows the way to eligibility when not ranked yet', () => {
    const data = TeammatePerformanceSchema.parse({
      ranked: false,
      run,
      requirements: { orders: 10, reviews: 5, customers: 3 },
      me: {
        ...me,
        reason: 'Needs 10 completed orders',
        completedOrders: 4,
        score: null,
        rank: null,
        percentile: null,
        bracket: null,
      },
      next: null,
    });
    const html = renderToStaticMarkup(
      React.createElement(PerformanceView, { data }),
    );
    expect(html).toContain('Unranked');
    expect(html).toContain('needs 10 completed orders');
    expect(html).toContain('4 of 10');
  });
});

describe('migration', () => {
  const sql = readFileSync(
    'supabase/migrations/20261030120000_performance_ranking.sql',
    'utf8',
  );
  it('defaults to 45/35/20, runs every 12 hours and keeps the sync server-only', () => {
    expect(sql).toMatch(/w_retention smallint not null default 45/);
    expect(sql).toMatch(/w_satisfaction smallint not null default 35/);
    expect(sql).toMatch(/w_orders smallint not null default 20/);
    expect(sql).toContain("'duoly-performance-recalc', '0 */12 * * *'");
    expect(sql).toMatch(
      /grant execute on function public\.performance_recalculate\(text, text\), public\.performance_role_targets\(\),\s+public\.performance_set_sync\(jsonb\) to service_role;/,
    );
    for (const b of BRACKETS) expect(sql).toContain(`<= ${b} then ${b}`);
  });
});
