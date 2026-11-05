import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { recordAnalyticsConsent } from '../../src/server/analytics/consent-sync';
import type { APIContext } from 'astro';
import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ALL } from '../../src/pages/api/analytics/consent';

const mocks = vi.hoisted(() => ({
  identity: vi.fn(),
  upsert: vi.fn(),
  service: vi.fn(),
}));
vi.mock('../../src/server/support/store', () => ({
  supportService: mocks.service,
}));
vi.mock('../../src/server/auth/context', () => ({
  accountContext: () => ({
    config: { origin: 'https://duoly.gg' },
    names: { csrf: '__Host-duoly-csrf' },
    headers: new Headers({ 'Cache-Control': 'private, no-store' }),
    identity: mocks.identity,
    json: (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'private, no-store',
        },
      }),
  }),
}));
const csrf = 'a'.repeat(64);
const uid = '11111111-1111-4111-8111-111111111111';
function context(
  options: {
    cookie?: string;
    body?: unknown;
    origin?: string | null;
    token?: string | null;
    method?: string;
  } = {},
) {
  const headers = new Headers();
  if (options.origin !== null)
    headers.set('Origin', options.origin ?? 'https://duoly.gg');
  if (options.token !== null)
    headers.set('X-CSRF-Token', options.token ?? csrf);
  const request = new Request('https://duoly.gg/api/analytics/consent', {
    method: options.method ?? 'POST',
    headers,
    ...(options.body === undefined
      ? {}
      : { body: JSON.stringify(options.body) }),
  });
  return {
    request,
    cookies: {
      get: (name: string) =>
        name === '__Host-duoly-csrf'
          ? { value: csrf }
          : name === 'duoly-consent' && options.cookie !== undefined
            ? { value: options.cookie }
            : undefined,
    },
  } as unknown as APIContext;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.identity.mockResolvedValue({ viewer: { id: uid } });
  mocks.upsert.mockResolvedValue({ error: null });
  mocks.service.mockReturnValue({
    from: vi.fn(() => ({ upsert: mocks.upsert })),
  } as unknown as SupabaseClient);
});
describe('analytics consent migration (source contract, not database acceptance)', () => {
  const file = 'supabase/migrations/20261106100000_analytics_consent.sql';
  it('isolates account snapshots to the service role', () => {
    const sql = readFileSync(file, 'utf8')
      .replace(/--[^\n]*/g, '')
      .replace(/\s+/g, ' ')
      .toLowerCase();
    expect(sql).toContain(
      'user_id uuid primary key references auth.users(id) on delete cascade',
    );
    expect(sql).toContain('analytics boolean not null');
    expect(sql).toContain('marketing boolean not null');
    expect(sql).toContain('updated_at timestamptz not null default now()');
    expect(sql).toContain(
      'alter table public.analytics_consent enable row level security',
    );
    expect(sql).toContain(
      'revoke all on table public.analytics_consent from public, anon, authenticated',
    );
    expect(sql).toContain(
      'grant select, insert, update, delete on table public.analytics_consent to service_role',
    );
    expect(sql).not.toMatch(/grant[^;]*to[^;]*(?:public|anon|authenticated)/);
    expect(sql).not.toContain('create policy');
  });
  // Branch-local guard: CI checkouts have no origin/main, so it runs only where the ref exists.
  // Three-dot diff (since the merge base) so later migrations on main never fail it.
  const hasMain = (() => {
    try {
      execFileSync('git', ['rev-parse', '--verify', '--quiet', 'origin/main'], {
        stdio: 'ignore',
      });
      return true;
    } catch {
      return false;
    }
  })();
  it.skipIf(!hasMain)(
    'adds this migration and modifies no existing one',
    () => {
      const diff = (filter: string) =>
        execFileSync(
          'git',
          [
            'diff',
            '--name-only',
            filter,
            'origin/main...HEAD',
            '--',
            'supabase/migrations',
          ],
          { encoding: 'utf8' },
        ).trim();
      expect(diff('--diff-filter=MDR')).toBe('');
      expect(diff('--diff-filter=A').split('\n')).toContain(file);
    },
  );
});

describe('analytics consent endpoint', () => {
  it.each([undefined, '', 'invalid', 'v2.a2.m1.r1'])(
    'does not write missing or invalid consent: %s',
    async (cookie) => {
      const response = await ALL(context({ cookie }));
      expect(response.status).toBe(204);
      expect(await response.text()).toBe('');
      expect(response.headers.get('cache-control')).toContain('no-store');
      expect(mocks.service).not.toHaveBeenCalled();
      expect(mocks.upsert).not.toHaveBeenCalled();
    },
  );
  it.each([
    ['v2.a1.m0.r1', true, false],
    ['v2.a0.m1.r0', false, true],
    ['v2.a0.m0.r0', false, false],
    ['v2.a1.m1.r0', true, true],
    ['all', false, false],
  ] as const)(
    'upserts only parsed cookie purposes: %s',
    async (cookie, analytics, marketing) => {
      const response = await ALL(
        context({
          cookie,
          body: {
            user_id: 'attacker',
            analytics: !analytics,
            marketing: !marketing,
            csrf: 'wrong',
          },
        }),
      );
      expect(response.status).toBe(204);
      expect(await response.text()).toBe('');
      expect(mocks.service().from).toHaveBeenCalledWith('analytics_consent');
      expect(mocks.upsert).toHaveBeenCalledExactlyOnceWith(
        { user_id: uid, analytics, marketing, updated_at: expect.any(String) },
        { onConflict: 'user_id' },
      );
      expect(
        Number.isFinite(Date.parse(mocks.upsert.mock.calls[0]![0].updated_at)),
      ).toBe(true);
    },
  );
  it.each([
    { origin: 'https://evil.example' },
    { origin: null },
    { origin: 'null' },
    { token: null },
    { token: 'b'.repeat(64) },
  ])('rejects invalid Origin or CSRF: %j', async (options) => {
    const response = await ALL(context({ cookie: 'v2.a1.m1.r1', ...options }));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: 'Request could not be verified. Reload and try again.',
    });
    expect(mocks.identity).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it('rejects other methods with JSON and Allow', async () => {
    const response = await ALL(context({ method: 'GET' }));
    expect(response.status).toBe(405);
    expect(response.headers.get('Allow')).toBe('POST');
    expect(await response.json()).toEqual({ error: 'Method not allowed.' });
  });
  it.each(['returned', 'thrown', 'unconfigured'])(
    'swallows and logs service failure: %s',
    async (kind) => {
      const log = vi.spyOn(console, 'error').mockImplementation(() => {});
      if (kind === 'returned')
        mocks.upsert.mockResolvedValue({ error: { message: 'secret' } });
      if (kind === 'thrown')
        mocks.upsert.mockRejectedValue(new Error('secret'));
      if (kind === 'unconfigured') mocks.service.mockReturnValue(null);
      const response = await ALL(context({ cookie: 'v2.a1.m1.r1' }));
      expect(response.status).toBe(204);
      expect(log).toHaveBeenCalledExactlyOnceWith(
        'Analytics consent snapshot could not be recorded.',
      );
      log.mockRestore();
    },
  );
  it('refreshes updated_at on every snapshot', async () => {
    vi.useFakeTimers();
    try {
      const state = {
        version: 2 as const,
        analytics: false,
        marketing: true,
        referral: true,
      };
      vi.setSystemTime(new Date('2026-11-06T10:00:00Z'));
      await recordAnalyticsConsent(mocks.service(), uid, state);
      vi.setSystemTime(new Date('2026-11-06T11:00:00Z'));
      await recordAnalyticsConsent(mocks.service(), uid, state);
      expect(mocks.upsert.mock.calls.map(([row]) => row.updated_at)).toEqual([
        '2026-11-06T10:00:00.000Z',
        '2026-11-06T11:00:00.000Z',
      ]);
    } finally {
      vi.useRealTimers();
    }
  });
  it('requires a signed-in viewer', async () => {
    mocks.identity.mockResolvedValue(null);
    const response = await ALL(context({ cookie: 'v2.a1.m1.r1' }));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: 'Authentication required.',
    });
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});
