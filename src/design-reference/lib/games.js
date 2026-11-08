// Every game on Duoly, in one place. Every page imports this list, so adding a game here adds it everywhere
// (pages with extra per-game content, like the homepage modes or the apply form, add their own entry by id).
// Ordered by expected demand, most booked first; pickers, filters and stats show games in this order.
// share: expected share of all orders. Sample admin stats and simulated orders use it.
// short: kept for older callers; always the full name, so a game reads the same everywhere on the site.
// alias: a common short name, only for recognising what people type (support bot). Never shown.
// ign: what the in-game name is called, shown when a teammate needs to add the customer.
export const GAMES = [
  { id: 'lol', name: 'League of Legends', short: 'League of Legends', alias: 'League', img: '/assets/games/league-of-legends.png', ign: 'Riot ID', share: 0.195 },
  { id: 'val', name: 'Valorant', short: 'Valorant', img: '/assets/games/valorant.png', ign: 'Riot ID', share: 0.13 },
  { id: 'cs2', name: 'Counter-Strike 2', short: 'Counter-Strike 2', alias: 'CS2', img: '/assets/games/counter-strike-2.png', ign: 'Steam name', share: 0.11 },
  { id: 'fn', name: 'Fortnite', short: 'Fortnite', img: '/assets/games/fortnite.png', ign: 'Epic name', share: 0.09 },
  { id: 'cod', name: 'Call of Duty', short: 'Call of Duty', img: '/assets/games/call-of-duty.png', ign: 'Activision ID', share: 0.08 },
  { id: 'apex', name: 'Apex Legends', short: 'Apex Legends', img: '/assets/games/apex-legends.png', ign: 'EA ID', share: 0.07 },
  { id: 'r6', name: 'Rainbow Six Siege', short: 'Rainbow Six Siege', alias: 'Rainbow Six', img: '/assets/games/rainbow-six-siege.png', ign: 'Ubisoft name', share: 0.06 },
  { id: 'mr', name: 'Marvel Rivals', short: 'Marvel Rivals', img: '/assets/games/marvel-rivals.png', ign: 'username', share: 0.06 },
  { id: 'ow', name: 'Overwatch 2', short: 'Overwatch 2', alias: 'Overwatch', img: '/assets/games/overwatch-2.png', ign: 'BattleTag', share: 0.05 },
  // Added 2026-11-08: Dota 2, World of Warcraft, PUBG, Wild Rift and Deadlock, placed by expected demand.
  { id: 'dota', name: 'Dota 2', short: 'Dota 2', alias: 'Dota', img: '/assets/games/dota-2.png', ign: 'Steam name', share: 0.045 },
  { id: 'rl', name: 'Rocket League', short: 'Rocket League', img: '/assets/games/rocket-league.png', ign: 'Epic name', share: 0.04 },
  { id: 'wow', name: 'World of Warcraft', short: 'World of Warcraft', alias: 'WoW', img: '/assets/games/world-of-warcraft.png', ign: 'BattleTag', share: 0.035 },
  { id: 'pubg', name: 'PUBG: Battlegrounds', short: 'PUBG: Battlegrounds', alias: 'PUBG', img: '/assets/games/pubg.png', ign: 'PUBG name', share: 0.03 },
  { id: 'tft', name: 'Teamfight Tactics', short: 'Teamfight Tactics', alias: 'TFT', img: '/assets/games/teamfight-tactics.png', ign: 'Riot ID', share: 0.03 },
  { id: 'fc', name: 'EA SPORTS FC 27', short: 'EA SPORTS FC 27', alias: 'FC 27', img: '/assets/games/ea-sports-fc-27.png', ign: 'EA ID', share: 0.03 },
  { id: 'arc', name: 'ARC Raiders', short: 'ARC Raiders', img: '/assets/games/arc-raiders.png', ign: 'Embark ID', share: 0.025 },
  { id: 'wr', name: 'Wild Rift', short: 'Wild Rift', alias: 'LoL Wild Rift', img: '/assets/games/wild-rift.png', ign: 'Riot ID', share: 0.025 },
  { id: 'mc', name: 'Minecraft', short: 'Minecraft', img: '/assets/games/minecraft.png', ign: 'Minecraft name', share: 0.02 },
  { id: 'dl', name: 'Deadlock', short: 'Deadlock', img: '/assets/games/deadlock.png', ign: 'Steam name', share: 0.02 },
  { id: 'pu', name: 'Pokémon Unite', short: 'Pokémon Unite', img: '/assets/games/pokemon-unite.png', ign: 'trainer name', share: 0.015 },
  // Not a game: Gamer Girl only social sessions (just chat, watch together, sleep call, karaoke). See lib/catalog.js.
  { id: 'social', name: 'Social', short: 'Social', img: '/assets/games/social.png', ign: 'Discord name', share: 0.01 }
];

export const GAME_IDS = GAMES.map((g) => g.id);
// Games an admin can approve one by one (Admin → Users). Social is Gamer Girl only, so it comes with gg access.
export const ACCESS_GAMES = GAMES.filter((g) => g.id !== 'social');
// by id: GAME.lol.name
export const GAME = Object.fromEntries(GAMES.map((g) => [g.id, g]));
export const gameOf = (id) => GAME[id] || GAMES[0];
export const IGN_LABEL = Object.fromEntries(GAMES.map((g) => [g.id, g.ign]));
// Sorts anything with a game id into demand order (unknown ids go last).
export const byDemand = (getId = (x) => x.id) => (a, b) => {
  const i = (x) => { const n = GAME_IDS.indexOf(getId(x)); return n < 0 ? 99 : n; };
  return i(a) - i(b);
};

// A random game id, weighted by expected demand. rand: optional seeded random (0–1).
export function randomGameId(rand = Math.random, from = GAME_IDS) {
  const list = GAMES.filter((g) => from.includes(g.id));
  if (!list.length) return GAME_IDS[0];
  let r = rand() * list.reduce((s, g) => s + g.share, 0);
  for (const g of list) { r -= g.share; if (r <= 0) return g.id; }
  return list[list.length - 1].id;
}
