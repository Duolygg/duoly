import { expect, it } from 'vitest';
import {
  featuredGamesOf,
  publicProfileSettingsSchema,
} from '../../src/contracts/teammate-profile';
import { publicProfileSchema } from '../../src/server/teammates/public-profile-schemas';
import { fixtureLookup } from '../../src/server/teammates/profile-fixtures';

const settings = {
  published: true,
  slug: 'nyx',
  accent: 'mint',
  banner: 'slash',
  featuredGame: 'val',
  vibeTags: [],
  showCountry: false,
  coaching: false,
  games: [],
};
function profile() {
  const result = fixtureLookup('nyx');
  if (result.status !== 'ok') throw new Error('missing fixture');
  return result.profile;
}
it('accepts featured lists without an artificial numeric cap', () => {
  const featuredGames = Array.from({ length: 40 }, (_, i) => `g${i}`);
  expect(
    publicProfileSettingsSchema.safeParse({ ...settings, featuredGames })
      .success,
  ).toBe(true);
  const p = profile();
  expect(
    publicProfileSchema.safeParse({
      ...p,
      featuredGame: featuredGames[0],
      featuredGames,
      games: featuredGames.map((game) => ({
        game,
        rank: null,
        peakRank: null,
        verified: false,
        roles: [],
        picks: [],
      })),
    }).success,
  ).toBe(true);
});
it('retains legacy single-game settings and ordered fallback', () => {
  expect(publicProfileSettingsSchema.safeParse(settings).success).toBe(true);
  expect(featuredGamesOf({ featuredGame: 'val' })).toEqual(['val']);
  expect(
    featuredGamesOf({
      featuredGame: 'val',
      featuredGames: ['lol', 'val', 'lol'],
    }),
  ).toEqual(['lol', 'val']);
  expect(featuredGamesOf({ featuredGame: 'val', featuredGames: [] })).toEqual([
    'val',
  ]);
});
it.each([
  { featuredGames: ['val', 'val'] },
  { featuredGames: ['lol', 'val'] },
  { featuredGames: ['val', 'unknown'] },
  { featuredGames: [] },
])(
  'rejects inconsistent public featured data: $featuredGames',
  ({ featuredGames }) => {
    const p = profile();
    expect(publicProfileSchema.safeParse({ ...p, featuredGames }).success).toBe(
      false,
    );
  },
);
it('preserves a valid ordered public list and accepts old reads', () => {
  const p = profile();
  expect(publicProfileSchema.safeParse(p).success).toBe(true);
  const featuredGames = p.games.map((g) => g.game);
  expect(
    publicProfileSchema.parse({
      ...p,
      featuredGame: featuredGames[0],
      featuredGames,
    }).featuredGames,
  ).toEqual(featuredGames);
});
