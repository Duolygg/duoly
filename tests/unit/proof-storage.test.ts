import { expect, it, vi, afterEach } from 'vitest';
import { createProofBackend } from '../../src/server/proofs/backend';
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it('defaults storage off, requires a server credential, and uses private immutable computed keys', async () => {
  expect(createProofBackend({})).toBeNull();
  expect(
    createProofBackend({
      ORDER_PROOFS_ENABLED: 'true',
      SUPABASE_URL: 'https://test.supabase.co',
    }),
  ).toBeNull();
  const fetcher = vi
    .fn()
    .mockResolvedValue(new Response(null, { status: 200 }));
  vi.stubGlobal('fetch', fetcher);
  const backend = createProofBackend({
    ORDER_PROOFS_ENABLED: 'true',
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'server-secret',
  })!;
  const id = '00000000-0000-4000-8000-000000000001';
  const binding = { id, order_id: id, assignment_id: id };
  await backend.put(binding, new Uint8Array([255, 216, 255]), 'image/jpeg');
  const [url, options] = fetcher.mock.calls[0]!;
  expect(url).toBe(
    `https://test.supabase.co/storage/v1/object/order-proof/${id}/${id}/${id}`,
  );
  expect(options.method).toBe('POST');
  expect(new Headers(options.headers).get('x-upsert')).toBe('false');
  expect(new Headers(options.headers).get('authorization')).toBe(
    'Bearer server-secret',
  );
  fetcher.mockResolvedValueOnce(new Response(null, { status: 404 }));
  expect(await backend.get(binding)).toBeNull();
  fetcher.mockResolvedValueOnce(
    Response.json(
      { statusCode: '404', error: 'not_found', message: 'Object not found' },
      { status: 400 },
    ),
  );
  expect(await backend.get(binding)).toBeNull();
  fetcher.mockResolvedValueOnce(
    Response.json(
      { statusCode: '400', error: 'invalid_request' },
      { status: 400 },
    ),
  );
  await expect(backend.get(binding)).rejects.toThrow(
    'Proof service unavailable',
  );
  fetcher.mockResolvedValueOnce(new Response('secret', { status: 403 }));
  await expect(backend.get(binding)).rejects.toThrow(
    'Proof service unavailable',
  );
});
import { cleanupStaleProofUploads } from '../../src/server/proofs/cleanup';
import { MAX_PROOF_BYTES } from '../../src/contracts/proofs';
it('trusted cleanup claims first, deletes only computed paths, verifies absence and reports retryable failures', async () => {
  vi.stubEnv('ORDER_PROOFS_ENABLED', 'true');
  vi.stubEnv('SUPABASE_URL', 'https://test.supabase.co');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'server-secret');
  const id = '00000000-0000-4000-8000-000000000001';
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(
      Response.json({ proofs: [{ id, order_id: id, assignment_id: id }] }),
    )
    .mockResolvedValueOnce(Response.json([]))
    .mockResolvedValueOnce(new Response(null, { status: 404 }));
  vi.stubGlobal('fetch', fetcher);
  expect(await cleanupStaleProofUploads(2)).toEqual({
    claimed: 1,
    deleted: 1,
    failed: 0,
  });
  expect(fetcher.mock.calls[0]?.[0]).toContain(
    '/rpc/claim_stale_order_proof_uploads',
  );
  expect(JSON.parse(fetcher.mock.calls[1]?.[1].body)).toEqual({
    prefixes: [`${id}/${id}/${id}`],
  });
  fetcher
    .mockReset()
    .mockResolvedValueOnce(
      Response.json({ proofs: [{ id, order_id: id, assignment_id: id }] }),
    )
    .mockResolvedValueOnce(Response.json([]))
    .mockResolvedValueOnce(new Response(png));
  expect(await cleanupStaleProofUploads()).toEqual({
    claimed: 1,
    deleted: 0,
    failed: 1,
  });
  fetcher.mockReset().mockResolvedValueOnce(
    Response.json({
      proofs: [{ id, order_id: id, assignment_id: id, state: 'ready' }],
    }),
  );
  await expect(cleanupStaleProofUploads()).rejects.toThrow();
  expect(fetcher).toHaveBeenCalledOnce();
  vi.unstubAllEnvs();
});
import {
  readProofBytes,
  validateProofBytes,
  proofDigest,
  proofPath,
} from '../../src/server/proofs/storage';
const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
it('validates exact PNG/JPEG/WebP magic, not MIME claims', () => {
  for (const [mime, bytes] of [
    ['image/png', png],
    ['image/jpeg', Uint8Array.from([255, 216, 255])],
    ['image/webp', new TextEncoder().encode('RIFF0000WEBP')],
  ] as const) {
    expect(validateProofBytes(bytes, mime)).toBe(mime);
    for (let n = 0; n < bytes.length; n++)
      expect(() => validateProofBytes(bytes.slice(0, n), mime)).toThrow();
  }
  for (const mime of [
    'image/jpg',
    'text/plain',
    'image/jpeg',
    'image/png; charset=utf-8',
  ])
    expect(() => validateProofBytes(png, mime)).toThrow();
  expect(proofDigest(png)).toMatch(/^[0-9a-f]{64}$/);
});
it('caps actual streams at the inclusive limit, cancels chunk overflow independently of headers', async () => {
  const bytes = new Uint8Array(MAX_PROOF_BYTES);
  bytes.set(png);
  expect((await readProofBytes(new Blob([bytes]).stream())).length).toBe(
    MAX_PROOF_BYTES,
  );
  let cancelled = false;
  let index = 0;
  const chunks = [bytes, new Uint8Array([1]), new Uint8Array([2])];
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      controller.enqueue(chunks[index++]!);
    },
    cancel() {
      cancelled = true;
    },
  });
  await expect(readProofBytes(stream)).rejects.toThrow();
  expect(cancelled).toBe(true);
  await expect(readProofBytes(new Blob([]).stream())).rejects.toThrow();
});
it('computes only validated three-UUID storage paths', () => {
  const id = '00000000-0000-4000-8000-000000000001';
  expect(proofPath({ id, order_id: id, assignment_id: id })).toBe(
    `${id}/${id}/${id}`,
  );
  expect(() =>
    proofPath({ id: '../x', order_id: id, assignment_id: id }),
  ).toThrow();
});
