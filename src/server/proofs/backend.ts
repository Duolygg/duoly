import type { Database } from '../auth/database.types';
import type { ProofBinding, ProofMime } from '../../contracts/proofs';
import { proofPath, ProofFailure, readProofBytes } from './storage';

export type ServiceProofRpc =
  | 'finalize_order_proof_upload'
  | 'abandon_order_proof_upload'
  | 'claim_stale_order_proof_uploads';
export interface ProofBackend {
  rpc<K extends ServiceProofRpc>(
    name: K,
    args: Database['public']['Functions'][K]['Args'],
  ): Promise<{ data: unknown; error: unknown }>;
  put(
    binding: ProofBinding,
    bytes: Uint8Array<ArrayBuffer>,
    mime: ProofMime,
  ): Promise<void>;
  get(binding: ProofBinding): Promise<Uint8Array<ArrayBuffer> | null>;
  remove(binding: ProofBinding): Promise<void>;
}
/** Server module only. The service key is never part of account/client config. */
export function createProofBackend(
  env: Record<string, string | undefined> = process.env,
): ProofBackend | null {
  if (env.ORDER_PROOFS_ENABLED !== 'true' || !env.SUPABASE_SERVICE_ROLE_KEY)
    return null;
  let origin: string;
  try {
    const url = new URL(env.SUPABASE_URL ?? '');
    if (
      url.protocol !== 'https:' ||
      !/^[a-z0-9-]+\.supabase\.co$/.test(url.hostname) ||
      url.pathname !== '/' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      return null;
    origin = url.origin;
  } catch {
    return null;
  }
  const headers = {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  };
  const objectUrl = (binding: ProofBinding) =>
    `${origin}/storage/v1/object/order-proof/${proofPath(binding)}`;
  return {
    async rpc(name, args) {
      const response = await fetch(`${origin}/rest/v1/rpc/${name}`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(args),
        cache: 'no-store',
        redirect: 'error',
      });
      const data: unknown = await response.json();
      return response.ok ? { data, error: null } : { data: null, error: data };
    },
    async put(binding, bytes, mime) {
      const response = await fetch(objectUrl(binding), {
        method: 'POST',
        headers: { ...headers, 'Content-Type': mime, 'x-upsert': 'false' },
        body: bytes,
        cache: 'no-store',
        redirect: 'error',
      });
      if (!response.ok) throw new ProofFailure();
    },
    async get(binding) {
      const response = await fetch(objectUrl(binding), {
        headers,
        cache: 'no-store',
        redirect: 'error',
      });
      if (response.status === 404) return null;
      // Storage may transport its structured not-found error as HTTP 400.
      // Never treat an arbitrary 400/403 or malformed error as verified absence.
      if (response.status === 400) {
        try {
          const error: unknown = JSON.parse(
            new TextDecoder().decode(await readProofBytes(response.body)),
          );
          if (
            error &&
            typeof error === 'object' &&
            'statusCode' in error &&
            error.statusCode === '404' &&
            'error' in error &&
            error.error === 'not_found'
          )
            return null;
        } catch {
          /* Infrastructure failures are not evidence of absence. */
        }
      }
      if (!response.ok) throw new ProofFailure();
      try {
        return await readProofBytes(response.body);
      } catch {
        throw new ProofFailure();
      }
    },
    async remove(binding) {
      const path = proofPath(binding);
      const response = await fetch(`${origin}/storage/v1/object/order-proof`, {
        method: 'DELETE',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefixes: [path] }),
        cache: 'no-store',
        redirect: 'error',
      });
      if (!response.ok) throw new ProofFailure();
    },
  };
}
