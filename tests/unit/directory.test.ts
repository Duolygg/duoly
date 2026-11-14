import { describe, expect, it } from 'vitest';
import type { PublicTeammateCard } from '../../src/contracts/teammate-profile';
import {
  applyFilters,
  filtered,
  readFilters,
  sortCards,
} from '../../src/server/teammates/directory';

const card = (over: Partial<PublicTeammateCard>): PublicTeammateCard => ({
  slug: 'x',
  name: 'X',
  avatar: '/assets/avatars/avatar-1.png',
  accent: 'lavender',
  tier: 'rookie',
  online: false,
  game: 'val',
  rank: null,
  rating: null,
  games: ['val'],
  languages: ['English'],
  vibeTags: [],
  coaching: false,
  quote: null,
  ...over,
});
const nyx = card({
  slug: 'nyx',
  name: 'Nyx',
  online: true,
  rank: 'Immortal 3',
  rating: { average: 4.9, count: 128 },
  languages: ['German', 'English'],
  vibeTags: ['Shotcaller'],
  coaching: true,
});
const kai = card({
  slug: 'kai',
  name: 'Kairo',
  rating: { average: 4.9, count: 420 },
  vibeTags: ['Patient'],
});
const pip = card({
  slug: 'pip',
  name: 'Pip',
  online: true,
  rating: { average: 4.2, count: 9 },
  languages: ['Dutch'],
});
const all = [kai, pip, nyx];
const read = (q: string) => readFilters(new URLSearchParams(q));

describe('directory filters', () => {
  it('reads only known values from the query string', () => {
    const f = read('style=Hacker&sort=cheapest&online=yes&q=%20ny%20');
    expect(f.style).toBeNull();
    expect(f.sort).toBe('recommended');
    expect(f.online).toBe(false);
    expect(f.q).toBe('ny');
    expect(filtered(f)).toBe(true);
    expect(filtered(read(''))).toBe(false);
  });

  it('filters by name, availability, language, play style, coaching and verified rank', () => {
    expect(applyFilters(all, read('q=KAI')).map((c) => c.slug)).toEqual([
      'kai',
    ]);
    expect(
      applyFilters(all, read('online=1'))
        .map((c) => c.slug)
        .sort(),
    ).toEqual(['nyx', 'pip']);
    expect(applyFilters(all, read('lang=German')).map((c) => c.slug)).toEqual([
      'nyx',
    ]);
    expect(applyFilters(all, read('style=Patient')).map((c) => c.slug)).toEqual(
      ['kai'],
    );
    expect(applyFilters(all, read('coaching=1')).map((c) => c.slug)).toEqual([
      'nyx',
    ]);
    expect(applyFilters(all, read('verified=1')).map((c) => c.slug)).toEqual([
      'nyx',
    ]);
    expect(
      applyFilters(all, read('online=1&lang=Dutch')).map((c) => c.slug),
    ).toEqual(['pip']);
  });

  it('sorts: online first, top rated with reviews breaking ties, most reviewed', () => {
    expect(
      sortCards(all, 'recommended')
        .slice(0, 2)
        .map((c) => c.online),
    ).toEqual([true, true]);
    expect(sortCards(all, 'rated').map((c) => c.slug)).toEqual([
      'kai',
      'nyx',
      'pip',
    ]);
    expect(sortCards(all, 'reviews').map((c) => c.slug)).toEqual([
      'kai',
      'nyx',
      'pip',
    ]);
  });

  it('treats a card from an older database without the new fields as matching nothing it lacks', () => {
    const old = card({
      slug: 'old',
      languages: undefined,
      vibeTags: undefined,
      coaching: undefined,
    });
    expect(applyFilters([old], read('lang=English'))).toEqual([]);
    expect(applyFilters([old], read('coaching=1'))).toEqual([]);
    expect(applyFilters([old], read(''))).toHaveLength(1);
  });
  it('filters to verified Gamer Girls', () => {
    const gg = card({
      slug: 'mira',
      name: 'Mira',
      gamerGirl: true,
      game: 'social',
    });
    expect(applyFilters([...all, gg], read('gg=1')).map((c) => c.slug)).toEqual(
      ['mira'],
    );
    expect(filtered(read('gg=1'))).toBe(true);
  });
});
