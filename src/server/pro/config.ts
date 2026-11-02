import { paymentsConfig } from '../payments/config';

/**
 * Duoly PRO (ledger #39, MONEY-RULES section 7). Owner approved all defaults on 2026-10-27.
 * Server-only: never import from browser code.
 */
/** €9.99 a month, or $9.99 for customers who use USD (owner 2026-11-02). */
export const PRO_MONTHLY_CENTS = 999;
export const PRO_TRIAL_DAYS = 7;
export const PRO_DISCOUNT_PERCENT = 10;
/** R6: perks continue this many days after a renewal payment fails. Mirrors is_pro(). */
export const PRO_GRACE_DAYS = 3;
/** The Stripe Price is found by lookup key (scripts/stripe/setup-pro.mjs creates it). */
export const PRO_PRICE_LOOKUP_KEY = 'duoly_pro_monthly';
/** Marks our subscriptions and sessions so other Stripe objects are never mistaken for PRO. */
export const PRO_METADATA_KIND = 'duoly_pro';

const env = (name: string): string | undefined => {
  const value: unknown = process.env[name] ?? import.meta.env?.[name];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
};

/** Off unless PRO_ENABLED is exactly 'true' and payments are configured, so PRO ships dark. */
export function proEnabled(): boolean {
  if (env('PRO_ENABLED') !== 'true') return false;
  return paymentsConfig() !== null;
}

/** Optional Customer Portal configuration (bpc_...); the account default is used otherwise. */
export function proPortalConfiguration(): string | undefined {
  const id = env('STRIPE_PRO_PORTAL_CONFIG');
  return id && /^bpc_[A-Za-z0-9]+$/.test(id) ? id : undefined;
}
