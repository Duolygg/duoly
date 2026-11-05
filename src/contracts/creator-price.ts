export interface CreatorPricePreview {
  currency: 'EUR' | 'USD';
  originalMinor: number;
  amountMinor: number;
  discountMinor: number;
  amountEurMinor: number;
  discountKind: 'none' | 'creator' | 'pro';
}
