import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isBanned } from '../../src/server/auth/context';

// Suspension locks the account and taking the Discord Teammate role suspends
// (migration 20261105120000_suspension_locks_account.sql).
describe('banned sessions end on the next page load', () => {
  const now = Date.parse('2026-11-05T12:00:00Z');
  it('treats a future or infinite ban as banned', () => {
    expect(isBanned('infinity', now)).toBe(true);
    expect(isBanned('2099-01-01T00:00:00Z', now)).toBe(true);
  });
  it('lets everyone else through', () => {
    expect(isBanned(null, now)).toBe(false);
    expect(isBanned(undefined, now)).toBe(false);
    expect(isBanned('', now)).toBe(false);
    expect(isBanned('2020-01-01T00:00:00Z', now)).toBe(false);
    expect(isBanned('not a date', now)).toBe(false);
  });
});

describe('migration', () => {
  const sql = readFileSync(
    'supabase/migrations/20261105120000_suspension_locks_account.sql',
    'utf8',
  );
  it('bans in Auth and ends sessions on suspend, lifts the ban on reinstate', () => {
    expect(sql).toContain(
      "update auth.users set banned_until = 'infinity'::timestamptz where id = p_user_id;",
    );
    expect(sql).toContain(
      'delete from auth.sessions where user_id = p_user_id;',
    );
    expect(sql).toContain(
      'update auth.users set banned_until = null where id = p_user_id;',
    );
  });
  it('lets only the server-side Discord sync suspend through Discord', () => {
    expect(sql).toContain(
      'grant execute on function public.discord_teammate_role_removed(text) to service_role;',
    );
    expect(sql).toContain("'Teammate role removed on Discord'");
  });
  it('the login page explains a suspension', () => {
    expect(readFileSync('src/pages/login.astro', 'utf8')).toContain(
      'Your account is suspended',
    );
  });
});
