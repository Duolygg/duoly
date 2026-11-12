import type { APIContext } from 'astro';
import { beforeEach, expect, it, vi } from 'vitest';
import { accountContext } from '../../src/server/auth/context';
import { publicProfileSettings } from '../../src/server/teammates/settings-handlers';
vi.mock('../../src/server/auth/context', () => ({ accountContext: vi.fn() }));
const rpc = vi.fn();
const identity = vi.fn();
const token = 'a'.repeat(64);
const settings = {
  published: true,
  slug: 'nyx',
  accent: 'mint',
  banner: 'slash',
  featuredGame: 'val',
  vibeTags: [],
  showCountry: false,
  coaching: false,
  games: [{ game: 'val', roles: ['Controller'], picks: ['Omen'] }],
};
function ctx(body?: unknown, origin = 'http://localhost') {
  const request = new Request('http://localhost/api/teammate/public-profile', {
    method: body === undefined ? 'GET' : 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return {
    request,
    url: new URL(request.url),
    cookies: { get: () => ({ value: token }) },
  } as unknown as APIContext;
}
const run = async (c: APIContext) =>
  (await publicProfileSettings(c)) as Response;
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('PUBLIC_PROFILES_ENABLED', 'true');
  identity.mockResolvedValue({ viewer: { role: 'teammate' } });
  rpc.mockResolvedValue({ data: { settings }, error: null });
  vi.mocked(accountContext).mockReturnValue({
    client: { rpc },
    identity,
    json: (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), { status }),
    config: { origin: 'http://localhost' },
    names: { csrf: 'csrf' },
  } as unknown as ReturnType<typeof accountContext>);
});
it('loads own settings only', async () => {
  expect((await run(ctx())).status).toBe(200);
  expect(rpc).toHaveBeenCalledWith('teammate_public_profile_get');
});
it('validates and saves the exact settings, with CSRF', async () => {
  expect((await run(ctx({ ...settings, csrf: token }))).status).toBe(200);
  expect(rpc).toHaveBeenCalledWith('teammate_public_profile_save', {
    p_settings: settings,
  });
});
it.each([
  { slug: 'admin' },
  { accent: 'red' },
  { games: [{ game: 'val', roles: ['a', 'b', 'c', 'd'], picks: [] }] },
  { bio: 'not here' },
  { rank: 'Radiant' },
])('rejects invalid or unauthorized fields %j', async (bad) => {
  expect((await run(ctx({ ...settings, ...bad, csrf: token }))).status).toBe(
    400,
  );
  expect(rpc).not.toHaveBeenCalled();
});
it('requires a teammate identity', async () => {
  identity.mockResolvedValueOnce(null);
  expect((await run(ctx())).status).toBe(401);
  identity.mockResolvedValueOnce({ viewer: { role: 'customer' } });
  expect((await run(ctx())).status).toBe(403);
});
it('verifies CSRF and origin', async () => {
  expect((await run(ctx({ ...settings, csrf: 'wrong' }))).status).toBe(403);
  expect(
    (await run(ctx({ ...settings, csrf: token }, 'https://evil.invalid')))
      .status,
  ).toBe(403);
});
it('maps slug conflicts and unavailable RPCs', async () => {
  rpc.mockResolvedValueOnce({ data: { settings }, error: null });
  rpc.mockResolvedValueOnce({
    data: {
      error: { code: 409, message: 'That profile link is unavailable.' },
    },
    error: null,
  });
  expect((await run(ctx({ ...settings, csrf: token }))).status).toBe(409);
  rpc.mockResolvedValueOnce({ data: null, error: { code: 'PGRST202' } });
  expect((await run(ctx())).status).toBe(503);
});
it('does not access the DB with the launch flag off', async () => {
  vi.stubEnv('PUBLIC_PROFILES_ENABLED', 'false');
  expect((await run(ctx())).status).toBe(404);
  expect(rpc).not.toHaveBeenCalled();
});
