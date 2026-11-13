import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';

/** The fixture teammate who uploaded a header, and one who did not (profile-fixtures.ts). */
export const HEADER_SLUG = 'sola';
export const HEADER_NAME = 'Nyx';
export const PLAIN_SLUG = 'kairo';
export const HEADER_URL =
  'https://duolyfixture.supabase.co/storage/v1/object/public/profile-headers/3f9b7c21-5d64-4ab8-9f0e-2c7d81a4e6b5/91d4c7f0ab2e5368.webp';

/** A real 1500x500 WebP, the size and format the settings cropper writes. */
const art = readFileSync(
  new URL('../fixtures/profiles/teammate-header.webp', import.meta.url),
);
/** The same strip in white: the worst case a scrim over an unreviewed upload has to survive. */
const white = readFileSync(
  new URL('../fixtures/profiles/teammate-header-white.webp', import.meta.url),
);

/**
 * Answers the fixture header from disk. Uploaded headers live on the project's Supabase host,
 * and a test run must not depend on that host being reachable, so every request for a header
 * object is served locally with the bytes a real upload would have.
 */
export async function serveHeaders(
  page: Page,
  options: { variant?: 'art' | 'white'; delay?: number } = {},
): Promise<void> {
  const body = options.variant === 'white' ? white : art;
  await page.route(
    '**/storage/v1/object/public/profile-headers/**',
    async (route) => {
      if (options.delay)
        await new Promise((resolve) => setTimeout(resolve, options.delay));
      await route.fulfill({ status: 200, contentType: 'image/webp', body });
    },
  );
}
