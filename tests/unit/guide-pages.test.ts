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
    // Every guide quotes the same bundle percentages, so check them against the
    // headline service of every game with a page, not just the first two.
    for (const units of GUIDE_DISCOUNT_UNITS) {
      for (const token of [
        'lolPro',
        'mrPro',
        'valPro',
        'fnPro',
        'owPro',
        'apexPro',
        'codPro',
        'r6Pro',
      ]) {
        const spec = GUIDE_PRICE_SPECS[token]!;
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
    expect(prices.valPro).toBe('€5.99');
    expect(prices.valPro3).toBe('€16.17');
    expect(prices.fnPro).toBe('€12.49');
    expect(prices.fnPro3).toBe('€33.72');
    expect(prices.owPro).toBe('€3.99');
    expect(prices.owPro3).toBe('€10.77');
    expect(prices.apexPro).toBe('€13.99');
    expect(prices.apexPro3).toBe('€37.77');
    expect(prices.codPro).toBe('€11.49');
    expect(prices.codPro3).toBe('€31.02');
    expect(prices.r6Pro).toBe('€4.49');
    expect(prices.r6Pro3).toBe('€12.12');
    expect([prices.pct3, prices.pct5, prices.pct10]).toEqual([
      '10%',
      '15%',
      '25%',
    ]);
  });

  it('gives every guided teammate page one complete guide', () => {
    // Pokemon Unite stays a shorter page without the free-versus-paid guide.
    expect(GUIDE_PAGES.map((guide) => guide.gameSlug)).toEqual([
      'league-of-legends',
      'marvel-rivals',
      'valorant',
      'fortnite',
      'overwatch-2',
      'apex-legends',
      'call-of-duty',
      'rainbow-six-siege',
    ]);
    for (const guide of GUIDE_PAGES) {
      expect(intentPages.some((page) => page.gameSlug === guide.gameSlug)).toBe(
        true,
      );
      expect(guide.heading.endsWith('?')).toBe(true);
      expect(guide.freeRoutes.length).toBeGreaterThanOrEqual(3);
      expect(guide.freeRoutes.some((route) => route.url)).toBe(true);
      expect(guide.linksNote).toMatch(/8 November 2026/);
      expect(guide.flow).toHaveLength(3);
      expect(guide.priceRows).toHaveLength(3);
      expect(guide.faqExtra).toHaveLength(2);
      if (guide.post) {
        expect(guide.post.heading.endsWith('?')).toBe(true);
        expect(guide.post.fields.length).toBeGreaterThanOrEqual(4);
        for (const field of guide.post.fields)
          expect(field.chips.length).toBeGreaterThanOrEqual(2);
        expect(guide.post.example).toContain('For example');
      }
    }
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
