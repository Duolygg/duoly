import type { APIContext, APIRoute } from 'astro';
import { beforeEach, expect, it, vi } from 'vitest';
import { accountContext } from '../../src/server/auth/context';
import { review, stats } from '../../src/server/reviews/handlers';

vi.mock('../../src/server/auth/context', () => ({ accountContext: vi.fn() }));
const rpc = vi.fn();
const identity = vi.fn();
const token = 'a'.repeat(64);
const id = '00000000-0000-4000-8000-000000000001';
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
function context(
  method = 'POST',
  body?: string,
  path = '/api/orders/' + id + '/review',
) {
  const request = new Request('http://localhost' + path, {
    method,
    headers: { origin: 'http://localhost', 'content-type': 'application/json' },
    body,
  });
  return {
    request,
    url: new URL(request.url),
    params: { id },
    cookies: { get: () => ({ value: token }) },
  } as unknown as APIContext;
}
const run = async (handler: APIRoute, ctx: APIContext) =>
  (await handler(ctx)) as Response;
const valid = { csrf: token, rating: 5, text: 'GG', tags: ['Patient'] };
const order = {
  id,
  public_reference: 'DL-1',
  status: 'completed',
  game: 'lol',
  service: 'duo',
  title: 'Duo',
  units: 1,
  unit: 'game',
  gg: false,
  rank: '',
  region: 'EUW',
  ign: 'Player',
  note: '',
  voice: false,
  current_assignment_id: '00000000-0000-4000-8000-000000000002',
  amount_eur_cents: 1000,
  created_at: '2026-10-24T10:00:00Z',
  queued_at: '2026-10-24T10:00:00Z',
  accepted_at: '2026-10-24T10:01:00Z',
  completed_at: '2026-10-24T11:00:00Z',
  cancelled_at: null,
  cancel_reason: null,
  rerolls: 0,
  teammate: { name: 'Mina', image: '', country: 'at' },
  review: {
    rating: 5,
    text: 'GG',
    tags: ['Patient'],
    at: '2026-10-24T11:05:00Z',
  },
};
beforeEach(() => {
  vi.resetAllMocks();
  identity.mockResolvedValue({ viewer: { role: 'customer' } });
  rpc.mockResolvedValue({ data: { order }, error: null });
  vi.mocked(accountContext).mockReturnValue({
    client: { rpc },
    identity,
    json,
    config: { origin: 'http://localhost' },
    names: { csrf: 'csrf' },
  } as unknown as ReturnType<typeof accountContext>);
});

it('submits a review through the scoped RPC only', async () => {
  const res = await run(review, context('POST', JSON.stringify(valid)));
  expect(res.status).toBe(200);
  expect((await res.json()).order.review.rating).toBe(5);
  expect(rpc).toHaveBeenCalledExactlyOnceWith('order_review_tip', {
    p_order_id: id,
    p_rating: 5,
    p_text: 'GG',
    p_tags: ['Patient'],
    p_amount_cents: null,
  });
});

it.each([
  [{ ...valid, csrf: 'wrong' }, 403],
  [{ ...valid, rating: 6 }, 400],
  [{ ...valid, rating: '5' }, 400],
  [{ ...valid, tip: 5 }, 400],
  [{ ...valid, customer_id: id }, 400],
  [{ ...valid, text: 'x'.repeat(501) }, 400],
])('rejects %j with %i before calling the database', async (body, status) => {
  expect(
    (await run(review, context('POST', JSON.stringify(body)))).status,
  ).toBe(status);
  expect(rpc).not.toHaveBeenCalled();
});

it('enforces customer role, method, id and query', async () => {
  identity.mockResolvedValue({ viewer: { role: 'teammate' } });
  expect(
    (await run(review, context('POST', JSON.stringify(valid)))).status,
  ).toBe(403);
  identity.mockResolvedValue(null);
  expect(
    (await run(review, context('POST', JSON.stringify(valid)))).status,
  ).toBe(401);
  identity.mockResolvedValue({ viewer: { role: 'customer' } });
  const badId = context('POST', JSON.stringify(valid));
  badId.params.id = 'DL-1';
  expect((await run(review, badId)).status).toBe(400);
  const badQuery = context('POST', JSON.stringify(valid));
  badQuery.url.search = '?rating=5';
  expect((await run(review, badQuery)).status).toBe(400);
  expect((await run(review, context('GET'))).status).toBe(405);
  expect(rpc).not.toHaveBeenCalled();
});

it('keeps the original copy for known refusals and hides anything else', async () => {
  rpc.mockResolvedValue({
    data: {
      error: { code: 409, message: 'You already rated this order. Thank you!' },
    },
    error: null,
  });
  let res = await run(review, context('POST', JSON.stringify(valid)));
  expect(res.status).toBe(409);
  expect((await res.json()).error).toBe(
    'You already rated this order. Thank you!',
  );
  rpc.mockResolvedValue({
    data: { error: { code: 409, message: 'secret SQL detail' } },
    error: null,
  });
  res = await run(review, context('POST', JSON.stringify(valid)));
  expect(await res.text()).not.toContain('secret');
  rpc.mockResolvedValue({
    data: null,
    error: { code: 'PGRST000', message: 'secret' },
  });
  res = await run(review, context('POST', JSON.stringify(valid)));
  expect(res.status).toBe(503);
  expect(await res.text()).not.toContain('secret');
  rpc.mockResolvedValue({
    data: { order: { ...order, customer_id: id } },
    error: null,
  });
  expect(
    (await run(review, context('POST', JSON.stringify(valid)))).status,
  ).toBe(502);
});

it('serves teammate stats to teammates only and validates the payload', async () => {
  const path = '/api/teammate/stats';
  const payload = {
    now: 1,
    me: id,
    stats: {
      completed: 0,
      tier: { name: 'Rookie', deposit: 10 },
      held: 0,
      saved: 0,
      rating: null,
      reviews: 0,
      tipsTotal: 0,
      recent: [],
      latestReviews: [],
      adjustments: [],
    },
    leaderboard: {},
  };
  rpc.mockResolvedValue({ data: payload, error: null });
  expect((await run(stats, context('GET', undefined, path))).status).toBe(403);
  identity.mockResolvedValue({ viewer: { role: 'teammate' } });
  const ok = await run(stats, context('GET', undefined, path));
  expect(ok.status).toBe(200);
  expect(await ok.json()).toEqual(payload);
  expect(rpc).toHaveBeenCalledExactlyOnceWith('teammate_stats');
  expect(
    (await run(stats, context('GET', undefined, path + '?x=1'))).status,
  ).toBe(400);
  expect((await run(stats, context('POST', '{}', path))).status).toBe(405);
  rpc.mockResolvedValue({ data: { ...payload, email: 'x@y.z' }, error: null });
  expect((await run(stats, context('GET', undefined, path))).status).toBe(502);
});
