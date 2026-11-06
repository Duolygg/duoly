// What Duoly offers, built from the same catalog that checkout prices from
// (src/server/pricing uses servicesFor from this catalog), so Sparky never quotes a stale price.
import { servicesFor } from '../../design-reference/lib/catalog.js';
import { GAMES } from '../../design-reference/lib/games.js';

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

const BUNDLE_OFF: Record<number, number> = { 3: 10, 5: 15, 10: 25 };

/** Same rounding as calculateQuote: cents, then one half-up rounding after the discount. */
export function bundleTotal(priceEur: number, units: number): number {
  const subtotal = Math.round(priceEur * 100) * units;
  return Math.round((subtotal * (100 - (BUNDLE_OFF[units] ?? 0))) / 100) / 100;
}

export function offerSummary(): string {
  if (cached) return cached;
  const lines = [
    'Duoly matches a player with a verified teammate who joins them in-game and plays together with them on the player’s own account. Duoly also fills seats for teams, offers casual sessions, Gamer Girl sessions and coaching. Nobody ever logs into the customer’s account (no account boosting or account sharing).',
    'Prices are in EUR per game or per hour (shown in each line) and can vary with the customer’s rank. USD is shown at the ECB rate plus 1%. Bundle discounts (not for coaching): 3 games = 10% off, 5 games = 15% off, 10 games = 25% off. Only quote a bundle total that appears in BUNDLE TOTALS below; otherwise give the per-game price and the discount. Coaching costs a fixed €12.99 per game or hour in every game (no first-session discount). The exact total always shows before Stripe checkout.',
    'CATALOG (game: category: service, teammate level, price from):',
  ];
  const bundles: string[] = [
    'BUNDLE TOTALS (Duo services at the base rank, before any rank surcharge):',
  ];
  for (const game of GAMES) {
    const { modes } = servicesFor(game.id) as { modes: Mode[] };
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
            `${mode.title} ${[3, 5, 10].map((n) => `${n}x ${eur(bundleTotal(mode.price, n))}`).join(', ')}`,
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
  const { modes } = servicesFor(match.id) as { modes: Mode[] };
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
            bundleTotalsEur: Object.fromEntries(
              [3, 5, 10].map((n) => [`${n}x`, bundleTotal(mode.price, n)]),
            ),
          }
        : {}),
    })),
  };
}

export const gameNames = () => GAMES.map((g) => g.name);
