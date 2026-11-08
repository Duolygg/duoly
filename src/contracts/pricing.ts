/**
 * How many games or hours a customer can book, and what that saves (owner decision 2026-11-08).
 *
 * - The quantity picker offers 1 to 5, and only 5 gets a discount (20%), so 5 is the obvious pick.
 * - The Bundles tab is separate and unchanged: the game's main service in packs of 3, 5 or 10 at
 *   10%, 20% and 25% off (5 matches the picker's 20%). A bundle is always one teammate.
 * - Coaching never gets a quantity discount.
 */
export const QUANTITIES = [1, 2, 3, 4, 5] as const;
export const QUANTITY_DISCOUNT_PERCENT: Readonly<Record<number, number>> = {
  5: 20,
};
export const BUNDLE_UNITS = [3, 5, 10] as const;
export const BUNDLE_DISCOUNT_PERCENT: Readonly<Record<number, number>> = {
  3: 10,
  5: 20,
  10: 25,
};

/** The discount in percent for a booking of `units`, 0 when there is none. */
export function quantityDiscountPercent(
  units: number,
  options: { bundle?: boolean; training?: boolean } = {},
): number {
  if (options.training) return 0;
  return (
    (options.bundle ? BUNDLE_DISCOUNT_PERCENT : QUANTITY_DISCOUNT_PERCENT)[
      units
    ] ?? 0
  );
}

/** Selection only: no client-supplied prices, currencies, FX or eligibility. */
export interface QuoteInput {
  readonly gameId: string;
  readonly serviceId: string;
  readonly units: number;
  readonly server: string;
  readonly rank?: string;
  readonly edition?: 'Java' | 'Bedrock';
  readonly ign?: string;
  /** Teammates on the order (team orders, src/contracts/seats.ts). Left out means one. */
  readonly seats?: number;
  /** A Bundles tab pack: the game's main service, 3, 5 or 10 units, one teammate. */
  readonly bundle?: boolean;
}

/** Supplied by server code, NEVER copied from a request body. */
export interface QuoteContext {
  readonly eurToUsd: number;
  readonly customerCurrency?: 'EUR' | 'USD';
  readonly firstCoachingSessionEligible?: boolean;
}

/** Read-only estimate, not a payment authorization or an order. All money is minor units. */
export interface QuotePreview {
  readonly kind: 'preview';
  readonly selection: Readonly<QuoteInput>;
  readonly unit: 'game' | 'hour';
  /** Teammates on the order; 1 for every single-teammate service. */
  readonly seats: number;
  /** One unit for the whole booking: per-seat price × seats, or the group price. */
  readonly unitPriceEurMinor: number;
  readonly subtotalEurMinor: number;
  readonly quantityDiscountPercent: number;
  readonly discountEurMinor: number;
  readonly firstSessionDiscountEurMinor: number;
  readonly amountEurMinor: number;
  readonly customer: Readonly<{ currency: 'EUR' | 'USD'; amountMinor: number }>;
  /** What each teammate earns (60% of one seat's share). */
  readonly teammate: Readonly<{ currency: 'USD'; amountMinor: number }>;
  readonly fx: Readonly<{ eurToUsd: number; customerUsdRate: number }>;
}
