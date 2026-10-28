import { paymentsConfig, type PaymentsConfig } from '../payments/config';

/**
 * Stripe Connect Express payouts (ledger #14, MONEY-RULES 6.3 "Rail, phase 2", money step M9).
 * Server-only: never import from browser code.
 */

const env = (name: string): string | undefined => {
  const value: unknown = process.env[name] ?? import.meta.env?.[name];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
};

/**
 * Countries a platform in Austria can pay with Connect cross-border payouts: EEA, UK,
 * Switzerland, US and Canada (Stripe docs, "Connect cross-border payouts", Availability).
 * Everyone else stays on the manual rail.
 */
export const CONNECT_COUNTRIES: Readonly<Record<string, string>> = {
  AT: 'Austria',
  BE: 'Belgium',
  BG: 'Bulgaria',
  CA: 'Canada',
  CH: 'Switzerland',
  CY: 'Cyprus',
  CZ: 'Czechia',
  DE: 'Germany',
  DK: 'Denmark',
  EE: 'Estonia',
  ES: 'Spain',
  FI: 'Finland',
  FR: 'France',
  GB: 'United Kingdom',
  GR: 'Greece',
  HR: 'Croatia',
  HU: 'Hungary',
  IE: 'Ireland',
  IS: 'Iceland',
  IT: 'Italy',
  LI: 'Liechtenstein',
  LT: 'Lithuania',
  LU: 'Luxembourg',
  LV: 'Latvia',
  MT: 'Malta',
  NL: 'Netherlands',
  NO: 'Norway',
  PL: 'Poland',
  PT: 'Portugal',
  RO: 'Romania',
  SE: 'Sweden',
  SI: 'Slovenia',
  SK: 'Slovakia',
  US: 'United States',
};

export type TransferCurrency = 'eur' | 'usd';

export interface ConnectConfig extends PaymentsConfig {
  transferCurrency: TransferCurrency;
}

/**
 * Off unless CONNECT_PAYOUTS_ENABLED is exactly 'true' and payments are configured. Test keys
 * only for now: live Connect payouts need the owner's go-ahead and a code change here.
 */
export function connectConfig(): ConnectConfig | null {
  if (env('CONNECT_PAYOUTS_ENABLED') !== 'true') return null;
  const config = paymentsConfig();
  if (!config || !/^(sk|rk)_test_/.test(config.secretKey)) return null;
  // EUR from the platform balance by default (the platform settles in EUR). USD only when the
  // owner has a USD balance on the platform (multi-currency settlement), see connect-payouts.md.
  const transferCurrency: TransferCurrency =
    env('CONNECT_TRANSFER_CURRENCY') === 'usd' ? 'usd' : 'eur';
  return { ...config, transferCurrency };
}

export function connectEnabled(): boolean {
  return connectConfig() !== null;
}

/** Signing secret of the separate Connect webhook endpoint (/api/webhooks/stripe-connect). */
export function connectWebhookSecret(): string | undefined {
  return env('STRIPE_CONNECT_WEBHOOK_SECRET');
}
