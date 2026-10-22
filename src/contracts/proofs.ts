import { z } from 'zod';

// Validate first: only UUID letter case is canonicalized, never malformed IDs.
export const ProofUuidSchema = z
  .uuid()
  .transform((value) => value.toLowerCase());
export const MAX_PROOF_BYTES = 1_572_864;
export const ProofMimeSchema = z.enum([
  'image/png',
  'image/jpeg',
  'image/webp',
]);
export const ProofBindingSchema = z.strictObject({
  id: ProofUuidSchema,
  order_id: ProofUuidSchema,
  assignment_id: ProofUuidSchema,
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
  order_id: ProofUuidSchema,
  assignment_id: ProofUuidSchema,
  request_id: ProofUuidSchema,
});
export const ProofAuthorizationSchema = ProofUploadSchema.omit({
  request_id: true,
});
export const ProofReservationSchema = ProofBindingSchema.extend({
  state: z.enum(['pending', 'ready']),
});
export type Proof = z.infer<typeof ProofSchema>;
export type ProofBinding = z.infer<typeof ProofBindingSchema>;
export type ProofMime = z.infer<typeof ProofMimeSchema>;
