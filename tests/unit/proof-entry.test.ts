import { expect, it, vi } from 'vitest';

it('uses the explicitly provisioned service-role credential rather than a separately minted runtime key', async () => {
  const configured: Record<string, string> = {
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'different-runtime-generated-key',
    PRIVATE_PROOF_CLEANUP_SERVICE_ROLE_KEY: 'provisioned-native-service-key',
  };
  const serve =
    vi.fn<(handler: (request: Request) => Promise<Response>) => unknown>();
  const network = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response(JSON.stringify({ proofs: [] })));
  vi.stubGlobal('Deno', {
    env: { get: (name: string) => configured[name] },
    serve,
  });
  vi.stubGlobal('fetch', network);
  try {
    await import('../../supabase/functions/private-proof-cleanup/index.ts');
    const handler = serve.mock.calls[0]![0];
    const response = await handler(
      new Request(
        'https://example.supabase.co/functions/v1/private-proof-cleanup',
        {
          method: 'POST',
          headers: { Authorization: 'Bearer provisioned-native-service-key' },
          body: '{}',
        },
      ),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      claimed: 0,
      deleted: 0,
      failed: 0,
    });
    expect(
      new Headers(network.mock.calls[0]![1]?.headers).get('Authorization'),
    ).toBe('Bearer provisioned-native-service-key');
  } finally {
    vi.unstubAllGlobals();
  }
});
