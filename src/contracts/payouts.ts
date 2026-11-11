import { z } from 'zod';

const csrf = z.string().min(1).max(128);
const reference = z.string().trim().min(1).max(120);
const method = z.enum(['bank', 'wise', 'paypal', 'payoneer', 'other']);

export const AdminPayoutCommandSchema = z.discriminatedUnion('action', [
  z
    .object({
      csrf,
      action: z.literal('adjust'),
      teammateId: z.uuid(),
      amountCents: z.number().int().min(-100000).max(100000).refine(Boolean),
      reason: z.string().trim().min(1).max(200),
    })
    .strict(),
  z
    .object({
      csrf,
      action: z.literal('pay'),
      payoutId: z.uuid(),
      method,
      reference,
    })
    .strict(),
  z
    .object({
      csrf,
      action: z.literal('payAll'),
      method,
      reference,
    })
    .strict(),
  z
    .object({
      csrf,
      action: z.literal('hold'),
      payoutId: z.uuid(),
      reason: z.string().trim().min(1).max(200),
    })
    .strict(),
  z.object({ csrf, action: z.literal('release'), payoutId: z.uuid() }).strict(),
]);

export const PayoutDetailsCommandSchema = z
  .object({
    csrf,
    legalName: z.string().trim().min(2).max(120),
    address: z.string().trim().min(5).max(300),
    country: z.string().trim().min(2).max(56),
    dateOfBirth: z.iso.date(),
    // Optional: empty is saved as no tax number; when given it must be 2–40 characters.
    taxNumber: z
      .string()
      .trim()
      .max(40)
      .refine((v) => v === '' || v.length >= 2)
      .default(''),
    method: z.enum(['bank', 'wise', 'paypal', 'payoneer']),
    account: z.string().trim().min(3).max(200),
  })
  .strict();

export type AdminPayoutCommand = z.infer<typeof AdminPayoutCommandSchema>;
export type PayoutDetailsCommand = z.infer<typeof PayoutDetailsCommandSchema>;
