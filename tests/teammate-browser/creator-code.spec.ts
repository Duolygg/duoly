import { test, expect } from '@playwright/test';
import { creatorPricePreview } from '../../src/server/creators/preview';
let serverPreview: ReturnType<typeof creatorPricePreview>;

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
        serverPreview = creatorPricePreview(
          route.request().postDataJSON().selection,
          false,
          1.1,
          route.request().postDataJSON().currency,
        );
        return route.fulfill({
          json: {
            preview: valid ? serverPreview : undefined,
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
    const code = dialog.getByLabel('Creator code · optional', { exact: true });
    const total = dialog.locator('[data-checkout-total]');
    const totalBefore = await total.innerText();
    if (source === 'typed') {
      await code.fill(' alpha ');
      await dialog.getByRole('button', { name: 'Apply code' }).click();
    } else await expect(code).toHaveValue('ALPHA');
    await expect(
      dialog
        .getByRole('status')
        .filter({ hasText: /Code applied. Thanks for supporting Alpha./ }),
    ).toBeVisible();
    const money = (minor: number) =>
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'EUR',
      }).format(minor / 100);
    await expect(total).toHaveText(money(serverPreview.amountMinor));
    await expect(dialog.locator('del')).toHaveText(
      money(serverPreview.originalMinor),
    );
    await expect(
      dialog.getByText(
        `Creator code ALPHA saves you ${money(serverPreview.discountMinor)}`,
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      dialog.getByText(
        `Pay ${money(serverPreview.amountMinor)} securely with Stripe`,
        { exact: true },
      ),
    ).toBeVisible();
    await expect(code).toHaveAttribute('readonly', '');
    if (source === 'typed') await expect(total).not.toHaveText(totalBefore);
    if (info.project.name === 'mobile')
      await page.setViewportSize({ width: 390, height: 844 });
    await code.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: process.env.CREATOR_CODE_SCREENSHOT_DIR
        ? `${process.env.CREATOR_CODE_SCREENSHOT_DIR}/${info.project.name}-${source}-v2.png`
        : info.outputPath(`${info.project.name}-${source}-v2.png`),
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
      await expect(
        dialog
          .getByRole('status')
          .filter({ hasText: /Code applied. Thanks for supporting Alpha./ }),
      ).toHaveCount(0);
      await code.fill('ALPHA');
      await dialog.getByRole('button', { name: 'Apply code' }).click();
      await expect(
        dialog
          .getByRole('status')
          .filter({ hasText: /Code applied. Thanks for supporting Alpha./ }),
      ).toBeVisible();
      await page.evaluate(() =>
        window.dispatchEvent(
          new CustomEvent('duoly:consent', { detail: { referral: false } }),
        ),
      );
      await expect(code).toHaveValue('ALPHA');
    }
    await dialog.getByRole('button', { name: 'Remove', exact: true }).click();
    await expect(total).toHaveText(money(serverPreview.originalMinor));
    await expect(dialog.locator('del')).toHaveCount(0);
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
    await dialog.getByRole('button', { name: 'Remove', exact: true }).click();
    await expect(code).toHaveValue('');
    await dialog
      .getByRole('button', { name: /Continue to payment/ })
      .dispatchEvent('click');
    await expect.poll(() => bodies.length).toBe(3);
    expect(bodies[2]!.creatorCode).toBe('');
  });
}
