import { existsSync } from 'node:fs';
import type { APIContext, AstroCookies } from 'astro';
import { createServerClient } from '@supabase/ssr';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import * as handlers from '../../src/server/auth/handlers';
import { authConfig } from '../../src/server/auth/config';
const { callback } = handlers;

// Keep request-local cookies, configuration and identity filtering real; only
// replace the external provider so these tests cannot contact Supabase.
vi.mock('@supabase/ssr', async (original) => ({
  ...(await original<typeof import('@supabase/ssr')>()),
  createServerClient: vi.fn(),
}));

beforeEach(() => {
  for (const [name, value] of Object.entries({
    AUTH_ENABLED: 'true',
    AUTH_ORIGIN: 'http://localhost:4321',
    AUTH_EMAIL_ENABLED: 'true',
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
    AUTH_COOKIE_SECRET: 's'.repeat(32),
    AUTH_TEST_EMAIL: 'approved@example.com',
  }))
    vi.stubEnv(name, value);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

function setup({
  email = 'approved@example.com',
  signOutThrows = false,
  exchangeError = false,
}: {
  email?: string | null;
  signOutThrows?: boolean;
  exchangeError?: boolean;
} = {}) {
  const values = new Map<string, string>([['duoly-csrf', 'csrf-token']]);
  const cookies = {
    get: vi.fn((name: string) =>
      values.has(name) ? { value: values.get(name) } : undefined,
    ),
    set: vi.fn((name: string, value: string) => {
      values.set(name, value);
    }),
    delete: vi.fn((name: string) => {
      values.delete(name);
    }),
  };
  const getUser = vi.fn(async () => ({
    data: {
      user:
        email === null
          ? null
          : {
              id: 'a1100000-0000-4000-8000-000000000001',
              email,
              app_metadata: { provider: 'google' },
            },
    },
    error: null,
  }));
  const signOut = vi.fn(async () => {
    if (signOutThrows) throw new Error('Provider unavailable');
    return { error: null };
  });
  const from = vi.fn((table: string) => ({
    select: () => ({
      eq: () => ({
        single: async () => ({
          data:
            table === 'account_roles'
              ? { role: 'customer' }
              : {
                  id: 'a1100000-0000-4000-8000-000000000001',
                  name: 'Player',
                  country: '',
                  image: '',
                },
          error: null,
        }),
      }),
    }),
  }));
  const exchange = vi.fn();
  vi.mocked(createServerClient).mockImplementation((_url, _key, options) => {
    const cookieAdapter = options.cookies as {
      setAll: (
        changes: { name: string; value: string; options: { path: string } }[],
        headers: Record<string, string>,
      ) => void;
    };
    exchange.mockImplementation(async () => {
      if (exchangeError) return { error: new Error('Invalid PKCE code') };
      cookieAdapter.setAll(
        [
          {
            name: 'duoly-session.0',
            value: 'provider-session',
            options: { path: '/' },
          },
          {
            name: 'duoly-session.1',
            value: 'provider-session-chunk',
            options: { path: '/' },
          },
        ],
        {},
      );
      return { error: null };
    });
    return {
      auth: { exchangeCodeForSession: exchange, getUser, signOut },
      from,
    } as unknown as ReturnType<typeof createServerClient>;
  });
  const run = async (
    path = '/auth/callback?code=valid-pkce-code',
    origin = 'http://localhost:4321',
  ) => {
    const url = new URL(path, origin);
    return (await callback({
      request: new Request(url),
      url,
      cookies: cookies as unknown as AstroCookies,
    } as APIContext)) as Response;
  };
  return { run, values, cookies, exchange, getUser, signOut, from };
}

it.each([
  { email: 'disallowed@example.com', signOutThrows: false },
  { email: null, signOutThrows: false },
  { email: 'disallowed@example.com', signOutThrows: true },
  { email: null, signOutThrows: true },
])(
  'clears exchanged session when identity is rejected ($email, signOutThrows=$signOutThrows)',
  async (options) => {
    const state = setup(options);
    const response = await state.run();
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('/login?error=callback');
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(state.exchange).toHaveBeenCalledWith('valid-pkce-code');
    expect(state.getUser).toHaveBeenCalledOnce();
    expect(state.signOut).toHaveBeenCalledWith({ scope: 'local' });
    for (const name of [
      'duoly-session.0',
      'duoly-session.1',
      'duoly-csrf',
      'duoly-pending-email',
      'duoly-email-cooldown',
    ]) {
      expect(state.cookies.delete).toHaveBeenCalledWith(
        name,
        expect.objectContaining({ httpOnly: true, path: '/', sameSite: 'lax' }),
      );
    }
    expect(state.values.size).toBe(0);
    expect(state.from).not.toHaveBeenCalled();
  },
);

it('accepts an approved PKCE identity and redirects without caching', async () => {
  const state = setup();
  const response = await state.run();
  expect(response.status).toBe(303);
  expect(response.headers.get('location')).toBe('/dashboard');
  expect(response.headers.get('cache-control')).toContain('no-store');
  expect(state.exchange).toHaveBeenCalledWith('valid-pkce-code');
  expect(state.getUser).toHaveBeenCalledOnce();
  expect(state.from).toHaveBeenCalledWith('profiles');
  expect(state.from).toHaveBeenCalledWith('account_roles');
  expect(state.cookies.delete).toHaveBeenCalledWith(
    'duoly-csrf',
    expect.any(Object),
  );
  expect(state.values.has('duoly-csrf')).toBe(false);
  expect(state.values.get('duoly-session.0')).toBe('provider-session');
  expect(state.signOut).not.toHaveBeenCalled();
});

it.each([
  '/auth/callback',
  '/auth/callback?code=',
  `/auth/callback?code=${'a'.repeat(2049)}`,
])(
  'rejects missing or oversized code without creating identity (%s)',
  async (path) => {
    const state = setup();
    const response = await state.run(path);
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('/login?error=callback');
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(state.exchange).not.toHaveBeenCalled();
    expect(state.getUser).not.toHaveBeenCalled();
    expect(state.cookies.set).not.toHaveBeenCalled();
  },
);

it('does not load or create an identity after an invalid PKCE exchange', async () => {
  const state = setup({ exchangeError: true });
  const response = await state.run('/auth/callback?code=invalid-code');
  expect(response.headers.get('location')).toBe('/login?error=callback');
  expect(response.headers.get('cache-control')).toContain('no-store');
  expect(state.exchange).toHaveBeenCalledWith('invalid-code');
  expect(state.getUser).not.toHaveBeenCalled();
  expect(state.cookies.set).not.toHaveBeenCalled();
});

it('rejects a callback on a different origin before exchanging the code', async () => {
  const state = setup();
  const response = await state.run(
    '/auth/callback?code=valid-pkce-code',
    'https://attacker.invalid',
  );
  expect(response.headers.get('location')).toBe('/login?error=callback');
  expect(response.headers.get('cache-control')).toContain('no-store');
  expect(state.exchange).not.toHaveBeenCalled();
  expect(state.getUser).not.toHaveBeenCalled();
  expect(state.cookies.set).not.toHaveBeenCalled();
});

it('has no OTP routes or handlers even when email/password sign-in is enabled', () => {
  expect(authConfig()?.providers.email).toBe(true);
  for (const action of ['request', 'verify']) {
    expect(
      existsSync(
        new URL(`../../src/pages/auth/email/${action}.ts`, import.meta.url),
      ),
    ).toBe(false);
  }
  expect(handlers).not.toHaveProperty('requestEmail');
  expect(handlers).not.toHaveProperty('verifyEmail');
});
