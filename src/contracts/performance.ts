import { z } from 'zod';

/**
 * Contractor performance ranking (migration 20261030120000, docs/product/performance-ranking.md).
 * The database computes everything; these are the shapes the site reads and the commands it sends.
 */

/** Best first. A bracket is "TOP X%": rank / eligible teammates at most X%. */
export const BRACKETS = [1, 5, 10, 25, 50] as const;
export type Bracket = (typeof BRACKETS)[number];

export const BRACKET_COLORS: Record<Bracket, string> = {
  1: '#C6A6FF',
  5: '#9B8AFB',
  10: '#718CEB',
  25: '#55A9C9',
  50: '#648D91',
};

/** Exact Discord role name for a bracket. */
export const bracketRoleName = (bracket: Bracket) =>
  `Performance | TOP ${bracket}%`;

export const bracketLabel = (bracket: Bracket | null | undefined) =>
  bracket ? `TOP ${bracket}%` : 'Unranked';

const BracketSchema = z.literal(BRACKETS).nullable();
const num = z.coerce.number().finite();
const count = z.number().int().min(0);

export const TeammatePerformanceSchema = z.strictObject({
  ranked: z.boolean(),
  run: z
    .strictObject({
      at: z.string(),
      eligible: count,
      windowDays: count,
      weights: z.strictObject({
        retention: count,
        satisfaction: count,
        orders: count,
      }),
    })
    .nullable(),
  requirements: z
    .strictObject({ orders: count, reviews: count, customers: count })
    .optional(),
  me: z
    .strictObject({
      reason: z.string(),
      completedOrders: count,
      reviews: count,
      avgRating: num.nullable(),
      customers: count,
      returningCustomers: count,
      retentionRate: num,
      retentionScore: num.nullable(),
      satisfactionScore: num.nullable(),
      ordersScore: num.nullable(),
      score: num.nullable(),
      rank: count.nullable(),
      percentile: num.nullable(),
      bracket: BracketSchema,
    })
    .nullable()
    .optional(),
  next: z
    .strictObject({
      bracket: BracketSchema,
      score: num.nullable(),
      reachable: z.boolean(),
    })
    .nullable()
    .optional(),
});
export type TeammatePerformance = z.infer<typeof TeammatePerformanceSchema>;

const csrf = z.string().min(1).max(128);
const weight = z.number().int().min(0).max(100);

export const AdminRecalculateSchema = z.strictObject({
  csrf,
  action: z.literal('recalculate'),
});

export const AdminPerformanceSettingsSchema = z
  .strictObject({
    csrf,
    action: z.literal('settings'),
    wRetention: weight,
    wSatisfaction: weight,
    wOrders: weight,
    windowDays: z.number().int().min(7).max(365),
    minOrders: z.number().int().min(1).max(1000),
    minReviews: z.number().int().min(0).max(1000),
    minCustomers: z.number().int().min(1).max(1000),
  })
  .refine((s) => s.wRetention + s.wSatisfaction + s.wOrders === 100, {
    message: 'The three weights must add up to 100%.',
  });

/** One Discord sync result row, written back through performance_set_sync. */
export type SyncStatus =
  'pending' | 'synced' | 'no_discord' | 'not_member' | 'error' | 'off';
