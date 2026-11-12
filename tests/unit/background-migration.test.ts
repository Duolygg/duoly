/**
 * Static guards for 20261112140000_background_switches_timers.sql and its SQL suite. The behaviour
 * is asserted by supabase/tests/background_switches.sql against a disposable local database in the
 * `sql-tests` job; these are the invariants worth failing a laptop run for, because getting any of
 * them wrong is not a failing test but a production incident: a secret in a migration, an edited
 * earlier migration, a paused dispatcher with nobody taking the work over, or a signature scheme
 * that drifts away from src/contracts/background.ts.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  MIN_SECRET_LENGTH,
  ORDER_EXPIRE_DELAY_MS,
  ORDER_POST_DELAY_MS,
  SWITCH_KINDS,
  SWITCH_MODES,
  TIMER_KINDS,
  TIMER_KIND_SWITCH,
  signBackgroundBody,
} from '../../src/contracts/background';

const name = '20261112140000_background_switches_timers.sql';
const sql = readFileSync(`supabase/migrations/${name}`, 'utf8');
const suite = readFileSync('supabase/tests/background_switches.sql', 'utf8');
const manifest = readFileSync('supabase/tests/ci-manifest.txt', 'utf8');
/* The header documents the owner's removal steps, which name drops the migration must not do. */
const statements = sql.replace(/^--.*$/gm, '');

describe('background switches migration (20261112140000)', () => {
  it('is a new file appended after every migration it builds on', () => {
    const files = readdirSync('supabase/migrations').sort();
    expect(files.filter((f) => f <= name).at(-1)).toBe(name);
    expect(files).toContain('20261112090000_gated_cron_dispatch.sql');
    expect(sql).toContain('begin;');
    expect(sql).toMatch(/\ncommit;\n$/);
    /* Additive only: the single replacement is duoly_dispatch, which the previous one installed. */
    expect(statements).not.toMatch(
      /\bdrop\s+(function|table|trigger|index)\b/i,
    );
    expect(statements).not.toMatch(
      /\balter\s+(function|table public\.orders)\b/i,
    );
    expect(sql.match(/^create or replace function/gm)).toEqual([
      'create or replace function',
    ]);
  });

  it('contains Vault and environment names only, never a secret value', () => {
    for (const vault of [
      'background_timers_url',
      'background_register_secret',
      'background_reconcile_secret',
    ])
      expect(sql).toContain(vault);
    expect(sql).not.toMatch(/vault\.create_secret/);
    /* Reads are name lookups against the view; nothing is ever written to Vault here. */
    expect(statements.match(/vault\.decrypted_secrets/g)).toHaveLength(5);
    expect(sql).not.toMatch(
      /service_role_key|sk_live|whsec_|Bearer [A-Za-z0-9]{8}/,
    );
  });

  it('defaults every kind to shadow and keeps the switch out of reach of browsers', () => {
    for (const kind of SWITCH_KINDS) expect(sql).toContain(`'${kind}'`);
    for (const mode of SWITCH_MODES) expect(sql).toContain(`'${mode}'`);
    expect(sql).toContain("mode text not null default 'shadow'");
    expect(sql).toContain(
      'alter table public.background_switches enable row level security',
    );
    expect(sql).toContain(
      'revoke all on table public.background_switches from public, anon, authenticated, service_role',
    );
    /* The app reads the mode on every fire; only the owner may write it. */
    expect(sql).toContain(
      'grant select on table public.background_switches to service_role',
    );
    expect(sql).not.toMatch(/create policy/i);
    expect(sql).not.toMatch(
      /grant (insert|update|delete|all)[\s\S]{0,80}background_switches/i,
    );
  });

  it('revokes execution of every function it installs', () => {
    for (const signature of [
      'public.background_mode(text)',
      'public.background_register_timer(text, text, bigint, bigint)',
      'public.background_order_timers()',
      'public.duoly_dispatch()',
      'public.background_overdue()',
      'public.background_fix()',
      'public.background_finalize(text)',
      'public.background_rollback()',
    ])
      /* Line wrapping differs per signature length, so compare on one normalized line. */
      expect(sql.replace(/\s+/g, ' ')).toContain(
        `revoke all on function ${signature} from public, anon, authenticated, service_role`,
      );
    /* Every function reaching outside its own schema runs definer with an empty search_path. */
    expect(sql.match(/security definer set search_path = ''/g)).toHaveLength(8);
  });

  it('registers both order timers at the owner-approved delays', () => {
    expect(sql).toContain(
      `public.background_register_timer('order-post', new.id::text, v_epoch, v_epoch + ${ORDER_POST_DELAY_MS})`,
    );
    expect(sql).toContain(
      `public.background_register_timer('order-expire', new.id::text, v_epoch, v_epoch + ${ORDER_EXPIRE_DELAY_MS})`,
    );
    /* Each timer is gated by the switch of the dispatcher that owns the same work today. */
    expect(sql).toContain(
      `if public.background_mode('${TIMER_KIND_SWITCH['order-post']}') <> 'legacy' then`,
    );
    expect(sql).toContain(
      `if public.background_mode('${TIMER_KIND_SWITCH['order-expire']}') <> 'legacy' then`,
    );
    expect(sql).toContain(
      `p_kind not in (${TIMER_KINDS.map((k) => `'${k}'`).join(',')})`,
    );
    expect(sql).toContain(
      `pg_catalog.length(decrypted_secret) >= ${MIN_SECRET_LENGTH}`,
    );
  });

  it('covers queue entry and every queue-epoch change, and nothing else', () => {
    expect(sql).toContain(
      "create trigger orders_background_timers_insert after insert on public.orders\n  for each row when (new.status = 'queued')",
    );
    expect(sql).toContain(
      'create trigger orders_background_timers_requeue after update of status, queued_at on public.orders',
    );
    expect(sql).toContain(
      "for each row when (new.status = 'queued'\n    and (new.status is distinct from old.status or new.queued_at is distinct from old.queued_at))",
    );
    /* A registration failure may never fail a customer's checkout or accept (oai-review F10). */
    expect(sql).toMatch(
      /exception when others then\n {4}raise warning 'background_order_timers/,
    );
  });

  it('signs the body the same way the worker and the app verify it', async () => {
    expect(sql).toContain(
      "v_sig := 'v1=' || pg_catalog.encode(\n    extensions.hmac(v_ts::text || '.' || v_text, v_secret, 'sha256'), 'hex')",
    );
    expect(sql).toContain('v_text := v_body::text;');
    /* No reusable credential is ever enqueued for registration (oai-review F9). */
    const register = sql.slice(
      sql.indexOf('create function public.background_register_timer'),
      sql.indexOf('create function public.background_order_timers'),
    );
    expect(register).not.toMatch(/Authorization/);
    expect(register).toContain("'x-duoly-timestamp', v_ts::text");
    expect(register).toContain("'x-duoly-signature', v_sig");
    /* The vector in docs/product/background-work.md, so SQL and Web Crypto cannot drift apart. */
    const vector = await signBackgroundBody(
      'duoly-background-test-secret-0123456789',
      1767225600000,
      '{"ok":true}',
    );
    expect(vector).toBe(
      'v1=bf92eb9d79efdbab3e9ee0e2cf0f78376423e844585117b0f990ed22679defd4',
    );
    expect(suite).toContain(vector.slice('v1='.length));
  });

  it('skips a live kind in the dispatcher and changes nothing else about it', () => {
    const before = readFileSync(
      'supabase/migrations/20261112090000_gated_cron_dispatch.sql',
      'utf8',
    );
    const body = (text: string) =>
      text
        .slice(
          text.indexOf('function public.duoly_dispatch() returns void'),
          text.indexOf('revoke all on function public.duoly_dispatch()'),
        )
        .replace(
          / {4}-- The timer path owns this kind[\s\S]*?end if;\n(?= {4}-- Preserve)/,
          '',
        );
    expect(body(sql)).toBe(body(before));
    expect(sql).toContain("if public.background_mode(v_kind) = 'live' then");
  });

  it('never pauses the dispatcher or schedules the fixer at migration time', () => {
    const outside = sql.replace(
      /create function public\.background_(finalize|rollback)[\s\S]*?\n\$\$;\n/g,
      '',
    );
    expect(outside).not.toMatch(/cron\.(schedule|alter_job|unschedule)/);
    /* Pause, never unschedule: the command stays the source of truth for the rollback. */
    expect(sql).not.toMatch(/cron\.unschedule/);
    expect(sql).toContain('active := false');
    expect(sql).toContain(
      "raise exception 'background_finalize: every kind must be live first (%)', v_laggards",
    );
  });

  it('runs in CI with the canonical production guard', () => {
    const guard = readFileSync('scripts/sql-tests/guard.sql', 'utf8');
    expect(suite.startsWith(guard)).toBe(true);
    expect(manifest).toContain('suite background_switches.sql');
    /* The suite owns its transaction and must never commit a fixture. */
    expect(suite).toMatch(/^begin;$/m);
    expect(suite).toMatch(/\nrollback;\n$/);
    expect(suite).not.toMatch(/^commit\s*;/im);
    /* Fixture requests may never name a real host, even though they are rolled back. */
    const hosts = suite.match(/https?:\/\/[a-z0-9.-]+/g) ?? [];
    for (const host of new Set(hosts))
      expect(
        host.endsWith('.invalid') || host === 'https://duoly.gg',
        host,
      ).toBe(true);
  });
});
