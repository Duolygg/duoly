import type { APIContext } from 'astro';
import { beforeEach, expect, it, vi } from 'vitest';
import { accountContext } from '../../src/server/auth/context';
import { ALL } from '../../src/pages/api/teammate/profile-header';
import {
  storeHeader,
  removeHeader,
} from '../../src/server/teammates/profile-header';
vi.mock('../../src/server/auth/context', () => ({ accountContext: vi.fn() }));
vi.mock('../../src/server/teammates/profile-header', async (original) => ({
  ...(await original<
    typeof import('../../src/server/teammates/profile-header')
  >()),
  storeHeader: vi.fn(),
  removeHeader: vi.fn(),
}));
const token = 'a'.repeat(64);
const identity = vi.fn();
const bytes = Buffer.alloc(64);
bytes.write('RIFF');
bytes.write('WEBP', 8);
const image = 'data:image/webp;base64,' + bytes.toString('base64');
const url =
  'https://example.supabase.co/storage/v1/object/public/profile-headers/9f000000-0000-4000-8000-000000000001/0123456789abcdef.webp';
function ctx(
  method = 'POST',
  body: unknown = { csrf: token, image },
  origin = 'http://localhost',
) {
  const request = new Request('http://localhost/api/teammate/profile-header', {
    method,
    headers: { origin, 'content-type': 'application/json' },
    ...(method === 'GET' ? {} : { body: JSON.stringify(body) }),
  });
  return {
    request,
    url: new URL(request.url),
    cookies: { get: () => ({ value: token }) },
  } as unknown as APIContext;
}
const run = async (...args: Parameters<typeof ctx>) =>
  (await ALL(ctx(...args))) as Response;
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('PUBLIC_PROFILES_ENABLED', 'true');
  identity.mockResolvedValue({
    viewer: { id: '9f000000-0000-4000-8000-000000000001', role: 'teammate' },
  });
  vi.mocked(accountContext).mockReturnValue({
    identity,
    json: (b: unknown, status = 200) => Response.json(b, { status }),
    config: { origin: 'http://localhost' },
    names: { csrf: 'csrf' },
  } as unknown as ReturnType<typeof accountContext>);
  vi.mocked(storeHeader).mockResolvedValue(url);
  vi.mocked(removeHeader).mockResolvedValue(true);
});
it('uploads for the signed-in teammate and deletes with a JSON CSRF body', async () => {
  expect(await (await run()).json()).toEqual({ url });
  expect(await (await run('DELETE', { csrf: token })).json()).toEqual({
    ok: true,
  });
  expect(removeHeader).toHaveBeenCalledWith(
    '9f000000-0000-4000-8000-000000000001',
  );
});
it('requires authentication and the teammate role', async () => {
  identity.mockResolvedValueOnce(null);
  expect((await run()).status).toBe(401);
  identity.mockResolvedValueOnce({ viewer: { role: 'customer' } });
  expect((await run()).status).toBe(403);
  expect(storeHeader).not.toHaveBeenCalled();
});
it.each(['POST', 'DELETE'])(
  'requires CSRF and exact origin for %s',
  async (method) => {
    expect((await run(method, { csrf: 'wrong', image })).status).toBe(403);
    expect(
      (await run(method, { csrf: token, image }, 'https://evil.invalid'))
        .status,
    ).toBe(403);
    expect(storeHeader).not.toHaveBeenCalled();
    expect(removeHeader).not.toHaveBeenCalled();
  },
);
it('rejects wrong type, oversized payloads and caller-selected users', async () => {
  for (const body of [
    { csrf: token, image: image.replace('webp;', 'jpeg;') },
    { csrf: token, image: 'x'.repeat(420000) },
    { csrf: token, image, userId: 'other' },
  ])
    expect((await run('POST', body)).status).toBe(400);
  expect(storeHeader).not.toHaveBeenCalled();
});
it('fails closed on unavailable storage and unsupported methods', async () => {
  vi.mocked(storeHeader).mockResolvedValueOnce(null);
  expect((await run()).status).toBe(503);
  vi.mocked(removeHeader).mockResolvedValueOnce(false);
  expect((await run('DELETE', { csrf: token })).status).toBe(503);
  expect((await run('GET')).status).toBe(405);
  vi.stubEnv('PUBLIC_PROFILES_ENABLED', 'false');
  expect((await run()).status).toBe(404);
});
