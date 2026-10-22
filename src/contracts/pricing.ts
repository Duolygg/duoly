/** Selection only: no client-supplied prices, currencies, FX or eligibility. */
export interface QuoteInput {
  readonly gameId: string;
  readonly serviceId: string;
  readonly units: number;
  readonly server: string;
  readonly rank?: string;
  readonly edition?: 'Java' | 'Bedrock';
  readonly ign?: string;
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
  readonly unitPriceEurMinor: number;
  readonly subtotalEurMinor: number;
  readonly quantityDiscountPercent: number;
  readonly discountEurMinor: number;
  readonly firstSessionDiscountEurMinor: number;
  readonly amountEurMinor: number;
  readonly customer: Readonly<{ currency: 'EUR' | 'USD'; amountMinor: number }>;
  readonly teammate: Readonly<{ currency: 'USD'; amountMinor: number }>;
  readonly fx: Readonly<{ eurToUsd: number; customerUsdRate: number }>;
}
