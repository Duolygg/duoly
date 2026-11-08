import { describe, expect, it } from 'vitest';
import { intentPages, intentPath } from '../../src/content/intent-pages';
import { intentOffers } from '../../src/server/seo/intent-offers';
import { calculateQuote } from '../../src/server/pricing';
import { gameBySlug } from '../../src/site/games';
import { CONTENT_DATES, INDEXABLE_PATHS } from '../../src/site/seo';
import { priceSummary, serviceSchema } from '../../src/server/seo/offers';
import { bookTeammateLabel } from '../../src/site/seo';

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
  it('publishes nine distinct finished pages with honest revision dates', () => {
    expect(intentPages).toHaveLength(9);
    // The six teammate pages added in November 2026 carry their own date.
    const added = new Set([
      '/games/valorant/lfg',
      '/games/fortnite/duos',
      '/games/overwatch-2/lfg',
      '/games/apex-legends/lfg',
      '/games/call-of-duty/lfg',
      '/games/rainbow-six-siege/lfg',
    ]);
    for (const page of intentPages) {
      const path = intentPath(page);
      expect(INDEXABLE_PATHS).toContain(path);
      expect(CONTENT_DATES[path]).toBe(
        added.has(path) ? '2026-11-08' : '2026-11-06',
      );
      expect(page.title.length).toBeLessThanOrEqual(60);
      expect(page.faq.length).toBeGreaterThanOrEqual(5);
      expect(JSON.stringify(page)).not.toMatch(/[—–&]/);
    }
    expect(
      intentPages.map(intentPath).filter((path) => added.has(path)),
    ).toHaveLength(added.size);
    expect(new Set(intentPages.map(intentPath)).size).toBe(intentPages.length);
    // One page per game keeps intentForGame unambiguous on hubs and /games.
    expect(new Set(intentPages.map((page) => page.gameSlug)).size).toBe(
      intentPages.length,
    );
  });

  it('writes the booking call to action with the right article', () => {
    expect(bookTeammateLabel('Valorant')).toBe('Book a Valorant teammate');
    expect(bookTeammateLabel('Apex Legends')).toBe(
      'Book an Apex Legends teammate',
    );
    expect(bookTeammateLabel('Overwatch 2')).toBe(
      'Book an Overwatch 2 teammate',
    );
  });

  it('only advertises duo services the catalog sells for that game', () => {
    for (const page of intentPages) {
      const game = gameBySlug(page.gameSlug)!;
      const offers = intentOffers(page, game.id, {
        customerCurrency: 'EUR',
        eurToUsd: 1,
      });
      expect(Object.keys(page.services).length).toBeGreaterThanOrEqual(3);
      for (const id of Object.keys(page.services)) {
        const matching = offers.filter((offer) => offer.id === id);
        expect(matching.length).toBeGreaterThan(0);
        expect(matching[0]!.cat).toBe('duo');
        // Short service blurbs keep the price cards scannable.
        expect(page.services[id]!.split(/\s+/).length).toBeLessThanOrEqual(20);
      }
    }
  });
});
