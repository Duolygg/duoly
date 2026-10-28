/** Stripe's minimum EUR charge. */
export const STRIPE_MINIMUM_EUR_CENTS = 50;

/**
 * Split a server-priced EUR total. The wallet pays first. When it cannot cover
 * the whole order, leave at least Stripe's minimum for the card.
 */
export function walletSplit(total: number, available: number) {
  const safeTotal = Number.isInteger(total) && total > 0 ? total : 0;
  const safeAvailable =
    Number.isInteger(available) && available > 0 ? available : 0;
  const wallet =
    safeAvailable >= safeTotal
      ? safeTotal
      : safeTotal - safeAvailable >= STRIPE_MINIMUM_EUR_CENTS
        ? safeAvailable
        : Math.max(0, safeTotal - STRIPE_MINIMUM_EUR_CENTS);
  return { wallet, card: safeTotal - wallet };
}
