import { test, expect } from '@playwright/test';
import { fixtureLookup } from '../../src/server/teammates/profile-fixtures';
import { profilePresentation } from '../../src/server/teammates/profile-page';
import { recommendFor } from '../../src/server/teammates/recommend';

for (const [slug, count] of [
  ['nyx', 1],
  ['nyx-two', 2],
  ['nyx-six', 6],
] as const) {
  test(`${count} featured games: header and booking stay coherent`, async ({
    page,
    isMobile,
  }) => {
    await page.goto(`/teammates/${slug}`);
    await expect(page.locator('[data-featured-rank]:visible')).toHaveCount(
      Math.min(count, isMobile ? 2 : 3),
    );
    await expect(page.locator('[data-featured-rank]').first()).toContainText(
      'Valorant, Immortal 3',
    );
    const group = page.getByRole('radiogroup', { name: 'Book a session in' });
    if (count === 1) {
      await expect(group).toHaveCount(0);
      return;
    }
    await expect(group.getByRole('radio')).toHaveCount(count);
    await expect(page.locator('[data-featured-rank="lol"]')).toContainText(
      'League of Legends, Master',
    );
    await expect(
      page.locator('[data-featured-rank="lol"] [role="img"]'),
    ).toHaveCount(1);
    if (count === 6)
      await expect(
        page.locator('[data-featured-rank="tft"] [role="img"]'),
      ).toHaveCount(0);
    const result = fixtureLookup(slug);
    if (result.status !== 'ok') throw new Error('fixture missing');
    for (const id of result.profile.featuredGames!) {
      const view = profilePresentation(result.profile, id);
      const pick = recommendFor(result.profile, id);
      const radio = group.getByRole('radio', {
        name: view.game.name,
        exact: true,
      });
      await radio.click();
      await expect(radio).toHaveAttribute('aria-checked', 'true');
      for (const link of await page
        .locator(
          '[data-booking-panel]:not([hidden]) [data-profile-book="primary"], [data-closing] [data-profile-book="primary"], [data-sticky-booking] [data-profile-book="primary"]',
        )
        .all()) {
        await expect(link).toHaveAttribute('href', view.book);
        await expect(link).toContainText(view.game.name);
      }
      const panel = page.locator('[data-booking-panel]:visible');
      await expect(panel).toHaveCount(1);
      if (view.offer)
        await expect(panel.locator('[data-profile-price]')).toContainText(
          view.offer.display,
        );
      if (view.coachOffer)
        await expect(panel.locator('.tp-ghost')).toHaveAttribute(
          'href',
          view.booking(id, true),
        );
      else await expect(panel.locator('.tp-ghost')).toHaveCount(0);
      const pickPanel = page.locator('[data-game-pick]:not([hidden])');
      if (pick)
        await expect(
          pickPanel.locator('[data-profile-book="pick"]'),
        ).toHaveAttribute('href', pick.pick.href);
      else await expect(pickPanel).toHaveCount(0);
    }
    await group.getByRole('radio').first().focus();
    await page.keyboard.press('ArrowRight');
    await expect(group.getByRole('radio').nth(1)).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (count === 6) {
      await expect(page.locator('.tp-rankline-more')).toContainText(
        isMobile ? '4 more games' : '3 more games',
      );
      if (isMobile)
        expect(
          await group.evaluate((el) => el.scrollWidth > el.clientWidth),
        ).toBe(true);
    }
  });
}

test('multiple games without JavaScript show default booking and no dead switcher', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto(`${baseURL}/teammates/nyx-six`);
  await expect(
    page.getByRole('radiogroup', { name: 'Book a session in' }),
  ).not.toBeVisible();
  await expect(page.locator('[data-booking-panel]:visible')).toHaveCount(1);
  await expect(
    page.locator('.tp-cta [data-profile-book="primary"]:visible'),
  ).toHaveAttribute('href', '/?game=val#modes-h');
  await expect(page.locator('[data-game-pick]:not([hidden])')).toHaveCount(1);
  await context.close();
});
