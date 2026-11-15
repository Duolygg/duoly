import { beforeEach, expect, it, vi } from 'vitest';
import { withDisplayLabels } from '../../src/server/teammates/profile-labels';
import { loadPublicProfile } from '../../src/server/teammates/public-profiles';
import { fixtureLookup } from '../../src/server/teammates/profile-fixtures';
import { profileAnswers } from '../../src/server/teammates/profile-page';
import type { PublicTeammateProfile } from '../../src/contracts/teammate-profile';

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

const base = () => {
  const fixture = fixtureLookup('kairo');
  if (fixture.status !== 'ok') throw new Error('missing fixture');
  return fixture.profile;
};
const games = (profile: PublicTeammateProfile) =>
  profile.games.map((g) => [g.game, g.roles, g.picks]);

/*
 * Picks are stored as catalog ids, so one adapter has to turn them back into names on the way out
 * (DESIGN decision 2). loadPublicProfile() is the only door onto a profile, which is what keeps
 * the page, the generated prose and the quick view endpoint from each needing to remember.
 */
it('hands the page names for stored ids, whichever way the profile was read', async () => {
  const stored = base();
  expect(stored.games[0]!.picks).toEqual(['lee-sin', 'ahri', 'viego']);
  rpc.mockResolvedValue({ data: stored, error: null });
  const read = await loadPublicProfile('kairo');
  expect(read.status).toBe('ok');
  if (read.status !== 'ok') throw new Error('unreadable');
  expect(games(read.profile)).toEqual([
    ['lol', ['Jungle', 'Mid'], ['Lee Sin', 'Ahri', 'Viego']],
    ['val', ['Initiator', 'Duelist'], ['Sova', 'Fade', 'Jett']],
  ]);
  /* The fixture path has to agree with the database path, or the browser suite would be testing
     a profile nobody can actually have. */
  vi.stubEnv('PUBLIC_PROFILE_FIXTURES', 'true');
  const fixtures = await loadPublicProfile('kairo');
  if (fixtures.status !== 'ok') throw new Error('unreadable');
  expect(games(fixtures.profile)).toEqual(games(read.profile));
});
it('never lets an id reach the prose a profile publishes', () => {
  const answers = profileAnswers(withDisplayLabels(base()));
  const prose = JSON.stringify(answers);
  expect(prose).toContain('Lee Sin');
  expect(prose).not.toContain('lee-sin');
});
it('leaves a value written before the catalog existed exactly as it reads', () => {
  const profile = withDisplayLabels({
    ...base(),
    games: [
      {
        game: 'lol',
        rank: 'Master',
        peakRank: null,
        verified: true,
        /* The shapes in production today: display names, and one the catalog cannot place. */
        roles: ['Jungle', 'Support'],
        picks: ['Hecarim', 'Nami', 'Some Old Pick'],
      },
      {
        game: 'mc',
        rank: null,
        peakRank: null,
        verified: false,
        roles: ['Builder'],
        picks: ['Redstone'],
      },
    ],
  });
  expect(games(profile)).toEqual([
    ['lol', ['Jungle', 'Support'], ['Hecarim', 'Nami', 'Some Old Pick']],
    ['mc', ['Builder'], ['Redstone']],
  ]);
});
it('tidies the spelling of a role saved before the game had a role list', () => {
  const profile = withDisplayLabels({
    ...base(),
    games: [
      {
        game: 'lol',
        rank: null,
        peakRank: null,
        verified: false,
        roles: ['jungle'],
        picks: ['dr-mundo'],
      },
    ],
  });
  expect(games(profile)).toEqual([['lol', ['Jungle'], ['Dr. Mundo']]]);
});
it('leaves everything that is not a role or a pick alone', () => {
  const profile = base();
  const without = (p: PublicTeammateProfile) =>
    Object.fromEntries(Object.entries(p).filter(([key]) => key !== 'games'));
  expect(without(withDisplayLabels(profile))).toEqual(without(profile));
});
