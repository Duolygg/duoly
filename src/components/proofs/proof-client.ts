import { z } from 'zod';
import {
  ProofListSchema,
  ProofSchema,
  ProofResponseSchema as ProofResultSchema,
  type Proof,
} from '../../contracts/proofs';

export type ProofFetch = (url: string, init?: RequestInit) => Promise<Response>;
export type ProofRead =
  | { kind: 'ready'; proofs: Proof[] }
  | { kind: 'unavailable' | 'denied' | 'signed-out' };
export type UploadChoice = { file: File; requestId: string };
export type UploadResult =
  | { kind: 'confirmed'; proof: Proof }
  | { kind: 'uncertain' | 'unavailable' | 'denied' | 'signed-out' };
export function selectUpload(
  files: readonly File[],
  proofs: readonly Proof[],
  assignment: string,
  requestId: () => string = () => crypto.randomUUID(),
): UploadChoice {
  uuid.parse(assignment);
  if (proofs.filter((p) => p.assignment_id === assignment).length >= 5)
    throw new Error('This assignment already has five images.');
  if (files.length !== 1 || !files[0])
    throw new Error('Select one image at a time.');
  const file = files[0];
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type))
    throw new Error('Use a PNG, JPEG or WebP image.');
  if (file.size < 1 || file.size > 1572864)
    throw new Error('Image must contain 1–1,572,864 bytes.');
  return { file, requestId: uuid.parse(requestId()) };
}
export async function uploadProof(
  fetcher: ProofFetch,
  order: string,
  assignment: string,
  csrf: string,
  choice: UploadChoice,
): Promise<UploadResult> {
  try {
    binding(order, assignment);
    uuid.parse(choice.requestId);
    if (!csrf) return { kind: 'unavailable' };
    selectUpload([choice.file], [], assignment, () => choice.requestId);
    const response = await fetcher(`/api/teammate/orders/${order}/proof`, {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      body: choice.file,
      headers: {
        'Content-Type': choice.file.type,
        'X-CSRF-Token': csrf,
        'X-Assignment-Id': assignment,
        'X-Idempotency-Key': choice.requestId,
      },
    });
    if (response.status === 401) return { kind: 'signed-out' };
    if (response.status === 403 || response.status === 404)
      return { kind: 'denied' };
    if (response.status === 503) return { kind: 'unavailable' };
    if (!response.ok) return { kind: 'uncertain' };
    const { proof } = ProofResultSchema.parse(await response.json());
    proofUrl(order, proof, assignment);
    return { kind: 'confirmed', proof };
  } catch {
    return { kind: 'uncertain' };
  }
}
export type RemoveResult =
  | { kind: 'removed' }
  | { kind: 'denied' | 'signed-out' | 'gone' | 'unavailable' };
/** Hide one of the teammate's own screenshots on the open assignment (the server keeps the file). */
export async function removeProof(
  fetcher: ProofFetch,
  order: string,
  assignment: string,
  csrf: string,
  proofId: string,
): Promise<RemoveResult> {
  try {
    binding(order, assignment);
    uuid.parse(proofId);
    if (!csrf) return { kind: 'unavailable' };
    const response = await fetcher(
      `/api/teammate/orders/${order}/proof/${proofId}`,
      {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'X-CSRF-Token': csrf, 'X-Assignment-Id': assignment },
      },
    );
    if (response.status === 401) return { kind: 'signed-out' };
    if (response.status === 403) return { kind: 'denied' };
    if (response.status === 404 || response.status === 409)
      return { kind: 'gone' };
    if (!response.ok) return { kind: 'unavailable' };
    const body = z
      .strictObject({ removed: z.literal(true), proof_id: uuid })
      .parse(await response.json());
    return body.proof_id === proofId
      ? { kind: 'removed' }
      : { kind: 'unavailable' };
  } catch {
    return { kind: 'unavailable' };
  }
}
const uuid = z.uuid();
function binding(order: string, assignment?: string) {
  uuid.parse(order);
  if (assignment !== undefined) uuid.parse(assignment);
}
export function proofUrl(
  order: string,
  value: unknown,
  assignment?: string,
): string {
  binding(order, assignment);
  const proof = ProofSchema.parse(value);
  if (
    proof.order_id !== order ||
    (assignment !== undefined && proof.assignment_id !== assignment)
  )
    throw new Error('Invalid proof response.');
  return `/api/orders/${order}/proof/${proof.id}`;
}
export async function readProofs(
  fetcher: ProofFetch,
  order: string,
  assignment?: string,
): Promise<ProofRead> {
  try {
    binding(order, assignment);
    const response = await fetcher(`/api/orders/${order}/proof`, {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
    });
    if (response.status === 401) return { kind: 'signed-out' };
    if (response.status === 403 || response.status === 404)
      return { kind: 'denied' };
    if (!response.ok) return { kind: 'unavailable' };
    const { proofs } = ProofListSchema.parse(await response.json());
    for (const proof of proofs) proofUrl(order, proof, assignment);
    if (new Set(proofs.map((p) => p.id)).size !== proofs.length)
      throw new Error('Duplicate proof.');
    return { kind: 'ready', proofs };
  } catch {
    return { kind: 'unavailable' };
  }
}
