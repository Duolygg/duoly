import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const path = 'supabase/migrations/20261106110000_analytics_outbox.sql';
const sql = existsSync(path) ? readFileSync(path, 'utf8') : '';

describe('analytics outbox migration', () => {
  it('creates a private durable queue with service-role-only table and sequence access', () => {
    expect(sql).toMatch(/create table public\.analytics_outbox/);
    expect(sql).toMatch(/dedup_key text not null unique/);
    expect(sql).toMatch(
      /uuid uuid not null default pg_catalog\.gen_random_uuid\(\)/,
    );
    expect(sql).toMatch(
      /alter table public\.analytics_outbox enable row level security/,
    );
    expect(sql).toMatch(
      /revoke all on table public\.analytics_outbox from public, anon, authenticated/,
    );
    expect(sql).toMatch(
      /grant .* on table public\.analytics_outbox to service_role/,
    );
    expect(sql).toMatch(
      /grant .* on sequence public\.analytics_outbox_id_seq to service_role/,
    );
    expect(sql).toMatch(/on conflict \(dedup_key\) do nothing/);
  });

  it('covers the marketplace catalogue with guarded per-source triggers', () => {
    const events = [
      'order_funded',
      'payment_captured',
      'authorization_voided',
      'order_refunded',
      'checkout_expired',
      'checkout_failed_server',
      'order_matched',
      'order_expired',
      'order_cancelled',
      'order_rerolled',
      'handover_accepted',
      'order_completed',
      'order_results_corrected',
      'match_report_saved',
      'desk_online_changed',
      'tip_paid',
      'pro_trial_started',
      'pro_activated',
      'pro_paused',
      'pro_resumed',
      'pro_ended',
      'pro_cancel_scheduled',
      'pro_cancel_undone',
      'pro_invoice_paid',
      'pro_invoice_failed',
      'teammate_approved',
      'payout_sent',
      'payout_reversed',
      'user_signed_up',
    ];
    for (const event of events) expect(sql).toContain(`'${event}'`);
    const triggers = [
      ...sql.matchAll(
        /create function public\.(analytics_on_\w+)\(\) returns trigger([\s\S]*?)\$\$;/g,
      ),
    ];
    expect(triggers).toHaveLength(15);
    for (const [, name, body] of triggers) {
      expect(body).toMatch(/exception when others then\s+raise warning/);
      expect(body).not.toContain('sqlerrm');
      expect(sql).toContain(`execute function public.${name}()`);
    }
    expect(sql).not.toContain('checkout_abandon_detected');
    expect(sql).toContain("new.revoke_reason = 'accepted'");
    expect(sql).toContain('old.paid_at is null and new.paid_at is not null');
    expect(sql).toContain('new.edited_at is distinct from old.edited_at');
    expect(sql).toContain(
      'new.cancel_at_period_end is distinct from old.cancel_at_period_end',
    );
    expect(sql).toContain(
      "new.paid_method in ('bank','wise','paypal','other')",
    );
  });

  it('keeps every definer function private and fixes the search path', () => {
    const functions = [
      ...sql.matchAll(
        /create function public\.(analytics_\w+)\(([\s\S]*?)\$\$;/g,
      ),
    ];
    expect(functions.length).toBeGreaterThan(14);
    for (const [, name, body] of functions) {
      expect(body).toContain("security definer set search_path = ''");
      expect(sql).toMatch(
        new RegExp(
          `revoke all on function public\\.${name}\\([^;]* from public, anon, authenticated;`,
        ),
      );
    }
    for (const grant of sql.matchAll(/^grant [^;]+;/gm))
      expect(grant[0]).toMatch(/to service_role;/);
  });

  it('projects only safe properties and makes free revenue zero', () => {
    for (const key of [
      'email',
      'name',
      'note',
      'ign',
      'message',
      'display_name',
      'order_id',
      'user_id',
      'intent_id',
    ]) {
      expect(sql).not.toMatch(new RegExp(`'${key}'\\s*,`));
    }
    expect(sql).toContain(
      "'funded_eur_cents', case when i.free_coaching then 0 else i.amount_eur_cents end",
    );
    expect(sql).toContain(
      "'card_eur_cents', case when i.free_coaching then 0 else i.amount_eur_cents - i.wallet_eur_cents end",
    );
    expect(sql).toContain(
      "'wallet_eur_cents', case when i.free_coaching then 0 else i.wallet_eur_cents end",
    );
    expect(sql).toContain('pg_catalog.jsonb_array_length(r.games)');
    expect(sql).not.toMatch(/'games'\s*,\s*(?:new|r)\.games/);
  });

  it('leases atomically, retries safely, parks poison rows and bounds diagnostics', () => {
    expect(sql).toContain('for update skip locked');
    expect(sql).toContain("interval '2 minutes'");
    expect(sql).toContain('attempts = o.attempts + 1');
    expect(sql).toContain('o.attempts < 10');
    expect(sql).toContain('attempts >= 10');
    expect(sql).toContain('claimed_until = null');
    expect(sql).toContain('pg_catalog.left(p_error, 1000)');
    expect(sql).toContain('order by o.occurred_at, o.id');
    for (const name of [
      'claim',
      'mark_sent',
      'mark_failed',
      'stats',
      'reconcile',
      'cleanup',
    ]) {
      expect(sql).toContain(`create function public.analytics_outbox_${name}(`);
    }
  });

  it('reconciles the durable source ledgers and only expires sent rows', () => {
    const reconcile =
      sql.match(
        /create function public.analytics_outbox_reconcile\([\s\S]*?\$\$;/,
      )?.[0] ?? '';
    for (const event of [
      'order_funded',
      'order_completed',
      'order_expired',
      'tip_paid',
      'user_signed_up',
      'payout_sent',
    ])
      expect(reconcile).toContain(`'${event}'`);
    expect(reconcile).toContain('on conflict (dedup_key) do nothing');
    expect(reconcile).toContain('>= p_since');
    expect(sql).toContain("sent_at < pg_catalog.now() - interval '30 days'");
    const activeSql = sql.replace(/--[^\n]*/g, '');
    expect(activeSql).not.toMatch(/cron\.schedule|net\.http_post|vault\./);
  });

  it('does not modify existing migrations relative to main (when the ref exists)', () => {
    try {
      execFileSync('git', ['rev-parse', '--verify', 'origin/main'], {
        stdio: 'ignore',
      });
    } catch {
      return; // Shallow CI checkouts may not contain origin/main.
    }
    expect(
      execFileSync(
        'git',
        [
          'diff',
          '--name-only',
          '--diff-filter=MDR',
          'origin/main...HEAD',
          '--',
          'supabase/migrations',
        ],
        { encoding: 'utf8' },
      ).trim(),
    ).toBe('');
  });
});
