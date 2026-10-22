import { describe, expect, it, vi } from 'vitest';
import { createCleanupHandler } from '../../supabase/functions/private-proof-cleanup/handler';

const env = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
};
const request = (body?: string, authorization = 'Bearer test-service-key') =>
  new Request('https://function.example/', {
    method: 'POST',
    headers: { authorization },
    body,
  });

const binding = {
  id: '11111111-1111-4111-8111-111111111111',
  order_id: '22222222-2222-4222-8222-222222222222',
  assignment_id: '33333333-3333-4333-8333-333333333333',
};
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status });

describe('private proof maintenance', () => {
  it('fails closed when the native constant-time verifier rejects the credential', async () => {
    const verifier = vi
      .spyOn(crypto.subtle, 'verify')
      .mockResolvedValueOnce(false);
    try {
      const fetcher = vi.fn<typeof fetch>();
      const req = request('{"url":"https://evil.test"}');
      expect((await createCleanupHandler(env, fetcher)(req)).status).toBe(401);
      expect(req.bodyUsed).toBe(false);
      expect(fetcher).not.toHaveBeenCalled();
      expect(verifier).toHaveBeenCalledTimes(1);
    } finally {
      verifier.mockRestore();
    }
  });
  it('accepts only an empty JSON object, never URL parameters', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => json({ proofs: [] }));
    expect(
      (await createCleanupHandler(env, fetcher)(request(' { } '))).status,
    ).toBe(200);
    const req = new Request('https://function.example/?limit=1', {
      method: 'POST',
      headers: { authorization: 'Bearer test-service-key' },
    });
    expect((await createCleanupHandler(env, fetcher)(req)).status).toBe(400);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('cancels a stalled inbound body without making a network request', async () => {
    vi.useFakeTimers();
    try {
      let cancelled = false;
      const stream = new ReadableStream<Uint8Array>({
        cancel() {
          cancelled = true;
        },
      });
      const req = new Request('https://function.example/', {
        method: 'POST',
        body: stream,
        headers: { authorization: 'Bearer test-service-key' },
        duplex: 'half',
      } as RequestInit);
      const fetcher = vi.fn<typeof fetch>();
      const pending = createCleanupHandler(env, fetcher)(req);
      await vi.waitFor(() => expect(req.bodyUsed).toBe(true));
      await vi.advanceTimersByTimeAsync(3001);
      expect((await pending).status).toBe(400);
      expect(cancelled).toBe(true);
      expect(fetcher).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
  it('stops the whole batch by its overall deadline with unattempted rows counted failed', async () => {
    vi.useFakeTimers();
    try {
      const proofs = Array.from({ length: 25 }, (_, i) => ({
        ...binding,
        id: `${i.toString().padStart(8, '0')}-1111-4111-8111-111111111111`,
      }));
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(json({ proofs }))
        .mockImplementation(() => new Promise(() => {}));
      const pending = createCleanupHandler(env, fetcher)(request());
      await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
      await vi.advanceTimersByTimeAsync(20001);
      const response = await pending;
      expect(await response.json()).toEqual({
        claimed: 25,
        deleted: 0,
        failed: 25,
      });
      expect(fetcher).toHaveBeenCalledTimes(8);
      expect(fetcher.mock.calls.at(-1)?.[1]?.signal?.aborted).toBe(true);
      await vi.advanceTimersByTimeAsync(10000);
      expect(fetcher).toHaveBeenCalledTimes(8);
    } finally {
      vi.useRealTimers();
    }
  });
  it('bounds a stalled RPC and cancels its fetch signal', async () => {
    vi.useFakeTimers();
    try {
      const fetcher = vi.fn<typeof fetch>(() => new Promise(() => {}));
      const pending = createCleanupHandler(env, fetcher)(request());
      await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
      await vi.advanceTimersByTimeAsync(3001);
      const response = await pending;
      expect(response.status).toBe(502);
      expect(fetcher.mock.calls[0][1]?.signal?.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
  it('bounds stalled input and RPC response streams without reading beyond byte caps', async () => {
    vi.useFakeTimers();
    try {
      let cancelled = false;
      const stream = new ReadableStream<Uint8Array>({
        cancel() {
          cancelled = true;
        },
      });
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(stream));
      const pending = createCleanupHandler(env, fetcher)(request());
      await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
      await vi.advanceTimersByTimeAsync(3001);
      expect((await pending).status).toBe(502);
      expect(cancelled).toBe(true);
    } finally {
      vi.useRealTimers();
    }
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(' '.repeat(16385)));
    expect((await createCleanupHandler(env, fetcher)(request())).status).toBe(
      502,
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('honors caller cancellation before starting network', async () => {
    const controller = new AbortController();
    controller.abort();
    const req = new Request(request(), { signal: controller.signal });
    const fetcher = vi.fn<typeof fetch>();
    expect((await createCleanupHandler(env, fetcher)(req)).status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('counts deletion only after verified absence and retains retryable per-object failures', async () => {
    for (const [readback, deleted] of [
      [
        json(
          {
            statusCode: '404',
            error: 'not_found',
            message: 'Object not found',
          },
          400,
        ),
        1,
      ],
      [json({ statusCode: 404, error: 'not_found' }, 400), 0],
      [json({ statusCode: '404', error: 'Forbidden' }, 400), 0],
      [new Response('not found', { status: 400 }), 0],
      [new Response('still present'), 0],
      [new Response(null, { status: 403 }), 0],
    ] as const) {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(json({ proofs: [binding] }))
        .mockResolvedValueOnce(json([]))
        .mockResolvedValueOnce(readback);
      const response = await createCleanupHandler(env, fetcher)(request());
      expect(await response.json()).toEqual({
        claimed: 1,
        deleted,
        failed: 1 - deleted,
      });
    }
    for (const failure of [
      new Error('secret-locator'),
      new Response('secret-locator', { status: 500 }),
    ]) {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(
          json({ proofs: [binding, { ...binding, id: binding.order_id }] }),
        );
      if (failure instanceof Error) fetcher.mockRejectedValueOnce(failure);
      else fetcher.mockResolvedValueOnce(failure);
      fetcher
        .mockResolvedValueOnce(json([]))
        .mockResolvedValueOnce(new Response(null, { status: 404 }));
      const response = await createCleanupHandler(env, fetcher)(request());
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        claimed: 2,
        deleted: 1,
        failed: 1,
      });
      expect(fetcher).toHaveBeenCalledTimes(4);
    }
  });
  it('validates the entire exact claim DTO before any storage operation', async () => {
    const invalid: unknown[] = [
      null,
      [],
      { proofs: [], url: 'evil' },
      { proofs: 'bad' },
      { proofs: [{ ...binding, state: 'ready' }] },
      { proofs: [{ id: binding.id }] },
      { proofs: [{ ...binding, order_id: '../ready' }] },
      { proofs: [{ ...binding, id: 123 }] },
      { proofs: [binding, binding] },
      { proofs: [binding, { ...binding, order_id: binding.id }] },
      { proofs: [binding, { ...binding, id: 'invalid' }] },
      {
        proofs: Array.from({ length: 26 }, (_, i) => ({
          ...binding,
          id: `${i.toString().padStart(8, '0')}-1111-4111-8111-111111111111`,
        })),
      },
    ];
    for (const value of invalid) {
      const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json(value));
      const result = await createCleanupHandler(env, fetcher)(request());
      expect(result.status, JSON.stringify(value)).toBe(502);
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(await result.text()).not.toContain(binding.id);
    }
  });
  it('claims a fixed batch, deletes only computed private paths, and reads absence back', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ proofs: [binding] }))
      .mockResolvedValueOnce(json([]))
      .mockResolvedValueOnce(new Response(null, { status: 404 }));
    const response = await createCleanupHandler(env, fetcher)(request('{}'));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      claimed: 1,
      deleted: 1,
      failed: 0,
    });
    expect(
      fetcher.mock.calls.map(([url, options]) => [url, options?.method]),
    ).toEqual([
      [
        `${env.SUPABASE_URL}/rest/v1/rpc/claim_stale_order_proof_uploads`,
        'POST',
      ],
      [`${env.SUPABASE_URL}/storage/v1/object/order-proof`, 'DELETE'],
      [
        `${env.SUPABASE_URL}/storage/v1/object/order-proof/${binding.order_id}/${binding.assignment_id}/${binding.id}`,
        'GET',
      ],
    ]);
    expect(JSON.parse(fetcher.mock.calls[0][1]!.body as string)).toEqual({
      p_limit: 25,
    });
    expect(JSON.parse(fetcher.mock.calls[1][1]!.body as string)).toEqual({
      prefixes: [`${binding.order_id}/${binding.assignment_id}/${binding.id}`],
    });
    for (const [, options] of fetcher.mock.calls) {
      expect(options).toMatchObject({
        redirect: 'error',
        cache: 'no-store',
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: 'Bearer test-service-key',
        },
      });
      expect(options?.signal).toBeInstanceOf(AbortSignal);
    }
  });
  it('rejects non-POST, unsafe environment and caller-controlled work before network', async () => {
    const fetcher = vi.fn<typeof fetch>();
    const handler = createCleanupHandler(env, fetcher);
    expect(
      (await handler(new Request('https://function.example/'))).status,
    ).toBe(405);
    for (const body of [
      'null',
      '[]',
      '{"limit":1}',
      '{"url":"https://evil.test"}',
      '{',
      ' '.repeat(65),
      '{"actor_id":"x"}',
    ]) {
      expect((await handler(request(body))).status).toBe(400);
    }
    for (const SUPABASE_URL of [
      'http://example.supabase.co',
      'https://evil.test',
      'https://example.supabase.co:444',
      'https://example.supabase.co/path',
      'https://user@example.supabase.co',
      'https://example.supabase.co/?x=y',
    ]) {
      expect(
        (
          await createCleanupHandler(
            { ...env, SUPABASE_URL },
            fetcher,
          )(request())
        ).status,
      ).toBe(503);
    }
    expect(
      (
        await createCleanupHandler(
          { SUPABASE_URL: env.SUPABASE_URL },
          fetcher,
        )(request())
      ).status,
    ).toBe(503);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('denies missing/ordinary credentials before reading a body or networking', async () => {
    const fetcher = vi.fn<typeof fetch>();
    const handler = createCleanupHandler(env, fetcher);
    for (const auth of [
      '',
      'Bearer anon',
      'Bearer user.jwt.token',
      'bearer test-service-key',
      'Bearer test-service-key extra',
    ]) {
      const req = request('{"url":"https://evil.test","key":"caller"}', auth);
      expect((await handler(req)).status).toBe(401);
      expect(req.bodyUsed).toBe(false);
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
});
