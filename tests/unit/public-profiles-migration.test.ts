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
