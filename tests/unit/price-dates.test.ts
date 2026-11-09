import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { calculateQuote } from '../../src/server/pricing';
import { QUANTITIES } from '../../src/contracts/pricing';
import { servicesFor } from '../../src/design-reference/lib/catalog.js';
import { ranksOf } from '../../src/design-reference/lib/ranks.js';
import {
  formatPrice,
  offerSelection,
  priceSummary,
  seoOffers,
} from '../../src/server/seo/offers';
import { hubOffers, hubPrices, hubServiceIds } from '../../src/server/seo/hub';
import { GUIDE_PRICE_SPECS, guideExamples } from '../../src/server/seo/guide';
import { intentOffers } from '../../src/server/seo/intent-offers';
import { withPrices } from '../../src/server/seo/coaching-examples';
import { intentPages, intentPath } from '../../src/content/intent-pages';
import {
  guideFaq,
  guideForGame,
  renderTokens,
} from '../../src/content/guide-pages';
import { FINISHED_HUB_SLUGS, hubPageFor } from '../../src/content/hub-pages';
import { socialContent } from '../../src/content/hubs';
import { lessons } from '../../src/content/coaching';
import { coachFormats } from '../../src/content/coaching-formats';
import { sessionExamples } from '../../src/content/coaching-examples';
import { gameBySlug } from '../../src/site/games';
import { COACHING_SLUGS } from '../../src/site/seo';
import {
  CATALOG_PRICES_UPDATED,
  CATALOG_PRICES_UPDATED_LABEL,
} from '../../src/site/price-dates';

/**
 * One date for every price the engine renders.
 *
 * #194 raised Duo Plus, Duo Pro and Duo Apex, and about twenty older pages
 * carried a hand-typed "prices as of" day that #194 could not reach: a page
 * stating today's figure under yesterday's date is the one false claim on a
 * page built out of checkable ones. The cure is to stop typing the day at all,
 * which is only safe while the figures beside it really do come from the
 * engine. So this file proves the premise first and the date second:
 *
 *  1. No page copy in scope contains a money figure at all. Every price is a
 *     token the page fills at build time.
 *  2. Every figure those tokens produce is a price `calculateQuote` or
 *     `seoOffers` really charges for that game.
 *  3. Therefore the one date all of them may carry is CATALOG_PRICES_UPDATED,
 *     the day the catalog last moved.
 */

const EUR = { customerCurrency: 'EUR' as const, eurToUsd: 1 };
/** Quote context for pages: the same one `seoOffers` and `hubPrices` use. */
const PAGE_CONTEXT = { ...EUR, firstCoachingSessionEligible: false };

/**
 * Money as these pages write it: "€12.99" from `formatPrice` and "EUR 12.99"
 * from `prosePrice`. "€0" is the free tag on the free-versus-paid cards, which
 * prices a Discord post rather than anything Duoly sells.
 */
const MONEY = /(?:€ ?|EUR |USD )\d+(?:[.,]\d+)*/g;
const money = (value: unknown): string[] => {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return [...text.matchAll(MONEY)].map((match) => match[0]);
};
const FREE = '€0';

/** Every price a page's offers can print, as display and as prose. */
const offerMoney = (offers: ReturnType<typeof seoOffers>) => [
  ...offers.flatMap((offer) => [
    offer.display,
    `EUR ${Number(offer.price)}`,
    `USD ${Number(offer.price)}`,
  ]),
  ...money(priceSummary(offers)),
];

/**
 * Every EUR figure the engine produces for one game's hub: each service it
 * lists, at each rank it sells, in each quantity the page may quote. A hub
 * token that lands outside this set is quoting something checkout will not
 * charge.
 */
const engineGrid = (gameId: string) => {
  const main = (servicesFor(gameId) as { main: string }).main;
  const grid = new Set<string>();
  for (const serviceId of hubServiceIds(gameId)) {
    const ranks = ranksOf(gameId, serviceId) as string[];
    for (const rank of ranks.length ? ranks : [undefined])
      for (const units of [1, 3, 5, 10]) {
        if (
          serviceId !== main &&
          !(QUANTITIES as readonly number[]).includes(units)
        )
          continue;
        const quote = calculateQuote(
          {
            gameId,
            serviceId,
            units,
            ...offerSelection(gameId, serviceId),
            ...(rank ? { rank } : {}),
            ...(units > 1 && serviceId === main
              ? { bundle: true, seats: 1 }
              : {}),
          } as Parameters<typeof calculateQuote>[0],
          PAGE_CONTEXT,
        );
        grid.add(formatPrice(quote.customer.amountMinor, 'EUR'));
      }
  }
  return grid;
};

/** Each offer is its own checkout quote, not a number copied beside one. */
const expectOffersQuoted = (
  offers: ReturnType<typeof seoOffers>,
  label: string,
) => {
  expect(offers.length, label).toBeGreaterThan(0);
  for (const offer of offers) {
    const quote = calculateQuote(offer.selection, PAGE_CONTEXT);
    expect(offer.amountMinor, `${label}: ${offer.id}`).toBe(
      quote.customer.amountMinor,
    );
    expect(offer.display, `${label}: ${offer.id}`).toBe(
      formatPrice(quote.customer.amountMinor, 'EUR'),
    );
  }
};

/** Every figure the rendered copy shows is one the engine produced. */
const expectFiguresFromEngine = (
  rendered: unknown,
  allowed: Iterable<string>,
  label: string,
) => {
  const engine = new Set([...allowed, FREE]);
  const shown = money(rendered);
  expect(shown.length, `${label}: shows no price at all`).toBeGreaterThan(0);
  for (const figure of shown)
    expect(
      engine.has(figure),
      `${label}: ${figure} is not an engine price`,
    ).toBe(true);
};

/** Copy with a money figure typed into it cannot be dated by the catalog. */
const expectNoTypedMoney = (copy: unknown, label: string) => {
  const typed = money(copy).filter((figure) => figure !== FREE);
  expect(typed, `${label}: money typed into the copy`).toEqual([]);
};

/** Every hub on the data-driven template; /games/social keeps its own copy. */
const HUB_SLUGS = FINISHED_HUB_SLUGS.filter((slug) => slug !== 'social');

describe('teammate pages', () => {
  const prices = guideExamples({ eurToUsd: 1 });

  it('fills every token from the pricing engine', () => {
    for (const [token, spec] of Object.entries(GUIDE_PRICE_SPECS))
      expect(prices[token], token).toBe(
        formatPrice(calculateQuote(spec, EUR).customer.amountMinor, 'EUR'),
      );
  });

  it.each(intentPages.map((page) => [intentPath(page), page] as const))(
    '%s shows only engine prices',
    (path, page) => {
      const game = gameBySlug(page.gameSlug)!;
      const offers = intentOffers(page, game.id, EUR);
      expectOffersQuoted(offers, path);
      const guide = guideForGame(page.gameSlug);
      expectNoTypedMoney([page, guide], path);
      expectFiguresFromEngine(
        [
          renderTokens(page, prices),
          guide ? renderTokens(guide, prices) : null,
          guideFaq(page, prices),
        ],
        [...money(Object.values(prices)), ...offerMoney(offers)],
        path,
      );
    },
  );
});

describe('game hubs', () => {
  it.each(HUB_SLUGS)('/games/%s shows only engine prices', (slug) => {
    const path = `/games/${slug}`;
    const game = gameBySlug(slug)!;
    const copy = hubPageFor(slug);
    expect(copy, path).toBeTruthy();
    const groups = hubOffers(game.id, EUR);
    expectOffersQuoted(groups.all, path);
    const tokens = hubPrices(game.id, { eurToUsd: 1 });
    // The token layer itself: every figure it hands the copy is a price the
    // engine charges for this game.
    const grid = engineGrid(game.id);
    for (const figure of money(Object.values(tokens)))
      expect(grid.has(figure), `${path}: token price ${figure}`).toBe(true);
    expectNoTypedMoney(copy, path);
    expectFiguresFromEngine(
      renderTokens(copy, {
        ...tokens,
        from: priceSummary(groups.all),
        from_lower: priceSummary(groups.all).toLowerCase(),
      }),
      [...grid, ...offerMoney(groups.all)],
      path,
    );
  });

  it('/games/social shows only engine prices', () => {
    const offers = seoOffers('social', 'gg', EUR);
    expectOffersQuoted(offers, '/games/social');
    expectNoTypedMoney(socialContent, '/games/social');
  });
});

describe('coaching pages', () => {
  it.each(COACHING_SLUGS)(
    '/games/%s/coaching shows only engine prices',
    (slug) => {
      const path = `/games/${slug}/coaching`;
      const game = gameBySlug(slug)!;
      const offers = seoOffers(game.id, 'training', EUR);
      expectOffersQuoted(offers, path);
      const copy = [
        lessons[slug],
        coachFormats[slug],
        sessionExamples[game.id],
      ];
      expectNoTypedMoney(copy, path);
      expectFiguresFromEngine(
        withPrices(JSON.stringify(copy), offers),
        offerMoney(offers),
        path,
      );
    },
  );
});
describe('the one price date', () => {
  const source = (file: string) => readFileSync(file, 'utf8');

  it('is the day the catalog last moved', () => {
    expect(CATALOG_PRICES_UPDATED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(CATALOG_PRICES_UPDATED_LABEL).toBe('9 November 2026');
  });

  it('is what the shared price block prints', () => {
    const block = source('src/components/seo/Prices.astro');
    expect(block).toContain('CATALOG_PRICES_UPDATED');
    // No page may hand the block a day of its own, so no page can go stale
    // behind the catalog again.
    expect(block).not.toMatch(/updated\??:/);
    expect(block).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it('is what the hub token prints', () => {
    expect(hubPrices('lol', { eurToUsd: 1 }).checked).toBe(
      CATALOG_PRICES_UPDATED_LABEL,
    );
  });

  it('is the only date any price copy carries', () => {
    // A per-page day typed beside an engine price is the bug this pass fixed.
    for (const file of [
      'src/content/intent-pages.ts',
      'src/content/hub-pages.ts',
      'src/content/coaching.ts',
      'src/content/coaching-formats.ts',
      'src/content/hubs.ts',
      'src/server/seo/hub.ts',
      'src/pages/games/[game]/[intent].astro',
      'src/pages/games/[game]/coaching.astro',
      'src/components/seo/GameHub.astro',
      'src/components/seo/Hub.astro',
    ])
      expect(source(file), file).not.toMatch(/\d{1,2} November 20\d\d/);
    expect(source('src/content/intent-pages.ts')).not.toContain(
      'pricesChecked',
    );
  });
});
