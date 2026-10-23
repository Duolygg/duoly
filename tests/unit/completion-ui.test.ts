import { it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import PrivateProofs from '../../src/components/proofs/PrivateProofs';
import {
  CompletionControls,
  CompletionReceipt,
  RecentEarnings,
} from '../../src/components/teammate/completion-ui';
import { initialProofState } from '../../src/components/proofs/proof-session';
import type { Completion } from '../../src/contracts/completion';
const order = '11111111-1111-4111-8111-111111111111',
  assignment = '22222222-2222-4222-8222-222222222222';
it('never offers a money mutation to customer mode or without a current assignment or callback', () => {
  for (const props of [
    {
      mode: 'customer' as const,
      assignmentId: assignment,
      onCompleted: () => {},
    },
    { mode: 'teammate' as const, onCompleted: () => {} },
    { mode: 'teammate' as const, assignmentId: assignment },
  ]) {
    const html = renderToStaticMarkup(
      createElement(PrivateProofs, { orderId: order, csrf: 'token', ...props }),
    );
    expect(html).not.toContain('Mark as done');
  }
});
it('disables malformed scope, missing csrf, loading and stale evidence', () => {
  const state = {
    ...initialProofState,
    kind: 'ready' as const,
    proofs: [
      {
        id: '33333333-3333-4333-8333-333333333333',
        order_id: order,
        assignment_id: assignment,
        mime: 'image/png' as const,
        byte_size: 1,
        created_at: '2026-10-23T10:00:00Z',
      },
    ],
  };
  for (const props of [
    { csrf: '' },
    { orderId: 'invalid' },
    { assignmentId: 'invalid' },
    { disabled: true },
    { state: { ...state, stale: true } },
    { state: initialProofState },
  ]) {
    const html = renderToStaticMarkup(
      createElement(CompletionControls, {
        orderId: order,
        assignmentId: assignment,
        csrf: 'token',
        state,
        onCompleted: () => {},
        onBusyChange: () => {},
        ...props,
      }),
    );
    expect(html).toMatch(/<button[^>]*disabled/);
  }
});
it('distinguishes loading, denied and unavailable earnings from a confirmed empty list', () => {
  for (const kind of [
    'loading',
    'denied',
    'signed-out',
    'unavailable',
  ] as const) {
    const html = renderToStaticMarkup(
      createElement(RecentEarnings, { state: { kind } }),
    );
    expect(html).not.toContain('No permanent earnings recorded.');
    expect(html).not.toContain('$0.00');
  }
  expect(
    renderToStaticMarkup(
      createElement(RecentEarnings, { state: { kind: 'ready', value: [] } }),
    ),
  ).toContain('No permanent earnings recorded.');
});
it('labels server recorded receipt as gross, held deposit and net, never as withdrawable funds', () => {
  const entry: Completion = {
    order_id: order,
    assignment_id: assignment,
    request_id: assignment,
    proof_ids: [order],
    completed_at: '2026-10-23T10:00:00Z',
    payout_usd_cents: 1005,
    deposit_percent: 10,
    held_usd_cents: 101,
    net_usd_cents: 904,
    trust_tier: 'rookie',
  };
  const html = renderToStaticMarkup(
    createElement(CompletionReceipt, { entry }),
  );
  for (const text of [
    'Gross USD',
    'Order ID',
    order,
    '$10.05 USD',
    'Held deposit (10%)',
    '$1.01 USD',
    'Net USD recorded',
    '$9.04 USD',
    'Withdrawals and deposit releases are not available yet.',
  ])
    expect(html).toContain(text);
  expect(html).not.toMatch(/paid|payable|14 days|withdraw now|cashback/i);
});
