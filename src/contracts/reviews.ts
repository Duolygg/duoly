import { z } from 'zod';

export const REVIEW_TAGS = [
  'Great comms',
  'Shotcaller',
  'Super friendly',
  'Taught me a lot',
  'Carried hard',
  'Patient',
  'Fun to play with',
] as const;

export const ReviewSchema = z.strictObject({
  rating: z.number().int().min(1).max(5),
  text: z.string().max(500),
  tags: z.array(z.enum(REVIEW_TAGS)).max(4),
  at: z.iso.datetime({ offset: true }),
});

export const ReviewInputSchema = z.strictObject({
  csrf: z.string().min(1).max(128),
  rating: z.number().int().min(1).max(5),
  text: z.string().max(500),
  tags: z
    .array(z.enum(REVIEW_TAGS))
    .max(4)
    .refine((tags) => new Set(tags).size === tags.length),
});

const ReviewStatsSchema = z.strictObject({
  completed: z.number().int().nonnegative(),
  tier: z.strictObject({
    name: z.string(),
    deposit: z.number().int().min(0).max(10),
  }),
  held: z.number().nonnegative(),
  // Added by 20261025130000_trust_deposits.sql; optional so code can deploy first.
  released: z.number().nonnegative().optional(),
  forfeited: z.number().nonnegative().optional(),
  saved: z.number().nonnegative(),
  progress: z
    .strictObject({
      current: z.number().int().nonnegative(),
      next: z.number().int().positive().nullable(),
      remaining: z.number().int().nonnegative(),
      percent: z.number().int().min(0).max(100),
    })
    .optional(),
  rating: z.number().min(1).max(5).nullable(),
  reviews: z.number().int().nonnegative(),
  tipsTotal: z.literal(0),
  recent: z.array(
    z.union([
      z.strictObject({
        orderId: z.uuid(),
        at: z.number().int(),
        net: z.number().nonnegative(),
        tip: z.literal(0),
        game: z.string(),
      }),
      z.strictObject({
        orderId: z.null(),
        at: z.number().int(),
        net: z.number(),
        tip: z.literal(0),
        game: z.null(),
        adjustment: z.literal(true),
      }),
    ]),
  ),
  latestReviews: z
    .array(
      z.strictObject({
        rating: z.number().int().min(1).max(5),
        text: z.string().max(500),
        tags: z.array(z.enum(REVIEW_TAGS)).max(4),
        customer: z.string(),
        game: z.string(),
        at: z.number().int(),
      }),
    )
    .max(5),
  adjustments: z.array(
    z.strictObject({
      amount: z.number(),
      reason: z.string().min(1).max(200),
      at: z.number().int(),
    }),
  ),
  // Added by 20261025250000_weekly_payouts.sql; optional so code can deploy first.
  payout: z
    .strictObject({
      weekStart: z.number().int(),
      weekEnd: z.number().int(),
      due: z.number(),
      carried: z.number(),
      held: z.number().nonnegative(),
      minimum: z.literal(10),
      details: z.boolean(),
      owed: z.number(),
      history: z.array(
        z.strictObject({
          start: z.number().int(),
          end: z.number().int(),
          total: z.number(),
          status: z.enum(['Scheduled', 'On hold', 'Paid', 'Carried']),
          paidAt: z.number().int().nullable(),
        }),
      ),
    })
    .optional(),
});

// One public leaderboard row (lib/ledger.js leaderboard()). Only public fields: no email, country or earnings.
export const LeaderboardRowSchema = z.strictObject({
  id: z.uuid(),
  name: z.string().min(1).max(200),
  image: z.string().max(2048),
  orders: z.number().int().positive(),
  main: z.string().min(1).max(32),
  rating: z.number().min(1).max(5).nullable(),
  fives: z.number().int().nonnegative(),
  points: z.number().int().nonnegative(),
});

const LeaderboardTabsSchema = z.record(
  z.string().min(1).max(32),
  z.array(LeaderboardRowSchema),
);

// Empty until 20261024200000_leaderboard.sql is applied; then always week, month and all.
export const LeaderboardSchema = z.union([
  z.strictObject({}),
  z.strictObject({
    week: LeaderboardTabsSchema,
    month: LeaderboardTabsSchema,
    all: LeaderboardTabsSchema,
  }),
]);

export const TeammateStatsResponseSchema = z.strictObject({
  now: z.number().int(),
  me: z.uuid(),
  stats: ReviewStatsSchema,
  leaderboard: LeaderboardSchema,
});
