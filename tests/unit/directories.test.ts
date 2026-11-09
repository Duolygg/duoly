import { describe, expect, it } from 'vitest';
import {
  coachingDirectory,
  directoryPrice,
  teammateDirectory,
} from '../../src/server/seo/directories';
import { calculateQuote } from '../../src/server/pricing';
import { servicesFor } from '../../src/design-reference/lib/catalog.js';
import { SITE_GAMES } from '../../src/site/games';
import { COACHING_SLUGS, INDEXABLE_PATHS } from '../../src/site/seo';
import { intentForGame, intentPath } from '../../src/content/intent-pages';

const currencies = ['EUR', 'USD'] as const;

describe('all-games directories', () => {
  for (const customerCurrency of currencies) {
    const context = { customerCurrency, eurToUsd: 1.17 };

    it(`${customerCurrency}: every coaching price shown is the checkout price`, () => {
      const games = coachingDirectory(context);
      expect(games.length).toBeGreaterThan(0);
      for (const game of games) {
        expect(game.offers.length).toBeGreaterThan(0);
        for (const offer of game.offers) {
          const quote = calculateQuote(offer.selection, context);
          expect(offer.amountMinor).toBe(quote.customer.amountMinor);
          expect(offer.currency).toBe(quote.customer.currency);
          expect(offer.unit).toBe(quote.unit);
          expect(offer.cat).toBe('training');
        }
        // The card shows the cheapest offer, so it has to be the cheapest.
        const lowest = Math.min(
          ...game.offers.map((offer) => offer.amountMinor),
        );
        expect(game.cheapest.amountMinor).toBe(lowest);
      }
    });

    it(`${customerCurrency}: every teammate price shown is the checkout price`, () => {
      const games = teammateDirectory(context);
      expect(games.length).toBeGreaterThan(0);
      for (const game of games) {
        for (const offer of game.offers) {
          const quote = calculateQuote(offer.selection, context);
          expect(offer.amountMinor).toBe(quote.customer.amountMinor);
          expect(offer.currency).toBe(quote.customer.currency);
        }
        expect(game.cheapest.amountMinor).toBe(
          Math.min(...game.offers.map((offer) => offer.amountMinor)),
        );
      }
    });

    it(`${customerCurrency}: the directory price line names the cheapest offer`, () => {
      for (const games of [
        coachingDirectory(context),
        teammateDirectory(context),
      ]) {
        const offers = games.flatMap((game) => game.offers);
        const cheapest = [...offers].sort(
          (a, b) => a.amountMinor - b.amountMinor,
        )[0]!;
        const line = directoryPrice(games);
        expect(line).toContain(cheapest.display);
        for (const unit of new Set(offers.map((offer) => offer.unit)))
          expect(line).toContain(`per ${unit}`);
        // Coaching is one flat price everywhere, so its line carries no "From".
        const flat = offers.every(
          (offer) => offer.amountMinor === cheapest.amountMinor,
        );
        expect(line.startsWith('From ')).toBe(!flat);
      }
    });
  }

  it('lists exactly the games whose catalog entry sells that category', () => {
    const context = { customerCurrency: 'EUR' as const, eurToUsd: 1 };
    const sells = (gameId: string, cats: string[]) =>
      (
        servicesFor(gameId) as { modes: { cat: string; id: string }[] }
      ).modes.some((mode) => cats.includes(mode.cat) && mode.id !== 'skirm');
    const playable = SITE_GAMES.filter((game) => game.slug !== 'social');
    expect(coachingDirectory(context).map((game) => game.slug)).toEqual(
      playable
        .filter((game) => sells(game.id, ['training']))
        .map((game) => game.slug),
    );
    expect(teammateDirectory(context).map((game) => game.slug)).toEqual(
      playable
        .filter((game) => sells(game.id, ['duo', 'social']))
        .map((game) => game.slug),
    );
  });

  it('points every card at a page that is really in the sitemap', () => {
    const context = { customerCurrency: 'EUR' as const, eurToUsd: 1 };
    for (const game of coachingDirectory(context)) {
      expect(game.path).toBe(
        game.dedicated ? `/games/${game.slug}/coaching` : `/games/${game.slug}`,
      );
      expect(game.dedicated).toBe(
        (COACHING_SLUGS as readonly string[]).includes(game.slug),
      );
      expect(INDEXABLE_PATHS).toContain(game.path);
    }
    for (const game of teammateDirectory(context)) {
      const intent = intentForGame(game.slug);
      expect(game.path).toBe(
        intent ? intentPath(intent) : `/games/${game.slug}`,
      );
      expect(game.dedicated).toBe(Boolean(intent));
      expect(INDEXABLE_PATHS).toContain(game.path);
    }
  });

  it('keeps the two directory pages in the sitemap', () => {
    expect(INDEXABLE_PATHS).toContain('/coaching');
    expect(INDEXABLE_PATHS).toContain('/find-gaming-buddies');
    expect(INDEXABLE_PATHS).toContain('/blog/what-does-lfg-mean');
  });
});
