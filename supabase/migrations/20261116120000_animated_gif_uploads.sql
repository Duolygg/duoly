-- Animated GIFs as profile pictures and profile headers.
--
-- The croppers used to paint one frame on a canvas, so a GIF came out as a still. They now cut
-- every frame and write a new GIF (src/lib/gif.ts, src/components/account/animated-image.ts).
-- The server checks the real file signature and its size before storing it
-- (src/server/auth/avatar.ts, src/server/teammates/profile-header.ts): a square from 128 to
-- 256 pixels up to 1 MB for a picture, a 3:1 strip from 600 by 200 to 1500 by 500 up to
-- 2.5 MB for a header. WebP and JPEG keep their old limits in the server code.
--
-- Everywhere a stored file name is matched, .gif now passes next to .webp and .jpg. Nothing
-- else changes: same folders, same owner rule, same cleanup queue.
begin;

-- ---- 1. buckets ---------------------------------------------------------------------------------
update storage.buckets
  set file_size_limit = 1048576, allowed_mime_types = array['image/webp', 'image/jpeg', 'image/gif']
  where id = 'avatars';
update storage.buckets
  set file_size_limit = 2621440, allowed_mime_types = array['image/webp', 'image/jpeg', 'image/gif']
  where id = 'profile-headers';

-- ---- 2. the columns -----------------------------------------------------------------------------
-- From 20261023150000_avatar_uploads.sql; only gif added.
alter table public.profiles drop constraint profiles_image_check;
alter table public.profiles add constraint profiles_image_check check (
  image = ''
  or image ~ '^/assets/avatars/avatar-([1-9]|10)\.png$'
  or image ~ ('^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/avatars/'
              || id::text || '/[0-9a-f]{16}\.(webp|jpg|gif)$')
);

-- From 20261112170000_profile_header.sql; only gif added.
alter table public.teammate_public_profiles drop constraint teammate_public_profiles_header_image_check;
alter table public.teammate_public_profiles add constraint teammate_public_profiles_header_image_check check (
  header_image is null or header_image ~ (
    '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/profile-headers/'
    || user_id::text || '/[0-9a-f]{16}\.(webp|jpg|gif)$')
);

-- ---- 3. the cleanup queue (20261113100100_storage_cleanup.sql; only gif added) ------------------
alter table public.storage_cleanup drop constraint storage_cleanup_path_check;
alter table public.storage_cleanup add constraint storage_cleanup_path_check
  check (path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{16}\.(webp|jpg|gif)$');

create or replace function public.storage_cleanup_path(p_url text, p_bucket text, p_owner uuid) returns text
language sql immutable set search_path = '' as $$
  select case
    when v.path ~ ('^' || p_owner::text || '/[0-9a-f]{16}\.(webp|jpg|gif)$') then v.path
  end
  from (select pg_catalog.split_part(coalesce(p_url, ''),
    '/storage/v1/object/public/' || p_bucket || '/', 2) as path) v;
$$;

create or replace function public.storage_cleanup_profiles() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_object record;
begin
  if tg_op = 'DELETE' then
    for v_object in select o.bucket_id, o.name from storage.objects o
      where o.bucket_id in ('avatars', 'profile-headers')
        and o.name like old.id::text || '/%'
    loop
      if v_object.name ~ ('^' || old.id::text || '/[0-9a-f]{16}\.(webp|jpg|gif)$') then
        perform public.storage_cleanup_enqueue(v_object.bucket_id, v_object.name, 'account');
      end if;
    end loop;
  elsif old.image is distinct from new.image then
    perform public.storage_cleanup_enqueue('avatars',
      public.storage_cleanup_path(old.image, 'avatars', old.id), 'replaced');
  end if;
  return null;
exception when others then
  raise warning 'storage_cleanup_profiles % failed [%]: %', tg_op, sqlstate, sqlerrm;
  return null;
end;
$$;

-- ---- 4. the public profile ----------------------------------------------------------------------
/* Body copied from 20261115120000_featured_games.sql; only gif added to the uploaded avatar
   pattern. create or replace keeps the grants. */
create or replace function public.public_teammate_profile(p_slug text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare p public.teammate_public_profiles; pr public.profiles; n bigint; rc bigint; ra numeric; wins bigint; games bigint;
  old_user uuid; cutoff timestamptz; result jsonb;
begin
  select * into p from public.teammate_public_profiles where slug=p_slug;
  if not found then
    select user_id into old_user from public.teammate_public_slug_history where slug=p_slug;
    if not found then return pg_catalog.jsonb_build_object('status','missing'); end if;
    select * into p from public.teammate_public_profiles where user_id=old_user;
    if p.user_id is not null and p.published and not p.admin_hidden and public.teammate_public_active(p.user_id)
      and public.teammate_public_approved(p.user_id,p.featured_game) then
      return pg_catalog.jsonb_build_object('status','moved','slug',p.slug);
    end if;
    return pg_catalog.jsonb_build_object('status','gone');
  end if;
  if not p.published or p.admin_hidden or not public.teammate_public_active(p.user_id)
    or not public.teammate_public_approved(p.user_id,p.featured_game) then
    return pg_catalog.jsonb_build_object('status','gone');
  end if;
  select * into pr from public.profiles where id=p.user_id;
  n := public.payout_valid_count(p.user_id);
  select pg_catalog.count(*), pg_catalog.round(pg_catalog.avg(r.rating),1) into rc, ra from public.order_reviews r where r.teammate_id=p.user_id;
  select coalesce(pg_catalog.sum(r.wins),0), coalesce(pg_catalog.sum(r.wins+r.losses),0) into wins,games
    from public.order_match_reports r join public.teammate_earning_entries e on e.assignment_id=r.assignment_id and e.teammate_id=r.teammate_id
    where r.teammate_id=p.user_id;
  select public_profile_notice_at into cutoff from public.teammate_public_profile_settings where singleton;
  result := pg_catalog.jsonb_build_object(
    'slug',p.slug,
    -- Same first-name display rule as home_teammates, never a full real name or email.
    'name',case when pr.name ~ '[@/:]' then p.slug else pg_catalog.left(pg_catalog.split_part(pg_catalog.btrim(pr.name),' ',1),16) end,
    'avatar',case
      when pr.image ~ '^/assets/avatars/avatar-([1-9]|10)\.png$' then pr.image
      when pr.image ~ ('^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/avatars/'
                       || pr.id::text || '/[0-9a-f]{16}\.(webp|jpg|gif)$') then pr.image
      else '/assets/avatars/avatar-1.png' end,
    'header',p.header_image,
    'country',case when p.show_country then pr.country else null end,'languages',pr.languages,
    'bio',case when public.teammate_public_bio_valid(pr.bio) then pr.bio else '' end,
    'accent',p.accent,'banner',p.banner,'vibeTags',p.vibe_tags,'featuredGame',p.featured_game,
    -- Ordered, and only the games the teammate still has: the access trigger keeps it that way.
    'featuredGames',coalesce(nullif(p.featured_games,'{}'::text[]),array[p.featured_game]),
    'coaching',p.coaching,
    'gamerGirl',coalesce((select a.gg_access from public.teammate_order_access a where a.user_id=p.user_id),false),
    'online',exists(select 1 from public.teammate_presence t where t.user_id=p.user_id and t.online and t.last_seen_at>pg_catalog.now()-interval '20 seconds'),
    'memberSince',pg_catalog.to_char(pr.created_at at time zone 'UTC','YYYY-MM'), 'sessions',n,
    'tier',public.completion_trust(n)->>'trust_tier',
    'rating',case when rc>=5 then pg_catalog.jsonb_build_object('average',ra,'count',rc) else null end,
    'reviewTags',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('tag',t.tag,'count',t.n) order by t.n desc,t.tag)
      from (select tag,pg_catalog.count(*) n from public.order_reviews r cross join lateral pg_catalog.unnest(r.tags) tag
        where r.teammate_id=p.user_id group by tag) t),'[]'::jsonb),
    'winRate',case when games>=20 then pg_catalog.jsonb_build_object('percent',pg_catalog.round(100.0*wins/games),'games',games) else null end,
    'games',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('game',a.game,'rank',r.rank,'peakRank',r.peak_rank,
      'verified',r.verified_at is not null,'roles',coalesce(r.roles,'{}'),'picks',coalesce(r.picks,'{}')) order by a.game='social',a.game)
      from pg_catalog.unnest(public.teammate_public_games(p.user_id)) a(game)
      left join public.teammate_game_ranks r on r.user_id=p.user_id and r.game=a.game),'[]'::jsonb),
    'reviews',coalesce((select pg_catalog.jsonb_agg(t.item order by t.created_at desc,t.order_id) from
      (select r.created_at,r.order_id,pg_catalog.jsonb_build_object('rating',r.rating,
        'text',case when cutoff is not null and r.created_at>=cutoff then r.text else '' end,
        'game',o.game,'month',pg_catalog.to_char(r.created_at at time zone 'UTC','YYYY-MM')) item
       from public.order_reviews r join public.orders o on o.id=r.order_id where r.teammate_id=p.user_id order by r.created_at desc,r.order_id limit 6) t),'[]'::jsonb),
    'updatedAt',p.updated_at);
  return result;
end $$;

commit;
