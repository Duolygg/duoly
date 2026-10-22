import { describe, expect, it } from 'vitest';
import {
  CustomerOrderSchema,
  TeammateOrderSchema,
  OrderCommandSchema,
  OrderPaginationSchema,
  OrderRpcErrorSchema,
  OrderResponseSchemas,
  RefundCreditSchema,
} from '../../src/contracts/orders';

import { decodeOrderRpcResult } from '../../src/server/orders/results';

const id = '11111111-1111-4111-8111-111111111111';
const timestamp = '2026-10-22T09:30:00.123456+00:00';
const selection = {
  id,
  public_reference: 'DL-48301',
  status: 'queued',
  game: 'lol',
  service: 'duo2',
  title: 'Duo',
  units: 1,
  unit: 'game',
  gg: false,
  rank: '',
  region: 'EUW',
  ign: 'Player',
  note: '',
  voice: false,
};
const customer = {
  ...selection,
  amount_eur_cents: 599,
  created_at: timestamp,
  queued_at: timestamp,
  accepted_at: null,
  completed_at: null,
  cancelled_at: null,
  cancel_reason: null,
  rerolls: 0,
  current_assignment_id: null,
  teammate: null,
};

const teammate = {
  ...selection,
  customer_name: 'Player',
  customer_image: '',
  customer_country: '',
  payout_usd_cents: 399,
  current_assignment_id: null,
};
const credit = {
  id,
  order_id: id,
  kind: 'queued_refund',
  amount_eur_cents: 599,
  created_at: timestamp,
};

describe('pure RPC result decoder', () => {
  it('returns validated payloads only for the expected response kind', () => {
    const responses = {
      customerOrder: { order: customer },
      customerActive: { order: customer },
      customerHistory: { orders: [customer] },
      refundCredits: { credits: [credit] },
      teammateOrder: { order: teammate },
      teammateQueue: { orders: [teammate] },
      teammateAssignment: { order: teammate },
    };
    for (const kind of Object.keys(responses) as (keyof typeof responses)[]) {
      expect(decodeOrderRpcResult(kind, responses[kind], null)).toEqual({
        ok: true,
        status: 200,
        payload: responses[kind],
      });
    }
    expect(
      decodeOrderRpcResult('customerActive', { order: null }, undefined),
    ).toEqual({ ok: true, status: 200, payload: { order: null } });
    expect(
      decodeOrderRpcResult('teammateAssignment', { order: null }, null),
    ).toEqual({ ok: true, status: 200, payload: { order: null } });
    expect(
      decodeOrderRpcResult('teammateOrder', { order: customer }, null).status,
    ).toBe(502);
    expect(
      decodeOrderRpcResult('customerOrder', { order: teammate }, null).status,
    ).toBe(502);
  });

  it.each([400, 401, 403, 404, 409, 410])(
    'maps numeric business status %s without echoing diagnostics',
    (code) => {
      const result = decodeOrderRpcResult(
        'customerOrder',
        { error: { code, message: 'secret SQL diagnostic' } },
        null,
      );
      expect(result.ok).toBe(false);
      expect(result.status).toBe(code);
      expect(JSON.stringify(result)).not.toContain('secret');
    },
  );

  it.each([
    new Error('secret'),
    { message: 'secret', status: 401 },
    'secret',
    false,
    0,
    '',
  ])('fails closed on any present transport error %j', (error) => {
    expect(
      decodeOrderRpcResult('customerOrder', { order: customer }, error),
    ).toEqual({
      ok: false,
      status: 503,
      payload: { error: 'Order service unavailable.' },
    });
  });

  it.each([
    null,
    undefined,
    [],
    'secret',
    {},
    { order: null },
    { error: 'secret' },
    { error: { code: '409', message: 'secret' } },
    { error: { code: 302, message: 'secret' } },
    { error: { code: 409, message: 'secret' }, order: customer },
    { order: { ...customer, customer_id: id } },
    { order: customer, debug: 'secret' },
  ])('fails closed on malformed backend envelope %j', (data) => {
    expect(decodeOrderRpcResult('customerOrder', data, null)).toEqual({
      ok: false,
      status: 502,
      payload: { error: 'Invalid order service response.' },
    });
  });
});

describe('strict SQL order contracts', () => {
  it('uses a distinct privacy-safe teammate projection', () => {
    expect(TeammateOrderSchema.parse(teammate)).toEqual(teammate);
    for (const field of [
      'customer_id',
      'amount_eur_cents',
      'booking_fx',
      'created_at',
      'queued_at',
      'accepted_at',
      'completed_at',
      'cancelled_at',
      'deadline',
      'priority_base',
      'priority_adjustment',
      'rerolls',
      'assignments',
      'previous_teammate_id',
    ]) {
      expect(
        TeammateOrderSchema.safeParse({ ...teammate, [field]: id }).success,
      ).toBe(false);
    }
    expect(TeammateOrderSchema.safeParse(customer).success).toBe(false);
    expect(CustomerOrderSchema.safeParse(teammate).success).toBe(false);
  });

  it('bounds strict command and pagination inputs without coercion', () => {
    expect(OrderCommandSchema.parse({ order_id: id })).toEqual({
      order_id: id,
    });
    for (const input of [
      {},
      { order_id: 'bad' },
      { order_id: id, actor: id },
      { order_id: id, bypass: true },
    ]) {
      expect(OrderCommandSchema.safeParse(input).success).toBe(false);
    }
    expect(OrderPaginationSchema.parse({})).toEqual({ limit: 50, offset: 0 });
    expect(OrderPaginationSchema.parse({ limit: 100, offset: 100000 })).toEqual(
      { limit: 100, offset: 100000 },
    );
    for (const patch of [
      { limit: 0 },
      { limit: 101 },
      { limit: 1.5 },
      { limit: '2' },
      { limit: null },
      { offset: -1 },
      { offset: 100001 },
      { offset: '0' },
      { actor: id },
    ]) {
      expect(OrderPaginationSchema.safeParse(patch).success).toBe(false);
    }
  });

  it('validates exact success envelopes and refund projections, allowing explicit null active orders only', () => {
    expect(RefundCreditSchema.parse(credit)).toEqual(credit);
    expect(
      RefundCreditSchema.safeParse({ ...credit, customer_id: id }).success,
    ).toBe(false);
    const responses = {
      customerOrder: { order: customer },
      customerActive: { order: null },
      customerHistory: { orders: [customer] },
      refundCredits: { credits: [credit] },
      teammateOrder: { order: teammate },
      teammateQueue: { orders: [teammate] },
      teammateAssignment: { order: null },
    };
    for (const kind of Object.keys(responses) as (keyof typeof responses)[]) {
      expect(OrderResponseSchemas[kind].parse(responses[kind])).toEqual(
        responses[kind],
      );
      expect(
        OrderResponseSchemas[kind].safeParse({
          ...responses[kind],
          secret: 'leak',
        }).success,
      ).toBe(false);
      expect(OrderResponseSchemas[kind].safeParse({}).success).toBe(false);
    }
    expect(
      OrderResponseSchemas.customerOrder.safeParse({ order: null }).success,
    ).toBe(false);
    expect(
      OrderResponseSchemas.teammateOrder.safeParse({ order: null }).success,
    ).toBe(false);
    expect(
      OrderResponseSchemas.customerHistory.safeParse({
        orders: Array(101).fill(customer),
      }).success,
    ).toBe(false);
  });

  it('requires numeric known business-error codes and a bounded message', () => {
    expect(
      OrderRpcErrorSchema.parse({
        error: { code: 409, message: 'Order already taken.' },
      }),
    ).toEqual({ error: { code: 409, message: 'Order already taken.' } });
    for (const error of [
      { code: '409', message: 'No' },
      { code: 200, message: 'No' },
      { code: 503, message: 'No' },
      { code: 409, message: '' },
      { code: 409, message: 'x'.repeat(201) },
      { code: 409, message: 'No', details: 'secret' },
    ]) {
      expect(OrderRpcErrorSchema.safeParse({ error }).success).toBe(false);
    }
    expect(
      OrderRpcErrorSchema.safeParse({
        error: { code: 409, message: 'No' },
        order: customer,
      }).success,
    ).toBe(false);
  });
  it.each([
    { units: 0 },
    { units: 11 },
    { units: 1.5 },
    { units: '1' },
    { game: 'unknown' },
    { service: '' },
    { service: 'x'.repeat(65) },
    { title: '' },
    { title: 'x'.repeat(81) },
    { unit: 'day' },
    { rank: 'x'.repeat(41) },
    { region: 'x' },
    { region: 'x'.repeat(81) },
    { ign: 'x' },
    { ign: 'x'.repeat(41) },
    { note: 'x'.repeat(201) },
    { amount_eur_cents: 98 },
    { amount_eur_cents: 100001 },
    { amount_eur_cents: 99.1 },
    { amount_eur_cents: '599' },
    { rerolls: -1 },
    { rerolls: 3 },
    { current_assignment_id: 'bad' },
    { status: 'paid' },
    { created_at: 'today' },
    { queued_at: null },
    { accepted_at: '2026-10-22' },
    { completed_at: 'bad' },
    { cancel_reason: 'other' },
    { gg: 'false' },
    { voice: 1 },
    { teammate: { name: 'Player', image: '', country: '', id } },
  ])('rejects malformed customer DTO patch %j', (patch) => {
    expect(
      CustomerOrderSchema.safeParse({ ...customer, ...patch }).success,
    ).toBe(false);
  });

  it('preserves all SQL lifecycle statuses and nullable/non-null assignment fields', () => {
    const assigned = {
      ...customer,
      status: 'in_progress',
      accepted_at: timestamp,
      current_assignment_id: id,
      teammate: { name: 'Teammate', image: '', country: '' },
    };
    const completed = {
      ...assigned,
      status: 'completed',
      completed_at: timestamp,
    };
    const cancelled = {
      ...customer,
      status: 'cancelled',
      cancelled_at: timestamp,
      cancel_reason: 'queue_expired',
    };
    for (const order of [customer, assigned, completed, cancelled]) {
      expect(CustomerOrderSchema.parse(order)).toEqual(order);
    }
    expect(
      TeammateOrderSchema.parse({
        ...teammate,
        status: 'in_progress',
        current_assignment_id: id,
      }),
    ).toEqual({
      ...teammate,
      status: 'in_progress',
      current_assignment_id: id,
    });
  });

  it.each([
    { payout_usd_cents: 98 },
    { payout_usd_cents: 10000001 },
    { customer_name: '' },
    { customer_image: 'https://example.test/avatar.png' },
    { customer_country: 'DE' },
    { current_assignment_id: 'bad' },
  ])('rejects malformed teammate DTO patch %j', (patch) => {
    expect(
      TeammateOrderSchema.safeParse({ ...teammate, ...patch }).success,
    ).toBe(false);
  });

  it.each([
    { kind: 'cashback' },
    { amount_eur_cents: 0 },
    { amount_eur_cents: 100001 },
    { created_at: null },
    { order_id: 'bad' },
  ])('rejects malformed refund patch %j', (patch) => {
    expect(RefundCreditSchema.safeParse({ ...credit, ...patch }).success).toBe(
      false,
    );
  });

  it('does not mutate its input or expose unvalidated references', () => {
    const input = Object.freeze({ order: Object.freeze({ ...customer }) });
    const result = decodeOrderRpcResult('customerOrder', input, null);
    expect(result).toEqual({ ok: true, status: 200, payload: input });
    if (result.ok) {
      expect(result.payload).not.toBe(input);
      expect(result.payload.order).not.toBe(input.order);
    }
  });

  it('preserves the exact customer DTO including PostgreSQL timestamps and nulls', () => {
    expect(CustomerOrderSchema.parse(customer)).toEqual(customer);
    expect(
      CustomerOrderSchema.safeParse({ ...customer, customer_id: id }).success,
    ).toBe(false);
    expect(
      CustomerOrderSchema.safeParse({ ...customer, accepted_at: undefined })
        .success,
    ).toBe(false);
  });
});
