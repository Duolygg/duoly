import { expect, test, type Page } from '@playwright/test';
import { seoOffers } from '../../src/server/seo/offers';
import { hubOffers } from '../../src/server/seo/hub';
import { heroOffer, hubHeroOffer } from '../../src/server/seo/hero-offer';

/**
 * The phone booking bar (src/components/seo/StickyBook.astro).
 *
 * Everything here is behaviour a reader can feel: it is absent until the hero
 * button is gone, it steps aside for the cookie banner and for the closing CTA
 * that offers the same link, it covers nothing at the end of the page, and it
 * does not exist at all on a desktop viewport.
 */
const bar = '[data-sticky-book-bar]';
const link = `${bar} a`;

const scrollTo = (page: Page, y: number | 'end') =>
  page.evaluate(
    (top) =>
      window.scrollTo(0, top === 'end' ? document.body.scrollHeight : top),
    y,
  );

const shown = (page: Page) =>
  page
    .locator(bar)
    .evaluate((node) => getComputedStyle(node).visibility === 'visible');

test.describe('phone booking bar', () => {
  test('rides along once the hero CTA is gone, and yields where it should', async ({
    page,
  }, testInfo) => {
    test.skip(
      (testInfo.project.use.viewport?.width ?? 1280) > 700,
      'phone only by design',
    );
    await page.goto('/games/valorant');
    // The bar exists from first paint but is hidden, so it is out of the tab
    // order for a reader who has not scrolled.
    await expect(page.locator(bar)).toHaveCount(1);
    expect(await shown(page)).toBe(false);

    await scrollTo(page, 1400);
    await expect
      .poll(() => shown(page), { message: 'bar appears past the hero' })
      .toBe(true);

    // The price and the button come from the pricing engine, not from copy.
    const offer = hubHeroOffer(
      'val',
      hubOffers('val', { customerCurrency: 'EUR', eurToUsd: 1 }).all,
    )!;
    await expect(page.locator(`${bar} .money`)).toHaveText(offer.price);
    await expect(page.locator(link)).toHaveText(`Book ${offer.title}`);
    await expect(page.locator(link)).toHaveAttribute('href', offer.href);

    // The closing CTA offers the same booking link full width: one button for
    // one action, so the fixed one gets out of its way.
    await page
      .locator('.closing .cta')
      .scrollIntoViewIfNeeded()
      .catch(() => undefined);
    await page.evaluate(() =>
      document.querySelector('.closing')?.scrollIntoView({ block: 'center' }),
    );
    await expect
      .poll(() => shown(page), { message: 'bar hides over the closing CTA' })
      .toBe(false);

    // At the very bottom the page reserves the bar's height, so the bar sits
    // in reserved space rather than on top of the footer.
    await scrollTo(page, 'end');
    await expect.poll(() => shown(page)).toBe(true);
    const clear = await page.evaluate(() => {
      const node = document.querySelector('[data-sticky-book-bar]')!;
      const reserved = parseFloat(
        getComputedStyle(document.body).paddingBottom,
      );
      return reserved >= node.getBoundingClientRect().height;
    });
    expect(clear).toBe(true);
  });

  test('stays out of the way while the cookie banner is open', async ({
    browser,
  }, testInfo) => {
    test.skip(
      (testInfo.project.use.viewport?.width ?? 1280) > 700,
      'phone only by design',
    );
    // A context with no consent cookie: the banner owns the bottom edge.
    // `newContext` inside a test inherits the project's options, including the
    // consent cookie every other spec wants, so this one clears it by hand.
    const context = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });
    const page = await context.newPage();
    await page.goto('/games/valorant/coaching');
    await expect(page.locator('[data-cookie-banner]')).toBeVisible();
    await scrollTo(page, 1400);
    await page.waitForTimeout(300);
    expect(await shown(page)).toBe(false);

    await page.locator('[data-consent="necessary"]').click();
    await expect
      .poll(() => shown(page), {
        message: 'bar takes over once the banner goes',
      })
      .toBe(true);

    const offer = heroOffer(
      'val',
      seoOffers('val', 'training', { customerCurrency: 'EUR', eurToUsd: 1 })[0]!
        .id,
      seoOffers('val', 'training', { customerCurrency: 'EUR', eurToUsd: 1 }),
    )!;
    await expect(page.locator(link)).toHaveAttribute('href', offer.href);
    await context.close();
  });

  test('does not exist on a desktop viewport', async ({ page }, testInfo) => {
    test.skip(
      (testInfo.project.use.viewport?.width ?? 1280) <= 700,
      'desktop only check',
    );
    await page.goto('/games/valorant');
    await expect(page.locator(bar)).toHaveCount(1);
    await expect(page.locator('.sticky-book')).toHaveCSS('display', 'none');
    expect(
      await page.evaluate(() => getComputedStyle(document.body).paddingBottom),
    ).toBe('0px');
  });
});
