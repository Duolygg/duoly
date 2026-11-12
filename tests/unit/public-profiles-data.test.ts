import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  loadPublicProfile,
  loadTeammateCards,
  loadIndexableProfiles,
  fixturesEnabled,
  productionRuntime,
} from '../../src/server/teammates/public-profiles';
import {
  fixtureCards,
  fixtureIndexable,
  fixtureLookup,
} from '../../src/server/teammates/profile-fixtures';
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
  null,
  'https://example.supabase.co/storage/v1/object/public/profile-headers/9f000000-0000-4000-8000-000000000001/0123456789abcdef.webp',
])(
  'preserves the nullable header through the public read side: %s',
  async (header) => {
    const fixture = fixtureLookup('nyx');
    if (fixture.status !== 'ok') throw new Error('missing fixture');
    rpc.mockResolvedValue({
      data: { ...fixture.profile, header },
      error: null,
    });
    expect(await loadPublicProfile('nyx')).toEqual({
      status: 'ok',
      profile: { ...fixture.profile, header },
    });
  },
);
it.each([
  'https://evil.invalid/header.webp',
  'http://example.supabase.co/storage/v1/object/public/profile-headers/9f000000-0000-4000-8000-000000000001/0123456789abcdef.webp',
  'https://example.supabase.co/storage/v1/object/public/profile-headers/9f000000-0000-4000-8000-000000000001/0123456789abcdef.png',
])('fails closed on a malformed header: %s', async (header) => {
  const fixture = fixtureLookup('nyx');
  if (fixture.status !== 'ok') throw new Error('missing fixture');
  rpc.mockResolvedValue({ data: { ...fixture.profile, header }, error: null });
  expect(await loadPublicProfile('nyx')).toEqual({ status: 'missing' });
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

/*
 * No fictional teammate may ever reach duoly.gg (owner decision 2026-11-12). The flag is the only
 * way into the fixtures and production refuses it, whatever the environment variable says.
 */
describe('fixtures are unreachable in production', () => {
  it.each(['VERCEL_ENV', 'NODE_ENV'])(
    'ignores the fixture flag when %s is production',
    (variable) => {
      vi.stubEnv('PUBLIC_PROFILE_FIXTURES', 'true');
      expect(fixturesEnabled()).toBe(true);
      expect(productionRuntime()).toBe(false);
      vi.stubEnv(variable, 'production');
      expect(productionRuntime()).toBe(true);
      expect(fixturesEnabled()).toBe(false);
    },
  );
  it('reads the database instead of the fixtures in production', async () => {
    vi.stubEnv('PUBLIC_PROFILE_FIXTURES', 'true');
    vi.stubEnv('NODE_ENV', 'production');
    rpc.mockResolvedValue({ data: { status: 'missing' }, error: null });
    expect(await loadPublicProfile('nyx')).toEqual({ status: 'missing' });
    expect(rpc).toHaveBeenCalledWith('public_teammate_profile', {
      p_slug: 'nyx',
    });
    expect(await loadTeammateCards({ limit: 6 })).toEqual([]);
    expect(await loadIndexableProfiles()).toEqual([]);
  });
  it('refuses to hand out fixture data directly in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(fixtureLookup('nyx')).toEqual({ status: 'missing' });
    expect(fixtureCards({ limit: 6 })).toEqual([]);
    expect(fixtureIndexable()).toEqual([]);
  });
  it('never offers a fictional teammate outside the fixture flag', async () => {
    vi.stubEnv('PUBLIC_PROFILE_FIXTURES', 'false');
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await loadPublicProfile('nyx')).toEqual({ status: 'missing' });
    expect(await loadTeammateCards({ limit: 6 })).toEqual([]);
  });
});
