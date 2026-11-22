import { waitUntil } from '@vercel/functions';
import { normalizeRefCode } from '../../contracts/creators';
import { adminFor, paymentsConfig } from '../payments/config';

/**
 * Aggregate creator link clicks (25-creator-portal-spec.md): one counter per code and day, with no
 * IP, no cookie and no user id, so it is counted whatever the visitor chose in the cookie banner.
 * The referral cookie stays consent gated; this is only a number.
 *
 * Counted on the landing, which is where both paths end up: `?ref=CODE` directly, and
 * `duoly.gg/CODE`, whose 302 sends the visitor to `/?ref=CODE`. Counting the redirect as well
 * would count a short link twice.
 *
 * Fire and forget: the call is never awaited by the request, and a failure is swallowed. Same
 * bounded in-process throttle idea as the short link cache, so a bot hammering one code with a
 * fresh cookie jar cannot turn every page view into a database write.
 */
const MIN_GAP_MS = 250;
const recent = new Map<string, number>();
export function clearCreatorClickThrottle() {
  recent.clear();
}

/** True when this landing should be counted now. Bounded map, oldest entry drops first. */
export function shouldCountClick(code: string, now = Date.now()): boolean {
  const last = recent.get(code);
  if (last !== undefined && now - last < MIN_GAP_MS) return false;
  recent.delete(code);
  if (recent.size >= 1000) recent.delete(recent.keys().next().value!);
  recent.set(code, now);
  return true;
}

export type ClickCounter = (code: string) => Promise<unknown>;

const liveCounter: ClickCounter = async (code) => {
  const config = paymentsConfig();
  if (!config) return;
  return adminFor(config).rpc('creator_link_click', { p_code: code });
};

/**
 * Counts one landing on a creator link. Returns the code it counted, or null. Never throws and
 * never blocks: the caller does not await the database call.
 */
export function countCreatorLinkClick(
  url: URL | undefined,
  method: string | undefined,
  counter: ClickCounter = liveCounter,
  now = Date.now(),
): string | null {
  if (!url || method !== 'GET') return null;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/'))
    return null;
  const code = normalizeRefCode(url.searchParams.get('ref'));
  if (!code || !shouldCountClick(code, now)) return null;
  try {
    const pending = Promise.resolve(counter(code)).catch(() => undefined);
    try {
      // Serverless may stop work after returning a response unless its lifetime is registered.
      waitUntil(pending);
    } catch {
      /* Local requests have no Vercel lifetime context. The promise is already running. */
    }
  } catch {
    /* A click counter must never reach the visitor. */
  }
  return code;
}
