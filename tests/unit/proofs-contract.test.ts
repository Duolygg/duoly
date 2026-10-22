import { expect, it } from 'vitest';
import {
  ProofSchema,
  ProofResponseSchema,
  ProofResultSchema,
  ProofListSchema,
  ProofUploadSchema,
} from '../../src/contracts/proofs';
const id = '00000000-0000-4000-8000-000000000001';
const proof = {
  id,
  order_id: id,
  assignment_id: id,
  mime: 'image/png',
  byte_size: 8,
  created_at: '2026-10-22T09:30:00Z',
};
it('accepts only the exact private proof DTO and strict command UUIDs', () => {
  expect(ProofSchema.parse(proof)).toEqual(proof);
  expect(ProofResultSchema.parse({ proof })).toEqual({ proof });
  expect(ProofResponseSchema.parse({ proof })).toEqual({ proof });
  expect(ProofListSchema.parse({ proofs: [proof] })).toEqual({
    proofs: [proof],
  });
  for (const key of ['sha256', 'path', 'uploader_id', 'url', 'role', 'price'])
    expect(ProofSchema.safeParse({ ...proof, [key]: id }).success).toBe(false);
  for (const bad of [0, 1572865, 1.5])
    expect(ProofSchema.safeParse({ ...proof, byte_size: bad }).success).toBe(
      false,
    );
  expect(ProofSchema.safeParse({ ...proof, byte_size: 1572864 }).success).toBe(
    true,
  );
  expect(
    ProofUploadSchema.safeParse({
      order_id: id,
      assignment_id: id,
      request_id: id,
    }).success,
  ).toBe(true);
  for (const bad of ['../x', id + '/x', '00000000-0000-0000-0000-000000000001'])
    expect(
      ProofUploadSchema.safeParse({
        order_id: bad,
        assignment_id: id,
        request_id: id,
      }).success,
    ).toBe(false);
});
