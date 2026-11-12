import type { AstroCookies } from 'astro';
import { slugValid } from '../../contracts/teammate-profile';

/**
 * Set by the homepage when a signed-out visitor presses pay, and by a public teammate profile
 * when they press "Book with <Name>" or the Save heart. Only the values below are honoured and
 * a profile slug is re-checked against the contract pattern, so this can never become an open
 * redirect.
 */
export const RESUME_COOKIE = 'duoly_resume';
/** "Book with <Name>": come back to the profile, which saves them and opens booking. */
export const RESUME_PROFILE_BOOK = 'profile:';
/** The Save heart: come back to the profile, which saves them and stays put. */
export const RESUME_PROFILE_SAVE = 'profile-save:';

export function afterLoginPath(cookies: AstroCookies): string {
  const value = cookies.get(RESUME_COOKIE)?.value ?? '';
  const profile = [RESUME_PROFILE_BOOK, RESUME_PROFILE_SAVE].find((prefix) =>
    value.startsWith(prefix),
  );
  const slug = profile ? value.slice(profile.length) : '';
  if (value === 'checkout' || profile)
    cookies.delete(RESUME_COOKIE, { path: '/' });
  if (value === 'checkout') return '/';
  if (profile && slugValid(slug))
    return `/teammates/${slug}?${profile === RESUME_PROFILE_BOOK ? 'book' : 'save'}=1`;
  return '/dashboard';
}
