import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const path = resolve('supabase/migrations/20261022093000_order_foundation.sql');
const migration = () => {
  expect(existsSync(path), 'order migration exists').toBe(true);
  return readFileSync(path, 'utf8')
    .replace(/--[^\n]*/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
};
describe('order migration safeguards (static only, NOT SQL acceptance)', () => {
  it('ships rollback-only role-switched SQL assertions, not fabricated SQL acceptance', () => {
    const fixturePath = resolve('supabase/tests/order_authorization.sql');
    expect(existsSync(fixturePath), 'rollback SQL fixture exists').toBe(true);
    const sql = readFileSync(fixturePath, 'utf8')
      .replace(/--[^\n]*/g, '')
      .toLowerCase();
    expect(sql.trim()).toMatch(/^begin;/);
    expect(sql.trim()).toMatch(/rollback;$/);
    for (const role of ['anon', 'authenticated', 'service_role'])
      expect(sql).toContain(`set local role ${role}`);
    expect(sql).toContain('request.jwt.claims');
    expect(sql).toContain('raise exception');
    expect(sql).toContain('fixture collision');
    expect(sql).toContain('when insufficient_privilege');
    expect(sql).toContain('when unique_violation');
    expect(sql).not.toMatch(/\bcommit\s*;/);
  });
  it('binds refund identity/amount to the order and closes assignment NULL loopholes', () => {
    const sql = migration();
    expect(
      sql.includes('ended_at is not null and ended_at >= accepted_at'),
    ).toBe(true);
    expect(
      sql.includes('foreign key (order_id, customer_id, amount_eur_cents)'),
    ).toBe(true);
    expect(
      sql.includes(
        'references public.orders(id, customer_id, amount_eur_cents)',
      ),
    ).toBe(true);
  });
  it('prevents NULL from bypassing lifecycle checks and keeps durable credits', () => {
    const sql = migration();
    expect(sql).toContain(
      'accepted_at is not null and accepted_at >= queued_at',
    );
    expect(sql).toContain(
      'completed_at is not null and completed_at >= accepted_at',
    );
    expect(sql).toContain(
      'cancelled_at is not null and cancelled_at >= queued_at',
    );
    expect(sql).toContain('unique (order_id, kind)');
    expect(sql).toContain(
      'create trigger orders_post_refund after insert or update of status',
    );
    expect(sql).toContain(
      'foreign key (current_assignment_id, id, assigned_teammate_id)',
    );
    expect(sql).toContain('for update skip locked');
    expect(sql).not.toMatch(/raise\s+exception/);
  });
  it('rechecks the deadline at the conditional accept transition and cleans up a provisional assignment', () => {
    const sql = migration();
    const accept =
      sql
        .split('create function public.accept_order(')[1]
        ?.split('create function public.cancel_queued_order(')[0] ?? '';
    expect(
      accept.includes(
        "and queued_at + interval '5 minutes' > pg_catalog.clock_timestamp() returning * into v",
      ),
    ).toBe(true);
    expect(
      accept.includes(
        'delete from public.order_assignments where id = v_assignment',
      ),
    ).toBe(true);
    expect(
      accept.includes('perform public.order_expire_locked(p_order_id)'),
    ).toBe(true);
  });
  it('denies raw client access and enforces independent race constraints', () => {
    const sql = migration();
    for (const table of [
      'orders',
      'order_assignments',
      'teammate_order_access',
      'refund_credits',
    ]) {
      expect(sql).toContain(
        `alter table public.${table} enable row level security`,
      );
      expect(sql).toContain(
        `revoke all on table public.${table} from public, anon, authenticated, service_role`,
      );
    }
    expect(sql).toContain("where status in ('queued', 'in_progress')");
    expect(sql).toContain("where status = 'in_progress'");
    expect(sql).not.toMatch(
      /grant[^;]*(?:table public\.orders|table public\.order_assignments)[^;]*to authenticated/,
    );
    expect(sql).not.toMatch(
      /raw_user_meta_data|raw_app_meta_data|create publication|alter publication/,
    );
  });
});
