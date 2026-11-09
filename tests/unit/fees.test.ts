import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  AUTO_CANCEL_MINUTES,
  BUNDLE_PERCENTS,
  BUNDLE_SIZES,
  CATALOG_PRICES_UPDATED,
  COACHING_HOUR,
  FIVE_COACHING_HOURS,
  FIVE_GAMES,
  MAX_QUANTITY,
  PRICE_EXAMPLES,
  QUANTITY_PERCENT,
  SINGLE_GAME,
  TEN_GAME_BUNDLE,
  USD_MARGIN_PERCENT,
} from '../../src/server/seo/fees';
import {
  BUNDLE_DISCOUNT_PERCENT,
  BUNDLE_UNITS,
  QUANTITIES,
} from '../../src/contracts/pricing';
import { calculateQuote } from '../../src/server/pricing';
import { formatPrice } from '../../src/server/seo/offers';
import { serversFor } from '../../src/design-reference/lib/servers.js';
import {
  BOOKING_PARAMS,
  parseBookingPreferences,
} from '../../src/contracts/booking-link';
import { TERMS } from '../../src/design-reference/lib/legal';

const EUR = { customerCurrency: 'EUR' as const, eurToUsd: 1 };

/** The same selection the fees page quotes, priced through the real engine. */
const quote = (
  gameId: string,
  serviceId: string,
  units: number,
  rank?: string,
  bundle = false,
) =>
  calculateQuote(
    {
      gameId,
      serviceId,
      server: (serversFor(gameId) as [string, ...unknown[]][])[0]![0],
      units,
      bundle,
      ...(rank ? { rank } : {}),
    } as Parameters<typeof calculateQuote>[0],
    EUR,
  );

/**
 * /fees-and-refunds is the page a reader will hold Duoly to, and ChatGPT said
 * on 9 November 2026 that the fee structure could not be verified. So every
 * figure the page prints is re-derived here from `calculateQuote`, and every
 * rule it states is matched against the text of the terms. A catalog price
 * change fails this suite rather than publishing a stale claim.
 */
describe('the price examples on /fees-and-refunds', () => {
  const selections: [
    (typeof PRICE_EXAMPLES)[number],
    string,
    string,
    number,
    string | undefined,
    boolean,
  ][] = [
    [SINGLE_GAME, 'lol', 'duo2', 1, 'Gold', false],
    [FIVE_GAMES, 'lol', 'duo2', MAX_QUANTITY, 'Gold', false],
    [TEN_GAME_BUNDLE, 'lol', 'duo2', 10, 'Gold', true],
    [COACHING_HOUR, 'val', 'vod', 1, undefined, false],
    [FIVE_COACHING_HOURS, 'val', 'vod', MAX_QUANTITY, undefined, false],
  ];

  it('covers exactly the rows the page renders', () => {
    expect(PRICE_EXAMPLES).toEqual(selections.map(([example]) => example));
  });

  it.each(selections)(
    'states the engine total for $1 $2',
    (example, gameId, serviceId, units, rank, bundle) => {
      const one = quote(gameId, serviceId, 1, rank);
      const many = quote(gameId, serviceId, units, rank, bundle);
      expect(example.perUnit).toBe(
        formatPrice(one.customer.amountMinor, 'EUR'),
      );
      expect(example.total).toBe(formatPrice(many.customer.amountMinor, 'EUR'));
      expect(example.unit).toBe(many.unit);
      expect(example.units).toBe(units);
      expect(example.discountPercent).toBe(many.quantityDiscountPercent);
      expect(example.saved).toBe(formatPrice(many.discountEurMinor, 'EUR'));
    },
  );

  it.each(selections)(
    'links a checkout the booking contract accepts for $1 $2',
    (example, gameId, serviceId, units, rank) => {
      const url = new URL(example.href, 'https://duoly.gg');
      expect(url.pathname).toBe('/');
      expect(url.hash).toBe('#modes-h');
      expect(url.searchParams.get('game')).toBe(gameId);
      expect(url.searchParams.get('service')).toBe(serviceId);
      for (const key of url.searchParams.keys())
        expect(BOOKING_PARAMS as readonly string[], key).toContain(key);
      const { values, invalid } = parseBookingPreferences(
        url.searchParams,
        gameId,
        serviceId,
      );
      expect(invalid).toEqual([]);
      if (rank) expect(values.rank).toBe(rank);
      if (units > 1) expect(values.qty).toBe(units);
    },
  );

  it('keeps coaching out of every quantity discount', () => {
    expect(COACHING_HOUR.discountPercent).toBe(0);
    expect(FIVE_COACHING_HOURS.discountPercent).toBe(0);
    expect(FIVE_COACHING_HOURS.saved).toBe('€0.00');
    // Five hours cost five times one hour, which is what the page claims.
    expect(quote('val', 'vod', MAX_QUANTITY).customer.amountMinor).toBe(
      quote('val', 'vod', 1).customer.amountMinor * MAX_QUANTITY,
    );
  });
});

describe('the discount figures the page advertises', () => {
  it('matches the pricing contract', () => {
    expect(MAX_QUANTITY).toBe(QUANTITIES[QUANTITIES.length - 1]);
    expect(BUNDLE_SIZES).toEqual([...BUNDLE_UNITS]);
    expect(BUNDLE_PERCENTS).toEqual(
      BUNDLE_UNITS.map((units) => BUNDLE_DISCOUNT_PERCENT[units]),
    );
    expect(QUANTITY_PERCENT).toBeGreaterThan(0);
    // The quantity picker's largest step and the five-unit bundle agree, which
    // is why the page can state one number for "five".
    expect(QUANTITY_PERCENT).toBe(BUNDLE_DISCOUNT_PERCENT[MAX_QUANTITY]);
  });
});

describe('the policy figures the page quotes', () => {
  const terms = JSON.stringify(TERMS);

  it('takes the currency margin and the auto-cancel window from the terms', () => {
    expect(terms).toContain(`currency margin (${USD_MARGIN_PERCENT}%)`);
    expect(terms).toContain(
      `Nobody accepts within ${AUTO_CANCEL_MINUTES} minutes`,
    );
  });

  it('quotes the cancellation and refund rules verbatim', () => {
    const page = readFileSync('src/pages/fees-and-refunds.astro', 'utf8');
    // Straight quotes in the terms, typographic quotes on the page: compare the
    // sentences themselves, with the page's smart apostrophes normalised back.
    const normalise = (text: string) =>
      text.replaceAll('’', "'").replace(/\s+/g, ' ');
    for (const sentence of [
      'The price you see at checkout is the price you pay.',
      'Cancel any time in your order room, free of charge. The full amount goes back to your Duoly balance.',
      'The order cancels itself automatically and the full amount goes back to your Duoly balance.',
      'No-show, a teammate leaving, toxic behaviour: report it from your order room. A real person reviews it and can refund the order to your balance.',
    ]) {
      expect(normalise(terms), sentence).toContain(normalise(sentence));
      expect(normalise(page), sentence).toContain(normalise(sentence));
    }
  });

  it('dates the catalog prices in one shared place', () => {
    expect(CATALOG_PRICES_UPDATED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Date.parse(CATALOG_PRICES_UPDATED)).toBeLessThanOrEqual(Date.now());
    expect(
      readFileSync('src/pages/fees-and-refunds.astro', 'utf8'),
    ).not.toMatch(/const PRICES_UPDATED = '20/);
  });
});
