-- Purpose: public teammate profiles are ON by default (owner decision 2026-11-12, Fabi approved).
-- Every active teammate with at least one approved game gets a page and can switch it off on
-- /profile. Also: booking with a named teammate through favorites, and the indexing quality rule
-- that ships with the review form notice.
--
-- Apply notes: OWNER APPROVAL REQUIRED. Apply only through the normal reviewed migration path.
-- Never db push or apply to the hosted project during development. Test on disposable CI only.
-- This migration flips existing teammates to published, so apply it only once the privacy copy
-- and the review form notice are live.
--
-- 20261112120000_public_teammate_profiles.sql is never edited: everything here is a new object or
-- a create or replace of a function that file installed.
begin;

-- ---- profiles are on by default -----------------------------------------------------------

alter table public.teammate_public_profiles alter column published set default true;

/*
 * The featured game used to be a row check. A teammate who loses their last approved game must
 * still be updatable (we unpublish them), and a row check is re-evaluated on every update, so it
 * would lock that row out of the very write that makes it safe. A trigger enforces the same rule
 * where it actually matters: on insert, and whenever featured_game changes.
 */
alter table public.teammate_public_profiles drop constraint teammate_public_featured_approved;
create function public.teammate_public_featured_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (tg_op = 'INSERT' or new.featured_game is distinct from old.featured_game)
    and not public.teammate_public_approved(new.user_id, new.featured_game) then
    raise exception using errcode = '23514', message = 'Pick a game you are approved for.';
  end if;
  return new;
end $$;
create trigger teammate_public_featured_guard before insert or update on public.teammate_public_profiles
  for each row execute function public.teammate_public_featured_guard();

-- ---- slugs from display names -------------------------------------------------------------

/*
 * Same shape as slugFromName() in src/contracts/teammate-profile.ts: fold the Latin accents the
 * account form actually accepts, lowercase, collapse everything else into single hyphens, trim and
 * cap at 24 characters. Postgres has no NFKD, so the fold is an explicit 1:1 table; anything it
 * cannot reach (Cyrillic, CJK, emoji) collapses away and the caller falls back to a hash.
 */
create function public.teammate_public_slug_base(p_name text) returns text
language sql immutable set search_path = '' as $$
  select pg_catalog.btrim(pg_catalog.left(pg_catalog.btrim(pg_catalog.regexp_replace(
    pg_catalog.translate(pg_catalog.lower(coalesce(p_name, '')),
      'àáâãäåāăą' || 'èéêëēĕėęě' || 'ìíîïĩīĭįı' || 'òóôõöøōŏő' || 'ùúûüũūŭůűų' || 'çćĉċč'
        || 'ñńņň' || 'ďđð' || 'łľĺļ' || 'šśŝşß' || 'ÿýŷ' || 'žźż' || 'ťţþ' || 'ğģĝ' || 'řŗŕ' || 'æœ',
      'aaaaaaaaa' || 'eeeeeeeee' || 'iiiiiiiii' || 'ooooooooo' || 'uuuuuuuuuu' || 'ccccc'
        || 'nnnn' || 'ddd' || 'llll' || 'sssss' || 'yyy' || 'zzz' || 'ttt' || 'ggg' || 'rrr' || 'ao'),
    '[^a-z0-9]+', '-', 'g'), '-'), 24), '-');
$$;

/** Free to claim: valid, nobody else holds it, and not retired by somebody else inside 90 days. */
create function public.teammate_public_slug_free(p_slug text, p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.teammate_public_slug_valid(p_slug)
    and not exists(select 1 from public.teammate_public_profiles p where p.slug = p_slug and p.user_id is distinct from p_user)
    and not exists(select 1 from public.teammate_public_slug_history h where h.slug = p_slug
      and h.user_id is distinct from p_user and h.retired_at > pg_catalog.now() - interval '90 days');
$$;

/*
 * The slug a teammate gets without choosing one. Their display name first, then -2, -3 and so on,
 * then a stable hash of the user id, which is also what a name that yields nothing usable gets.
 * Returns null if even the hashes are taken, and the callers then leave the teammate without a
 * page rather than guessing.
 */
create function public.teammate_public_slug_pick(p_user uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
declare base text; candidate text; suffix text; n int := 1;
begin
  select public.teammate_public_slug_base(pr.name) into base from public.profiles pr where pr.id = p_user;
  if coalesce(pg_catalog.char_length(base), 0) < 3 then
    base := 'teammate-' || pg_catalog.substr(pg_catalog.encode(
      pg_catalog.sha256(pg_catalog.convert_to(p_user::text, 'UTF8')), 'hex'), 1, 8);
  end if;
  candidate := base;
  while not public.teammate_public_slug_free(candidate, p_user) loop
    n := n + 1;
    if n > 120 then return null; end if;
    if n <= 99 then
      suffix := '-' || n::text;
      candidate := pg_catalog.btrim(pg_catalog.left(base, 24 - pg_catalog.char_length(suffix)), '-') || suffix;
    else
      candidate := 'teammate-' || pg_catalog.substr(pg_catalog.encode(
        pg_catalog.sha256(pg_catalog.convert_to(p_user::text || n::text, 'UTF8')), 'hex'), 1, 12);
    end if;
  end loop;
  return candidate;
end $$;

/** The game a profile features: the first approved game, in the canonical order admins store. */
create function public.teammate_public_featured_pick(p_games text[]) returns text
language sql immutable set search_path = '' as $$ select (coalesce(p_games, '{}'::text[]))[1]; $$;

-- ---- backfill ------------------------------------------------------------------------------

/*
 * One page per active teammate who can already take orders. Row by row, because slug collisions
 * between two teammates with the same display name are only visible to the next row once the
 * previous one is in the table.
 */
DO $backfill$
declare r record; v_slug text;
begin
  for r in select a.user_id, a.approved_games from public.teammate_order_access a
    where pg_catalog.cardinality(a.approved_games) > 0
      and public.teammate_public_active(a.user_id)
      and not exists(select 1 from public.teammate_public_profiles p where p.user_id = a.user_id)
    order by a.user_id
  loop
    v_slug := public.teammate_public_slug_pick(r.user_id);
    if v_slug is not null then
      insert into public.teammate_public_profiles(user_id, slug, published, published_at, featured_game)
        values (r.user_id, v_slug, true, pg_catalog.clock_timestamp(), public.teammate_public_featured_pick(r.approved_games))
        on conflict (user_id) do nothing;
    end if;
  end loop;
end $backfill$;

-- ---- keeping up with game access -----------------------------------------------------------

/*
 * A teammate's first approved game creates their page. Losing the featured game moves the page to
 * the first game they still have, and losing the last one unpublishes it instead of deleting it,
 * so the slug and the settings survive until they are approved again.
 *
 * Rows in teammate_game_ranks for removed games are deliberately left alone: the read functions
 * already only show ranks for approved games, and an admin's verification should not be thrown
 * away by a temporary access change.
 */
create function public.teammate_public_profile_access_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
declare p public.teammate_public_profiles; v_games text[] := coalesce(new.approved_games, '{}'::text[]);
  v_slug text; v_featured text;
begin
  select * into p from public.teammate_public_profiles where user_id = new.user_id;
  if p.user_id is null then
    if pg_catalog.cardinality(v_games) = 0 or not public.teammate_public_active(new.user_id) then return new; end if;
    v_slug := public.teammate_public_slug_pick(new.user_id);
    if v_slug is null then return new; end if;
    insert into public.teammate_public_profiles(user_id, slug, published, published_at, featured_game)
      values (new.user_id, v_slug, true, pg_catalog.clock_timestamp(), public.teammate_public_featured_pick(v_games))
      on conflict (user_id) do nothing;
    return new;
  end if;
  if p.featured_game = any(v_games) then return new; end if;
  v_featured := public.teammate_public_featured_pick(v_games);
  if v_featured is null then
    update public.teammate_public_profiles set published = false, updated_at = pg_catalog.clock_timestamp()
      where user_id = new.user_id;
  else
    update public.teammate_public_profiles set featured_game = v_featured, updated_at = pg_catalog.clock_timestamp()
      where user_id = new.user_id;
  end if;
  return new;
end $$;
create trigger teammate_public_profile_access_changed
  after insert or update of approved_games on public.teammate_order_access
  for each row execute function public.teammate_public_profile_access_changed();

-- ---- indexing quality rule ------------------------------------------------------------------

/*
 * From 20261112120000_public_teammate_profiles.sql; changed: a verified rank is one of three ways
 * to qualify instead of the only way. Profiles are on by default now, so the rule has to pass the
 * honest pages (a real bio, or a track record) without waiting for a rank check that only an admin
 * can do. Mirrored exactly by profileIndexable() in src/contracts/teammate-profile.ts.
 */
create or replace function public.public_teammate_indexable() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('slug', p.slug, 'updatedAt', p.updated_at) order by p.slug), '[]'::jsonb)
  from public.teammate_public_profiles p join public.profiles pr on pr.id = p.user_id
  where p.published and not p.admin_hidden and public.teammate_public_active(p.user_id)
    and public.teammate_public_approved(p.user_id, p.featured_game)
    and (exists(select 1 from public.teammate_game_ranks r where r.user_id = p.user_id and r.verified_at is not null
          and r.rank is not null and public.teammate_public_approved(r.user_id, r.game))
      or (public.teammate_public_bio_valid(pr.bio) and pg_catalog.char_length(pg_catalog.btrim(coalesce(pr.bio, ''))) >= 60)
      or public.payout_valid_count(p.user_id) >= 5);
$$;

-- ---- booking with a named teammate (plan option 1) ------------------------------------------

/*
 * "Book with <Name>" adds the teammate to the customer's favorites and then opens normal booking.
 * A favorite sees the order the moment it reaches the public queue with no priority delay
 * (order_visible_at in 20261106150000_customer_favorites.sql), which is what the copy on the
 * profile promises.
 *
 * The existing add path (customer_order_favorite_set) names a teammate by one of the customer's own
 * orders, which a visitor who never played with them does not have. This is the parallel path: the
 * public slug, with the same customer role check, the same 100 favorite cap and the same locking.
 * 20261106150000 is not edited.
 */
create function public.customer_favorite_add_by_slug(p_slug text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_teammate uuid; v_profile jsonb;
begin
  if v_actor is null then return public.order_error(401, 'Authentication required.'); end if;
  if not exists(select 1 from public.account_roles r where r.user_id = v_actor and r.role = 'customer') then
    return public.order_error(403, 'Customer role required.');
  end if;
  -- Only a page a visitor can actually see: published, not hidden, active, approved for its game.
  v_profile := public.public_teammate_profile(p_slug);
  if v_profile ? 'status' or not v_profile ? 'slug' then
    return public.order_error(404, 'That teammate profile is not available.');
  end if;
  select p.user_id into v_teammate from public.teammate_public_profiles p where p.slug = p_slug;
  if v_teammate is null or v_teammate = v_actor then
    return public.order_error(404, 'That teammate profile is not available.');
  end if;
  if exists(select 1 from public.customer_favorites f where f.customer_id = v_actor and f.teammate_id = v_teammate) then
    return pg_catalog.jsonb_build_object('favorite', true, 'slug', p_slug, 'game', v_profile->>'featuredGame');
  end if;
  -- one at a time per customer, so the cap holds under concurrent clicks
  perform 1 from public.profiles p where p.id = v_actor for update;
  if (select pg_catalog.count(*) from public.customer_favorites f where f.customer_id = v_actor)
     >= public.customer_favorites_max() then
    return public.order_error(409, 'You can have up to 100 favorites. Remove one first.');
  end if;
  insert into public.customer_favorites(customer_id, teammate_id) values (v_actor, v_teammate) on conflict do nothing;
  return pg_catalog.jsonb_build_object('favorite', true, 'slug', p_slug, 'game', v_profile->>'featuredGame');
end $$;

-- ---- review text consent --------------------------------------------------------------------

-- The review form notice ships in this release, so review text written from now on may appear on a
-- profile. Everything written before this moment stays private (plan section 9).
update public.teammate_public_profile_settings set public_profile_notice_at = pg_catalog.clock_timestamp()
  where singleton;

-- ---- grants ---------------------------------------------------------------------------------

DO $acl$
declare f regprocedure;
begin
  for f in select p.oid::regprocedure from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('teammate_public_featured_guard', 'teammate_public_slug_base',
      'teammate_public_slug_free', 'teammate_public_slug_pick', 'teammate_public_featured_pick',
      'teammate_public_profile_access_changed', 'customer_favorite_add_by_slug')
  loop execute pg_catalog.format('revoke all on function %s from public, anon, authenticated, service_role', f); end loop;
end $acl$;
grant execute on function public.customer_favorite_add_by_slug(text) to authenticated;

commit;
