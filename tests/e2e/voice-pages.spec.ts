import { expect, test } from '@playwright/test';

for (const [path, priceCount] of [
  ['/about', 2],
  ['/press', 2],
  ['/ai', 1],
] as const) {
  test(`${path} keeps reader-facing copy free of padding and joined words`, async ({
    page,
  }) => {
    await page.goto(path);
    const text = await page.locator('article').innerText();
    expect(text).not.toMatch(
      /pricing engine|checkout engine|generated from|on each deploy|first commit|code base|scorer|citability|rather than/i,
    );
    expect((text.match(/for example/gi) ?? []).length).toBeLessThanOrEqual(1);
    expect((text.match(/€/g) ?? []).length).toBe(priceCount);
    expect(text).not.toMatch(
      /\d+(?:games|teammate)|(?:the|or|and|Read|Browse|read|use)(?:Duoly|pricing|trust|the|your)|(?:costs|in)€|services\.get_quote|yourself\.ChatGPT/,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}

/**
 * The same rule on the rest of the public pages, in its hard form only.
 *
 * A customer page may never describe how Duoly is built. "Read from Duoly
 * checkout in November 2026" after a price, "generated from the pricing
 * engine" under a table and "the pricing code" in a sentence all shipped once,
 * because a citability scorer rewards attribution-shaped phrases, and the copy
 * learned to produce them. A price is a fact to a reader, so these pages state
 * the price and nothing about where it came from.
 *
 * Deliberately narrower than the /about check above: that page is short enough
 * to cap "for example" and count its euro signs, while a price table or a
 * developer reference cannot be held to either. What is banned here is banned
 * everywhere, on every one of these pages, forever.
 */
const VOICE_PAGES = [
  '/blog',
  '/blog/what-is-an-egirl',
  '/blog/what-does-lfg-mean',
  '/blog/how-to-find-a-valorant-duo',
  '/blog/how-to-choose-a-gaming-coach',
  '/blog/free-lfg-or-paid-teammate',
  '/compare/e-pal',
  '/compare/metafy',
  '/compare/queueup',
  '/reports/gaming-coaching-and-teammate-prices-2026',
  '/trust-and-safety',
  '/pricing',
  '/how-it-works',
  '/get-paid-to-play-games',
  '/games',
  '/find-gaming-buddies',
  '/fees-and-refunds',
  '/developers/mcp',
  '/coaching',
];
for (const path of VOICE_PAGES) {
  test(`${path} never explains Duoly's own machinery to a reader`, async ({
    page,
  }) => {
    await page.goto(path);
    const text = await page.locator('article, main').first().innerText();
    expect(text).not.toMatch(
      /pricing engine|checkout engine|pricing code|pricing calculator|generated from|generated at build|on each deploy|read from (?:Duoly )?checkout|first commit|code base|repository|scorer|citability/i,
    );
    // House copy rules: no em or en dash, no ampersand, no "not X, but Y".
    // URLs are exempt from the ampersand rule, because the one on
    // /developers/mcp is a real booking link whose query string a developer
    // has to copy character for character.
    const prose = text.replace(/https?:\/\/\S+/g, '');
    expect(prose).not.toMatch(/[—–&]|not [^.]*, but/i);
  });
}
