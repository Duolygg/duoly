import { describe, expect, it } from 'vitest';
import { GAME_HUBS } from '../../src/content/game-hubs';
import { gameBySlug } from '../../src/site/games';
import { seoOffers } from '../../src/server/seo/offers';
import { hubHeroOffer, mainServiceId } from '../../src/server/seo/hero-offer';
import {
  priceNote,
  quantityAnswer,
} from '../../src/server/seo/citable-answers';

const context = { eurToUsd: 1.17, customerCurrency: 'EUR' as const };

describe('plain offer copy keeps the service and engine price together', () => {
  for (const hub of GAME_HUBS) {
    it(`${hub.gameSlug} names a distinct tier fact and quotes its own service`, () => {
      const game = gameBySlug(hub.gameSlug)!;
      const offers = seoOffers(game.id, 'teammate', context);
      const main = mainServiceId(game.id);
      const offer = hubHeroOffer(game.id, offers, hub.services[main])!;
      const rows = offers.filter((row) => row.id === main);
      const cheapest = rows.reduce((a, b) =>
        a.amountMinor < b.amountMinor ? a : b,
      );
      expect(offer.price).toContain(cheapest.display);
      expect(offer.tier).toBe(cheapest.tier);
      expect(offer.facts[0].toLowerCase()).not.toBe(offer.tier.toLowerCase());
      expect(offer.facts[0]).not.toMatch(/[–—]| & /);
      expect(quantityAnswer(offers)).toContain(cheapest.title);
      expect(quantityAnswer(offers)).toContain('services without bundles');
      expect(priceNote(offers)).not.toContain('For example,');
      expect(priceNote(offers)).toContain(
        'Payment finishes on duoly.gg. You play on your own account',
      );
    });
  }
  it('coaching describes its own price rules without advertising teammate savings', () => {
    const offers = seoOffers('val', 'training', context);
    expect(priceNote(offers, true)).toContain(
      'quantity discounts and bundles do not apply',
    );
    expect(priceNote(offers, true)).not.toMatch(/\d+%/);
  });
});
