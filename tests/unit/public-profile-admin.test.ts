import type { APIContext } from 'astro';
import { beforeEach, expect, it, vi } from 'vitest';
import { accountContext } from '../../src/server/auth/context';
import { adminPublicProfile } from '../../src/server/teammates/admin-handlers';
import { ranksForGame } from '../../src/contracts/public-profile-admin';
import { RANKS, SERVICE_RANKS } from '../../src/design-reference/lib/ranks';
vi.mock('../../src/server/auth/context', () => ({ accountContext: vi.fn() }));
const rpc = vi.fn();
const identity = vi.fn();
const token = 'a'.repeat(64);
const userId = '9f000000-0000-4000-8000-000000000001';
function context(body?: unknown) {
  const request = new Request(
    'http://localhost/api/admin/public-profile' +
      (body ? '' : '?userId=' + userId),
    {
      method: body ? 'POST' : 'GET',
      headers: {
        origin: 'http://localhost',
        'content-type': 'application/json',
      },
      body: body
        ? JSON.stringify({ ...(body as object), csrf: token })
        : undefined,
    },
  );
  return {
    request,
    url: new URL(request.url),
    cookies: { get: () => ({ value: token }) },
  } as unknown as APIContext;
}
const run = async (body?: unknown) =>
  (await adminPublicProfile(context(body))) as Response;
beforeEach(() => {
  vi.resetAllMocks();
  identity.mockResolvedValue({ viewer: { role: 'admin' } });
  rpc.mockImplementation(async (fn: string) => ({
    data:
      fn === 'admin_me'
        ? { owner: false, sections: ['teammates'] }
        : { ok: true },
    error: null,
  }));
  vi.mocked(accountContext).mockReturnValue({
    client: { rpc },
    identity,
    json: (b: unknown, status = 200) =>
      new Response(JSON.stringify(b), { status }),
    config: { origin: 'http://localhost' },
    names: { csrf: 'csrf' },
  } as unknown as ReturnType<typeof accountContext>);
});
it('reads the admin detail and validates the teammate id', async () => {
  expect((await run()).status).toBe(200);
  expect(rpc).toHaveBeenCalledWith('admin_public_profile_get', {
    p_user_id: userId,
  });
});
it('sets only catalog ranks and peaks through the admin boundary', async () => {
  expect(
    (
      await run({
        action: 'rank',
        userId,
        game: 'val',
        rank: 'Immortal',
        peakRank: 'Radiant',
        verified: true,
      })
    ).status,
  ).toBe(200);
  expect(rpc).toHaveBeenCalledWith('admin_set_game_rank', {
    p_user_id: userId,
    p_game: 'val',
    p_rank: 'Immortal',
    p_peak_rank: 'Radiant',
    p_verified: true,
  });
  expect(
    (
      await run({
        action: 'rank',
        userId,
        game: 'val',
        rank: 'Challenger',
        peakRank: null,
        verified: true,
      })
    ).status,
  ).toBe(400);
});
it('requires moderation reasons and logs via the existing RPC', async () => {
  expect(
    (
      await run({
        action: 'hide',
        slug: 'nyx',
        hidden: true,
        reason: 'Off-platform link',
      })
    ).status,
  ).toBe(200);
  expect(rpc).toHaveBeenCalledWith('admin_hide_public_profile', {
    p_slug: 'nyx',
    p_hidden: true,
    p_reason: 'Off-platform link',
  });
  expect(
    (await run({ action: 'hide', slug: 'nyx', hidden: true, reason: '' }))
      .status,
  ).toBe(400);
});
it('rejects nonadmins and admins without teammate permission', async () => {
  identity.mockResolvedValueOnce({ viewer: { role: 'teammate' } });
  expect((await run()).status).toBe(404);
  rpc.mockResolvedValueOnce({
    data: { owner: false, sections: ['orders'] },
    error: null,
  });
  expect((await run()).status).toBe(403);
});
it('includes every main and service ladder exactly, with no invented divisions', () => {
  const games = new Set([...Object.keys(RANKS), ...Object.keys(SERVICE_RANKS)]);
  for (const game of games) {
    const base = (RANKS as Record<string, (string | number)[][]>)[game] ?? [];
    const modes =
      (SERVICE_RANKS as Record<string, Record<string, (string | number)[][]>>)[
        game
      ] ?? {};
    expect(ranksForGame(game)).toEqual([
      ...new Set([...base, ...Object.values(modes).flat()].map((r) => r[0])),
    ]);
  }
  expect(ranksForGame('val')).not.toContain('Immortal 3');
  expect(ranksForGame('mc')).toEqual([]);
});
