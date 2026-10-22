type Environment = {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};
type Binding = { id: string; order_id: string; assignment_id: string };
const BATCH_SIZE = 25;
const OPERATION_MS = 3000;
const OVERALL_MS = 20000;

// Delegate fixed-size MAC comparison to native WebCrypto, not a JIT-able JS loop.
// The ephemeral comparison key is not a credential: only exact expected bytes pass.
async function sameSecret(actual: string, expected: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const comparisonKey = await crypto.subtle.importKey(
      'raw',
      crypto.getRandomValues(new Uint8Array(32)),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify'],
    );
    const expectedTag = await crypto.subtle.sign(
      'HMAC',
      comparisonKey,
      encoder.encode(expected),
    );
    return await crypto.subtle.verify(
      'HMAC',
      comparisonKey,
      expectedTag,
      encoder.encode(actual),
    );
  } catch {
    return false;
  }
}

function originFor(value: string | undefined): string | null {
  try {
    const url = new URL(value ?? '');
    if (
      url.protocol !== 'https:' ||
      !/^[a-z0-9-]+\.supabase\.co$/.test(url.hostname) ||
      url.port ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    )
      return null;
    return url.origin;
  } catch {
    return null;
  }
}

// Race as well as abort: even an uncooperative transport cannot hold the handler.
async function guarded<T>(
  promise: Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  signal.throwIfAborted();
  let onAbort: () => void = () => {};
  const aborted = new Promise<never>((_, reject) => {
    onAbort = () => reject(new Error('cancelled'));
    signal.addEventListener('abort', onAbort, { once: true });
  });
  try {
    return await Promise.race([promise, aborted]);
  } finally {
    signal.removeEventListener('abort', onAbort);
  }
}

async function within<T>(
  parent: AbortSignal,
  operation: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  parent.throwIfAborted();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OPERATION_MS);
  const signal = AbortSignal.any([parent, controller.signal]);
  try {
    return await guarded(operation(signal), signal);
  } finally {
    clearTimeout(timer);
  }
}

async function boundedText(
  stream: ReadableStream<Uint8Array> | null,
  limit: number,
  signal: AbortSignal,
): Promise<string> {
  signal.throwIfAborted();
  if (!stream) return '';
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await guarded(reader.read(), signal);
      if (done) break;
      length += value.byteLength;
      if (length > limit) throw new Error('limit');
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } finally {
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

function exactObject(
  value: unknown,
  keys: string[],
): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}
function parseClaim(value: unknown): Binding[] {
  if (
    !exactObject(value, ['proofs']) ||
    !Array.isArray(value.proofs) ||
    value.proofs.length > BATCH_SIZE
  )
    throw new Error('claim');
  const ids = new Set<string>();
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  for (const proof of value.proofs) {
    if (
      !exactObject(proof, ['id', 'order_id', 'assignment_id']) ||
      !Object.values(proof).every(
        (value) => typeof value === 'string' && uuid.test(value),
      )
    )
      throw new Error('claim');
    const id = (proof.id as string).toLowerCase();
    if (ids.has(id)) throw new Error('duplicate');
    ids.add(id);
  }
  return value.proofs as Binding[];
}

function failure(status: number): Response {
  return new Response(null, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      ...(status === 405 ? { Allow: 'POST' } : {}),
    },
  });
}

/** No caller-controlled authority: only the service SQL claim can supply bindings.
 * SQL must atomically abandon stale pending rows and never return ready rows.
 * Abandoned rows must never transition to ready; failed cleanup remains retryable.
 */
export function createCleanupHandler(
  env: Environment,
  fetcher: typeof fetch = fetch,
) {
  const origin = originFor(env.SUPABASE_URL);
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') return failure(405);
    if (!key || !origin) return failure(503);
    if (
      !(await sameSecret(
        request.headers.get('authorization') ?? '',
        `Bearer ${key}`,
      ))
    )
      return failure(401);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), OVERALL_MS);
    const signal = AbortSignal.any([controller.signal, request.signal]);
    try {
      try {
        const url = new URL(request.url);
        if (url.search || url.hash) return failure(400);
        const body = await within(signal, (signal) =>
          boundedText(request.body, 64, signal),
        );
        if (body !== '' && !exactObject(JSON.parse(body), []))
          return failure(400);
      } catch {
        return failure(400);
      }
      const headers = {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      };
      const network = <T>(
        path: string,
        init: RequestInit,
        consume: (response: Response, signal: AbortSignal) => Promise<T>,
      ) =>
        within(signal, async (signal) => {
          const response = await guarded(
            fetcher(`${origin}${path}`, {
              ...init,
              headers,
              signal,
              redirect: 'error',
              cache: 'no-store',
            }),
            signal,
          );
          try {
            return await consume(response, signal);
          } finally {
            void response.body?.cancel().catch(() => {});
          }
        });
      try {
        const proofs = await network(
          '/rest/v1/rpc/claim_stale_order_proof_uploads',
          {
            method: 'POST',
            body: JSON.stringify({ p_limit: BATCH_SIZE }),
          },
          async (response, signal) => {
            if (!response.ok) throw new Error('claim');
            return parseClaim(
              JSON.parse(await boundedText(response.body, 16384, signal)),
            );
          },
        );
        let deleted = 0;
        for (const proof of proofs) {
          if (signal.aborted) break;
          const path = `${proof.order_id}/${proof.assignment_id}/${proof.id}`;
          try {
            await network(
              '/storage/v1/object/order-proof',
              {
                method: 'DELETE',
                body: JSON.stringify({ prefixes: [path] }),
              },
              async (response) => {
                if (!response.ok) throw new Error('delete');
              },
            );
            const absent = await network(
              `/storage/v1/object/order-proof/${path}`,
              { method: 'GET' },
              async (response, signal) => {
                if (response.status === 404) return true;
                if (response.status !== 400) return false;
                const error: unknown = JSON.parse(
                  await boundedText(response.body, 2048, signal),
                );
                return (
                  !!error &&
                  typeof error === 'object' &&
                  'statusCode' in error &&
                  error.statusCode === '404' &&
                  'error' in error &&
                  error.error === 'not_found'
                );
              },
            );
            if (absent) deleted++;
          } catch {
            /* Retry abandoned rows later; return counts only. */
          }
        }
        return Response.json(
          { claimed: proofs.length, deleted, failed: proofs.length - deleted },
          { headers: { 'Cache-Control': 'no-store' } },
        );
      } catch {
        return failure(502);
      }
    } finally {
      clearTimeout(timer);
    }
  };
}
