import type { AstroCookies } from 'astro';
import { slugValid } from '../../contracts/teammate-profile';
import { publicProfilesEnabled } from './public-profiles';

/**
 * The teammate a signed-out visitor was booking when they pressed Book.
 *
 * Nothing on a public profile puts a sign-in wall in front of booking: the button goes straight
 * to the booking page, exactly as it does for a signed-in customer, and the slug is left behind
 * in this cookie. Checkout asks for an account before paying anyway, so the visitor signs in a
 * step later, and that is where the cookie is spent: the teammate is added to the new account's
 * favorites, which is the one thing that changes the queue for them (a favorite sees the order
 * the moment it goes public, with no priority delay).
 *
 * The cookie only ever holds a slug, re-checked against the contract pattern here, so it can
 * never carry a path or a URL into the after-login redirect. It is not httpOnly, because the
 * page writes it in the browser, and it is spent on the first sign-in after it was set.
 */
export const PENDING_FAVORITE_COOKIE = 'duoly_pending_favorite';
/** Two hours: long enough to finish a checkout and sign up, short enough to be forgotten. */
export const PENDING_FAVORITE_MAX_AGE = 7200;
/** The attributes the page writes, kept next to the reader so the two cannot drift apart. */
export const PENDING_FAVORITE_ATTRIBUTES = `Max-Age=${PENDING_FAVORITE_MAX_AGE}; Path=/; SameSite=Lax; Secure`;

/**
 * What happened to the cookie. Nothing here ever reaches the visitor: a failed save must not
 * cost them their sign-in, so the result exists for tests and nothing else.
 */
export type PendingFavoriteResult =
  'none' | 'invalid' | 'skipped' | 'saved' | 'failed';

/** The one call this needs from a Supabase client, so nothing here depends on the SDK types. */
export type FavoriteRpc = (
  fn: string,
  args?: Record<string, unknown>,
) => PromiseLike<{ data?: unknown; error?: unknown }>;

/** The slug in the cookie, or null when there is nothing valid to act on. */
export function pendingFavoriteSlug(cookies: AstroCookies): string | null {
  const value = cookies.get(PENDING_FAVORITE_COOKIE)?.value ?? '';
  return slugValid(value) ? value : null;
}

/**
 * Spend the cookie: clear it, then save the teammate for the account that just signed in.
 *
 * The cookie is cleared before anything else can fail, so a junk value or an unavailable
 * database cannot leave it behind to be retried on every later sign-in. Only a customer has a
 * favorites list, so a teammate or an admin simply drops it.
 */
export async function consumePendingFavorite(
  cookies: AstroCookies,
  role: string | undefined,
  rpc: FavoriteRpc | null,
): Promise<PendingFavoriteResult> {
  const value = cookies.get(PENDING_FAVORITE_COOKIE)?.value ?? '';
  if (!value) return 'none';
  cookies.delete(PENDING_FAVORITE_COOKIE, { path: '/' });
  if (!slugValid(value)) return 'invalid';
  if (!publicProfilesEnabled() || role !== 'customer' || !rpc) return 'skipped';
  try {
    const answer = await rpc('customer_favorite_add_by_slug', {
      p_slug: value,
    });
    // The function reports a refusal (cap reached, profile gone) inside data, not as an error.
    const refused =
      !!answer?.data &&
      typeof answer.data === 'object' &&
      'error' in (answer.data as Record<string, unknown>);
    return answer?.error || refused ? 'failed' : 'saved';
  } catch {
    return 'failed';
  }
}
