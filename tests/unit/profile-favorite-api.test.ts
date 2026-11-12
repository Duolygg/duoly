import type { APIContext } from 'astro';
import { beforeEach, expect, it, vi } from 'vitest';
import { accountContext } from '../../src/server/auth/context';
import { favoriteBySlug } from '../../src/server/teammates/favorite-handlers';

/*
 * POST /api/favorites/by-slug: the endpoint behind "Book with <Name>" and the Save heart on a
 * public profile. It names a teammate by their public slug, so the customer never needs an order
 * with them first, and the answer never carries a teammate id.
 */
vi.mock('../../src/server/auth/context', () => ({ accountContext: vi.fn() }));
const rpc = vi.fn();
const identity = vi.fn();
const token = 'a'.repeat(64);
const answer = { favorite: true, slug: 'nyx', game: 'lol' };
const missing = {
  data: null,
  error: { code: 'PGRST202', message: 'Could not find the function' },
  status: 404,
};
function ctx(body?: unknown, origin = 'http://localhost', search = '') {
  const request = new Request(
    'http://localhost/api/favorites/by-slug' + search,
    {
      method: body === undefined ? 'GET' : 'POST',
      headers: { origin, 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
  );
  return {
    request,
    url: new URL(request.url),
    cookies: { get: () => ({ value: token }) },
  } as unknown as APIContext;
}
const run = async (c: APIContext) => (await favoriteBySlug(c)) as Response;
const post = (body: unknown, origin?: string, search?: string) =>
  ctx({ csrf: token, ...(body as object) }, origin, search);

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('PUBLIC_PROFILES_ENABLED', 'true');
  identity.mockResolvedValue({ viewer: { role: 'customer' } });
  rpc.mockResolvedValue({ data: answer, error: null });
  vi.mocked(accountContext).mockReturnValue({
    client: { rpc },
    identity,
    json: (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), { status }),
    config: { origin: 'http://localhost' },
    names: { csrf: 'csrf' },
  } as unknown as ReturnType<typeof accountContext>);
});

it('saves the teammate named by their slug and answers the game to book', async () => {
  const response = await run(post({ slug: 'nyx' }));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(answer);
  expect(rpc).toHaveBeenCalledWith('customer_favorite_add_by_slug', {
    p_slug: 'nyx',
  });
});

it('is POST only', async () => {
  const response = await run(ctx());
  expect(response.status).toBe(405);
  expect(response.headers.get('Allow')).toBe('POST');
  expect(rpc).not.toHaveBeenCalled();
});

it('verifies CSRF and the origin before anything else', async () => {
  expect((await run(ctx({ slug: 'nyx' }))).status).toBe(403);
  expect(
    (await run(post({ slug: 'nyx' }, 'https://evil.invalid'))).status,
  ).toBe(403);
  expect(rpc).not.toHaveBeenCalled();
});

it.each([
  { slug: 'admin' },
  { slug: 'no' },
  { slug: 'Nyx' },
  { slug: '../secrets' },
  { slug: 'nyx', extra: 1 },
  {},
])('refuses a slug the profile pages could not have shown %j', async (bad) => {
  expect((await run(post(bad))).status).toBe(400);
  expect(rpc).not.toHaveBeenCalled();
});

it('refuses a query string on a mutation', async () => {
  expect((await run(post({ slug: 'nyx' }, undefined, '?book=1'))).status).toBe(
    400,
  );
  expect(rpc).not.toHaveBeenCalled();
});

it('needs a signed-in customer', async () => {
  identity.mockResolvedValueOnce(null);
  expect((await run(post({ slug: 'nyx' }))).status).toBe(401);
  identity.mockResolvedValueOnce({ viewer: { role: 'teammate' } });
  expect((await run(post({ slug: 'nyx' }))).status).toBe(403);
  expect(rpc).not.toHaveBeenCalled();
});

it('passes the customer-worded refusals through, and only those', async () => {
  rpc.mockResolvedValueOnce({
    data: {
      error: {
        code: 409,
        message: 'You can have up to 100 favorites. Remove one first.',
      },
    },
    error: null,
  });
  let response = await run(post({ slug: 'nyx' }));
  expect(response.status).toBe(409);
  expect((await response.json()).error).toBe(
    'You can have up to 100 favorites. Remove one first.',
  );
  rpc.mockResolvedValueOnce({
    data: { error: { code: 404, message: 'internal detail' } },
    error: null,
  });
  response = await run(post({ slug: 'nyx' }));
  expect(response.status).toBe(404);
  expect((await response.json()).error).toBe('Saving failed.');
});

it('hides an unexpected answer shape, including a leaked teammate id', async () => {
  rpc.mockResolvedValueOnce({
    data: { ...answer, teammateId: '00000000-0000-4000-8000-000000000001' },
    error: null,
  });
  expect((await run(post({ slug: 'nyx' }))).status).toBe(503);
  rpc.mockResolvedValueOnce({ data: null, error: { code: '22000' } });
  expect((await run(post({ slug: 'nyx' }))).status).toBe(503);
});

it('says saving is unavailable before the migration is applied', async () => {
  rpc.mockResolvedValue(missing);
  expect((await run(post({ slug: 'nyx' }))).status).toBe(503);
});

it('does not touch the database with the launch flag off', async () => {
  vi.stubEnv('PUBLIC_PROFILES_ENABLED', 'false');
  expect((await run(post({ slug: 'nyx' }))).status).toBe(404);
  expect(rpc).not.toHaveBeenCalled();
});
