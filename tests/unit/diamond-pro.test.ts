import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { proStatusLine, toProView } from '../../src/contracts/pro';
import Rewards from '../../src/components/account/Rewards.jsx';

// Duoly PRO free while Diamond (migration 20261106160000_diamond_free_pro.sql).
const row = (over: Record<string, unknown> = {}) => ({
  member: true,
  included: true,
  trial_eligible: false,
  has_customer: false,
  subscription: null,
  ...over,
});
const sub = (status: string, cancel = false) => ({
  status,
  trial_end: null,
  current_period_end: '2026-12-01T00:00:00Z',
  cancel_at_period_end: cancel,
  grace_until: null,
});

describe('PRO status with Diamond', () => {
  it('free with Diamond: a member with nothing to manage', () => {
    const view = toProView(row())!;
    expect(view).toMatchObject({ member: true, included: true, manage: false });
    expect(proStatusLine(view)).toBe(
      'Free with your Diamond level, for as long as you stay Diamond.',
    );
  });
  it('still paying: Manage PRO stays, with a nudge to cancel', () => {
    const view = toProView(row({ subscription: sub('active') }))!;
    expect(view.manage).toBe(true);
    expect(proStatusLine(view)).toContain('Cancel your paid PRO in Manage PRO');
    const ending = toProView(row({ subscription: sub('active', true) }))!;
    expect(proStatusLine(ending)).toBe(
      'Free with your Diamond level, for as long as you stay Diamond.',
    );
  });
  it('reads answers from before the migration as not included', () => {
    const { included, ...old } = row({
      included: undefined,
      subscription: sub('active'),
    });
    expect(included).toBeUndefined();
    expect(toProView(old)).toMatchObject({ included: false, manage: true });
  });
  it('the PRO page sends Diamond members to the dashboard', () => {
    expect(readFileSync('src/pages/pro.astro', 'utf8')).toContain(
      "if (pro.manage || pro.included) return account.redirect('/dashboard#pro');",
    );
  });
});

describe('migration', () => {
  const sql = readFileSync(
    'supabase/migrations/20261106160000_diamond_free_pro.sql',
    'utf8',
  );
  it('Diamond counts in is_pro, the one rule every PRO perk reads', () => {
    expect(sql).toContain(
      "(public.loyalty_level(public.loyalty_valid_count(p_user))->>'index')::integer >= 4",
    );
    const isPro = sql.slice(
      sql.indexOf('create or replace function public.is_pro('),
    );
    expect(isPro.slice(0, isPro.indexOf('$$;', 200))).toContain(
      'or public.pro_included(p_user));',
    );
    expect(sql).toContain("'included', public.pro_included(p_user),");
  });
  it('keeps the helper private and leaves subscriptions alone', () => {
    expect(sql).toContain(
      'revoke all on function public.pro_included(uuid) from public, anon, authenticated, service_role;',
    );
    expect(sql).not.toMatch(/grant /);
    expect(sql).not.toMatch(/update public\.pro_subscriptions|delete from/);
  });
});

describe('Rewards card', () => {
  const perks = (diamond: boolean) => ({
    level: diamond ? 'diamond' : 'platinum',
    freeCoaching: {
      eligible: true,
      used: false,
      available: true,
      month: '2026-11',
    },
    freePro: { eligible: diamond },
  });
  const card = (props: Record<string, unknown>) =>
    renderToStaticMarkup(
      React.createElement(Rewards, { orders: 1000, name: 'Alex', ...props }),
    );
  const freePro = (html: string) => {
    const at = html.indexOf('data-perk="freePro"');
    return html.slice(at, html.indexOf('</li>', at));
  };
  it('lists free PRO as a Diamond perk, unlocked from the server’s Diamond rule', () => {
    const html = card({ perks: perks(true), proLive: true });
    expect(html).toContain('Free Duoly PRO');
    expect(freePro(html)).not.toContain('coming soon');
    expect(freePro(html)).toContain('data-unlocked="true"');
  });
  it('is coming soon while PRO is switched off', () => {
    const off = freePro(card({ perks: perks(true), proLive: false }));
    expect(off).toContain('coming soon');
    expect(off).toContain('data-unlocked="false"');
  });
});
