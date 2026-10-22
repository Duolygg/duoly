import type { AstroCookies } from 'astro';
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

it('enforces the approved staging identity on every account read, before loading profile data', async () => {
  for (const [name, value] of Object.entries({
    AUTH_ENABLED: 'true',
    AUTH_ORIGIN: 'http://localhost:4321',
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
    AUTH_COOKIE_SECRET: 's'.repeat(32),
    AUTH_TEST_EMAIL: 'approved@example.com',
  }))
    vi.stubEnv(name, value);
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
  vi.mocked(createServerClient).mockReturnValue({
    auth: {
      getUser: async () => ({
        data: {
          user: {
            id: 'a1100000-0000-4000-8000-000000000001',
            email: 'other@example.com',
            app_metadata: { provider: 'email' },
          },
        },
        error: null,
      }),
    },
    from,
  } as unknown as ReturnType<typeof createServerClient>);
  const account = accountContext(
    new Request('http://localhost:4321/profile', {
      headers: { Cookie: 'duoly-session=valid-provider-session' },
    }),
    { get: vi.fn(), set: vi.fn(), delete: vi.fn() } as unknown as AstroCookies,
  );
  expect(await account.identity()).toBeNull();
  expect(from).not.toHaveBeenCalled();
});
