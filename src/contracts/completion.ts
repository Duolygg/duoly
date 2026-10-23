import { z } from 'zod';
import { ProofUuidSchema } from './proofs';
const cents = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const CompletionInputSchema = z.strictObject({
  order_id: ProofUuidSchema,
  assignment_id: ProofUuidSchema,
  request_id: ProofUuidSchema,
  proof_ids: z
    .array(ProofUuidSchema)
    .min(1)
    .max(5)
    .refine((ids) => new Set(ids).size === ids.length),
});
export const CompletionSchema = CompletionInputSchema.extend({
  completed_at: z.iso.datetime({ offset: true }),
  payout_usd_cents: cents.min(99).max(10000000),
  deposit_percent: z.union([
    z.literal(0),
    z.literal(3),
    z.literal(5),
    z.literal(8),
    z.literal(10),
  ]),
  held_usd_cents: cents,
  net_usd_cents: cents,
  trust_tier: z.enum(['rookie', 'trusted', 'veteran', 'elite', 'legend']),
}).refine((entry) => {
  const percentages = {
    rookie: 10,
    trusted: 8,
    veteran: 5,
    elite: 3,
    legend: 0,
  };
  if (
    !Number.isSafeInteger(entry.payout_usd_cents) ||
    !Number.isSafeInteger(entry.deposit_percent)
  )
    return false;
  const held = Number(
    (BigInt(entry.payout_usd_cents) * BigInt(entry.deposit_percent) + 50n) /
      100n,
  );
  return (
    entry.deposit_percent === percentages[entry.trust_tier] &&
    entry.held_usd_cents === held &&
    entry.held_usd_cents + entry.net_usd_cents === entry.payout_usd_cents
  );
});
export const CompletionResponseSchema = z.strictObject({
  completion: CompletionSchema,
});
export const EarningsResponseSchema = z.strictObject({
  earnings: z.array(CompletionSchema).max(100),
});
export type Completion = z.infer<typeof CompletionSchema>;
export type CompletionInput = z.infer<typeof CompletionInputSchema>;
