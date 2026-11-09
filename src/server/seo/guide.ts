import {
  quantityDiscountPercent,
  type QuoteContext,
} from '../../contracts/pricing';
import { servicesFor } from '../../design-reference/lib/catalog.js';
import { calculateQuote } from '../pricing';
import { formatPrice } from './offers';

type PriceSpec = {
  gameId: string;
  serviceId: string;
  units: number;
  server: string;
  rank?: string;
  /** Minecraft has no regions: the quote needs a server name and an edition. */
  edition?: 'Java' | 'Bedrock';
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
const cs2 = on('cs2', 'EU West');
const rl = on('rl', 'Europe');
const wow = on('wow', 'EU');
const arc = on('arc', 'Europe');
const dl = on('dl', 'Europe');
/** Minecraft prices are flat, and every quote names a server and an edition. */
const mc = (serviceId: string, units: number): PriceSpec => ({
  gameId: 'mc',
  serviceId,
  units,
  server: 'Hypixel',
  edition: 'Java',
});

/**
 * Every price token the duo pages may quote in copy. Values come from the
 * checkout pricing engine, so page text and checkout cannot drift apart.
 */
/**
 * A multi-unit token on the game's main service is a Bundles tab pack (Duo Pro x3 is "3 games with
 * the bundle discount"); on any other service it is a quantity picker count.
 */
const asSold = (spec: PriceSpec) =>
  spec.units > 1 &&
  spec.serviceId === (servicesFor(spec.gameId) as { main: string }).main
    ? { ...spec, bundle: true as const }
    : spec;

const SPECS: Record<string, PriceSpec> = {
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
  valPlus: val('duo1', 1, 'Gold'),
  valTop: val('duo3', 1, 'Gold'),
  valPro3: val('duo2', 3, 'Gold'),
  valPro5: val('duo2', 5, 'Gold'),
  valPro10: val('duo2', 10, 'Gold'),
  valProIron: val('duo2', 1, 'Iron'),
  valProImmortal: val('duo2', 1, 'Immortal'),
  valSwift: val('swift', 1),
  valUnrated: val('unrated', 1),
  valDm: val('dm', 1),
  fnPro: fn('duo2', 1, 'Platinum'),
  fnPlus: fn('duo1', 1, 'Platinum'),
  fnPro3: fn('duo2', 3, 'Platinum'),
  fnPro5: fn('duo2', 5, 'Platinum'),
  fnPro10: fn('duo2', 10, 'Platinum'),
  fnProGold: fn('duo2', 1, 'Gold'),
  fnProUnreal: fn('duo2', 1, 'Unreal'),
  fnZb: fn('zb', 1),
  fnReload: fn('reload', 1),
  fnBox: fn('box', 1),
  owPro: ow('duo2', 1, 'Platinum'),
  owPlus: ow('duo1', 1, 'Platinum'),
  owTop: ow('duo3', 1, 'Platinum'),
  owPro3: ow('duo2', 3, 'Platinum'),
  owPro5: ow('duo2', 5, 'Platinum'),
  owPro10: ow('duo2', 10, 'Platinum'),
  owProGold: ow('duo2', 1, 'Gold'),
  owProMaster: ow('duo2', 1, 'Master'),
  owStadium: ow('stadium', 1),
  owQp: ow('qp', 1),
  apexPro: apex('duo2', 1, 'Platinum'),
  apexPlus: apex('duo1', 1, 'Platinum'),
  apexPro3: apex('duo2', 3, 'Platinum'),
  apexPro5: apex('duo2', 5, 'Platinum'),
  apexPro10: apex('duo2', 10, 'Platinum'),
  apexProGold: apex('duo2', 1, 'Gold'),
  apexProMaster: apex('duo2', 1, 'Master'),
  apexDuos: apex('duos', 1),
  apexMix: apex('mix', 1),
  apexPubs: apex('pubs', 1),
  codPro: cod('duo2', 1, 'Diamond'),
  codPro3: cod('duo2', 3, 'Diamond'),
  codPro5: cod('duo2', 5, 'Diamond'),
  codPro10: cod('duo2', 10, 'Diamond'),
  codRanked: cod('duo3', 1, 'Platinum'),
  codRankedIridescent: cod('duo3', 1, 'Iridescent'),
  codPlus: cod('duo1', 1, 'Platinum'),
  codRebirth: cod('rebirth', 1),
  codZombies: cod('zombies', 1),
  codParty: cod('party', 1),
  r6Pro: r6('duo2', 1, 'Gold'),
  r6Plus: r6('duo1', 1, 'Gold'),
  r6Top: r6('duo3', 1, 'Gold'),
  r6Pro3: r6('duo2', 3, 'Gold'),
  r6Pro5: r6('duo2', 5, 'Gold'),
  r6Pro10: r6('duo2', 10, 'Gold'),
  r6ProCopper: r6('duo2', 1, 'Copper'),
  r6ProDiamond: r6('duo2', 1, 'Diamond'),
  r6Quick: r6('quick', 1),
  r6Arcade: r6('arcade', 1),
  // Counter-Strike 2: Premier rating on the duo tiers, FACEIT levels on FACEIT
  // Duo and the classic skill groups on Wingman (lib/ranks.js).
  cs2Pro: cs2('duo2', 1, 'Premier 10,000–14,999'),
  cs2Pro3: cs2('duo2', 3, 'Premier 10,000–14,999'),
  cs2Pro5: cs2('duo2', 5, 'Premier 10,000–14,999'),
  cs2Pro10: cs2('duo2', 10, 'Premier 10,000–14,999'),
  cs2Plus: cs2('duo1', 1, 'Premier 10,000–14,999'),
  cs2ProLow: cs2('duo2', 1, 'Premier 0–4,999'),
  cs2ProHigh: cs2('duo2', 1, 'Premier 25,000+'),
  cs2Faceit: cs2('duo3', 1, 'FACEIT Level 6'),
  cs2Wing: cs2('wing', 1, 'Master Guardian'),
  cs2Casual: cs2('casual', 1),
  cs2Retake: cs2('retake', 1),
  rlPro: rl('duo2', 1, 'Diamond'),
  rlPro3: rl('duo2', 3, 'Diamond'),
  rlPro5: rl('duo2', 5, 'Diamond'),
  rlPro10: rl('duo2', 10, 'Diamond'),
  rlPlus: rl('duo1', 1, 'Diamond'),
  rlTop: rl('duo3', 1, 'Diamond'),
  rlProGold: rl('duo2', 1, 'Gold'),
  rlProGc: rl('duo2', 1, 'Grand Champion'),
  rlCasual: rl('casual', 1),
  rlExtra: rl('extra', 1),
  // World of Warcraft has no single ladder: Mythic+ score on the key services,
  // rated arena on Arena 2v2 (SERVICE_RANKS in lib/ranks.js).
  wowPro: wow('duo2', 1, 'Mythic+ 2,000–2,499'),
  wowPro3: wow('duo2', 3, 'Mythic+ 2,000–2,499'),
  wowPro5: wow('duo2', 5, 'Mythic+ 2,000–2,499'),
  wowPro10: wow('duo2', 10, 'Mythic+ 2,000–2,499'),
  wowPlus: wow('duo1', 1, 'Mythic+ 2,000–2,499'),
  wowProLow: wow('duo2', 1, 'Mythic+ under 1,500'),
  wowProHigh: wow('duo2', 1, 'Mythic+ 3,500+'),
  wowArena: wow('arena', 1, 'Challenger 1,600+'),
  wowDelves: wow('delves', 1),
  wowLevel: wow('level', 1),
  arcPro: arc('duo2', 1),
  arcPro3: arc('duo2', 3),
  arcPro5: arc('duo2', 5),
  arcPro10: arc('duo2', 10),
  arcPlus: arc('duo1', 1),
  arcTop: arc('duo3', 1),
  arcLearn: arc('learn', 1),
  mcPro: mc('duo2', 1),
  mcPro3: mc('duo2', 3),
  mcPro5: mc('duo2', 5),
  mcPro10: mc('duo2', 10),
  mcPlus: mc('duo1', 1),
  mcSmp: mc('smp', 1),
  mcSurv: mc('surv', 1),
  mcDragon: mc('dragon', 1),
  mcMini: mc('mini', 1),
  dlPro: dl('duo2', 1, 'Emissary'),
  dlPro3: dl('duo2', 3, 'Emissary'),
  dlPro5: dl('duo2', 5, 'Emissary'),
  dlPro10: dl('duo2', 10, 'Emissary'),
  dlPlus: dl('duo1', 1, 'Emissary'),
  dlTop: dl('duo3', 1, 'Emissary'),
  dlProLow: dl('duo2', 1, 'Initiate'),
  dlProHigh: dl('duo2', 1, 'Eternus'),
  dlUnranked: dl('unranked', 1),
};

export const GUIDE_PRICE_SPECS: Record<string, PriceSpec & { bundle?: true }> =
  Object.fromEntries(
    Object.entries(SPECS).map(([token, spec]) => [token, asSold(spec)]),
  );

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
  // The Bundles tab discounts, and the quantity picker's 5-unit one (src/contracts/pricing.ts).
  for (const units of GUIDE_DISCOUNT_UNITS)
    prices[`pct${units}`] =
      `${quantityDiscountPercent(units, { bundle: true })}%`;
  prices.pick5 = `${quantityDiscountPercent(5)}%`;
  return prices;
}
