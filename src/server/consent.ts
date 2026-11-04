import type { AstroCookies } from 'astro';
import { CONSENT_COOKIE, parseConsent } from '../contracts/consent';

/** Unknown consent stays null so later analytics can distinguish no answer. */
export function consentFromCookies(cookies: Pick<AstroCookies, 'get'>) {
  return parseConsent(cookies.get(CONSENT_COOKIE)?.value);
}
