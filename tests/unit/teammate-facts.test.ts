import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const mcpGuide = readFileSync(
  new URL('../../src/pages/developers/mcp.astro', import.meta.url),
  'utf8',
).replace(/\s+/g, ' ');

it('the MCP guide separates coaching quotes from teammate bundle discounts', () => {
  const quote = calculateQuote(
    { gameId: 'val', serviceId: 'vod', server: 'EU', units: 5 },
    { customerCurrency: 'EUR', eurToUsd: 1 },
  );
  expect(quote.quantityDiscountPercent).toBe(0);
  expect(mcpGuide).toContain('Coaching has no quantity discount.');
  expect(mcpGuide).not.toContain('before a {bundle[0]}%');
  expect(mcpGuide).not.toContain('and a ten unit total with');
});
import { calculateQuote } from '../../src/server/pricing';
import { servicesFor } from '../../src/design-reference/lib/catalog.js';
import { ranksOf } from '../../src/design-reference/lib/ranks.js';
import { GAMES } from '../../src/design-reference/lib/games.js';
import { formatPrice } from '../../src/server/seo/offers';
import {
  BUNDLE_PERCENTS,
  COACHABLE_GAMES,
  COACHING_PRICE,
  PLAYABLE_GAMES,
  SHARE_PERCENT,
  SHORT_GAME_PRICE,
  SOCIAL_MODES,
  SOCIAL_PRICE,
  VALORANT_GG_PRICE,
} from '../../src/server/seo/teammate-facts';

// The copy on /games, /ai, /blog, /developers/mcp and /get-paid-to-play-games
// prints these figures. Each one has to equal what the pricing engine and the
// catalog actually return, so a catalog edit fails here rather than publishing a
// price the checkout disagrees with.

const quote = (
  game: string,
  service: string,
  units: number,
  rank?: string,
  bundle = false,
) =>
  calculateQuote(
    {
      gameId: game,
      serviceId: service,
      server: game === 'social' ? 'Europe' : 'EU',
      units,
      bundle,
      ...(rank ? { rank } : {}),
    } as Parameters<typeof calculateQuote>[0],
    { customerCurrency: 'EUR', eurToUsd: 1 },
  );

describe('teammate facts come from the pricing engine', () => {
  it('states the real teammate share', () => {
    const flat = quote('val', 'vod', 1);
    expect(SHARE_PERCENT).toBe(
      Math.round((flat.teammate.amountMinor / flat.customer.amountMinor) * 100),
    );
    expect(SHARE_PERCENT).toBeGreaterThan(0);
    expect(SHARE_PERCENT).toBeLessThan(100);
  });

  it('states the real bundle discounts at 3, 5 and 10 units', () => {
    expect(BUNDLE_PERCENTS).toEqual(
      [3, 5, 10].map(
        (units) =>
          quote('val', 'duo2', units, 'Gold', true).quantityDiscountPercent,
      ),
    );
    // Rising tiers: the copy says a bigger bundle saves more.
    expect(BUNDLE_PERCENTS[0]).toBeLessThan(BUNDLE_PERCENTS[1]!);
    expect(BUNDLE_PERCENTS[1]).toBeLessThan(BUNDLE_PERCENTS[2]!);
  });

  it('states prices the checkout would charge', () => {
    expect(COACHING_PRICE).toBe(
      formatPrice(quote('val', 'vod', 1).customer.amountMinor, 'EUR'),
    );
    expect(SHORT_GAME_PRICE).toBe(
      formatPrice(quote('val', 'skirm', 1).customer.amountMinor, 'EUR'),
    );
    expect(SOCIAL_PRICE).toBe(
      formatPrice(quote('social', 'chat', 1).customer.amountMinor, 'EUR'),
    );
    expect(VALORANT_GG_PRICE).toBe(
      formatPrice(quote('val', 'gg1', 1).customer.amountMinor, 'EUR'),
    );
  });

  it('claims the cheapest Valorant game, not merely a cheap one', () => {
    // Rank-priced services need a rank and flat ones reject it, and only the
    // engine knows which is which, so price every service at every rank and at
    // no rank, and keep whatever the engine accepts.
    const valorant = servicesFor('val') as { modes: { id: string }[] };
    const amounts = valorant.modes.flatMap((mode) => {
      const ranks = [
        undefined,
        ...((ranksOf('val', mode.id) ?? []) as string[]),
      ];
      return ranks.flatMap((rank) => {
        try {
          return [quote('val', mode.id, 1, rank).customer.amountMinor];
        } catch {
          return [];
        }
      });
    });
    expect(amounts.length).toBeGreaterThan(valorant.modes.length);
    expect(SHORT_GAME_PRICE).toBe(formatPrice(Math.min(...amounts), 'EUR'));
  });

  it('counts games out of the catalog', () => {
    const games = GAMES as { id: string }[];
    expect(PLAYABLE_GAMES).toBe(games.filter((g) => g.id !== 'social').length);
    expect(COACHABLE_GAMES).toBe(
      games.filter((game) =>
        (
          servicesFor(game.id) as { modes?: { cat: string }[] } | undefined
        )?.modes?.some((mode) => mode.cat === 'training'),
      ).length,
    );
    expect(SOCIAL_MODES).toBe(
      (servicesFor('social') as { modes: unknown[] }).modes.length,
    );
  });
});
