import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrations = resolve('supabase/migrations');
function migration() {
  const files = existsSync(migrations)
    ? readdirSync(migrations).filter((file) =>
        file.endsWith('_account_foundation.sql'),
      )
    : [];
  expect(
    files,
    'exactly one account foundation migration must exist',
  ).toHaveLength(1);
  const file = files[0];
  if (!file) throw new Error('Account migration is missing.');
  return readFileSync(resolve(migrations, file), 'utf8');
}
const compact = (sql: string) =>
  sql
    .replace(/--[^\n]*/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();

describe('account foundation migration contract (static, not database acceptance)', () => {
  it('creates constrained profiles and private customer roles with cascading auth ownership', () => {
    const sql = compact(migration());
    expect(
      sql.match(/references auth\.users\(id\) on delete cascade/g),
    ).toHaveLength(2);
    expect(sql).toContain("name text not null default 'player'");
    expect(sql).toContain('char_length(name) between 2 and 32');
    expect(sql).toContain(
      "image ~ '^/assets/avatars/avatar-([1-9]|10)\\.png$'",
    );
    expect(sql).toContain("role text not null default 'customer'");
    expect(sql).toContain("role in ('customer', 'teammate', 'admin')");
    expect(sql).toContain('created_at timestamptz not null default now()');
    expect(sql).toContain('updated_at timestamptz not null default now()');
  });

  it('allows exactly the design country codes plus the empty country', () => {
    const sql = migration();
    const countryCheck = sql.match(
      /constraint profiles_country_check check \(country in \(([\s\S]*?)\)\)/i,
    );
    expect(countryCheck, 'explicit country allowlist').not.toBeNull();
    const values = countryCheck?.[1];
    if (!values) throw new Error('Country constraint is missing.');
    const actual = [...values.matchAll(/'([^']*)'/g)].map((match) => match[1]);
    const design = readFileSync(
      resolve('src/design-reference/lib/countries.js'),
      'utf8',
    );
    const expected = [
      '',
      ...[...design.matchAll(/\['([a-z]{2})',/g)].map((match) => match[1]),
    ];
    expect(actual.sort()).toEqual(expected.sort());
    expect(new Set(actual).size).toBe(actual.length);
  });

  it('bootstraps only customer, isolates definer execution, and backfills without overwrites', () => {
    const sql = compact(migration());
    expect(sql).toContain("security definer set search_path = ''");
    expect(sql).toContain('after insert on auth.users');
    expect(sql).toContain(
      "values (new.id, 'customer') on conflict (user_id) do nothing",
    );
    expect(sql).not.toMatch(/raw_user_meta_data|raw_app_meta_data/);
    expect(sql).toContain(
      "select id, 'customer' from auth.users where true on conflict (user_id) do nothing",
    );
    expect(sql).not.toContain('do update');
    expect(sql).toContain(
      'revoke all on function public.handle_new_account() from public, anon, authenticated, service_role',
    );
    expect(sql).toContain('new.updated_at := pg_catalog.clock_timestamp()');
    expect(sql).toContain('before update on public.profiles');
  });

  it('exposes only own reads and safe profile-column updates to authenticated', () => {
    const sql = compact(migration());
    for (const table of ['profiles', 'account_roles']) {
      expect(sql).toContain(
        `alter table public.${table} enable row level security`,
      );
      expect(sql).toContain(
        `revoke all on table public.${table} from public, anon, authenticated, service_role`,
      );
      expect(sql).toContain(
        `grant select on table public.${table} to authenticated`,
      );
    }
    expect(sql).toContain(
      'grant update (name, country, image) on public.profiles to authenticated',
    );
    expect(sql).toContain(
      'for select to authenticated using ((select auth.uid()) = id)',
    );
    expect(sql).toContain(
      'for select to authenticated using ((select auth.uid()) = user_id)',
    );
    expect(sql).toContain(
      'for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id)',
    );
    expect(sql).not.toMatch(
      /grant (?:all|insert|delete|update on)[^;]*to authenticated/,
    );
    expect(sql).not.toMatch(/create policy[^;]*for (?:insert|delete|all)/);
    expect(sql).not.toMatch(/grant[^;]*to anon/);
  });
});
