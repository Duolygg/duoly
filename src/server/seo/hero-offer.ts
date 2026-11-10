import { servicesFor } from '../../design-reference/lib/catalog.js';
import { bookingHref } from '../../site/seo';
import type { seoOffers } from './offers';

type Offers = ReturnType<typeof seoOffers>;

/**
 * The one offer a page's hero card sells, with the honest price of it.
 *
 * The hero card used to be decoration: game art, a price chip and three
 * checkmarks, with no way to act on it. It now carries the page's main service
 * and a booking button straight into checkout with that service prefilled.
 *
 * The price shown is the main service's own cheapest rank, never the cheapest
 * thing on the page. A Valorant hero reading "From €2.49" was quoting a
 * Deathmatch warm-up while Duo Pro, the service the page is about, starts at
 * €6.49: a reader who clicked Book arrived at a price two and a half times the
 * headline. The warm-up price is still on the card, under a label that says
 * what it is ({@link HeroOffer.cheapest}).
 */
export interface HeroOffer {
  /** Catalog service id, so the booking link opens the same service. */
  id: string;
  title: string;
  /** The teammate or coach tier line, the real difference between tiers. */
  tier: string;
  /** "From €6.49" for a rank-priced service, "€2.49" for a flat one. */
  price: string;
  /** "game" or "hour". */
  unit: string;
  /** True when the service is rank-priced, so the price carries a "From". */
  varies: boolean;
  /** Checkout deep link with the game and this service prefilled. */
  href: string;
  /** Button text: the tier and the price a reader is about to pay. */
  label: string;
  /** The cheapest session on the page, when something else is cheaper. */
  cheapest?: { title: string; price: string; unit: string };
}

const cheapestOf = (rows: Offers) =>
  [...rows].sort((left, right) => left.amountMinor - right.amountMinor)[0]!;

/**
 * Build the hero offer for `serviceId`, priced from `offers` (already quoted
 * through the checkout engine in the visitor's currency).
 */
export function heroOffer(
  gameId: string,
  serviceId: string,
  offers: Offers,
): HeroOffer | undefined {
  const rows = offers.filter((offer) => offer.id === serviceId);
  if (!rows.length) return undefined;
  const low = cheapestOf(rows);
  const varies = rows.some((row) => row.amountMinor !== low.amountMinor);
  const price = `${varies ? 'From ' : ''}${low.display}`;
  const floor = cheapestOf(offers);
  return {
    id: serviceId,
    title: low.title,
    tier: low.tier,
    price,
    unit: low.unit,
    varies,
    href: bookingHref(gameId, { service: serviceId }),
    label: `Book ${low.title} ${varies ? 'from' : 'for'} ${low.display}`,
    cheapest:
      floor.amountMinor < low.amountMinor
        ? { title: floor.title, price: floor.display, unit: floor.unit }
        : undefined,
  };
}

/** The game's main service: the one its Bundles tab is built from. */
export const mainServiceId = (gameId: string) =>
  (servicesFor(gameId) as { main: string }).main;

/** The hero offer for a game hub, which sells the game's main service. */
export const hubHeroOffer = (gameId: string, offers: Offers) =>
  heroOffer(gameId, mainServiceId(gameId), offers);
