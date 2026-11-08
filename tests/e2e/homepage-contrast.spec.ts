import { test, expect } from '@playwright/test';

test('homepage hints and FAQ numbers meet AA text contrast', async ({
  page,
}) => {
  await page.goto('/');
  const hints = page
    .locator(
      '.ht-limit, .mp-opt, #faq button[aria-controls] > span:first-child',
    )
    .or(page.getByText('· sets the price', { exact: true }));
  await expect(hints.first()).toBeVisible();
  const ratios = await hints.evaluateAll((elements) => {
    const rgb = (value: string) => value.match(/[\d.]+/g)!.map(Number);
    const luminance = (values: number[]) =>
      values
        .slice(0, 3)
        .map((v) => {
          const s = v / 255;
          return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        })
        .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
    return elements.map((element) => {
      let parent: Element | null = element;
      let background = 'rgb(9, 4, 20)';
      while (parent) {
        const value = getComputedStyle(parent).backgroundColor;
        if (rgb(value).length === 3 || rgb(value)[3] === 1) {
          background = value;
          break;
        }
        parent = parent.parentElement;
      }
      const foreground = luminance(rgb(getComputedStyle(element).color));
      const back = luminance(rgb(background));
      return {
        text: element.textContent,
        ratio:
          (Math.max(foreground, back) + 0.05) /
          (Math.min(foreground, back) + 0.05),
      };
    });
  });
  expect(ratios.length).toBeGreaterThanOrEqual(6);
  for (const { text, ratio } of ratios)
    expect(ratio, text ?? '').toBeGreaterThanOrEqual(4.5);
});

test('homepage brand art and preset avatars offer right-sized sources', async ({
  page,
}) => {
  await page.goto('/');
  const wordmark = page
    .locator('img[src="/assets/brand/logo-wordmark.webp"]')
    .first();
  await expect(wordmark).toHaveAttribute('srcset', /104w/);
  const hero = page.locator('img[src="/assets/brand/logo-full.webp"]');
  await expect(hero).toHaveAttribute('srcset', /1120w/);
  const avatar = page
    .locator('img[src="/assets/avatars/avatar-1.png"]')
    .first();
  await expect(avatar).toHaveAttribute('srcset', /156w/);
});
