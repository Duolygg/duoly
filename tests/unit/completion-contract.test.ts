import { expect, it } from 'vitest';
import {
  CompletionInputSchema,
  CompletionResponseSchema,
  EarningsResponseSchema,
} from '../../src/contracts/completion';
const entry = {
  order_id: '00000000-0000-4000-8000-000000000001',
  assignment_id: '00000000-0000-4000-8000-000000000002',
  request_id: '00000000-0000-4000-8000-000000000003',
  proof_ids: ['00000000-0000-4000-8000-000000000004'],
  completed_at: '2026-10-23T12:00:00Z',
  payout_usd_cents: 1005,
  deposit_percent: 10,
  held_usd_cents: 101,
  net_usd_cents: 904,
  trust_tier: 'rookie',
};
it('accepts the native receipt with exact positive half-cent rounding', () => {
  expect(CompletionResponseSchema.parse({ completion: entry })).toEqual({
    completion: entry,
  });
  expect(EarningsResponseSchema.parse({ earnings: [entry] })).toEqual({
    earnings: [entry],
  });
});
it.each([
  { ...entry, held_usd_cents: 100, net_usd_cents: 905 },
  { ...entry, trust_tier: 'legend' },
  { ...entry, payout_usd_cents: 98, held_usd_cents: 10, net_usd_cents: 88 },
  {
    ...entry,
    payout_usd_cents: 10000001,
    held_usd_cents: 1000000,
    net_usd_cents: 9000001,
  },
  { ...entry, payout_usd_cents: 100.5 },
  { ...entry, held_usd_cents: -1 },
  { ...entry, storage_key: 'private' },
  { ...entry, completed_at: 'tomorrow' },
  { ...entry, proof_ids: [] },
  { ...entry, proof_ids: Array(6).fill(entry.proof_ids[0]) },
])(
  'rejects inconsistent monetary snapshots and non-public fields',
  (completion) => {
    expect(CompletionResponseSchema.safeParse({ completion }).success).toBe(
      false,
    );
  },
);
it('rejects actor, time and price overrides and validates before UUID case canonicalization', () => {
  const input = {
    order_id: entry.order_id,
    assignment_id: entry.assignment_id,
    request_id: entry.request_id,
    proof_ids: entry.proof_ids,
  };
  for (const key of [
    'actor_id',
    'completed_at',
    'payout_usd_cents',
    'deposit_percent',
    'csrf',
  ]) {
    expect(
      CompletionInputSchema.safeParse({ ...input, [key]: 'override' }).success,
    ).toBe(false);
  }
  const letter = 'abcdef01-abcd-4abc-8abc-abcdef012341';
  expect(
    CompletionInputSchema.parse({ ...input, order_id: letter.toUpperCase() })
      .order_id,
  ).toBe(letter);
  expect(
    CompletionInputSchema.safeParse({
      ...input,
      order_id: letter.replaceAll('-', ''),
    }).success,
  ).toBe(false);
  expect(
    CompletionInputSchema.safeParse({
      ...input,
      proof_ids: [letter, letter.toUpperCase()],
    }).success,
  ).toBe(false);
});
