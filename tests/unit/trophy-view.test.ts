import { describe, expect, it } from 'vitest';
import {
  trophyCase,
  trophyView,
  trophyOffset,
  trophySeasonLine,
  trophyShelves,
  trophyStands,
  trophyTour,
} from '../../src/server/teammates/trophy-view';
import type { PublicTrophy } from '../../src/contracts/trophies';
const base: PublicTrophy = {
  id: 'f0000000-0000-4000-8000-000000000001',
  game: 'val',
  kind: 'rank',
  ladder: 'rank',
  tier: 'radiant',
  division: null,
  value: 612,
  moment: 'peak',
  season: 'Episode 10 Act 3',
  region: 'EU',
  position: null,
  event: null,
  title: null,
  achievedOn: null,
  proofUrl: null,
  rarity: 'mythic',
  verifiedAt: '2026-11-11T10:00:00Z',
};
describe('trophy presentation', () => {
  it('uses the official emblem and fields without rarity labels or invented stats', () => {
    const v = trophyView(base);
    expect(v.art).toBe('/trophies/val/radiant-256.webp');
    expect(v.name).toBe('Radiant');
    expect(v.eyebrow).toBe('Valorant · Peak rank');
    expect(v.meta).toBe('Episode 10 Act 3 · EU · 612 RR');
    expect(v.verified).toBe('Nov 2026');
    expect(v.crest).toBe(false);
  });
  it('gives Gold the same full presentation with its own art', () => {
    const v = trophyView({
      ...base,
      game: 'lol',
      tier: 'gold',
      division: 'II',
      rarity: 'uncommon',
      value: null,
    });
    expect(v.art).toBe('/trophies/lol/gold-256.webp');
    expect(v.name).toBe('Gold II');
    expect(v.meta).not.toContain('RR');
  });
  it('orders by rarity, then verification date, without mutating input', () => {
    const a = { ...base, id: 'gold', rarity: 'uncommon' as const };
    const b = { ...base, id: 'new', verifiedAt: '2026-11-12T10:00:00Z' };
    const rows = [a, base, b];
    expect(trophyCase(rows).map((x) => x.id)).toEqual(['new', base.id, 'gold']);
    expect(rows[0]).toBe(a);
  });
  it('renders missing art as a crest and omits absent metadata', () => {
    const v = trophyView({
      ...base,
      game: 'mc',
      kind: 'leaderboard',
      tier: null,
      position: 412,
      season: null,
      region: null,
    });
    expect(v.name).toBe('#412');
    expect(v.art).toMatch(/^data:image\/svg\+xml,/);
    expect(v.crest).toBe(true);
    expect(v.meta).toBe('');
  });
  it.each([
    [1, '1st'],
    [2, '2nd'],
    [3, '3rd'],
    [11, '11th'],
    [12, '12th'],
    [21, '21st'],
  ])('formats tournament placement %i', (position, ordinal) => {
    expect(trophyView({ ...base, kind: 'tournament', position }).name).toBe(
      `${ordinal} place`,
    );
  });
  it('wraps offsets around the active trophy without duplicate positions', () => {
    for (const n of [3, 4, 8, 24])
      for (let active = 0; active < n; active++) {
        const d = Array.from({ length: n }, (_, i) =>
          trophyOffset(i, active, n),
        );
        expect(d[active]).toBe(0);
        expect(new Set(d).size).toBe(n);
        expect(Math.max(...d)).toBeLessThanOrEqual(Math.floor(n / 2));
      }
    expect(trophyOffset(1, 0, 2)).toBe(1);
  });
});

describe('the shelf', () => {
  const rank = (
    id: string,
    tier: string,
    rarity: PublicTrophy['rarity'],
    season: string,
  ) =>
    ({
      id,
      game: 'lol',
      kind: 'rank',
      ladder: 'rank',
      tier,
      division: null,
      value: null,
      moment: 'season_end',
      season,
      region: 'EUW',
      position: null,
      event: null,
      title: null,
      achievedOn: null,
      proofUrl: null,
      rarity,
      verifiedAt: '2026-11-11T10:00:00.000Z',
    }) as PublicTrophy;
  const views = trophyCase([
    rank('a', 'gold', 'common', '2018'),
    rank('b', 'gold', 'common', '2019'),
    rank('c', 'challenger', 'mythic', '2025'),
    rank('d', 'gold', 'common', '2020'),
    rank('e', 'platinum', 'uncommon', '2021'),
  ]);
  const stands = trophyStands(views);
  it('collapses the seasons of one tier into a single stand', () => {
    expect(stands.map((s) => [s.short, s.count])).toEqual([
      ['Challenger', 1],
      ['Platinum', 1],
      ['Gold', 3],
    ]);
    expect(stands.at(-1)?.seasons).toEqual(['2020', '2019', '2018']);
    expect(stands[0]?.seasons).toEqual(['2025']);
  });
  it('writes the seasons a repeated tier was also reached in', () => {
    expect(trophySeasonLine(stands[0]!)).toBe('');
    expect(trophySeasonLine(stands.at(-1)!)).toBe('Also held in 2019 and 2018');
    expect(
      trophySeasonLine({ ...stands.at(-1)!, seasons: ['2020', '2019'] }),
    ).toBe('Also held in 2019');
    /* Nothing carries a season: the count still has to be said. */
    expect(
      trophySeasonLine({ ...stands.at(-1)!, season: '', seasons: [] }),
    ).toBe('Held in 3 seasons');
  });
  it('puts the higher tier first when two share a rarity', () => {
    const tied = trophyStands(
      trophyCase([
        rank('d', 'diamond', 'epic', '2026'),
        rank('m', 'master', 'epic', '2024'),
        rank('g', 'grandmaster', 'legendary', '2025'),
      ]),
    );
    expect(tied.map((s) => s.short)).toEqual([
      'Grandmaster',
      'Master',
      'Diamond',
    ]);
  });
  it('groups the shelf by game, rarest game first, counting repeats', () => {
    const [shelf] = trophyShelves(stands);
    expect(shelf?.gameName).toBe('League of Legends');
    expect(shelf?.count).toBe(5);
    expect(shelf?.items).toHaveLength(3);
  });
  it('gives every shelf item a place on the stage', () => {
    const many = trophyStands(
      trophyCase(
        Array.from({ length: 12 }, (_, i) =>
          rank(`t${i}`, `tier${i}`, 'common', String(2000 + i)),
        ),
      ),
    );
    expect(many).toHaveLength(12);
    /* The tour walks the rarest few only; everything else is still pickable. */
    expect(trophyTour(many)).toHaveLength(9);
    expect(trophyTour(stands)).toHaveLength(3);
  });
  it('shortens a long title for the shelf and keeps it whole on the stage', () => {
    const [stand] = trophyStands(
      trophyCase([
        {
          ...rank('x', 'gold', 'rare', '2024'),
          kind: 'title',
          ladder: null,
          tier: null,
          season: null,
          title: 'Ace on Ascent, 5 for 5',
        } as PublicTrophy,
      ]),
    );
    expect(stand?.name).toBe('Ace on Ascent, 5 for 5');
    expect(stand?.short).toBe('Ace on Ascent');
  });
});
