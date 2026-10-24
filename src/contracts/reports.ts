import { z } from 'zod';
import { ProofMimeSchema, ProofUuidSchema } from './proofs';

export const REPORT_BOUNTY_EUR_CENTS = 5000;
export const ReportTypeSchema = z.enum(['off_platform', 'toxic']);
export const ReportStatusSchema = z.enum(['open', 'approved', 'rejected']);
export const CustomerReportSchema = z.strictObject({
  id: ProofUuidSchema,
  reference: z.string().regex(/^R-[A-F0-9]{8}$/),
  type: ReportTypeSchema,
  status: ReportStatusSchema,
  bounty_eur_cents: z.literal(REPORT_BOUNTY_EUR_CENTS),
  created_at: z.iso.datetime({ offset: true }),
  decided_at: z.iso.datetime({ offset: true }).nullable(),
  bounty_owed: z.boolean(),
});

export const ReportEvidenceSchema = z.strictObject({
  id: ProofUuidSchema,
  mime: ProofMimeSchema,
  byte_size: z.number().int().min(1).max(1572864),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
});
export const CreateReportSchema = z.strictObject({
  order_id: ProofUuidSchema,
  type: ReportTypeSchema,
  description: z.string().trim().min(10).max(1000),
  evidence: z.array(ReportEvidenceSchema).min(1).max(5),
});
export const DecideReportSchema = z.strictObject({
  csrf: z.string(),
  id: ProofUuidSchema,
  decision: z.enum(['approved', 'rejected']),
  reason: z.string().trim().min(3).max(300),
});
