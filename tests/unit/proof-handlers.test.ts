import type { APIContext, APIRoute } from 'astro';
import { beforeEach, expect, it, vi } from 'vitest';
import { accountContext } from '../../src/server/auth/context';
import { createProofBackend } from '../../src/server/proofs/backend';
import * as handlers from '../../src/server/proofs/handlers';
vi.mock('../../src/server/auth/context', () => ({ accountContext: vi.fn() }));
vi.mock('../../src/server/proofs/backend', () => ({
  createProofBackend: vi.fn(),
}));
const id = '00000000-0000-4000-8000-000000000001';
const assignment = '00000000-0000-4000-8000-000000000002';
const proofId = '00000000-0000-4000-8000-000000000003';
const token = 'a'.repeat(64);
const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
const proof = {
  id: proofId,
  order_id: id,
  assignment_id: assignment,
  mime: 'image/png',
  byte_size: png.length,
  created_at: '2026-10-22T09:30:00Z',
};
const rpc = vi.fn();
const identity = vi.fn();
const backend = { rpc: vi.fn(), put: vi.fn(), get: vi.fn(), remove: vi.fn() };
function ctx(
  method = 'POST',
  body: BodyInit | null = png,
  headers: Record<string, string> = {},
) {
  const request = new Request('http://localhost/api/proof', {
    method,
    headers: {
      origin: 'http://localhost',
      'content-type': 'image/png',
      'x-csrf-token': token,
      'x-assignment-id': assignment,
      'x-idempotency-key': id,
      ...headers,
    },
    ...(method === 'POST' ? { body, duplex: 'half' } : {}),
  });
  return {
    request,
    url: new URL(request.url),
    params: { id, proofId },
    cookies: { get: () => ({ value: token }) },
  } as unknown as APIContext;
}
const run = async (handler: APIRoute, context = ctx()) =>
  (await handler(context)) as Response;
beforeEach(() => {
  vi.resetAllMocks();
  identity.mockResolvedValue({ viewer: { role: 'teammate' } });
  rpc.mockImplementation(async (name: string) => ({
    data:
      name === 'authorize_order_proof_upload'
        ? { order_id: id, assignment_id: assignment }
        : name === 'begin_order_proof_upload'
          ? {
              id: proofId,
              order_id: id,
              assignment_id: assignment,
              state: 'pending',
            }
          : name === 'list_order_proofs'
            ? { proofs: [proof] }
            : { proof },
    error: null,
  }));
  backend.rpc.mockImplementation(async (name: string) => ({
    data:
      name === 'abandon_order_proof_upload' ? { abandoned: false } : { proof },
    error: null,
  }));
  backend.put.mockResolvedValue(undefined);
  backend.get.mockResolvedValue(png);
  backend.remove.mockResolvedValue(undefined);
  vi.mocked(createProofBackend).mockReturnValue(backend);
  vi.mocked(accountContext).mockReturnValue({
    client: { rpc },
    identity,
    config: { origin: 'http://localhost' },
    names: { csrf: 'csrf' },
    headers: new Headers({ 'Cache-Control': 'private, no-store' }),
    json: (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: {
          'Cache-Control': 'private, no-store',
          'Content-Type': 'application/json',
        },
      }),
  } as unknown as ReturnType<typeof accountContext>);
});
it.each(['list', 'image'] as const)(
  'authorizes %s through its exact RPC with private no-store responses',
  async (kind) => {
    const response = await run(handlers[kind], ctx('GET'));
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(rpc).toHaveBeenCalledExactlyOnceWith(
      kind === 'list' ? 'list_order_proofs' : 'get_order_proof',
      kind === 'list'
        ? { p_order_id: id }
        : { p_order_id: id, p_proof_id: proofId },
    );
    if (kind === 'list') {
      expect(await response.json()).toEqual({ proofs: [proof] });
      expect(backend.get).not.toHaveBeenCalled();
    } else {
      expect(new Uint8Array(await response.arrayBuffer())).toEqual(png);
      expect(response.headers.get('content-type')).toBe('image/png');
      expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    }
  },
);
it.each(['list', 'image'] as const)(
  'returns 404 for anonymous, malformed, denied, or wrong-pair %s',
  async (kind) => {
    identity.mockResolvedValue(null);
    expect((await run(handlers[kind], ctx('GET'))).status).toBe(404);
    expect(rpc).not.toHaveBeenCalled();
    identity.mockResolvedValue({ viewer: { role: 'customer' } });
    const bad = ctx('GET');
    bad.params.id = '../x';
    expect((await run(handlers[kind], bad)).status).toBe(404);
    rpc.mockResolvedValue({
      data: null,
      error: { code: 'PT404', message: 'secret' },
    });
    expect((await run(handlers[kind], ctx('GET'))).status).toBe(404);
    rpc.mockResolvedValue({
      data:
        kind === 'list'
          ? { proofs: [{ ...proof, order_id: assignment }] }
          : { proof: { ...proof, id: assignment } },
      error: null,
    });
    expect((await run(handlers[kind], ctx('GET'))).status).toBe(404);
    expect(backend.get).not.toHaveBeenCalled();
  },
);
it.each(['list', 'image', 'upload'] as const)(
  'binds uppercase/mixed-case %s route, headers and RPC responses canonically',
  async (kind) => {
    const ids = {
      order: 'abcdef01-abcd-4abc-8abc-abcdef012341',
      assignment: 'abcdef01-abcd-4abc-8abc-abcdef012342',
      proof: 'abcdef01-abcd-4abc-8abc-abcdef012343',
      request: 'abcdef01-abcd-4abc-8abc-abcdef012344',
    };
    const mixed = (value: string) => value.replaceAll('abcd', 'AbCd');
    const normalizedProof = {
      ...proof,
      id: ids.proof,
      order_id: ids.order,
      assignment_id: ids.assignment,
    };
    for (const responseCase of [false, true]) {
      rpc.mockClear();
      const context = ctx(kind === 'upload' ? 'POST' : 'GET', png, {
        'x-assignment-id': mixed(ids.assignment),
        'x-idempotency-key': ids.request.toUpperCase(),
      });
      context.params.id = ids.order.toUpperCase();
      context.params.proofId = mixed(ids.proof);
      const dto = responseCase
        ? {
            ...normalizedProof,
            id: ids.proof.toUpperCase(),
            order_id: mixed(ids.order),
            assignment_id: ids.assignment.toUpperCase(),
          }
        : normalizedProof;
      rpc.mockImplementation(async (name: string) => {
        if (name === 'authorize_order_proof_upload')
          return {
            data: { order_id: dto.order_id, assignment_id: dto.assignment_id },
            error: null,
          };
        if (name === 'begin_order_proof_upload')
          return {
            data: {
              id: dto.id,
              order_id: dto.order_id,
              assignment_id: dto.assignment_id,
              state: 'pending',
            },
            error: null,
          };
        if (name === 'list_order_proofs')
          return { data: { proofs: [dto] }, error: null };
        if (name === 'get_order_proof')
          return { data: { proof: dto }, error: null };
        throw new Error('Unexpected RPC: ' + name);
      });
      backend.rpc.mockResolvedValue({ data: { proof: dto }, error: null });
      const response = await run(handlers[kind], context);
      expect(response.status).toBe(200);
      if (kind === 'upload') {
        expect(rpc.mock.calls).toEqual([
          [
            'authorize_order_proof_upload',
            { p_order_id: ids.order, p_assignment_id: ids.assignment },
          ],
          [
            'begin_order_proof_upload',
            {
              p_order_id: ids.order,
              p_assignment_id: ids.assignment,
              p_request_id: ids.request,
            },
          ],
        ]);
        expect(backend.put).toHaveBeenLastCalledWith(
          { id: ids.proof, order_id: ids.order, assignment_id: ids.assignment },
          png,
          'image/png',
        );
        expect(backend.rpc).toHaveBeenLastCalledWith(
          'finalize_order_proof_upload',
          expect.objectContaining({ p_proof_id: ids.proof }),
        );
        expect(await response.json()).toEqual({ proof: normalizedProof });
      } else if (kind === 'list') {
        expect(rpc).toHaveBeenCalledExactlyOnceWith('list_order_proofs', {
          p_order_id: ids.order,
        });
        expect(await response.json()).toEqual({ proofs: [normalizedProof] });
      } else {
        expect(rpc).toHaveBeenCalledExactlyOnceWith('get_order_proof', {
          p_order_id: ids.order,
          p_proof_id: ids.proof,
        });
        expect(backend.get).toHaveBeenLastCalledWith({
          id: ids.proof,
          order_id: ids.order,
          assignment_id: ids.assignment,
        });
        expect(new Uint8Array(await response.arrayBuffer())).toEqual(png);
      }
    }
  },
);
it('authorizes image access before reporting storage unavailability', async () => {
  vi.mocked(createProofBackend).mockReturnValue(null);
  rpc.mockResolvedValue({
    data: null,
    error: { code: 'PT404', message: 'secret' },
  });
  expect((await run(handlers.image, ctx('GET'))).status).toBe(404);
  expect(rpc).toHaveBeenCalledWith('get_order_proof', {
    p_order_id: id,
    p_proof_id: proofId,
  });
});
it('never serves absent or invalid bytes and sanitizes infrastructure failures', async () => {
  backend.get.mockResolvedValue(null);
  expect((await run(handlers.image, ctx('GET'))).status).toBe(503);
  for (const bytes of [new Uint8Array(8), Uint8Array.from([...png, 1])]) {
    backend.get.mockResolvedValue(bytes);
    expect((await run(handlers.image, ctx('GET'))).status).toBe(503);
  }
  rpc.mockRejectedValue(new Error('secret/path'));
  const response = await run(handlers.image, ctx('GET'));
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain('secret');
});
it('binds the three non-prerendered public entry points to guarded ALL handlers', async () => {
  const list = await import('../../src/pages/api/orders/[id]/proof');
  const image = await import('../../src/pages/api/orders/[id]/proof/[proofId]');
  const upload = await import('../../src/pages/api/teammate/orders/[id]/proof');
  expect([list.prerender, image.prerender, upload.prerender]).toEqual([
    false,
    false,
    false,
  ]);
  expect(list.ALL).toBe(handlers.list);
  expect(image.ALL).toBe(handlers.image);
  expect(upload.ALL).toBe(handlers.upload);
});
it.each([
  'anonymous',
  'customer',
  'admin',
  'csrf',
  'origin',
  'assignment',
  'state',
  'disabled',
] as const)('rejects %s before reading the large body', async (failure) => {
  const context = ctx();
  if (failure === 'anonymous') identity.mockResolvedValue(null);
  if (failure === 'customer' || failure === 'admin')
    identity.mockResolvedValue({ viewer: { role: failure } });
  if (failure === 'csrf') context.request.headers.delete('x-csrf-token');
  if (failure === 'origin')
    context.request.headers.set('origin', 'https://evil.test');
  if (failure === 'assignment' || failure === 'state')
    rpc.mockResolvedValue({
      data: null,
      error: { code: 'PT409', message: 'secret' },
    });
  if (failure === 'disabled')
    vi.mocked(createProofBackend).mockReturnValue(null);
  const response = await run(handlers.upload, context);
  expect(response.status).toBe(
    failure === 'anonymous'
      ? 401
      : failure === 'disabled'
        ? 503
        : ['state', 'assignment'].includes(failure)
          ? 409
          : 403,
  );
  expect(context.request.bodyUsed).toBe(false);
  expect(backend.put).not.toHaveBeenCalled();
  expect(rpc.mock.calls.some((c) => c[0] === 'begin_order_proof_upload')).toBe(
    false,
  );
});
it.each(['url', 'path', 'role', 'price', 'actor_id'])(
  'rejects arbitrary query %s and malformed identifiers without reservation',
  async (field) => {
    const context = ctx();
    context.url.search = '?' + field + '=x';
    expect((await run(handlers.upload, context)).status).toBe(400);
    const badId = ctx('POST', png, { 'x-idempotency-key': '../x' });
    expect((await run(handlers.upload, badId)).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
    expect(backend.put).not.toHaveBeenCalled();
  },
);
it.each(['revoked', 'unrelated', 'wrong-pair', 'extra-field'])(
  'freshly authorizes %s before disabled storage or reading any body',
  async (mode) => {
    vi.mocked(createProofBackend).mockReturnValue(null);
    rpc.mockResolvedValue({
      data:
        mode === 'wrong-pair'
          ? { order_id: assignment, assignment_id: assignment }
          : mode === 'extra-field'
            ? { order_id: id, assignment_id: assignment, path: 'secret' }
            : null,
      error: ['revoked', 'unrelated'].includes(mode)
        ? { code: 'PT409', message: 'secret' }
        : null,
    });
    const requestedAssignment = mode === 'unrelated' ? proofId : assignment;
    const context = ctx('POST', png, {
      'x-assignment-id': requestedAssignment,
    });
    const body = vi.spyOn(context.request, 'body', 'get');
    const response = await run(handlers.upload, context);
    expect(response.status).toBe(
      ['revoked', 'unrelated'].includes(mode) ? 409 : 503,
    );
    expect(rpc).toHaveBeenCalledExactlyOnceWith(
      'authorize_order_proof_upload',
      {
        p_order_id: id,
        p_assignment_id: requestedAssignment,
      },
    );
    expect(createProofBackend).not.toHaveBeenCalled();
    expect(body).not.toHaveBeenCalled();
    expect(context.request.bodyUsed).toBe(false);
    expect(await response.text()).not.toContain('secret');
  },
);
it('checks storage only after successful fresh authorization and before body access', async () => {
  vi.mocked(createProofBackend).mockReturnValue(null);
  const context = ctx();
  const body = vi.spyOn(context.request, 'body', 'get');
  expect((await run(handlers.upload, context)).status).toBe(503);
  expect(rpc).toHaveBeenCalledExactlyOnceWith('authorize_order_proof_upload', {
    p_order_id: id,
    p_assignment_id: assignment,
  });
  expect(rpc.mock.invocationCallOrder[0]).toBeLessThan(
    vi.mocked(createProofBackend).mock.invocationCallOrder[0]!,
  );
  expect(body).not.toHaveBeenCalled();
});
it('binds actual streamed bytes, not Content-Length; overflow never reserves or stores', async () => {
  const bytes = new Uint8Array(1572864);
  bytes.set(png);
  backend.rpc.mockResolvedValue({
    data: { proof: { ...proof, byte_size: bytes.length } },
    error: null,
  });
  expect(
    (await run(handlers.upload, ctx('POST', bytes, { 'content-length': '1' })))
      .status,
  ).toBe(200);
  rpc.mockClear();
  backend.put.mockClear();
  let i = 0;
  let cancelled = false;
  const chunks = [bytes, new Uint8Array([1]), new Uint8Array([2])];
  const stream = new ReadableStream<Uint8Array>({
    pull(c) {
      c.enqueue(chunks[i++]!);
    },
    cancel() {
      cancelled = true;
    },
  });
  expect(
    (await run(handlers.upload, ctx('POST', stream, { 'content-length': '8' })))
      .status,
  ).toBe(413);
  expect(cancelled).toBe(true);
  expect(rpc.mock.calls.map((c) => c[0])).toEqual([
    'authorize_order_proof_upload',
  ]);
  expect(backend.put).not.toHaveBeenCalled();
});
it.each(['image/png', 'image/jpeg', 'image/webp'])(
  'round trips exact %s raw magic and response MIME',
  async (mime) => {
    const bytes =
      mime === 'image/png'
        ? png
        : mime === 'image/jpeg'
          ? Uint8Array.from([255, 216, 255])
          : new TextEncoder().encode('RIFF0000WEBP');
    backend.rpc.mockResolvedValue({
      data: { proof: { ...proof, mime, byte_size: bytes.length } },
      error: null,
    });
    expect(
      (await run(handlers.upload, ctx('POST', bytes, { 'content-type': mime })))
        .status,
    ).toBe(200);
    rpc.mockResolvedValue({
      data: { proof: { ...proof, mime, byte_size: bytes.length } },
      error: null,
    });
    backend.get.mockResolvedValue(bytes);
    const response = await run(handlers.image, ctx('GET'));
    expect(response.headers.get('content-type')).toBe(mime);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
  },
);
it.each(['empty', 'mismatch', 'unsupported', 'json'])(
  'rejects %s bodies before reservation',
  async (kind) => {
    const body =
      kind === 'empty'
        ? new Uint8Array()
        : kind === 'json'
          ? new TextEncoder().encode('{"path":"x","role":"admin"}')
          : png;
    const mime =
      kind === 'unsupported'
        ? 'image/jpg'
        : kind === 'mismatch'
          ? 'image/jpeg'
          : kind === 'json'
            ? 'application/json'
            : 'image/png';
    expect(
      (await run(handlers.upload, ctx('POST', body, { 'content-type': mime })))
        .status,
    ).toBe(400);
    expect(rpc.mock.calls.map((c) => c[0])).toEqual([
      'authorize_order_proof_upload',
    ]);
    expect(backend.put).not.toHaveBeenCalled();
  },
);
it.each(['list', 'image', 'upload'] as const)(
  'rejects unsupported %s methods without identity, RPC or storage',
  async (kind) => {
    const response = await run(handlers[kind], ctx('DELETE'));
    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe(
      kind === 'upload' ? 'POST' : 'GET',
    );
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(identity).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
    expect(backend.get).not.toHaveBeenCalled();
  },
);
it('keeps a concurrent matching winner ready when a racing finalizer loses its ACK', async () => {
  let object: Uint8Array | null = null;
  let ready = false;
  let releaseFirst!: () => void;
  const firstWrite = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  let announceFirst!: () => void;
  const written = new Promise<void>((resolve) => {
    announceFirst = resolve;
  });
  backend.put.mockImplementation(async (_binding, bytes: Uint8Array) => {
    if (object) throw new Error('duplicate');
    object = bytes;
    announceFirst();
    await firstWrite;
  });
  backend.get.mockImplementation(async () => object);
  backend.rpc.mockImplementation(async (name: string) => {
    if (name === 'abandon_order_proof_upload')
      return { data: { abandoned: !ready }, error: null };
    if (ready) return { data: null, error: { message: 'lost ack' } };
    ready = true;
    return { data: { proof }, error: null };
  });
  const first = run(handlers.upload);
  await written;
  const second = await run(handlers.upload);
  expect(second.status).toBe(200);
  releaseFirst();
  expect((await first).status).toBe(503);
  expect(ready).toBe(true);
  expect(object).toEqual(png);
  expect(backend.remove).not.toHaveBeenCalled();
});
it.each(['unavailable', 'absent', 'delete-fail', 'delete-not-verified'])(
  'handles storage failure %s without a ready attachment or unsafe deletion',
  async (mode) => {
    backend.put.mockRejectedValue(new Error('secret'));
    backend.rpc.mockResolvedValue({ data: { abandoned: true }, error: null });
    if (mode === 'unavailable')
      backend.get.mockRejectedValue(new Error('secret'));
    else backend.get.mockResolvedValue(null);
    if (mode === 'delete-fail')
      backend.remove.mockRejectedValue(new Error('secret'));
    if (mode === 'delete-not-verified')
      backend.get.mockResolvedValueOnce(null).mockResolvedValue(png);
    const response = await run(handlers.upload);
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('secret');
    expect(
      backend.rpc.mock.calls.every(
        (c) => c[0] !== 'finalize_order_proof_upload',
      ),
    ).toBe(true);
    if (mode === 'unavailable') {
      expect(backend.remove).not.toHaveBeenCalled();
      expect(backend.rpc).not.toHaveBeenCalled();
    } else {
      expect(backend.rpc).toHaveBeenCalledWith('abandon_order_proof_upload', {
        p_proof_id: proofId,
      });
      expect(backend.remove).toHaveBeenCalledOnce();
    }
  },
);
it.each([
  'reservation-pair',
  'reservation-leak',
  'final-pair',
  'final-leak',
  'slot-conflict',
])(
  'rejects unsafe %s RPC results without exposing internal fields',
  async (mode) => {
    const base = rpc.getMockImplementation()!;
    if (mode.startsWith('reservation'))
      rpc.mockImplementation(async (name: string, ...args: unknown[]) =>
        name === 'begin_order_proof_upload'
          ? {
              data: {
                id: proofId,
                order_id: mode === 'reservation-pair' ? assignment : id,
                assignment_id: assignment,
                state: 'pending',
                ...(mode === 'reservation-leak' ? { path: 'secret' } : {}),
              },
              error: null,
            }
          : base(name, ...args),
      );
    if (mode === 'slot-conflict')
      rpc.mockImplementation(async (name: string, ...args: unknown[]) =>
        name === 'begin_order_proof_upload'
          ? { data: { error: { code: 409, message: 'secret' } }, error: null }
          : base(name, ...args),
      );
    if (mode.startsWith('final'))
      backend.rpc.mockImplementation(async (name: string) => ({
        data:
          name === 'abandon_order_proof_upload'
            ? { abandoned: false }
            : {
                proof: {
                  ...proof,
                  ...(mode === 'final-pair'
                    ? { assignment_id: id }
                    : { sha256: 'secret' }),
                },
              },
        error: null,
      }));
    const response = await run(handlers.upload);
    expect(response.status).toBe(mode === 'slot-conflict' ? 409 : 503);
    expect(await response.text()).not.toContain('secret');
    if (!mode.startsWith('final')) expect(backend.put).not.toHaveBeenCalled();
  },
);
it('uploads raw private bytes only after fresh identity and assignment, reserves and finalizes exact binding', async () => {
  const response = await run(handlers.upload);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ proof });
  expect(rpc.mock.calls.map((c) => c[0])).toEqual([
    'authorize_order_proof_upload',
    'begin_order_proof_upload',
  ]);
  expect(backend.put).toHaveBeenCalledWith(
    { id: proofId, order_id: id, assignment_id: assignment },
    png,
    'image/png',
  );
  expect(backend.rpc).toHaveBeenCalledWith('finalize_order_proof_upload', {
    p_proof_id: proofId,
    p_mime: 'image/png',
    p_byte_size: 8,
    p_sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
  });
  expect(response.headers.get('cache-control')).toContain('no-store');
});

it.each(['duplicate', 'ambiguous'])(
  'recovers %s ACK by comparing stored bytes before finalizing',
  async () => {
    backend.put.mockRejectedValue(new Error('ambiguous secret'));
    const response = await run(handlers.upload);
    expect(response.status).toBe(200);
    expect(backend.get).toHaveBeenCalledOnce();
    expect(backend.remove).not.toHaveBeenCalled();
    expect(backend.rpc.mock.calls.map((c) => c[0])).toEqual([
      'finalize_order_proof_upload',
    ]);
  },
);
it('compares bytes even when the conflicting object has the same MIME and length', async () => {
  backend.put.mockRejectedValue(new Error('duplicate'));
  const original = Uint8Array.from([...png, 1]);
  backend.get.mockResolvedValue(Uint8Array.from([...png, 2]));
  expect((await run(handlers.upload, ctx('POST', original))).status).toBe(409);
  expect(backend.rpc).not.toHaveBeenCalled();
  expect(backend.remove).not.toHaveBeenCalled();
});
it('never overwrites or abandons a conflicting idempotent object', async () => {
  backend.put.mockRejectedValue(new Error('duplicate'));
  backend.get.mockResolvedValue(Uint8Array.from([...png, 1]));
  expect((await run(handlers.upload)).status).toBe(409);
  expect(backend.rpc).not.toHaveBeenCalled();
  expect(backend.remove).not.toHaveBeenCalled();
});
it.each([true, false, 'error'])(
  'compensates failed finalize only when abandon succeeds: %s',
  async (abandoned) => {
    backend.rpc.mockImplementation(async (name: string) =>
      name === 'finalize_order_proof_upload'
        ? { data: null, error: { code: 'PT409', message: 'secret' } }
        : abandoned === 'error'
          ? { data: null, error: { message: 'secret' } }
          : { data: { abandoned }, error: null },
    );
    backend.get.mockResolvedValue(null);
    const response = await run(handlers.upload);
    expect(response.status).toBe(409);
    expect(await response.text()).not.toContain('secret');
    if (abandoned === true) {
      expect(backend.remove).toHaveBeenCalledOnce();
      expect(backend.get).toHaveBeenCalledOnce();
    } else expect(backend.remove).not.toHaveBeenCalled();
  },
);
it('checks ready retries against stored bytes without attempting an overwrite', async () => {
  rpc.mockImplementation(async (name: string) => ({
    data:
      name === 'authorize_order_proof_upload'
        ? { order_id: id, assignment_id: assignment }
        : {
            id: proofId,
            order_id: id,
            assignment_id: assignment,
            state: 'ready',
          },
    error: null,
  }));
  expect((await run(handlers.upload)).status).toBe(200);
  expect(backend.put).not.toHaveBeenCalled();
  expect(backend.get).toHaveBeenCalledOnce();
});
it('lets a teammate take back their own screenshot through the guarded remove route', async () => {
  rpc.mockResolvedValue({
    data: { removed: true, proof_id: proofId },
    error: null,
  });
  const response = await run(handlers.remove, ctx('POST', null));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ removed: true, proof_id: proofId });
  expect(rpc).toHaveBeenCalledWith('teammate_remove_order_proof', {
    p_order_id: id,
    p_assignment_id: assignment,
    p_proof_id: proofId,
  });
  // storage is never touched: the database only hides the screenshot
  expect(backend.remove).not.toHaveBeenCalled();
  const route =
    await import('../../src/pages/api/teammate/orders/[id]/proof/[proofId]');
  expect(route.prerender).toBe(false);
  expect(route.ALL).toBe(handlers.remove);
});
it.each(['get', 'csrf', 'customer', 'assignment', 'mismatch', 'sql'])(
  'refuses a screenshot removal: %s',
  async (mode) => {
    rpc.mockResolvedValue(
      mode === 'sql'
        ? { data: null, error: { code: 'PT409', message: 'secret' } }
        : {
            data: {
              removed: true,
              proof_id: mode === 'mismatch' ? id : proofId,
            },
            error: null,
          },
    );
    if (mode === 'customer')
      identity.mockResolvedValue({ viewer: { role: 'customer' } });
    const context =
      mode === 'get'
        ? ctx('GET')
        : mode === 'csrf'
          ? ctx('POST', null, { 'x-csrf-token': 'b'.repeat(64) })
          : mode === 'assignment'
            ? ctx('POST', null, { 'x-assignment-id': 'nope' })
            : ctx('POST', null);
    const response = await run(handlers.remove, context);
    expect(response.status).toBe(
      {
        get: 405,
        csrf: 403,
        customer: 403,
        assignment: 400,
        mismatch: 503,
        sql: 409,
      }[mode],
    );
    expect(await response.text()).not.toContain('secret');
    if (['get', 'csrf', 'customer', 'assignment'].includes(mode))
      expect(rpc).not.toHaveBeenCalled();
  },
);
