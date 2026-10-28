/**
 * EUR→USD reference rate from the European Central Bank (published once per
 * working day). Cached per server instance; falls back to a recent rate when
 * the ECB can't be reached so booking never blocks on it.
 */
export const FALLBACK_EUR_TO_USD = 1.08;
const ECB_DAILY =
  'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml';
const TTL_MS = 6 * 60 * 60 * 1000;

let cached: {
  rate: number;
  at: number;
  date: string;
  source: 'ecb' | 'fallback';
} | null = null;

/** Pure: reads the USD rate out of the ECB daily XML. */
export function parseEcbUsd(xml: string): number | null {
  const match = /currency=['"]USD['"]\s+rate=['"]([0-9.]+)['"]/.exec(xml);
  const rate = match ? Number(match[1]) : NaN;
  return Number.isFinite(rate) && rate > 0.5 && rate < 2 ? rate : null;
}

export async function eurToUsd(
  fetcher: typeof fetch = fetch,
  now = Date.now(),
): Promise<{
  rate: number;
  source: 'ecb' | 'fallback';
  date: string;
  fetchedAt: number;
}> {
  if (cached && now - cached.at < TTL_MS)
    return {
      rate: cached.rate,
      source: cached.source,
      date: cached.date,
      fetchedAt: cached.at,
    };
  try {
    const response = await fetcher(ECB_DAILY, {
      signal: AbortSignal.timeout(2500),
    });
    const xml = response.ok ? await response.text() : '';
    const rate = response.ok ? parseEcbUsd(xml) : null;
    if (rate) {
      const date =
        /time=['"](\d{4}-\d{2}-\d{2})['"]/.exec(xml)?.[1] ??
        new Date(now).toISOString().slice(0, 10);
      cached = { rate, at: now, date, source: 'ecb' };
      return { rate, source: 'ecb', date, fetchedAt: now };
    }
  } catch {
    /* fall through */
  }
  // Retry sooner than a successful fetch.
  const date = new Date(now).toISOString().slice(0, 10);
  cached = {
    rate: FALLBACK_EUR_TO_USD,
    at: now - TTL_MS + 10 * 60 * 1000,
    date,
    source: 'fallback',
  };
  return {
    rate: FALLBACK_EUR_TO_USD,
    source: 'fallback',
    date,
    fetchedAt: cached.at,
  };
}

/**
 * What a USD customer pays per EUR 1 (original lib/fx.js customerUsdRate):
 * mid rate plus the 1% currency margin, rounded to four decimals. Same formula
 * as the server quote in src/server/pricing.
 */
export function customerUsdRate(eurToUsdRate: number): number {
  return Math.round(eurToUsdRate * 1.01 * 10000) / 10000;
}

export async function fxInfo(fetcher: typeof fetch = fetch, now = Date.now()) {
  const value = await eurToUsd(fetcher, now);
  return {
    rate: value.rate,
    customerRate: customerUsdRate(value.rate),
    markup: 0.01,
    source: value.source,
    date: value.date,
    ageMs: Math.max(0, now - value.fetchedAt),
    live: value.source === 'ecb',
    fallback: value.source === 'fallback',
  };
}

export function resetFxCache() {
  cached = null;
}
