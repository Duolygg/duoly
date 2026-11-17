import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CREATOR_HOLD_DAYS,
  CREATOR_PAYOUT_METHODS,
  RESERVED_CREATOR_CODES,
  creatorCodeIssue,
} from '../../src/contracts/creator-portal';
import { CREATOR_RULES } from '../../src/contracts/creators';

/**
 * The migration is the authority for creator money, so these checks hold it to the rules the rest
 * of the application states: additive except the one documented replacement, nothing readable
 * without going through an RPC, and the same numbers as the admin screen.
 */
const NAME = '20261117120000_creator_portal.sql';
const migration = readFileSync(`supabase/migrations/${NAME}`, 'utf8');
const section = (from: string, to: string) =>
  migration.slice(migration.indexOf(from), migration.indexOf(to));
const ordersHelper = () =>
  section(
    'create function public.creator_portal_orders',
    'create function public.creator_portal_money',
  );
const moneyHelper = () =>
  section(
    'create function public.creator_portal_money',
    'create function public.creator_portal_stats',
  );
const portalFunction = () =>
  section('create function public.creator_portal()', '-- ---- applying');

describe('the creator portal migration', () => {
  it('is the newest migration in the folder', () => {
    const files = readdirSync('supabase/migrations')
      .filter((file) => file.endsWith('.sql'))
      .sort();
    expect(files.at(-1)).toBe(NAME);
  });
  it('replaces one function only, and says why', () => {
    const replaced = [
      ...migration.matchAll(/create or replace function ([\w.]+)/gi),
    ].map((match) => match[1]);
    expect(replaced).toEqual(['public.checkout_intent_attribute']);
    expect(migration).toMatch(/self-referral guard/i);
  });
  it('builds the attribution replacement on the latest definition (team orders)', () => {
    const latest = readdirSync('supabase/migrations')
      .filter((f) => f !== NAME && f.endsWith('.sql'))
      .sort()
      .filter((f) =>
        readFileSync(`supabase/migrations/${f}`, 'utf8').includes(
          'function public.checkout_intent_attribute()',
        ),
      )
      .pop();
    expect(latest).toBe('20261106190000_team_orders.sql');
    const body = section(
      'create or replace function public.checkout_intent_attribute()',
      'revoke all on function public.checkout_intent_attribute()',
    );
    expect(body).toContain('if new.free_coaching then return null; end if;');
    expect(body).toContain('public.order_teams t where t.id = v_order.team_id');
    expect(body).toContain('o.team_id is distinct from v_order.team_id');
    expect(body).toContain(
      'values (new.order_id, v_ref.creator_id, new.customer_id, v_amount)',
    );
    expect(body).toContain('c.user_id <> new.customer_id');
  });

  it('keeps every new table unreadable without an RPC', () => {
    for (const table of [
      'creator_applications',
      'creator_link_clicks',
      'creator_payout_details',
    ]) {
      expect(migration).toContain(
        `alter table public.${table} enable row level security`,
      );
      expect(migration).toContain(
        `revoke all on table public.${table} from public, anon, authenticated, service_role`,
      );
    }
    // Payout details are the one table a creator reads directly, behind a policy.
    const grants = [
      ...migration.matchAll(/grant (select|insert|update|delete)[^;]*;/gi),
    ].map((match) => match[0]);
    expect(grants).toEqual([
      'grant select on table public.creator_payout_details to authenticated;',
    ]);
  });
  it('sets an empty search path and explicit grants on every new function', () => {
    const functions = [
      ...migration.matchAll(/create (?:or replace )?function (public\.\w+)/g),
    ].map((match) => match[1]!);
    expect(functions.length).toBeGreaterThan(10);
    for (const name of new Set(functions)) {
      const body = migration.slice(migration.indexOf(`function ${name}`));
      expect(body.slice(0, 600), name).toMatch(/set search_path = ''/);
    }
    for (const name of [
      'creator_portal()',
      'creator_code_available(text)',
      'admin_creator_applications()',
    ])
      expect(migration).toContain(`public.${name}`);
    expect(migration).toMatch(
      /grant execute on function[\s\S]*?to authenticated;/,
    );
    expect(migration).toContain(
      'grant execute on function public.creator_link_click(text) to service_role;',
    );
  });
  it('counts clicks without anything about the visitor', () => {
    const table = migration.slice(
      migration.indexOf('create table public.creator_link_clicks'),
      migration.indexOf('alter table public.creator_link_clicks'),
    );
    expect(table).toContain('creator_id');
    expect(table).toContain('day date');
    expect(table).toContain('clicks bigint');
    expect(table).not.toMatch(/ip|user_id|session|cookie|agent/i);
  });
  it('never sends a customer name, email or id to a creator', () => {
    const portal = migration.slice(
      migration.indexOf('create function public.creator_portal()'),
      migration.indexOf('-- ---- applying'),
    );
    expect(portal).not.toMatch(
      /customer_name|customer_id|auth\.users|profiles/,
    );
  });
  it('uses the shared tier and hold rules', () => {
    expect(migration).toContain('public.creator_tier(');
    expect(migration).toContain('public.payout_order_blocked(');
    expect(migration).toContain(`interval '${CREATOR_HOLD_DAYS} days'`);
    expect(migration).toContain("'payoutMinCents', 5000");
    for (const tier of CREATOR_RULES.tiers)
      expect(migration).toContain(
        `'id', '${tier.id}', 'name', '${tier.name}', 'from', ${tier.from}, 'commission', ${tier.commission}`,
      );
    // Round half up at the month, the same expression admin_creator_dto uses.
    expect(migration).toContain('+ 50) / 100');
  });
  it('offers the same payout rails as the contract', () => {
    expect(migration).toContain(
      `payout_method in (${CREATOR_PAYOUT_METHODS.map((m) => `'${m}'`).join(',')})`,
    );
  });
  it('reserves the same words as the contract', () => {
    const list = migration
      .slice(
        migration.indexOf('select pg_catalog.lower(p_code) = any (array['),
        migration.indexOf(
          ']);',
          migration.indexOf('select pg_catalog.lower(p_code)'),
        ),
      )
      .match(/'[a-z]+'/g);
    expect(list?.map((word) => word.slice(1, -1)).sort()).toEqual(
      [...RESERVED_CREATOR_CODES].sort(),
    );
  });
  it('agrees with the client side code check', () => {
    expect(creatorCodeIssue('alex10')).toBeNull();
    expect(creatorCodeIssue('no')).toMatch(/3 to 20/);
    expect(creatorCodeIssue(' Blog ')).toMatch(/Duoly page/);
    expect(creatorCodeIssue('ALEX-10')).toMatch(/3 to 20/);
  });
  it('excludes the application being decided from code reservations', () => {
    expect(migration).toContain(
      'creator_code_state(p_code text, p_exclude_application uuid default null)',
    );
    expect(migration).toContain('a.id is distinct from p_exclude_application');
    expect(migration).toContain('public.creator_code_state(v_code, v_app.id)');
  });
  it('reserves a requested code against every other account', () => {
    // Two accounts asking for the same code at the same moment: the index makes a second open
    // reservation impossible, and the lock serialises the check with the insert.
    expect(migration).toContain(
      "create unique index creator_applications_code_open on public.creator_applications(requested_code) where status = 'applied'",
    );
    const locks = [
      ...migration.matchAll(/'duoly\.creator\.code\.' \|\| v_code/g),
    ];
    expect(locks).toHaveLength(2); // applying and approving take the same lock
    // A duplicate code must not be reported as a duplicate application.
    expect(migration).toContain("'That code is taken. Try another one.'");
  });
  it('counts an order still being played as pending, never as earned', () => {
    const money = moneyHelper();
    // Spec: pending is "orders not completed yet or inside the 30-day hold".
    expect(money).toContain(
      "'pendingCents', (select h.cents from held as h) + (select lf.open_cents from loose_figures as lf)",
    );
    // The two halves stay separate so the dashboard can say which is only an estimate.
    expect(money).toContain("'heldCents', (select h.cents from held as h)");
    expect(money).toContain(
      "'openCents', (select lf.open_cents from loose_figures as lf)",
    );
    // Earned is still the completed-only figure admin_creator_dto() shows.
    const earned = money.slice(
      money.indexOf("'earnedCents'"),
      money.indexOf("'thresholdCents'"),
    );
    expect(earned).toContain('f.earned');
    expect(earned).not.toMatch(/open|estimate|loose/);
    expect(ordersHelper()).toContain(
      'case when c.is_open then greatest(0, c.amount - c.refunds) else 0::bigint end',
    );
  });
  it('reverses a refunded or voided order before it completes', () => {
    expect(ordersHelper()).toMatch(
      /case when a\.pay_state in \('refunded', 'voided'\) then a\.amount\s+when a\.status <> 'completed' then 0::bigint/,
    );
    // Reversals outside any commission month still reach the dashboard total.
    const reversed = moneyHelper().slice(
      moneyHelper().indexOf("'reversedCents'"),
      moneyHelper().indexOf("'earnedCents'"),
    );
    expect(reversed).toContain('loose_figures');
  });
  it('shows an order its own amount even when nothing is earned on it', () => {
    const portal = portalFunction();
    expect(portal).toContain("'amountCents', o.amount");
    expect(portal).toContain("'refundedCents', o.refunds");
    expect(portal).toContain("'estimatedCents'");
    // The estimate is never presented as earned commission.
    expect(portal).toContain(
      "'commissionCents', case when o.counts then (o.base * o.rate + 50) / 100 else 0 end",
    );
  });
  it('requires the currently published terms even through a direct RPC', () => {
    expect(migration).toContain("coalesce(p_terms, '') <> '2026-11-17'");
  });
  it('releases the hold exactly at 30 days', () => {
    expect(migration).toContain("c.completed_at <= p_now - interval '30 days'");
  });
  it('never writes to orders, payments or payouts', () => {
    expect(migration).not.toMatch(
      /insert into public\.(orders|order_payments|creator_payouts)/i,
    );
    expect(migration).not.toMatch(
      /update public\.(orders|order_payments|refund_credits)/i,
    );
  });
});
