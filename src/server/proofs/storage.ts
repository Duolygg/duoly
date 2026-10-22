import { createHash } from 'node:crypto';
import {
  MAX_PROOF_BYTES,
  ProofBindingSchema,
  ProofMimeSchema,
  type ProofBinding,
  type ProofMime,
} from '../../contracts/proofs';

export class ProofFailure extends Error {
  constructor(public readonly status: number = 503) {
    super('Proof service unavailable.');
  }
}
export function proofDigest(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}
export function proofPath(binding: ProofBinding): string {
  const { id, order_id, assignment_id } = ProofBindingSchema.parse(binding);
  return `${order_id}/${assignment_id}/${id}`;
}
export function validateProofBytes(
  bytes: Uint8Array,
  mime: string | null,
): ProofMime {
  const parsed = ProofMimeSchema.safeParse(mime);
  if (!parsed.success || bytes.length === 0 || bytes.length > MAX_PROOF_BYTES)
    throw new ProofFailure(400);
  const starts = (values: number[]) => values.every((v, i) => bytes[i] === v);
  const valid =
    parsed.data === 'image/png'
      ? starts([137, 80, 78, 71, 13, 10, 26, 10])
      : parsed.data === 'image/jpeg'
        ? starts([255, 216, 255])
        : bytes.length >= 12 &&
          Buffer.from(bytes.subarray(0, 4)).toString() === 'RIFF' &&
          Buffer.from(bytes.subarray(8, 12)).toString() === 'WEBP';
  if (!valid) throw new ProofFailure(400);
  return parsed.data;
}
export async function readProofBytes(
  stream: ReadableStream<Uint8Array> | null,
): Promise<Uint8Array<ArrayBuffer>> {
  if (!stream) throw new ProofFailure(400);
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_PROOF_BYTES) {
        await reader.cancel();
        throw new ProofFailure(413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  if (!size) throw new ProofFailure(400);
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}
