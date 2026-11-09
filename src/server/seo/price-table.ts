import { servicesFor } from '../../design-reference/lib/catalog.js';
import { ranksOf } from '../../design-reference/lib/ranks.js';
import { calculateQuote } from '../pricing';
import { seatRule } from '../../contracts/seats';
import { SITE_GAMES } from '../../site/games';
import { FINISHED_HUB_SLUGS } from '../../content/hub-pages';
import { cleanCopy, formatPrice, offerSelection } from './offers';

/**
 * The /pricing table: every game, every bookable service and what each one
 * costs, read out of the pricing engine on every build.
 *
 * /pricing.md already publishes the same catalog as plain text for assistants.
 * This module exists for the human page beside it, which needs the data shaped
 * for a table rather than for a parser: one row per service, the cheapest and
 * dearest price a rank can reach, and a checkout link that opens exactly the
 * row it sits in.
 *
 * Nothing here is hand-copied. Every figure is a `calculateQuote` call with the
 * selection a customer would make, and tests/unit/price-table.test.ts
 * re-derives each printed string from the engine and fails when the table and
 * checkout disagree. A catalog price change updates this page by rebuilding.
 */

const EUR = { customerCurrency: 'EUR', eurToUsd: 1 } as const;

type Mode = {
  readonly id: string;
  readonly cat: string;
  readonly title: string;
  readonly tier: string;
};

/**
 * The catalog's service categories, in the order a reader thinks about them.
 * Same order and the same labels as /pricing.md, so the two documents group the
 * catalog identically.
 */
export const CATEGORY_HEADINGS: readonly [string, string][] = [
  ['duo', 'Teammate sessions'],
  ['other', 'Team fills'],
  ['training', 'Coaching'],
  ['gg', 'Gamer Girl sessions'],
  ['social', 'Voice sessions'],
];

const quote = (gameId: string, serviceId: string, rank?: string) =>
  calculateQuote(
    {
      gameId,
      serviceId,
      units: 1,
      ...offerSelection(gameId, serviceId),
      ...(rank ? { rank } : {}),
    } as Parameters<typeof calculateQuote>[0],
    EUR,
  );

/** One service's price for one selection, for a sentence that names it. */
export const spotPrice = (gameId: string, serviceId: string, rank?: string) =>
  formatPrice(quote(gameId, serviceId, rank).customer.amountMinor, 'EUR');

const modesOf = (gameId: string) =>
  ((servicesFor(gameId) as { modes?: Mode[] }).modes ?? []) as Mode[];

/**
 * The provider tier a service pairs a customer with, as the catalog writes it,
 * without the mode qualifier after the middle dot.
 *
 * The catalog's tier strings double as a mode label ("Master+ teammate · Arena",
 * "Immortal+ coach · 1 hour"). A sentence about who plays the session wants the
 * first half only, and taking it from the catalog keeps the page from naming a
 * rank the catalog never promised.
 */
export const providerTier = (gameId: string, serviceId: string) =>
  cleanCopy(
    modesOf(gameId).find((mode) => mode.id === serviceId)?.tier ?? '',
  ).split(' · ')[0]!;

/** A service's name as the catalog writes it, for prose that names one. */
export const serviceTitle = (gameId: string, serviceId: string) =>
  cleanCopy(modesOf(gameId).find((mode) => mode.id === serviceId)?.title ?? '');

export interface PriceRow {
  readonly serviceId: string;
  /** The service name as the catalog writes it, with copy rules applied. */
  readonly title: string;
  /** The provider tier the catalog names, for example "Master+ teammate". */
  readonly tier: string;
  /** Which of CATEGORY_HEADINGS the row belongs to. */
  readonly category: string;
  readonly unit: 'game' | 'hour';
  /** Hired teammates the listed price covers. */
  readonly seats: number;
  /** The cheapest price in the catalog for this service. */
  readonly from: string;
  /** The dearest, when rank moves the price. Equal to `from` when it does not. */
  readonly to: string;
  /** The rank label the cheapest price belongs to, when rank sets the price. */
  readonly fromRank?: string;
  readonly toRank?: string;
  /** Checkout, prefilled with this exact game and service. */
  readonly href: string;
}

export interface GamePrices {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  /** The game's own page, only when its copy is finished and indexable. */
  readonly hubPath?: string;
  readonly rows: readonly PriceRow[];
}

const rowFor = (gameId: string, mode: Mode): PriceRow => {
  const ranks = ranksOf(gameId, mode.id) as string[];
  const priced = (ranks.length ? ranks : [undefined]).map((rank) => ({
    rank,
    minor: quote(gameId, mode.id, rank).customer.amountMinor,
  }));
  // Rank order is the catalog's own, lowest rank first, and the price is not
  // guaranteed to rise monotonically with it, so read the extremes rather than
  // assuming the ends of the list are them.
  const cheapest = priced.reduce((low, row) =>
    row.minor < low.minor ? row : low,
  );
  const dearest = priced.reduce((high, row) =>
    row.minor > high.minor ? row : high,
  );
  const query = new URLSearchParams({ game: gameId, service: mode.id });
  return {
    serviceId: mode.id,
    title: cleanCopy(mode.title),
    tier: cleanCopy(mode.tier),
    category: mode.cat,
    unit: quote(gameId, mode.id, cheapest.rank).unit,
    seats: seatRule(gameId, mode.id).default,
    from: formatPrice(cheapest.minor, 'EUR'),
    to: formatPrice(dearest.minor, 'EUR'),
    ...(cheapest.rank ? { fromRank: cleanCopy(cheapest.rank) } : {}),
    ...(dearest.rank ? { toRank: cleanCopy(dearest.rank) } : {}),
    href: `/?${query}#modes-h`,
  };
};

/** Every game in the catalog with every service it sells, grouped by category. */
export const PRICE_TABLE: readonly GamePrices[] = SITE_GAMES.map((game) => {
  const modes = ((servicesFor(game.id) as { modes?: Mode[] }).modes ??
    []) as Mode[];
  const ordered = CATEGORY_HEADINGS.flatMap(([category]) =>
    modes.filter((mode) => mode.cat === category),
  );
  return {
    id: game.id,
    name: game.name,
    slug: game.slug,
    ...(FINISHED_HUB_SLUGS.includes(game.slug)
      ? { hubPath: `/games/${game.slug}` }
      : {}),
    rows: ordered.map((mode) => rowFor(game.id, mode)),
  };
});

/** Rows in the table, which is also the number of services Duoly sells. */
export const ROW_COUNT = PRICE_TABLE.reduce(
  (total, game) => total + game.rows.length,
  0,
);

const allRows = PRICE_TABLE.flatMap((game) =>
  game.rows.map((row) => ({ game, row })),
);
const minorOf = (value: string) => Math.round(Number(value.slice(1)) * 100);

/** The cheapest single session in the catalog, and the game it belongs to. */
export const CHEAPEST = allRows.reduce((low, entry) =>
  minorOf(entry.row.from) < minorOf(low.row.from) ? entry : low,
);
/** The dearest single session, which is a team fill covering several teammates. */
export const DEAREST = allRows.reduce((high, entry) =>
  minorOf(entry.row.to) > minorOf(high.row.to) ? entry : high,
);
/** Services whose price never changes with rank, as a share of the catalog. */
export const FLAT_ROWS = allRows.filter(
  (entry) => entry.row.from === entry.row.to,
).length;
