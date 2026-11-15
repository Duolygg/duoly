import type { APIContext } from 'astro';
import { beforeEach, expect, it, vi } from 'vitest';
import { accountContext } from '../../src/server/auth/context';
import { ACCESS_GAMES } from '../../src/design-reference/lib/games.js';
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
  /* Roles save as the game's own spelling and picks save as catalog ids, because the official
     names carry punctuation teammate_public_labels_valid() rejects. See settings-games.ts. */
  expect(rpc).toHaveBeenCalledWith('teammate_public_profile_save', {
    p_settings: {
      ...settings,
      games: [{ game: 'val', roles: ['Controller'], picks: ['omen'] }],
    },
  });
});
it('saves an ordered featured list once and derives its legacy lead', async () => {
  rpc.mockResolvedValueOnce({
    data: { settings, approvedGames: ['val', 'lol', 'cs2'] },
    error: null,
  });
  expect(
    (
      await run(
        ctx({
          ...settings,
          featuredGames: ['lol', 'cs2', 'lol', 'val'],
          csrf: token,
        }),
      )
    ).status,
  ).toBe(200);
  expect(rpc).toHaveBeenCalledWith('teammate_public_profile_save', {
    p_settings: {
      ...settings,
      featuredGame: 'lol',
      featuredGames: ['lol', 'cs2', 'val'],
      games: [{ game: 'val', roles: ['Controller'], picks: ['omen'] }],
    },
  });
});
it('forwards every approved featured game without a numeric list cap', async () => {
  const featuredGames = Array.from({ length: 40 }, (_, i) => `g${i}`);
  rpc.mockResolvedValueOnce({
    data: { settings, approvedGames: featuredGames },
    error: null,
  });
  expect(
    (await run(ctx({ ...settings, featuredGames, csrf: token }))).status,
  ).toBe(200);
  expect(rpc).toHaveBeenCalledWith('teammate_public_profile_save', {
    p_settings: {
      ...settings,
      featuredGame: 'g0',
      featuredGames,
      games: [{ game: 'val', roles: ['Controller'], picks: ['omen'] }],
    },
  });
});
it('saves details for every unique approved supported game without a numeric cap', async () => {
  const approvedGames = ACCESS_GAMES.map((game) => game.id);
  expect(approvedGames.length).toBeGreaterThan(16);
  expect(new Set(approvedGames).size).toBe(approvedGames.length);
  const games = approvedGames.map((game) => ({ game, roles: [], picks: [] }));
  rpc.mockResolvedValueOnce({
    data: { settings, approvedGames },
    error: null,
  });
  expect(
    (
      await run(
        ctx({ ...settings, games, featuredGames: approvedGames, csrf: token }),
      )
    ).status,
  ).toBe(200);
  expect(rpc).toHaveBeenCalledWith('teammate_public_profile_save', {
    p_settings: {
      ...settings,
      games,
      featuredGame: approvedGames[0],
      featuredGames: approvedGames,
    },
  });
});
it('rejects an unapproved featured game before saving', async () => {
  rpc.mockResolvedValueOnce({
    data: { settings, approvedGames: ['val'] },
    error: null,
  });
  expect(
    (
      await run(
        ctx({ ...settings, featuredGames: ['val', 'lol'], csrf: token }),
      )
    ).status,
  ).toBe(400);
  expect(rpc).toHaveBeenCalledTimes(1);
});
it('does not save a featured list when approval lookup is unavailable', async () => {
  rpc.mockResolvedValueOnce({ data: null, error: { code: 'unavailable' } });
  expect(
    (await run(ctx({ ...settings, featuredGames: ['val'], csrf: token })))
      .status,
  ).toBe(503);
  expect(rpc).toHaveBeenCalledTimes(1);
});
it.each([[], null, ['val', 7], ['../etc']])(
  'rejects malformed featured lists: %j',
  async (featuredGames) => {
    expect(
      (await run(ctx({ ...settings, featuredGames, csrf: token }))).status,
    ).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  },
);
it('normalizes an alias, a loose spelling and a duplicate before saving', async () => {
  const games = [
    {
      game: 'val',
      roles: ['sentinel', 'SENTINEL'],
      picks: ['KAY/O', 'brim', 'omen', 'Omen'],
    },
  ];
  expect((await run(ctx({ ...settings, games, csrf: token }))).status).toBe(
    200,
  );
  expect(rpc).toHaveBeenCalledWith('teammate_public_profile_save', {
    p_settings: {
      ...settings,
      games: [
        {
          game: 'val',
          roles: ['Sentinel'],
          picks: ['kayo', 'brimstone', 'omen'],
        },
      ],
    },
  });
});
it('refuses a value the game does not have, and says which one', async () => {
  const games = [{ game: 'val', roles: [], picks: ['Brand New Agent'] }];
  const response = await run(ctx({ ...settings, games, csrf: token }));
  expect(response.status).toBe(400);
  expect((await response.json()).error).toContain('"Brand New Agent"');
  /* The read that looks for a legacy value is allowed; the save never happens. */
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(rpc).toHaveBeenCalledWith('teammate_public_profile_get');
});
it('keeps a value the teammate already has stored for that game', async () => {
  rpc.mockResolvedValueOnce({
    data: {
      settings: {
        ...settings,
        games: [
          { game: 'val', roles: ['Shotcaller'], picks: ['Some Old Pick'] },
        ],
      },
    },
    error: null,
  });
  const games = [
    { game: 'val', roles: ['Shotcaller'], picks: ['Some Old Pick', 'omen'] },
  ];
  expect((await run(ctx({ ...settings, games, csrf: token }))).status).toBe(
    200,
  );
  expect(rpc).toHaveBeenCalledWith('teammate_public_profile_save', {
    p_settings: { ...settings, games },
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
