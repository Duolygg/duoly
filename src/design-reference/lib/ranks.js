// Rank-based prices. The customer's rank changes the price only where it really matters: ranked play.
//
// RANKS[game] = [rank, price multiplier]. The multiplier is applied to the service's catalog price
// (lib/catalog.js), so the rank marked 1 pays exactly the listed price: lower ranks pay less, higher
// ranks pay more (higher lobbies are harder and need the best teammates). Prices are rounded to .49/.99.
// Games without a real ranked ladder (ARC Raiders, Minecraft) have no entry: no rank picker, flat price.
//
// SERVICE_RANKS[game][service] = a mode with its own ladder, used instead of the game's (League Arena
// has Wood → Gladiator, CS2 Wingman uses the classic skill groups and CS2 FACEIT services use FACEIT
// Levels 1–10 instead of Premier rating).
//
// RANKED[game] = the services (catalog ids) that ask for the rank and use these prices: ranked duos,
// ranked team fills and the ranked side modes above. Everything else is a flat price, because the rank
// doesn't change the work: coaching, Gamer Girls, social / casual modes, unranked side modes,
// tournaments and Clash/Premier rosters.
// Any rank can book any service: someone on a budget can pick a cheaper tier than their rank.
export const RANKS = {
  // launch pricing: gentle steps, lowest rank ×0.8, top rank at most ×1.6
  lol: [['Iron', 0.8], ['Bronze', 0.85], ['Silver', 0.9], ['Gold', 0.95], ['Platinum', 1], ['Emerald', 1.05], ['Diamond', 1.15], ['Master', 1.3], ['Grandmaster', 1.45], ['Challenger', 1.6]],
  tft: [['Iron', 0.8], ['Bronze', 0.85], ['Silver', 0.9], ['Gold', 0.95], ['Platinum', 1], ['Emerald', 1.05], ['Diamond', 1.15], ['Master', 1.3], ['Grandmaster', 1.45], ['Challenger', 1.6]],
  val: [['Iron', 0.8], ['Bronze', 0.85], ['Silver', 0.9], ['Gold', 0.95], ['Platinum', 1], ['Diamond', 1.1], ['Ascendant', 1.2], ['Immortal', 1.4], ['Radiant', 1.6]],
  cs2: [['Premier 0–4,999', 0.8], ['Premier 5,000–9,999', 0.9], ['Premier 10,000–14,999', 1], ['Premier 15,000–19,999', 1.1], ['Premier 20,000–24,999', 1.3], ['Premier 25,000+', 1.5]],
  fn: [['Bronze', 0.8], ['Silver', 0.85], ['Gold', 0.9], ['Platinum', 0.95], ['Diamond', 1], ['Elite', 1.1], ['Champion', 1.25], ['Unreal', 1.45]],
  cod: [['Bronze', 0.8], ['Silver', 0.85], ['Gold', 0.9], ['Platinum', 0.95], ['Diamond', 1], ['Crimson', 1.15], ['Iridescent', 1.35], ['Top 250', 1.6]],
  apex: [['Rookie', 0.8], ['Bronze', 0.85], ['Silver', 0.9], ['Gold', 0.95], ['Platinum', 1], ['Diamond', 1.1], ['Master', 1.3], ['Apex Predator', 1.6]],
  r6: [['Copper', 0.8], ['Bronze', 0.85], ['Silver', 0.9], ['Gold', 0.95], ['Platinum', 1], ['Emerald', 1.05], ['Diamond', 1.2], ['Champion', 1.45]],
  mr: [['Bronze', 0.8], ['Silver', 0.85], ['Gold', 0.9], ['Platinum', 1], ['Diamond', 1.05], ['Grandmaster', 1.15], ['Celestial', 1.3], ['Eternity', 1.45], ['One Above All', 1.6]],
  ow: [['Bronze', 0.8], ['Silver', 0.85], ['Gold', 0.9], ['Platinum', 1], ['Diamond', 1.05], ['Master', 1.15], ['Grandmaster', 1.3], ['Champion', 1.45], ['Top 500', 1.6]],
  rl: [['Bronze', 0.8], ['Silver', 0.85], ['Gold', 0.9], ['Platinum', 0.95], ['Diamond', 1], ['Champion', 1.1], ['Grand Champion', 1.3], ['Supersonic Legend', 1.5]],
  fc: [['Division 10', 0.8], ['Division 8', 0.85], ['Division 6', 0.9], ['Division 4', 0.95], ['Division 3', 0.95], ['Division 2', 1], ['Division 1', 1.1], ['Elite', 1.25]],
  pu: [['Beginner', 0.8], ['Great', 0.85], ['Expert', 0.9], ['Veteran', 1], ['Ultra', 1.1], ['Master', 1.25], ['Legend', 1.45]]
};

const FACEIT = [['FACEIT Level 1', 0.8], ['FACEIT Level 2', 0.8], ['FACEIT Level 3', 0.85], ['FACEIT Level 4', 0.9], ['FACEIT Level 5', 0.95], ['FACEIT Level 6', 1], ['FACEIT Level 7', 1.05], ['FACEIT Level 8', 1.15], ['FACEIT Level 9', 1.3], ['FACEIT Level 10', 1.5]];

export const SERVICE_RANKS = {
  // Arena's own tiers (Wood and Gladiator only exist in Arena)
  lol: { arena: [['Wood', 0.85], ['Bronze', 0.9], ['Silver', 1], ['Gold', 1.1], ['Gladiator', 1.3]] },
  cs2: {
    // Wingman ranks with the classic 18 skill groups, grouped here: Silver I–Silver Elite Master, Gold Nova I–Master, …
    wing: [['Silver', 0.75], ['Gold Nova', 0.85], ['Master Guardian', 1], ['Distinguished Master Guardian', 1.1], ['Legendary Eagle', 1.2], ['Legendary Eagle Master', 1.25], ['Supreme', 1.35], ['Global Elite', 1.5]],
    // FACEIT is a separate platform with its own Level 1–10 ladder, not Premier rating
    duo3: FACEIT,
    faceit5: FACEIT
  }
};

export const RANKED = {
  lol: ['duo1', 'duo2', 'duo3', 'arena', 'ranked5', 'flex'],
  tft: ['duo1'],
  val: ['duo1', 'duo2', 'duo3', 'stack'],
  cs2: ['duo1', 'duo2', 'duo3', 'wing', 'five', 'faceit5'],
  fn: ['duo1', 'duo2', 'duo3'],
  cod: ['duo1', 'duo3', 'mp4'],
  apex: ['duo1', 'duo2', 'trio'],
  r6: ['duo1', 'duo2', 'duo3', 'stack'],
  mr: ['duo1', 'duo2', 'duo3', 'six'],
  ow: ['duo1', 'duo2', 'duo3', 'five'],
  rl: ['duo1', 'duo2', 'duo3', 'three'],
  fc: ['duo2', 'duo3'],
  pu: ['duo1', 'duo2', 'duo3']
};

// The ladder a service uses: its own (SERVICE_RANKS) or the game's. [] when it isn't rank-priced.
function ladder(game, service) {
  if (!(RANKED[game] || []).includes(service)) return [];
  return (SERVICE_RANKS[game] || {})[service] || RANKS[game] || [];
}
export const isRanked = (game, service) => ladder(game, service).length > 0;
// The rank names for a service and the one preselected (the listed-price rank).
export const ranksOf = (game, service) => ladder(game, service).map((r) => r[0]);
export const defaultRank = (game, service) => { const r = ladder(game, service).find((x) => x[1] === 1); return r ? r[0] : ''; };

// Price per unit (EUR) of a service for a rank. Not ranked, or a rank from another ladder → the catalog price.
export function rankPrice(game, service, base, rank) {
  const r = ladder(game, service).find((x) => x[0] === rank);
  if (!r || r[1] === 1) return base;
  return Math.max(0.99, Math.round(base * r[1] * 2) / 2 - 0.01);
}
