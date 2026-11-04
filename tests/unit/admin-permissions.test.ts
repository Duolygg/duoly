import { readFileSync } from 'node:fs';
import type { APIContext } from 'astro';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { accountContext } from '../../src/server/auth/context';
import { customers, overview, users } from '../../src/server/admin/handlers';
import {
  ADMIN_SECTIONS,
  DEFAULT_ADMIN_SECTIONS,
  canUse,
} from '../../src/contracts/admin-access';
import { SetPermissionsSchema } from '../../src/contracts/admin';
import { NO_SECTION_ACCESS } from '../../src/server/admin/access';

// Admin permissions per dashboard section (migration 20261105130000_admin_permissions.sql).
vi.mock('../../src/server/auth/context', () => ({ accountContext: vi.fn() }));
const rpc = vi.fn();
const csrf = 'a'.repeat(64);
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
const get = (path: string) => {
  const request = new Request('http://localhost' + path);
  return {
    request,
    url: new URL(request.url),
    cookies: { get: () => ({ value: csrf }) },
  } as unknown as APIContext;
};
const post = (path: string, body: Record<string, unknown>) => {
  const request = new Request('http://localhost' + path, {
    method: 'POST',
    headers: { origin: 'http://localhost', 'content-type': 'application/json' },
    body: JSON.stringify({ csrf, ...body }),
  });
  return {
    request,
    url: new URL(request.url),
    cookies: { get: () => ({ value: csrf }) },
  } as unknown as APIContext;
};
function asAdmin(access: unknown) {
  rpc.mockImplementation(async (fn: string) =>
    fn === 'admin_me'
      ? { data: access, error: null }
      : { data: { ok: true }, error: null },
  );
  vi.mocked(accountContext).mockReturnValue({
    client: { rpc },
    identity: vi.fn(async () => ({ viewer: { role: 'admin' } })),
    json,
    config: { origin: 'http://localhost' },
    names: { csrf: 'csrf' },
  } as unknown as ReturnType<typeof accountContext>);
}
beforeEach(() => vi.resetAllMocks());

describe('who can use what', () => {
  it('gives owners everything and others only their sections', () => {
    const owner = { owner: true, sections: [] };
    const admin = { owner: false, sections: [...DEFAULT_ADMIN_SECTIONS] };
    for (const s of ADMIN_SECTIONS) expect(canUse(owner, [s])).toBe(true);
    expect(canUse(admin, ['live'])).toBe(true);
    expect(canUse(admin, ['payouts'])).toBe(false);
    expect(canUse(admin, ['orders', 'live'])).toBe(true); // any one is enough
    expect(canUse(null, ['live'])).toBe(false);
  });
  it('starts new admins without orders, payouts, customers and creators', () => {
    for (const s of ['orders', 'payouts', 'customers', 'creators'] as const)
      expect(DEFAULT_ADMIN_SECTIONS).not.toContain(s);
    for (const s of [
      'overview',
      'live',
      'priority',
      'performance',
      'teammates',
      'users',
      'support',
      'safety',
      'audit',
      'settings',
    ] as const)
      expect(DEFAULT_ADMIN_SECTIONS).toContain(s);
  });
  it('accepts only known sections, once each', () => {
    const base = { csrf, userId: '00000000-0000-4000-8000-000000000001' };
    expect(
      SetPermissionsSchema.safeParse({ ...base, permissions: ['live'] })
        .success,
    ).toBe(true);
    expect(
      SetPermissionsSchema.safeParse({ ...base, permissions: ['root'] })
        .success,
    ).toBe(false);
    expect(
      SetPermissionsSchema.safeParse({ ...base, permissions: ['live', 'live'] })
        .success,
    ).toBe(false);
  });
});

describe('admin endpoints', () => {
  const admin = { owner: false, sections: [...DEFAULT_ADMIN_SECTIONS] };
  it('refuses a section the admin does not have, before any admin RPC', async () => {
    asAdmin(admin);
    const response = (await customers(get('/api/admin/customers'))) as Response;
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: NO_SECTION_ACCESS });
    expect(rpc).toHaveBeenCalledExactlyOnceWith('admin_me');
  });
  it('serves a section the admin has', async () => {
    asAdmin(admin);
    const response = (await overview(get('/api/admin/overview'))) as Response;
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenLastCalledWith('admin_overview');
  });
  it('treats an unreadable access as no access', async () => {
    asAdmin(null);
    const response = (await overview(get('/api/admin/overview'))) as Response;
    expect(response.status).toBe(403);
  });
  it('sends permission changes to the owner-only RPC', async () => {
    asAdmin({ owner: true, sections: [] });
    const userId = '00000000-0000-4000-8000-000000000002';
    const response = (await users(
      post('/api/admin/users', { userId, permissions: ['live', 'orders'] }),
    )) as Response;
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenLastCalledWith('admin_set_permissions', {
      p_user_id: userId,
      p_sections: ['live', 'orders'],
    });
  });
});

describe('migration', () => {
  const sql = readFileSync(
    'supabase/migrations/20261105130000_admin_permissions.sql',
    'utf8',
  );
  it('rewrites every admin function and stops if one changed', () => {
    expect(sql).toContain('if v_done <> 48 then raise exception');
    expect(sql).toContain('calls public.admin_caller() % times (expected 1)');
  });
  it('keeps admins and permissions owner-only', () => {
    expect(sql).toContain(
      'Only owners can make someone admin or change an admin.',
    );
    expect(sql).toContain('Only owners can change what admins can see.');
    expect(sql).toContain("'admin_refund_order', '{orders}'");
    expect(sql).toContain("'admin_teammate_adjust', '{payouts}'");
  });
  it('the database defaults match the app', () => {
    const list = sql.match(
      /admin_default_sections\(\) returns text\[\][\s\S]*?array\[([^\]]+)\]/,
    )![1]!;
    expect(list.replace(/'|\s/g, '').split(',')).toEqual(
      DEFAULT_ADMIN_SECTIONS,
    );
  });
});
