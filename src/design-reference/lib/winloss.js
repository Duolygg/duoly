// Which orders get a win/loss report (owner 2026-11-02). Teammates fill in every game (their IGN,
// the customer's IGN and the match link) and the wins and losses before they can finish; their
// winrate comes from these reports. Only orders where a win or a loss is the clear outcome:
//  · games counted per game (not the hourly battle royale and extraction games),
//  · duo and fill services (not fun modes, coaching or Play and Learn),
//  · never Gamer Girl or Social,
//  · not placement modes or draws: TFT, LoL Arena and EA FC are left out.
// The database keeps the same list (order_tracks_wl in 20261102160000_win_loss.sql); a unit test
// checks they match.
import { servicesFor } from './catalog';

export const WL_GAMES = ['lol', 'val', 'cs2', 'r6', 'mr', 'ow', 'rl', 'pu'];
const PLACEMENT = { lol: ['arena'] };

/** game id -> service ids that get a win/loss report */
export const WL_SERVICES = Object.fromEntries(
  WL_GAMES.map((game) => {
    const s = servicesFor(game);
    return [
      game,
      s.modes
        .filter(
          (m) =>
            (m.cat === 'duo' || m.cat === 'other') &&
            // fun modes moved to the Duo tab on 2026-11-06 but still get no report
            !m.fun &&
            (m.unit || s.unit) === 'game' &&
            !(PLACEMENT[game] || []).includes(m.id),
        )
        .map((m) => m.id),
    ];
  }),
);

/** order: { game, service, gg } */
export function tracksWinLoss(order) {
  if (!order || order.gg) return false;
  return (WL_SERVICES[order.game] || []).includes(order.service);
}

/** "62% · 31W 19L", or '' with no games yet */
export function winrateLabel(wins, losses) {
  const games = (wins || 0) + (losses || 0);
  if (!games) return '';
  return Math.round((wins / games) * 100) + '% · ' + wins + 'W ' + losses + 'L';
}
