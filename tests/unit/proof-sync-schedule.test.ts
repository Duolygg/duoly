import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
it('keeps cleanup credentials out of the managed publicly readable pg_net queue', () => {
  const sql = readFileSync(
    'supabase/migrations/20261023210000_proof_cleanup_sync_http.sql',
    'utf8',
  );
  expect(sql).toContain('create extension if not exists http');
  expect(sql).toContain('extensions.http(');
  expect(sql).not.toContain('net.http_post');
  expect(sql).toContain('enable row level security');
  expect(sql).toContain(
    'revoke all on function public.run_order_proof_cleanup() from public, anon, authenticated, service_role',
  );
  expect(sql).toContain("'CURLOPT_TIMEOUT_MS', '25000'");
  expect(sql).toContain("v_url <> 'https://' || v_ref");
  expect(sql).toContain('http_reset_curlopt');
  expect(sql).toContain('duoly_private_proof_cleanup_service_role_key');
  expect(sql).not.toMatch(/eyJ[A-Za-z0-9_-]{30,}|sb_secret_[A-Za-z0-9]+/);
});
