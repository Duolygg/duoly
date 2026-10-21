// Business constants and small helpers shared by the admin dashboard and the site.
// (The admin shows only real data now: see app/api/admin/stats and lib/adminPeople.js.)
// The EUR → USD rate is live, from the ECB: lib/fx.js.
import { GAME } from './games';

export const PLATFORM_FEE = 0.4; // Duoly keeps 40% of each order, the teammate gets 60% (keep in sync with lib/orders.js)
export const PAYOUT_DAY = 'Friday';

// game id → { name, short, img, … }
export const GAMES = GAME;

// "kairo@gmail.com" → "k•••o@gmail.com" (admin lists don't need full emails at a glance)
export const maskEmail = (e) => {
  if (!e || !String(e).includes('@')) return '';
  const [u, d] = String(e).split('@');
  return u.charAt(0) + '•••' + (u.length > 3 ? u.charAt(u.length - 1) : '') + '@' + d;
};
