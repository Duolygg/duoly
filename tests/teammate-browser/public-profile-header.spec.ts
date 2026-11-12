import { test, expect, type Page, type Route } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/*
 * The header uploader in public profile settings, against fictional API answers: pick a
 * picture, crop it in the browser, upload, replace, remove. Nothing here talks to Supabase.
 * The crop and the quality steps are unit tested in tests/unit/profile-header-crop.test.ts;
 * this is the part that needs a real canvas and a real file picker.
 */
const source = fileURLToPath(
  new URL('../fixtures/profiles/header-source.jpg', import.meta.url),
);
const headerBytes = readFileSync(
  new URL('../fixtures/profiles/teammate-header.webp', import.meta.url),
);
const SAVED =
  'https://duolyfixture.supabase.co/storage/v1/object/public/profile-headers/3f9b7c21-5d64-4ab8-9f0e-2c7d81a4e6b5/91d4c7f0ab2e5368.webp';

type Call = { method: string; csrf: unknown; image: string };

/** The settings block with the header endpoint and the storage host both answered locally. */
const settings = async (
  page: Page,
  options: { query?: string; endpoint?: (route: Route) => unknown } = {},
) => {
  const calls: Call[] = [];
  await page.route('**/storage/v1/object/public/profile-headers/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/webp',
      body: headerBytes,
    }),
  );
  await page.route('**/api/teammate/profile-header', async (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    calls.push({
      method: route.request().method(),
      csrf: body.csrf,
      image: body.image ?? '',
    });
    if (options.endpoint) return void (await options.endpoint(route));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        route.request().method() === 'DELETE' ? { ok: true } : { url: SAVED },
      ),
    });
  });
  await page.goto('/public-profile' + (options.query ?? ''));
  await expect(page.getByText('Header image')).toBeVisible();
  // The block is server rendered first; wait until React has hydrated it before using it.
  await page.waitForSelector('astro-island:not([ssr])', { state: 'attached' });
  return calls;
};

const pick = async (page: Page) => {
  await page.locator('input[data-header-file]').setInputFiles(source);
  await expect(page.locator('canvas.pp-header-crop')).toBeVisible();
};

test('a teammate picks a picture, positions the crop and uploads a WebP', async ({
  page,
}) => {
  const calls = await settings(page);
  await expect(
    page.getByText('Your header is shown on your public profile.'),
  ).toBeVisible();
  await pick(page);
  const canvas = page.locator('canvas.pp-header-crop');
  /* The crop is the strip that gets sent: 1500 by 500, whatever the picked file was. */
  expect(
    await canvas.evaluate((el: HTMLCanvasElement) => [el.width, el.height]),
  ).toEqual([1500, 500]);
  await expect(page.getByText('Drag the picture to position it')).toBeVisible();

  /* Dragging moves the window over the source picture, so the pixels change. */
  const before = await canvas.evaluate((el: HTMLCanvasElement) =>
    el.toDataURL('image/webp', 0.5),
  );
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - 60, {
    steps: 6,
  });
  await page.mouse.up();
  const after = await canvas.evaluate((el: HTMLCanvasElement) =>
    el.toDataURL('image/webp', 0.5),
  );
  expect(after).not.toBe(before);

  await page.getByRole('button', { name: 'Upload header' }).click();
  await expect(page.getByText('Header saved.')).toBeVisible();
  expect(calls).toHaveLength(1);
  expect(calls[0]!.method).toBe('POST');
  expect(calls[0]!.csrf).toBe('fixture-csrf');
  /* Exactly what the endpoint accepts: a WebP data URL under 300 KB. */
  expect(calls[0]!.image.startsWith('data:image/webp;base64,')).toBe(true);
  expect(
    Buffer.from(calls[0]!.image.split(',')[1]!, 'base64').length,
  ).toBeLessThanOrEqual(300 * 1024);
  expect(
    Buffer.from(calls[0]!.image.split(',')[1]!, 'base64')
      .subarray(0, 4)
      .toString('ascii'),
  ).toBe('RIFF');

  /* The saved header takes the place of the crop, at the same size, and can be replaced. */
  const saved = page.locator('img.pp-header-art');
  await expect(saved).toHaveAttribute('src', SAVED);
  expect(await saved.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBe(
    1500,
  );
  await expect(
    page.getByRole('button', { name: 'Replace header' }),
  ).toBeVisible();
});

test('a teammate removes the header and is told it is gone', async ({
  page,
}) => {
  const calls = await settings(page, {
    query: '?header=' + encodeURIComponent(SAVED),
  });
  await expect(page.locator('img.pp-header-art')).toHaveAttribute('src', SAVED);
  await page.getByRole('button', { name: 'Remove header' }).click();
  await expect(page.getByText('Header removed.')).toBeVisible();
  await expect(page.getByText('You have no header yet')).toBeVisible();
  await expect(page.locator('img.pp-header-art')).toHaveCount(0);
  expect(calls).toEqual([
    { method: 'DELETE', csrf: 'fixture-csrf', image: '' },
  ]);
  /* Nothing to remove once it is gone, so the button steps aside. */
  await expect(page.getByRole('button', { name: 'Remove header' })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole('button', { name: 'Choose a picture' }),
  ).toBeVisible();
});

test('the endpoint speaks for itself when it says no', async ({ page }) => {
  await settings(page, {
    endpoint: (route) =>
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Choose a WebP image up to 300 KB.' }),
      }),
  });
  await pick(page);
  await page.getByRole('button', { name: 'Upload header' }).click();
  const alert = page.getByRole('alert');
  await expect(alert).toHaveText('Choose a WebP image up to 300 KB.');
  /* The crop stays on screen, so the next try does not start from the file picker. */
  await expect(page.locator('canvas.pp-header-crop')).toBeVisible();
});

test('a file that is not a picture is turned away in plain words', async ({
  page,
}) => {
  await settings(page);
  await page.locator('input[data-header-file]').setInputFiles({
    name: 'notes.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('not a picture'),
  });
  await expect(page.getByRole('alert')).toContainText('Pick a picture file');
  await expect(page.locator('canvas.pp-header-crop')).toHaveCount(0);
});
