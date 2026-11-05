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
