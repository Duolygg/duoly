import { normalizeRefCode } from '../../contracts/creators';
import { adminFor, paymentsConfig } from '../payments/config';

/**
 * Creator short links (duoly.gg/yourname, promised on /creators). A one-segment path that no
 * page answers (404) and that matches an active creator code redirects to /?ref=CODE, where the
 * normal consent-gated referral capture takes over. Real pages always win because only 404s are
 * looked at, and unknown or paused codes keep their 404.
 */
const PATH = /^\/([A-Za-z0-9]{3,20})\/?$/;

export type ActiveCodeLookup = (code: string) => Promise<boolean>;

/** The code a 404 path could be, or null when it cannot be a creator code. */
export function shortLinkCode(pathname: string): string | null {
  const match = PATH.exec(pathname);
  return match ? normalizeRefCode(match[1]) : null;
}

// Bounded cache so bots probing random paths cannot turn every 404 into a database read.
const TTL_MS = 5 * 60_000;
const cache = new Map<string, { at: number; active: boolean }>();
export function clearShortLinkCache() {
  cache.clear();
}

async function cached(
  code: string,
  lookup: ActiveCodeLookup,
  now: number,
): Promise<boolean> {
  const hit = cache.get(code);
  if (hit && now - hit.at < TTL_MS) return hit.active;
  const active = await lookup(code);
  if (cache.size >= 1000) cache.delete(cache.keys().next().value!);
  cache.set(code, { at: now, active });
  return active;
}

const liveLookup: ActiveCodeLookup = async (code) => {
  const config = paymentsConfig();
  if (!config) return false;
  const found = await adminFor(config)
    .from('creators')
    .select('code')
    .eq('code', code)
    .eq('active', true)
    .maybeSingle();
  if (found.error) throw new Error('creator lookup unavailable');
  return Boolean(found.data);
};

/** Where a 404 GET should go instead, or null to keep the 404. Never throws. */
export async function creatorShortLink(
  url: URL | undefined,
  method: string | undefined,
  status: number,
  lookup: ActiveCodeLookup = liveLookup,
  now = Date.now(),
): Promise<string | null> {
  if (status !== 404 || !url || (method !== 'GET' && method !== 'HEAD'))
    return null;
  const code = shortLinkCode(url.pathname);
  if (!code) return null;
  try {
    if (!(await cached(code, lookup, now))) return null;
  } catch {
    return null;
  }
  const target = new URLSearchParams(url.search);
  target.set('ref', code);
  return '/?' + target.toString();
}
