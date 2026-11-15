import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const source = new URL(
  '../fixtures/profiles/header-source.jpg',
  import.meta.url,
);
const saved = '/saved-header.webp';
const bytes = readFileSync(
  new URL('../fixtures/profiles/teammate-header.webp', import.meta.url),
);
const profile = {
  settings: {
    published: true,
    slug: 'nyx',
    accent: 'lavender',
    banner: 'slash',
    featuredGame: 'val',
    vibeTags: [],
    showCountry: false,
    coaching: false,
    games: [{ game: 'val', roles: ['Controller'], picks: ['Omen'] }],
  },
  approvedGames: ['val'],
  ranks: [],
  hidden: false,
};
async function open(page: Page) {
  await page.route('**/saved-header.webp', (route) =>
    route.fulfill({ contentType: 'image/webp', body: bytes }),
  );
  await page.goto('/public-profile');
  await page.waitForSelector('astro-island:not([ssr])', { state: 'attached' });
}
async function pick(page: Page) {
  await page.locator('[data-header-file]').setInputFiles(source.pathname);
  await expect(page.getByRole('img', { name: 'Header crop' })).toBeVisible();
}

test('a saved header that cannot load is not silently shown as a broken picture', async ({
  page,
}) => {
  await page.route('**/saved-header.webp', (route) =>
    route.fulfill({ status: 404, body: '' }),
  );
  await page.goto('/public-profile?header=' + encodeURIComponent(saved));
  await page.waitForSelector('astro-island:not([ssr])', { state: 'attached' });
  await expect(page.getByRole('alert')).toHaveText(
    'Your header is saved, but the picture could not load. Reload or try another picture.',
  );
  await expect(
    page.getByRole('button', { name: 'Replace header' }),
  ).toBeEnabled();
  await expect(
    page.getByRole('button', { name: 'Remove header' }),
  ).toBeEnabled();
});

test('a thrown canvas encoder recovers instead of leaving Uploading forever', async ({
  page,
}) => {
  let calls = 0;
  await page.route('**/api/teammate/profile-header', (route) => {
    calls++;
    return route.abort();
  });
  await open(page);
  await pick(page);
  await page.evaluate(() => {
    HTMLCanvasElement.prototype.toDataURL = () => {
      throw new Error('Out of memory');
    };
  });
  await page.getByRole('button', { name: 'Upload header' }).click();
  await expect(page.getByRole('alert')).toHaveText(
    'This browser could not prepare the picture. Try a smaller JPG or PNG.',
  );
  await expect(
    page.getByRole('button', { name: 'Upload header' }),
  ).toBeEnabled();
  expect(calls).toBe(0);
});

test('a missing canvas context cannot upload an empty header', async ({
  page,
}) => {
  await open(page);
  await page.evaluate(() => {
    HTMLCanvasElement.prototype.getContext = (() =>
      null) as typeof HTMLCanvasElement.prototype.getContext;
  });
  await page.locator('[data-header-file]').setInputFiles(source.pathname);
  await expect(page.getByRole('alert')).toHaveText(
    'This browser could not prepare the picture. Try a smaller JPG or PNG.',
  );
  await expect(page.getByRole('button', { name: 'Upload header' })).toHaveCount(
    0,
  );
});

test('a server error stays without new requests, but retry clears it and saves', async ({
  page,
}) => {
  let calls = 0;
  await page.route('**/api/teammate/profile-header', (route) =>
    route.fulfill({
      status: ++calls === 1 ? 503 : 200,
      json:
        calls === 1 ? { error: 'Header could not be saved.' } : { url: saved },
    }),
  );
  await open(page);
  await pick(page);
  await page.getByRole('button', { name: 'Upload header' }).click();
  await expect(page.getByRole('alert')).toHaveText(
    'Header could not be saved.',
  );
  await page.getByRole('img', { name: 'Header crop' }).press('ArrowDown');
  await expect(page.getByRole('alert')).toHaveText(
    'Header could not be saved.',
  );
  expect(calls).toBe(1);
  await page.getByRole('button', { name: 'Upload header' }).click();
  await expect(page.getByText('Header saved.')).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByAltText('Your header image')).toHaveJSProperty(
    'naturalWidth',
    1500,
  );
  expect(calls).toBe(2);
});

for (const [status, error] of [
  [400, 'Invalid or oversized request.'],
  [400, 'Choose a WebP image up to 300 KB.'],
  [401, 'Authentication required.'],
  [403, 'Request could not be verified. Reload and try again.'],
  [403, 'Teammate role required.'],
  [404, 'Not found.'],
  [503, 'Header images are unavailable right now.'],
] as const) {
  test(`HTTP ${status}: ${error}`, async ({ page }) => {
    await page.route('**/api/teammate/profile-header', (route) =>
      route.fulfill({ status, json: { error } }),
    );
    await open(page);
    await pick(page);
    await page.getByRole('button', { name: 'Upload header' }).click();
    await expect(page.getByRole('alert')).toHaveText(error);
    await expect(
      page.getByRole('button', { name: 'Upload header' }),
    ).toBeEnabled();
  });
}

for (const failure of ['offline', 'html'] as const) {
  test(`${failure} responses have an actionable message`, async ({ page }) => {
    await page.route('**/api/teammate/profile-header', (route) =>
      failure === 'offline'
        ? route.abort('failed')
        : route.fulfill({
            status: 413,
            contentType: 'text/html',
            body: '<h1>Payload too large</h1>',
          }),
    );
    await open(page);
    await pick(page);
    await page.getByRole('button', { name: 'Upload header' }).click();
    await expect(page.getByRole('alert')).toHaveText(
      failure === 'offline'
        ? 'The request could not reach Duoly. Check your connection and try again.'
        : 'The server returned an unreadable response. Reload and try again.',
    );
    await expect(
      page.getByRole('button', { name: 'Upload header' }),
    ).toBeEnabled();
  });
}

for (const kind of ['corrupt', 'narrow', 'oversized'] as const) {
  test(`rejects ${kind} input without a POST`, async ({ page }) => {
    let calls = 0;
    await page.route('**/api/teammate/profile-header', (route) => {
      calls++;
      return route.abort();
    });
    await open(page);
    const buffer =
      kind === 'narrow'
        ? await page.evaluate(() => {
            const c = document.createElement('canvas');
            c.width = 200;
            c.height = 200;
            return c.toDataURL('image/png').split(',')[1]!;
          })
        : null;
    await page.locator('[data-header-file]').setInputFiles({
      name: 'photo.png',
      mimeType: 'image/png',
      buffer: buffer
        ? Buffer.from(buffer, 'base64')
        : kind === 'oversized'
          ? Buffer.alloc(20 * 1024 * 1024 + 1)
          : Buffer.from('undecodable image'),
    });
    await expect(page.getByRole('alert')).toContainText(
      kind === 'narrow'
        ? 'only 200 pixels wide'
        : kind === 'oversized'
          ? 'over 20 MB'
          : 'could not be opened',
    );
    expect(calls).toBe(0);
  });
}

for (const encoding of ['png', 'oversized'] as const) {
  test(`encoder ${encoding} output fails before any request`, async ({
    page,
  }) => {
    let calls = 0;
    await page.route('**/api/teammate/profile-header', (route) => {
      calls++;
      return route.abort();
    });
    await open(page);
    await pick(page);
    await page.evaluate((encoding) => {
      HTMLCanvasElement.prototype.toDataURL = () =>
        encoding === 'png'
          ? 'data:image/png;base64,YQ=='
          : 'data:image/jpeg;base64,' + 'A'.repeat(420000);
    }, encoding);
    await page.getByRole('button', { name: 'Upload header' }).click();
    await expect(page.getByRole('alert')).toHaveText(
      encoding === 'png'
        ? 'This browser could not save the picture. Try another browser.'
        : 'That picture stays over 300 KB even at low quality. Try one with less fine detail.',
    );
    expect(calls).toBe(0);
  });
}

test('a saved header survives other settings saves and a fresh settings read', async ({
  page,
}) => {
  let header: string | null = null;
  await page.route('**/api/teammate/public-profile', (route) =>
    route.fulfill({
      json:
        route.request().method() === 'GET' ? { ...profile, header } : profile,
    }),
  );
  await page.route('**/api/teammate/profile-header', (route) => {
    header = saved;
    return route.fulfill({ json: { url: saved } });
  });
  await open(page);
  await page.goto('/public-profile?load');
  await expect(page.getByText('You have no header yet')).toBeVisible();
  await pick(page);
  await page.getByRole('button', { name: 'Upload header' }).click();
  await expect(page.getByText('Header saved.')).toBeVisible();
  await page
    .getByRole('button', { name: 'Save public profile', exact: true })
    .click();
  await expect(
    page.getByText('Public profile saved.', { exact: true }),
  ).toBeVisible();
  await expect(page.getByAltText('Your header image')).toHaveAttribute(
    'src',
    saved,
  );
  await page.reload();
  await expect(page.getByAltText('Your header image')).toHaveJSProperty(
    'naturalWidth',
    1500,
  );
});

test('a delayed settings save cannot erase a newer header upload', async ({
  page,
}) => {
  let reply: (() => Promise<void>) | undefined;
  await page.route('**/api/teammate/public-profile', async (route) => {
    reply = () => route.fulfill({ json: { ...profile, header: null } });
  });
  await page.route('**/api/teammate/profile-header', (route) =>
    route.fulfill({ json: { url: saved } }),
  );
  await open(page);
  await page
    .getByRole('button', { name: 'Save public profile', exact: true })
    .click();
  await expect.poll(() => Boolean(reply)).toBe(true);
  await pick(page);
  await page.getByRole('button', { name: 'Upload header' }).click();
  await expect(page.getByText('Header saved.')).toBeVisible();
  await reply!();
  await expect(
    page.getByText('Public profile saved.', { exact: true }),
  ).toBeVisible();
  await expect(page.getByAltText('Your header image')).toHaveAttribute(
    'src',
    saved,
  );
});

test('a fresh settings read cannot resurrect an old upload error', async ({
  page,
}) => {
  await page.route('**/api/teammate/public-profile', (route) =>
    route.fulfill({ json: { ...profile, header: null } }),
  );
  await page.route('**/api/teammate/profile-header', (route) =>
    route.fulfill({
      status: 503,
      json: { error: 'Header could not be saved.' },
    }),
  );
  await open(page);
  await page.goto('/public-profile?load');
  await pick(page);
  await page.getByRole('button', { name: 'Upload header' }).click();
  await expect(page.getByRole('alert')).toHaveText(
    'Header could not be saved.',
  );
  await page.reload();
  await expect(page.getByText('You have no header yet')).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('records whether browser history restores the old error without another POST', async ({
  page,
}, info) => {
  let calls = 0;
  await page.route('**/api/teammate/profile-header', (route) => {
    calls++;
    return route.fulfill({
      status: 503,
      json: { error: 'Header could not be saved.' },
    });
  });
  await open(page);
  await pick(page);
  await page.getByRole('button', { name: 'Upload header' }).click();
  await expect(page.getByRole('alert')).toHaveText(
    'Header could not be saved.',
  );
  await page.evaluate(() => {
    document.documentElement.dataset.headerDocument = 'original';
  });
  await page.goto('/public-profile?away');
  await page.goBack();
  await page.waitForSelector('astro-island:not([ssr])', { state: 'attached' });
  const retained = await page.evaluate(
    () => document.documentElement.dataset.headerDocument === 'original',
  );
  await expect(page.getByRole('alert')).toHaveCount(retained ? 1 : 0);
  expect(calls).toBe(1);
  console.log('history restore:', info.project.name, { retained });
});

test('large noisy camera photo encodes within both binary and JSON limits', async ({
  page,
}, info) => {
  let image = '';
  let bodyBytes = 0;
  await page.route('**/api/teammate/profile-header', (route) => {
    const body = route.request().postData()!;
    image = JSON.parse(body).image;
    bodyBytes = Buffer.byteLength(body);
    return route.fulfill({ json: { url: saved } });
  });
  await open(page);
  const photo = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 4032;
    c.height = 3024;
    const ctx = c.getContext('2d')!;
    const pixels = ctx.createImageData(c.width, c.height);
    let seed = 42;
    for (let y = 0; y < c.height; y++)
      for (let x = 0; x < c.width; x++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
        const noise = (seed >>> 24) * 0.6;
        const i = (y * c.width + x) * 4;
        pixels.data[i] = noise + (100 * x) / c.width;
        pixels.data[i + 1] = noise + (100 * y) / c.height;
        pixels.data[i + 2] = noise + 50;
        pixels.data[i + 3] = 255;
      }
    ctx.putImageData(pixels, 0, 0);
    return c.toDataURL('image/jpeg', 0.95).split(',')[1]!;
  });
  await page.locator('[data-header-file]').setInputFiles({
    name: 'camera.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from(photo, 'base64'),
  });
  await expect(page.getByRole('img', { name: 'Header crop' })).toBeVisible();
  await page.getByRole('button', { name: 'Upload header' }).click();
  await expect(page.getByText('Header saved.')).toBeVisible();
  expect(
    Buffer.from(image.split(',')[1]!, 'base64').length,
  ).toBeLessThanOrEqual(307200);
  expect(bodyBytes).toBeLessThanOrEqual(410000);
  const facts = {
    engine: info.project.name,
    type: image.slice(0, image.indexOf(',')),
    bytes: Buffer.from(image.split(',')[1]!, 'base64').length,
    bodyBytes,
  };
  console.log('camera encoder:', facts);
  await info.attach('encoder.json', {
    body: JSON.stringify(facts),
    contentType: 'application/json',
  });
});

test('a teammate without a saved public profile is told to save it before adding a header', async ({
  page,
}) => {
  let posts = 0;
  await page.route('**/api/teammate/profile-header', (route) => {
    posts++;
    return route.fulfill({ status: 500, body: '{}' });
  });
  await page.goto('/public-profile?fresh&header=none');
  await expect(page.locator('[data-header-locked]')).toHaveText(
    'Save your public profile once, then you can add a header image.',
  );
  await expect(page.locator('.pp-header input[type=file]')).toHaveCount(0);
  expect(posts).toBe(0);
});
