import { expect, test } from '@playwright/test';

test('customer dashboard renders the original sample order view', async ({
  page,
}) => {
  const response = await page.goto('/preview/dashboard');
  expect(response?.status()).toBe(200);
  await expect(page.getByText('Design preview', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 1, name: /Hey Sample/ }),
  ).toBeVisible();
});

test('teammate preview shows the shared sample queue without network writes', async ({
  page,
}) => {
  const writes: string[] = [];
  const errors: string[] = [];
  page.on('request', (request) => {
    if (!['GET', 'HEAD'].includes(request.method())) writes.push(request.url());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  const response = await page.goto('/preview/teammate');
  expect(response?.status()).toBe(200);
  await expect(page.getByText('Design preview', { exact: true })).toBeVisible();
  await expect(
    page
      .getByRole('region', { name: 'Available orders' })
      .getByText('Duo Pro', { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole('region', { name: 'Available orders' })
      .getByText(/Sample Player/),
  ).toBeVisible();
  expect(writes).toEqual([]);
  expect(errors).toEqual([]);
});

test('ported /admin preserves the original view and preview boundary', async ({
  page,
}) => {
  const errors: string[] = [];
  const apiCalls: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/'))
      apiCalls.push(request.url());
  });
  const response = await page.goto('/preview/admin');
  expect(response?.status()).toBe(200);
  await expect(page.getByText('Design preview', { exact: true })).toBeVisible();
  await expect
    .poll(() => page.locator('astro-island[client="load"][ssr]').count())
    .toBe(0);
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  expect(errors).toEqual([]);
  expect(apiCalls).toEqual([]);
});

test('ported /queue/preview-order preserves the original view and preview boundary', async ({
  page,
}) => {
  const errors: string[] = [];
  const apiCalls: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/'))
      apiCalls.push(request.url());
  });
  const response = await page.goto('/queue/preview-order');
  expect(response?.status()).toBe(200);
  await expect(page.getByText('Design preview', { exact: true })).toBeVisible();
  await expect
    .poll(() => page.locator('astro-island[client="load"][ssr]').count())
    .toBe(0);
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  expect(errors).toEqual([]);
  expect(apiCalls).toEqual([]);
});

test('ported /claim/preview-handover preserves the original view and preview boundary', async ({
  page,
}) => {
  const errors: string[] = [];
  const apiCalls: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/'))
      apiCalls.push(request.url());
  });
  const response = await page.goto('/claim/preview-handover');
  expect(response?.status()).toBe(200);
  await expect(page.getByText('Design preview', { exact: true })).toBeVisible();
  await expect
    .poll(() => page.locator('astro-island[client="load"][ssr]').count())
    .toBe(0);
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  expect(errors).toEqual([]);
  expect(apiCalls).toEqual([]);
});

test('ported /apply preserves the original view and preview boundary', async ({
  page,
}) => {
  const errors: string[] = [];
  const apiCalls: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/'))
      apiCalls.push(request.url());
  });
  const response = await page.goto('/apply');
  expect(response?.status()).toBe(200);
  await expect(page.getByText('Design preview', { exact: true })).toBeVisible();
  await expect
    .poll(() => page.locator('astro-island[client="load"][ssr]').count())
    .toBe(0);
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  expect(errors).toEqual([]);
  expect(apiCalls).toEqual([]);
});

test('ported /contact preserves the original view and preview boundary', async ({
  page,
}) => {
  const errors: string[] = [];
  const apiCalls: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/'))
      apiCalls.push(request.url());
  });
  const response = await page.goto('/contact');
  expect(response?.status()).toBe(200);
  await expect(page.getByText('Design preview', { exact: true })).toBeVisible();
  await expect
    .poll(() => page.locator('astro-island[client="load"][ssr]').count())
    .toBe(0);
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  expect(errors).toEqual([]);
  expect(apiCalls).toEqual([]);
});

test('ported /creators preserves the original view and preview boundary', async ({
  page,
}) => {
  const errors: string[] = [];
  const apiCalls: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/'))
      apiCalls.push(request.url());
  });
  const response = await page.goto('/creators');
  expect(response?.status()).toBe(200);
  await expect(page.getByText('Design preview', { exact: true })).toBeVisible();
  await expect
    .poll(() => page.locator('astro-island[client="load"][ssr]').count())
    .toBe(0);
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  expect(errors).toEqual([]);
  expect(apiCalls).toEqual([]);
});

test('ported /profile preserves the original view and preview boundary', async ({
  page,
}) => {
  const errors: string[] = [];
  const apiCalls: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/'))
      apiCalls.push(request.url());
  });
  const response = await page.goto('/preview/profile');
  expect(response?.status()).toBe(200);
  await expect(page.getByText('Design preview', { exact: true })).toBeVisible();
  await expect
    .poll(() => page.locator('astro-island[client="load"][ssr]').count())
    .toBe(0);
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  expect(errors).toEqual([]);
  expect(apiCalls).toEqual([]);
});

test('ported /rules preserves the original view and preview boundary', async ({
  page,
}) => {
  const errors: string[] = [];
  const apiCalls: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/'))
      apiCalls.push(request.url());
  });
  const response = await page.goto('/rules');
  expect(response?.status()).toBe(200);
  await expect(page.getByText('Design preview', { exact: true })).toBeVisible();
  await expect
    .poll(() => page.locator('astro-island[client="load"][ssr]').count())
    .toBe(0);
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  expect(errors).toEqual([]);
  expect(apiCalls).toEqual([]);
});

test('ported /privacy preserves the original view and preview boundary', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const response = await page.goto('/privacy');
  expect(response?.status()).toBe(200);
  await expect(page.getByText('Design preview', { exact: true })).toBeVisible();
  await expect(page.getByRole('note')).toContainText('Unapproved legal draft');
  await expect
    .poll(() => page.locator('astro-island[client="load"][ssr]').count())
    .toBe(0);
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('ported /terms preserves the original view and preview boundary', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const response = await page.goto('/terms');
  expect(response?.status()).toBe(200);
  await expect(page.getByText('Design preview', { exact: true })).toBeVisible();
  await expect(page.getByRole('note')).toContainText('Unapproved legal draft');
  await expect
    .poll(() => page.locator('astro-island[client="load"][ssr]').count())
    .toBe(0);
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  expect(errors).toEqual([]);
});

// ROUTE_CASES_APPEND

test('accepting a sample order fails explicitly without removing it or opening a session', async ({
  page,
}) => {
  await page.goto('/preview/teammate');
  await expect(
    page
      .getByRole('region', { name: 'Available orders' })
      .getByText('Duo Pro', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Accept', exact: true }).click();
  await expect(
    page.getByText(
      'Design preview: this action is unavailable. Nothing was sent or changed.',
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page
      .getByRole('region', { name: 'Available orders' })
      .getByText('Duo Pro', { exact: true }),
  ).toBeVisible({ timeout: 200 });
});
