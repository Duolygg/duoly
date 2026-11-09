import { describe, expect, it } from 'vitest';

import {
  CATEGORY_HEADINGS,
  CHEAPEST,
  DEAREST,
  FLAT_ROWS,
  PRICE_TABLE,
  ROW_COUNT,
  providerTier,
  serviceTitle,
  spotPrice,
} from '../../src/server/seo/price-table';
import { SERVICE_COUNT } from '../../src/server/seo/booking';
import { calculateQuote } from '../../src/server/pricing';
import { formatPrice, offerSelection } from '../../src/server/seo/offers';
import { servicesFor } from '../../src/design-reference/lib/catalog.js';
import { ranksOf } from '../../src/design-reference/lib/ranks.js';
import { seatRule } from '../../src/contracts/seats';
import { SITE_GAMES } from '../../src/site/games';
import { FINISHED_HUB_SLUGS } from '../../src/content/hub-pages';
import {
  BOOKING_PARAMS,
  parseBookingPreferences,
} from '../../src/contracts/booking-link';

/**
 * /pricing prints the whole catalog, so the whole catalog is re-derived here.
 *
 * The page's promise is that its table equals the pricing engine's output, and
 * a table of 276 rows is exactly the place a hand-copied figure would hide. So
 * every row is priced again through `calculateQuote`, with the same selection,
 * and compared string for string. A catalog price change fails this suite
 * rather than publishing a stale page.
 */

const EUR = { customerCurrency: 'EUR' as const, eurToUsd: 1 };

type Mode = { id: string; cat: string; title: string; tier: string };

const quote = (gameId: string, serviceId: string, rank?: string) =>
  calculateQuote(
    {
      gameId,
      serviceId,
      units: 1,
      ...offerSelection(gameId, serviceId),
      ...(rank ? { rank } : {}),
    } as Parameters<typeof calculateQuote>[0],
    EUR,
  );

const modesOf = (gameId: string) =>
  ((servicesFor(gameId) as { modes?: Mode[] }).modes ?? []) as Mode[];

describe('the shape of the /pricing table', () => {
  it('covers every game in the catalog, in catalog order', () => {
    expect(PRICE_TABLE.map((game) => game.id)).toEqual(
      SITE_GAMES.map((game) => game.id),
    );
    for (const game of PRICE_TABLE) {
      const site = SITE_GAMES.find((entry) => entry.id === game.id)!;
      expect(game.name).toBe(site.name);
      expect(game.slug).toBe(site.slug);
    }
  });

  it('covers every bookable service of every game, once each', () => {
    for (const game of PRICE_TABLE) {
      const ids = modesOf(game.id).map((mode) => mode.id);
      expect([...game.rows].map((row) => row.serviceId).sort()).toEqual(
        [...ids].sort(),
      );
      expect(new Set(game.rows.map((row) => row.serviceId)).size).toBe(
        game.rows.length,
      );
    }
    expect(ROW_COUNT).toBe(SERVICE_COUNT);
  });

  it('groups rows by the categories the page renders, in that order', () => {
    const order = CATEGORY_HEADINGS.map(([category]) => category);
    for (const game of PRICE_TABLE) {
      // Every row belongs to a rendered category, or the page would drop it.
      for (const row of game.rows) expect(order).toContain(row.category);
      const positions = game.rows.map((row) => order.indexOf(row.category));
      expect(positions).toEqual([...positions].sort((a, b) => a - b));
    }
  });

  it('links a game page only where the copy is finished', () => {
    for (const game of PRICE_TABLE)
      expect(game.hubPath, game.slug).toBe(
        FINISHED_HUB_SLUGS.includes(game.slug)
          ? `/games/${game.slug}`
          : undefined,
      );
  });
});

describe('every price in the /pricing table', () => {
  const rows = PRICE_TABLE.flatMap((game) =>
    game.rows.map((row) => ({ game, row })),
  );

  it('has rows to check', () => {
    expect(rows.length).toBeGreaterThan(100);
  });

  it('equals the pricing engine, row by row', () => {
    const problems: string[] = [];
    for (const { game, row } of rows) {
      const ranks = ranksOf(game.id, row.serviceId) as string[];
      const priced = (ranks.length ? ranks : [undefined]).map((rank) => ({
        rank,
        minor: quote(game.id, row.serviceId, rank).customer.amountMinor,
      }));
      const low = Math.min(...priced.map((entry) => entry.minor));
      const high = Math.max(...priced.map((entry) => entry.minor));
      const where = `${game.id}/${row.serviceId}`;
      if (row.from !== formatPrice(low, 'EUR'))
        problems.push(
          `${where}: from ${row.from} vs ${formatPrice(low, 'EUR')}`,
        );
      if (row.to !== formatPrice(high, 'EUR'))
        problems.push(`${where}: to ${row.to} vs ${formatPrice(high, 'EUR')}`);
      // The rank labels belong to the two prices they are printed beside.
      if (ranks.length) {
        const fromRank = priced.find((entry) => entry.minor === low)!.rank;
        const toRank = priced.find((entry) => entry.minor === high)!.rank;
        if (
          row.fromRank !==
          fromRank?.replaceAll('&', 'and').replace(/[–—]/g, ' to ')
        )
          problems.push(`${where}: fromRank ${row.fromRank} vs ${fromRank}`);
        if (
          row.toRank !== toRank?.replaceAll('&', 'and').replace(/[–—]/g, ' to ')
        )
          problems.push(`${where}: toRank ${row.toRank} vs ${toRank}`);
      } else if (row.fromRank || row.toRank)
        problems.push(`${where}: flat service carries a rank label`);
      const engine = quote(game.id, row.serviceId, priced[0]!.rank);
      if (row.unit !== engine.unit)
        problems.push(`${where}: unit ${row.unit} vs ${engine.unit}`);
      if (row.seats !== seatRule(game.id, row.serviceId).default)
        problems.push(`${where}: seats ${row.seats}`);
    }
    expect(problems).toEqual([]);
  });

  it('carries the catalog title and provider tier, with copy rules applied', () => {
    for (const { game, row } of rows) {
      const mode = modesOf(game.id).find(
        (entry) => entry.id === row.serviceId,
      )!;
      expect(row.title).toBe(mode.title.replaceAll('&', 'and'));
      expect(row.tier).toBe(mode.tier.replaceAll('&', 'and'));
      // Customer copy rules: no dashes, no bare ampersand.
      for (const text of [row.title, row.tier])
        expect(text, `${game.id}/${row.serviceId}`).not.toMatch(/[–—]| & /);
    }
  });

  it('opens a checkout the booking contract accepts', () => {
    const problems: string[] = [];
    for (const { game, row } of rows) {
      const url = new URL(row.href, 'https://duoly.gg');
      if (url.pathname !== '/' || url.hash !== '#modes-h')
        problems.push(`${game.id}/${row.serviceId}: ${row.href}`);
      for (const key of url.searchParams.keys())
        if (!(BOOKING_PARAMS as readonly string[]).includes(key))
          problems.push(`${game.id}/${row.serviceId}: unknown param ${key}`);
      const { invalid } = parseBookingPreferences(
        url.searchParams,
        game.id,
        row.serviceId,
      );
      if (invalid.length)
        problems.push(`${game.id}/${row.serviceId}: ${invalid.join(', ')}`);
      if (url.searchParams.get('game') !== game.id)
        problems.push(`${game.id}/${row.serviceId}: wrong game`);
      if (url.searchParams.get('service') !== row.serviceId)
        problems.push(`${game.id}/${row.serviceId}: wrong service`);
    }
    expect(problems).toEqual([]);
  });
});

describe('the figures the /pricing copy quotes beside the table', () => {
  it('names the real cheapest and dearest rows', () => {
    const minor = (value: string) => Math.round(Number(value.slice(1)) * 100);
    const rows = PRICE_TABLE.flatMap((game) => game.rows);
    expect(minor(CHEAPEST.row.from)).toBe(
      Math.min(...rows.map((row) => minor(row.from))),
    );
    expect(minor(DEAREST.row.to)).toBe(
      Math.max(...rows.map((row) => minor(row.to))),
    );
    // The dearest listed figure is a team service, so the page has to say the
    // price covers several hired players rather than one.
    expect(DEAREST.row.seats).toBeGreaterThan(1);
  });

  it('counts the flat-priced services rather than estimating them', () => {
    const rows = PRICE_TABLE.flatMap((game) => game.rows);
    expect(FLAT_ROWS).toBe(rows.filter((row) => row.from === row.to).length);
    expect(FLAT_ROWS).toBeGreaterThan(0);
    expect(FLAT_ROWS).toBeLessThan(ROW_COUNT);
  });

  it('reads a spot price and a provider tier from the catalog', () => {
    expect(spotPrice('lol', 'duo2', 'Gold')).toBe(
      formatPrice(quote('lol', 'duo2', 'Gold').customer.amountMinor, 'EUR'),
    );
    // The tier drops the mode qualifier after the middle dot, so a sentence
    // about who plays the session reads as a rank rather than a product name.
    expect(providerTier('val', 'vod')).toBe(
      modesOf('val')
        .find((mode) => mode.id === 'vod')!
        .tier.split(' · ')[0],
    );
    expect(providerTier('val', 'vod')).not.toContain('·');
    expect(serviceTitle('lol', 'duo2')).toBe('Duo Pro');
  });
});
