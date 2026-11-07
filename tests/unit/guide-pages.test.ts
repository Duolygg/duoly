import { describe, expect, it } from 'vitest';
import { calculateQuote } from '../../src/server/pricing';
import { formatPrice } from '../../src/server/seo/offers';
import {
  GUIDE_DISCOUNT_UNITS,
  GUIDE_PRICE_SPECS,
  guideExamples,
} from '../../src/server/seo/guide';
import {
  GUIDE_PAGES,
  guideFaq,
  renderGuideText,
  renderTokens,
} from '../../src/content/guide-pages';
import { intentPages } from '../../src/content/intent-pages';

const context = { eurToUsd: 1 };
const eur = { ...context, customerCurrency: 'EUR' as const };
const prices = guideExamples(context);
const allText = (value: unknown): string => JSON.stringify(value);

describe('free versus paid guide', () => {
  it('quotes every price token straight from the pricing engine', () => {
    for (const [token, spec] of Object.entries(GUIDE_PRICE_SPECS)) {
      expect(prices[token]).toBe(
        formatPrice(calculateQuote(spec, eur).customer.amountMinor, 'EUR'),
      );
    }
    for (const units of GUIDE_DISCOUNT_UNITS) {
      for (const gameId of ['lol', 'mr']) {
        const spec =
          gameId === 'lol'
            ? GUIDE_PRICE_SPECS.lolPro!
            : GUIDE_PRICE_SPECS.mrPro!;
        expect(prices[`pct${units}`]).toBe(
          `${calculateQuote({ ...spec, units }, eur).quantityDiscountPercent}%`,
        );
      }
    }
  });

  it('pins the headline examples shown on the pages', () => {
    expect(prices.lolPro).toBe('€3.99');
    expect(prices.lolPro3).toBe('€10.77');
    expect(prices.mrPro).toBe('€3.49');
    expect(prices.mrPro3).toBe('€9.42');
    expect([prices.pct3, prices.pct5, prices.pct10]).toEqual([
      '10%',
      '15%',
      '25%',
    ]);
  });

  it('fills every token on both pages and fails on unknown tokens', () => {
    for (const guide of GUIDE_PAGES) {
      const page = intentPages.find(
        (entry) => entry.gameSlug === guide.gameSlug,
      )!;
      const rendered = allText([
        renderTokens(guide, prices),
        renderTokens(page, prices),
        guideFaq(page, prices),
      ]);
      expect(rendered).not.toMatch(/\{\{/);
    }
    expect(() => renderGuideText('{{nope}}', prices)).toThrow(/nope/);
  });

  it('adds the guide questions to the visible FAQ', () => {
    const page = intentPages.find((p) => p.gameSlug === 'league-of-legends')!;
    const faq = guideFaq(page, prices);
    expect(faq).toHaveLength(page.faq.length + 2);
    expect(faq.at(-1)![1]).toContain('€10.77');
  });

  it('keeps the copy style rules', () => {
    for (const guide of GUIDE_PAGES) {
      const page = intentPages.find(
        (entry) => entry.gameSlug === guide.gameSlug,
      )!;
      const text = allText([guide, page]);
      expect(text).not.toMatch(/[—–]/);
      expect(text).not.toContain(' & ');
      for (const route of guide.freeRoutes) {
        if (route.url) expect(route.url).toMatch(/^https:\/\//);
      }
    }
  });
});
