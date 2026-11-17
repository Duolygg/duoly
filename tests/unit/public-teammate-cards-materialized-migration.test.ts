import { readFileSync, existsSync } from 'node:fs';
import { expect, it } from 'vitest';

it('materializes public profile documents once before card projection', () => {
  const path =
    'supabase/migrations/20261118000000_public_teammate_cards_materialized.sql';
  expect(existsSync(path)).toBe(true);
  const sql = readFileSync(path, 'utf8');
  expect(sql).toMatch(/WITH profile_docs AS MATERIALIZED/i);
  expect(sql.match(/public\.public_teammate_profile\(p\.slug\)/g)).toHaveLength(
    1,
  );
  expect(sql).toMatch(/from profile_docs p/i);
  expect(sql).toMatch(/STABLE SECURITY DEFINER/i);
  expect(sql).toMatch(/SET search_path TO ''/i);
  expect(sql).toMatch(
    /revoke all on function public\.public_teammate_cards\(text, int, text\) from public, anon, authenticated, service_role/i,
  );
  expect(sql).toContain('to anon, authenticated');
});
