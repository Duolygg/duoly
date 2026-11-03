import { describe, expect, it } from 'vitest';
import {
  SAMPLE_HERO_QUOTES,
  heroQuote,
  heroQuotes,
} from '../../src/components/home/HeroQuotes';

const real = (quote: string, i: number) => ({
  quote,
  name: 'Player' + i,
  country: 'de',
  game: 'lol',
  stars: 5,
});

describe('hero quotes', () => {
  it('takes a short first sentence from a review', () => {
    expect(heroQuote('Felt like duoing with a coach. We won five.')).toBe(
      'Felt like duoing with a coach.',
    );
    expect(heroQuote('Too short.')).toBeNull();
    expect(heroQuote('x'.repeat(80) + '.')).toBeNull();
  });

  it('uses the samples until there are enough real quotes', () => {
    expect(heroQuotes([])).toBe(SAMPLE_HERO_QUOTES);
    expect(heroQuotes([real('Felt like duoing with a coach.', 1)])).toBe(
      SAMPLE_HERO_QUOTES,
    );
    const four = [
      'Felt like duoing with a coach.',
      'Matched in a minute and won.',
      'Best comms I have had in ranked.',
      'Booked one game, stayed for five.',
    ].map(real);
    expect(heroQuotes(four).map((t) => t.quote)).toEqual(
      four.map((t) => t.quote),
    );
  });

  it('keeps every sample short enough to read in passing', () => {
    for (const t of SAMPLE_HERO_QUOTES)
      expect(String(t.quote).length).toBeLessThanOrEqual(72);
  });
});
