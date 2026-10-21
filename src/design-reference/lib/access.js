// Which orders a teammate may see and take. Admins set this per teammate in Admin → Users.
// access = { games: [game ids], gg: boolean }
//  · regular teammates: only orders for their approved games, and never Gamer Girl orders
//  · Gamer Girls (gg): only Gamer Girl orders, for every game, and nothing else
// Checked on the server (queue, accept, handover links), so an order a teammate can't take never
// reaches their browser: no card, no bell, no notification. Admins see and route everything.
export const NO_ACCESS = { games: [], gg: false };

// Gamer Girl orders: the "Gamer Girl Duo" / "Gamer Girl Ranked" services (older orders only have the title).
export const isGG = (o) => !!(o && (o.gg || /^gamer girl/i.test(String(o.title || ''))));

export function canTake(o, access) {
  const a = access || NO_ACCESS;
  if (a.gg) return isGG(o);
  return !isGG(o) && (a.games || []).includes(o.game);
}

// Why someone can't take an order, in words for the teammate.
export function whyNot(o, access, gameName) {
  const a = access || NO_ACCESS;
  if (a.gg) return 'As a Gamer Girl teammate you only take Gamer Girl orders.';
  if (isGG(o)) return 'Gamer Girl orders only go to Gamer Girl teammates.';
  return 'You’re not approved for ' + (gameName || 'this game') + ' yet. Ask an admin to unlock it.';
}
