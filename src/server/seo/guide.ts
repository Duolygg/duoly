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
/** One spec builder per game, so every token names its own game and server. */
const on =
  (gameId: string, server: string) =>
  (serviceId: string, units: number, rank?: string): PriceSpec => ({
    gameId,
    serviceId,
    units,
    server,
    ...(rank ? { rank } : {}),
  });
const val = on('val', 'EU');
const fn = on('fn', 'Europe');
const ow = on('ow', 'Europe');
const apex = on('apex', 'Europe');
const cod = on('cod', 'Europe');
const r6 = on('r6', 'EU West');

/**
 * Every price token the duo pages may quote in copy. Values come from the
 * checkout pricing engine, so page text and checkout cannot drift apart.
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
  valPro: val('duo2', 1, 'Gold'),
  valPro3: val('duo2', 3, 'Gold'),
  valPro5: val('duo2', 5, 'Gold'),
  valPro10: val('duo2', 10, 'Gold'),
  valProIron: val('duo2', 1, 'Iron'),
  valProImmortal: val('duo2', 1, 'Immortal'),
  valSwift: val('swift', 1),
  valUnrated: val('unrated', 1),
  valDm: val('dm', 1),
  fnPro: fn('duo2', 1, 'Platinum'),
  fnPro3: fn('duo2', 3, 'Platinum'),
  fnPro5: fn('duo2', 5, 'Platinum'),
  fnPro10: fn('duo2', 10, 'Platinum'),
  fnProGold: fn('duo2', 1, 'Gold'),
  fnProUnreal: fn('duo2', 1, 'Unreal'),
  fnZb: fn('zb', 1),
  fnReload: fn('reload', 1),
  fnBox: fn('box', 1),
  owPro: ow('duo2', 1, 'Platinum'),
  owPro3: ow('duo2', 3, 'Platinum'),
  owPro5: ow('duo2', 5, 'Platinum'),
  owPro10: ow('duo2', 10, 'Platinum'),
  owProGold: ow('duo2', 1, 'Gold'),
  owProMaster: ow('duo2', 1, 'Master'),
  owStadium: ow('stadium', 1),
  owQp: ow('qp', 1),
  apexPro: apex('duo2', 1, 'Platinum'),
  apexPro3: apex('duo2', 3, 'Platinum'),
  apexPro5: apex('duo2', 5, 'Platinum'),
  apexPro10: apex('duo2', 10, 'Platinum'),
  apexProGold: apex('duo2', 1, 'Gold'),
  apexProMaster: apex('duo2', 1, 'Master'),
  apexDuos: apex('duos', 1),
  apexMix: apex('mix', 1),
  apexPubs: apex('pubs', 1),
  codPro: cod('duo2', 1),
  codPro3: cod('duo2', 3),
  codPro5: cod('duo2', 5),
  codPro10: cod('duo2', 10),
  codRanked: cod('duo3', 1, 'Platinum'),
  codRankedIridescent: cod('duo3', 1, 'Iridescent'),
  codPlus: cod('duo1', 1, 'Platinum'),
  codRebirth: cod('rebirth', 1),
  codZombies: cod('zombies', 1),
  codParty: cod('party', 1),
  r6Pro: r6('duo2', 1, 'Gold'),
  r6Pro3: r6('duo2', 3, 'Gold'),
  r6Pro5: r6('duo2', 5, 'Gold'),
  r6Pro10: r6('duo2', 10, 'Gold'),
  r6ProCopper: r6('duo2', 1, 'Copper'),
  r6ProDiamond: r6('duo2', 1, 'Diamond'),
  r6Quick: r6('quick', 1),
  r6Arcade: r6('arcade', 1),
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
