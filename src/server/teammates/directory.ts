/*
 * Everything the teammate directory shows, worked out on the server from the query string: the
 * filters (name, availability, language, play style, coaching, verified rank), the sort, the
 * curated rows, the per-game counts on the game tiles, the trust numbers and each card's entry
 * price. The page and the per-game pages (/games/<game>/teammates) render this as-is, so every
 * view is a plain shareable URL and works without JavaScript.
 */
import {
  VIBE_TAGS,
  type PublicTeammateCard,
  type VibeTag,
} from '../../contracts/teammate-profile';
import { SITE_GAMES, type SiteGame } from '../../site/games';
import { bookingHref } from '../../site/seo';
import { seoOffers } from '../seo/offers';
import { loadIndexableProfiles, loadTeammateCards } from './public-profiles';

export const SORTS = [
  { id: 'recommended', label: 'Recommended' },
  { id: 'rated', label: 'Top rated' },
  { id: 'reviews', label: 'Most reviewed' },
] as const;
export type SortId = (typeof SORTS)[number]['id'];

/** Cards shown before "Show more". */
export const PAGE_SIZE = 24;
/** Cards in a curated row. */
const ROW_SIZE = 8;

export interface DirectoryFilters {
  q: string;
  online: boolean;
  lang: string | null;
  style: VibeTag | null;
  coaching: boolean;
  verified: boolean;
  /** Verified Gamer Girls only. */
  gg: boolean;
  sort: SortId;
  all: boolean;
}

export function readFilters(params: URLSearchParams): DirectoryFilters {
  const q = (params.get('q') ?? '').trim().slice(0, 40);
  const lang = (params.get('lang') ?? '').trim().slice(0, 30) || null;
  const style = VIBE_TAGS.find((t) => t === params.get('style')) ?? null;
  return {
    q,
    online: params.get('online') === '1',
    lang,
    style,
    coaching: params.get('coaching') === '1',
    verified: params.get('verified') === '1',
    gg: params.get('gg') === '1',
    sort: SORTS.find((s) => s.id === params.get('sort'))?.id ?? 'recommended',
    all: params.get('show') === 'all',
  };
}

/** True when anything narrows or reorders the list beyond the game. */
export const filtered = (f: DirectoryFilters) =>
  Boolean(
    f.q || f.online || f.lang || f.style || f.coaching || f.verified || f.gg,
  ) || f.sort !== 'recommended';

const score = (c: PublicTeammateCard) => c.rating?.average ?? 0;
const count = (c: PublicTeammateCard) => c.rating?.count ?? 0;

export function sortCards(cards: PublicTeammateCard[], sort: SortId) {
  return [...cards].sort((a, b) =>
    sort === 'rated'
      ? score(b) - score(a) || count(b) - count(a)
      : sort === 'reviews'
        ? count(b) - count(a) || score(b) - score(a)
        : Number(b.online) - Number(a.online),
  );
}

export function applyFilters(cards: PublicTeammateCard[], f: DirectoryFilters) {
  const q = f.q.toLowerCase();
  return sortCards(
    cards.filter(
      (c) =>
        (!q || c.name.toLowerCase().includes(q)) &&
        (!f.online || c.online) &&
        (!f.lang || (c.languages ?? []).includes(f.lang)) &&
        (!f.style || (c.vibeTags ?? []).includes(f.style)) &&
        (!f.coaching || c.coaching === true) &&
        (!f.verified || Boolean(c.rank)) &&
        (!f.gg || c.gamerGirl === true),
    ),
    f.sort,
  );
}

/** The cheapest teammate service for a game, as the catalog quotes it, and its booking link. */
const priceCache = new Map<string, { price: string; unit: string } | null>();
export function entryPrice(gameId: string) {
  if (!priceCache.has(gameId)) {
    /* Social sells Gamer Girl sessions only, so its entry price is the cheapest of those. */
    const cheapest =
      seoOffers(gameId, gameId === 'social' ? 'gg' : 'teammate', {
        customerCurrency: 'EUR',
        eurToUsd: 1,
      }).sort((a, b) => a.amountMinor - b.amountMinor)[0] ?? null;
    priceCache.set(
      gameId,
      cheapest ? { price: cheapest.display, unit: cheapest.unit } : null,
    );
  }
  return priceCache.get(gameId) ?? null;
}
export const bookFor = (gameId: string) => bookingHref(gameId);

/** Every value of a field across the cards, most common first, with its count. */
function facet(values: string[][]) {
  const counts = new Map<string, number>();
  for (const list of values)
    for (const v of new Set(list)) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([value, n]) => ({ value, count: n }));
}

export async function directoryData(
  params: URLSearchParams,
  game: SiteGame | undefined,
) {
  const f = readFilters(params);
  const [everyone, inGame, indexable] = await Promise.all([
    loadTeammateCards({ limit: 100 }),
    game ? loadTeammateCards({ game: game.id, limit: 100 }) : null,
    loadIndexableProfiles(),
  ]);
  /* The scope: one game's teammates, or everyone. */
  const scope = inGame ?? everyone;
  const results = applyFilters(scope, f);

  /* Trust numbers for the scope. */
  const rated = scope.filter((c) => c.rating && c.rating.count > 0);
  const reviews = rated.reduce((sum, c) => sum + c.rating!.count, 0);
  const average = reviews
    ? rated.reduce((sum, c) => sum + c.rating!.average * c.rating!.count, 0) /
      reviews
    : null;

  /* Game tiles: how many teammates play each game, and how many of them are online. */
  const plays = (c: PublicTeammateCard, id: string) =>
    (c.games ?? [c.game]).includes(id);
  /* Busiest first: most teammates online, then most teammates, then the site's own game order. */
  const tiles = SITE_GAMES.map((g) => ({
    ...g,
    total: everyone.filter((c) => plays(c, g.id)).length,
    online: everyone.filter((c) => c.online && plays(c, g.id)).length,
  })).sort((a, b) => b.online - a.online || b.total - a.total); // stable: ties keep game order

  /* Curated rows, only on an unfiltered view so nobody sees the same card three times while
     searching. */
  const rows = filtered(f)
    ? []
    : [
        {
          id: 'rated',
          title: 'Top rated',
          note: 'Highest customer rating, most reviews first on a tie.',
          cards: sortCards(
            scope.filter((c) => c.rating),
            'rated',
          ).slice(0, ROW_SIZE),
        },
        {
          id: 'gg',
          title: 'Gamer Girls',
          note: 'Verified Gamer Girls for Social sessions and Gamer Girl games.',
          cards: scope.filter((c) => c.gamerGirl).slice(0, ROW_SIZE),
        },
        {
          id: 'coaches',
          title: 'Coaches',
          note: 'Teammates who also coach: play together while they explain.',
          cards: scope.filter((c) => c.coaching).slice(0, ROW_SIZE),
        },
        {
          id: 'new',
          title: 'New on Duoly',
          note: 'Approved recently and building their record.',
          cards: scope.filter((c) => c.tier === 'rookie').slice(0, ROW_SIZE),
        },
      ].filter((row) => row.cards.length >= 2);

  return {
    filters: f,
    scope,
    results,
    everyone,
    stats: {
      total: scope.length,
      online: scope.filter((c) => c.online).length,
      reviews,
      average,
    },
    tiles,
    rows,
    languages: facet(scope.map((c) => c.languages ?? [])),
    styles: facet(scope.map((c) => c.vibeTags ?? [])),
    coaches: scope.filter((c) => c.coaching).length,
    gamerGirls: scope.filter((c) => c.gamerGirl).length,
    verified: scope.filter((c) => c.rank).length,
    indexable,
  };
}
export type DirectoryData = Awaited<ReturnType<typeof directoryData>>;
