import { test, expect, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';

/*
 * The profile picture cropper, against fictional API answers: pick a file, frame the circle,
 * zoom, and keep the 256 by 256 picture /api/me/profile accepts (MAX_AVATAR_BYTES, 96 KB).
 * The crop arithmetic is unit tested in tests/unit/image-crop.test.ts; this is the part that
 * needs a real file picker, a real canvas and real pointer input.
 */
const source = fileURLToPath(
  new URL('../fixtures/profiles/header-source.jpg', import.meta.url),
);
const AVATAR_LIMIT = 96 * 1024;

type Save = { upload?: string; image?: string; csrf?: string; name?: string };

/** The profile screen with its save endpoint answered locally. */
const open = async (page: Page) => {
  const saves: Save[] = [];
  await page.route('**/api/me/profile', async (route) => {
    const body = JSON.parse(route.request().postData() || '{}') as Save;
    saves.push(body);
    await route.fulfill({
      json: {
        profile: {
          name: body.name,
          image: body.upload ?? body.image ?? '',
          country: 'at',
          bio: 'Calm comms, I explain my calls.',
          languages: ['English'],
        },
      },
    });
  });
  await page.goto('/profile');
  await page.waitForSelector('astro-island:not([ssr])', { state: 'attached' });
  return saves;
};

const cropper = (page: Page) =>
  page.getByRole('img', { name: 'Profile picture crop' });
const avatar = (page: Page) => page.locator('.pf-avatar img');
/** What the cropper is showing right now: the picture's own transform. */
const framed = (page: Page) =>
  page.locator('.dc-crop-media').evaluate((el) => el.getAttribute('style'));

const pick = async (page: Page) => {
  await page.locator('input[type=file]').first().setInputFiles(source);
  await expect(cropper(page)).toBeVisible();
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

const bytes = (dataUrl: string) =>
  Buffer.from(dataUrl.split(',')[1]!, 'base64').length;

test('a teammate frames the circle, zooms in and saves a 256 by 256 picture', async ({
  page,
}) => {
  const saves = await open(page);
  await pick(page);
  await expect(page.getByRole('slider', { name: 'Zoom' })).toBeVisible();
  const wide = await framed(page);
  await page.getByRole('slider', { name: 'Zoom' }).fill('2.5');
  expect(await framed(page)).not.toBe(wide);

  await page.getByRole('button', { name: 'Use this picture' }).click();
  await expect(cropper(page)).toHaveCount(0);
  /* The chosen picture is on screen before anything is sent. */
  const chosen = (await avatar(page).getAttribute('src'))!;
  expect(chosen).toMatch(/^data:image\/(webp|jpeg);base64,/);
  expect(await measure(page, chosen)).toEqual({ width: 256, height: 256 });
  expect(bytes(chosen)).toBeLessThanOrEqual(AVATAR_LIMIT);

  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(
    page.getByText('Saved. Your profile is updated everywhere.'),
  ).toBeVisible();
  expect(saves).toHaveLength(1);
  expect(saves[0]!.csrf).toBe('fixture-csrf');
  expect(saves[0]!.upload).toBe(chosen);
});

test('zooming with the wheel changes the picture that gets saved', async ({
  page,
}) => {
  await open(page);
  await pick(page);
  await page.getByRole('button', { name: 'Use this picture' }).click();
  const plain = (await avatar(page).getAttribute('src'))!;

  await pick(page);
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
  await page.getByRole('button', { name: 'Use this picture' }).click();
  const zoomed = (await avatar(page).getAttribute('src'))!;

  expect(zoomed).not.toBe(plain);
  expect(await measure(page, zoomed)).toEqual({ width: 256, height: 256 });
  expect(bytes(zoomed)).toBeLessThanOrEqual(AVATAR_LIMIT);
});

test('the arrow keys move the crop without a pointer', async ({ page }) => {
  await open(page);
  await pick(page);
  /* Zoomed in there is room to move, which is when the keys have something to do. */
  await page.getByRole('slider', { name: 'Zoom' }).fill('2');
  const before = await framed(page);
  await cropper(page).press('ArrowDown');
  await cropper(page).press('ArrowDown');
  expect(await framed(page)).not.toBe(before);
});

test('cancelling leaves the picture the teammate had', async ({ page }) => {
  const saves = await open(page);
  const before = await avatar(page).getAttribute('src');
  await pick(page);
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(cropper(page)).toHaveCount(0);
  await expect(avatar(page)).toHaveAttribute('src', before!);
  /* Nothing changed, so there is nothing to save. */
  await expect(page.getByText('You have unsaved changes')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Upload photo' }),
  ).toBeVisible();
  expect(saves).toEqual([]);
});

test('a file that is not a picture is turned away in plain words', async ({
  page,
}) => {
  await open(page);
  await page
    .locator('input[type=file]')
    .first()
    .setInputFiles({
      name: 'notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('not a picture'),
    });
  await expect(page.getByText('Pick a picture file')).toBeVisible();
  await expect(cropper(page)).toHaveCount(0);
});

/** How solid the thirds are drawn right now: they are the frame's own two hairlines. */
const thirds = (page: Page) =>
  page
    .locator('.dc-crop-frame')
    .evaluate((el) => getComputedStyle(el, '::before').opacity);

test('the circle sits inside the picture, with the thirds up only while it moves', async ({
  page,
}) => {
  await open(page);
  await pick(page);
  const stage = (await page.locator('.dc-crop-stage').boundingBox())!;
  const frame = (await cropper(page).boundingBox())!;
  /* Dimmed picture all around the frame, so the part being left out is visible. */
  expect(frame.x - stage.x).toBeGreaterThanOrEqual(16);
  expect(
    stage.x + stage.width - (frame.x + frame.width),
  ).toBeGreaterThanOrEqual(16);
  expect(frame.y - stage.y).toBeGreaterThanOrEqual(16);
  expect(
    stage.y + stage.height - (frame.y + frame.height),
  ).toBeGreaterThanOrEqual(16);

  /* Out of the way until the picture is being moved, and then back out of the way. The keys
     are the one way to hold a move open on every engine this suite runs. */
  expect(await thirds(page)).toBe('0');
  await cropper(page).focus();
  await page.keyboard.down('ArrowDown');
  await expect.poll(() => thirds(page)).toBe('1');
  await page.keyboard.up('ArrowDown');
  await expect.poll(() => thirds(page)).toBe('0');
});
