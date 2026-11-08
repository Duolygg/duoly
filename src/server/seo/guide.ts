import type { QuoteContext } from '../../contracts/pricing';
import { calculateQuote } from '../pricing';
import { formatPrice } from './offers';

type PriceSpec = {
  gameId: string;
  serviceId: string;
  units: number;
  server: string;
  rank?: string;
};

const lol = (serviceId: string, units: number, rank?: string): PriceSpec => ({
  gameId: 'lol',
  serviceId,
  units,
  server: 'EUW',
  ...(rank ? { rank } : {}),
});
const mr = (serviceId: string, units: number, rank?: string): PriceSpec => ({
  gameId: 'mr',
  serviceId,
  units,
  server: 'Europe',
  ...(rank ? { rank } : {}),
});

/**
 * Every price token the League and Marvel Rivals duo pages may quote in copy.
 * Values come from the checkout pricing engine, so page text and checkout
 * cannot drift apart.
 */
export const GUIDE_PRICE_SPECS: Record<string, PriceSpec> = {
  puPro: {
    gameId: 'pu',
    serviceId: 'duo2',
    units: 1,
    server: 'Europe',
    rank: 'Expert',
  },
  puPlus: {
    gameId: 'pu',
    serviceId: 'duo1',
    units: 1,
    server: 'Europe',
    rank: 'Expert',
  },
  puQuick: { gameId: 'pu', serviceId: 'quick', units: 1, server: 'Europe' },
  puPro3: {
    gameId: 'pu',
    serviceId: 'duo2',
    units: 3,
    server: 'Europe',
    rank: 'Expert',
  },
  lolPro: lol('duo2', 1, 'Gold'),
  lolPro3: lol('duo2', 3, 'Gold'),
  lolPro5: lol('duo2', 5, 'Gold'),
  lolPro10: lol('duo2', 10, 'Gold'),
  lolProIron: lol('duo2', 1, 'Iron'),
  lolProDiamond: lol('duo2', 1, 'Diamond'),
  lolPlus: lol('duo1', 1, 'Gold'),
  lolAram: lol('aram', 1),
  lolAram3: lol('aram', 3),
  mrPro: mr('duo2', 1, 'Platinum'),
  mrPro3: mr('duo2', 3, 'Platinum'),
  mrPro5: mr('duo2', 5, 'Platinum'),
  mrPro10: mr('duo2', 10, 'Platinum'),
  mrProGold: mr('duo2', 1, 'Gold'),
  mrPlus: mr('duo1', 1, 'Platinum'),
  mrQuick: mr('quick', 1),
  mrQuick3: mr('quick', 3),
  mrTeamup: mr('teamup', 1),
  mrTeamup3: mr('teamup', 3),
};

/** Bundle sizes whose quantity discount the copy names as a percentage. */
export const GUIDE_DISCOUNT_UNITS = [3, 5, 10] as const;

/**
 * Price tokens for guide copy. Always EUR so the indexed text is stable; the
 * price cards on the same page already localize for the visitor.
 */
export function guideExamples(
  context: Omit<QuoteContext, 'customerCurrency'>,
): Record<string, string> {
  const eur = { ...context, customerCurrency: 'EUR' as const };
  const prices: Record<string, string> = {};
  for (const [token, spec] of Object.entries(GUIDE_PRICE_SPECS)) {
    prices[token] = formatPrice(
      calculateQuote(spec, eur).customer.amountMinor,
      'EUR',
    );
  }
  for (const units of GUIDE_DISCOUNT_UNITS) {
    const quote = calculateQuote({ ...GUIDE_PRICE_SPECS.lolPro!, units }, eur);
    prices[`pct${units}`] = `${quote.quantityDiscountPercent}%`;
  }
  return prices;
}
