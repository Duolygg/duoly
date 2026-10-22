import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
it('schedules private proof maintenance without embedding credentials or exposing network queues', () => {
  const sql = readFileSync(
    'supabase/migrations/20261023200000_proof_cleanup_schedule.sql',
    'utf8',
  );
  expect(sql).toContain('create extension if not exists pg_cron');
  expect(sql).toContain('create extension if not exists pg_net');
  expect(sql).toContain('vault.decrypted_secrets');
  expect(sql).toContain('duoly_private_proof_cleanup_service_role_key');
  expect(sql).toContain('duoly_private_proof_cleanup_url');
  expect(sql).toContain("'*/15 * * * *'");
  expect(sql).toContain('timeout_milliseconds := 25000');
  expect(sql).toContain(
    'revoke all on all tables in schema net from public, anon, authenticated, service_role',
  );
  expect(sql).toContain('private-proof-cleanup-log-prune');
  expect(sql).not.toMatch(/eyJ[A-Za-z0-9_-]{30,}|sb_secret_[A-Za-z0-9]+/);
  expect(sql).not.toContain('omnejesspybaxuacjlah');
});
