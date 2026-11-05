import { expect, test } from '@playwright/test';
import { COACHING_SLUGS, INDEXABLE_PATHS } from '../../src/site/seo';
import { seoOffers } from '../../src/server/seo/offers';
import { gameBySlug } from '../../src/site/games';
const pages = [
  ...COACHING_SLUGS.map((slug) => `/games/${slug}/coaching`),
  '/games/social',
  '/games/valorant',
  '/blog/what-is-an-egirl',
  '/get-paid-to-play-games',
];
for (const path of pages) {
  test(`SEO SSR and no-JS content ${path}`, async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    const response = await page.goto(
      `http://127.0.0.1:4321${path}?utm_source=test`,
    );
    expect(response?.status()).toBe(200);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `https://duoly.gg${path}`,
    );
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      'index, follow',
    );
    expect(response?.headers()['x-robots-tag'] ?? '').not.toContain('noindex');
    const text = await page.locator('article.seo-page').innerText();
    // The application page is a short, direct pitch; the rest carry game detail.
    expect(text.split(/\s+/).length).toBeGreaterThan(
      path === '/get-paid-to-play-games' ? 450 : 600,
    );
    expect(text).not.toMatch(/[—–&]|not [^.]*, but/i);
    expect(text).not.toMatch(
      /catalog|illustrative|at the normal price|final quote|account-specific|practis|availability/i,
    );
    const schemas = await page
      .locator('script[type="application/ld+json"]')
      .allTextContents();
    expect(schemas.length).toBeGreaterThan(0);
    for (const schema of schemas)
      expect(JSON.parse(schema)['@context']).toBe('https://schema.org');
    if (
      path.endsWith('/coaching') ||
      path === '/games/social' ||
      path === '/games/valorant'
    ) {
      const slug = path.split('/')[2]!;
      const game = gameBySlug(slug)!;
      const offers = seoOffers(
        game.id,
        slug === 'social'
          ? 'gg'
          : path.endsWith('/coaching')
            ? 'training'
            : 'teammate',
        {
          eurToUsd: 1,
        },
      );
      await expect(page.locator('[data-price-minor]')).toHaveCount(
        offers.length,
      );
      for (const offer of offers)
        await expect(
          page.locator(
            `[data-service="${offer.id}"]${offer.rank ? `[data-rank="${offer.rank}"]` : ''}`,
          ),
        ).toContainText(`€${offer.price}`);
      await expect(page.locator('a.cta').first()).toHaveAttribute(
        'href',
        new RegExp(`^/\\?game=${game.id}`),
      );
      await expect(page.locator('section.closing a.cta')).toHaveCount(1);
      const service = schemas
        .map((schema) => JSON.parse(schema))
        .find((schema) => schema['@type'] === 'Service');
      expect(
        service.offers.map((offer: { price: string }) => offer.price),
      ).toEqual(offers.map((offer) => offer.price));
    }
    await context.close();
  });
}
test('sitemap URLs are indexable 200s; private and placeholder pages stay out', async ({
  request,
}) => {
  const xml = await (await request.get('/sitemap.xml')).text();
  for (const path of INDEXABLE_PATHS) {
    expect(xml).toContain(`https://duoly.gg${path}</loc>`);
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    expect(await response.text(), path).toMatch(
      /name="robots" content="index, follow"/,
    );
  }
  for (const path of [
    '/login',
    '/reset-password',
    '/apply',
    '/imprint',
    '/games/fortnite',
  ]) {
    const response = await request.get(path);
    expect(await response.text()).toMatch(/name="robots" content="noindex,/);
    expect(xml).not.toContain(`https://duoly.gg${path}</loc>`);
  }
  for (const path of [
    '/games/not-a-game',
    '/games/not-a-game/coaching',
    '/games/counter-strike-2/coaching',
    '/blog/not-an-article',
  ])
    expect((await request.get(path)).status(), path).toBe(404);
});

test('a coaching CTA deep link opens the homepage on that game and service', async ({
  page,
}) => {
  await page.goto('/?game=lol&service=vod#modes-h');
  await expect(
    page.getByRole('button', { name: /VOD Review/ }).first(),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page).toHaveURL(/\/#modes-h$/);
  await expect(
    page.getByRole('tab', { name: /Coaching/ }).first(),
  ).toHaveAttribute('aria-selected', 'true');
});
