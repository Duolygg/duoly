import { readFileSync } from 'node:fs';
import type { APIContext } from 'astro';
import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { accountContext } from '../../src/server/auth/context';
import {
  getAdminPush,
  postAdminPush,
} from '../../src/server/support/push-handlers';
import {
  isPushEndpoint,
  sendSupportPush,
  supportPushPayload,
} from '../../src/server/support/push';
import {
  adminManifest,
  adminOnly,
  adminServiceWorker,
} from '../../src/server/support/admin-app';

// Phone alerts for the admin support inbox (migration 20261110190000_admin_push_subscriptions.sql).
vi.mock('../../src/server/auth/context', () => ({ accountContext: vi.fn() }));
const rpc = vi.fn();
const csrf = 'a'.repeat(64);
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
const ctx = (path: string, body?: Record<string, unknown>) => {
  const request = new Request(
    'http://localhost' + path,
    body
      ? {
          method: 'POST',
          headers: {
            origin: 'http://localhost',
            'content-type': 'application/json',
          },
          body: JSON.stringify({ csrf, ...body }),
        }
      : undefined,
  );
  return {
    request,
    url: new URL(request.url),
    cookies: { get: () => ({ value: csrf }) },
  } as unknown as APIContext;
};
function as(
  role: 'admin' | 'customer' | 'teammate' | null,
  access: unknown = { owner: false, sections: ['support'] },
) {
  rpc.mockImplementation(async (fn: string) =>
    fn === 'admin_me'
      ? { data: access, error: null }
      : { data: { subscribed: fn === 'admin_push_subscribe' }, error: null },
  );
  vi.mocked(accountContext).mockReturnValue({
    client: { rpc },
    identity: vi.fn(async () => (role ? { viewer: { role } } : null)),
    json,
    config: { origin: 'http://localhost' },
    names: { csrf: 'csrf' },
  } as unknown as ReturnType<typeof accountContext>);
}
const subscription = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/abc123def456ghi789',
  keys: { p256dh: 'B'.repeat(87), auth: 'x'.repeat(22) },
};
beforeEach(() => {
  vi.resetAllMocks();
  process.env.WEB_PUSH_PUBLIC_KEY = 'public-key';
  process.env.WEB_PUSH_PRIVATE_KEY = 'private-key';
});
afterEach(() => {
  delete process.env.WEB_PUSH_PUBLIC_KEY;
  delete process.env.WEB_PUSH_PRIVATE_KEY;
});

describe('only admins can turn on phone alerts', () => {
  for (const role of ['customer', 'teammate'] as const) {
    it(`hides the API from a ${role}`, async () => {
      as(role);
      expect((await getAdminPush(ctx('/api/admin/push'))).status).toBe(404);
      const res = await postAdminPush(
        ctx('/api/admin/push', { action: 'subscribe', subscription }),
      );
      expect(res.status).toBe(404);
      expect(rpc).not.toHaveBeenCalled();
    });
  }
  it('asks signed-out visitors to sign in and saves nothing', async () => {
    as(null);
    expect((await getAdminPush(ctx('/api/admin/push'))).status).toBe(401);
    expect(
      (
        await postAdminPush(
          ctx('/api/admin/push', { action: 'subscribe', subscription }),
        )
      ).status,
    ).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('hides it from an admin without the Support section', async () => {
    as('admin', { owner: false, sections: ['live'] });
    expect((await getAdminPush(ctx('/api/admin/push'))).status).toBe(404);
  });
  it('gives an admin with Support the public key and saves their phone', async () => {
    as('admin');
    const got = await getAdminPush(ctx('/api/admin/push'));
    expect(await got.json()).toEqual({
      enabled: true,
      publicKey: 'public-key',
    });
    const saved = await postAdminPush(
      ctx('/api/admin/push', {
        action: 'subscribe',
        subscription,
        device: 'iPhone app',
      }),
    );
    expect(saved.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('admin_push_subscribe', {
      p_endpoint: subscription.endpoint,
      p_p256dh: subscription.keys.p256dh,
      p_auth: subscription.keys.auth,
      p_device: 'iPhone app',
    });
  });
  it('passes on the database refusal for an admin without Support', async () => {
    as('admin');
    rpc.mockResolvedValue({
      data: { error: { code: 403, message: 'Admins only.' } },
      error: null,
    });
    const res = await postAdminPush(
      ctx('/api/admin/push', { action: 'subscribe', subscription }),
    );
    expect(res.status).toBe(403);
  });
  it('rejects a request without the CSRF token', async () => {
    as('admin');
    const request = new Request('http://localhost/api/admin/push', {
      method: 'POST',
      headers: {
        origin: 'http://localhost',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ action: 'subscribe', subscription }),
    });
    const res = await postAdminPush({
      request,
      url: new URL(request.url),
      cookies: { get: () => ({ value: csrf }) },
    } as unknown as APIContext);
    expect(res.status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('only accepts real browser push services', async () => {
    as('admin');
    for (const endpoint of [
      'http://fcm.googleapis.com/fcm/send/abc123def456',
      'https://evil.example.com/fcm/send/abc123def456',
      'https://fcm.googleapis.com.evil.com/send/abc123def456',
      'https://user:pw@fcm.googleapis.com/fcm/send/abc123',
      'https://fcm.googleapis.com:8443/fcm/send/abc123def456',
    ]) {
      expect(isPushEndpoint(endpoint)).toBe(false);
      const res = await postAdminPush(
        ctx('/api/admin/push', {
          action: 'subscribe',
          subscription: { ...subscription, endpoint },
        }),
      );
      expect(res.status).toBe(400);
    }
    for (const endpoint of [
      subscription.endpoint,
      'https://web.push.apple.com/QGx1234567890abcdef',
      'https://updates.push.services.mozilla.com/wpush/v2/abc123',
      'https://wns2-par02p.notify.windows.com/w/?token=abc',
    ])
      expect(isPushEndpoint(endpoint)).toBe(true);
    expect(rpc).not.toHaveBeenCalledWith(
      'admin_push_subscribe',
      expect.anything(),
    );
  });
  it('says so when the server has no keys yet', async () => {
    delete process.env.WEB_PUSH_PUBLIC_KEY;
    as('admin');
    const got = await getAdminPush(ctx('/api/admin/push'));
    expect(await got.json()).toEqual({ enabled: false, publicKey: '' });
    const res = await postAdminPush(
      ctx('/api/admin/push', { action: 'subscribe', subscription }),
    );
    expect(res.status).toBe(503);
  });
});

describe('sending alerts', () => {
  const config = { publicKey: 'p', privateKey: 'k', subject: 'mailto:x@y.z' };
  const service = (rows: unknown[]) => {
    const eq = vi.fn(async () => ({ error: null }));
    const del = vi.fn(() => ({ eq }));
    const svc = {
      rpc: vi.fn(async () => ({ data: rows, error: null })),
      from: vi.fn(() => ({ delete: del })),
    };
    return { svc: svc as unknown as SupabaseClient, raw: svc, eq };
  };
  const id = '11111111-2222-4333-8444-555555555555';
  it('asks the database who may get alerts and sends only to them', async () => {
    const { svc, raw } = service([
      { endpoint: subscription.endpoint, p256dh: 'p', auth: 'a' },
      {
        endpoint: 'https://evil.example.com/x/abcdefghijklmnop',
        p256dh: 'p',
        auth: 'a',
      },
    ]);
    const send = vi.fn(async () => ({}));
    const sent = await sendSupportPush(
      svc,
      {
        conversationId: id,
        title: 'Customer Alex needs a human',
        body: 'Help',
      },
      { config, send },
    );
    expect(raw.rpc).toHaveBeenCalledWith('admin_push_targets');
    expect(sent).toBe(1);
    expect(send).toHaveBeenCalledTimes(1);
    const payload = JSON.parse((send.mock.calls[0] as unknown[])[1] as string);
    expect(payload).toEqual({
      title: 'Customer Alex needs a human',
      body: 'Help',
      tag: `duoly-support-${id}`,
      url: `/admin/support?chat=${id}`,
    });
  });
  it('forgets phones the push service says are gone', async () => {
    const { svc, eq } = service([
      { endpoint: subscription.endpoint, p256dh: 'p', auth: 'a' },
    ]);
    const send = vi.fn(async () => {
      throw Object.assign(new Error('gone'), { statusCode: 410 });
    });
    expect(
      await sendSupportPush(
        svc,
        { conversationId: id, title: 't', body: 'b' },
        { config, send },
      ),
    ).toBe(0);
    expect(eq).toHaveBeenCalledWith('endpoint', subscription.endpoint);
  });
  it('does nothing without server keys', async () => {
    const { svc, raw } = service([]);
    expect(
      await sendSupportPush(
        svc,
        { conversationId: id, title: 't', body: 'b' },
        { config: null },
      ),
    ).toBe(0);
    expect(raw.rpc).not.toHaveBeenCalled();
  });
  it('always links inside the admin support inbox', () => {
    expect(
      supportPushPayload({
        conversationId: 'javascript:alert(1)',
        title: '',
        body: '',
      }),
    ).toMatchObject({ url: '/admin/support', title: 'Duoly support' });
  });
});

describe('the Duoly Admin app files', () => {
  it('are served to admins only', async () => {
    for (const role of ['customer', 'teammate', null] as const) {
      as(role);
      const res = await adminOnly(
        ctx('/admin/sw.js'),
        adminServiceWorker,
        'text/javascript',
      );
      expect(res.status).toBe(404);
      expect(await res.text()).not.toContain('showNotification');
    }
    as('admin');
    const res = await adminOnly(
      ctx('/admin/app.webmanifest'),
      adminManifest,
      'application/manifest+json',
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('private');
    const manifest = await res.json();
    expect(manifest.scope).toBe('/admin/');
    expect(manifest.start_url).toBe('/admin/support');
  });
  it('the service worker only opens the support inbox', () => {
    const sw = adminServiceWorker();
    expect(sw).toContain("url.pathname === '/admin/support'");
    expect(sw).toContain('url.origin === self.location.origin');
  });
});

describe('the database rules', () => {
  const sql = readFileSync(
    'supabase/migrations/20261110190000_admin_push_subscriptions.sql',
    'utf8',
  );
  it('keeps the table closed to signed-in users', () => {
    expect(sql).toContain('enable row level security');
    expect(sql).toMatch(
      /revoke all on table public\.admin_push_subscriptions from public, anon, authenticated, service_role;/,
    );
    expect(sql).not.toMatch(
      /grant [^;]* on table public\.admin_push_subscriptions to (anon|authenticated)/,
    );
  });
  it('lets only admins with Support save a phone', () => {
    expect(sql).toMatch(
      /admin_push_subscribe[\s\S]*?admin_caller_for\('support'\)[\s\S]*?order_error\(403/,
    );
  });
  it('checks the role and Support again at send time, for the server only', () => {
    expect(sql).toMatch(/r\.role = 'admin'/);
    expect(sql).toMatch(
      /admin_sections_of\(s\.user_id\) && array\['support'\]/,
    );
    expect(sql).toMatch(
      /revoke all on function public\.admin_push_targets\(\) from public, anon, authenticated;/,
    );
    expect(sql).toMatch(
      /grant execute on function public\.admin_push_targets\(\) to service_role;/,
    );
  });
});
