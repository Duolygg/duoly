import { beforeEach, expect, it, vi } from 'vitest';
import {
  loadPublicProfile,
  loadTeammateCards,
  loadIndexableProfiles,
} from '../../src/server/teammates/public-profiles';
import { fixtureLookup } from '../../src/server/teammates/profile-fixtures';
const rpc = vi.hoisted(() => vi.fn());
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ rpc }) }));
vi.mock('../../src/server/auth/config', () => ({
  authConfig: () => ({
    url: 'https://example.supabase.co',
    publishableKey: 'public-test',
  }),
}));
beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv('PUBLIC_PROFILE_FIXTURES', 'false');
  rpc.mockReset();
});
it('reads a whitelisted profile from the public RPC', async () => {
  const fixture = fixtureLookup('nyx');
  expect(fixture.status).toBe('ok');
  if (fixture.status !== 'ok') throw new Error('missing fixture');
  rpc.mockResolvedValue({
    data: { ...fixture.profile, user_id: 'private', email: 'private' },
    error: null,
  });
  expect(await loadPublicProfile('nyx')).toEqual(fixture);
  expect(rpc).toHaveBeenCalledWith('public_teammate_profile', {
    p_slug: 'nyx',
  });
});
it.each([
  { status: 'moved', slug: 'nyx' },
  { status: 'gone' },
  { status: 'missing' },
])('maps lookup status $status', async (data) => {
  rpc.mockResolvedValue({ data, error: null });
  expect(await loadPublicProfile('old-nyx')).toEqual(data);
});
it('fails closed on malformed public data and RPC failures', async () => {
  rpc.mockResolvedValue({
    data: { status: 'moved', slug: 'https://evil.invalid' },
    error: null,
  });
  expect(await loadPublicProfile('old-nyx')).toEqual({ status: 'missing' });
  rpc.mockRejectedValue(new Error('network'));
  expect(await loadTeammateCards({ limit: 6 })).toEqual([]);
});
it('passes card filters and strips unlisted fields', async () => {
  const card = {
    slug: 'nyx',
    name: 'Nyx',
    avatar: '/assets/avatars/avatar-1.png',
    accent: 'mint',
    tier: 'rookie',
    online: true,
    game: 'val',
    rank: 'Immortal',
    rating: null,
  };
  rpc.mockResolvedValue({
    data: [{ ...card, userId: 'private' }],
    error: null,
  });
  expect(
    await loadTeammateCards({ game: 'val', limit: 6, excludeSlug: 'nova' }),
  ).toEqual([card]);
  expect(rpc).toHaveBeenCalledWith('public_teammate_cards', {
    p_game: 'val',
    p_limit: 6,
    p_exclude_slug: 'nova',
  });
});
it('maps sitemap rows without ids', async () => {
  rpc.mockResolvedValue({
    data: [
      { slug: 'nyx', updatedAt: '2026-11-12T12:00:00Z', userId: 'private' },
    ],
    error: null,
  });
  expect(await loadIndexableProfiles()).toEqual([
    { slug: 'nyx', updatedAt: '2026-11-12T12:00:00Z' },
  ]);
});
