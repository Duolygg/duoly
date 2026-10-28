import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  resolve('supabase/migrations/20261026110000_gold_priority_badges.sql'),
  'utf8',
)
  .replace(/--[^\n]*/g, '')
  .replace(/\s+/g, ' ')
  .toLowerCase();

describe('M7 Gold priority and teammate badges migration', () => {
  it('snapshots Gold+ at queue entry and sorts it first without replacing eligibility', () => {
    expect(sql).toContain('public.loyalty_valid_count(new.customer_id)');
    expect(sql).toContain("customer_level in ('gold','platinum','diamond')");
    expect(sql).toContain(
      'order by public.order_has_head_start(o.id) desc,o.queued_at desc,o.id limit 100',
    );
    expect(sql).toContain('public.order_eligible(o,v_actor)');
    expect(sql).not.toContain(
      'create or replace function public.order_eligible',
    );
    expect(sql).not.toContain(
      'create or replace function public.order_expire_locked',
    );
  });

  it('preserves the latest M6 customer DTO keys and adds only a private trust badge', () => {
    const dto = sql.split(
      'create or replace function public.order_customer_dto',
    )[1]!;
    for (const key of [
      "'bio'",
      "'languages'",
      "'review'",
      "'tip'",
      "'reports'",
      "'trust_badge'",
    ])
      expect(dto).toContain(key);
    expect(sql).toContain(
      'revoke all on function public.teammate_trust_badge(uuid) from public, anon, authenticated, service_role',
    );
    expect(sql).toContain(
      'revoke all on table public.order_priority_boosts from public, anon, authenticated, service_role',
    );
  });

  it('does not replace pricing, checkout, earnings or payout functions', () => {
    for (const target of [
      'calculate_order_quote',
      'create_checkout',
      'teammate_stats',
      'payout_freeze_week',
      'admin_payouts',
    ])
      expect(sql).not.toContain(`create or replace function public.${target}`);
  });
});
