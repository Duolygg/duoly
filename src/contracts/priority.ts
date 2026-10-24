import { z } from 'zod';

/**
 * Port of the original lib/prioTiers.js, shared by the server and the admin
 * Priority screen (no server-only imports here). Points: positive = buff
 * (sees new orders that many seconds earlier), negative = nerf (later).
 */
export const ADJ_TIERS = [
  { id: 'small', points: 10, name: 'Small adjustment', color: '#9EE6FF' },
  { id: 'buff', points: 20, name: 'Buff', color: '#5EEAA8' },
  { id: 'bigbuff', points: 35, name: 'Big buff', color: '#5EEAA8' },
  { id: 'nerf', points: -10, name: 'Prio nerf', color: '#F0A6FF' },
  { id: 'bignerf', points: -20, name: 'Big nerf', color: '#FF8A9B' },
  { id: 'heavy', points: -35, name: 'Heavy nerf', color: '#FF8A9B' },
] as const;
export const ADJ_DURATIONS = [
  { id: '1d', label: '24 hours', ms: 86400000 },
  { id: '7d', label: '7 days', ms: 7 * 86400000 },
  { id: 'perm', label: 'Until removed', ms: 0 },
] as const;

export type AdjTier = (typeof ADJ_TIERS)[number];
export const tierById = (id: string): AdjTier | null =>
  ADJ_TIERS.find((t) => t.id === id) || null;
/** Points are unique across tiers, so the database only stores the points. */
export const tierByPoints = (points: number): AdjTier | null =>
  ADJ_TIERS.find((t) => t.points === points) || null;
export const signed = (n: number) =>
  (n > 0 ? '+' : n < 0 ? '−' : '±') + Math.abs(n);

/** Fixed rules from the original lib/priority.js and lib/penalty.js. */
export const PRIORITY_RULES = {
  default: 50,
  perMiss: 10,
  cap: 50,
  days: 7,
  missVisibleSec: 60,
} as const;

const csrf = z.string().min(1).max(128);
const userId = z.uuid();

/** Body of POST /api/admin/priority: one command per request. */
export const AdminPriorityCommandSchema = z.discriminatedUnion('action', [
  z
    .object({
      csrf,
      userId,
      action: z.literal('set'),
      prio: z.number().int().min(0).max(100),
    })
    .strict(),
  z.object({ csrf, userId, action: z.literal('reset') }).strict(),
  z
    .object({
      csrf,
      userId,
      action: z.literal('adjust'),
      tier: z.enum(['small', 'buff', 'bigbuff', 'nerf', 'bignerf', 'heavy']),
      duration: z.enum(['1d', '7d', 'perm']),
      reason: z.string().max(140).optional(),
    })
    .strict(),
  z.object({ csrf, userId, action: z.literal('clearAdjust') }).strict(),
  z.object({ csrf, userId, action: z.literal('forgive') }).strict(),
]);
