import { calculateQuote } from '../pricing';
import {
  BUNDLE_UNITS,
  QUANTITIES,
  quantityDiscountPercent,
} from '../../contracts/pricing';
import { serversFor } from '../../design-reference/lib/servers.js';
import { formatPrice } from './offers';

/**
 * Every figure the /fees-and-refunds page states, read back out of the pricing
 * engine instead of typed into the page.
 *
 * A fees page that quotes a stale price is worse than no fees page: it is the
 * one page a reader will hold us to. So each example below is a real
 * `calculateQuote` call with the same selection a customer would make, and
 * tests/unit/fees.test.ts asserts every rendered string against the engine.
 * Change a catalog price and the build fails rather than the page lying.
 */
const EUR = { customerCurrency: 'EUR', eurToUsd: 1 } as const;

const firstServer = (gameId: string) =>
  (serversFor(gameId) as [string, ...unknown[]][])[0]![0];

const quote = (
  gameId: string,
  serviceId: string,
  units: number,
  rank?: string,
  bundle = false,
) =>
  calculateQuote(
    {
      gameId,
      serviceId,
      server: firstServer(gameId),
      units,
      bundle,
      ...(rank ? { rank } : {}),
    } as Parameters<typeof calculateQuote>[0],
    EUR,
  );

/** The quantity picker's largest step, and the only one that discounts. */
export const MAX_QUANTITY = QUANTITIES[QUANTITIES.length - 1]!;
export const QUANTITY_PERCENT = quantityDiscountPercent(MAX_QUANTITY);
/** Bundles tab packs: 3, 5 and 10 units of a game's main service. */
export const BUNDLE_SIZES = [...BUNDLE_UNITS];
/**
 * The bundle discounts, re-exported rather than derived a second time: the
 * teammate pages already quote these out of a real bundle quote, and a fees
 * page that computed its own copy could disagree with the page beside it.
 */
export { BUNDLE_PERCENTS } from './teammate-facts';

export interface PriceExample {
  /** The selection in words, for the sentence that introduces the figure. */
  readonly label: string;
  /** The same selection as a table cell: game, service, rank and quantity. */
  readonly short: string;
  readonly units: number;
  readonly unit: 'game' | 'hour';
  /** One unit at this rank, before any quantity discount. */
  readonly perUnit: string;
  /** What checkout charges for the whole selection. */
  readonly total: string;
  readonly discountPercent: number;
  /** The difference against paying for each unit on its own. */
  readonly saved: string;
  readonly href: string;
}

/**
 * The checkout link for exactly the selection a row quotes.
 *
 * A fees page whose links open a different selection than the figure beside
 * them is how a price claim stops being checkable, so game, service, rank and
 * quantity all travel in the link. The parameters are the ones
 * src/contracts/booking-link.ts validates, and tests/unit/fees.test.ts feeds
 * every href back through `parseBookingPreferences` to prove the homepage
 * accepts it.
 */
const exampleHref = (
  gameId: string,
  serviceId: string,
  units: number,
  rank?: string,
) => {
  const query = new URLSearchParams({ game: gameId, service: serviceId });
  if (rank) query.set('rank', rank);
  if (units > 1) query.set('qty', String(units));
  return `/?${query}#modes-h`;
};

const example = (
  label: string,
  short: string,
  gameId: string,
  serviceId: string,
  units: number,
  rank?: string,
  bundle = false,
): PriceExample => {
  const one = quote(gameId, serviceId, 1, rank);
  const many = quote(gameId, serviceId, units, rank, bundle);
  return {
    label,
    short,
    units,
    unit: many.unit,
    perUnit: formatPrice(one.customer.amountMinor, 'EUR'),
    total: formatPrice(many.customer.amountMinor, 'EUR'),
    discountPercent: many.quantityDiscountPercent,
    saved: formatPrice(many.discountEurMinor, 'EUR'),
    href: exampleHref(gameId, serviceId, units, rank),
  };
};

/** One ranked game, the figure a reader checks the rest of the page against. */
export const SINGLE_GAME = example(
  'one ranked League of Legends game with a Master+ teammate at Gold rank',
  'League of Legends Duo Pro, Gold rank, 1 game',
  'lol',
  'duo2',
  1,
  'Gold',
);
/** The quantity picker at its largest step. */
export const FIVE_GAMES = example(
  'five of those games booked in one order',
  'League of Legends Duo Pro, Gold rank, 5 games',
  'lol',
  'duo2',
  MAX_QUANTITY,
  'Gold',
);
/** The largest discount in the catalog: a ten-unit bundle. */
export const TEN_GAME_BUNDLE = example(
  'a ten game bundle of the same service',
  'League of Legends Duo Pro bundle, Gold rank, 10 games',
  'lol',
  'duo2',
  BUNDLE_UNITS[BUNDLE_UNITS.length - 1]!,
  'Gold',
  true,
);
/** A coaching hour, which carries no quantity discount at all. */
export const COACHING_HOUR = example(
  'one Valorant VOD Review hour with an Immortal+ coach',
  'Valorant VOD Review, 1 hour',
  'val',
  'vod',
  1,
);
/** Five coaching hours, to show the flat rule rather than assert it. */
export const FIVE_COACHING_HOURS = example(
  'five coaching hours',
  'Valorant VOD Review, 5 hours',
  'val',
  'vod',
  MAX_QUANTITY,
);

/** The table on /fees-and-refunds, cheapest selection first. */
export const PRICE_EXAMPLES: readonly PriceExample[] = [
  SINGLE_GAME,
  FIVE_GAMES,
  TEN_GAME_BUNDLE,
  COACHING_HOUR,
  FIVE_COACHING_HOURS,
];

/**
 * The currency margin from the terms, as a number so the page and the test read
 * the same value. Terms, "Prices and payment": the euro price is converted at
 * the day's European Central Bank rate plus 1%, rounded up to .99.
 */
export const USD_MARGIN_PERCENT = 1;
/**
 * Minutes an unaccepted order waits before it cancels and refunds itself.
 * Stated in the terms ("Cancellations and refunds") and in the homepage FAQ.
 */
export const AUTO_CANCEL_MINUTES = 5;
/**
 * The day the catalog's prices last changed, re-exported so /fees-and-refunds
 * and /pricing.md keep importing it from here.
 *
 * It lives in src/site/price-dates.ts now, because every page whose prices come
 * out of the engine dates them to the same day and this module pulls in the
 * engine itself. That is the whole of it: one declared date, no page-local copy
 * of it anywhere.
 */
export {
  CATALOG_PRICES_UPDATED,
  CATALOG_PRICES_UPDATED_LABEL,
} from '../../site/price-dates';
