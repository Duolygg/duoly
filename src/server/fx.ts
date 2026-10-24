/**
 * EUR→USD reference rate from the European Central Bank (published once per
 * working day). Cached per server instance; falls back to a recent rate when
 * the ECB can't be reached so booking never blocks on it.
 */
export const FALLBACK_EUR_TO_USD = 1.08;
const ECB_DAILY =
  'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml';
const TTL_MS = 6 * 60 * 60 * 1000;

let cached: { rate: number; at: number; source: 'ecb' | 'fallback' } | null =
  null;

/** Pure: reads the USD rate out of the ECB daily XML. */
export function parseEcbUsd(xml: string): number | null {
  const match = /currency=['"]USD['"]\s+rate=['"]([0-9.]+)['"]/.exec(xml);
  const rate = match ? Number(match[1]) : NaN;
  return Number.isFinite(rate) && rate > 0.5 && rate < 2 ? rate : null;
}

export async function eurToUsd(
  fetcher: typeof fetch = fetch,
  now = Date.now(),
): Promise<{ rate: number; source: 'ecb' | 'fallback' }> {
  if (cached && now - cached.at < TTL_MS)
    return { rate: cached.rate, source: cached.source };
  try {
    const response = await fetcher(ECB_DAILY, {
      signal: AbortSignal.timeout(2500),
    });
    const rate = response.ok ? parseEcbUsd(await response.text()) : null;
    if (rate) {
      cached = { rate, at: now, source: 'ecb' };
      return { rate, source: 'ecb' };
    }
  } catch {
    /* fall through */
  }
  // Retry sooner than a successful fetch.
  cached = {
    rate: FALLBACK_EUR_TO_USD,
    at: now - TTL_MS + 10 * 60 * 1000,
    source: 'fallback',
  };
  return { rate: FALLBACK_EUR_TO_USD, source: 'fallback' };
}

/**
 * What a USD customer pays per EUR 1 (original lib/fx.js customerUsdRate):
 * mid rate plus the 1% currency margin, rounded to four decimals. Same formula
 * as the server quote in src/server/pricing.
 */
export function customerUsdRate(eurToUsdRate: number): number {
  return Math.round(eurToUsdRate * 1.01 * 10000) / 10000;
}

export function resetFxCache() {
  cached = null;
}
