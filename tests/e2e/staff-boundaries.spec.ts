import { expect, test } from '@playwright/test';

test('real staff routes are role protected, with separate sample previews', async ({
  request,
  page,
}) => {
  const admin = await request.get('/admin', { maxRedirects: 0 });
  expect(admin.status()).toBe(404);
  const teammate = await request.get('/teammate', { maxRedirects: 0 });
  expect(teammate.status()).toBe(303);
  expect(teammate.headers().location).toBe('/login');
  for (const path of ['/preview/admin', '/preview/teammate']) {
    await page.goto(path);
    await expect(
      page.getByRole('navigation', { name: 'Preview pages' }),
    ).toBeVisible();
    await expect(page.locator('.design-preview-toolbar')).toContainText(
      'Design preview',
    );
  }
});
