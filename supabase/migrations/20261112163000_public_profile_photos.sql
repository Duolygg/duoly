-- Purpose: a public profile shows the teammate's own photo.
--
-- Teammates upload a profile picture on /profile (20261023150000_avatar_uploads.sql: the public
-- `avatars` bucket, one folder per account, 256x256 cropped WebP or JPEG, written only by the
-- server after it checked the real file signature). public_teammate_profile() mapped anything
-- that was not one of the ten mascots to '/assets/avatars/avatar-1.png', so every public page,
-- card and directory entry showed a robot instead of the person who uploaded a photo.
--
-- An uploaded image passes through when it matches the storage pattern for THAT teammate's own
-- user id, which is the same expression the profiles_image_check constraint enforces on write.
-- The folder is the account id, so a teammate cannot point their page at somebody else's upload,
-- and anything that is neither a mascot nor their own file still falls back to the mascot rather
-- than reaching a page. The user id itself stays in the database: only the URL leaves.
--
-- Nothing else about the function changes: same fields in the same order, same privacy rules,
-- same grants (create or replace keeps them). public_teammate_cards() reads its avatar out of
-- this function's result, so cards, the directory and the game hub row follow automatically.
--
-- Apply notes: OWNER APPROVAL REQUIRED. Apply only through the normal reviewed migration path.
-- Never db push or apply to the hosted project during development. Test on disposable CI only.
--
-- 20261112120000_public_teammate_profiles.sql is never edited: this is a create or replace of a
-- function that file installed.
begin;

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
    -- A mascot, or this teammate's own uploaded photo, or the mascot as the fallback.
    'avatar',case
      when pr.image ~ '^/assets/avatars/avatar-([1-9]|10)\.png$' then pr.image
      when pr.image ~ ('^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/avatars/'
                       || pr.id::text || '/[0-9a-f]{16}\.(webp|jpg)$') then pr.image
      else '/assets/avatars/avatar-1.png' end,
    'country',case when p.show_country then pr.country else null end,'languages',pr.languages,
    'bio',case when public.teammate_public_bio_valid(pr.bio) then pr.bio else '' end,
    'accent',p.accent,'banner',p.banner,'vibeTags',p.vibe_tags,'featuredGame',p.featured_game,'coaching',p.coaching,
    'online',exists(select 1 from public.teammate_presence t where t.user_id=p.user_id and t.online and t.last_seen_at>pg_catalog.now()-interval '20 seconds'),
    'memberSince',pg_catalog.to_char(pr.created_at at time zone 'UTC','YYYY-MM'), 'sessions',n,
    'tier',public.completion_trust(n)->>'trust_tier',
    'rating',case when rc>=5 then pg_catalog.jsonb_build_object('average',ra,'count',rc) else null end,
    'reviewTags',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('tag',t.tag,'count',t.n) order by t.n desc,t.tag)
      from (select tag,pg_catalog.count(*) n from public.order_reviews r cross join lateral pg_catalog.unnest(r.tags) tag
        where r.teammate_id=p.user_id group by tag) t),'[]'::jsonb),
    'winRate',case when games>=20 then pg_catalog.jsonb_build_object('percent',pg_catalog.round(100.0*wins/games),'games',games) else null end,
    'games',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('game',a.game,'rank',r.rank,'peakRank',r.peak_rank,
      'verified',r.verified_at is not null,'roles',coalesce(r.roles,'{}'),'picks',coalesce(r.picks,'{}')) order by a.game)
      from public.teammate_order_access x cross join lateral pg_catalog.unnest(x.approved_games) a(game)
      left join public.teammate_game_ranks r on r.user_id=x.user_id and r.game=a.game where x.user_id=p.user_id),'[]'::jsonb),
    'reviews',coalesce((select pg_catalog.jsonb_agg(t.item order by t.created_at desc,t.order_id) from
      (select r.created_at,r.order_id,pg_catalog.jsonb_build_object('rating',r.rating,
        'text',case when cutoff is not null and r.created_at>=cutoff then r.text else '' end,
        'game',o.game,'month',pg_catalog.to_char(r.created_at at time zone 'UTC','YYYY-MM')) item
       from public.order_reviews r join public.orders o on o.id=r.order_id where r.teammate_id=p.user_id order by r.created_at desc,r.order_id limit 6) t),'[]'::jsonb),
    'updatedAt',p.updated_at);
  return result;
end $$;

commit;
