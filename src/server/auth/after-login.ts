import type { AstroCookies } from 'astro';

/**
 * Set by the homepage when a signed-out visitor presses pay. Only one value is
 * honoured, so this can never become an open redirect.
 */
export const RESUME_COOKIE = 'duoly_resume';

export function afterLoginPath(cookies: AstroCookies): '/' | '/dashboard' {
  const resume = cookies.get(RESUME_COOKIE)?.value === 'checkout';
  if (resume) cookies.delete(RESUME_COOKIE, { path: '/' });
  return resume ? '/' : '/dashboard';
}
