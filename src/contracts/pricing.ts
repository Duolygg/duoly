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
