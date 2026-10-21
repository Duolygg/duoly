import { expect, it } from 'vitest';
import {
  signOut,
  previewPermission,
  PREVIEW_AUTH_UNAVAILABLE,
} from '../../src/design-preview/preview-auth';

it('does not pretend that signing out or provider authentication succeeded', async () => {
  const result = await signOut({ callbackUrl: 'https://example.invalid' });
  expect(result).toEqual({ ok: false, error: PREVIEW_AUTH_UNAVAILABLE });
});

it('does not request browser notification permission in the preview', async () => {
  expect(await previewPermission()).toBe('denied');
});
