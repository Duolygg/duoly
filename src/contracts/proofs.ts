import { z } from 'zod';

export const MAX_PROOF_BYTES = 1_572_864;
export const ProofMimeSchema = z.enum([
  'image/png',
  'image/jpeg',
  'image/webp',
]);
export const ProofBindingSchema = z.strictObject({
  id: z.uuid(),
  order_id: z.uuid(),
  assignment_id: z.uuid(),
});
export const ProofSchema = ProofBindingSchema.extend({
  mime: ProofMimeSchema,
  byte_size: z.number().int().min(1).max(MAX_PROOF_BYTES),
  created_at: z.iso.datetime({ offset: true }),
});
export const ProofResultSchema = z.strictObject({ proof: ProofSchema });
export const ProofResponseSchema = ProofResultSchema;
export const ProofListSchema = z.strictObject({ proofs: z.array(ProofSchema) });
export const ProofUploadSchema = z.strictObject({
  order_id: z.uuid(),
  assignment_id: z.uuid(),
  request_id: z.uuid(),
});
export const ProofReservationSchema = ProofBindingSchema.extend({
  state: z.enum(['pending', 'ready']),
});
export type Proof = z.infer<typeof ProofSchema>;
export type ProofBinding = z.infer<typeof ProofBindingSchema>;
export type ProofMime = z.infer<typeof ProofMimeSchema>;
