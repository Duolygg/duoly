// What Duoly offers, built from the same catalog that checkout prices from
// (src/server/pricing uses servicesFor from this catalog), so Sparky never quotes a stale price.
import { servicesFor } from '../../design-reference/lib/catalog.js';
import { GAMES } from '../../design-reference/lib/games.js';
import { BUNDLE_UNITS, quantityDiscountPercent } from '../../contracts/pricing';

type Mode = {
  id: string;
  cat: string;
  title: string;
  tier: string;
  price: number;
  unit: 'game' | 'hour';
  was?: number;
};

const TABS: Record<string, string> = {
  duo: 'Duo',
  other: 'Teams',
  social: 'Just for fun',
  gg: 'Gamer Girls',
  training: 'Coaching',
};

const eur = (n: number) => `€${n.toFixed(2)}`;

let cached: string | null = null;

/**
 * Same rounding as calculateQuote: cents, then one half-up rounding after the discount. A Bundles
 * tab pack when `bundle` is set, else the quantity picker (20% off at 5, src/contracts/pricing.ts).
 */
export function bundleTotal(
  priceEur: number,
  units: number,
  bundle = true,
): number {
  const subtotal = Math.round(priceEur * 100) * units;
  const off = quantityDiscountPercent(units, { bundle });
  return Math.round((subtotal * (100 - off)) / 100) / 100;
}

export function offerSummary(): string {
  if (cached) return cached;
  const lines = [
    'Duoly matches a player with a verified teammate who joins them in-game and plays together with them on the player’s own account. Duoly also fills seats for teams, offers casual sessions, Gamer Girl sessions and coaching. Nobody ever logs into the customer’s account (no account boosting or account sharing).',
    'Prices are in EUR per game or per hour (shown in each line) and can vary with the customer’s rank. USD is shown at the ECB rate plus 1%. Quantity (not for coaching): customers pick 1 to 5 games or hours, and 5 gets 20% off; 1 to 4 have no discount. Separately, the Bundles tab sells the game’s main service (Duo Pro in most games) in packs of 3 games = 10% off, 5 games = 20% off and 10 games = 25% off. Only quote a total that appears in BUNDLE TOTALS below; otherwise give the per-game price and the discount. Coaching costs a fixed €12.99 per game or hour in every game (no first-session discount). The exact total always shows before Stripe checkout.',
    'CATALOG (game: category: service, teammate level, price from):',
  ];
  const bundles: string[] = [
    'BUNDLE TOTALS (Duo services at the base rank, before any rank surcharge; "5x" is the quantity picker, "bundle" the Bundles tab):',
  ];
  for (const game of GAMES) {
    const { modes, main } = servicesFor(game.id) as {
      modes: Mode[];
      main: string;
    };
    if (!modes.length) continue;
    const byTab = new Map<string, string[]>();
    for (const mode of modes) {
      const tab = TABS[mode.cat] ?? mode.cat;
      const price =
        mode.was && mode.was > mode.price
          ? `${eur(mode.price)} first session, then ${eur(mode.was)}`
          : eur(mode.price);
      const entry = `${mode.title} (${mode.tier}) ${price}/${mode.unit}`;
      byTab.set(tab, [...(byTab.get(tab) ?? []), entry]);
    }
    bundles.push(
      `${game.name}: ${modes
        .filter((mode) => mode.cat === 'duo')
        .map(
          (mode) =>
            `${mode.title} 5x ${eur(bundleTotal(mode.price, 5, false))}${mode.id === main ? `, bundle ${BUNDLE_UNITS.map((n) => `${n}x ${eur(bundleTotal(mode.price, n))}`).join(', ')}` : ''}`,
        )
        .join('; ')}`,
    );
    lines.push(
      `${game.name}: ${[...byTab].map(([tab, list]) => `${tab}: ${list.join('; ')}`).join(' | ')}`,
    );
  }
  cached = [...lines, ...bundles].join('\n');
  return cached;
}

export type CatalogEntry = {
  category: string;
  service: string;
  teammate: string;
  priceFromEur: number;
  per: 'game' | 'hour';
  laterSessionsEur?: number;
  bundleTotalsEur?: Record<string, number>;
};

/** One game's services from the checkout catalog, by game id or name. */
export function catalogFor(
  game: string,
): { game: string; services: CatalogEntry[] } | null {
  const wanted = game.trim().toLowerCase();
  const match = GAMES.find(
    (g) =>
      g.id === wanted ||
      g.name.toLowerCase() === wanted ||
      g.short.toLowerCase() === wanted ||
      (g as { alias?: string }).alias?.toLowerCase() === wanted,
  );
  if (!match) return null;
  const { modes, main } = servicesFor(match.id) as {
    modes: Mode[];
    main: string;
  };
  return {
    game: match.name,
    services: modes.map((mode) => ({
      category: TABS[mode.cat] ?? mode.cat,
      service: mode.title,
      teammate: mode.tier,
      priceFromEur: mode.price,
      per: mode.unit,
      ...(mode.was && mode.was > mode.price
        ? { laterSessionsEur: mode.was }
        : {}),
      ...(mode.cat === 'duo'
        ? {
            // the quantity picker's 5 (20% off), plus the Bundles tab packs on the main service
            bundleTotalsEur: {
              '5x': bundleTotal(mode.price, 5, false),
              ...(mode.id === main
                ? Object.fromEntries(
                    BUNDLE_UNITS.map((n) => [
                      `bundle ${n}x`,
                      bundleTotal(mode.price, n),
                    ]),
                  )
                : {}),
            },
          }
        : {}),
    })),
  };
}

export const gameNames = () => GAMES.map((g) => g.name);
