import { servicesFor } from '../../design-reference/lib/catalog.js';
import { ranksOf } from '../../design-reference/lib/ranks.js';
import { calculateQuote } from '../pricing';
import { seatRule } from '../../contracts/seats';
import { SITE_GAMES } from '../../site/games';
import { FINISHED_HUB_SLUGS } from '../../content/hub-pages';
import { DISAMBIGUATION } from '../../site/entity';
import { QUANTITIES } from '../../contracts/pricing';
import { cleanCopy, formatPrice, offerSelection } from './offers';
import {
  AUTO_CANCEL_MINUTES,
  BUNDLE_PERCENTS,
  BUNDLE_SIZES,
  CATALOG_PRICES_UPDATED,
  MAX_QUANTITY,
  PRICE_EXAMPLES,
  QUANTITY_PERCENT,
  USD_MARGIN_PERCENT,
} from './fees';

/**
 * /pricing.md: the whole Duoly price list as plain markdown at the site root,
 * generated from the pricing engine on every build.
 *
 * Owned "official" pages (pricing, product, docs) are the citation class that
 * rose after ChatGPT 5.6, and the thing that makes one citable is that the
 * numbers are right. So nothing here is hand-copied: every figure comes out of
 * `calculateQuote`, the same function checkout charges on, and
 * tests/unit/pricing-md.test.ts re-derives each printed price from the engine
 * and fails when the document and the engine disagree. A catalog price change
 * updates this file by rebuilding, never by editing it.
 *
 * It is plain text on purpose. An assistant reading a 60 KB markdown table
 * does not need our CSS, and /fees-and-refunds is the page for a human.
 */

const EUR = { customerCurrency: 'EUR', eurToUsd: 1 } as const;

type Mode = {
  readonly id: string;
  readonly cat: string;
  readonly title: string;
  readonly tier: string;
};

/** The catalog's service categories, in the order a reader thinks about them. */
const CATEGORY_HEADINGS: readonly [string, string][] = [
  ['duo', 'Teammate sessions'],
  ['other', 'Team fills'],
  ['training', 'Coaching'],
  ['gg', 'Gamer Girl sessions'],
  ['social', 'Voice sessions'],
];

const priceOf = (gameId: string, mode: Mode, rank?: string) =>
  calculateQuote(
    {
      gameId,
      serviceId: mode.id,
      units: 1,
      ...offerSelection(gameId, mode.id),
      ...(rank ? { rank } : {}),
    } as Parameters<typeof calculateQuote>[0],
    EUR,
  );

/**
 * One service as one line: the price for every rank it has, with the ranks
 * that share a price grouped behind it.
 *
 * A rank-priced service has up to ten prices, and 779 rows of one rank each
 * would make this file four times longer for the same facts. The grammar is
 * fixed so a parser never has to guess: groups are split by "; ", a group is
 * one price then its ranks split by " / ". Rank labels themselves can carry
 * commas and the word "to" (Counter-Strike's "Premier 0 to 4,999"), which is
 * exactly why neither is used as a separator.
 */
export function servicePriceLine(gameId: string, mode: Mode): string {
  const ranks = ranksOf(gameId, mode.id) as string[];
  if (!ranks.length) {
    const quote = priceOf(gameId, mode);
    return `${formatPrice(quote.customer.amountMinor, 'EUR')} per ${quote.unit}`;
  }
  const groups: { price: string; unit: string; ranks: string[] }[] = [];
  for (const rank of ranks) {
    const quote = priceOf(gameId, mode, rank);
    const price = formatPrice(quote.customer.amountMinor, 'EUR');
    const last = groups[groups.length - 1];
    if (last && last.price === price && last.unit === quote.unit)
      last.ranks.push(cleanCopy(rank));
    else groups.push({ price, unit: quote.unit, ranks: [cleanCopy(rank)] });
  }
  return groups
    .map(
      (group) =>
        `${group.price} per ${group.unit} at ${group.ranks.join(' / ')}`,
    )
    .join('; ');
}

/** The games a reader can open a page for, so the link is never a guess. */
const hubLink = (slug: string) =>
  FINISHED_HUB_SLUGS.includes(slug)
    ? `Game page: https://duoly.gg/games/${slug}`
    : '';

function gameSection(game: (typeof SITE_GAMES)[number]): string[] {
  const modes = ((servicesFor(game.id) as { modes?: Mode[] }).modes ??
    []) as Mode[];
  const lines = [`### ${game.name}`, ''];
  const link = hubLink(game.slug);
  if (link) lines.push(link, '');
  for (const [category, heading] of CATEGORY_HEADINGS) {
    const inCategory = modes.filter((mode) => mode.cat === category);
    if (!inCategory.length) continue;
    lines.push(`${heading}:`, '');
    for (const mode of inCategory) {
      const seats = seatRule(game.id, mode.id).default;
      const covers = seats > 1 ? ` for ${seats} hired teammates` : '';
      lines.push(
        `- ${cleanCopy(mode.title)} (${cleanCopy(mode.tier)})${covers}: ${servicePriceLine(game.id, mode)}`,
      );
    }
    lines.push('');
  }
  return lines;
}

export function renderPricingMarkdown(): string {
  const bundles = BUNDLE_SIZES.map(
    (units, index) => `${units} units ${BUNDLE_PERCENTS[index]}% off`,
  ).join(', ');
  return [
    '# Duoly pricing',
    '',
    '> Every price in this file is generated from the Duoly pricing engine, the same code that charges the card at checkout. Nothing here is typed by hand.',
    '',
    DISAMBIGUATION,
    '',
    `Catalog prices as of ${CATALOG_PRICES_UPDATED}. Currency: EUR. Human version with the refund rules in full: https://duoly.gg/fees-and-refunds`,
    '',
    '## What the customer pays',
    '',
    '- One payment, taken when the order is queued. There is no charge after each game, no subscription and no wallet top-up.',
    '- No booking fee and no payment surcharge. The total shown before checkout is the amount charged.',
    `- Quantity picker: ${QUANTITIES.join(', ')} games or hours. ${MAX_QUANTITY} units take ${QUANTITY_PERCENT}% off.`,
    `- Bundles of a game's main service: ${bundles}. A bundle always covers one teammate.`,
    '- Coaching takes no quantity discount at any size.',
    `- A US dollar total is the euro price at the day's European Central Bank rate plus a ${USD_MARGIN_PERCENT}% currency margin, rounded up to .99.`,
    '- Rank changes the price of ranked play only. Lower ranks pay less and higher ranks pay more.',
    '',
    '## Worked totals',
    '',
    '| Selection | Per unit | Discount | Total |',
    '| --- | --- | --- | --- |',
    ...PRICE_EXAMPLES.map(
      (item) =>
        `| ${item.short} | ${item.perUnit} per ${item.unit} | ${
          item.discountPercent
            ? `${item.discountPercent}% off, saving ${item.saved}`
            : 'none'
        } | ${item.total} |`,
    ),
    '',
    '## Prices by game',
    '',
    'Each line is one bookable service: its title, the rank tier that plays it, then the price. Where rank sets the price, the line reads `PRICE per UNIT at RANK / RANK; PRICE per UNIT at RANK`: groups are separated by a semicolon and the ranks sharing one price by a slash. Rank labels can contain commas and the word "to", so neither separates anything here.',
    '',
    ...SITE_GAMES.flatMap(gameSection),
    '## Refunds and cancellations',
    '',
    '- Before a teammate accepts: cancel free of charge in the order room and the full amount goes back to the Duoly balance.',
    `- Nobody accepts within ${AUTO_CANCEL_MINUTES} minutes: the order cancels itself and refunds itself in full.`,
    '- No-show, a teammate leaving or toxic behaviour: report it from the order room and a person reviews it, with a refund to the balance possible.',
    '- Money refunded to a Duoly balance can be paid back to the original payment method on request. Promotional cashback and gifts cannot.',
    '- For EU and EEA consumers the 14-day right of withdrawal ends once the session has been fully played, because queueing asks Duoly to start right away.',
    '',
    'Full rules, quoted from the terms: https://duoly.gg/fees-and-refunds',
    'Terms of service: https://duoly.gg/terms',
    'Who operates duoly.gg: https://duoly.gg/about',
    '',
  ].join('\n');
}
