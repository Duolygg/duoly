import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { authConfig } from '../auth/config';
import type { Database } from '../auth/database.types';
import type { HomeLive, RecentMatch } from '../../contracts/home';

/**
 * Homepage live elements (ledger #36): the "teammates online" figure and the
 * "Recent matches" ticker. Both are public and identical for every visitor, so
 * they are read with the publishable key (no session) and cached per server
 * instance. The JSON endpoint adds a CDN cache on top, which keeps Supabase
 * reads to a handful per minute on the Free plan.
 */

export type { HomeLive, RecentMatch } from '../../contracts/home';

export const HOME_LIVE_TTL_MS = 30_000;
export const HOME_LIVE_CACHE_CONTROL =
  'public, max-age=15, s-maxage=30, stale-while-revalidate=60';

const GAMES = new Set([
  'lol',
  'val',
  'cs2',
  'fn',
  'cod',
  'apex',
  'r6',
  'mr',
  'ow',
  'rl',
  'tft',
  'fc',
  'arc',
  'mc',
  'pu',
]);

/** Time from queue to match, written like his ticker: 58s, 1m 08s, 1h 05m. */
export function formatMatchTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  if (s < 60) return `${s}s`;
  if (s < 3600)
    return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
  return `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}m`;
}

const text = (value: unknown, max: number) =>
  typeof value === 'string'
    ? value
        .replace(/[\p{Cc}\s]+/gu, ' ')
        .trim()
        .slice(0, max)
    : '';

/** Maps public.home_recent_matches() rows into ticker rows. Anything malformed is dropped. */
export function mapRecentMatches(raw: unknown): RecentMatch[] {
  if (!Array.isArray(raw)) return [];
  const out: RecentMatch[] = [];
  for (const row of raw.slice(0, 20)) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const game = typeof r.game === 'string' ? r.game : '';
    const title = text(r.title, 40);
    const seconds = Number(r.matchSeconds);
    if (!GAMES.has(game) || !title || !Number.isFinite(seconds)) continue;
    const units = Number(r.units);
    const name = text(r.name, 16);
    const rating = Number(r.rating);
    out.push({
      game,
      // The database already sends a first name only, or null when it looks like an email.
      who: name && !/[@/:]/.test(name) ? name : 'A player',
      what:
        Number.isInteger(units) && units > 1 && !title.includes('×')
          ? `${title} ×${units}`
          : title,
      time: formatMatchTime(seconds),
      rating:
        r.rating !== null &&
        Number.isInteger(rating) &&
        rating >= 1 &&
        rating <= 5
          ? rating
          : null,
    });
  }
  return out;
}

type Loader = () => Promise<{ online: unknown; matches: unknown }>;

let client: { key: string; client: SupabaseClient<Database> } | null = null;

function publicClient(): SupabaseClient<Database> | null {
  const config = authConfig();
  if (!config) return null;
  const key = `${config.url} ${config.publishableKey}`;
  if (client?.key !== key)
    client = {
      key,
      client: createClient<Database>(config.url, config.publishableKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      }),
    };
  return client.client;
}

const defaultLoader: Loader = async () => {
  const db = publicClient();
  if (!db) return { online: 0, matches: [] };
  const [online, matches] = await Promise.all([
    db.rpc('presence_public_count'),
    db.rpc('home_recent_matches'),
  ]);
  return {
    online: online.error ? null : online.data,
    // Until the migration is applied the call fails; the ticker keeps his sample rows.
    matches: matches.error ? null : matches.data,
  };
};

let cached: { value: HomeLive; at: number } | null = null;
let pending: Promise<HomeLive> | null = null;

/** Cached for HOME_LIVE_TTL_MS per instance; one in-flight read at a time; a failed read keeps the last value. */
export async function homeLive(
  load: Loader = defaultLoader,
  now = Date.now(),
): Promise<HomeLive> {
  if (cached && now - cached.at < HOME_LIVE_TTL_MS) return cached.value;
  if (pending) return pending;
  pending = (async () => {
    try {
      const raw = await load();
      const online = typeof raw.online === 'number' ? raw.online : NaN;
      const value: HomeLive = {
        onlineNow:
          Number.isInteger(online) && online >= 0
            ? online
            : (cached?.value.onlineNow ?? 0),
        recentMatches:
          raw.matches === null
            ? (cached?.value.recentMatches ?? [])
            : mapRecentMatches(raw.matches),
      };
      cached = { value, at: now };
      return value;
    } catch {
      const value = cached?.value ?? { onlineNow: 0, recentMatches: [] };
      // Retry after a short pause instead of on every request.
      cached = { value, at: now - HOME_LIVE_TTL_MS + 5_000 };
      return value;
    } finally {
      pending = null;
    }
  })();
  return pending;
}

export function resetHomeLiveCache() {
  cached = null;
  pending = null;
}
