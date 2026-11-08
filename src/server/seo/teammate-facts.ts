import { calculateQuote } from '../pricing';
import { SITE_GAMES } from '../../site/games';
import { servicesFor } from '../../design-reference/lib/catalog.js';
import { serversFor } from '../../design-reference/lib/servers.js';
import { formatPrice } from './offers';

/**
 * Every number the "get paid to play games" copy states, read back out of the
 * pricing engine and the catalog instead of typed into the page. The share
 * percentage comes from a real quote (customer total against teammate payout),
 * the bundle percentages from quotes at 3, 5 and 10 units, and the example
 * prices from the services those sentences name. tests/unit/teammate-facts
 * asserts each figure against calculateQuote, so a catalog or engine change
 * breaks the build rather than publishing a stale claim.
 */

// Server tokens differ per game (Valorant uses EU, Social uses Europe), so read the
// first valid one out of the catalog rather than hardcoding a token that throws.
const firstServer = (gameId: string) =>
  (serversFor(gameId) as [string, ...unknown[]][] | undefined)?.[0]?.[0] ?? '';

const quote = (
  gameId: string,
  serviceId: string,
  units: number,
  rank?: string,
) =>
  calculateQuote(
    {
      gameId,
      serviceId,
      server: firstServer(gameId),
      units,
      ...(rank ? { rank } : {}),
    } as Parameters<typeof calculateQuote>[0],
    { customerCurrency: 'EUR', eurToUsd: 1 },
  );

/** 60%: one seat's teammate payout against the customer total on a flat-priced hour. */
export const SHARE_PERCENT = (() => {
  const flat = quote('val', 'vod', 1);
  return Math.round(
    (flat.teammate.amountMinor / flat.customer.amountMinor) * 100,
  );
})();

/** Customer bundle discounts at 3, 5 and 10 units of a teammate service. */
export const BUNDLE_PERCENTS = [3, 5, 10].map(
  (units) => quote('val', 'duo1', units, 'Gold').quantityDiscountPercent,
);

/** The flat coaching hour every coachable game shares. */
export const COACHING_PRICE = formatPrice(
  quote('val', 'vod', 1).customer.amountMinor,
  'EUR',
);

/** The cheapest Valorant teammate game in the catalog, used as the low-end example. */
export const SHORT_GAME_PRICE = formatPrice(
  quote('val', 'skirm', 1).customer.amountMinor,
  'EUR',
);

/** Games with a coaching service, counted from the catalog rather than hardcoded. */
export const COACHABLE_GAMES = SITE_GAMES.filter((game) =>
  (
    servicesFor(game.id) as { modes?: { cat: string }[] } | undefined
  )?.modes?.some((mode) => mode.cat === 'training'),
).length;

/** Bookable games, excluding Social, which sells voice company rather than a game. */
export const PLAYABLE_GAMES = SITE_GAMES.filter(
  (game) => game.id !== 'social',
).length;

const socialModes =
  (servicesFor('social') as { modes?: { id: string }[] } | undefined)?.modes ??
  [];

/** How many Social voice modes the catalog sells (Just Chat, Watch Together, ...). */
export const SOCIAL_MODES = socialModes.length;

/** The Social hourly price, quoted through the engine like every other price. */
export const SOCIAL_PRICE = formatPrice(
  quote('social', socialModes[0]!.id, 1).customer.amountMinor,
  'EUR',
);
