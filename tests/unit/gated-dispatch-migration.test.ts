import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const path = 'supabase/migrations/20261112090000_gated_cron_dispatch.sql';
const migration = () => readFileSync(path, 'utf8');
const oldJobs = [
  'duoly-discord-orders-tick',
  'duoly-payments-tick',
  'duoly-discord-roles-tick',
  'duoly-analytics-drain',
];

describe('gated cron dispatcher migration', () => {
  it('restricts the dispatcher, predicates and state to the database owner', () => {
    const sql = migration();
    expect(sql).toMatch(/security definer set search_path = ''/i);
    expect(sql).toContain(
      'revoke all on function public.duoly_dispatch() from public, anon, authenticated',
    );
    expect(sql).toContain(
      'alter table public.duoly_dispatch_state enable row level security',
    );
    expect(sql).toContain(
      'revoke all on table public.duoly_dispatch_state from public, anon, authenticated',
    );
  });

  it('keeps all existing destinations and isolates predicate and enqueue failures', () => {
    const sql = migration();
    for (const url of [
      'discord/orders/tick',
      'payments/tick',
      'discord/roles/tick',
      'internal/analytics/drain',
    ]) {
      expect(sql).toContain(`https://duoly.gg/api/${url}`);
    }
    expect(sql.match(/exception when others/g)).toHaveLength(2);
    expect(sql).toContain("interval '10 minutes'");
    expect(sql).toContain('v_due := true');
    expect(sql).toContain('timeout_milliseconds := v_timeout');
  });

  it('pauses existing jobs only when present without deleting rollback jobs', () => {
    const sql = migration();
    for (const name of oldJobs) expect(sql).toContain(`'${name}'`);
    expect(sql).toContain(
      'perform cron.alter_job(job_id := v_job.jobid, active := false)',
    );
    expect(sql).toContain('from cron.job');
    expect(sql).toContain('username = current_user');
    const executable = sql.replace(/--[^\n]*/g, '');
    expect(executable).not.toMatch(/cron\.unschedule/);
  });

  it('bounds global retention and preserves proof outcome retention', () => {
    const sql = migration();
    expect(sql).toContain("'duoly-cron-log-prune', '0 * * * *'");
    expect(sql).toContain("interval '24 hours'");
    expect(sql).toContain('limit 50000');
    expect(sql).toContain(
      "delete from public.order_proof_cleanup_runs where called_at < pg_catalog.clock_timestamp() - interval '7 days'",
    );
    expect(sql).not.toMatch(/delete from vault\./i);
  });

  it('inherits a hand-created payments timeout without silently changing it', () => {
    const sql = migration();
    expect(sql).toContain(
      'unrecognized payments timeout; inspect before rollout',
    );
    expect(sql).toContain('pg_catalog.regexp_match');
    expect(sql).toContain('if v_timeout is null then');
    expect(sql).toContain('installed pg_net default');
  });

  it('never modifies existing migration history', () => {
    const changed = execFileSync(
      'git',
      [
        'diff',
        '--name-status',
        '047185b27f489cbc3e62a45476f7b621fbcef1c7',
        '--',
        'supabase/migrations',
      ],
      { encoding: 'utf8' },
    ).trim();
    for (const line of changed.split('\n').filter(Boolean)) {
      expect(line).toBe(`A\t${path}`);
    }
  });
});
