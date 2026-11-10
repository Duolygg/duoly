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
  /** The same sentence in full, as the button's accessible name. */
  labelFull: string;
  /** The cheapest session on the page, when something else is cheaper. */
  cheapest?: { title: string; price: string; unit: string };
  /**
   * The card's checklist, about the tier the card sells.
   *
   * It used to list the catalog: every teammate rank the game offers and every
   * mode on the page, beside a card selling one tier. A reader comparing the
   * button to the list was reading about two different products. The three
   * lines are now what this service covers, what moves its price and what a
   * session needs from the reader.
   */
  facts: string[];
}

const cheapestOf = (rows: Offers) =>
  [...rows].sort((left, right) => left.amountMinor - right.amountMinor)[0]!;

/** A checklist line fits one or two lines in a 352px card. */
const COVER_LIMIT = 58;

/**
 * The first clause of a service line: what the session is, without the sentence
 * that sells it. "Competitive with an Immortal+ teammate who calls the round,
 * the rotate and the retake." is a card paragraph; "Competitive with an
 * Immortal+ teammate" is a checklist line.
 *
 * A clause still over the limit is cut at the last phrase boundary that fits,
 * never the first: cutting "Quick Play and Arcade with a strong teammate for
 * relaxed games" at its first boundary leaves "Quick Play".
 */
const coverLine = (text: string) => {
  const clause = text
    .split(/[;:.]| who | whose | while | explaining /)[0]!
    .trim()
    .replace(/,$/, '');
  if (clause.length <= COVER_LIMIT) return clause;
  const cuts = [...clause.matchAll(/[,;]| and | with | for | plus /g)]
    .map((match) => match.index!)
    .filter((index) => index <= COVER_LIMIT);
  return cuts.length ? clause.slice(0, cuts.at(-1)!) : clause;
};

/**
 * A booking button's text, inside the width it has.
 *
 * "Book Deathmatch Warm-Up for EUR 2.49" is 33 characters, and a price card on
 * a 360px phone fits about 28. A wrapped button reads as two half-labels, so a
 * label too long for its card drops what the card already says: the service
 * name sits in the heading right above the button and the price in 28px type
 * beside it. The full sentence stays as the button's accessible name.
 */
export function bookLabel(
  title: string,
  varies: boolean,
  price: string,
  budget: number,
) {
  const verb = varies ? 'from' : 'for';
  const full = `Book ${title} ${verb} ${price}`;
  if (full.length <= budget) return { text: full, full };
  const named = `Book ${title}`;
  return {
    text: named.length <= budget ? named : `Book ${verb} ${price}`,
    full,
  };
}

/**
 * What one line holds in each place a booking button appears, in characters,
 * measured on the built pages in Geist at the button's own size.
 *
 *  - `hero`: the offer card's full-width button at 360px, 232px of text.
 *  - `card`: a price card in a one-column phone grid, 250px of text, and in a
 *    three-column desktop grid, 282px at the smaller desktop size.
 *  - `cardNarrow`: a four-column desktop grid, where the card is 256px wide
 *    and the button has 192px of text.
 */
export const LABEL_BUDGET = { hero: 26, card: 28, cardNarrow: 24 } as const;

/**
 * Build the hero offer for `serviceId`, priced from `offers` (already quoted
 * through the checkout engine in the visitor's currency).
 *
 * `line` is the page's own one-line description of the service, the same line
 * its price card carries. Without one the catalog description stands in.
 */
export function heroOffer(
  gameId: string,
  serviceId: string,
  offers: Offers,
  options: { line?: string; coach?: boolean } = {},
): HeroOffer | undefined {
  const rows = offers.filter((offer) => offer.id === serviceId);
  if (!rows.length) return undefined;
  const low = cheapestOf(rows);
  const high = [...rows].sort((a, b) => b.amountMinor - a.amountMinor)[0]!;
  const varies = rows.some((row) => row.amountMinor !== low.amountMinor);
  const price = `${varies ? 'From ' : ''}${low.display}`;
  const floor = cheapestOf(offers);
  const who =
    low.seats > 1
      ? `${low.seats} teammates join you`
      : 'One teammate joins you';
  return {
    id: serviceId,
    title: low.title,
    tier: low.tier,
    price,
    unit: low.unit,
    varies,
    href: bookingHref(gameId, { service: serviceId }),
    label: bookLabel(low.title, varies, low.display, LABEL_BUDGET.hero).text,
    labelFull: bookLabel(low.title, varies, low.display, LABEL_BUDGET.hero)
      .full,
    cheapest:
      floor.amountMinor < low.amountMinor
        ? { title: floor.title, price: floor.display, unit: floor.unit }
        : undefined,
    facts: [
      coverLine(options.line || low.desc),
      // The range, in money rather than rank names: a rank name can itself
      // read as a range ("Premier 0 to 4,999"), and the top of the price range
      // is the one number a "From" headline leaves out.
      varies
        ? `Your own rank sets the price, ${low.display} to ${high.display} per ${low.unit}`
        : `One price at every rank`,
      options.coach
        ? 'Your own account, voice and screen share on Discord'
        : `${who}, on your own account using Discord`,
    ],
  };
}

/** The game's main service: the one its Bundles tab is built from. */
export const mainServiceId = (gameId: string) =>
  (servicesFor(gameId) as { main: string }).main;

/** The hero offer for a game hub, which sells the game's main service. */
export const hubHeroOffer = (gameId: string, offers: Offers, line?: string) =>
  heroOffer(gameId, mainServiceId(gameId), offers, { line });
