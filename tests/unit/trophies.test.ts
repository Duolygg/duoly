import { existsSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  RARITIES,
  TROPHY_GAMES,
  TrophySubmissionSchema,
  defaultRarity,
  leaderboardRarity,
  trophyArt,
  trophyTier,
  tournamentRarity,
} from '../../src/contracts/trophies';
import { TROPHY_ART } from '../../src/contracts/trophy-art';
import { SITE_GAMES } from '../../src/site/games';

describe('trophy catalog', () => {
  it('covers every bookable game', () => {
    const ids = SITE_GAMES.map((g) => g.id).filter((id) => id !== 'social');
    expect(ids.filter((id) => !TROPHY_GAMES[id])).toEqual([]);
  });

  it('has unique tier keys inside each ladder and climbs in rarity', () => {
    for (const [game, info] of Object.entries(TROPHY_GAMES))
      for (const ladder of info.ladders) {
        const keys = ladder.tiers.map((t) => t.key);
        expect(new Set(keys).size, `${game}/${ladder.id}`).toBe(keys.length);
        const order = ladder.tiers.map((t) => RARITIES.indexOf(t.rarity));
        expect(
          order.every((r, i) => i === 0 || r >= order[i - 1]!),
          `${game}/${ladder.id} rarity never drops`,
        ).toBe(true);
      }
  });

  it('gives the middle of every long ladder something above common', () => {
    for (const [game, info] of Object.entries(TROPHY_GAMES))
      for (const ladder of info.ladders.filter((l) => l.tiers.length >= 6)) {
        const mid = ladder.tiers[Math.floor(ladder.tiers.length / 2)]!;
        expect(mid.rarity, `${game}/${ladder.id}/${mid.key}`).not.toBe(
          'common',
        );
      }
  });

  it('only lists emblems that match a tier and exist on disk, small enough to ship', () => {
    for (const [game, keys] of Object.entries(TROPHY_ART))
      for (const key of keys) {
        const known =
          TROPHY_GAMES[game]?.leaderboardArt === key ||
          TROPHY_GAMES[game]?.ladders.some((l) =>
            l.tiers.some((t) => t.key === key),
          );
        expect(known, `${game}/${key} is a tier`).toBe(true);
        for (const size of [128, 256] as const) {
          const file = `public${trophyArt(game, key, size)}`;
          expect(existsSync(file), file).toBe(true);
          expect(statSync(file).size, file).toBeLessThan(
            size === 128 ? 24_000 : 64_000,
          );
        }
      }
  });

  it('returns null art for a tier without an emblem', () => {
    expect(trophyArt('fc', 'elite')).toBeNull();
    expect(trophyArt('lol', 'challenger')).toBe(
      '/trophies/lol/challenger-256.webp',
    );
  });
});

describe('trophy submissions', () => {
  const rank = {
    game: 'lol',
    kind: 'rank',
    ladder: 'rank',
    tier: 'diamond',
    division: 'II',
    moment: 'peak',
    season: '2026 Split 2',
    proofUrl: 'https://op.gg/summoners/euw/x',
  };
  it('accepts a complete rank and defaults its rarity from the ladder', () => {
    const parsed = TrophySubmissionSchema.parse(rank);
    expect(defaultRarity(parsed)).toBe(
      trophyTier('lol', 'rank', 'diamond')!.rarity,
    );
  });
  it('refuses a division the tier does not have', () => {
    expect(
      TrophySubmissionSchema.safeParse({ ...rank, tier: 'challenger' }).success,
    ).toBe(false);
  });
  it('refuses unknown tiers, games and non-https links', () => {
    expect(
      TrophySubmissionSchema.safeParse({ ...rank, tier: 'wood' }).success,
    ).toBe(false);
    expect(
      TrophySubmissionSchema.safeParse({ ...rank, game: 'xx' }).success,
    ).toBe(false);
    expect(
      TrophySubmissionSchema.safeParse({ ...rank, proofUrl: 'http://op.gg/x' })
        .success,
    ).toBe(false);
  });
  it('refuses markup in free text', () => {
    expect(
      TrophySubmissionSchema.safeParse({
        game: 'val',
        kind: 'title',
        title: '<img src=x>',
      }).success,
    ).toBe(false);
  });
  it('needs the event and placement for a tournament', () => {
    expect(
      TrophySubmissionSchema.safeParse({
        game: 'val',
        kind: 'tournament',
        event: 'Cup',
      }).success,
    ).toBe(false);
    const ok = TrophySubmissionSchema.parse({
      game: 'val',
      kind: 'tournament',
      event: 'Cup',
      position: 1,
    });
    expect(defaultRarity(ok)).toBe('legendary');
  });
  it('scales placings and leaderboard spots', () => {
    expect([1, 2, 5, 20].map(tournamentRarity)).toEqual([
      'legendary',
      'epic',
      'rare',
      'uncommon',
    ]);
    expect([3, 50, 500, 5000].map(leaderboardRarity)).toEqual([
      'mythic',
      'legendary',
      'epic',
      'rare',
    ]);
  });
});
