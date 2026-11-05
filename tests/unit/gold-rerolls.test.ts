import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { RerollLimitSchema } from '../../src/contracts/orders';
import { toRoomOrder } from '../../src/components/account/queue-room-data';
import { CustomerPerksSchema } from '../../src/contracts/orders';

// Gold re-rolls and the end of the Diamond pick (migration 20261106170000_gold_rerolls_no_pick.sql).
const sql = readFileSync(
  'supabase/migrations/20261106170000_gold_rerolls_no_pick.sql',
  'utf8',
);
const fn = (name: string) => {
  const start = sql.indexOf('function public.' + name + '(');
  return sql.slice(start, sql.indexOf('$$;', start) + 3);
};

describe('re-roll limit', () => {
  it('is 2, 4 from Gold, unlimited with PRO (which includes Diamond)', () => {
    const limit = fn('customer_reroll_limit_for').replace(/\s+/g, ' ');
    expect(limit).toContain('when public.is_pro(p_customer) then null');
    expect(limit).toContain(
      "(public.loyalty_level(public.loyalty_valid_count(p_customer))->>'index')::integer >= 2 then 4",
    );
    expect(limit).toContain('else 2 end');
  });
  it('reroll_order enforces that limit, still only in the first 5 minutes', () => {
    const reroll = fn('reroll_order');
    expect(reroll).toContain(
      'v_limit := public.customer_reroll_limit_for(v_actor);',
    );
    expect(reroll).toContain(
      "(v_limit is not null and v.rerolls >= v_limit) or v.accepted_at + interval '5 minutes' < v_now",
    );
    expect(reroll).not.toContain('v.rerolls >= 2');
    // streamer bookings still can't be re-rolled
    expect(reroll).toContain('public.order_streamer(v.id) is not null');
  });
  it('only the customer’s own limit is callable', () => {
    expect(sql).toContain(
      'grant execute on function public.customer_reroll_limit() to authenticated;',
    );
    expect(sql).not.toMatch(/grant [^;]*customer_reroll_limit_for/);
    expect(RerollLimitSchema.safeParse({ limit: 4 }).success).toBe(true);
    expect(RerollLimitSchema.safeParse({ limit: null }).success).toBe(true);
    expect(RerollLimitSchema.safeParse({ limit: -1 }).success).toBe(false);
  });
});

describe('order room', () => {
  const order = {
    id: '11111111-1111-4111-8111-111111111111',
    public_reference: 'DL-1',
    status: 'in_progress',
    game: 'lol',
    title: 'Duo',
    units: 1,
    unit: 'game',
    region: 'EUW',
    ign: 'Me#EUW',
    note: '',
    voice: false,
    rerolls: 1,
    teammate: null,
    review: null,
    created_at: '2026-11-05T10:00:00Z',
    queued_at: '2026-11-05T10:00:00Z',
    accepted_at: '2026-11-05T10:01:00Z',
    completed_at: null,
    amount_eur_cents: 500,
  };
  it('counts re-rolls left from the customer’s limit', () => {
    expect(toRoomOrder(order, { rerollLimit: 4 })).toMatchObject({
      rerollsLeft: 3,
      rerollLimit: 4,
      rerollsUnlimited: false,
    });
    expect(toRoomOrder(order, { rerollLimit: null })).toMatchObject({
      rerollsUnlimited: true,
    });
    // no limit passed: the old rule (2, or unlimited for PRO)
    expect(toRoomOrder(order)).toMatchObject({
      rerollsLeft: 1,
      rerollLimit: 2,
    });
    expect(toRoomOrder(order, { proMember: true }).rerollsUnlimited).toBe(true);
  });
});

describe('no more Diamond pick', () => {
  it('the pick window no longer checks Diamond (Play again uses it) and lists nobody to pick', () => {
    // pick windows now come only from Play again (20261106180000)
    expect(fn('order_pick_start')).not.toContain('loyalty_level');
    expect(fn('customer_pickable_teammates')).toContain(
      "pg_catalog.jsonb_build_object('eligible', false, 'teammates', '[]'::jsonb)",
    );
  });
  it('customer_perks reports free PRO at Diamond instead', () => {
    const perks = fn('customer_perks_for');
    expect(perks).toContain(
      "'freePro', pg_catalog.jsonb_build_object('eligible', v_index >= 4)",
    );
    expect(perks).not.toContain('pickTeammate');
    expect(
      CustomerPerksSchema.safeParse({
        level: 'diamond',
        freeCoaching: {
          eligible: true,
          used: false,
          available: true,
          month: '2026-11',
        },
        pickTeammate: { eligible: true },
      }).success,
    ).toBe(false);
  });
  it('the app no longer sends or offers a pick', () => {
    const checkout = readFileSync('src/server/payments/checkout.ts', 'utf8');
    expect(checkout).not.toContain('pickSource');
    expect(checkout).not.toContain('pick_source_order_id');
    const home = readFileSync('src/components/home/Home.jsx', 'utf8');
    expect(home).not.toMatch(/pickSource|loadPickable|data-pick-teammate/);
    const rewards = readFileSync('src/components/account/Rewards.jsx', 'utf8');
    expect(rewards).not.toContain('Pick any teammate');
    expect(rewards).toContain("title: '4 free re-rolls'");
  });
});
