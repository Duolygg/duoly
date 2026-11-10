/**
 * The 2026 gaming coaching and teammate price survey: the raw observations.
 *
 * Every row below was read from the named platform's own public page on the
 * date it carries, by opening that URL and recording the price string shown
 * there. Nothing is copied from a roundup, a competitor's comparison or an
 * earlier version of this file, and nothing is estimated: a platform that
 * published no price, or that answered a request with a bot wall, has no price
 * rows at all and says so in `blocked` or `priceModel`.
 *
 * Three rules make the survey checkable rather than merely plausible:
 *
 *  1. One currency unit per row, as the page states it. A wallet unit stays a
 *     wallet unit (Buff, QC) and is converted only where the platform itself
 *     publishes the conversion, which is then a source of its own in
 *     `PLATFORMS` below.
 *  2. One billing unit per row, also as the page states it. A session with no
 *     stated duration is `session`, never an hour, so it can never reach the
 *     per-hour median.
 *  3. No Duoly prices here at all. Duoly's own figures come from the pricing
 *     engine at build time (src/server/seo/price-report.ts), so this file can
 *     never disagree with checkout.
 *
 * tests/unit/price-report.test.ts holds the file to those rules.
 */

/** The day every row below was read from its source page. */
export const SURVEY_CHECKED = '2026-11-10';
export const SURVEY_CHECKED_LABEL = '10 November 2026';

/**
 * The one exchange rate the report uses, with the day the European Central
 * Bank published it.
 *
 * The daily euro reference rates are the public, citable rate for a dated
 * price comparison. The set below was the most recent one published when the
 * survey ran, and it is recorded rather than fetched so a reader opening this
 * page next month sees the same euro figures the report was written with.
 */
export const SURVEY_FX = {
  /** US dollars per one euro, from the ECB daily reference rates. */
  usdPerEur: 1.1193,
  published: '2026-11-09',
  publishedLabel: '9 November 2026',
  source: 'European Central Bank euro reference rates',
  url: 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml',
} as const;

/** What a price buys: time with a coach, or time with a teammate. */
export type SurveyService = 'coaching' | 'teammate' | 'lfg';

/**
 * The billing unit exactly as the source page states it. Only `hour` reaches
 * the per-hour median; every other unit is reported in its own row.
 */
export type SurveyUnit =
  | 'hour'
  | '2 hours'
  | '45 minutes'
  | '30 minutes'
  | 'session'
  | 'game'
  | 'free';

export interface PriceObservation {
  readonly platform: string;
  /** The game the page sells, or 'Any game' for a cross-game page. */
  readonly game: string;
  /** The service name as the page labels it. */
  readonly service: string;
  readonly type: SurveyService;
  readonly unit: SurveyUnit;
  /** USD, or the platform's own wallet unit. */
  readonly currency: 'USD' | 'Buff';
  /** The figure shown on the page, in major units. */
  readonly amount: number;
  readonly source: string;
  readonly checked: string;
  readonly note?: string;
}

const rows = (
  base: Omit<PriceObservation, 'amount'>,
  amounts: readonly number[],
): PriceObservation[] => amounts.map((amount) => ({ ...base, amount }));

const WECOACH_VALORANT = 'https://wecoach.gg/valorant-coaching';
const WECOACH_LEAGUE = 'https://wecoach.gg/league-of-legends-coaching';
const METAFY_SESSIONS = 'https://metafy.gg/overwatch/sessions';
const METAFY_FEES =
  'https://help.metafy.gg/en/articles/14676126-buyer-fees-breakdown';
const METAFY_PRO = 'https://metafy.gg/pro';
const QUEUEUP_DOCS = 'https://queueup.gg/docs';
const QUEUEUP_VALORANT = 'https://queueup.gg/valorant';
const SENSEI = 'https://www.corsair.com/us/en/s/gamer-sensei';
const EPAL_VALORANT = 'https://www.epal.gg/epals/valorant-lfg';
const EPAL_WALLET = 'https://www.epal.gg/help/faq/21';
const FIVERR_GIG =
  'https://www.fiverr.com/fakemat/play-marvel-rivals-with-you-694e';
const FIVERR_CATEGORY =
  'https://www.fiverr.com/categories/lifestyle/gaming/game-coaching';
const SILHOUETTE_CS2 = 'https://silhouette.gg/coaching/counter-strike-2';
const SILHOUETTE_VALORANT = 'https://silhouette.gg/games/valorant';
const KAKI_PRICING = 'https://kakigaming.com/pricing';
const GAMETREE = 'https://gametree.me/';
const GAMERLINK = 'https://gamerlinkapp.com/';
const ELOBOOST = 'https://eloboost24.eu/coaching';
const PROGUIDES = 'https://www.proguides.com/lol';

/**
 * Every price figure the survey verified, one row per figure on the page.
 *
 * The two WeCoach rosters and the Metafy session list are the only sources
 * that publish a per-hour rate openly, so they carry the hourly rows. Each
 * number is one coach card or one session card read on the date in the row.
 */
export const OBSERVATIONS: readonly PriceObservation[] = [
  ...rows(
    {
      platform: 'WeCoach',
      game: 'Valorant',
      service: 'One-to-one coaching, coach-set hourly rate',
      type: 'coaching',
      unit: 'hour',
      currency: 'USD',
      source: WECOACH_VALORANT,
      checked: SURVEY_CHECKED,
      note: 'One coach card on the Valorant coaching page.',
    },
    [36, 30, 20.99, 24.99, 44.44, 25, 40, 50, 20, 18, 25, 30, 25, 20, 15, 15],
  ),
  ...rows(
    {
      platform: 'WeCoach',
      game: 'League of Legends',
      service: 'One-to-one coaching, coach-set hourly rate',
      type: 'coaching',
      unit: 'hour',
      currency: 'USD',
      source: WECOACH_LEAGUE,
      checked: SURVEY_CHECKED,
      note: 'One coach card on the League of Legends coaching page.',
    },
    [
      75, 50, 35, 59.97, 35, 15, 55, 20, 14, 15, 19.99, 49.99, 50, 25, 24.99,
      35, 25, 20, 20, 55, 15, 20, 10, 20, 25, 50, 35, 50, 20, 19, 25, 30, 25,
      30, 60, 39.99, 19.99, 24.99, 45, 24.99, 35, 175, 14.99, 20, 30, 25, 20,
      25, 25, 35,
    ],
  ),
  ...rows(
    {
      platform: 'Metafy',
      game: 'Overwatch 2',
      service: 'One-to-one coaching, one hour, creator-set price',
      type: 'coaching',
      unit: 'hour',
      currency: 'USD',
      source: METAFY_SESSIONS,
      checked: SURVEY_CHECKED,
      note: 'Session card labelled one hour. Two cards showed the price against a higher struck-out figure; the charged price is recorded.',
    },
    [25, 30, 30],
  ),
  {
    platform: 'Metafy',
    game: 'Overwatch 2',
    service: 'Live session and learning block, two hours',
    type: 'coaching',
    unit: '2 hours',
    currency: 'USD',
    amount: 60,
    source: METAFY_SESSIONS,
    checked: SURVEY_CHECKED,
  },
  ...rows(
    {
      platform: 'Metafy',
      game: 'Overwatch 2',
      service: 'Replay review, no duration stated',
      type: 'coaching',
      unit: 'session',
      currency: 'USD',
      source: METAFY_SESSIONS,
      checked: SURVEY_CHECKED,
      note: 'The page states no duration for this card, so the figure is per session.',
    },
    [9.99, 16.99, 25, 25],
  ),
  ...rows(
    {
      platform: 'Metafy',
      game: 'Overwatch 2',
      service: 'One-to-one session, no duration stated',
      type: 'coaching',
      unit: 'session',
      currency: 'USD',
      source: METAFY_SESSIONS,
      checked: SURVEY_CHECKED,
      note: 'The page states no duration for this card, so the figure is per session.',
    },
    [30, 30, 35, 50, 50],
  ),
  {
    platform: 'Metafy',
    game: 'Overwatch 2',
    service: 'Team session, no duration stated',
    type: 'coaching',
    unit: 'session',
    currency: 'USD',
    amount: 100,
    source: METAFY_SESSIONS,
    checked: SURVEY_CHECKED,
    note: 'Priced for a team rather than one player.',
  },
  {
    platform: 'QueueUp',
    game: 'Any game',
    service: 'Instant coaching session, 24 QueueCoins',
    type: 'coaching',
    unit: '45 minutes',
    currency: 'USD',
    amount: 24,
    source: QUEUEUP_DOCS,
    checked: SURVEY_CHECKED,
    note: 'The documentation prices Instant at 24 QC and states 1 QC is USD 1.',
  },
  {
    platform: 'Gamer Sensei',
    game: 'Any game',
    service: 'Skills assessment with an improvement plan',
    type: 'coaching',
    unit: '30 minutes',
    currency: 'USD',
    amount: 24.99,
    source: SENSEI,
    checked: SURVEY_CHECKED,
  },
  ...rows(
    {
      platform: 'Gamer Sensei',
      game: 'Any game',
      service: 'Advanced and expert coaching packages, no duration stated',
      type: 'coaching',
      unit: 'session',
      currency: 'USD',
      source: SENSEI,
      checked: SURVEY_CHECKED,
      note: 'The page names no duration for either package, so neither is an hourly price.',
    },
    [44.99, 59.99],
  ),
  ...rows(
    {
      platform: 'E-Pal',
      game: 'Valorant',
      service: 'Paid teammate, provider-set price per game',
      type: 'teammate',
      unit: 'game',
      currency: 'Buff',
      source: EPAL_VALORANT,
      checked: SURVEY_CHECKED,
      note: 'One provider card showing a single figure per game. Cards carrying a discount badge and two figures are left out.',
    },
    [6.66, 5, 4.44, 9, 2, 3, 3.67, 2, 3, 2.5, 8.99, 4],
  ),
  {
    platform: 'E-Pal',
    game: 'Valorant',
    service: 'Paid teammate, provider-set price per half hour',
    type: 'teammate',
    unit: '30 minutes',
    currency: 'Buff',
    amount: 15,
    source: EPAL_VALORANT,
    checked: SURVEY_CHECKED,
  },
];

/**
 * Provider cards on the E-Pal Valorant page that showed two figures rather
 * than one, for example "20% OFF 2.00 2.50/Game".
 *
 * Each of these carries a discount badge, a lower figure and a struck-out
 * figure, and the badge is conditional: "1st Order 15% OFF" on one card, a
 * flat percentage on the others. Neither figure is therefore the price every
 * buyer pays, so these cards carry no row in OBSERVATIONS. The count is
 * recorded because the report states how many cards it left out and why.
 */
export const EPAL_TWO_FIGURE_CARDS = 7;

export interface SurveyPlatform {
  readonly name: string;
  /** What the platform sells, in one clause. */
  readonly sells: string;
  /** Who sets the price: the platform, the provider, or nobody. */
  readonly priceModel: string;
  /** The pages the survey opened, in the order it opened them. */
  readonly sources: readonly { readonly title: string; readonly url: string }[];
  /** The fee wording the platform publishes, or what it leaves unstated. */
  readonly fees: string;
  /** The refund or guarantee wording the platform publishes. */
  readonly refunds: string;
  /** Set when the platform returned no readable page, with the status. */
  readonly blocked?: string;
}

/**
 * The twelve platforms the survey covers, in alphabetical order.
 *
 * Alphabetical on purpose: any other order is an argument. Duoly is listed in
 * the same table, in the same position its name puts it, with its prices from
 * the pricing engine rather than from this file.
 */
export const PLATFORMS: readonly SurveyPlatform[] = [
  {
    name: 'Duoly',
    sells: 'Teammate sessions and coaching hours at published prices',
    priceModel: 'Platform sets one published price per service and rank',
    sources: [
      {
        title: 'Duoly price list, every game and service',
        url: 'https://duoly.gg/pricing',
      },
      {
        title: 'Duoly fees, discounts and refund rules',
        url: 'https://duoly.gg/fees-and-refunds',
      },
    ],
    fees: 'No fee added at checkout. The euro price is the total, and a US dollar price uses the daily ECB rate plus 1%.',
    refunds:
      'An order no teammate accepts within 5 minutes cancels and refunds itself. The cancellation rules sit in the public terms.',
  },
  {
    name: 'E-Pal',
    sells: 'Paid gaming companions, coaching and chat',
    priceModel: 'Providers set a price per game or per time block in Buff',
    sources: [
      {
        title: 'E-Pal Valorant companion roster with per-game prices',
        url: EPAL_VALORANT,
      },
      {
        title: 'E-Pal wallet help page with the Buff rate and the fees',
        url: EPAL_WALLET,
      },
    ],
    fees: 'The wallet help page states 1 Buff is USD 1.00, a 10% platform service fee on every top-up, a 3% to 4.5% channel fee on the website and 15% to 30% in the app.',
    refunds:
      'No customer refund window was stated on either page the survey read.',
  },
  {
    name: 'Eloboost24',
    sells: 'Coaching, sessions with stronger players and boosting',
    priceModel: 'Coaches set the price on their own profile',
    sources: [
      {
        title: 'Eloboost24 coaching directory, which answered HTTP 403',
        url: ELOBOOST,
      },
    ],
    fees: 'Not read: the page did not answer.',
    refunds: 'Not read: the page did not answer.',
    blocked:
      'HTTP 403 with a browser check page on 10 November 2026, so no price from this platform is in the survey.',
  },
  {
    name: 'Fiverr',
    sells: 'A general freelance marketplace with gaming gigs',
    priceModel: 'Unknown: no current price was readable',
    sources: [
      {
        title: 'Fiverr game coaching category listing, which answered HTTP 403',
        url: FIVERR_CATEGORY,
      },
      {
        title: 'Fiverr Marvel Rivals teammate gig, which answered HTTP 403',
        url: FIVERR_GIG,
      },
    ],
    fees: 'Not read: neither page answered.',
    refunds: 'Not read: neither page answered.',
    blocked:
      'HTTP 403 with a bot-check page on both the category listing and the gig page on 10 November 2026, so no price from this platform is in the survey.',
  },
  {
    name: 'Gamer Sensei',
    sells: 'Skills assessment, individual coaching and team training',
    priceModel: 'Platform publishes three fixed packages',
    sources: [
      {
        title: 'Corsair Gamer Sensei page with its three coaching packages',
        url: SENSEI,
      },
    ],
    fees: 'No buyer fee was stated on the page.',
    refunds: 'No refund term was stated on the page.',
  },
  {
    name: 'GamerLink',
    sells: 'Free looking-for-group posts and group chat',
    priceModel: 'Nothing to buy: the app is free to download',
    sources: [
      {
        title: 'GamerLink homepage, which prices the app at nothing',
        url: GAMERLINK,
      },
    ],
    fees: 'None stated. The homepage says to download the app for free.',
    refunds: 'Not applicable to a free app.',
  },
  {
    name: 'GameTree',
    sells: 'Free looking-for-group matching and a Discord bot',
    priceModel: 'Nothing to buy: the core service is free',
    sources: [
      {
        title: 'GameTree homepage, which calls the service free',
        url: GAMETREE,
      },
    ],
    fees: 'None stated. The homepage says GameTree is free and that premium options will exist, without naming a price.',
    refunds: 'Not applicable to a free service.',
  },
  {
    name: 'KAKI Gaming',
    sells: 'Paid gaming companions and coaching in Malaysia and Singapore',
    priceModel: 'Providers set their own rates in KAKI, the wallet unit',
    sources: [
      {
        title: 'KAKI Gaming pricing page with its platform fee',
        url: KAKI_PRICING,
      },
    ],
    fees: 'The pricing page states a 0% platform fee on regular orders and a review period before a payout. It publishes no KAKI to cash rate.',
    refunds:
      'The page describes locked funds released after a session rather than a refund window.',
  },
  {
    name: 'Metafy',
    sells: 'Coaching sessions, replay reviews, guides and events',
    priceModel: 'Creators price each session format',
    sources: [
      {
        title: 'Metafy Overwatch 2 session list with creator prices',
        url: METAFY_SESSIONS,
      },
      {
        title: 'Metafy help centre buyer fee breakdown',
        url: METAFY_FEES,
      },
      {
        title: 'Metafy creator plans and revenue share',
        url: METAFY_PRO,
      },
    ],
    fees: 'The help centre states a 3.7% platform fee plus USD 1.79 per transaction, capped at USD 20 or 30% of the total whichever is lower, and a 2.9% processing fee plus USD 0.40, unless a partner covers them.',
    refunds:
      'No buyer refund window was stated on the pages the survey read. Several creators list a free consultation of 15 or 30 minutes.',
  },
  {
    name: 'ProGuides',
    sells: 'Courses and a legacy coaching brand',
    priceModel: 'Unknown: no current price was readable',
    sources: [
      {
        title: 'ProGuides League of Legends page, which answered HTTP 403',
        url: PROGUIDES,
      },
    ],
    fees: 'Not read: the page did not answer.',
    refunds: 'Not read: the page did not answer.',
    blocked:
      'HTTP 403 on 10 November 2026, so no price from this platform is in the survey.',
  },
  {
    name: 'QueueUp',
    sells: 'Coaching sessions, replay reviews and bundles',
    priceModel:
      'Coaches set most prices; the platform fixes one Instant session price',
    sources: [
      {
        title: 'QueueUp documentation with the Instant session price',
        url: QUEUEUP_DOCS,
      },
      {
        title: 'QueueUp Valorant coaching page and coin rate',
        url: QUEUEUP_VALORANT,
      },
    ],
    fees: 'Sessions are paid in QueueCoins at 1 QC for USD 1, and checkout can charge the shortfall without buying coins first. No separate buyer fee was stated.',
    refunds:
      'A full refund of up to USD 35 after a first paid session, a refund when a coach does not show, and a free intro session of 10 to 15 minutes.',
  },
  {
    name: 'Silhouette',
    sells: 'Gaming companions and coaching',
    priceModel: 'Companions set their own price per session',
    sources: [
      {
        title: 'Silhouette Counter-Strike 2 coaching page and revenue split',
        url: SILHOUETTE_CS2,
      },
      {
        title: 'Silhouette Valorant companion roster with no prices shown',
        url: SILHOUETTE_VALORANT,
      },
    ],
    fees: 'The coaching page states companions keep 83% of a completed session and pay nothing to list. Browsing is free.',
    refunds: 'No refund window was stated on either page.',
    blocked:
      'Both pages loaded and described coach-set prices without showing one, so Silhouette contributes no price row.',
  },
  {
    name: 'WeCoach',
    sells: 'Esports coaching and replay review',
    priceModel: 'Coaches set an hourly rate shown on every card',
    sources: [
      {
        title: 'WeCoach Valorant coaching roster with hourly rates',
        url: WECOACH_VALORANT,
      },
      {
        title: 'WeCoach League of Legends roster with hourly rates',
        url: WECOACH_LEAGUE,
      },
    ],
    fees: 'No buyer fee or platform commission was stated on either page.',
    refunds:
      'No refund window was stated. Both pages advertise a free first intro with participating coaches.',
  },
];

/** The platforms whose price rows the survey had to drop, with the reason. */
export const DROPPED = PLATFORMS.filter((platform) => platform.blocked);
