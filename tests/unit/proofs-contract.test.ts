import { expect, it } from 'vitest';
import {
  ProofAuthorizationSchema,
  ProofBindingSchema,
  ProofReservationSchema,
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
it('canonicalizes valid UUIDs consistently in every proof DTO, without repairing malformed IDs', () => {
  const mixed = 'aBcDeF01-ABcd-4AbC-8aBc-aBCdEf012345';
  const canonical = mixed.toLowerCase();
  const authorization = { order_id: mixed, assignment_id: mixed };
  const binding = { id: mixed, ...authorization };
  const normalized = {
    id: canonical,
    order_id: canonical,
    assignment_id: canonical,
  };
  expect(ProofAuthorizationSchema.parse(authorization)).toEqual({
    order_id: canonical,
    assignment_id: canonical,
  });
  expect(ProofBindingSchema.parse(binding)).toEqual(normalized);
  expect(
    ProofReservationSchema.parse({ ...binding, state: 'pending' }),
  ).toEqual({ ...normalized, state: 'pending' });
  expect(
    ProofUploadSchema.parse({ ...authorization, request_id: mixed }),
  ).toEqual({
    order_id: canonical,
    assignment_id: canonical,
    request_id: canonical,
  });
  expect(
    ProofResponseSchema.parse({ proof: { ...proof, ...binding } }),
  ).toEqual({ proof: { ...proof, ...normalized } });
  expect(ProofListSchema.parse({ proofs: [{ ...proof, ...binding }] })).toEqual(
    { proofs: [{ ...proof, ...normalized }] },
  );
  for (const bad of [
    ' ' + mixed,
    mixed + ' ',
    `{${mixed}}`,
    mixed.replaceAll('-', ''),
    mixed.replace('4AbC', '0AbC'),
    '../' + mixed,
  ]) {
    expect(
      ProofAuthorizationSchema.safeParse({ ...authorization, order_id: bad })
        .success,
    ).toBe(false);
    expect(ProofBindingSchema.safeParse({ ...binding, id: bad }).success).toBe(
      false,
    );
    expect(
      ProofUploadSchema.safeParse({ ...authorization, request_id: bad })
        .success,
    ).toBe(false);
  }
});
it('accepts only the exact authorization DTO', () => {
  const authorization = { order_id: id, assignment_id: id };
  expect(ProofAuthorizationSchema.parse(authorization)).toEqual(authorization);
  for (const key of ['id', 'request_id', 'path', 'status', 'order', 'actor_id'])
    expect(
      ProofAuthorizationSchema.safeParse({ ...authorization, [key]: id })
        .success,
    ).toBe(false);
  expect(ProofAuthorizationSchema.safeParse({ order_id: id }).success).toBe(
    false,
  );
  expect(
    ProofAuthorizationSchema.safeParse({ assignment_id: id }).success,
  ).toBe(false);
});
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
