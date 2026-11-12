import { test, expect } from '@playwright/test';
import { seoOffers } from '../../src/server/seo/offers';
const port = Number(process.env.DUOLY_PROFILE_TEST_PORT ?? 4389);
for (const slug of ['nyx', 'sola', 'kairo'])
  test(`${slug}: SSR, one name, one live price and no overflow`, async ({
    page,
    isMobile,
  }) => {
    const response = await page.goto(`/teammates/${slug}`);
    expect(response?.status()).toBe(200);
    expect(response?.headers()['cache-control']).toBe('no-store');
    await expect(page.locator('main h1')).toHaveCount(1);
    await expect(page.locator('main h1')).toHaveText(
      slug === 'nyx' ? 'Nyx' : slug === 'sola' ? 'Sola' : 'Kairo',
    );
    const game = slug === 'kairo' ? 'lol' : 'val';
    const offer = seoOffers(game, 'teammate', {
      eurToUsd: 1,
      customerCurrency: 'EUR',
    }).sort((a, b) => a.amountMinor - b.amountMinor)[0]!;
    await expect(page.locator('[data-profile-price]')).toContainText(
      offer.display,
    );
    const text = await page.locator('article.tp-page').innerText();
    expect(text.split(offer.display)).toHaveLength(2);
    expect(text).not.toMatch(/[–—&]/);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(page.locator('.tp-mobile-booking')).toBeVisible({
      visible: isMobile,
    });
    /* Nothing on a profile is allowed to render below 13px. */
    expect(
      await page.evaluate(() =>
        [...document.querySelectorAll('article.tp-page *')]
          .filter(
            (el) =>
              [...el.childNodes].some(
                (n) => n.nodeType === 3 && n.textContent!.trim(),
              ) && el.getClientRects().length,
          )
          .map((el) => ({
            at: el.className || el.tagName,
            size: parseFloat(getComputedStyle(el).fontSize),
          }))
          .filter((row) => row.size < 13),
      ),
    ).toEqual([]);
    expect((await response!.text()).includes('profile-name')).toBe(true);
    const schema = await page
      .locator('script[type="application/ld+json"]')
      .textContent();
    expect(schema).not.toMatch(/AggregateRating|ratingValue|"@type":"Review"/);
    if (slug === 'sola') {
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
        'content',
        'noindex, follow',
      );
      await expect(page.locator('.tp-scoreboard')).toContainText(
        'A fresh face',
      );
      await expect(page.locator('.tp-scoreboard')).not.toContainText(
        'Customer rating',
      );
      await expect(page.locator('.tp-cta .tp-primary')).toHaveText(
        'Book a Valorant teammate',
      );
      await expect(page.locator('.tp-cta .tp-ghost')).toHaveCount(0);
    }
  });
test('301, 410 and missing status codes', async ({ request }) => {
  const moved = await request.get('/teammates/nyxie', { maxRedirects: 0 });
  expect(moved.status()).toBe(301);
  expect(moved.headers().location).toBe('/teammates/nyx');
  const gone = await request.get('/teammates/ghost');
  expect(gone.status()).toBe(410);
  expect(await gone.text()).toContain('noindex, follow');
  expect((await request.get('/teammates/unknown')).status()).toBe(404);
});
test('flag off uses normal 404 and sitemap omits discovery', async ({
  request,
}) => {
  for (const path of ['/teammates/nyx', '/teammates', '/teammates/ghost'])
    expect(
      (await request.get(`http://127.0.0.1:${port + 1}${path}`)).status(),
    ).toBe(404);
  expect(
    await (
      await request.get(`http://127.0.0.1:${port + 1}/sitemap.xml`)
    ).text(),
  ).not.toContain('/teammates');
});
test('directory filters on the server and sitemap uses quality', async ({
  page,
  request,
}) => {
  await page.goto('/teammates?game=lol');
  await expect(page.locator('.tp-card')).toHaveCount(4);
  expect(await page.locator('.tp-card').first().getAttribute('href')).toBe(
    '/teammates/nyx',
  );
  const xml = await (await request.get('/sitemap.xml')).text();
  expect(xml).toContain('/teammates/nyx');
  expect(xml).not.toContain('/teammates/sola');
  expect(xml).toContain('<lastmod>2026-11-12T12:00:00.000Z</lastmod>');
});
test('core content and booking links work without JavaScript', async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${port}/teammates/nyx`);
  await expect(page.locator('#games')).toContainText('Immortal 3');
  await expect(page.locator('.tp-cta .tp-primary')).toHaveAttribute(
    'href',
    /game=val.*teammate=nyx/,
  );
  await expect(page.locator('.tp-mobile-booking')).toHaveCount(1);
  await context.close();
});

test('one booking verb, one arrow glyph and reviews without text stay quiet', async ({
  page,
}) => {
  await page.goto('/teammates/nyx');
  const article = page.locator('article.tp-page');
  await expect(article).not.toContainText('Queue with');
  await expect(article).not.toContainText('Fictional review');
  for (const label of await page
    .locator('a:has-text("Book"), .tp-mobile-booking a')
    .allInnerTexts())
    expect(label.trim().startsWith('Book')).toBe(true);
  /* Every arrow on the page is the same inline SVG, and no card carries one. */
  expect(
    await page.evaluate(() => {
      const text = document.querySelector('article.tp-page')!.textContent ?? '';
      return [...text].filter((c) => '\u2192\u2191\u2197\u279C'.includes(c))
        .length;
    }),
  ).toBe(0);
  await expect(page.locator('.tp-card svg')).toHaveCount(0);
  /* Four written reviews minus the one with no text: a lead plus an even grid. */
  await expect(page.locator('.tp-review-lead')).toHaveCount(1);
  await expect(page.locator('.tp-review-grid .tp-review')).toHaveCount(2);
  await expect(page.locator('.tp-tags .tp-tag').first()).toContainText(
    '74 mentions',
  );
  /* Tabs and the headings they point at use the same names. */
  for (const tab of await page.locator('.tp-tabs a').all()) {
    const name = (await tab.innerText()).trim();
    await expect(
      page.locator(`${await tab.getAttribute('href')} h2`),
    ).toHaveText(name);
  }
});

test('the sticky bar steps aside while a booking block is on screen', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'the sticky bar only exists on small screens');
  await page.goto('/teammates/nyx');
  const bar = page.locator('.tp-mobile-booking');
  await expect(bar).toHaveClass(/is-stowed/);
  await page.locator('#games').scrollIntoViewIfNeeded();
  await expect(bar).not.toHaveClass(/is-stowed/);
  await page.locator('[data-closing]').scrollIntoViewIfNeeded();
  await expect(bar).toHaveClass(/is-stowed/);
});
