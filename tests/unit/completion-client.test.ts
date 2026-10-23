import { expect, it } from 'vitest';
import {
  readEarnings,
  completionProofIds,
  completeOrder,
} from '../../src/components/teammate/completion-client';
const input = {
  order_id: '11111111-1111-4111-8111-111111111111',
  assignment_id: '22222222-2222-4222-8222-222222222222',
  request_id: '33333333-3333-4333-8333-333333333333',
  proof_ids: ['44444444-4444-4444-8444-444444444444'],
};
const completion = {
  ...input,
  completed_at: '2026-10-23T10:00:00Z',
  payout_usd_cents: 1200,
  deposit_percent: 10,
  held_usd_cents: 120,
  net_usd_cents: 1080,
  trust_tier: 'rookie',
};
it('posts only the frozen command and csrf and validates the permanent receipt', async () => {
  const result = await completeOrder(
    async (url, init) => {
      expect(url).toBe(`/api/teammate/orders/${input.order_id}/complete`);
      expect(init?.credentials).toBe('same-origin');
      expect(init?.cache).toBe('no-store');
      expect(JSON.parse(String(init?.body))).toEqual({
        csrf: 'token',
        assignment_id: input.assignment_id,
        request_id: input.request_id,
        proof_ids: input.proof_ids,
      });
      return Response.json({ completion });
    },
    input,
    'token',
  );
  expect(result).toEqual({ kind: 'completed', completion });
});
it('never treats a mismatched receipt or failed status as success and never auto retries', async () => {
  for (const patch of [
    { order_id: input.request_id },
    { assignment_id: input.request_id },
    { request_id: input.order_id },
    { proof_ids: [input.order_id] },
    { extra: true },
    { net_usd_cents: 99 },
  ]) {
    expect(
      await completeOrder(
        async () => Response.json({ completion: { ...completion, ...patch } }),
        input,
        'token',
      ),
    ).toEqual({ kind: 'uncertain' });
  }
  for (const [status, kind] of [
    [400, 'bad'],
    [401, 'signed-out'],
    [403, 'denied'],
    [404, 'denied'],
    [409, 'conflict'],
    [503, 'uncertain'],
  ] as const) {
    let calls = 0;
    expect(
      await completeOrder(
        async () => {
          calls++;
          return Response.json({ completion }, { status });
        },
        input,
        'token',
      ),
    ).toEqual({ kind });
    expect(calls).toBe(1);
  }
  let calls = 0;
  const fetcher = async () => {
    calls++;
    throw Error('offline');
  };
  expect(await completeOrder(fetcher, input, '')).toEqual({ kind: 'bad' });
  expect(
    await completeOrder(
      fetcher,
      { ...input, proof_ids: [...input.proof_ids, ...input.proof_ids] },
      'token',
    ),
  ).toEqual({ kind: 'bad' });
  expect(calls).toBe(0);
  expect(await completeOrder(fetcher, input, 'token')).toEqual({
    kind: 'uncertain',
  });
  expect(calls).toBe(1);
});
it('requires fresh ready distinct bound evidence and reads earnings without false empty success', async () => {
  const proof = {
    id: input.proof_ids[0]!,
    order_id: input.order_id,
    assignment_id: input.assignment_id,
    mime: 'image/png' as const,
    byte_size: 12,
    created_at: '2026-10-23T10:00:00Z',
  };
  const state = {
    kind: 'ready' as const,
    proofs: [proof],
    stale: false,
    pending: false,
    error: '',
    message: '',
    choice: null,
  };
  expect(
    completionProofIds(state, input.order_id, input.assignment_id),
  ).toEqual(input.proof_ids);
  for (const patch of [
    { stale: true },
    { pending: true },
    { error: 'bad' },
    { kind: 'denied' as const },
    { proofs: [] },
    { proofs: [proof, proof] },
    { proofs: [{ ...proof, order_id: input.request_id }] },
  ])
    expect(
      completionProofIds(
        { ...state, ...patch },
        input.order_id,
        input.assignment_id,
      ),
    ).toBeNull();
  expect(
    await readEarnings(async () => Response.json({ earnings: [completion] })),
  ).toEqual({ kind: 'ready', value: [completion] });
  for (const [status, kind] of [
    [401, 'signed-out'],
    [403, 'denied'],
    [503, 'unavailable'],
  ] as const)
    expect(
      await readEarnings(async () => new Response('{}', { status })),
    ).toEqual({ kind });
  expect(
    await readEarnings(async () => Response.json({ earnings: [{}] })),
  ).toEqual({ kind: 'unavailable' });
});
export { input, completion };
