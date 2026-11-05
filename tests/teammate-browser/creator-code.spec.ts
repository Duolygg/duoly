import { test, expect } from '@playwright/test';

for (const source of ['typed', 'link'] as const) {
  test(`${source} creator code validates, can be replaced and removed without blocking payment`, async ({
    page,
  }, info) => {
    const bodies: Record<string, unknown>[] = [];
    await page.route('**/api/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/api/creators/code/check') {
        const valid =
          route.request().postDataJSON().creatorCode.trim().toUpperCase() ===
          'ALPHA';
        return route.fulfill({
          json: {
            valid,
            displayName: valid ? 'Alpha' : null,
            discountPercent: valid ? 10 : 0,
            reason: valid ? null : 'That creator code is not available.',
          },
        });
      }
      if (path === '/api/checkout') {
        bodies.push(route.request().postDataJSON());
        return route.fulfill({
          status: 503,
          json: { error: 'Payment fixture reached.' },
        });
      }
      return route.fulfill({ json: {} });
    });
    if (source === 'link')
      await page.context().addCookies([
        {
          name: 'duoly-consent',
          value: 'v2.a0.m0.r1',
          domain: '127.0.0.1',
          path: '/',
        },
      ]);
    await page.goto(source === 'link' ? '/book?creator-fixture=1' : '/book');
    await expect.poll(() => page.locator('astro-island[ssr]').count()).toBe(0);
    await page
      .getByRole('complementary', { name: 'Order summary' })
      .getByRole('button', { name: /Continue to payment/ })
      .dispatchEvent('click');
    const dialog = page.getByRole('dialog');
    const code = dialog.getByLabel('Creator code', { exact: true });
    const total = dialog.getByText(/^€[0-9.,]+$/).first();
    const totalBefore = await total.innerText();
    if (source === 'typed') {
      await code.fill(' alpha ');
      await dialog.getByRole('button', { name: 'Apply code' }).click();
    } else await expect(code).toHaveValue('ALPHA');
    await expect(dialog.getByText('Alpha: 10% off applied.')).toBeVisible();
    if (source === 'typed') await expect(total).not.toHaveText(totalBefore);
    if (info.project.name === 'mobile')
      await page.setViewportSize({ width: 390, height: 844 });
    await code.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: process.env.CREATOR_CODE_SCREENSHOT_DIR
        ? `${process.env.CREATOR_CODE_SCREENSHOT_DIR}/${info.project.name}-${source}.png`
        : info.outputPath(`${info.project.name}-${source}.png`),
      fullPage: false,
    });
    await dialog.getByPlaceholder('Name#TAG').fill('Dana#EUW');
    await dialog
      .getByRole('button', { name: /Continue to payment/ })
      .dispatchEvent('click');
    await expect.poll(() => bodies.length).toBe(1);
    if (source === 'link') expect(bodies[0]).not.toHaveProperty('creatorCode');
    else expect(bodies[0]!.creatorCode).toBe(' alpha ');
    if (source === 'link') {
      await page.evaluate(() =>
        window.dispatchEvent(
          new CustomEvent('duoly:consent', { detail: { referral: false } }),
        ),
      );
      await expect(code).toHaveValue('');
      await expect(dialog.getByText('Alpha: 10% off applied.')).toHaveCount(0);
      await code.fill('ALPHA');
      await dialog.getByRole('button', { name: 'Apply code' }).click();
      await expect(dialog.getByText('Alpha: 10% off applied.')).toBeVisible();
      await page.evaluate(() =>
        window.dispatchEvent(
          new CustomEvent('duoly:consent', { detail: { referral: false } }),
        ),
      );
      await expect(code).toHaveValue('ALPHA');
    }
    await code.fill('UNKNOWN');
    await dialog.getByRole('button', { name: 'Apply code' }).click();
    await expect(
      dialog.getByText('That creator code is not available.'),
    ).toBeVisible();
    await dialog.getByPlaceholder('Name#TAG').fill('Dana#EUW');
    await dialog
      .getByRole('button', { name: /Continue to payment/ })
      .dispatchEvent('click');
    await expect(dialog.getByRole('alert')).toHaveText(
      'Payment fixture reached.',
    );
    await expect.poll(() => bodies.length).toBe(2);
    expect(bodies[1]!.creatorCode).toBe('UNKNOWN');
    await dialog.getByRole('button', { name: 'Remove code' }).click();
    await expect(code).toHaveValue('');
    await dialog
      .getByRole('button', { name: /Continue to payment/ })
      .dispatchEvent('click');
    await expect.poll(() => bodies.length).toBe(3);
    expect(bodies[2]!.creatorCode).toBe('');
  });
}
