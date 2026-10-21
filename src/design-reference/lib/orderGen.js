import { IGN_LABEL, randomGameId } from './games';
import { serversFor } from './servers';

// Sample orders. The real queue no longer uses these; only the teammate dashboard's
// "test notification" button does, to preview what a notification looks like.
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const between = (a, b) => a + Math.random() * (b - a);

const CUSTOMERS = ['Sam', 'Lea', 'Jonas', 'Mia', 'Noah', 'Ari', 'Emil', 'Zoe', 'Liam', 'Nina', 'Theo', 'Ava', 'Finn', 'Ivy', 'Leo', 'Mara', 'Kian', 'Elif'];
const FLAGS = ['at', 'br', 'de', 'es', 'fr', 'jp', 'kr', 'nl', 'pl', 'se', 'us'];
const FROM = {
  lol: ['Silver 2', 'Gold 4', 'Gold 1', 'Platinum 3', 'Emerald 4', 'Emerald 1'],
  val: ['Silver 3', 'Gold 2', 'Platinum 1', 'Diamond 2', 'Ascendant 1'],
  cs2: ['Premier 6,200', 'Premier 9,800', 'Premier 12,400', 'Premier 15,100', 'FACEIT Level 6', 'FACEIT Level 8'],
  cod: ['Silver 2', 'Gold 1', 'Platinum 3', 'Diamond 1', 'Crimson 1'],
  r6: ['Silver 2', 'Gold 3', 'Platinum 1', 'Emerald 4', 'Diamond 5'],
  tft: ['Silver 1', 'Gold 3', 'Platinum 2', 'Emerald 4', 'Diamond 3'],
  fc: ['Division 8', 'Division 6', 'Division 5', 'Division 3', 'Division 2'],
  mr: ['Gold 3', 'Platinum 2', 'Diamond 3', 'Grandmaster 3'],
  ow: ['Gold 4', 'Platinum 2', 'Diamond 5', 'Master 4'],
  pu: ['Great', 'Expert', 'Veteran', 'Ultra'],
  fn: ['Silver', 'Gold', 'Platinum', 'Diamond', 'Elite'],
  apex: ['Silver', 'Gold', 'Platinum', 'Diamond'],
  rl: ['Gold 2', 'Platinum 1', 'Platinum 3', 'Diamond 1', 'Champion 1'],
  arc: ['New raider', 'Casual', 'Experienced'],
  mc: ['Beginner', 'Casual', 'Bedwars 100★', 'Bedwars 300★']
};
// [title, badge, possible game counts, USD per game]; repeated entries come up more often
const SERVICES = [
  ['Duo Plus', '', [1, 2, 3], [4.5, 6.5]],
  ['Duo Pro', '', [1, 3, 3, 5], [6.5, 9.5]], ['Duo Pro', '', [1, 3, 5], [6.5, 9.5]],
  ['Duo Apex', '', [1, 2], [10, 14]],
  ['Play & Learn', 'Coaching', [1], [6, 9]],
  ['Rank Rush', 'Bundle', [5], [5.5, 7.5]],
  ['Chill Duo', 'Social', [2, 3], [3, 4.5]]
];
const NOTES = ['', '', '', 'Trying to hit the next rank this week.', 'Please explain your calls while we play!', 'Text chat only please.', 'Chill games, no tilt please.', 'Need a strong shotcaller.', 'I can flex, you pick first.'];
// What the in-game name is called per game (from lib/games.js)
export { IGN_LABEL };

function randomIgn(game, name, region) {
  const base = name + pick(['', 'x', 'Main', 'GG', 'Plays', 'Kun']);
  if (game === 'lol' || game === 'val' || game === 'tft') return base + '#' + (region === 'NA' ? 'NA1' : /^LA/.test(region) ? 'LAN' : pick(['EUW', 'EUW1', '4421']));
  if (game === 'ow' || game === 'cod') return base + '#' + (1000 + Math.floor(Math.random() * 8999999));
  return base + (10 + Math.floor(Math.random() * 989));
}

// games: optional list of game ids to pick from
export function randomOrder(games) {
  const game = games && games.length ? randomGameId(Math.random, games) : randomGameId();
  const [title, badge, counts, rate] = pick(SERVICES);
  const n = pick(counts);
  const note = pick(NOTES);
  const customer = pick(CUSTOMERS);
  // a likely server for the game (lib/servers.js): mostly European and American ones, like real demand
  const region = game === 'mc' ? pick(['Hypixel · Java', 'Minemen · Java', 'My own world · Bedrock']) : pick(serversFor(game).filter((s) => s[2] === 'Europe' || s[2] === 'Americas').map((s) => s[0]));
  return {
    game, title, badge, games: n, customer, av: 1 + Math.floor(Math.random() * 10), flag: pick(FLAGS),
    from: pick(FROM[game]), region, note, ign: randomIgn(game, customer, region),
    voice: note !== 'Text chat only please.' && Math.random() < 0.8,
    payout: Math.max(2.99, Math.round(n * between(rate[0], rate[1]) * 10) / 10 - 0.01) // USD to the teammate
  };
}
