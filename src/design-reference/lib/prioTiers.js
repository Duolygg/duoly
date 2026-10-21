// Priority adjustments admins can give on top of someone's base priority (lib/priority.js).
// Points: + = buff (sees new orders that many seconds EARLIER), − = nerf (that many seconds LATER).
// Shared by the server and the admin Priority page, so no server-only imports here.
export const ADJ_TIERS = [
  { id: 'small', points: 10, name: 'Small adjustment', color: '#9EE6FF' },
  { id: 'buff', points: 20, name: 'Buff', color: '#5EEAA8' },
  { id: 'bigbuff', points: 35, name: 'Big buff', color: '#5EEAA8' },
  { id: 'nerf', points: -10, name: 'Prio nerf', color: '#F0A6FF' },
  { id: 'bignerf', points: -20, name: 'Big nerf', color: '#FF8A9B' },
  { id: 'heavy', points: -35, name: 'Heavy nerf', color: '#FF8A9B' }
];
export const ADJ_DURATIONS = [
  { id: '1d', label: '24 hours', ms: 86400000 },
  { id: '7d', label: '7 days', ms: 7 * 86400000 },
  { id: 'perm', label: 'Until removed', ms: 0 }
];
export const tierById = (id) => ADJ_TIERS.find((t) => t.id === id) || null;
export const signed = (n) => (n > 0 ? '+' : n < 0 ? '−' : '±') + Math.abs(n);
