import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { authConfig } from '../auth/config';
import type { Database } from '../auth/database.types';
import type {
  HeroTeammate,
  HomeLive,
  HomeStats,
  RecentMatch,
} from '../../contracts/home';
import { UPLOADED_AVATAR } from '../../contracts/account';

/**
 * Homepage live elements (ledger #36): the "teammates online" figure and the
 * "Recent matches" ticker. Both are public and identical for every visitor, so
 * they are read with the publishable key (no session) and cached per server
 * instance. The JSON endpoint adds a CDN cache on top, which keeps Supabase
 * reads to a handful per minute on the Free plan.
 */

export type {
  HeroTeammate,
  HomeLive,
  HomeStats,
  RecentMatch,
} from '../../contracts/home';

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
  'social',
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

/** Maps public.home_teammates() into hero cards. Malformed entries are dropped, never repaired. */
export function mapHeroTeammates(raw: unknown): HeroTeammate[] {
  if (!Array.isArray(raw)) return [];
  const count = (value: unknown) =>
    typeof value === 'number' && Number.isInteger(value) && value >= 0
      ? value
      : null;
  const out: HeroTeammate[] = [];
  for (const entry of raw.slice(0, 24)) {
    if (!entry || typeof entry !== 'object') continue;
    const t = entry as Record<string, unknown>;
    const name = typeof t.name === 'string' ? t.name.trim().slice(0, 16) : '';
    const reviews = count(t.reviews);
    const sessions = count(t.sessions);
    if (name.length < 2 || reviews === null || sessions === null) continue;
    const image =
      typeof t.image === 'string' &&
      (/^\/assets\/avatars\/avatar-([1-9]|10)\.png$/.test(t.image) ||
        UPLOADED_AVATAR.test(t.image))
        ? t.image
        : '/assets/avatars/avatar-1.png';
    const rating = Number(t.rating);
    out.push({
      name,
      image,
      games: Array.isArray(t.games)
        ? t.games
            .filter((g): g is string => typeof g === 'string' && GAMES.has(g))
            .slice(0, 3)
        : [],
      gg: t.gg === true,
      online: t.online === true,
      rating:
        reviews > 0 && t.rating !== null && rating >= 1 && rating <= 5
          ? Math.round(rating * 10) / 10
          : null,
      reviews,
      sessions,
    });
  }
  return out;
}

/** Maps public.home_public_stats() into HomeStats. Anything malformed gives null. */
export function mapHomeStats(raw: unknown): HomeStats | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const count = (value: unknown) =>
    typeof value === 'number' && Number.isInteger(value) && value >= 0
      ? value
      : null;
  const sessions = count(r.sessions);
  const reviews = count(r.reviews);
  if (sessions === null || reviews === null) return null;
  const onlineByGame: Record<string, number> = {};
  if (r.onlineByGame && typeof r.onlineByGame === 'object')
    for (const [game, n] of Object.entries(
      r.onlineByGame as Record<string, unknown>,
    )) {
      const value = count(n);
      if (GAMES.has(game) && value !== null) onlineByGame[game] = value;
    }
  const regions = (r.onlineByRegion ?? {}) as Record<string, unknown>;
  const onlineByRegion = {
    eu: count(regions.eu) ?? 0,
    na: count(regions.na) ?? 0,
    ao: count(regions.ao) ?? 0,
    sa: count(regions.sa) ?? 0,
  };
  const rating = Number(r.rating);
  const matchSeconds = count(r.matchSeconds);
  return {
    onlineByGame,
    onlineByRegion,
    sessions,
    reviews,
    rating:
      reviews > 0 && r.rating !== null && rating >= 1 && rating <= 5
        ? Math.round(rating * 10) / 10
        : null,
    matchSeconds,
  };
}

type Loader = () => Promise<{
  online: unknown;
  matches: unknown;
  stats?: unknown;
  teammates?: unknown;
}>;

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
  if (!db) return { online: 0, matches: [], stats: null, teammates: [] };
  const [online, matches, stats, teammates] = await Promise.all([
    db.rpc('presence_public_count'),
    db.rpc('home_recent_matches'),
    // Not in the generated types until they are regenerated after the migration.
    (
      db.rpc as unknown as (fn: string) => PromiseLike<{
        data: unknown;
        error: unknown;
      }>
    )('home_public_stats'),
    (
      db.rpc as unknown as (fn: string) => PromiseLike<{
        data: unknown;
        error: unknown;
      }>
    )('home_teammates'),
  ]);
  return {
    online: online.error ? null : online.data,
    matches: matches.error ? null : matches.data,
    stats: stats.error ? null : stats.data,
    // Until migration 20261030100000 is applied this errors, so the hero keeps the logo.
    teammates: teammates.error ? null : teammates.data,
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
        stats: mapHomeStats(raw.stats) ?? cached?.value.stats ?? null,
        teammates:
          raw.teammates === null || raw.teammates === undefined
            ? (cached?.value.teammates ?? [])
            : mapHeroTeammates(raw.teammates),
      };
      cached = { value, at: now };
      return value;
    } catch {
      const value = cached?.value ?? {
        onlineNow: 0,
        recentMatches: [],
        stats: null,
        teammates: [],
      };
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
