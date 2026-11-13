import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
it('installs only allowlisted definer RPCs with RLS and no direct table access', () => {
  const sql = readFileSync(
    'supabase/migrations/20261112120000_public_teammate_profiles.sql',
    'utf8',
  );
  for (const name of [
    'teammate_public_profiles',
    'teammate_public_slug_history',
    'teammate_game_ranks',
    'teammate_public_profile_settings',
  ]) {
    expect(sql).toContain(
      `alter table public.${name} enable row level security`,
    );
    expect(sql).toContain(
      `revoke all on table public.${name} from public, anon, authenticated, service_role`,
    );
  }
  for (const name of [
    'public_teammate_profile',
    'public_teammate_cards',
    'public_teammate_indexable',
    'teammate_public_profile_get',
    'teammate_public_profile_save',
    'admin_set_game_rank',
    'admin_hide_public_profile',
  ])
    expect(sql).toContain(`function public.${name}(`);
  expect(sql).toContain('public.completion_trust');
  expect(sql).toContain('public_profile_notice_at');
});

const photos = () =>
  readFileSync(
    'supabase/migrations/20261112163000_public_profile_photos.sql',
    'utf8',
  );

it('adds the photo rule by replacing the read function, nothing else', () => {
  const sql = photos();
  expect(sql).toContain(
    'create or replace function public.public_teammate_profile(p_slug text)',
  );
  /* One function, and no table, trigger or privilege change rides along with it. */
  expect(sql.match(/create or replace function/g)).toHaveLength(1);
  expect(sql).not.toMatch(
    /drop function|revoke |grant |create table|alter table|create trigger/,
  );
  /* Everything that is not a mascot and not their own file is still a mascot. */
  expect(sql).toContain("else '/assets/avatars/avatar-1.png' end");
});

/*
 * The photo may only come out of the folder the uploader writes into, so the read function and
 * the constraint that guards the column have to describe the same URL. Both build it from the
 * row's own account id: a teammate cannot point their page at somebody else's upload.
 */
it('matches the storage pattern the uploader writes', () => {
  const uploads = readFileSync(
    'supabase/migrations/20261023150000_avatar_uploads.sql',
    'utf8',
  );
  const prefix =
    "'^https://[a-z0-9]+\\.supabase\\.co/storage/v1/object/public/avatars/'";
  const suffix = "'/[0-9a-f]{16}\\.(webp|jpg)$'";
  for (const sql of [uploads, photos()]) {
    expect(sql).toContain(prefix);
    expect(sql).toContain(suffix);
  }
  expect(uploads).toContain('|| id::text ||');
  expect(photos()).toContain('|| pr.id::text ||');
});
