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
import { type IntentPage, intentPages } from '../../src/content/intent-pages';

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
          `${calculateQuote({ ...spec, units, bundle: true }, eur).quantityDiscountPercent}%`,
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
      '20%',
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

  // The six teammate guides added in this branch; League and Marvel Rivals keep
  // the PR #180 copy, so the repetition rules below are asserted on these only.
  const HEADLINE_TOKEN: Record<string, string> = {
    valorant: 'valPro',
    fortnite: 'fnPro',
    'overwatch-2': 'owPro',
    'apex-legends': 'apexPro',
    'call-of-duty': 'codPro',
    'rainbow-six-siege': 'r6Pro',
  };

  /**
   * The price tables on a teammate page: the free-versus-paid bundle rows and
   * the "How much does ... cost?" section. Everything else is running prose.
   */
  const priceTables = (
    guide: (typeof GUIDE_PAGES)[number],
    page: IntentPage,
  ) => [
    guide.priceRows,
    page.sections.filter((section) => section.heading.startsWith('How much')),
  ];

  it('states each teammate price in a table plus at most one prose mention', () => {
    for (const guide of GUIDE_PAGES) {
      if (!HEADLINE_TOKEN[guide.gameSlug]) continue;
      const page = intentPages.find(
        (entry) => entry.gameSlug === guide.gameSlug,
      )!;
      const tables = allText(priceTables(guide, page));
      const prose = allText([
        { ...guide, priceRows: [] },
        {
          ...page,
          sections: page.sections.filter(
            (section) => !section.heading.startsWith('How much'),
          ),
        },
      ]);
      // Every price the page shows has a table it belongs to.
      const values = [...tables.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]!);
      expect(values.length).toBeGreaterThan(3);
      // No price is quoted twice outside those tables.
      for (const token of new Set([
        ...values,
        ...[...prose.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]!),
      ])) {
        if (token.startsWith('pct')) continue;
        expect(
          prose.split(`{{${token}}}`).length - 1,
          `${guide.gameSlug}: ${token} in prose`,
        ).toBeLessThanOrEqual(1);
      }
      // The free card sells nothing: no price token and no paid bundle percent.
      const freeCard = allText([
        guide.freeIntro,
        guide.freeRoutes,
        guide.freeGets,
      ]);
      expect(freeCard).not.toMatch(/\{\{/);
      // €0 is the Free tag plus at most one mention in the free card copy.
      expect(allText(guide).split('€0').length).toBeLessThanOrEqual(2);
    }
  });

  it('dates the teammate pages once for links and once for prices', () => {
    for (const guide of GUIDE_PAGES) {
      if (!HEADLINE_TOKEN[guide.gameSlug]) continue;
      const page = intentPages.find(
        (entry) => entry.gameSlug === guide.gameSlug,
      )!;
      // The links note is the only dated claim written into the copy; the price
      // date is rendered from pricesChecked under the cards instead.
      expect(guide.linksNote).toMatch(/8 November 2026/);
      expect(page.pricesChecked).toBe('2026-11-08');
      const copy = [
        renderTokens({ ...guide, linksNote: '' }, prices),
        renderTokens({ ...page, pricesChecked: undefined }, prices),
        guideFaq(page, prices),
      ];
      // Walk the visible strings so a failure names the sentence, not the page.
      const strings = (value: unknown): string[] =>
        typeof value === 'string'
          ? [value]
          : Array.isArray(value)
            ? value.flatMap(strings)
            : value && typeof value === 'object'
              ? Object.values(value).flatMap(strings)
              : [];
      for (const text of strings(copy))
        expect(text, `${guide.gameSlug}: year in copy`).not.toMatch(
          /\b(?:19|20)\d\d\b/,
        );
    }
  });

  it('gives every hero fact something the heading does not already say', () => {
    for (const page of intentPages) {
      if (!HEADLINE_TOKEN[page.gameSlug]) continue;
      expect(page.facts.length).toBeGreaterThanOrEqual(4);
      const heading = `${page.h1} ${page.lead}`.toLowerCase();
      for (const fact of page.facts)
        expect(heading).not.toContain(fact.toLowerCase());
      expect(new Set(page.facts).size).toBe(page.facts.length);
    }
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
