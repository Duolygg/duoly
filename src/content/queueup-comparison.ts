import { calculateQuote } from '../server/pricing';
import { formatPrice, offerSelection } from '../server/seo/offers';
import { COACHABLE_GAMES, SHARE_PERCENT } from '../server/seo/teammate-facts';
import type { CompareRow, CompareSource } from './compare-marks';

/**
 * Every QueueUp fact on /compare/queueup, with the QueueUp page it was read
 * from. Read on 2026-11-09 from queueup.gg only.
 *
 * QueueUp documents its booking and refund mechanics in more detail than any
 * other platform in the November 2026 competitor research, so most rows cite
 * the one docs page: its terms of service and privacy policy are sections of
 * that page rather than separate routes. The November 2026 report left the age
 * rule and the free intro open; both were found in the docs on 9 November and
 * are stated here instead of "unknown".
 */
export const QUEUEUP_CHECKED = '2026-11-09';

/**
 * The Duoly lesson the page prices, quoted through the checkout engine. The
 * server token comes from offerSelection, so a region rename in the catalog
 * cannot leave a stale token here.
 */
export const queueupSelection = {
  gameId: 'val',
  serviceId: 'vod',
  units: 1,
  ...offerSelection('val', 'vod'),
};
const quote = calculateQuote(queueupSelection as never, {
  eurToUsd: 1,
  customerCurrency: 'EUR',
});
export const queueupExample = {
  amountMinor: quote.customer.amountMinor,
  price: formatPrice(quote.customer.amountMinor, 'EUR'),
  title: 'Valorant VOD Review',
  unit: 'hour',
  href: '/?game=val&service=vod#modes-h',
};

/** The published teammate share, so the commission row quotes a real figure. */
export const duolyShare = `${SHARE_PERCENT}%`;

const docs = 'https://queueup.gg/docs';
const valorant = 'https://queueup.gg/valorant';
const home = 'https://queueup.gg/';
const coaches = 'https://queueup.gg/coaches';
const teams = 'https://queueup.gg/team-coaching';

export const queueupRows: CompareRow[] = [
  {
    label: 'Who sets the lesson price',
    duoly: 'neutral',
    rival: 'neutral',
    duolyNote:
      'Duoly publishes one lesson price per service, the same in every game that sells coaching.',
    rivalNote:
      'An Instant session is fixed at 24 QC, which QueueUp states is USD 24, for 45 minutes. Direct, Booking and Bundles are priced by each coach.',
    rivalSource: docs,
  },
  {
    label: 'Prices published in euro',
    duoly: 'yes',
    rival: 'part',
    duolyNote: 'Prices are shown in EUR or USD and charged through Stripe.',
    rivalNote:
      'Prices are shown in QueueCoins, and QueueUp states that 1 QC is USD 1.',
    rivalSource: docs,
  },
  {
    label: 'Pay without buying coins first',
    duoly: 'yes',
    rival: 'yes',
    duolyNote: 'One card payment per order through Stripe.',
    rivalNote:
      'QueueUp says coins are not needed in advance, and the checkout settles the difference by card or PayPal in one step.',
    rivalSource: docs,
  },
  {
    label: 'Guarantee on a first paid lesson',
    duoly: 'no',
    rival: 'yes',
    duolyNote:
      'Duoly publishes no learning guarantee, because a lesson is time with a coach rather than a promised outcome.',
    rivalNote:
      'Learn Or It’s Free: a full refund of up to USD 35 on a first paid session, asked for before the next one.',
    rivalSource: docs,
  },
  {
    label: 'Refund when nobody accepts',
    duoly: 'yes',
    rival: 'yes',
    duolyNote:
      'An order nobody accepts within 5 minutes cancels itself, and cancelling before anyone accepts is free.',
    rivalNote:
      'A full refund when a coach declines, fails to accept in time, or no coach takes an Instant request.',
    rivalSource: docs,
  },
  {
    label: 'Refund control during the session',
    duoly: 'part',
    rival: 'yes',
    duolyNote:
      'Report the order and a person reviews it. There is no in-session refund button.',
    rivalNote:
      'Press Request Refund in the session chat within the first 5 minutes.',
    rivalSource: docs,
  },
  {
    label: 'Choose a named coach before paying',
    duoly: 'no',
    rival: 'yes',
    duolyNote:
      'The first coach eligible for the service takes the order from the queue.',
    rivalNote:
      'Direct starts with a coach who is online, and Booking reserves a slot with a chosen coach.',
    rivalSource: coaches,
  },
  {
    label: 'Free first session',
    duoly: 'no',
    rival: 'part',
    duolyNote: 'Every Duoly lesson is a paid booking.',
    rivalNote:
      'QueueUp says some coaches offer a free first session, so it depends on the coach.',
    rivalSource: docs,
  },
  {
    label: 'Free help picking a provider',
    duoly: 'no',
    rival: 'yes',
    duolyNote:
      'The service card names the tier it hires, and support answers questions, with no matching questionnaire.',
    rivalNote:
      'Smart Match is free, needs no account, and returns up to three coaches with the reason each one fits.',
    rivalSource: docs,
  },
  {
    label: 'Published coach checks',
    duoly: 'yes',
    rival: 'yes',
    duolyNote:
      'Duoly reviews a coach before the first order, and every service names the tier it hires.',
    rivalNote:
      'The Valorant page labels its coaches Verified, Radiant Or Pro, Fluent In English, Profile Fact-Checked and Active Every Week.',
    rivalSource: valorant,
  },
  {
    label: 'Games that sell coaching',
    duoly: 'yes',
    rival: 'part',
    duolyNote: `${COACHABLE_GAMES} games, each at the same lesson price.`,
    rivalNote:
      'Counter-Strike 2, Deadlock, League of Legends, Marvel Rivals, Overwatch and Valorant, each with its own coach roster.',
    rivalSource: docs,
  },
  {
    label: 'Teammate sessions as well as lessons',
    duoly: 'yes',
    rival: 'no',
    duolyNote:
      'Teammate sessions and coaching sit in the same checkout, per game.',
    rivalNote:
      'QueueUp sells coaching: one to one sessions, replay review, team coaching and bundles.',
    rivalSource: teams,
  },
  {
    label: 'Where a session happens',
    duoly: 'neutral',
    rival: 'neutral',
    duolyNote:
      'Using Discord voice, on the game accounts both people already own.',
    rivalNote: 'In voice on the QueueUp Discord server.',
    rivalSource: docs,
  },
  {
    label: 'Published provider share',
    duoly: 'yes',
    rival: 'unknown',
    duolyNote: `Duoly publishes the share a teammate keeps, which is ${duolyShare} of a flat-priced hour.`,
    rivalNote:
      'The docs say the majority of the price goes to the coach without naming a percentage.',
    rivalSource: docs,
  },
  {
    label: 'Minimum age',
    duoly: 'neutral',
    rival: 'neutral',
    duolyNote: 'The Duoly terms require every account holder to be 18 or over.',
    rivalNote:
      'The terms in the documentation set 13, or the game’s own minimum where that is higher, with a parent or guardian agreeing for anyone under 18.',
    rivalSource: docs,
  },
  {
    label: 'Public review volume behind the brand',
    duoly: 'no',
    rival: 'yes',
    duolyNote:
      'Duoly is new and has no public review volume yet, so there is nothing to quote here.',
    rivalNote:
      'The Valorant page displays 4.9 out of 5 from 621 or more reviews and about 4,423 sessions coached, as figures for the whole site, plus dated reviews naming the coach.',
    rivalSource: valorant,
  },
  {
    label: 'Bookable by an AI assistant',
    duoly: 'yes',
    rival: 'unknown',
    duolyNote:
      'A public MCP server lets an assistant read prices and build a booking link. Payment still happens on duoly.gg.',
    rivalNote: 'No assistant connector is stated on the inspected pages.',
    rivalSource: home,
  },
];

export const queueupSources: CompareSource[] = [
  {
    title:
      'QueueUp documentation: prices, booking modes, refunds and the guarantee',
    url: docs,
    accessed: QUEUEUP_CHECKED,
  },
  {
    title: 'QueueUp Valorant coaching: coach checks and site-wide totals',
    url: valorant,
    accessed: QUEUEUP_CHECKED,
  },
  {
    title: 'QueueUp coach directory',
    url: coaches,
    accessed: QUEUEUP_CHECKED,
  },
  {
    title: 'QueueUp team coaching',
    url: teams,
    accessed: QUEUEUP_CHECKED,
  },
  {
    title: 'QueueUp homepage',
    url: home,
    accessed: QUEUEUP_CHECKED,
  },
];
