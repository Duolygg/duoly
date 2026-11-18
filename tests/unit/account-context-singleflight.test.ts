import type { AstroCookies, AstroGlobal } from 'astro';
import { pageViewer } from '../../src/site/viewer';
import { loadSavedSlugs } from '../../src/server/teammates/saved';
import { afterEach, expect, it, vi } from 'vitest';
import { createServerClient } from '@supabase/ssr';
import { accountContext } from '../../src/server/auth/context';

vi.mock('@supabase/ssr', async (original) => ({
  ...(await original<typeof import('@supabase/ssr')>()),
  createServerClient: vi.fn(),
}));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
function setup() {
  for (const [name, value] of Object.entries({
    AUTH_ENABLED: 'true',
    AUTH_ORIGIN: 'http://localhost:4321',
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
    AUTH_COOKIE_SECRET: 's'.repeat(32),
    AUTH_TEST_EMAIL: '',
    ADMIN_EMAILS: '',
  }))
    vi.stubEnv(name, value);
  const id = 'a1100000-0000-4000-8000-000000000001';
  const getUser = vi.fn(async () => ({
    data: {
      user: {
        id,
        email: 'player@example.com',
        app_metadata: { provider: 'email' },
        identities: [],
      },
    },
    error: null,
  }));
  const from = vi.fn((table: string) => ({
    select: () => ({
      eq: () => {
        const result = {
          data:
            table === 'profiles'
              ? { id, name: 'Player', country: '', image: '' }
              : table === 'account_roles'
                ? { role: 'customer', owner: false }
                : null,
          error: null,
        };
        return { single: async () => result, maybeSingle: async () => result };
      },
    }),
  }));
  const rpc = vi.fn(async () => ({ data: ['saved-player'], error: null }));
  vi.mocked(createServerClient).mockReturnValue({
    auth: { getUser },
    from,
    rpc,
  } as unknown as ReturnType<typeof createServerClient>);
  const makeAccount = () =>
    accountContext(
      new Request('http://localhost:4321/teammates', {
        headers: { Cookie: 'duoly-session=valid-provider-session' },
      }),
      {
        get: vi.fn(),
        set: vi.fn(),
        delete: vi.fn(),
      } as unknown as AstroCookies,
    );
  return { getUser, from, makeAccount };
}
it('coalesces overlapping identity reads without caching subsequent reads or other requests', async () => {
  const { getUser, from, makeAccount } = setup();
  const account = makeAccount();
  const [header, saved] = await Promise.all([
    account.identity(),
    account.identity(),
  ]);
  expect(header).toEqual(saved);
  expect(header?.viewer.role).toBe('customer');
  expect(getUser).toHaveBeenCalledTimes(1);
  expect(from).toHaveBeenCalledTimes(3);
  await account.identity();
  expect(getUser).toHaveBeenCalledTimes(2);
  await makeAccount().identity();
  expect(getUser).toHaveBeenCalledTimes(3);
});
it('shares directory header and saved-slug identity while keeping both outputs', async () => {
  const { getUser, from, makeAccount } = setup();
  vi.stubEnv('PUBLIC_PROFILE_FIXTURES', 'false');
  const account = makeAccount();
  const astro = {
    response: { headers: new Headers() },
  } as unknown as AstroGlobal;
  const [header, saved] = await Promise.all([
    pageViewer(astro, account),
    loadSavedSlugs(astro, account),
  ]);
  expect(header.viewer?.role).toBe('customer');
  expect(saved).toEqual(['saved-player']);
  expect(getUser).toHaveBeenCalledTimes(1);
  expect(from).toHaveBeenCalledTimes(3);
});
it('does not retain a rejected identity promise', async () => {
  const { getUser, makeAccount } = setup();
  getUser.mockRejectedValueOnce(new Error('Auth unavailable'));
  const account = makeAccount();
  const outcomes = await Promise.allSettled([
    account.identity(),
    account.identity(),
  ]);
  expect(outcomes.every((outcome) => outcome.status === 'rejected')).toBe(true);
  expect(getUser).toHaveBeenCalledTimes(1);
  expect((await account.identity())?.viewer.role).toBe('customer');
  expect(getUser).toHaveBeenCalledTimes(2);
});
