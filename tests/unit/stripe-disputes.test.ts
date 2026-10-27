import { beforeEach, describe, expect, it, vi } from 'vitest';
import Stripe from 'stripe';

const secret = 'whsec_test_trust_deposits';
const calls = vi.hoisted(() => ({
  rpc: vi.fn(),
  inserts: [] as unknown[],
}));

vi.mock('../../src/server/payments/config', () => {
  const stripe = new Stripe('sk_test_placeholder');
  const admin = {
    rpc: calls.rpc,
    from: (table: string) => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => ({ data: null, error: null }),
        insert: async (row: unknown) => {
          calls.inserts.push({ table, row });
          return { data: null, error: null };
        },
      };
      return chain;
    },
  };
  return {
    paymentsConfig: () => ({ webhookSecret: secret }),
    stripeFor: () => stripe,
    adminFor: () => admin,
  };
});

import { stripeWebhook } from '../../src/server/payments/webhook';

const signed = (type: string, status: string) => {
  const body = JSON.stringify({
    id: `evt_${type.replaceAll('.', '_')}_${status}`,
    object: 'event',
    api_version: '2026-09-30.clover',
    created: 1_800_000_000,
    livemode: false,
    pending_webhooks: 1,
    request: null,
    type,
    data: {
      object: {
        id: 'dp_123',
        object: 'dispute',
        charge: 'ch_123',
        payment_intent: 'pi_123',
        reason: 'fraudulent',
        status,
      },
    },
  });
  const signature = Stripe.webhooks.generateTestHeaderString({
    payload: body,
    secret,
  });
  return new Request('https://duoly.gg/api/webhooks/stripe', {
    method: 'POST',
    headers: { 'stripe-signature': signature },
    body,
  });
};

describe('signed Stripe dispute webhooks', () => {
  beforeEach(() => {
    calls.rpc.mockReset();
    calls.rpc.mockResolvedValue({ data: { updated: true }, error: null });
    calls.inserts.length = 0;
  });

  for (const [type, status, action] of [
    ['charge.dispute.created', 'needs_response', 'block'],
    ['charge.dispute.updated', 'under_review', 'block'],
    ['charge.dispute.closed', 'won', 'unblock'],
    ['charge.dispute.closed', 'lost', 'forfeit'],
  ] as const) {
    it(`${type} ${status} records ${action}`, async () => {
      const response = await stripeWebhook({
        request: signed(type, status),
      } as never);
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        received: true,
        outcome: `dispute_${action}`,
      });
      expect(calls.rpc).toHaveBeenCalledWith('record_stripe_dispute', {
        p_dispute_id: 'dp_123',
        p_charge_id: 'ch_123',
        p_payment_intent: 'pi_123',
        p_status: status,
        p_reason: 'fraudulent',
      });
      expect(calls.inserts).toContainEqual({
        table: 'stripe_events',
        row: { id: `evt_${type.replaceAll('.', '_')}_${status}`, type },
      });
    });
  }

  it('rejects a tampered dispute payload', async () => {
    const request = signed('charge.dispute.created', 'needs_response');
    const response = await stripeWebhook({
      request: new Request(request.url, {
        method: 'POST',
        headers: request.headers,
        body: `${await request.text()} `,
      }),
    } as never);
    expect(response.status).toBe(400);
    expect(calls.rpc).not.toHaveBeenCalled();
  });
});
