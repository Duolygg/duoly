import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  freeCoachingFits,
  freeCoachingIntentRow,
  freeCoachingOutcome,
  freeCoachingRefusal,
  freeCoachingServices,
} from '../../src/server/perks/checkout';
import { CheckoutRequestSchema } from '../../src/server/payments/checkout';
import { GAMES } from '../../src/design-reference/lib/games.js';

const GAME_IDS = (GAMES as { id: string }[]).map((game) => game.id);
const MIGRATION = readFileSync(
  new URL(
    '../../supabase/migrations/20261026160000_perks.sql',
    import.meta.url,
  ),
  'utf8',
);
const ORDER = '00000000-0000-4000-8000-0000000000aa';

describe('freeCoachingFits', () => {
  it('accepts one hour of a training service', () => {
    expect(
      freeCoachingFits({ gameId: 'lol', serviceId: 'vod', units: 1 }),
    ).toBe(true);
    expect(
      freeCoachingFits({ gameId: 'fn', serviceId: 'learn', units: 1 }),
    ).toBe(true);
  });
  it.each([3, 5, 10, 2])(
    'refuses bundles and multi-unit orders (%i)',
    (units) => {
      expect(freeCoachingFits({ gameId: 'lol', serviceId: 'vod', units })).toBe(
        false,
      );
    },
  );
  it.each([
    ['lol', 'duo2'],
    ['lol', 'gg1'],
    ['lol', 'aram'],
    ['lol', 'learn'], // training, but per game, not per hour
    ['val', 'learn'],
    ['xx', 'vod'],
    ['lol', 'nope'],
  ])(
    'refuses non-training or per-game services (%s %s)',
    (gameId, serviceId) => {
      expect(freeCoachingFits({ gameId, serviceId, units: 1 })).toBe(false);
    },
  );
});

describe('catalog and migration agree', () => {
  it('free_coaching_service lists exactly the catalog training hour services', () => {
    const body =
      /function public\.free_coaching_service[\s\S]*?\$\$([\s\S]*?)\$\$/.exec(
        MIGRATION,
      )![1]!;
    const sql = [...body.matchAll(/\('([a-z0-9]+)','([a-z0-9]+)'\)/g)].map(
      (m) => `${m[1]}:${m[2]}`,
    );
    const catalog = freeCoachingServices(GAME_IDS).map(
      ([game, service]) => `${game}:${service}`,
    );
    expect(sql.length).toBeGreaterThan(20);
    expect(new Set(sql).size).toBe(sql.length);
    expect([...sql].sort()).toEqual([...catalog].sort());
    for (const pair of catalog) {
      const [gameId, serviceId] = pair.split(':') as [string, string];
      expect(freeCoachingFits({ gameId, serviceId, units: 1 })).toBe(true);
    }
  });
});

describe('freeCoachingRefusal', () => {
  it('maps database reasons to customer copy without dashes or ampersands', () => {
    const copy = ['level', 'used', 'service', undefined, 'other'].map(
      freeCoachingRefusal,
    );
    expect(copy[0]).toMatch(/Platinum/);
    expect(copy[1]).toMatch(/already used/);
    expect(copy[2]).toMatch(/1-hour/);
    expect(copy[3]).toBe(copy[0]);
    for (const text of copy) expect(text).not.toMatch(/[\u2013\u2014&]/);
  });
});

describe('free coaching intent and outcome', () => {
  it('keeps the list price and sets no wallet, discount or creator code', () => {
    const row = freeCoachingIntentRow(
      { amount_eur_cents: 1299, payout_usd_cents: 840 },
      { customerId: 'c', pickSource: ORDER, expiresAt: 'x' },
    );
    expect(row).toMatchObject({
      amount_eur_cents: 1299,
      payout_usd_cents: 840,
      free_coaching: true,
      wallet_eur_cents: 0,
      first_order_discount_cents: 0,
      ref_code: null,
      pick_source_order_id: ORDER,
      customer_id: 'c',
    });
    expect(
      freeCoachingIntentRow(
        {},
        { customerId: 'c', pickSource: null, expiresAt: 'x' },
      ),
    ).not.toHaveProperty('pick_source_order_id');
  });
  it('maps create_free_coaching_order answers', () => {
    expect(
      freeCoachingOutcome({
        data: { order_id: ORDER, created: true },
        error: null,
      }),
    ).toEqual({ ok: true, orderId: ORDER });
    expect(
      freeCoachingOutcome({ data: { conflict: true }, error: null }),
    ).toMatchObject({ ok: false, status: 409 });
    expect(
      freeCoachingOutcome({
        data: { error: 'free_perk_unavailable', reason: 'used' },
        error: null,
      }),
    ).toEqual({ ok: false, status: 409, error: freeCoachingRefusal('used') });
    for (const answer of [
      { data: null, error: { message: 'x' } },
      { data: { order_id: ORDER }, error: { code: 'PGRST202' } },
      { data: { error: 'payment_mismatch' }, error: null },
      { data: { order_id: 'not-a-uuid' }, error: null },
      { data: 'oops', error: null },
    ])
      expect(freeCoachingOutcome(answer)).toMatchObject({
        ok: false,
        status: 503,
      });
  });
});

describe('checkout request schema', () => {
  const base = {
    gameId: 'lol',
    serviceId: 'vod',
    units: 1,
    server: 'EUW',
    ign: 'Me#EUW',
  };
  it('accepts a free order without the wallet and a uuid pick source', () => {
    expect(
      CheckoutRequestSchema.safeParse({
        ...base,
        freePerk: true,
        useWallet: false,
        pickSource: ORDER,
      }).success,
    ).toBe(true);
  });
  it('rejects the free order with the wallet (explicit or by default)', () => {
    expect(
      CheckoutRequestSchema.safeParse({
        ...base,
        freePerk: true,
        useWallet: true,
      }).success,
    ).toBe(false);
    expect(
      CheckoutRequestSchema.safeParse({ ...base, freePerk: true }).success,
    ).toBe(false);
  });
  it.each([
    { pickSource: 'teammate-1' },
    { pickHandle: ORDER },
    { refCode: 'CREATOR' },
    { proDiscount: true },
    { freePerk: 'yes' },
  ])('rejects bad perk fields %o', (extra) => {
    expect(
      CheckoutRequestSchema.safeParse({ ...base, useWallet: false, ...extra })
        .success,
    ).toBe(false);
  });
});
