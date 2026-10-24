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
  saved: z.number().nonnegative(),
  rating: z.number().min(1).max(5).nullable(),
  reviews: z.number().int().nonnegative(),
  tipsTotal: z.literal(0),
  recent: z.array(
    z.strictObject({
      orderId: z.uuid(),
      at: z.number().int(),
      net: z.number().nonnegative(),
      tip: z.literal(0),
      game: z.string(),
    }),
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
  adjustments: z.array(z.never()),
});

export const TeammateStatsResponseSchema = z.strictObject({
  now: z.number().int(),
  me: z.uuid(),
  stats: ReviewStatsSchema,
  leaderboard: z.record(z.string(), z.unknown()),
});
