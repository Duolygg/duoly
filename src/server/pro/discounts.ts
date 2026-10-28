import { PRO_DISCOUNT_PERCENT } from './config';

/** Smallest order price we ever charge (Stripe minimum plus our 0.99 EUR order floor). */
const MIN_ORDER_CENTS = 99;

/** Pure: percent of a cent amount, rounded, never taking the price below 0.99 EUR. */
export function percentOff(amountCents: number, percent: number): number {
  return Math.min(
    Math.round((amountCents * percent) / 100),
    Math.max(0, amountCents - MIN_ORDER_CENTS),
  );
}

export type OrderDiscountKind = 'none' | 'creator' | 'pro';

/**
 * Pure: the one discount an order gets (docs/product/pro.md, "Discount stacking").
 *
 * - Both discounts are taken from the server price after bundle discounts, before the wallet
 *   split (the wallet then pays from the discounted amount).
 * - MONEY-RULES is silent on combining the PRO discount with the creator first-order discount,
 *   so they never stack: only the larger applies, and a tie goes to PRO.
 * - Duoly covers either discount: payout_usd_cents is left untouched (R3).
 */
export function applyOrderDiscounts<
  T extends { row: { amount_eur_cents: number } },
>(
  built: T,
  eligible: { pro: boolean; creator: boolean },
  creatorPercent: number,
) {
  const amount = built.row.amount_eur_cents;
  const pro = eligible.pro ? percentOff(amount, PRO_DISCOUNT_PERCENT) : 0;
  const creator = eligible.creator ? percentOff(amount, creatorPercent) : 0;
  const kind: OrderDiscountKind =
    pro === 0 && creator === 0 ? 'none' : pro >= creator ? 'pro' : 'creator';
  const discount = kind === 'pro' ? pro : kind === 'creator' ? creator : 0;
  return {
    ...built,
    row: {
      ...built.row,
      amount_eur_cents: amount - discount,
      first_order_discount_cents: kind === 'creator' ? creator : 0,
      // Only sent when used, so the insert never names a column an older schema lacks.
      ...(kind === 'pro' ? { pro_discount_cents: pro } : {}),
    } as T['row'] & {
      first_order_discount_cents: number;
      pro_discount_cents?: number;
    },
    discountCents: discount,
    discountKind: kind,
  };
}
