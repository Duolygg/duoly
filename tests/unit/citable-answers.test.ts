import { describe, expect, it } from 'vitest';
import { calculateQuote } from '../../src/server/pricing';
import {
  BUNDLE_UNITS,
  quantityDiscountPercent,
} from '../../src/contracts/pricing';
import { seoOffers } from '../../src/server/seo/offers';
import {
  pricesAnswer,
  quantityAnswer,
  closingAnswer,
  offerList,
} from '../../src/server/seo/citable-answers';
import { GUIDE_PRICE_SPECS, guideExamples } from '../../src/server/seo/guide';
import { intentPages } from '../../src/content/intent-pages';
import { renderTokens } from '../../src/content/guide-pages';

const games = [
  'val',
  'lol',
  'rl',
  'fn',
  'tft',
  'apex',
  'mr',
  'cs2',
  'ow',
  'r6',
] as const;
describe('self-contained SEO answers use checkout prices', () => {
  for (const game of games)
    for (const customerCurrency of ['EUR', 'USD'] as const) {
      it(`${game} ${customerCurrency}: standard prices, units and quantity rules match checkout`, () => {
        const context = {
          customerCurrency,
          eurToUsd: 1.17,
          firstCoachingSessionEligible: false,
        };
        const offers = seoOffers(game, 'training', context);
        const answer = pricesAnswer(game, offers, true);
        expect(answer).not.toMatch(/0%|We found|checked on|EUR \d|USD \d/);
        expect(answer).toMatch(/hourly|by the hour|an hour/);
        for (const offer of offers) {
          const quote = calculateQuote(offer.selection, context);
          const price = `${quote.customer.currency} ${quote.customer.amountMinor / 100} per ${quote.unit}`;
          expect(closingAnswer(game)).not.toContain(price);
          expect(offerList(offers)).toContain(`${offer.title} at ${price}`);
          for (const units of [2, 3, 4, 5]) {
            const bulk = calculateQuote({ ...offer.selection, units }, context);
            expect(bulk.quantityDiscountPercent).toBe(0);
          }
        }
        expect(quantityAnswer(offers)).toBe(
          'Quantity discounts and bundles do not apply to coaching.',
        );
        if (offers.every((offer) => offer.unit === 'hour')) {
          expect(quantityAnswer(offers)).not.toContain('games');
        }
      });
    }

  it('Unite named examples and bundles equal the calculator for the stated rank and server', () => {
    const prices = guideExamples({ eurToUsd: 1 });
    for (const [token, spec] of Object.entries(GUIDE_PRICE_SPECS).filter(
      ([token]) => token.startsWith('pu'),
    )) {
      const quote = calculateQuote(spec, {
        customerCurrency: 'EUR',
        eurToUsd: 1,
      });
      expect(prices[token]).toBe(
        `€${(quote.customer.amountMinor / 100).toFixed(2)}`,
      );
      if (spec.rank) expect(spec.rank).toBe('Expert');
      expect(spec.server).toBe('Europe');
    }
    const page = intentPages.find((page) => page.gameSlug === 'pokemon-unite')!;
    expect(JSON.stringify(renderTokens(page, prices))).not.toMatch(/\{\{/);
    for (const units of [3, 5, 10]) {
      const quote = calculateQuote(
        { ...GUIDE_PRICE_SPECS.puPro!, units, bundle: true },
        { customerCurrency: 'EUR', eurToUsd: 1 },
      );
      expect(prices[`pct${units}`]).toBe(`${quote.quantityDiscountPercent}%`);
    }
    const offers = seoOffers('pu', 'teammate', {
      customerCurrency: 'EUR',
      eurToUsd: 1,
    });
    const answer = pricesAnswer('pu', offers, false);
    expect(answer).toContain('price for your rank');
    expect(answer).not.toContain('We found');
    const quantity = quantityAnswer(offers);
    const ordinary = quantityDiscountPercent(5);
    expect(quantity).toContain(`5 games take ${ordinary}% off`);
    expect(quantity).toContain(
      `${quantityDiscountPercent(3, { bundle: true })}% off 3 games`,
    );
    expect(quantity).toContain(
      `${quantityDiscountPercent(10, { bundle: true })}% off 10`,
    );
    // A bundle of 5 carries the same percentage as an ordinary order of 5, and
    // the bundle ladder states it anyway: the price cards show all three bundle
    // chips, so a ladder missing its middle step reads as an omission.
    expect(quantityDiscountPercent(5, { bundle: true })).toBe(ordinary);
    expect(quantity).toContain(`${ordinary}% off 5`);
    for (const units of BUNDLE_UNITS)
      expect(quantity, `${units} unit bundle`).toContain(
        `${quantityDiscountPercent(units, { bundle: true })}% off ${units}`,
      );
  });
});
