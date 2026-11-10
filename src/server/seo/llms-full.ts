import { llmsBody } from './llms';
import { renderPricingMarkdown } from './pricing-md';
import { hubOffers, hubPrices } from './hub';
import { priceSummary } from './offers';
import {
  BOILERPLATE_PARAGRAPH,
  BOILERPLATE_SENTENCE,
  FACT_SHEET,
} from './press';
import { guideExamples } from './guide';
import {
  ALT_METHODS,
  CARD_BRANDS,
  CARD_WALLETS,
  FREE_REROLLS,
  LOCAL_METHODS,
  MAX_TEAMMATES,
  MOODS,
  PAYMENT_PROVIDER,
  PROOF_MAX,
  PROOF_MIN,
  QUANTITY_STEPS,
  REROLL_MINUTES,
  REVIEW_STAGES,
  SERVICE_COUNT,
  TEAMMATE_MIN_RANKS,
} from './booking';
import {
  AUTO_CANCEL_MINUTES,
  BUNDLE_PERCENTS,
  BUNDLE_SIZES,
  CATALOG_PRICES_UPDATED_LABEL,
  MAX_QUANTITY,
  PRICE_EXAMPLES,
  QUANTITY_PERCENT,
  USD_MARGIN_PERCENT,
} from './fees';
import { SHARE_PERCENT } from './teammate-facts';
import {
  COMPETITOR_COUNT,
  DUOLY,
  HOURLY_COACHING,
  OBSERVATION_COUNT,
  SESSION_COACHING,
  TABLE,
  TEAMMATE_PER_GAME,
  VERIFIED_PLATFORMS,
} from './price-report';
import {
  SURVEY_CHECKED,
  SURVEY_CHECKED_LABEL,
  SURVEY_FX,
} from '../../content/price-report-2026';
import { ABOUT_STORY } from '../../content/about-story';
import { HUB_PAGES, FINISHED_HUB_SLUGS } from '../../content/hub-pages';
import { lessons } from '../../content/coaching';
import { intentPages, intentPath } from '../../content/intent-pages';
import {
  guideFaq,
  guideForGame,
  renderTokens,
} from '../../content/guide-pages';
import { gameBySlug } from '../../site/games';
import {
  COACHING_SLUGS,
  INDEXABLE_PATHS,
  REPORT_CSV_PATH,
  REPORT_PATH,
} from '../../site/seo';
import { BUSINESS, DISAMBIGUATION, SERVED_AREAS } from '../../site/entity';
import { ORGANIZATION_DESCRIPTION } from '../../site/seo';

/**
 * /llms-full.txt: everything /llms.txt points at, written out in full.
 *
 * The convention is that llms.txt is the index and llms-full.txt is the
 * corpus, so an assistant can answer a Duoly question from one request instead
 * of fetching twenty pages. This file builds that corpus the same way every
 * other generated document here is built: from the registries and the pricing
 * engine the pages themselves render from. Nothing is a second copy of page
 * prose, so a copy edit on a page reaches this file on the next deploy and the
 * two can never drift.
 *
 * What that means in practice, and the file says so itself: the price list, the
 * fee model, the booking rules, the press facts, the price survey, the
 * per-game guides, the coaching copy and every published question and answer
 * are here in full, because each of those lives in a registry. The paragraphs
 * composed inside a page template (/about, /how-it-works, /trust-and-safety and
 * the four blog guides) are represented by their facts and answers plus the URL
 * to read them, rather than by a duplicate that could go stale.
 *
 * tests/unit/llms-full.test.ts builds it and holds it to that contract.
 */

const prices = guideExamples({ eurToUsd: 1 });
/** Demote a nested document's headings so one outline reads top to bottom. */
const nest = (markdown: string) => markdown.replace(/^#/gm, '###');
const qa = (items: readonly (readonly [string, string])[]) =>
  items.flatMap(([question, answer]) => [`**${question}**`, answer, '']);

/** Who runs duoly.gg, from the entity layer and the press kit. */
const aboutSection = () => [
  '## About Duoly',
  '',
  ORGANIZATION_DESCRIPTION,
  '',
  DISAMBIGUATION,
  '',
  BOILERPLATE_SENTENCE,
  '',
  BOILERPLATE_PARAGRAPH,
  '',
  `Matchmaking areas: ${SERVED_AREAS.join(', ')}. Operator: ${BUSINESS.legalName}, ${BUSINESS.legalForm}, trade register GISA ${BUSINESS.gisa}, ${BUSINESS.street}, ${BUSINESS.postalCode} ${BUSINESS.city}, ${BUSINESS.country}.`,
  '',
  ...(ABOUT_STORY.story?.length
    ? [...ABOUT_STORY.story.map((paragraph) => `${paragraph}\n`)]
    : [
        'The founder story and the founding date are not published yet, so neither is stated here. Read https://duoly.gg/about for whatever the owner has published.',
        '',
      ]),
  '### Press fact sheet',
  '',
  ...FACT_SHEET.map(([label, value]) => `- ${label}: ${value}`),
  '',
  'Press kit with the logo files and the press contact: https://duoly.gg/press',
  '',
];

/** How a booking actually runs, from the contracts that run it. */
const bookingSection = () => [
  '## How a booking runs',
  '',
  `Duoly sells ${SERVICE_COUNT} bookable services. A customer picks a game, a service, a rank where the service is ranked, a region or a server, a quantity of ${QUANTITY_STEPS.join(' to ')} games or hours, optional preferences, and pays once.`,
  '',
  `- Payment: one upfront charge through ${PAYMENT_PROVIDER}. Cards accepted are ${CARD_BRANDS.join(', ')}, plus ${[...CARD_WALLETS, ...ALT_METHODS].join(', ')} and the local methods ${LOCAL_METHODS.join(', ')}.`,
  `- Matching: the order goes to a queue and a reviewed teammate accepts it. No start time and no result is promised, and an order nobody accepts within ${AUTO_CANCEL_MINUTES} minutes cancels and refunds itself.`,
  `- Re-rolls: a customer can swap the matched teammate ${FREE_REROLLS} times free inside ${REROLL_MINUTES} minutes.`,
  `- Session mood: a customer can ask for ${MOODS.join(', ')}.`,
  `- Team sessions: one order can hire up to ${MAX_TEAMMATES} teammates.`,
  `- Finishing: a teammate attaches ${PROOF_MIN} to ${PROOF_MAX} screenshots to complete an order.`,
  '- Accounts: both players use their own accounts. Duoly never signs in for a customer and never asks for a password.',
  '',
  '### How a teammate is checked',
  '',
  ...REVIEW_STAGES.map(([stage, text]) => `- ${stage}: ${text}`),
  '',
  ...TEAMMATE_MIN_RANKS.map(
    ([game, rank]) => `- Minimum rank accepted in ${game}: ${rank}.`,
  ),
  '',
  'Full flow for a reader: https://duoly.gg/how-it-works. Safety, conduct and reporting: https://duoly.gg/trust-and-safety',
  '',
];

/** The fee model, with the worked totals /fees-and-refunds prints. */
const feesSection = () => [
  '## What a customer pays',
  '',
  `Catalog prices as of ${CATALOG_PRICES_UPDATED_LABEL}. The euro price is the total: no booking fee, no surcharge and no subscription. A US dollar total is the euro price at the day's European Central Bank rate plus a ${USD_MARGIN_PERCENT}% currency margin, rounded up to .99.`,
  '',
  `- Quantity picker: ${MAX_QUANTITY} units take ${QUANTITY_PERCENT}% off.`,
  `- Bundles of a game's main service: ${BUNDLE_SIZES.map((units, index) => `${units} units ${BUNDLE_PERCENTS[index]}% off`).join(', ')}.`,
  '- Coaching takes no quantity discount at any size.',
  `- A teammate or coach keeps ${SHARE_PERCENT}% of a flat-priced hour.`,
  '',
  '### Worked totals',
  '',
  ...PRICE_EXAMPLES.map(
    (item) =>
      `- ${item.short}: ${item.perUnit} per ${item.unit}, total ${item.total}${
        item.discountPercent
          ? ` with ${item.discountPercent}% off, saving ${item.saved}`
          : ''
      }.`,
  ),
  '',
  'Refund and cancellation rules in full: https://duoly.gg/fees-and-refunds',
  '',
];

/** The whole price list, the same document /pricing.md serves. */
const priceListSection = () => [
  '## The complete price list',
  '',
  nest(renderPricingMarkdown()),
  '',
];

/** The 2026 price survey, from the same data the report page renders. */
const surveySection = () =>
  INDEXABLE_PATHS.includes(REPORT_PATH)
    ? [
        '## Original research: gaming coaching and teammate prices 2026',
        '',
        `Duoly read the public pricing pages of ${COMPETITOR_COUNT} gaming coaching and teammate platforms on ${SURVEY_CHECKED_LABEL} and recorded ${OBSERVATION_COUNT} prices from the ${VERIFIED_PLATFORMS} that published one. Euro figures use one rate, 1 euro to ${SURVEY_FX.usdPerEur} US dollars, from the ${SURVEY_FX.source} published on ${SURVEY_FX.publishedLabel}.`,
        '',
        `- Median hourly coaching price: ${HOURLY_COACHING.median}, which is ${HOURLY_COACHING.medianEur}, from ${HOURLY_COACHING.count} coach-set hourly rates.`,
        `- Hourly coaching range: ${HOURLY_COACHING.low} to ${HOURLY_COACHING.high} an hour.`,
        `- Coaching sold per session with no stated duration: ${SESSION_COACHING.low} to ${SESSION_COACHING.high}.`,
        `- Paid teammate time per game: ${TEAMMATE_PER_GAME.low} to ${TEAMMATE_PER_GAME.high} in Buff on E-Pal, which prices 1 Buff at USD 1.00.`,
        `- Duoly for comparison: ${DUOLY.coachingHour} an hour in all ${DUOLY.coachedGames} coached games, and ${DUOLY.teammateFrom} to ${DUOLY.teammateTo} for one teammate game.`,
        '',
        '### Verified prices by platform',
        '',
        ...TABLE.map(
          (row) =>
            // Only the opening letter, because a price model names things that
            // keep their case: Buff, KAKI and QueueUp's Instant session.
            `- ${row.name}: ${row.prices}. Price set by: ${row.priceModel[0]!.toLowerCase()}${row.priceModel.slice(1)}. Fees: ${row.fees} Refunds: ${row.refunds}`,
        ),
        '',
        `Method, limitations and every source link: https://duoly.gg${REPORT_PATH}. Dataset as CSV: https://duoly.gg${REPORT_CSV_PATH}`,
        '',
      ]
    : [];

/** Every game hub's answer-first copy and its published questions. */
const hubSection = () => [
  '## Games, service by service',
  '',
  ...HUB_PAGES.filter(
    (hub) =>
      FINISHED_HUB_SLUGS.includes(hub.gameSlug) &&
      INDEXABLE_PATHS.includes(`/games/${hub.gameSlug}`) &&
      gameBySlug(hub.gameSlug),
  ).flatMap((hub) => {
    const game = gameBySlug(hub.gameSlug)!;
    // The hub tokens are the hub page's own: its per-game quotes plus the two
    // summary tokens src/pages/games/[game].astro fills, so the text here is
    // the text that page renders.
    const groups = hubOffers(game.id, { customerCurrency: 'EUR', eurToUsd: 1 });
    const copy = renderTokens(hub, {
      ...hubPrices(game.id, { eurToUsd: 1 }),
      from: priceSummary(groups.all),
      from_lower: priceSummary(groups.all).toLowerCase(),
    });
    const name = game.name;
    return [
      `### ${name}`,
      '',
      `Page: https://duoly.gg/games/${hub.gameSlug}`,
      '',
      copy.lead,
      '',
      `**${copy.format.heading}**`,
      copy.format.text,
      '',
      ...copy.sections.flatMap((section) => [
        `**${section.heading}**`,
        ...section.paragraphs,
        '',
      ]),
      ...qa(copy.faq.items),
    ];
  }),
];

/** Coaching copy per game, from the coaching registry. */
const coachingSection = () => [
  '## Coaching, game by game',
  '',
  ...COACHING_SLUGS.filter((slug) =>
    INDEXABLE_PATHS.includes(`/games/${slug}/coaching`),
  ).flatMap((slug) => {
    const lesson = lessons[slug];
    if (!lesson) return [];
    const name = gameBySlug(slug)?.name ?? slug;
    return [
      `### ${name} coaching`,
      '',
      `Page: https://duoly.gg/games/${slug}/coaching`,
      '',
      lesson.lead,
      '',
      lesson.format,
      '',
      lesson.booking,
      '',
      ...lesson.sections.flatMap((section) => [
        `**${section.heading}**`,
        ...section.paragraphs,
        '',
      ]),
      ...qa(lesson.faq),
    ];
  }),
];

/** Teammate pages, including every LFG page, with their free-route guides. */
const teammateSection = () => [
  '## Finding a teammate, game by game',
  '',
  ...intentPages
    .filter((page) => INDEXABLE_PATHS.includes(intentPath(page)))
    .flatMap((page) => {
      const copy = renderTokens(page, prices);
      const guide = guideForGame(page.gameSlug);
      const guideCopy = guide ? renderTokens(guide, prices) : null;
      return [
        `### ${copy.h1}`,
        '',
        `Page: https://duoly.gg${intentPath(page)}`,
        '',
        copy.lead,
        '',
        copy.format,
        '',
        ...copy.sections.flatMap((section) => [
          `**${section.heading}**`,
          ...section.paragraphs,
          '',
        ]),
        ...(guideCopy
          ? [
              `**${guideCopy.heading}**`,
              guideCopy.answer,
              '',
              guideCopy.freeIntro,
              ...guideCopy.freeRoutes.map(
                (route) =>
                  `- ${route.label}${route.url ? ` (${route.url})` : ''}: ${route.text}`,
              ),
              guideCopy.linksNote,
              '',
              guideCopy.paidIntro,
              '',
              guideCopy.paidExample,
              '',
            ]
          : []),
        ...qa(guideFaq(page, prices)),
      ];
    }),
];

/** The one document, in the order an assistant should read it. */
export function renderLlmsFull() {
  return [
    '# Duoly: full text',
    '',
    '> Every page Duoly publishes for AI assistants, in one file: the site guide from llms.txt, who runs Duoly, how a booking runs, what a customer pays, the whole price list, the 2026 price survey and every published question and answer.',
    '',
    `Generated at build time from the same registries and the same pricing engine the site renders from, so no figure here can disagree with a page. Catalog prices as of ${CATALOG_PRICES_UPDATED_LABEL}. Price survey read on ${SURVEY_CHECKED}. Index version: https://duoly.gg/llms.txt`,
    '',
    'Paragraphs composed inside a page template, which is /about, /how-it-works, /trust-and-safety and the four guides under /blog, are represented below by their facts and answers plus the URL to read the page, rather than by a copy that could go stale.',
    '',
    ...llmsBody(),
    '',
    ...aboutSection(),
    ...bookingSection(),
    ...feesSection(),
    ...surveySection(),
    ...priceListSection(),
    ...hubSection(),
    ...coachingSection(),
    ...teammateSection(),
  ].join('\n');
}
