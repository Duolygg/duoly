import { expect, it } from 'vitest';
import { creatorPricePreview } from '../../src/server/creators/preview';
import { buildCheckout } from '../../src/server/payments/checkout';
import { applyOrderDiscounts } from '../../src/server/pro/discounts';

const selection = {
  gameId: 'lol',
  serviceId: 'duo2',
  units: 3,
  bundle: true,
  server: 'EUW',
  rank: 'Platinum',
  ign: 'Preview',
  useWallet: false,
};
it.each(['EUR', 'USD'] as const)(
  'previews the exact checkout amount in %s without stacking PRO',
  (currency) => {
    for (const pro of [false, true]) {
      const built = buildCheckout(selection, 1.1);
      const checkout = applyOrderDiscounts(built, { pro, creator: true }, 10);
      const preview = creatorPricePreview(selection, pro, 1.1, currency);
      expect(preview.amountEurMinor).toBe(checkout.row.amount_eur_cents);
      expect(built.row.amount_eur_cents).toBe(1752);
      expect(preview.amountEurMinor).toBe(1577);
      const rate = currency === 'USD' ? 1.111 : 1;
      expect(preview.amountMinor).toBe(
        Math.round(checkout.row.amount_eur_cents * rate),
      );
      expect(preview.originalMinor - preview.amountMinor).toBe(
        preview.discountMinor,
      );
      expect(preview.discountKind).toBe(checkout.discountKind);
    }
  },
);
