import { calculateQuote } from '../server/pricing';
import { formatPrice, offerSelection } from '../server/seo/offers';
import type { CompareRow, CompareSource } from './compare-marks';

/**
 * Every Metafy fact on /compare/metafy, with the Metafy page it was read from.
 *
 * Read on 2026-11-09 from metafy.gg and help.metafy.gg only. Two figures the
 * November 2026 competitor research had left open were found on the help
 * centre and are used here instead of "unknown": the buyer fee breakdown and
 * the refund policy. Nothing on this page comes from a third-party article, a
 * directory or a competitor's own comparison.
 */
export const METAFY_CHECKED = '2026-11-09';

/**
 * The Duoly lesson the page prices, quoted through the checkout engine. The
 * server token comes from offerSelection, because each game names its regions
 * differently (Overwatch 2 says Europe where Valorant says EU).
 */
export const metafySelection = {
  gameId: 'ow',
  serviceId: 'role',
  units: 1,
  ...offerSelection('ow', 'role'),
};
const quote = calculateQuote(metafySelection as never, {
  eurToUsd: 1,
  customerCurrency: 'EUR',
});
export const metafyExample = {
  amountMinor: quote.customer.amountMinor,
  price: formatPrice(quote.customer.amountMinor, 'EUR'),
  title: 'Overwatch 2 Role Coaching',
  unit: 'hour',
  href: '/?game=ow&service=role#modes-h',
};

const home = 'https://metafy.gg/';
const sessions = 'https://metafy.gg/overwatch/sessions';
const creators = 'https://metafy.gg/pro';
const fees = 'https://help.metafy.gg/en/articles/14676126-buyer-fees-breakdown';
const refunds =
  'https://help.metafy.gg/en/articles/12800628-metafy-refund-policy-updated';
const booking =
  'https://help.metafy.gg/en/articles/11535324-how-to-book-a-session';
const reviews =
  'https://help.metafy.gg/en/articles/11566912-leaving-a-review-for-your-coach-or-creator';
const parents =
  'https://help.metafy.gg/en/articles/11424985-a-parent-s-guide-to-metafy';

export const metafyRows: CompareRow[] = [
  {
    label: 'Who sets the lesson price',
    duoly: 'neutral',
    rival: 'neutral',
    duolyNote:
      'Duoly publishes one lesson price per service, the same in every game that sells coaching.',
    rivalNote:
      'Each Metafy partner sets the price of their own sessions, shown on their profile.',
    rivalSource: sessions,
  },
  {
    label: 'Same lesson price in every game',
    duoly: 'yes',
    rival: 'no',
    duolyNote: 'One flat price per lesson, whichever game you book.',
    rivalNote:
      'Listed Overwatch 2 sessions ran from USD 9.99 for an offline replay review to USD 100 for team coaching, with one-hour lessons at USD 25 to USD 50.',
    rivalSource: sessions,
  },
  {
    label: 'Buyer fees added at checkout',
    duoly: 'no',
    rival: 'yes',
    duolyNote: 'The published price is the amount Duoly charges your card.',
    rivalNote:
      'A 3.7% platform fee plus USD 1.79, capped at the lower of USD 20 or 30% of the total, and 2.9% plus USD 0.40 processing. Some partners cover one or both.',
    rivalSource: fees,
  },
  {
    label: 'Choose a named coach before paying',
    duoly: 'no',
    rival: 'yes',
    duolyNote:
      'The first coach eligible for the service takes the order from the queue.',
    rivalNote:
      'Open a partner profile, pick a session format and schedule it in your own timezone.',
    rivalSource: booking,
  },
  {
    label: 'Public coach reviews before booking',
    duoly: 'no',
    rival: 'yes',
    duolyNote: 'No public coach review directory in the booking flow.',
    rivalNote:
      'Profiles display a partner score, and buyers can leave or resubmit a review after a session.',
    rivalSource: reviews,
  },
  {
    label: 'Free consultation before a paid lesson',
    duoly: 'no',
    rival: 'yes',
    duolyNote: 'Every Duoly lesson is a paid booking.',
    rivalNote:
      'Several partners list a free consultation, for example 30 minutes on the Overwatch 2 page.',
    rivalSource: sessions,
  },
  {
    label: 'Published refund rules for buyers',
    duoly: 'yes',
    rival: 'yes',
    duolyNote:
      'The Duoly terms carry the cancellation and refund rules, and a report is reviewed by a person.',
    rivalNote:
      'Unscheduled sessions are refundable within 21 days to the payment method or 45 days as credits. A completed session is refundable only for a verified technical problem or partner misconduct.',
    rivalSource: refunds,
  },
  {
    label: 'Teammate sessions as well as lessons',
    duoly: 'yes',
    rival: 'unknown',
    duolyNote:
      'Teammate sessions and coaching sit in the same checkout, per game.',
    rivalNote:
      'The homepage sells guides, coaching, events and Discord communities. A play-together session that is not a lesson is not stated.',
    rivalSource: home,
  },
  {
    label: 'Games that sell coaching',
    duoly: 'neutral',
    rival: 'neutral',
    duolyNote: 'Every Duoly game sells the same lesson at the same price.',
    rivalNote:
      'Homepage creators teach Pokémon TCG, Riftbound, Rocket League, Valorant, World of Warcraft and League of Legends, and the sessions page adds Overwatch 2.',
    rivalSource: home,
  },
  {
    label: 'Minimum age',
    duoly: 'neutral',
    rival: 'neutral',
    duolyNote: 'The Duoly terms require every account holder to be 18 or over.',
    rivalNote:
      'The Metafy guide for parents says teens of 13 and over can use Metafy on their own, with a parent managing a younger account.',
    rivalSource: parents,
  },
  {
    label: 'Public review volume behind the brand',
    duoly: 'no',
    rival: 'yes',
    duolyNote:
      'Duoly is new and has no public review volume yet, so there is nothing to quote here.',
    rivalNote:
      'Partner profiles carry scores, and Metafy states that its creators have collectively earned over USD 10,000,000.',
    rivalSource: creators,
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

export const metafySources: CompareSource[] = [
  {
    title: 'Metafy homepage: games and what the platform sells',
    url: home,
    accessed: METAFY_CHECKED,
  },
  {
    title: 'Metafy Overwatch 2 sessions: partner prices and free consultations',
    url: sessions,
    accessed: METAFY_CHECKED,
  },
  {
    title: 'Metafy for creators: plan prices and revenue share',
    url: creators,
    accessed: METAFY_CHECKED,
  },
  {
    title: 'Metafy help centre: buyer fees breakdown',
    url: fees,
    accessed: METAFY_CHECKED,
  },
  {
    title: 'Metafy help centre: refund policy',
    url: refunds,
    accessed: METAFY_CHECKED,
  },
  {
    title: 'Metafy help centre: how to book a session',
    url: booking,
    accessed: METAFY_CHECKED,
  },
  {
    title: 'Metafy help centre: leaving a review for your coach or creator',
    url: reviews,
    accessed: METAFY_CHECKED,
  },
  {
    title: 'Metafy help centre: a guide for parents',
    url: parents,
    accessed: METAFY_CHECKED,
  },
];
