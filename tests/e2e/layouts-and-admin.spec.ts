import { expect, test } from '@playwright/test';

const sections = {
  overview: 'Overview',
  live: 'Live desk',
  priority: 'Priority',
  users: 'Users & roles',
  orders: 'Orders',
  teammates: 'Teammates',
  customers: 'Customers',
  payouts: 'Payouts',
  support: 'Support chat',
  safety: 'Reports & safety',
  audit: 'Audit log',
  settings: 'Settings',
};
for (const [id, title] of Object.entries(sections)) {
  test(`admin section ${id} renders the original section without runtime errors`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/preview/admin#' + id);
    await expect(
      page.getByRole('heading', { level: 1, name: title, exact: true }),
    ).toBeVisible();
    await expect.poll(() => page.locator('astro-island[ssr]').count()).toBe(0);
    await expect(page.locator('html')).toHaveAttribute(
      'data-preview-guards',
      'ready',
    );
    expect(errors).toEqual([]);
  });
}

const paths = [
  '/',
  '/preview/dashboard',
  '/preview/teammate',
  '/preview/admin',
  '/apply',
  '/claim/preview-handover',
  '/contact',
  '/creators',
  '/preview/profile',
  '/queue/preview-order',
  '/privacy',
  '/rules',
  '/terms',
];
for (const path of paths) {
  test(`layout ${path} has no overflow, broken imagery or runtime errors`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(path);
    await expect(page.locator('html')).toHaveAttribute(
      'data-preview-guards',
      'ready',
    );
    await page.evaluate(async () => {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      await document.fonts.ready;
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
    });
    await expect.poll(() => page.locator('astro-island[ssr]').count()).toBe(0);
    const metrics = await page.evaluate(() => ({
      viewport: innerWidth,
      width: document.documentElement.scrollWidth,
      broken: [...document.querySelectorAll('img')]
        .filter((image) => image.complete && image.naturalWidth === 0)
        .map((image) => image.getAttribute('src')),
    }));
    expect(metrics.broken).toEqual([]);
    expect(metrics.width).toBeLessThanOrEqual(metrics.viewport + 1);
    expect(errors).toEqual([]);
  });
}
