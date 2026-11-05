import {
  buildCheckout,
  CREATOR_FIRST_ORDER_PERCENT,
  type CheckoutRequest,
} from '../payments/checkout';
import { applyOrderDiscounts } from '../pro/discounts';
import type { CreatorPricePreview } from '../../contracts/creator-price';

/** Read-only preview using the exact checkout pricing and discount functions. */
export function creatorPricePreview(
  selection: CheckoutRequest,
  pro: boolean,
  rate: number,
  currency: 'EUR' | 'USD',
): CreatorPricePreview {
  const built = buildCheckout(selection, rate);
  const priced = applyOrderDiscounts(
    built,
    { pro, creator: true },
    CREATOR_FIRST_ORDER_PERCENT,
  );
  const fx = currency === 'USD' ? Math.round(rate * 1.01 * 10000) / 10000 : 1;
  const originalMinor = Math.round(built.row.amount_eur_cents * fx);
  const amountMinor = Math.round(priced.row.amount_eur_cents * fx);
  return {
    currency,
    originalMinor,
    amountMinor,
    discountMinor: originalMinor - amountMinor,
    amountEurMinor: priced.row.amount_eur_cents,
    discountKind: priced.discountKind,
  };
}
