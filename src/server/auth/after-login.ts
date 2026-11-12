import type { AstroCookies } from 'astro';
import { slugValid } from '../../contracts/teammate-profile';
import {
  consumePendingFavorite,
  type FavoriteRpc,
} from '../teammates/pending-favorite';

/**
 * Set by the homepage when a signed-out visitor presses pay, and by a public teammate profile
 * when they press the Save heart. Only the values below are honoured and a profile slug is
 * re-checked against the contract pattern, so this can never become an open redirect.
 *
 * Booking no longer uses this: a visitor who presses Book goes straight to booking and leaves
 * a pending-favorite cookie instead (../teammates/pending-favorite.ts).
 */
export const RESUME_COOKIE = 'duoly_resume';
/** The Save heart: come back to the profile, which saves them and stays put. */
export const RESUME_PROFILE_SAVE = 'profile-save:';

export function afterLoginPath(cookies: AstroCookies): string {
  const value = cookies.get(RESUME_COOKIE)?.value ?? '';
  const profile = value.startsWith(RESUME_PROFILE_SAVE);
  const slug = profile ? value.slice(RESUME_PROFILE_SAVE.length) : '';
  if (value === 'checkout' || profile)
    cookies.delete(RESUME_COOKIE, { path: '/' });
  if (value === 'checkout') return '/';
  if (profile && slugValid(slug)) return `/teammates/${slug}?save=1`;
  return '/dashboard';
}

/**
 * Everything that happens once a visitor is signed in: any teammate they were booking is added
 * to their favorites, then they go where they were headed. Saving is silent and never blocks
 * the redirect, so a database that is down costs nobody their sign-in.
 */
export async function afterLogin(
  cookies: AstroCookies,
  role: string | undefined,
  /* The Supabase client, narrowed to the one call this needs: its own rpc() is typed against
     the generated function names, which a plain string argument does not satisfy. */
  client: unknown,
): Promise<string> {
  const callable = client as { rpc?: FavoriteRpc } | null;
  const rpc =
    typeof callable?.rpc === 'function'
      ? (callable.rpc.bind(callable) as FavoriteRpc)
      : null;
  await consumePendingFavorite(cookies, role, rpc);
  return afterLoginPath(cookies);
}
