export const PREVIEW_AUTH_UNAVAILABLE =
  'Design preview: login and account creation are not connected.';

export function announcePreviewUnavailable(
  message = 'Design preview: this action is unavailable. Nothing was sent or changed.',
): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('duoly:preview-unavailable', { detail: { message } }),
    );
  }
}

export function signOut(
  options?: unknown,
): Promise<{ ok: false; error: string }> {
  void options;
  announcePreviewUnavailable(PREVIEW_AUTH_UNAVAILABLE);
  return Promise.resolve({ ok: false, error: PREVIEW_AUTH_UNAVAILABLE });
}

export function previewPermission(): Promise<'denied'> {
  announcePreviewUnavailable(
    'Browser notifications are disabled in this design preview.',
  );
  return Promise.resolve('denied');
}
