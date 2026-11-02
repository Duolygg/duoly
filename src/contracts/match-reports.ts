import { z } from 'zod';

/**
 * Match reports on win/loss orders (20261102160000): per game the teammate's IGN, the customer's
 * IGN and the match link, plus the wins and losses. Which orders: design-reference/lib/winloss.js.
 */
const Ign = z.string().trim().min(1).max(64);
export const MatchGameSchema = z.strictObject({
  teammateIgn: Ign,
  customerIgn: Ign,
  link: z
    .string()
    .trim()
    .max(300)
    .regex(/^https:\/\/\S{4,}$/),
});

export const MatchReportSchema = z.strictObject({
  games: z.array(MatchGameSchema).min(1).max(20),
  wins: z.number().int().min(0).max(20),
  losses: z.number().int().min(0).max(20),
});
export type MatchReport = z.infer<typeof MatchReportSchema>;

export const MatchReportCommandSchema = MatchReportSchema.extend({
  csrf: z.string().min(1).max(128),
});

export const MatchReportResponseSchema = z.strictObject({
  report: MatchReportSchema.nullable(),
});

/** A teammate's totals from the reports of the orders they completed. */
export const WinLossSchema = z.strictObject({
  wins: z.number().int().nonnegative(),
  losses: z.number().int().nonnegative(),
});
