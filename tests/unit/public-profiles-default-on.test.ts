import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  INDEX_MIN_BIO_CHARS,
  INDEX_MIN_SESSIONS,
  SLUG_PATTERN,
  profileIndexable,
  slugFromName,
  slugValid,
  type PublicTeammateProfile,
} from '../../src/contracts/teammate-profile';
import { fixtureLookup } from '../../src/server/teammates/profile-fixtures';

const path =
  'supabase/migrations/20261112130000_public_profiles_default_on.sql';
const sql = readFileSync(path, 'utf8');
const base = fixtureLookup('pip');
if (base.status !== 'ok') throw new Error('Pip fixture missing');
const thin: PublicTeammateProfile = base.profile;

describe('profiles on by default (20261112130000)', () => {
  it('is a new file and leaves every earlier migration alone', () => {
    const files = readdirSync('supabase/migrations').sort();
    expect(files.at(-1)).toBe('20261112130000_public_profiles_default_on.sql');
    /* Only create or replace of functions the previous migration installed, never an edit. */
    expect(sql).not.toMatch(/\bdrop\s+(function|table|trigger)\b/i);
    expect(sql).toContain('begin;');
    expect(sql).toMatch(/\ncommit;\n$/);
  });
  it('turns profiles on and installs the backfill, trigger and slug rules', () => {
    expect(sql).toContain(
      'alter table public.teammate_public_profiles alter column published set default true',
    );
    for (const name of [
      'teammate_public_slug_base',
      'teammate_public_slug_free',
      'teammate_public_slug_pick',
      'teammate_public_featured_pick',
      'teammate_public_featured_guard',
      'teammate_public_profile_access_changed',
      'customer_favorite_add_by_slug',
    ])
      expect(sql).toContain(`function public.${name}(`);
    expect(sql).toContain(
      'after insert or update of approved_games on public.teammate_order_access',
    );
    expect(sql).toContain(
      'create or replace function public.public_teammate_indexable()',
    );
    /* The review form notice ships with this migration, so the cutoff is its apply time. */
    expect(sql).toContain(
      'update public.teammate_public_profile_settings set public_profile_notice_at = pg_catalog.clock_timestamp()',
    );
  });
  it('keeps the protected favorites migration untouched and only adds a path', () => {
    const favorites = readFileSync(
      'supabase/migrations/20261106150000_customer_favorites.sql',
      'utf8',
    );
    expect(favorites).toContain(
      'create function public.customer_order_favorite_set(',
    );
    /* The new path reuses the old cap and the old locking instead of its own numbers. */
    expect(sql).toContain('public.customer_favorites_max()');
    expect(sql).toContain(
      'from public.profiles p where p.id = v_actor for update',
    );
    expect(sql).toContain("r.role = 'customer'");
    /* Only a page a visitor could have opened, and never yourself. */
    expect(sql).toContain('public.public_teammate_profile(p_slug)');
    expect(sql).toContain('v_teammate = v_actor');
  });
  it('grants the new RPC to signed in accounts and nothing else', () => {
    expect(sql).toContain(
      'grant execute on function public.customer_favorite_add_by_slug(text) to authenticated',
    );
    expect(sql).toContain(
      'revoke all on function %s from public, anon, authenticated, service_role',
    );
    expect(sql).not.toMatch(/to anon/);
  });
  it('carries the apply warning and no connection string of its own', () => {
    /* This migration flips live teammates to published, so the header has to say so. */
    expect(sql).toContain('OWNER APPROVAL REQUIRED');
    expect(sql).toContain('Never db push or apply to the hosted project');
    expect(sql).not.toMatch(
      /--linked|project-ref|postgres:\/\/|supabase link/i,
    );
  });
});

describe('the indexing rule the migration and the contract share', () => {
  const withBio = (chars: number) => ({ ...thin, bio: 'b'.repeat(chars) });
  it('needs an approved game before anything else', () => {
    expect(profileIndexable({ ...withBio(200), games: [] })).toBe(false);
  });
  it('accepts a verified rank, a real bio or a track record, and nothing less', () => {
    expect(profileIndexable(thin)).toBe(false);
    expect(profileIndexable(withBio(INDEX_MIN_BIO_CHARS - 1))).toBe(false);
    expect(profileIndexable(withBio(INDEX_MIN_BIO_CHARS))).toBe(true);
    /* Whitespace is not a bio. */
    expect(
      profileIndexable({ ...thin, bio: ' '.repeat(INDEX_MIN_BIO_CHARS + 10) }),
    ).toBe(false);
    expect(
      profileIndexable({ ...thin, sessions: INDEX_MIN_SESSIONS - 1 }),
    ).toBe(false);
    expect(profileIndexable({ ...thin, sessions: INDEX_MIN_SESSIONS })).toBe(
      true,
    );
    expect(
      profileIndexable({
        ...thin,
        games: [{ ...thin.games[0]!, rank: 'Diamond', verified: true }],
      }),
    ).toBe(true);
    /* An unverified rank a teammate typed is not a signal. */
    expect(
      profileIndexable({
        ...thin,
        games: [{ ...thin.games[0]!, rank: 'Diamond', verified: false }],
      }),
    ).toBe(false);
  });
  it('matches the three branches the SQL rule uses', () => {
    expect(sql).toContain('r.verified_at is not null');
    expect(sql).toContain(
      `pg_catalog.char_length(pg_catalog.btrim(coalesce(pr.bio, ''))) >= ${INDEX_MIN_BIO_CHARS}`,
    );
    expect(sql).toContain(
      `public.payout_valid_count(p.user_id) >= ${INDEX_MIN_SESSIONS}`,
    );
  });
});

describe('the slug the backfill hands out', () => {
  /* The SQL fold and slugFromName() have to agree, so the cases the SQL test asserts in
     Postgres are asserted here against the contract helper too. */
  it.each([
    ['Nyx Backfill', 'nyx-backfill'],
    ['Zoë Café', 'zoe-cafe'],
    ['  --Nyx!!  ', 'nyx'],
    ['日本語', ''],
    ['Averyveryverylongteammatename', 'averyveryverylongteammat'],
  ])('turns %s into %s', (name, slug) => {
    expect(slugFromName(name)).toBe(slug);
  });
  it('rejects the bases the backfill has to replace with a hash', () => {
    expect(slugValid(slugFromName('日本語'))).toBe(false);
    expect(slugValid(slugFromName('Al'))).toBe(false);
    /* A reserved word is a valid shape, so the backfill numbers it instead. */
    expect(SLUG_PATTERN.test('admin')).toBe(true);
    expect(slugValid('admin')).toBe(false);
    expect(slugValid('admin-2')).toBe(true);
  });
  it('keeps the hash fallback and the numbered fallback inside the pattern', () => {
    expect(slugValid('teammate-0a1b2c3d')).toBe(true);
    expect(slugValid('averyveryverylongteam-2')).toBe(true);
    expect(slugValid('teammate-0a1b2c3d4e5f')).toBe(true);
    expect(sql).toContain(
      "'teammate-' || pg_catalog.substr(pg_catalog.encode(",
    );
  });
});
