import type { ProofMime } from '../../contracts/proofs';
import { ProofFailure } from '../proofs/storage';

export type ReportObject = {
  orderId: string;
  reportId: string;
  evidenceId: string;
};
export const reportEvidencePath = (object: ReportObject) =>
  `${object.orderId}/${object.reportId}/${object.evidenceId}`;
export interface ReportBackend {
  put(
    object: ReportObject,
    bytes: Uint8Array<ArrayBuffer>,
    mime: ProofMime,
  ): Promise<void>;
  remove(object: ReportObject): Promise<void>;
  sign(storageKey: string): Promise<string>;
}
export function createReportBackend(
  env: Record<string, string | undefined> = process.env,
): ReportBackend | null {
  if (env.REPORTS_ENABLED !== 'true' || !env.SUPABASE_SERVICE_ROLE_KEY)
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
  return {
    async put(object, bytes, mime) {
      const response = await fetch(
        `${origin}/storage/v1/object/report-evidence/${reportEvidencePath(object)}`,
        {
          method: 'POST',
          headers: {
            ...headers,
            'Content-Type': mime,
            'x-upsert': 'false',
            'Cache-Control': 'max-age=0',
          },
          body: bytes,
          cache: 'no-store',
          redirect: 'error',
        },
      );
      if (!response.ok) throw new ProofFailure();
    },
    async remove(object) {
      const response = await fetch(
        `${origin}/storage/v1/object/report-evidence`,
        {
          method: 'DELETE',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ prefixes: [reportEvidencePath(object)] }),
          cache: 'no-store',
          redirect: 'error',
        },
      );
      if (!response.ok) throw new ProofFailure();
    },
    async sign(storageKey) {
      const response = await fetch(
        `${origin}/storage/v1/object/sign/report-evidence/${storageKey}`,
        {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ expiresIn: 300 }),
          cache: 'no-store',
          redirect: 'error',
        },
      );
      const data: unknown = await response.json().catch(() => null);
      if (
        !response.ok ||
        !data ||
        typeof data !== 'object' ||
        !('signedURL' in data) ||
        typeof data.signedURL !== 'string'
      )
        throw new ProofFailure();
      return new URL(data.signedURL, origin).toString();
    },
  };
}
