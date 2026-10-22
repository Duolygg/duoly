import type { APIContext, APIRoute } from 'astro';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PasswordCredentialsSchema } from '../../src/contracts/password';
import { accountContext } from '../../src/server/auth/context';
import {
  loginPassword,
  registerPassword,
} from '../../src/server/auth/password';

// The provider boundary (Supabase client) and cookie/session plumbing are
// injected through a mocked accountContext; no network is touched. The real
// mutation() from handlers.ts and the real readBoundedBody/verifyCsrf run, so
// CSRF and body bounding are genuinely exercised.
vi.mock('../../src/server/auth/context', () => ({ accountContext: vi.fn() }));

const CSRF = 'a'.repeat(64);
const ORIGIN = 'https://duoly.test';
const securityHeaders = {
  'Cache-Control': 'private, no-cache, no-store, must-revalidate, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
};

function fakeCookies(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  const deleted: string[] = [];
  return {
    store,
    deleted,
    get: (name: string) =>
      store.has(name) ? { value: store.get(name)! } : undefined,
    set: (name: string, value: string) => void store.set(name, value),
    delete: (name: string) => {
      store.delete(name);
      deleted.push(name);
    },
  };
}
type FakeCookies = ReturnType<typeof fakeCookies>;

function fakeAccount(overrides: Record<string, unknown> = {}) {
  return {
    config: {
      origin: ORIGIN,
      url: 'https://project.supabase.co',
      publishableKey: 'sb_publishable_test',
      signingKey: 's'.repeat(32),
      providers: { google: false, discord: false, email: true },
      signup: true,
      testEmail: undefined as string | undefined,
    },
    client: {
      auth: {
        signInWithPassword: vi.fn(),
        signUp: vi.fn(),
        signOut: vi.fn().mockResolvedValue({ error: null }),
      },
    },
    names: {
      csrf: 'duoly-csrf',
      pending: 'duoly-pending-email',
      session: 'duoly-session',
      cooldown: 'duoly-email-cooldown',
    },
    cookieOptions: {
      httpOnly: true,
      secure: true,
      sameSite: 'lax' as const,
      path: '/',
    },
    headers: new Headers(securityHeaders),
    csrf: vi.fn(() => CSRF),
    clear: vi.fn(),
    redirect: (location: string) =>
      new Response(null, {
        status: 303,
        headers: { ...securityHeaders, Location: location },
      }),
    json: (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: {
          ...securityHeaders,
          'Content-Type': 'application/json; charset=utf-8',
        },
      }),
    identity: vi.fn(),
    ...overrides,
  };
}
type FakeAccount = ReturnType<typeof fakeAccount>;

function post(
  fields: Record<string, unknown>,
  options: {
    csrf?: string | null;
    origin?: string;
    contentType?: string;
    raw?: string;
  } = {},
) {
  const body =
    options.raw ??
    JSON.stringify(
      options.csrf === null
        ? fields
        : { ...fields, csrf: options.csrf ?? CSRF },
    );
  return new Request(ORIGIN + '/auth/password', {
    method: 'POST',
    headers: {
      'content-type': options.contentType ?? 'application/json',
      origin: options.origin ?? ORIGIN,
    },
    body,
  });
}

async function call(
  route: APIRoute,
  account: FakeAccount,
  request: Request,
  cookies: FakeCookies = fakeCookies({ [account.names.csrf]: CSRF }),
) {
  vi.mocked(accountContext).mockReturnValue(
    account as unknown as ReturnType<typeof accountContext>,
  );
  const context = {
    request,
    cookies,
    url: new URL(request.url),
  } as unknown as APIContext;
  const response = await route(context);
  return { cookies, response };
}

function viewerIdentity(email = 'player@example.com') {
  const id = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
  return {
    viewer: {
      id,
      name: 'Player',
      email,
      image: '/assets/avatars/avatar-1.png',
      role: 'customer',
      provider: 'email',
    },
    profile: { id, name: 'Player', country: '', image: '' },
  };
}

const validCredentials = {
  email: 'player@example.com',
  password: 'correct horse battery',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PasswordCredentialsSchema', () => {
  it('normalizes email but never trims the password', () => {
    const parsed = PasswordCredentialsSchema.parse({
      email: '  PLAYER@example.com ',
      password: '  spaced pass  ',
    });
    expect(parsed.email).toBe('player@example.com');
    expect(parsed.password).toBe('  spaced pass  ');
  });
  it('bounds password length to 8..128 characters', () => {
    for (const password of ['x'.repeat(7), 'y'.repeat(129), 12345678, ''])
      expect(
        PasswordCredentialsSchema.safeParse({
          email: 'player@example.com',
          password,
        }).success,
      ).toBe(false);
    for (const password of ['x'.repeat(8), 'y'.repeat(128)])
      expect(
        PasswordCredentialsSchema.safeParse({
          email: 'player@example.com',
          password,
        }).success,
      ).toBe(true);
  });
  it('rejects unknown keys so csrf must be stripped by the caller', () => {
    expect(
      PasswordCredentialsSchema.safeParse({
        ...validCredentials,
        csrf: CSRF,
      }).success,
    ).toBe(false);
    expect(
      PasswordCredentialsSchema.safeParse({
        ...validCredentials,
        role: 'admin',
      }).success,
    ).toBe(false);
  });
});

describe('loginPassword', () => {
  it('rejects missing or mismatched CSRF and cross-origin posts before any provider call', async () => {
    const account = fakeAccount();
    for (const request of [
      post(validCredentials, { csrf: null }),
      post(validCredentials, { csrf: 'b'.repeat(64) }),
      post(validCredentials, { origin: 'https://evil.invalid' }),
    ]) {
      const { response } = await call(loginPassword, account, request);
      expect(response.status).toBe(403);
    }
    expect(account.client.auth.signInWithPassword).not.toHaveBeenCalled();
  });
  it('rejects unsupported content types and oversized bodies with 400', async () => {
    const account = fakeAccount();
    const unsupported = await call(
      loginPassword,
      account,
      post(validCredentials, { contentType: 'text/plain' }),
    );
    expect(unsupported.response.status).toBe(400);
    const oversized = await call(
      loginPassword,
      account,
      post(validCredentials, {
        raw: JSON.stringify({
          ...validCredentials,
          csrf: CSRF,
          padding: 'p'.repeat(4096),
        }),
      }),
    );
    expect(oversized.response.status).toBe(400);
    expect(account.client.auth.signInWithPassword).not.toHaveBeenCalled();
  });
  it('answers 503 JSON when the email provider is disabled or unconfigured', async () => {
    const disabled = fakeAccount();
    disabled.config.providers.email = false;
    const first = await call(loginPassword, disabled, post(validCredentials));
    expect(first.response.status).toBe(503);
    const noClient = fakeAccount({ client: null });
    const second = await call(loginPassword, noClient, post(validCredentials));
    expect(second.response.status).toBe(503);
  });
  it('rejects invalid email, short passwords and unknown keys with 400 before the provider', async () => {
    const account = fakeAccount();
    for (const fields of [
      { email: 'not-an-email', password: 'correct horse battery' },
      { email: 'player@example.com', password: 'short' },
      { email: 'player@example.com', password: 'x'.repeat(129) },
      { ...validCredentials, role: 'admin' },
    ]) {
      const { response } = await call(loginPassword, account, post(fields));
      expect(response.status).toBe(400);
    }
    expect(account.client.auth.signInWithPassword).not.toHaveBeenCalled();
  });
  it('passes normalized email and untrimmed password to the provider', async () => {
    const account = fakeAccount();
    account.client.auth.signInWithPassword.mockResolvedValue({
      data: {},
      error: null,
    });
    account.identity.mockResolvedValue(viewerIdentity());
    const { response } = await call(
      loginPassword,
      account,
      post({ email: '  PLAYER@example.com ', password: '  spaced pass  ' }),
    );
    expect(account.client.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'player@example.com',
      password: '  spaced pass  ',
    });
    expect(response.status).toBe(303);
  });
  it('redirects every provider refusal to a generic credentials error without enumeration', async () => {
    const locations: (string | null)[] = [];
    for (const message of [
      'Invalid login credentials',
      'Email not confirmed',
      'User not found',
    ]) {
      const account = fakeAccount();
      account.client.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message, status: 400 },
      });
      const { response } = await call(
        loginPassword,
        account,
        post(validCredentials),
      );
      expect(response.status).toBe(303);
      locations.push(response.headers.get('location'));
      expect(await response.text()).not.toContain(message);
    }
    expect(new Set(locations)).toEqual(new Set(['/login?error=credentials']));
  });
  it('redirects verified logins to /dashboard and deletes the CSRF cookie', async () => {
    const account = fakeAccount();
    account.client.auth.signInWithPassword.mockResolvedValue({
      data: { user: { id: 'u' }, session: { access_token: 't' } },
      error: null,
    });
    account.identity.mockResolvedValue(viewerIdentity());
    const { cookies, response } = await call(
      loginPassword,
      account,
      post(validCredentials),
    );
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('/dashboard');
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(cookies.deleted).toContain(account.names.csrf);
    expect(account.clear).not.toHaveBeenCalled();
    expect(account.client.auth.signOut).not.toHaveBeenCalled();
  });
  it('signs out locally and clears cookies when identity cannot be verified', async () => {
    const account = fakeAccount();
    account.client.auth.signInWithPassword.mockResolvedValue({
      data: { user: { id: 'u' }, session: { access_token: 't' } },
      error: null,
    });
    account.identity.mockResolvedValue(null);
    const { response } = await call(
      loginPassword,
      account,
      post(validCredentials),
    );
    expect(account.client.auth.signOut).toHaveBeenCalledWith({
      scope: 'local',
    });
    expect(account.clear).toHaveBeenCalled();
    expect(response.headers.get('location')).toBe('/login?error=credentials');
    expect(response.headers.get('location')).not.toContain('dashboard');
  });
  it('honors AUTH_TEST_EMAIL against the verified identity and rejects mismatches', async () => {
    const account = fakeAccount();
    account.config.testEmail = 'approved@example.com';
    account.client.auth.signInWithPassword.mockResolvedValue({
      data: { user: { id: 'u' }, session: { access_token: 't' } },
      error: null,
    });
    account.identity.mockResolvedValue(viewerIdentity('other@example.com'));
    const { response } = await call(
      loginPassword,
      account,
      post({ email: 'other@example.com', password: 'correct horse' }),
    );
    expect(account.client.auth.signOut).toHaveBeenCalledWith({
      scope: 'local',
    });
    expect(account.clear).toHaveBeenCalled();
    expect(response.headers.get('location')).toBe('/login?error=eligibility');
  });
  it('accepts the approved test email when configured', async () => {
    const account = fakeAccount();
    account.config.testEmail = 'approved@example.com';
    account.client.auth.signInWithPassword.mockResolvedValue({
      data: { user: { id: 'u' }, session: { access_token: 't' } },
      error: null,
    });
    account.identity.mockResolvedValue(viewerIdentity('approved@example.com'));
    const { response } = await call(
      loginPassword,
      account,
      post({ email: 'approved@example.com', password: 'correct horse' }),
    );
    expect(response.headers.get('location')).toBe('/dashboard');
  });
  it('sanitizes thrown provider and identity errors into a generic redirect', async () => {
    const throwingProvider = fakeAccount();
    throwingProvider.client.auth.signInWithPassword.mockRejectedValue(
      new Error('secret socket failure at 10.0.0.8'),
    );
    const first = await call(
      loginPassword,
      throwingProvider,
      post(validCredentials),
    );
    expect(first.response.status).toBe(303);
    expect(first.response.headers.get('location')).toBe(
      '/login?error=credentials',
    );
    expect(throwingProvider.clear).toHaveBeenCalled();

    const throwingIdentity = fakeAccount();
    throwingIdentity.client.auth.signInWithPassword.mockResolvedValue({
      data: { user: { id: 'u' }, session: { access_token: 't' } },
      error: null,
    });
    throwingIdentity.identity.mockRejectedValue(
      new Error('connection string password=hunter2'),
    );
    const second = await call(
      loginPassword,
      throwingIdentity,
      post(validCredentials),
    );
    expect(second.response.headers.get('location')).toBe(
      '/login?error=credentials',
    );
    expect(second.response.headers.get('location')).not.toContain('hunter2');
    expect(throwingIdentity.clear).toHaveBeenCalled();
  });
});

describe('registerPassword', () => {
  it('answers 503 JSON when registration is disabled while leaving login semantics intact', async () => {
    const account = fakeAccount();
    account.config.signup = false;
    const { response } = await call(
      registerPassword,
      account,
      post(validCredentials),
    );
    expect(response.status).toBe(503);
    expect(account.client.auth.signUp).not.toHaveBeenCalled();
  });
  it('answers 503 when the email provider is disabled', async () => {
    const account = fakeAccount();
    account.config.providers.email = false;
    const { response } = await call(
      registerPassword,
      account,
      post(validCredentials),
    );
    expect(response.status).toBe(503);
    expect(account.client.auth.signUp).not.toHaveBeenCalled();
  });
  it('restricts registration to the AUTH_TEST_EMAIL account with 403', async () => {
    const account = fakeAccount();
    account.config.testEmail = 'approved@example.com';
    const { response } = await call(
      registerPassword,
      account,
      post({ email: 'intruder@example.com', password: 'correct horse' }),
    );
    expect(response.status).toBe(403);
    expect(account.client.auth.signUp).not.toHaveBeenCalled();
  });
  it('requires CSRF and rejects invalid input before touching the provider', async () => {
    const account = fakeAccount();
    const csrfless = await call(
      registerPassword,
      account,
      post(validCredentials, { csrf: null }),
    );
    expect(csrfless.response.status).toBe(403);
    const invalid = await call(
      registerPassword,
      account,
      post({ email: 'bad', password: 'short' }),
    );
    expect(invalid.response.status).toBe(400);
    expect(account.client.auth.signUp).not.toHaveBeenCalled();
  });
  it('always passes the fixed emailRedirectTo built from config.origin', async () => {
    const account = fakeAccount();
    account.client.auth.signUp.mockResolvedValue({
      data: { user: { id: 'u' }, session: null },
      error: null,
    });
    await call(registerPassword, account, post(validCredentials));
    expect(account.client.auth.signUp).toHaveBeenCalledWith({
      email: 'player@example.com',
      password: 'correct horse battery',
      options: { emailRedirectTo: ORIGIN + '/auth/callback' },
    });
  });
  it('answers provider refusals and missing sessions with the same generic confirmation notice', async () => {
    const locations: (string | null)[] = [];
    const refusal = fakeAccount();
    refusal.client.auth.signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'User already registered', status: 422 },
    });
    const first = await call(registerPassword, refusal, post(validCredentials));
    expect(first.response.status).toBe(303);
    expect(await first.response.text()).not.toContain('already registered');
    locations.push(first.response.headers.get('location'));

    const pending = fakeAccount();
    pending.client.auth.signUp.mockResolvedValue({
      data: { user: { id: 'u' }, session: null },
      error: null,
    });
    const second = await call(
      registerPassword,
      pending,
      post(validCredentials),
    );
    locations.push(second.response.headers.get('location'));
    expect(pending.identity).not.toHaveBeenCalled();

    expect(new Set(locations)).toEqual(new Set(['/login?notice=confirmation']));
  });
  it('verifies identity and enters /dashboard when signup returns a session', async () => {
    const account = fakeAccount();
    account.client.auth.signUp.mockResolvedValue({
      data: { user: { id: 'u' }, session: { access_token: 't' } },
      error: null,
    });
    account.identity.mockResolvedValue(viewerIdentity());
    const { cookies, response } = await call(
      registerPassword,
      account,
      post(validCredentials),
    );
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('/dashboard');
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(cookies.deleted).toContain(account.names.csrf);
    expect(account.clear).not.toHaveBeenCalled();
  });
  it('signs out and clears when a returned session yields no verifiable identity', async () => {
    const account = fakeAccount();
    account.client.auth.signUp.mockResolvedValue({
      data: { user: { id: 'u' }, session: { access_token: 't' } },
      error: null,
    });
    account.identity.mockResolvedValue(null);
    const { response } = await call(
      registerPassword,
      account,
      post(validCredentials),
    );
    expect(account.client.auth.signOut).toHaveBeenCalledWith({
      scope: 'local',
    });
    expect(account.clear).toHaveBeenCalled();
    expect(response.headers.get('location')).not.toContain('dashboard');
    expect(response.headers.get('location')).toBe('/login?notice=confirmation');
  });
  it('honors AUTH_TEST_EMAIL against the post-signup identity', async () => {
    const account = fakeAccount();
    account.config.testEmail = 'approved@example.com';
    account.client.auth.signUp.mockResolvedValue({
      data: { user: { id: 'u' }, session: { access_token: 't' } },
      error: null,
    });
    account.identity.mockResolvedValue(viewerIdentity('approved@example.com'));
    const ok = await call(
      registerPassword,
      account,
      post({ email: 'approved@example.com', password: 'correct horse' }),
    );
    expect(ok.response.headers.get('location')).toBe('/dashboard');
  });
  it('sanitizes thrown provider errors without exposing details', async () => {
    const account = fakeAccount();
    account.client.auth.signUp.mockRejectedValue(
      new Error('smtp password=hunter2 quota detail'),
    );
    const { response } = await call(
      registerPassword,
      account,
      post(validCredentials),
    );
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('/login?notice=confirmation');
    expect(response.headers.get('location')).not.toContain('hunter2');
    expect(account.clear).toHaveBeenCalled();
  });
});
