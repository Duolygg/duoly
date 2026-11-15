import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CATALOG } from '../../src/design-reference/lib/catalog.js';
import { SetPlusOnlyGamesSchema } from '../../src/contracts/admin';
import { knowledgeMatch } from '../../src/server/support/knowledge';

const read = (name: string) =>
  readFileSync(`supabase/migrations/${name}`, 'utf8');
const tiers = read('20261030140000_duo_tiers.sql');
const perks = read('20261026160000_perks.sql');
const handover = read('20261024170000_handover_admin_actions.sql');

/** One function definition, from its header to the closing dollar quote. */
function fn(sql: string, header: string, end: RegExp): string {
  const at = sql.indexOf(header);
  if (at < 0) throw new Error('missing ' + header);
  const rest = sql.slice(at);
  const m = end.exec(rest);
  if (!m) throw new Error('unterminated ' + header);
  return rest.slice(0, m.index + m[0].length);
}

describe('duo tiers migration', () => {
  it('maps every game by service id and keeps Standard as the default level', () => {
    expect(tiers).toContain(
      "when 'duo1' then 'plus' when 'duo2' then 'pro' when 'duo3' then 'apex'",
    );
    expect(tiers).toContain(
      "add column duo_level text not null default 'standard' check (duo_level in ('standard', 'plus_only'))",
    );
    // Apex: TOP 1/5% (latest run) or the Diamond pick right away, everyone Standard after 100 s
    expect(tiers).toContain('s.bracket in (1, 5)');
    expect(tiers).toContain(
      "return public.order_public_queued_at(p_order) + interval '100 seconds';",
    );
    expect(tiers).toMatch(
      /if p_access\.duo_level = 'plus_only' then\s+return case when v_tier = 'plus' then p_order\.queued_at end;/,
    );
    expect(tiers).toContain(
      'if p_order.gg then return p_order.queued_at; end if;',
    );
  });

  it('replaces each function with the live definition plus only the tier lines', () => {
    const strip = (sql: string, added: RegExp[]) =>
      added.reduce((s, re) => s.replace(re, ''), sql);
    const cases: [string, string, string, RegExp, RegExp[]][] = [
      [
        perks,
        'create or replace function public.order_eligible(',
        'create or replace function public.order_eligible(',
        /\n\$function\$;/,
        [
          / {6}and public\.order_tier_open_at\(p_order, a\) <= pg_catalog\.clock_timestamp\(\)\n/,
        ],
      ],
      [
        perks,
        'create or replace function public.accept_handover(',
        'create or replace function public.accept_handover(',
        /\n\$function\$;/,
        [
          / {2}v_access public\.teammate_order_access;\n/,
          / {2}-- Duo tiers \(20261030140000\)[\s\S]*?\n {4}end if;\n {2}end if;\n/,
        ],
      ],
      [
        handover,
        'create function public.handover_info(',
        'create or replace function public.handover_info(',
        /\n\$\$;/,
        [
          / {2}if v_h\.kind = 'bot' and public\.order_tier_open_at[\s\S]*?\n {2}end if;\n/,
        ],
      ],
      [
        perks,
        'create function public.order_pick_start(',
        'create or replace function public.order_pick_start(',
        /\nend \$\$;/,
        [
          / {2}-- Duo tiers: the customer's pick[\s\S]*?\n {4}return false;\n {2}end if;\n/,
        ],
      ],
    ];
    for (const [src, oldHeader, newHeader, end, added] of cases) {
      const before = fn(src, oldHeader, end).replace(oldHeader, newHeader);
      const after = fn(tiers, newHeader, end);
      expect(after).not.toBe(before);
      expect(strip(after, added)).toBe(before);
    }
    const expire = fn(
      tiers,
      'create or replace function public.order_expire_locked(',
      /\n\$function\$;/,
    );
    expect(expire).toContain(
      'greatest(public.order_visible_at(v, a, v_now), pr.online_since, public.order_tier_open_at(v, a)) as shown_at',
    );
    expect(expire).toContain('and public.order_tier_open_at(v, a) is not null');
  });

  it('only tiers the Discord bot link; admin links stay unrestricted', () => {
    const accept = fn(
      tiers,
      'create or replace function public.accept_handover(',
      /\n\$function\$;/,
    );
    expect(accept).toMatch(
      /if v_h\.kind = 'bot' then\s+select a\.\* into v_access/,
    );
  });
});

describe('tiers in the catalog', () => {
  it('names each tier slot the way the docs describe', () => {
    const slot = (game: string, id: string) =>
      (CATALOG as Record<string, { services: unknown[][] }>)[
        game
      ]?.services.find((s) => s[0] === id)?.[2];
    expect(slot('lol', 'duo1')).toBe('Duo Plus');
    expect(slot('lol', 'duo2')).toBe('Duo Pro');
    expect(slot('lol', 'duo3')).toBe('Duo Apex');
    expect(slot('cs2', 'duo3')).toBe('FACEIT Duo');
    expect(slot('cod', 'duo3')).toBe('Warzone Ranked');
    expect(slot('apex', 'duo3')).toBeUndefined();
    // every duo tier service sits in the Duo tab
    for (const [game, c] of Object.entries(
      CATALOG as Record<string, { services: unknown[][] }>,
    ))
      for (const s of c.services)
        if (/^duo[123]$/.test(String(s[0])))
          expect([game, s[1]]).toEqual([game, 'duo']);
  });
});

describe('admin and Sparky', () => {
  it('takes a list of game ids for Plus only', () => {
    const base = {
      csrf: 't',
      userId: '11111111-1111-4111-8111-111111111111',
    };
    const ok = (plusOnly: unknown) =>
      SetPlusOnlyGamesSchema.safeParse({ ...base, plusOnly }).success;
    expect(ok(['lol', 'val'])).toBe(true);
    expect(ok([])).toBe(true);
    // the old one-level-for-every-game shape is gone
    expect(
      SetPlusOnlyGamesSchema.safeParse({ ...base, level: 'plus_only' }).success,
    ).toBe(false);
    expect(ok('lol')).toBe(false);
    expect(ok(['LoL; drop'])).toBe(false);
  });

  it('explains tiers to teammates without catching Apex Legends questions', () => {
    expect(knowledgeMatch('teammate', 'why can i not take duo apex')?.id).toBe(
      'duo-tiers',
    );
    expect(knowledgeMatch('teammate', 'no apex legends orders')?.id).not.toBe(
      'duo-tiers',
    );
  });
});

describe('Plus only per game (20261115140000)', () => {
  const sql = read('20261115140000_plus_only_per_game.sql');
  const tier = fn(
    sql,
    'create or replace function public.order_tier_open_at(',
    /\nend \$\$;/,
  );
  it("checks Plus only for the order's game, after streamers and Gamer Girl orders", () => {
    expect(tier).toMatch(
      /if p_order\.game = any\(p_access\.plus_only_games\) then\s+return case when v_tier = 'plus' then p_order\.queued_at end;/,
    );
    expect(tier).not.toContain('duo_level');
    expect(tier.indexOf('if p_order.gg then')).toBeLessThan(
      tier.indexOf('plus_only_games'),
    );
    // the Apex wait and the favorite shortcut stay as they were
    expect(tier).toContain('s.bracket in (1, 5)');
    expect(tier).toContain(
      'customer_favorite_of(p_order.customer_id, p_access.user_id)',
    );
  });
  it('keeps every Plus only teammate Plus only in their games, then drops the old level', () => {
    const backfill = sql.indexOf(
      "update public.teammate_order_access set plus_only_games = approved_games where duo_level = 'plus_only';",
    );
    const drop = sql.indexOf(
      'alter table public.teammate_order_access drop column duo_level;',
    );
    expect(backfill).toBeGreaterThan(0);
    expect(drop).toBeGreaterThan(backfill);
  });
  it('keeps only approved games and checks the Users section', () => {
    const set = fn(
      sql,
      'create function public.admin_set_plus_only_games(',
      /\n\$\$;/,
    );
    expect(set).toContain("public.admin_caller_for('users')");
    expect(set).toContain('x.g = any(a.approved_games)');
    expect(sql).toContain(
      'grant execute on function public.admin_duo_levels(), public.admin_set_plus_only_games(uuid, text[]) to authenticated;',
    );
  });
});
