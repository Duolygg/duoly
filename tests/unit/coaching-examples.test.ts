import { describe, expect, it } from 'vitest';
import { lessons } from '../../src/content/coaching';
import { sessionExamples } from '../../src/content/coaching-examples';
import {
  bookingAnswer,
  compareOthers,
  exampleOffers,
  sessionLead,
  withPrices,
} from '../../src/server/seo/coaching-examples';
import { seoOffers } from '../../src/server/seo/offers';
import { calculateQuote } from '../../src/server/pricing';
import { gameBySlug } from '../../src/site/games';

const currencies = ['EUR', 'USD'] as const;

describe('coaching example pricing', () => {
  for (const game of ['lol', 'val', 'mr', 'rl', 'fn', 'tft', 'apex']) {
    for (const customerCurrency of currencies) {
      it(`${game} ${customerCurrency}: every training service has an example with the helper price and unit`, () => {
        const context = { customerCurrency, eurToUsd: 1.17 };
        const offers = seoOffers(game, 'training', context);
        const examples = exampleOffers(game, offers);
        expect(examples.map((example) => example.offer.id)).toEqual(
          offers.map((offer) => offer.id),
        );
        for (const { offer, example } of examples) {
          const quote = calculateQuote(offer.selection, context);
          expect(offer.unit).toBe(quote.unit);
          expect(offer.amountMinor).toBe(quote.customer.amountMinor);
          expect(example.steps).toHaveLength(4);
          expect(example.takeaways).toHaveLength(3);
          expect(sessionExamples[game]?.[offer.id]).toBe(example);
          if (offer.unit === 'hour')
            expect(example.steps.map((step) => step.at)).toEqual([
              '0 min',
              '10 min',
              '30 min',
              '50 min',
            ]);
          else expect(example.steps[0]?.at).toBe('Before');
          const price = `${offer.display} per ${quote.unit}`;
          expect(sessionLead('Game', offer, example.goal)).toContain(price);
          for (const other of offers.filter((item) => item.id !== offer.id))
            expect(compareOthers(offers, offer.id)).toContain(
              `${other.title} at ${other.display} per ${other.unit}`,
            );
        }
      });
    }
  }
});

describe('coaching page copy prices', () => {
  for (const [slug, lesson] of Object.entries(lessons)) {
    const game = gameBySlug(slug)!;
    for (const customerCurrency of currencies) {
      it(`${slug} ${customerCurrency}: every price placeholder resolves to the helper price`, () => {
        const offers = seoOffers(game.id, 'training', {
          customerCurrency,
          eurToUsd: 1.17,
        });
        const copy = [
          lesson.format,
          lesson.prepare,
          ...lesson.sections.flatMap((section) => section.paragraphs),
          ...lesson.faq.flat(),
        ];
        for (const text of copy) {
          const filled = withPrices(text, offers);
          expect(filled).not.toMatch(/\{price:/);
          for (const [, id] of text.matchAll(/\{price:([a-z0-9]+)\}/g)) {
            const offer = offers.find((item) => item.id === id)!;
            const quote = calculateQuote(offer.selection, {
              customerCurrency,
              eurToUsd: 1.17,
            });
            expect(filled).toContain(`${offer.display} per ${quote.unit}`);
          }
        }
        expect(bookingAnswer(game.name, offers)).toContain(
          `${offers[0]!.display} per ${offers[0]!.unit}`,
        );
      });
    }
  }

  it('throws on a placeholder for a service the game does not sell', () => {
    const offers = seoOffers('mr', 'training', {
      customerCurrency: 'EUR',
      eurToUsd: 1.17,
    });
    expect(() => withPrices('{price:vod}', offers)).toThrow();
  });

  it('keeps example and page copy free of long dashes and ampersands', () => {
    const text = JSON.stringify([sessionExamples, lessons]);
    expect(text).not.toMatch(/[\u2013\u2014]| & /);
  });
});
