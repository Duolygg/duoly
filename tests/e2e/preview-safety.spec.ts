import { expect, test } from '@playwright/test';

test('login preview never collects a password or starts OAuth', async ({
  page,
}) => {
  const writes: string[] = [];
  const dialogs: string[] = [];
  page.on('request', (request) => {
    if (!['GET', 'HEAD'].includes(request.method())) writes.push(request.url());
  });
  page.on('dialog', async (dialog) => {
    dialogs.push(dialog.message());
    await dialog.dismiss();
  });
  await page.goto('/');
  await expect.poll(() => page.locator('astro-island[ssr]').count()).toBe(0);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.locator('input[type="password"]')).toBeDisabled();
  await page.getByRole('button', { name: 'Google', exact: true }).click();
  await expect(
    page
      .getByRole('complementary', { name: 'Preview action notice' })
      .getByRole('status'),
  ).toContainText('not connected');
  await expect(
    page.getByRole('button', { name: 'Google', exact: true }),
  ).toBeEnabled();
  expect(new URL(page.url()).pathname).toBe('/');
  expect(writes).toEqual([]);
  expect(dialogs).toEqual([]);
});

test('contact submission is explicitly blocked before native validation or network', async ({
  page,
}) => {
  const writes: string[] = [];
  page.on('request', (request) => {
    if (!['GET', 'HEAD'].includes(request.method())) writes.push(request.url());
  });
  await page.goto('/contact');
  await expect(page.locator('html')).toHaveAttribute(
    'data-preview-guards',
    'ready',
  );
  await page.locator('button[type="submit"]').first().click();
  await expect(page.getByRole('status')).toContainText(
    'Nothing was sent or changed',
  );
  expect(writes).toEqual([]);
});

test('server-rendered profile has no API links and keeps uploads disabled without JavaScript', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto(new URL('/preview/profile', baseURL).href);
    await expect(page.locator('a[href^="/api/"]')).toHaveCount(0);
    await expect(page.locator('input[type="file"]')).toBeDisabled();
  } finally {
    await context.close();
  }
});

test('early API guard cancels middle-click before React hydration', async ({
  page,
}) => {
  await page.route('**/*', (route) =>
    route.request().resourceType() === 'script'
      ? route.abort()
      : route.continue(),
  );
  await page.goto('/preview/profile');
  await expect(page.locator('html')).not.toHaveAttribute(
    'data-preview-guards',
    'ready',
  );
  const allowed = await page.evaluate(() => {
    const anchor = document.createElement('a');
    anchor.href = '/api/discord/link';
    anchor.textContent = 'Regression probe for future API links';
    document.body.append(anchor);
    return anchor.dispatchEvent(
      new MouseEvent('auxclick', {
        bubbles: true,
        cancelable: true,
        button: 1,
      }),
    );
  });
  expect(allowed).toBe(false);
  expect(new URL(page.url()).pathname).toBe('/preview/profile');
});

test('invalid identifiers do not reveal a sample as a real order', async ({
  request,
}) => {
  for (const path of [
    '/queue/another-order',
    '/claim/another-token',
    '/api/orders',
  ]) {
    const response = await request.get(path);
    expect(response.status()).toBe(404);
  }
});
