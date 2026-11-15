import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

// sips -s format heic header-source.jpg --out header-source.heic on macOS.
const heic = readFileSync(
  new URL('../fixtures/profiles/header-source.heic', import.meta.url),
);
test('a real HEIC is either decoded or rejected before upload', async ({
  page,
  browserName,
}) => {
  let calls = 0;
  await page.route('**/api/teammate/profile-header', (route) => {
    calls++;
    expect(route.request().postDataJSON().image).toMatch(
      /^data:image\/(jpeg|webp);base64,/,
    );
    return route.fulfill({ json: { url: '/heic-saved.webp' } });
  });
  await page.route('**/heic-saved.webp', (route) =>
    route.fulfill({
      contentType: 'image/webp',
      body: readFileSync(
        new URL('../fixtures/profiles/teammate-header.webp', import.meta.url),
      ),
    }),
  );
  await page.goto('/public-profile');
  await page.waitForSelector('astro-island:not([ssr])', { state: 'attached' });
  await page.locator('[data-header-file]').setInputFiles({
    name: 'camera.heic',
    mimeType: 'image/heic',
    buffer: heic,
  });
  if (browserName === 'webkit') {
    await expect(page.getByRole('img', { name: 'Header crop' })).toBeVisible();
    await page.getByRole('button', { name: 'Upload header' }).click();
    await expect(page.getByText('Header saved.')).toBeVisible();
    expect(calls).toBe(1);
  } else {
    await expect(page.getByRole('alert')).toHaveText(
      'That picture could not be opened. Try a JPG or PNG.',
    );
  }
});
