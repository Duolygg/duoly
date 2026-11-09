import type { QuoteContext } from '../../contracts/pricing';
import { SITE_GAMES } from '../../site/games';
import { COACHING_SLUGS } from '../../site/seo';
import { intentForGame, intentPath } from '../../content/intent-pages';
import { seoOffers } from './offers';

/**
 * The two all-games directory pages, /coaching and /find-gaming-buddies.
 *
 * Both read the same catalog and the same checkout pricing engine as every
 * other page, so a service Duoly stops selling leaves the directory on the next
 * build rather than being delisted by hand. Social is a game-free service and
 * keeps its own hub, so it is listed separately where a page wants it.
 */

export interface DirectoryEntry {
  id: string;
  name: string;
  slug: string;
  img: string;
  /** The page that goes deepest on this game: its own page, else the hub. */
  path: string;
  /** True when `path` is a dedicated coaching or teammate page. */
  dedicated: boolean;
  offers: ReturnType<typeof seoOffers>;
  /** Service names, deduplicated, in catalog order. */
  titles: string[];
  cheapest: ReturnType<typeof seoOffers>[number];
}

const entry = (
  game: (typeof SITE_GAMES)[number],
  offers: ReturnType<typeof seoOffers>,
  path: string,
  dedicated: boolean,
): DirectoryEntry => ({
  id: game.id,
  name: game.name,
  slug: game.slug,
  img: game.img,
  path,
  dedicated,
  offers,
  titles: [...new Set(offers.map((offer) => offer.title))],
  cheapest: [...offers].sort((a, b) => a.amountMinor - b.amountMinor)[0]!,
});

/** Every game whose catalog entry sells coaching, with its lesson prices. */
export function coachingDirectory(context: QuoteContext): DirectoryEntry[] {
  return SITE_GAMES.flatMap((game) => {
    if (game.slug === 'social') return [];
    const offers = seoOffers(game.id, 'training', context);
    if (!offers.length) return [];
    const dedicated = (COACHING_SLUGS as readonly string[]).includes(game.slug);
    return [
      entry(
        game,
        offers,
        dedicated ? `/games/${game.slug}/coaching` : `/games/${game.slug}`,
        dedicated,
      ),
    ];
  });
}

/** Every game whose catalog entry sells a teammate, with its duo prices. */
export function teammateDirectory(context: QuoteContext): DirectoryEntry[] {
  return SITE_GAMES.flatMap((game) => {
    if (game.slug === 'social') return [];
    const offers = seoOffers(game.id, 'teammate', context);
    if (!offers.length) return [];
    const intent = intentForGame(game.slug);
    return [
      entry(
        game,
        offers,
        intent ? intentPath(intent) : `/games/${game.slug}`,
        Boolean(intent),
      ),
    ];
  });
}

/**
 * One price line for a directory, from the entries themselves.
 *
 * Coaching costs the same in every game, so the honest line names the price
 * once and then the units it is sold in. A directory whose prices ever differ
 * falls back to the cheapest, which is what the "from" prefix means.
 */
export function directoryPrice(entries: DirectoryEntry[]) {
  const offers = entries.flatMap((item) => item.offers);
  const cheapest = [...offers].sort(
    (a, b) => a.amountMinor - b.amountMinor,
  )[0]!;
  const flat = offers.every(
    (offer) => offer.amountMinor === cheapest.amountMinor,
  );
  const units = [...new Set(offers.map((offer) => offer.unit))].sort();
  return `${flat ? '' : 'From '}${cheapest.display} per ${units.join(' or per ')}`;
}
