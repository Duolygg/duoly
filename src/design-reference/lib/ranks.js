import { CATALOG } from './catalog';

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
  pu: [['Beginner', 0.8], ['Great', 0.85], ['Expert', 0.9], ['Veteran', 1], ['Ultra', 1.1], ['Master', 1.25], ['Legend', 1.45]],
  // Dota 2 medals, Herald to Immortal
  dota: [['Herald', 0.8], ['Guardian', 0.85], ['Crusader', 0.9], ['Archon', 0.95], ['Legend', 1], ['Ancient', 1.1], ['Divine', 1.3], ['Immortal', 1.6]],
  // Wild Rift has Emerald and its own top tier, Sovereign
  wr: [['Iron', 0.8], ['Bronze', 0.8], ['Silver', 0.85], ['Gold', 0.9], ['Platinum', 0.95], ['Emerald', 1], ['Diamond', 1.1], ['Master', 1.25], ['Grandmaster', 1.4], ['Challenger', 1.5], ['Sovereign', 1.6]],
  // PUBG Ranked tiers (Survivor is the top 500 of Master and isn't a separate pick)
  pubg: [['Bronze', 0.8], ['Silver', 0.85], ['Gold', 0.9], ['Platinum', 0.95], ['Crystal', 1], ['Diamond', 1.1], ['Master', 1.35]],
  // Deadlock's eleven ranks, Initiate to Eternus
  dl: [['Initiate', 0.8], ['Seeker', 0.8], ['Alchemist', 0.85], ['Arcanist', 0.9], ['Ritualist', 0.95], ['Emissary', 1], ['Archon', 1.05], ['Oracle', 1.15], ['Phantom', 1.3], ['Ascendant', 1.45], ['Eternus', 1.6]]
  // World of Warcraft has no single ladder: Mythic+ and arena each have a rating (SERVICE_RANKS below).
};

// World of Warcraft ratings: Mythic+ dungeon score and rated arena (titles by their usual cut-offs)
const MYTHIC_PLUS = [['Mythic+ under 1,500', 0.8], ['Mythic+ 1,500–1,999', 0.9], ['Mythic+ 2,000–2,499', 1], ['Mythic+ 2,500–2,999', 1.15], ['Mythic+ 3,000–3,499', 1.35], ['Mythic+ 3,500+', 1.6]];
const ARENA_RATING = [['Arena under 1,400', 0.8], ['Combatant 1,400+', 0.9], ['Challenger 1,600+', 1], ['Rival 1,800+', 1.15], ['Duelist 2,100+', 1.35], ['Elite 2,400+', 1.6]];

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
  },
  wow: { duo1: MYTHIC_PLUS, duo2: MYTHIC_PLUS, keys: MYTHIC_PLUS, arena: ARENA_RATING, arena3: ARENA_RATING }
};

export const RANKED = {
  lol: ['duo1', 'duo2', 'duo3', 'arena', 'ranked5', 'flex'],
  tft: ['duo1'],
  val: ['duo1', 'duo2', 'duo3', 'stack'],
  cs2: ['duo1', 'duo2', 'duo3', 'wing', 'five', 'faceit5'],
  fn: ['duo1', 'duo2', 'duo3'],
  // Duo Pro (Warzone) is rank-priced too, so it never costs less than Duo Plus (owner 2026-11-08)
  cod: ['duo1', 'duo2', 'duo3', 'mp4'],
  apex: ['duo1', 'duo2', 'trio'],
  r6: ['duo1', 'duo2', 'duo3', 'stack'],
  mr: ['duo1', 'duo2', 'duo3', 'six'],
  ow: ['duo1', 'duo2', 'duo3', 'five'],
  rl: ['duo1', 'duo2', 'duo3', 'three'],
  fc: ['duo2', 'duo3'],
  pu: ['duo1', 'duo2', 'duo3'],
  dota: ['duo1', 'duo2', 'duo3', 'party5'],
  wow: ['duo1', 'duo2', 'arena', 'keys', 'arena3'],
  pubg: ['duo1', 'duo2', 'squad'],
  wr: ['duo1', 'duo2', 'duo3', 'five'],
  dl: ['duo1', 'duo2', 'duo3', 'six']
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
// Duo tiers: Plus (duo1) < Pro (duo2) < Apex (duo3). At any rank a higher tier costs at least
// TIER_STEP more than the tier below it, so a cheaper tier is always cheaper (owner 2026-11-08).
// Only between tiers priced on the same ladder; CS2's FACEIT Duo has its own.
const TIERS = ['duo1', 'duo2', 'duo3'];
const TIER_STEP = 0.5;
const catalogPrice = (game, service) => {
  const s = ((CATALOG[game] || {}).services || []).find((x) => x[0] === service);
  return s ? s[5] : undefined;
};

export function rankPrice(game, service, base, rank) {
  const r = ladder(game, service).find((x) => x[0] === rank);
  const own = !r || r[1] === 1 ? base : Math.max(0.99, Math.round(base * r[1] * 2) / 2 - 0.01);
  const i = TIERS.indexOf(service);
  const below = i > 0 ? TIERS[i - 1] : '';
  const belowBase = below ? catalogPrice(game, below) : undefined;
  if (!r || belowBase === undefined || ladder(game, below) !== ladder(game, service)) return own;
  const floor = Math.round((rankPrice(game, below, belowBase, rank) + TIER_STEP) * 100) / 100;
  return Math.max(own, floor);
}
