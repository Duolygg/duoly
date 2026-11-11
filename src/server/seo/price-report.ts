import {
  OBSERVATIONS,
  PLATFORMS,
  SURVEY_CHECKED,
  SURVEY_FX,
  type PriceObservation,
  type SurveyPlatform,
  type SurveyUnit,
} from '../../content/price-report-2026';
import { PRICE_TABLE } from './price-table';
import {
  COACHABLE_GAMES,
  COACHING_PRICE,
  PLAYABLE_GAMES,
  SHARE_PERCENT,
} from './teammate-facts';
import { formatPrice } from './offers';
import { AUTO_CANCEL_MINUTES, USD_MARGIN_PERCENT } from './fees';
import { CATALOG_PRICES_UPDATED_LABEL } from '../../site/price-dates';

/**
 * Everything /reports/gaming-coaching-and-teammate-prices-2026 states, derived
 * once from two sources and never typed into the page.
 *
 * The competitor figures come from src/content/price-report-2026.ts, which is
 * the survey's raw observations. Duoly's own figures come from the pricing
 * engine through PRICE_TABLE and the teammate facts, so the report quotes the
 * same prices checkout charges. Nothing is averaged across currencies without
 * the recorded ECB rate, and nothing is converted that the source platform
 * does not itself price in a currency.
 *
 * tests/unit/price-report.test.ts re-derives every number below.
 */

/** Buff is E-Pal's wallet unit, and E-Pal's own wallet page prices it at USD 1.00. */
const BUFF_IN_USD = 1;

/** One observation in euro minor units, at the recorded ECB reference rate. */
export const eurMinorOf = (row: {
  currency: 'USD' | 'Buff' | 'EUR';
  amount: number;
}): number => {
  if (row.currency === 'EUR') return Math.round(row.amount * 100);
  const usd = row.currency === 'Buff' ? row.amount * BUFF_IN_USD : row.amount;
  return Math.round((usd / SURVEY_FX.usdPerEur) * 100);
};

export interface ReportRow extends Omit<PriceObservation, 'currency'> {
  readonly currency: 'USD' | 'Buff' | 'EUR';
  /** The same figure in euro, for a comparison that crosses currencies. */
  readonly eurMinor: number;
}

const withEuro = (row: Omit<ReportRow, 'eurMinor'>): ReportRow => ({
  ...row,
  eurMinor: eurMinorOf(row),
});

/**
 * Duoly's rows, read out of the pricing engine on every build.
 *
 * Two figures matter for a price comparison: the flat coaching hour, which is
 * the same in every coached game, and the span of teammate prices per game,
 * which moves with the game, the service and the customer's own rank. Both
 * come from PRICE_TABLE, which is a `calculateQuote` call per row.
 */
const duoRows = PRICE_TABLE.flatMap((game) =>
  game.rows
    .filter((row) => row.category === 'duo' && row.unit === 'game')
    .map((row) => ({ game, row })),
);
const minorOf = (price: string) => Math.round(Number(price.slice(1)) * 100);
const duoCheapest = duoRows.reduce((low, entry) =>
  minorOf(entry.row.from) < minorOf(low.row.from) ? entry : low,
);
const duoDearest = duoRows.reduce((high, entry) =>
  minorOf(entry.row.to) > minorOf(high.row.to) ? entry : high,
);
const coachingRow = PRICE_TABLE.flatMap((game) => game.rows).find(
  (row) => row.category === 'training' && row.unit === 'hour',
)!;

/** The Duoly prices the report quotes, every one of them a quote from checkout. */
export const DUOLY = {
  /** The flat coaching hour, for example €12.99. */
  coachingHour: COACHING_PRICE,
  coachingHourEurMinor: minorOf(coachingRow.from),
  coachedGames: COACHABLE_GAMES,
  games: PLAYABLE_GAMES,
  /** The cheapest teammate game in the catalog, with the game it belongs to. */
  teammateFrom: duoCheapest.row.from,
  teammateFromGame: duoCheapest.game.name,
  teammateFromService: duoCheapest.row.title,
  /** The dearest single teammate game, which is a high rank on a top tier. */
  teammateTo: duoDearest.row.to,
  teammateToGame: duoDearest.game.name,
  teammateToService: duoDearest.row.title,
  sharePercent: SHARE_PERCENT,
  autoCancelMinutes: AUTO_CANCEL_MINUTES,
  usdMarginPercent: USD_MARGIN_PERCENT,
  pricesUpdated: CATALOG_PRICES_UPDATED_LABEL,
} as const;

/** Duoly's two rows in the dataset, in the same shape as every observation. */
export const DUOLY_ROWS: readonly ReportRow[] = [
  withEuro({
    platform: 'Duoly',
    game: 'Every coached game',
    service: `${coachingRow.title}, one flat published price`,
    type: 'coaching',
    unit: 'hour',
    currency: 'EUR',
    amount: DUOLY.coachingHourEurMinor / 100,
    source: 'https://duoly.gg/pricing',
    checked: SURVEY_CHECKED,
    note: `The same hourly price in all ${DUOLY.coachedGames} coached games, published on the Duoly price list.`,
  }),
  withEuro({
    platform: 'Duoly',
    game: DUOLY.teammateFromGame,
    service: `${DUOLY.teammateFromService}, cheapest teammate game in the catalog`,
    type: 'teammate',
    unit: 'game',
    currency: 'EUR',
    amount: minorOf(DUOLY.teammateFrom) / 100,
    source: 'https://duoly.gg/pricing',
    checked: SURVEY_CHECKED,
  }),
  withEuro({
    platform: 'Duoly',
    game: DUOLY.teammateToGame,
    service: `${DUOLY.teammateToService}, dearest teammate game in the catalog`,
    type: 'teammate',
    unit: 'game',
    currency: 'EUR',
    amount: minorOf(DUOLY.teammateTo) / 100,
    source: 'https://duoly.gg/pricing',
    checked: SURVEY_CHECKED,
  }),
];

/** Every row in the dataset: the survey's observations plus Duoly's own. */
export const ALL_ROWS: readonly ReportRow[] = [
  ...OBSERVATIONS.map((row) => withEuro(row)),
  ...DUOLY_ROWS,
];

const median = (values: readonly number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]!
    : Math.round((sorted[middle - 1]! + sorted[middle]!) / 2);
};

export interface Spread {
  readonly count: number;
  /** Platforms the rows came from, for a sentence that names the sample. */
  readonly platforms: readonly string[];
  /** The currency every row in the slice was priced in, when they agree. */
  readonly currency: 'USD' | 'Buff' | 'EUR' | 'mixed';
  /** The three figures as the source pages stated them, for example USD 25.00. */
  readonly median: string;
  readonly low: string;
  readonly high: string;
  /** The same three figures in euro, at the recorded ECB reference rate. */
  readonly medianEur: string;
  readonly lowEur: string;
  readonly highEur: string;
}

/**
 * The median, lowest and highest price in one slice of the survey.
 *
 * The three figures are picked in the currency the pages stated and only then
 * converted, so the published median is a price a reader can find on a source
 * page rather than a number that exists after two roundings. A slice whose
 * rows disagree on currency reports the euro conversion alone, because an
 * average across wallet units would mean nothing.
 */
const spread = (rows: readonly ReportRow[]): Spread => {
  const currencies = [...new Set(rows.map((row) => row.currency))];
  const currency = currencies.length === 1 ? currencies[0]! : 'mixed';
  const label = (amount: number) =>
    currency === 'EUR'
      ? formatPrice(Math.round(amount * 100), 'EUR')
      : currency === 'mixed'
        ? ''
        : `${currency} ${amount.toFixed(2)}`;
  const inEur = (amount: number) =>
    currency === 'mixed'
      ? ''
      : formatPrice(eurMinorOf({ currency, amount }), 'EUR');
  if (currency === 'mixed') {
    const minors = rows.map((row) => row.eurMinor);
    return {
      count: rows.length,
      platforms: [...new Set(rows.map((row) => row.platform))].sort(),
      currency,
      median: '',
      low: '',
      high: '',
      medianEur: formatPrice(median(minors), 'EUR'),
      lowEur: formatPrice(Math.min(...minors), 'EUR'),
      highEur: formatPrice(Math.max(...minors), 'EUR'),
    };
  }
  const amounts = rows.map((row) => row.amount);
  const mid = median(amounts.map((amount) => Math.round(amount * 100))) / 100;
  const low = Math.min(...amounts);
  const high = Math.max(...amounts);
  return {
    count: rows.length,
    platforms: [...new Set(rows.map((row) => row.platform))].sort(),
    currency,
    median: label(mid),
    low: label(low),
    high: label(high),
    medianEur: inEur(mid),
    lowEur: inEur(low),
    highEur: inEur(high),
  };
};

const competitorRows = OBSERVATIONS.map((row) => withEuro(row));
const of = (type: 'coaching' | 'teammate' | 'lfg', unit: SurveyUnit) =>
  competitorRows.filter((row) => row.type === type && row.unit === unit);

/** Every hourly coaching rate the survey verified, which is the headline set. */
export const HOURLY_COACHING = spread(of('coaching', 'hour'));
/** Coaching sold as a session with no duration on the page. */
export const SESSION_COACHING = spread(of('coaching', 'session'));
/** Paid teammate time sold per game, which is E-Pal's model and Duoly's. */
export const TEAMMATE_PER_GAME = spread(of('teammate', 'game'));

/**
 * The hourly rates grouped by the page they were read from, so a reader can
 * see which roster drives the median rather than taking one number on trust.
 */
export const HOURLY_BY_SOURCE: readonly {
  readonly platform: string;
  readonly game: string;
  readonly spread: Spread;
  readonly source: string;
}[] = [
  ...new Set(
    of('coaching', 'hour').map((row) => `${row.platform}|${row.game}`),
  ),
].map((key) => {
  const rows = of('coaching', 'hour').filter(
    (row) => `${row.platform}|${row.game}` === key,
  );
  return {
    platform: rows[0]!.platform,
    game: rows[0]!.game,
    source: rows[0]!.source,
    spread: spread(rows),
  };
});

/**
 * How the verified hourly rates fall into price bands, for the one visual on
 * the page. Bands are in US dollars, which is the currency every hourly row
 * was priced in, and the last band is open ended.
 */
export const HOURLY_BANDS: readonly {
  readonly label: string;
  readonly count: number;
  readonly percent: number;
}[] = (() => {
  const rows = of('coaching', 'hour');
  const bands: [string, (amount: number) => boolean][] = [
    ['Under USD 20', (amount) => amount < 20],
    ['USD 20 to 29.99', (amount) => amount >= 20 && amount < 30],
    ['USD 30 to 39.99', (amount) => amount >= 30 && amount < 40],
    ['USD 40 to 49.99', (amount) => amount >= 40 && amount < 50],
    ['USD 50 and above', (amount) => amount >= 50],
  ];
  return bands.map(([label, test]) => {
    const count = rows.filter((row) => test(row.amount)).length;
    return {
      label,
      count,
      percent: Math.round((count / rows.length) * 100),
    };
  });
})();

/**
 * The share of hourly rates that came from one platform, as a percentage.
 *
 * The limitations section states this rather than leaving a reader to add the
 * row counts up: two rosters on one site carry most of the hourly sample,
 * which is the first thing to know before quoting the median.
 */
export const HOURLY_TOP_SOURCE = (() => {
  const rows = of('coaching', 'hour');
  const byPlatform = [...new Set(rows.map((row) => row.platform))].map(
    (platform) => ({
      platform,
      count: rows.filter((row) => row.platform === platform).length,
    }),
  );
  const top = byPlatform.reduce((high, entry) =>
    entry.count > high.count ? entry : high,
  );
  return {
    ...top,
    percent: Math.round((top.count / rows.length) * 100),
    total: rows.length,
  };
})();

/** Platforms that published no price on the pages the survey read. */
export const NO_PRICE_PLATFORMS = PLATFORMS.filter(
  (platform) =>
    platform.name !== 'Duoly' &&
    !OBSERVATIONS.some((row) => row.platform === platform.name),
);
/** Platforms whose pages did not answer, so their prices are absent. */
export const BLOCKED_PLATFORMS = PLATFORMS.filter((platform) =>
  platform.blocked?.startsWith('HTTP'),
);
/** Platforms that answered and priced nothing, which is a different fact. */
export const FREE_PLATFORMS = PLATFORMS.filter((platform) =>
  platform.priceModel.startsWith('Nothing to buy'),
);
export const PLATFORM_COUNT = PLATFORMS.length;
/** The platforms other than Duoly, which is the survey's subject count. */
export const COMPETITOR_COUNT = PLATFORMS.length - 1;
/** Competitor platforms whose pages answered the survey at all. */
export const ANSWERED_COUNT = COMPETITOR_COUNT - BLOCKED_PLATFORMS.length;
/**
 * The platforms that published a price the survey could read, in the order the
 * survey read them. Derived rather than written out, so a platform that stops
 * publishing a price leaves this list on the next build instead of leaving the
 * page claiming it still does.
 */
export const VERIFIED_PLATFORM_NAMES: readonly string[] = [
  ...new Set(OBSERVATIONS.map((row) => row.platform)),
];
export const VERIFIED_PLATFORMS = VERIFIED_PLATFORM_NAMES.length;
export const OBSERVATION_COUNT = OBSERVATIONS.length;

export interface TableRow extends SurveyPlatform {
  /** The verified prices for this platform, built from its own rows. */
  readonly prices: string;
  readonly rows: readonly ReportRow[];
}

const unitLabel = (unit: SurveyUnit) =>
  unit === 'free' ? 'free' : `per ${unit}`;

/**
 * One line of verified prices per platform, assembled from that platform's own
 * rows rather than written out, so the table and the dataset cannot disagree.
 */
const priceLine = (platform: SurveyPlatform, rows: readonly ReportRow[]) => {
  if (!rows.length) {
    // Three empty cells mean three different things, and a reader quoting the
    // table deserves to see which: a free service, a page that answered and
    // showed no price, and a page that did not answer at all.
    if (platform.priceModel.startsWith('Nothing to buy'))
      return 'No price to verify: the service is free';
    return platform.blocked?.startsWith('HTTP')
      ? 'Not read: the page answered HTTP 403'
      : 'No price published on the pages read';
  }
  const groups = new Map<string, ReportRow[]>();
  for (const row of rows) {
    const key = `${row.currency}:${row.unit}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.values()]
    .map((group) => {
      const amounts = group.map((row) => row.amount);
      const low = Math.min(...amounts).toFixed(2);
      const high = Math.max(...amounts).toFixed(2);
      const unit = unitLabel(group[0]!.unit);
      const money =
        group[0]!.currency === 'EUR'
          ? (value: string) => `€${value}`
          : (value: string) => `${group[0]!.currency} ${value}`;
      const range =
        low === high ? money(low) : `${money(low)} to ${money(high)}`;
      return `${range} ${unit}${group.length > 1 ? ` (${group.length} prices)` : ''}`;
    })
    .join('; ');
};

/** The full table: one row per platform, alphabetical, Duoly among the rest. */
export const TABLE: readonly TableRow[] = PLATFORMS.map((platform) => {
  const rows = ALL_ROWS.filter((row) => row.platform === platform.name);
  return { ...platform, rows, prices: priceLine(platform, rows) };
});

const csvCell = (value: string | number) => {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

export const CSV_HEADER = [
  'platform',
  'game',
  'service',
  'service_type',
  'billing_unit',
  'currency',
  'amount',
  'amount_eur',
  'source_url',
  'checked_date',
  'note',
] as const;

/**
 * The dataset as CSV, generated at build time from the same rows the table
 * renders. One line per observation, the euro column converted at the recorded
 * ECB rate, and a comment block above the header naming the rate and the day
 * every row was read.
 */
export function renderReportCsv() {
  const lines = ALL_ROWS.map((row) =>
    [
      row.platform,
      row.game,
      row.service,
      row.type,
      row.unit,
      row.currency,
      row.amount.toFixed(2),
      (row.eurMinor / 100).toFixed(2),
      row.source,
      row.checked,
      row.note ?? '',
    ]
      .map(csvCell)
      .join(','),
  );
  return [
    `# Duoly gaming coaching and teammate price survey, read ${SURVEY_CHECKED}`,
    `# amount_eur converted at 1 EUR = ${SURVEY_FX.usdPerEur} USD, ${SURVEY_FX.source}, ${SURVEY_FX.published}`,
    '# Buff is E-Pal wallet currency, priced at USD 1.00 on the E-Pal wallet help page',
    "# Duoly rows are Duoly's own published prices, not a reading of a rival page",
    CSV_HEADER.join(','),
    ...lines,
    '',
  ].join('\n');
}
