import { describe, expect, it } from 'vitest';
import {
  EPAL_TWO_FIGURE_CARDS,
  OBSERVATIONS,
  PLATFORMS,
  SURVEY_CHECKED,
  SURVEY_FX,
} from '../../src/content/price-report-2026';
import {
  ALL_ROWS,
  BLOCKED_PLATFORMS,
  COMPETITOR_COUNT,
  CSV_HEADER,
  DUOLY,
  DUOLY_ROWS,
  FREE_PLATFORMS,
  HOURLY_BANDS,
  HOURLY_BY_SOURCE,
  HOURLY_COACHING,
  OBSERVATION_COUNT,
  SESSION_COACHING,
  TABLE,
  TEAMMATE_PER_GAME,
  VERIFIED_PLATFORM_NAMES,
  VERIFIED_PLATFORMS,
  eurMinorOf,
  renderReportCsv,
} from '../../src/server/seo/price-report';
import {
  GET,
  prerender,
} from '../../src/pages/reports/gaming-coaching-and-teammate-prices-2026.csv';
import { calculateQuote } from '../../src/server/pricing';
import { formatPrice } from '../../src/server/seo/offers';
import { INDEXABLE_PATHS, REPORT_PATH } from '../../src/site/seo';
import { CONTENT_SOURCES } from '../../src/site/content-dates';

/** One field at a time, so a quoted comma in a note cannot hide a broken row. */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i]!;
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') {
      fields.push(field);
      field = '';
    } else field += char;
  }
  fields.push(field);
  return fields;
}

describe('the 2026 price survey data', () => {
  it('records one first-party, dated, single-unit figure per row', () => {
    expect(OBSERVATIONS.length).toBe(OBSERVATION_COUNT);
    for (const row of OBSERVATIONS) {
      expect(row.checked).toBe(SURVEY_CHECKED);
      expect(row.source).toMatch(/^https:\/\//);
      // The source has to be the platform's own domain or its help centre, so a
      // roundup or a competitor's comparison can never become a price row.
      expect(row.source).not.toMatch(/reddit|similarweb|cbinsights|slashdot/i);
      expect(row.amount).toBeGreaterThan(0);
      expect(Math.round(row.amount * 100)).toBeCloseTo(row.amount * 100, 6);
      expect(['USD', 'Buff']).toContain(row.currency);
      expect([
        'hour',
        '2 hours',
        '45 minutes',
        '30 minutes',
        'session',
        'game',
      ]).toContain(row.unit);
    }
  });

  it('keeps Duoly prices out of the survey file and in the pricing engine', () => {
    expect(OBSERVATIONS.some((row) => row.platform === 'Duoly')).toBe(false);
    // The flat coaching hour, re-derived from the engine rather than read back.
    const hour = calculateQuote(
      { gameId: 'val', serviceId: 'vod', units: 1, server: 'EU' },
      { customerCurrency: 'EUR', eurToUsd: 1 },
    );
    expect(DUOLY.coachingHour).toBe(
      formatPrice(hour.customer.amountMinor, 'EUR'),
    );
    expect(DUOLY.coachingHourEurMinor).toBe(hour.customer.amountMinor);
    const cheapest = calculateQuote(
      { gameId: 'val', serviceId: 'skirm', units: 1, server: 'EU' },
      { customerCurrency: 'EUR', eurToUsd: 1 },
    );
    expect(DUOLY.teammateFrom).toBe(
      formatPrice(cheapest.customer.amountMinor, 'EUR'),
    );
    for (const row of DUOLY_ROWS) {
      expect(row.currency).toBe('EUR');
      expect(row.eurMinor).toBe(Math.round(row.amount * 100));
      expect(row.source).toBe('https://duoly.gg/pricing');
    }
  });

  it('converts to euro with the one recorded ECB reference rate', () => {
    expect(SURVEY_FX.usdPerEur).toBe(1.1193);
    expect(SURVEY_FX.published).toBe('2026-11-09');
    expect(eurMinorOf({ currency: 'USD', amount: 25 })).toBe(
      Math.round((25 / SURVEY_FX.usdPerEur) * 100),
    );
    // One Buff is one US dollar on E-Pal's own wallet page, so both convert alike.
    expect(eurMinorOf({ currency: 'Buff', amount: 3.67 })).toBe(
      eurMinorOf({ currency: 'USD', amount: 3.67 }),
    );
    expect(eurMinorOf({ currency: 'EUR', amount: 12.99 })).toBe(1299);
  });

  it('publishes the medians and ranges the survey actually found', () => {
    expect(HOURLY_COACHING).toMatchObject({
      count: 69,
      currency: 'USD',
      median: 'USD 25.00',
      low: 'USD 10.00',
      high: 'USD 175.00',
      medianEur: '€22.34',
      lowEur: '€8.93',
      highEur: '€156.35',
      platforms: ['Metafy', 'WeCoach'],
    });
    expect(SESSION_COACHING).toMatchObject({
      count: 12,
      median: 'USD 32.50',
      low: 'USD 9.99',
      high: 'USD 100.00',
    });
    expect(TEAMMATE_PER_GAME).toMatchObject({
      count: 12,
      currency: 'Buff',
      median: 'Buff 3.84',
      low: 'Buff 2.00',
      high: 'Buff 9.00',
      platforms: ['E-Pal'],
    });
    // Every hourly rate falls in exactly one band, and the bands cover them all.
    expect(HOURLY_BANDS.reduce((total, band) => total + band.count, 0)).toBe(
      HOURLY_COACHING.count,
    );
    expect(
      HOURLY_BY_SOURCE.reduce((total, entry) => total + entry.spread.count, 0),
    ).toBe(HOURLY_COACHING.count);
  });

  it('counts the platforms honestly, including the ones that did not answer', () => {
    expect(COMPETITOR_COUNT).toBe(12);
    expect(
      PLATFORMS.filter((platform) => platform.name === 'Duoly'),
    ).toHaveLength(1);
    expect(VERIFIED_PLATFORMS).toBe(5);
    expect(VERIFIED_PLATFORM_NAMES).toEqual([
      'WeCoach',
      'Metafy',
      'QueueUp',
      'Gamer Sensei',
      'E-Pal',
    ]);
    expect(BLOCKED_PLATFORMS.map((platform) => platform.name)).toEqual([
      'Eloboost24',
      'Fiverr',
      'ProGuides',
    ]);
    expect(FREE_PLATFORMS.map((platform) => platform.name)).toEqual([
      'GamerLink',
      'GameTree',
    ]);
    for (const platform of BLOCKED_PLATFORMS) {
      expect(OBSERVATIONS.some((row) => row.platform === platform.name)).toBe(
        false,
      );
      expect(platform.blocked).toMatch(/HTTP 403/);
    }
    // Alphabetical, so the table's order is never an argument.
    expect(PLATFORMS.map((platform) => platform.name)).toEqual(
      [...PLATFORMS.map((platform) => platform.name)].sort((a, b) =>
        a.localeCompare(b),
      ),
    );
    expect(EPAL_TWO_FIGURE_CARDS).toBe(7);
  });

  it('builds every table price line out of the platform own rows', () => {
    for (const row of TABLE) {
      if (!row.rows.length) {
        expect(row.prices).toMatch(/^No price/);
        continue;
      }
      // One group per currency and billing unit, printed as its own range.
      const groups = new Map<string, number[]>();
      for (const observation of row.rows) {
        const key = `${observation.currency}:${observation.unit}`;
        groups.set(key, [...(groups.get(key) ?? []), observation.amount]);
      }
      for (const [key, amounts] of groups) {
        const [currency, unit] = key.split(':') as [string, string];
        const money = (amount: number) =>
          currency === 'EUR'
            ? `€${amount.toFixed(2)}`
            : `${currency} ${amount.toFixed(2)}`;
        expect(row.prices).toContain(`per ${unit}`);
        expect(row.prices).toContain(money(Math.min(...amounts)));
        expect(row.prices).toContain(money(Math.max(...amounts)));
        if (amounts.length > 1)
          expect(row.prices).toContain(`(${amounts.length} prices)`);
      }
    }
  });

  it('keeps the customer copy rules in the survey copy', () => {
    const copy = JSON.stringify([OBSERVATIONS, PLATFORMS]);
    expect(copy).not.toMatch(/[–—]/);
    expect(copy).not.toMatch(/ & /);
    expect(copy).not.toMatch(/not .{1,40}, but /i);
  });

  it('publishes the report page in the sitemap with its own content sources', () => {
    expect(INDEXABLE_PATHS).toContain(REPORT_PATH);
    expect(CONTENT_SOURCES[REPORT_PATH]).toContain(
      'src/content/price-report-2026.ts',
    );
  });
});

describe('the 2026 price survey CSV', () => {
  const csv = renderReportCsv();
  const lines = csv.split('\n').filter(Boolean);
  const header = lines.find((line) => line.startsWith('platform,'))!;
  const data = lines.slice(lines.indexOf(header) + 1);

  it('carries one parseable row per observation, with its source and date', () => {
    expect(header).toBe(CSV_HEADER.join(','));
    expect(data).toHaveLength(ALL_ROWS.length);
    expect(ALL_ROWS).toHaveLength(OBSERVATION_COUNT + DUOLY_ROWS.length);
    for (const line of data) {
      const fields = parseCsvLine(line);
      expect(fields).toHaveLength(CSV_HEADER.length);
      const row = Object.fromEntries(
        CSV_HEADER.map((key, index) => [key, fields[index]!]),
      );
      expect(row.source_url).toMatch(/^https:\/\//);
      expect(row.checked_date).toBe(SURVEY_CHECKED);
      expect(Number(row.amount)).toBeGreaterThan(0);
      expect(Number(row.amount_eur)).toBeGreaterThan(0);
      expect(['coaching', 'teammate', 'lfg']).toContain(row.service_type);
    }
  });

  it('states the rate, the date and the wallet rule above the header', () => {
    const comments = lines.filter((line) => line.startsWith('#'));
    expect(comments.length).toBeGreaterThanOrEqual(4);
    expect(csv).toContain(`read ${SURVEY_CHECKED}`);
    expect(csv).toContain(`1 EUR = ${SURVEY_FX.usdPerEur} USD`);
    expect(csv).toContain(SURVEY_FX.source);
    expect(csv).toContain('Buff is E-Pal wallet currency');
  });

  it('converts every amount at the recorded rate', () => {
    for (const row of ALL_ROWS) expect(row.eurMinor).toBe(eurMinorOf(row));
  });

  it('serves text/csv as a download, rendered from the bundled data', async () => {
    expect(prerender).toBe(false);
    const response = await GET({} as Parameters<typeof GET>[0]);
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe(
      'text/csv; charset=utf-8',
    );
    expect(response.headers.get('Content-Disposition')).toContain('.csv"');
    expect(await response.text()).toBe(csv);
  });
});
