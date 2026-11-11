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
