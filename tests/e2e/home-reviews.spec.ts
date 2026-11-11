import { expect, test, type Page } from '@playwright/test';
import { SAMPLE_TESTIMONIALS } from '../../src/components/home/sampleTestimonials';
import { PHONE_ROW_CARDS } from '../../src/components/home/Testimonials.jsx';

/**
 * The homepage review strip, in a real browser at both widths.
 *
 * The server cannot know the viewport, so it sends every visitor the phone sample of the
 * reviews and the wider layouts fill the rows in from their first client render
 * (src/components/home/Testimonials.jsx). The unit tests cover the markup the server writes;
 * these two cover what each screen ends up with, which is the part a reader sees: a phone keeps
 * a fraction of the cards, a desktop keeps all of them, both read the same score and the same
 * review count off the full set, and the loop still fills the screen either way.
 */
const PHONE = 700;
const listItems = '.rv-set[role="list"] > [role="listitem"]';

/**
 * The rows, scrolled to and laid out. offscreen.css skips them until then, and skipped content
 * has no layout, so the track can only be measured once the row is near the viewport.
 */
const rowGeometry = async (page: Page) => {
  await page.evaluate(() =>
    document.querySelector('.rv')!.scrollIntoView({ block: 'start' }),
  );
  await page.waitForTimeout(600);
  return page.evaluate(() =>
    [...document.querySelectorAll('.rv-row')].map((row) => {
      const style = getComputedStyle(row);
      const reserved =
        style.containIntrinsicHeight || style.containIntrinsicBlockSize;
      const track = row.querySelector('.rv-track')!;
      return {
        height: row.getBoundingClientRect().height,
        reserved: Number(/([\d.]+)px/.exec(reserved)?.[1] ?? NaN),
        padding: parseFloat(style.paddingTop) + parseFloat(style.paddingBottom),
        // the track holds two loops and drifts by exactly one of them
        loop: track.getBoundingClientRect().width / 2,
      };
    }),
  );
};

test.describe('homepage reviews', () => {
  test('a phone drifts through a sample of the reviews', async ({
    page,
  }, testInfo) => {
    const width = testInfo.project.use.viewport?.width ?? 1280;
    test.skip(width > PHONE, 'phone only by design');
    await page.goto('/');

    // 6 reviews per row, each row copied once for the loop: 24 cards, not 200.
    await expect(page.locator('.rv-card')).toHaveCount(PHONE_ROW_CARDS * 4);
    await expect(page.locator('.rv-set[role="list"]')).toHaveCount(2);
    await expect(page.locator(listItems)).toHaveCount(PHONE_ROW_CARDS * 2);
    // the copies stay out of the accessibility tree
    await expect(page.locator('.rv-set[aria-hidden="true"]')).toHaveCount(2);

    // the score and the count are still the whole set
    await expect(page.locator('.rv-count')).toHaveText(
      `from ${SAMPLE_TESTIMONIALS.length} reviews`,
    );

    for (const row of await rowGeometry(page)) {
      // one loop is wider than the screen, so the drift never reaches an empty strip
      expect(row.loop).toBeGreaterThan(width * 1.5);
      // and the height offscreen.css reserves while the row is skipped is the height it has
      expect(row.height - row.padding).toBeCloseTo(row.reserved, 2);
    }

    // nothing hangs off the side of the page
    const overflow = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      view: window.innerWidth,
    }));
    expect(overflow.scroll).toBeLessThanOrEqual(overflow.view);
  });

  test('a desktop still gets every review', async ({ page }, testInfo) => {
    const width = testInfo.project.use.viewport?.width ?? 1280;
    test.skip(width <= PHONE, 'desktop only check');
    await page.goto('/');

    await expect(page.locator(listItems)).toHaveCount(
      SAMPLE_TESTIMONIALS.length,
    );
    await expect(page.locator('.rv-card')).toHaveCount(
      SAMPLE_TESTIMONIALS.length * 2,
    );
    await expect(page.locator('.rv-count')).toHaveText(
      `from ${SAMPLE_TESTIMONIALS.length} reviews`,
    );
    for (const row of await rowGeometry(page)) {
      expect(row.loop).toBeGreaterThan(width * 1.5);
      expect(row.height - row.padding).toBeCloseTo(row.reserved, 2);
    }
  });
});
