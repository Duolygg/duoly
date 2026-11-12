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
      await expect(page.locator('.tp-booking .tp-primary')).toHaveText(
        'Book a Valorant teammate→',
      );
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
  await expect(page.locator('.tp-booking .tp-primary')).toHaveAttribute(
    'href',
    /game=val.*teammate=nyx/,
  );
  await context.close();
});
