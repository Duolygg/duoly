import { test, expect, type Page, type Route } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/*
 * The header uploader in public profile settings, against fictional API answers: pick a
 * picture, frame the strip in the browser, upload, replace, remove. Nothing here talks to
 * Supabase. The crop and the quality steps are unit tested in
 * tests/unit/profile-header-crop.test.ts; this is the part that needs a real canvas, a real
 * file picker and real pointer input.
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

const crop = (page: Page) => page.getByRole('img', { name: 'Header crop' });
/** What the cropper is showing right now: the picture's own transform. */
const framed = (page: Page) =>
  page.locator('.dc-crop-media').evaluate((el) => el.getAttribute('style'));

const pick = async (page: Page) => {
  await page.locator('input[data-header-file]').setInputFiles(source);
  await expect(crop(page)).toBeVisible();
};

/** The real pixel size of an encoded picture, decoded by the browser. */
const measure = (page: Page, dataUrl: string) =>
  page.evaluate(
    (url) =>
      new Promise<{ width: number; height: number }>((resolve, reject) => {
        const image = new Image();
        image.onload = () =>
          resolve({ width: image.naturalWidth, height: image.naturalHeight });
        image.onerror = () => reject(new Error('could not decode'));
        image.src = url;
      }),
    dataUrl,
  );

test('a teammate picks a picture, frames the strip and uploads a WebP', async ({
  page,
}) => {
  const calls = await settings(page);
  await expect(
    page.getByText('Your header is shown on your public profile.'),
  ).toBeVisible();
  await pick(page);
  await expect(page.locator('.dc-crop-hint')).toContainText('Drag to move');

  /* Dragging moves the picture under the frame, so other pixels end up in the strip. */
  const before = await framed(page);
  await crop(page).scrollIntoViewIfNeeded();
  const box = (await crop(page).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - 40, {
    steps: 6,
  });
  await page.mouse.up();
  /* The library moves the picture on the next frame, so give it one. */
  await expect.poll(() => framed(page)).not.toBe(before);

  await page.getByRole('button', { name: 'Save header' }).click();
  await expect(page.getByText('Header saved.')).toBeVisible();
  expect(calls).toHaveLength(1);
  expect(calls[0]!.method).toBe('POST');
  expect(calls[0]!.csrf).toBe('fixture-csrf');
  /* Exactly what the endpoint accepts: a WebP data URL under 300 KB, 1500 by 500. */
  const image = calls[0]!.image;
  expect(image.startsWith('data:image/webp;base64,')).toBe(true);
  expect(
    Buffer.from(image.split(',')[1]!, 'base64').length,
  ).toBeLessThanOrEqual(300 * 1024);
  expect(
    Buffer.from(image.split(',')[1]!, 'base64')
      .subarray(0, 4)
      .toString('ascii'),
  ).toBe('RIFF');
  expect(await measure(page, image)).toEqual({ width: 1500, height: 500 });

  /* The saved header takes the place of the crop, at the same shape, and can be replaced. */
  const saved = page.locator('img.pp-header-art');
  await expect(saved).toHaveAttribute('src', SAVED);
  expect(await saved.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBe(
    1500,
  );
  await expect(
    page.getByRole('button', { name: 'Replace header' }),
  ).toBeVisible();
});

test('zooming changes the strip that gets uploaded', async ({ page }) => {
  const calls = await settings(page);
  await pick(page);
  await page.getByRole('button', { name: 'Save header' }).click();
  await expect(page.getByText('Header saved.')).toBeVisible();

  await page.getByRole('button', { name: 'Replace header' }).click();
  await page.locator('input[data-header-file]').setInputFiles(source);
  await expect(crop(page)).toBeVisible();
  /* A wheel over the picture zooms it, the way a mouse or a trackpad would. */
  await page.locator('.dc-crop-canvas').evaluate((el) => {
    const box = el.getBoundingClientRect();
    el.dispatchEvent(
      new WheelEvent('wheel', {
        deltaY: -400,
        clientX: box.x + box.width / 2,
        clientY: box.y + box.height / 2,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  await expect(page.getByRole('slider', { name: 'Zoom' })).not.toHaveValue('1');
  await page.getByRole('button', { name: 'Save header' }).click();
  await expect(page.getByText('Header saved.')).toHaveCount(1);

  expect(calls).toHaveLength(2);
  expect(calls[1]!.image).not.toBe(calls[0]!.image);
  expect(await measure(page, calls[1]!.image)).toEqual({
    width: 1500,
    height: 500,
  });
});

test('cancelling the crop leaves the header that was there', async ({
  page,
}) => {
  const calls = await settings(page, {
    query: '?header=' + encodeURIComponent(SAVED),
  });
  await expect(page.locator('img.pp-header-art')).toHaveAttribute('src', SAVED);
  await page.locator('input[data-header-file]').setInputFiles(source);
  await expect(crop(page)).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(crop(page)).toHaveCount(0);
  await expect(page.locator('img.pp-header-art')).toHaveAttribute('src', SAVED);
  await expect(
    page.getByRole('button', { name: 'Replace header' }),
  ).toBeVisible();
  expect(calls).toEqual([]);
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
  await page.getByRole('button', { name: 'Save header' }).click();
  const alert = page.getByRole('alert');
  await expect(alert).toHaveText('Choose a WebP image up to 300 KB.');
  /* The crop stays on screen, so the next try does not start from the file picker. */
  await expect(crop(page)).toBeVisible();
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
  await expect(crop(page)).toHaveCount(0);
});
