import { servicesFor } from '../../design-reference/lib/catalog.js';
import { defaultRank, ranksOf } from '../../design-reference/lib/ranks.js';
import { calculateQuote } from '../pricing';
import { QUANTITIES, quantityDiscountPercent } from '../../contracts/pricing';
import { cleanCopy, formatPrice, offerSelection, seoOffers } from './offers';
import { CATALOG_PRICES_UPDATED_LABEL } from '../../site/price-dates';
import type { QuoteContext } from '../../contracts/pricing';

/**
 * Bundle sizes a hub may quote. On the game's main service these are Bundles tab packs (10%, 20%
 * and 25% off); on any other service they are quantity picker counts (1 to 5, 20% off at 5), and
 * 10 isn't sold, so there is no `_x10` token for it (src/contracts/pricing.ts).
 */
const BUNDLES = [3, 5, 10] as const;

type HubMode = { id: string; cat: string; title: string; unit: string };

/** The catalog services a game hub shows, grouped the way the page renders them. */
export function hubModes(gameId: string) {
  const modes = servicesFor(gameId).modes as HubMode[];
  const group = (cats: string[]) =>
    modes.filter((mode) => cats.includes(mode.cat) && mode.id !== 'skirm');
  return {
    teammate: group(['duo', 'social']),
    team: group(['other']),
    coaching: group(['training']),
  };
}

/** Every service id a hub can price, in the order the page renders them. */
export const hubServiceIds = (gameId: string) => {
  const groups = hubModes(gameId);
  return [...groups.teammate, ...groups.team, ...groups.coaching].map(
    (mode) => mode.id,
  );
};

/**
 * Price tokens for hub copy, all from the checkout pricing engine, so page text
 * and checkout cannot drift apart. Always EUR: the indexed text stays stable
 * while the price cards on the same page localize for the visitor.
 *
 * Per service id: `{{p_duo2}}` is one unit at the example rank, `{{p_duo2_x3}}`
 * the three-unit total, `{{p_duo2_low}}` and `{{p_duo2_high}}` the cheapest and
 * dearest rank, `{{rank_duo2}}` the example rank and `{{seats_duo2}}` the hired
 * teammates the price covers. `{{pct3}}`, `{{pct5}}` and `{{pct10}}` are the
 * quantity discounts, and `{{checked}}` the day the catalog's prices last
 * changed (src/site/price-dates.ts), which is the only date hub copy may state
 * about a price.
 *
 * The discount story has three tokens of its own, because stating half of it
 * is how the copy and the price cards drifted apart: `{{main}}` is the one
 * service sold in bundles, `{{bundles}}` its whole ladder ("10% off 3 games,
 * 20% off 5 and 25% off 10") and `{{picker}}` what every other service offers
 * instead ("up to 5 games, where 5 take 20% off"). Hub copy states discounts
 * through these rather than assembling a ladder a percentage at a time
 * (tests/unit/hub-pages.test.ts holds every hub to the complete ladder).
 */
export function hubPrices(
  gameId: string,
  context: Omit<QuoteContext, 'customerCurrency'>,
): Record<string, string> {
  const eur = { ...context, customerCurrency: 'EUR' as const };
  const prices: Record<string, string> = {
    checked: CATALOG_PRICES_UPDATED_LABEL,
  };
  const main = (servicesFor(gameId) as { main: string }).main;
  const quote = (serviceId: string, units: number, rank?: string) =>
    calculateQuote(
      {
        gameId,
        serviceId,
        units,
        ...offerSelection(gameId, serviceId),
        ...(rank ? { rank } : {}),
        ...(units > 1 && serviceId === main ? { bundle: true, seats: 1 } : {}),
      },
      { ...eur, firstCoachingSessionEligible: false },
    );
  // The main service sells bundles of 3, 5 and 10; every other service 1 to 5 units.
  const sold = (serviceId: string, units: number) =>
    serviceId === main || (QUANTITIES as readonly number[]).includes(units);
  const money = (serviceId: string, units: number, rank?: string) =>
    formatPrice(quote(serviceId, units, rank).customer.amountMinor, 'EUR');
  for (const serviceId of hubServiceIds(gameId)) {
    const ranks = ranksOf(gameId, serviceId) as string[];
    const rank = ranks.length
      ? (defaultRank(gameId, serviceId) as string) || ranks[0]!
      : undefined;
    prices[`p_${serviceId}`] = money(serviceId, 1, rank);
    for (const units of BUNDLES)
      if (sold(serviceId, units))
        prices[`p_${serviceId}_x${units}`] = money(serviceId, units, rank);
    prices[`seats_${serviceId}`] = String(quote(serviceId, 1, rank).seats);
    if (rank) {
      prices[`rank_${serviceId}`] = cleanCopy(rank);
      const byRank = ranks
        .map((each) => quote(serviceId, 1, each))
        .sort((a, b) => a.customer.amountMinor - b.customer.amountMinor);
      prices[`p_${serviceId}_low`] = formatPrice(
        byRank[0]!.customer.amountMinor,
        'EUR',
      );
      prices[`rank_${serviceId}_low`] = cleanCopy(byRank[0]!.selection.rank!);
      prices[`p_${serviceId}_high`] = formatPrice(
        byRank[byRank.length - 1]!.customer.amountMinor,
        'EUR',
      );
      prices[`rank_${serviceId}_high`] = cleanCopy(
        byRank[byRank.length - 1]!.selection.rank!,
      );
    }
  }
  // `{{pct3}}`, `{{pct5}}` and `{{pct10}}` are the Bundles tab discounts (the main service's
  // packs); `{{pick5}}` is the quantity picker's 5-unit discount on any other service.
  for (const units of BUNDLES)
    prices[`pct${units}`] =
      `${quantityDiscountPercent(units, { bundle: true })}%`;
  prices.pick5 = `${quantityDiscountPercent(5)}%`;
  // The whole discount story in three tokens, so no page can state half of it.
  // `{{main}}` is the only service sold in bundles, `{{bundles}}` is its full
  // ladder and `{{picker}}` is what every other service can do instead.
  const mainMode = (servicesFor(gameId).modes as HubMode[]).find(
    (mode) => mode.id === main,
  )!;
  const unit = mainMode.unit === 'hour' ? 'hours' : 'games';
  prices.main = cleanCopy(mainMode.title);
  const steps = BUNDLES.map(
    (units, index) =>
      `${prices[`pct${units}`]} off ${units}${index === 0 ? ` ${unit}` : ''}`,
  );
  prices.bundles = `${steps.slice(0, -1).join(', ')} and ${steps.at(-1)}`;
  // `{{savings}}` is the same ladder from the same percentages, written per
  // bundle: "3 games save 10%, 5 save 20% and 10 save 25%". A hub has to state
  // the discount beside the price grid and again where a service is explained,
  // and the page quality audit found the identical sentence printed twice on
  // seven hubs. The second place states the saving instead, so the figures are
  // still there and the reader is not reading the same line again.
  const saves = BUNDLES.map(
    (units, index) =>
      `${units}${index === 0 ? ` ${unit}` : ''} save ${prices[`pct${units}`]}`,
  );
  prices.savings = `${saves.slice(0, -1).join(', ')} and ${saves.at(-1)}`;
  prices.picker = `up to 5 ${unit}, where 5 take ${prices.pick5} off`;
  return prices;
}

/**
 * Anchor text for the link from a game hub to that game's intent page.
 *
 * A hub is the broad page for its game, so the specific phrase belongs to the
 * intent page: the anchor repeats that page's own query instead of a generic
 * "duo and teammate guide", and the two pages stop competing for it.
 */
export function intentAnchor(gameName: string, slug: string) {
  switch (slug) {
    case 'lfg':
      return `${gameName} LFG`;
    case 'duos':
      return `${gameName} duos`;
    case 'duo-partner':
      return `${gameName} duo partner`;
    case 'teammate':
      return `${gameName} teammate`;
    case 'play-with-someone':
      return `Play ${gameName} with someone`;
    default:
      return `${gameName} ${slug.replaceAll('-', ' ')}`;
  }
}

/**
 * Headings for the hub's three price groups.
 *
 * Each one is a question, because a reader scanning a price grid is asking one.
 * The game name never follows an article: it is filled in from the catalog, so
 * "a Apex Legends teammate" is one game away and no list of exceptions would
 * stay correct. Phrase the question so the name sits elsewhere instead.
 */
export function hubPriceHeadings(gameName: string) {
  return {
    teammate: `How much does a teammate cost in ${gameName}?`,
    team: `What does a team fill cost in ${gameName}?`,
    coaching: `How much do ${gameName} lessons cost?`,
  };
}

/**
 * The three price groups a hub renders, in DOM order. The Service schema lists
 * them in the same order, so every visible price has one matching offer.
 */
export function hubOffers(gameId: string, context: QuoteContext) {
  const teammate = seoOffers(gameId, 'teammate', context);
  const team = seoOffers(gameId, 'other', context);
  const coaching = seoOffers(gameId, 'training', context);
  return { teammate, team, coaching, all: [...teammate, ...team, ...coaching] };
}
