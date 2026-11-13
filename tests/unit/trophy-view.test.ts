import { describe, expect, it } from 'vitest';
import {
  trophyCase,
  trophyView,
  trophyOffset,
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
