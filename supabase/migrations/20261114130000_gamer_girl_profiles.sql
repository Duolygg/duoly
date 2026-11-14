-- Gamer Girls on public profiles and in the teammate directory.
--
-- A teammate's order access has two independent parts (20261102140000_gg_plus_comp.sql):
-- approved_games for competitive orders, and gg_access for Gamer Girl orders in every game plus
-- Social sessions. Public profiles only ever looked at approved_games, so a Gamer Girl's Social
-- never showed, nothing said she is a Gamer Girl, and a teammate with Gamer Girl access only could
-- not have a public page at all (her featured game had to be an approved one).
--
-- Owner decision 2026-11-14: Gamer Girls get public profiles by default, the same rule as every
-- other teammate (20261112130000_public_profiles_default_on.sql); each can switch hers off.
--
-- 1. teammate_public_games(user): approved_games, plus 'social' when gg_access is on. Social is
--    always last.
-- 2. teammate_public_approved(user, game) answers from that list, so 'social' is a valid featured
--    game, a valid settings game and a valid row in teammate_game_ranks for a Gamer Girl. Both
--    CHECK constraints that use it only widen: no existing row becomes invalid.
-- 3. public_teammate_profile(): the games list comes from teammate_public_games() (Social last,
--    the rest in their old order), and the profile says gamerGirl.
-- 4. public_teammate_cards(): every card says gamerGirl; filtering a game of 'social' now finds
--    Gamer Girls, because Social is in their games.
-- 5. teammate_public_profile_get(): settings list Social for a Gamer Girl, so she can feature it.
-- 6. The access trigger also fires on gg_access and counts Social, so turning Gamer Girl access on
--    gives a teammate without a page one, and turning it off moves a Social-featured page to her
--    first approved game or unpublishes it.
-- 7. Backfill: Gamer Girls who have no page yet get one now, exactly as the trigger would.
-- 8. Owner decision 2026-11-14: a Gamer Girl's page starts with the pink accent (everyone else
--    keeps lavender). Only when the page is created: an accent she picked is never changed.

begin;

-- ---- 1. the games a public profile may show ----------------------------------------------------
create function public.teammate_public_games(p_user uuid) returns text[]
language sql stable security definer set search_path = '' as $$
  select coalesce(a.approved_games, '{}'::text[])
    || case when a.gg_access then array['social']::text[] else '{}'::text[] end
  from public.teammate_order_access a where a.user_id = p_user;
$$;
revoke all on function public.teammate_public_games(uuid) from public, anon, authenticated, service_role;

-- ---- 2. approval: Social counts for a Gamer Girl -------------------------------------------------
create or replace function public.teammate_public_approved(p_user uuid, p_game text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.teammate_order_access a where a.user_id=p_user
    and (p_game=any(a.approved_games) or (p_game='social' and a.gg_access)));
$$;

-- ---- 3. the public profile ----------------------------------------------------------------------
/* From 20261112170000_profile_header.sql; changed: 'games' reads teammate_public_games() (Social
   last), and 'gamerGirl' is added. Everything else is the live definition. */
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
                       || pr.id::text || '/[0-9a-f]{16}\.(webp|jpg)$') then pr.image
      else '/assets/avatars/avatar-1.png' end,
    'header',p.header_image,
    'country',case when p.show_country then pr.country else null end,'languages',pr.languages,
    'bio',case when public.teammate_public_bio_valid(pr.bio) then pr.bio else '' end,
    'accent',p.accent,'banner',p.banner,'vibeTags',p.vibe_tags,'featuredGame',p.featured_game,'coaching',p.coaching,
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

-- ---- 4. directory cards -------------------------------------------------------------------------
/* From 20261114120000_directory_cards.sql; changed: 'gamerGirl' is added. */
create or replace function public.public_teammate_cards(p_game text default null, p_limit int default 6, p_exclude_slug text default null) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(pg_catalog.jsonb_agg(q.card order by q.online desc,q.sessions desc,q.slug),'[]'::jsonb) from (
    select p.slug, (d->>'online')::boolean online, (d->>'sessions')::bigint sessions,
      pg_catalog.jsonb_build_object('slug',d->'slug','name',d->'name','avatar',d->'avatar','accent',d->'accent',
        'tier',d->'tier','online',d->'online','game',g->'game','rank',case when (g->>'verified')::boolean then g->'rank' else 'null'::jsonb end,'rating',d->'rating',
        'games',coalesce((select pg_catalog.jsonb_agg(x->'game') from pg_catalog.jsonb_array_elements(coalesce(d->'games','[]')) x),'[]'::jsonb),
        'languages',coalesce(d->'languages','[]'::jsonb),
        'vibeTags',coalesce(d->'vibeTags','[]'::jsonb),
        'coaching',coalesce(d->'coaching','false'::jsonb),
        'gamerGirl',coalesce(d->'gamerGirl','false'::jsonb),
        'quote',coalesce((select r->'text' from pg_catalog.jsonb_array_elements(coalesce(d->'reviews','[]')) r
          where pg_catalog.length(pg_catalog.btrim(r->>'text')) > 0 limit 1),'null'::jsonb)) card
    from public.teammate_public_profiles p
    cross join lateral (select public.public_teammate_profile(p.slug) d) v
    cross join lateral (select e g from pg_catalog.jsonb_array_elements(coalesce(d->'games','[]')) e where e->>'game'=coalesce(p_game,d->>'featuredGame') limit 1) a
    where d ? 'slug' and not d ? 'status' and (p_exclude_slug is null or p.slug<>p_exclude_slug)
    order by online desc,sessions desc,p.slug limit greatest(1,least(coalesce(p_limit,6),100))
  ) q;
$$;

-- ---- 5. profile settings list Social for a Gamer Girl --------------------------------------------
/* From 20261112120000_public_teammate_profiles.sql; changed: the games come from
   teammate_public_games(), so a Gamer Girl can pick Social and give it roles. */
create or replace function public.teammate_public_profile_get() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare u uuid:=auth.uid(); p public.teammate_public_profiles; a text[];
begin
  if not public.teammate_public_active(u) then return public.order_error(403,'Teammate role required.'); end if;
  select * into p from public.teammate_public_profiles where user_id=u;
  a := coalesce(public.teammate_public_games(u),'{}'::text[]);
  return pg_catalog.jsonb_build_object('settings',pg_catalog.jsonb_build_object(
    'published',coalesce(p.published,false),'slug',coalesce(p.slug,''),
    'accent',coalesce(p.accent,case when 'social'=any(a) then 'pink' else 'lavender' end),'banner',coalesce(p.banner,'slash'),
    'featuredGame',coalesce(p.featured_game,a[1],''),'vibeTags',coalesce(p.vibe_tags,'{}'),'showCountry',coalesce(p.show_country,false),'coaching',coalesce(p.coaching,false),
    'games',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('game',g,'roles',coalesce(r.roles,'{}'),'picks',coalesce(r.picks,'{}')) order by g='social',g)
      from pg_catalog.unnest(a) g left join public.teammate_game_ranks r on r.user_id=u and r.game=g),'[]'::jsonb)),
    'approvedGames',a,'ranks',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('game',r.game,'rank',r.rank,'peakRank',r.peak_rank,'verified',r.verified_at is not null) order by r.game)
      from public.teammate_game_ranks r where r.user_id=u and r.game=any(a)),'[]'::jsonb),'hidden',coalesce(p.admin_hidden,false));
end $$;

-- ---- 6. the access trigger counts Social and fires on gg_access ---------------------------------
/* From 20261112130000_public_profiles_default_on.sql; changed: v_games includes Social when
   gg_access is on (always after the approved games, so a competitive game stays the default
   featured game). */
create or replace function public.teammate_public_profile_access_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
declare p public.teammate_public_profiles;
  v_games text[] := coalesce(new.approved_games, '{}'::text[])
    || case when new.gg_access then array['social']::text[] else '{}'::text[] end;
  v_slug text; v_featured text;
begin
  select * into p from public.teammate_public_profiles where user_id = new.user_id;
  if p.user_id is null then
    if pg_catalog.cardinality(v_games) = 0 or not public.teammate_public_active(new.user_id) then return new; end if;
    v_slug := public.teammate_public_slug_pick(new.user_id);
    if v_slug is null then return new; end if;
    insert into public.teammate_public_profiles(user_id, slug, published, published_at, featured_game, accent)
      values (new.user_id, v_slug, true, pg_catalog.clock_timestamp(), public.teammate_public_featured_pick(v_games),
        case when new.gg_access then 'pink' else 'lavender' end)
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
drop trigger teammate_public_profile_access_changed on public.teammate_order_access;
create trigger teammate_public_profile_access_changed
  after insert or update of approved_games, gg_access on public.teammate_order_access
  for each row execute function public.teammate_public_profile_access_changed();

-- ---- 7. backfill: Gamer Girls without a page get one ---------------------------------------------
insert into public.teammate_public_profiles(user_id, slug, published, published_at, featured_game, accent)
select a.user_id, s.slug, true, pg_catalog.clock_timestamp(),
  public.teammate_public_featured_pick(coalesce(a.approved_games, '{}'::text[]) || array['social']::text[]),
  'pink'
from public.teammate_order_access a
cross join lateral (select public.teammate_public_slug_pick(a.user_id) slug) s
where a.gg_access
  and s.slug is not null
  and public.teammate_public_active(a.user_id)
  and not exists(select 1 from public.teammate_public_profiles p where p.user_id = a.user_id)
on conflict (user_id) do nothing;

commit;
