import { describe, expect, it } from 'vitest';
import { intentPages, intentPath } from '../../src/content/intent-pages';
import { intentOffers } from '../../src/server/seo/intent-offers';
import { calculateQuote } from '../../src/server/pricing';
import { gameBySlug } from '../../src/site/games';
import { CONTENT_DATES, INDEXABLE_PATHS } from '../../src/site/seo';
import { priceSummary, serviceSchema } from '../../src/server/seo/offers';

describe('intent page booking facts', () => {
  it.each(['EUR', 'USD'] as const)(
    'matches every checkout quote in %s',
    (currency) => {
      for (const page of intentPages) {
        const game = gameBySlug(page.gameSlug)!;
        const context = { customerCurrency: currency, eurToUsd: 1.12 };
        const offers = intentOffers(page, game.id, context);
        expect(offers.length).toBeGreaterThan(0);
        expect(new Set(offers.map((offer) => offer.id))).toEqual(
          new Set(Object.keys(page.services)),
        );
        for (const offer of offers) {
          const quote = calculateQuote(offer.selection, context);
          expect(offer.amountMinor).toBe(quote.customer.amountMinor);
          expect(offer.currency).toBe(quote.customer.currency);
        }
        const schema = serviceSchema(
          page.h1,
          intentPath(page),
          offers,
          new URL('https://duoly.gg'),
        );
        expect(schema.offers.map((offer) => offer.price)).toEqual(
          offers.map((offer) => offer.price),
        );
        const description = page.description(
          priceSummary(offers).toLowerCase(),
        );
        expect(description.length).toBeGreaterThanOrEqual(140);
        expect(description.length).toBeLessThanOrEqual(160);
      }
    },
  );
  it('publishes three distinct finished pages with honest revision dates', () => {
    expect(intentPages).toHaveLength(3);
    for (const page of intentPages) {
      expect(INDEXABLE_PATHS).toContain(intentPath(page));
      expect(CONTENT_DATES[intentPath(page)]).toBe('2026-11-06');
      expect(page.title.length).toBeLessThanOrEqual(60);
      expect(page.faq.length).toBeGreaterThanOrEqual(5);
      expect(JSON.stringify(page)).not.toMatch(/[—–&]/);
    }
  });
});
