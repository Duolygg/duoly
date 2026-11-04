import type { AstroCookies } from 'astro';
import { normalizeRefCode, REF_COOKIE_DAYS } from '../contracts/creators';
import { CONSENT_COOKIE, parseConsent } from '../contracts/consent';

/**
 * Creator referral capture (ledger #28). A visitor who lands on any page with
 * `?ref=CODE` gets an httpOnly cookie with that code; the checkout reads it on
 * the server and stores it on the checkout intent, where the database resolves
 * it to an active creator. The browser never sends a code or an amount.
 *
 * Off unless REFERRALS_ENABLED=true. The cookie is optional, so it is only set
 * after the visitor allowed the creator link purpose; "Only necessary"
 * removes an existing one and stops checkout from reading it (owner decision
 * 2026-10-27, docs/product/creators.md).
 */
export const referralsEnabled = () => process.env.REFERRALS_ENABLED === 'true';

export const refCookieName = (secure: boolean) =>
  secure ? '__Host-duoly-ref' : 'duoly-ref';

/**
 * Sets the referral cookie for a page visit with a valid ?ref= code. The first
 * code wins: an existing valid cookie is never replaced, like the database
 * never replaces a customer's creator.
 */
export function captureReferral(
  url: URL | undefined,
  method: string | undefined,
  cookies: AstroCookies | undefined,
  enabled = referralsEnabled(),
): string | null {
  if (!enabled || !url || !cookies || method !== 'GET') return null;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/'))
    return null;
  const secure = url.protocol === 'https:';
  const name = refCookieName(secure);
  const consent = parseConsent(cookies.get(CONSENT_COOKIE)?.value);
  if (!consent?.referral) {
    if (consent?.referral === false && cookies.get(name))
      cookies.delete(name, { path: '/', secure });
    return null;
  }
  const code = normalizeRefCode(url.searchParams.get('ref'));
  if (!code) return null;
  if (normalizeRefCode(cookies.get(name)?.value)) return null;
  cookies.set(name, code, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: REF_COOKIE_DAYS * 86400,
  });
  return code;
}

/** The code to store on a new checkout, read only from the server-set cookie. */
export function checkoutRefCode(
  cookies: AstroCookies,
  secure: boolean,
  enabled = referralsEnabled(),
): string | null {
  if (!enabled) return null;
  if (!parseConsent(cookies.get(CONSENT_COOKIE)?.value)?.referral) return null;
  return normalizeRefCode(cookies.get(refCookieName(secure))?.value);
}
