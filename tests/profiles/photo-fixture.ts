import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';

/** The fixture teammate who uploaded a photo (profile-fixtures.ts). */
export const PHOTO_SLUG = 'lumi';
export const PHOTO_NAME = 'Lumi';
export const PHOTO_URL =
  'https://duolyfixture.supabase.co/storage/v1/object/public/avatars/3f9b7c21-5d64-4ab8-9f0e-2c7d81a4e6b5/7c1a4e9b20d53f68.webp';

/** A real 256x256 WebP, the size and format the profile cropper writes. */
const photo = readFileSync(
  new URL('../fixtures/profiles/teammate-photo.webp', import.meta.url),
);

/**
 * Answers the fixture photo from disk. Uploaded avatars live on the project's Supabase host, and
 * a test run must not depend on that host being reachable, so every request for an avatar object
 * is served locally with the bytes a real upload would have.
 */
export async function servePhotos(page: Page): Promise<void> {
  await page.route('**/storage/v1/object/public/avatars/**', (route) =>
    route.fulfill({ status: 200, contentType: 'image/webp', body: photo }),
  );
}
