import type { APIContext, AstroCookies } from 'astro';
import { createServerClient } from '@supabase/ssr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { callback } from '../../src/server/auth/handlers';
import {
  connect,
  disconnect,
  TEAMMATE_STAYS_CONNECTED,
} from '../../src/server/discord/link';
import {
  discordReturn,
  isDiscordAuthorizeUrl,
  linkErrorResult,
} from '../../src/server/discord/oauth';
import { syncRolesAfter } from '../../src/server/discord/role-hooks';

vi.mock('../../src/server/discord/role-hooks', () => ({
  syncRolesAfter: vi.fn(async () => undefined),
}));

vi.mock('@supabase/ssr', async (original) => ({
  ...(await original<typeof import('@supabase/ssr')>()),
  createServerClient: vi.fn(),
}));

const USER = 'a1100000-0000-4000-8000-000000000001';
const SUPA = 'https://example.supabase.co';

beforeEach(() => {
  for (const [name, value] of Object.entries({
    AUTH_ENABLED: 'true',
    AUTH_ORIGIN: 'http://localhost:4321',
    AUTH_DISCORD_ENABLED: 'true',
    SUPABASE_URL: SUPA,
    SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
    AUTH_COOKIE_SECRET: 's'.repeat(32),
  }))
    vi.stubEnv(name, value);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('oauth helpers', () => {
  it('only allows Supabase or Discord authorize URLs', () => {
    expect(
      isDiscordAuthorizeUrl(
        'https://discord.com/oauth2/authorize?client_id=1',
        SUPA,
      ),
    ).toBe(true);
    expect(isDiscordAuthorizeUrl(`${SUPA}/auth/v1/authorize?x=1`, SUPA)).toBe(
      true,
    );
    expect(
      isDiscordAuthorizeUrl('https://evil.example/oauth2/authorize', SUPA),
    ).toBe(false);
    expect(
      isDiscordAuthorizeUrl('http://discord.com/oauth2/authorize', SUPA),
    ).toBe(false);
    expect(isDiscordAuthorizeUrl('not a url', SUPA)).toBe(false);
  });
  it('maps link errors and return targets', () => {
    expect(
      linkErrorResult(
        new URLSearchParams(
          'error=server_error&error_code=identity_already_exists',
        ),
      ),
    ).toBe('taken');
    expect(linkErrorResult(new URLSearchParams('error=access_denied'))).toBe(
      'cancelled',
    );
    expect(linkErrorResult(new URLSearchParams('error=x'))).toBe('failed');
    expect(discordReturn('teammate')).toBe('teammate');
    expect(discordReturn('https://evil.example')).toBe('profile');
  });
});

function setup({
  identities = [{ provider: 'google' }, { provider: 'discord' }],
  linkUrl = 'https://discord.com/oauth2/authorize?client_id=1',
  role = 'teammate',
}: {
  identities?: { provider: string }[];
  linkUrl?: string;
  role?: 'customer' | 'teammate' | 'admin';
} = {}) {
  const values = new Map<string, string>([
    ['duoly-csrf', 'c'.repeat(64)],
    ['duoly-session.0', 'session'],
  ]);
  const cookies = {
    get: vi.fn((name: string) =>
      values.has(name) ? { value: values.get(name) } : undefined,
    ),
    set: vi.fn((name: string, value: string) => void values.set(name, value)),
    delete: vi.fn((name: string) => void values.delete(name)),
  };
  const row = (table: string) =>
    table === 'account_roles'
      ? { role }
      : table === 'discord_accounts'
        ? null
        : { id: USER, name: 'Player', country: '', image: '' };
  const from = vi.fn((table: string) => ({
    select: () => ({
      eq: () => ({
        single: async () => ({ data: row(table), error: null }),
        maybeSingle: async () => ({ data: row(table), error: null }),
      }),
    }),
  }));
  const linkIdentity = vi.fn(async () => ({
    data: { provider: 'discord', url: linkUrl },
    error: null,
  }));
  const unlinkIdentity = vi.fn(async () => ({ data: {}, error: null }));
  const auth = {
    getUser: vi.fn(async () => ({
      data: {
        user: {
          id: USER,
          email: 'p@example.com',
          app_metadata: { provider: 'google' },
          identities,
        },
      },
      error: null,
    })),
    linkIdentity,
    unlinkIdentity,
    getUserIdentities: vi.fn(async () => ({
      data: { identities },
      error: null,
    })),
    exchangeCodeForSession: vi.fn(async () => ({ error: null })),
    signOut: vi.fn(async () => ({ error: null })),
  };
  vi.mocked(createServerClient).mockImplementation(
    () => ({ auth, from }) as unknown as ReturnType<typeof createServerClient>,
  );
  const post = (
    handler: typeof connect,
    body: string,
    type = 'application/x-www-form-urlencoded',
  ) => {
    const url = new URL('http://localhost:4321/api/discord/link');
    return handler({
      request: new Request(url, {
        method: 'POST',
        headers: {
          'content-type': type,
          origin: 'http://localhost:4321',
          cookie: 'duoly-session.0=session; duoly-csrf=' + 'c'.repeat(64),
        },
        body,
      }),
      url,
      cookies: cookies as unknown as AstroCookies,
    } as APIContext) as Promise<Response>;
  };
  const back = (path: string) => {
    const url = new URL(path, 'http://localhost:4321');
    return callback({
      request: new Request(url, {
        headers: { cookie: 'duoly-session.0=session' },
      }),
      url,
      cookies: cookies as unknown as AstroCookies,
    } as APIContext) as Promise<Response>;
  };
  return { post, back, auth, linkIdentity, unlinkIdentity };
}

describe('connect', () => {
  it('starts a verified identity link and returns to the teammate desk', async () => {
    const s = setup();
    const res = await s.post(connect, `csrf=${'c'.repeat(64)}&next=teammate`);
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toMatch(/^https:\/\/discord\.com\//);
    expect(s.linkIdentity).toHaveBeenCalledWith({
      provider: 'discord',
      options: expect.objectContaining({
        redirectTo: 'http://localhost:4321/auth/callback?next=teammate',
        skipBrowserRedirect: true,
        scopes: 'identify',
      }),
    });
  });
  it('rejects a bad CSRF token without contacting Supabase', async () => {
    const s = setup();
    const res = await s.post(connect, `csrf=${'d'.repeat(64)}&next=profile`);
    expect(res.headers.get('location')).toBe('/profile?discord=failed');
    expect(s.linkIdentity).not.toHaveBeenCalled();
  });
  it('refuses an unexpected redirect target', async () => {
    const s = setup({ linkUrl: 'https://evil.example/oauth2/authorize' });
    const res = await s.post(connect, `csrf=${'c'.repeat(64)}`);
    expect(res.headers.get('location')).toBe('/profile?discord=failed');
  });
  it('reports unavailable when Discord is switched off', async () => {
    vi.stubEnv('AUTH_DISCORD_ENABLED', 'false');
    const s = setup();
    const res = await s.post(connect, `csrf=${'c'.repeat(64)}`);
    expect(res.headers.get('location')).toBe('/profile?discord=unavailable');
  });
});

describe('callback while linking', () => {
  it('returns to the chosen page after linking', async () => {
    const s = setup();
    const res = await s.back('/auth/callback?code=abc&next=teammate');
    expect(res.headers.get('location')).toBe('/teammate?discord=linked');
    // A teammate who just linked gets the Discord server roles right away (#40).
    expect(syncRolesAfter).toHaveBeenCalledExactlyOnceWith({ users: [USER] });
  });
  it('reports a Discord account used elsewhere as taken', async () => {
    const s = setup();
    const res = await s.back(
      '/auth/callback?next=profile&error=server_error&error_code=identity_already_exists',
    );
    expect(res.headers.get('location')).toBe('/profile?discord=taken');
    expect(s.auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });
  it('ignores unknown next values', async () => {
    const s = setup();
    const res = await s.back('/auth/callback?code=abc&next=//evil.example');
    expect(res.headers.get('location')).toBe('/dashboard');
  });
});

describe('disconnect', () => {
  it('unlinks an admin’s Discord when another sign-in method exists', async () => {
    const s = setup({ role: 'admin' });
    const res = await s.post(
      disconnect,
      JSON.stringify({ csrf: 'c'.repeat(64) }),
      'application/json',
    );
    expect(res.status).toBe(200);
    expect(s.unlinkIdentity).toHaveBeenCalledWith({ provider: 'discord' });
    expect(syncRolesAfter).toHaveBeenCalledExactlyOnceWith({ users: [USER] });
  });
  it('lets customers disconnect too', async () => {
    const s = setup({ role: 'customer' });
    const res = await s.post(
      disconnect,
      JSON.stringify({ csrf: 'c'.repeat(64) }),
      'application/json',
    );
    expect(res.status).toBe(200);
    expect(s.unlinkIdentity).toHaveBeenCalledWith({ provider: 'discord' });
  });
  it('never lets a teammate disconnect', async () => {
    const s = setup({ role: 'teammate' });
    const res = await s.post(
      disconnect,
      JSON.stringify({ csrf: 'c'.repeat(64) }),
      'application/json',
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: TEAMMATE_STAYS_CONNECTED });
    expect(s.unlinkIdentity).not.toHaveBeenCalled();
    expect(syncRolesAfter).not.toHaveBeenCalled();
  });
  it('keeps Discord when it is the only sign-in method', async () => {
    const s = setup({ identities: [{ provider: 'discord' }], role: 'admin' });
    const res = await s.post(
      disconnect,
      JSON.stringify({ csrf: 'c'.repeat(64) }),
      'application/json',
    );
    expect(res.status).toBe(409);
    expect(s.unlinkIdentity).not.toHaveBeenCalled();
    expect(syncRolesAfter).not.toHaveBeenCalled();
  });
});
