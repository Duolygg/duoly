import { test, expect } from '@playwright/test';
import { AnimationEncoder, composeFrames, parseGif } from '../../src/lib/gif';

/*
 * Animated GIFs through both croppers, against fictional API answers. A canvas holds one frame,
 * so a GIF used to be saved as a still of its first frame; now every frame is cut and the saved
 * file is a GIF that still moves, in the sizes the server takes (src/server/auth/avatar.ts,
 * src/server/teammates/profile-header.ts). The codec itself is unit tested in tests/unit/gif.test.ts.
 */

/** A GIF of `frames` frames: a red block that walks across a blue and yellow field. */
function animated(width: number, height: number, frames: number): Buffer {
  const encoder = new AnimationEncoder(width, height, { opaque: true });
  for (let t = 0; t < frames; t++) {
    const rgba = new Uint8ClampedArray(width * height * 4);
    const left = Math.round((t / frames) * (width - width / 5));
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++)
        rgba.set(
          x >= left &&
            x < left + width / 5 &&
            y > height / 3 &&
            y < (2 * height) / 3
            ? [230, 30, 40, 255]
            : y < height / 2
              ? [40, 90, 200, 255]
              : [240, 200, 40, 255],
          (y * width + x) * 4,
        );
    encoder.add(rgba, 70);
  }
  return Buffer.from(encoder.finish());
}

/** What a saved data URL holds: its type, size and how its frames differ. */
function inspect(dataUrl: string) {
  const [head, base64] = dataUrl.split(',');
  const bytes = Buffer.from(base64!, 'base64');
  const gif = parseGif(bytes);
  const pictures: string[] = [];
  if (gif)
    for (const { rgba } of composeFrames(gif))
      pictures.push(Buffer.from(rgba).toString('base64'));
  return {
    type: head,
    bytes: bytes.length,
    width: gif?.width,
    height: gif?.height,
    frames: gif?.frames.length ?? 0,
    distinct: new Set(pictures).size,
    delays: gif?.frames.map((f) => f.delay) ?? [],
  };
}

const file = (name: string, buffer: Buffer) => ({
  name,
  mimeType: 'image/gif',
  buffer,
});

test('an animated GIF profile picture keeps moving after the crop', async ({
  page,
}) => {
  const saves: { upload?: string }[] = [];
  await page.route('**/api/me/profile', async (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    saves.push(body);
    await route.fulfill({
      json: {
        profile: {
          name: body.name,
          image: '',
          country: 'at',
          bio: 'Calm comms, I explain my calls.',
          languages: ['English'],
        },
      },
    });
  });
  await page.goto('/profile');
  await page.waitForSelector('astro-island:not([ssr])', { state: 'attached' });
  await page
    .locator('input[type=file]')
    .first()
    .setInputFiles(file('dance.gif', animated(400, 400, 12)));
  await expect(
    page.getByRole('img', { name: 'Profile picture crop' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Use this picture' }).click();
  await expect(
    page.getByRole('img', { name: 'Profile picture crop' }),
  ).toBeHidden({
    timeout: 30_000,
  });
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect.poll(() => saves.length).toBe(1);
  const saved = inspect(saves[0]!.upload!);
  expect(saved.type).toBe('data:image/gif;base64');
  expect([saved.width, saved.height]).toEqual([256, 256]);
  expect(saved.bytes).toBeLessThanOrEqual(1024 * 1024);
  // Every frame came through, each a different picture, at the speed it had.
  expect(saved.frames).toBe(12);
  expect(saved.distinct).toBe(12);
  expect(saved.delays.every((d) => d === 70)).toBe(true);
});

test('an animated GIF header keeps moving after the crop', async ({ page }) => {
  const posts: string[] = [];
  await page.route('**/api/teammate/profile-header', async (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    posts.push(body.image ?? '');
    await route.fulfill({
      json: {
        url: 'https://duolyfixture.supabase.co/storage/v1/object/public/profile-headers/3f9b7c21-5d64-4ab8-9f0e-2c7d81a4e6b5/91d4c7f0ab2e5368.gif',
      },
    });
  });
  await page.route('**/storage/v1/object/public/profile-headers/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/gif',
      body: animated(600, 200, 3),
    }),
  );
  await page.goto('/public-profile');
  await expect(page.getByText('Header image')).toBeVisible();
  await page.waitForSelector('astro-island:not([ssr])', { state: 'attached' });
  await page
    .locator('input[data-header-file]')
    .setInputFiles(file('banner.gif', animated(900, 400, 10)));
  await expect(page.getByRole('img', { name: 'Header crop' })).toBeVisible();
  await page.getByRole('button', { name: 'Save header' }).click();
  await expect(page.getByText('Header saved.')).toBeVisible({
    timeout: 30_000,
  });
  expect(posts).toHaveLength(1);
  const saved = inspect(posts[0]!);
  expect(saved.type).toBe('data:image/gif;base64');
  expect(saved.width).toBe(saved.height! * 3);
  expect(saved.height).toBeGreaterThanOrEqual(200);
  expect(saved.height).toBeLessThanOrEqual(500);
  expect(saved.bytes).toBeLessThanOrEqual(2560 * 1024);
  expect(saved.frames).toBe(10);
  expect(saved.distinct).toBe(10);
});
