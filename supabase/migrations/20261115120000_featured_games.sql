-- Several featured games on one public profile.
--
-- teammate_public_profiles.featured_game is a single text column, so a teammate approved for three
-- games had to pick one of them for the hero, the booking block, the title and the related row, and
-- the other two lived only in the games list further down. Production already has two profiles in
-- that state.
--
-- Owner decision 2026-11-15: a teammate features any number of the games they are approved for.
-- There is no artificial cap; the approved list is the natural limit.
--
-- 1. featured_games text[] holds the ordered list. featured_game stays and is always
--    featured_games[1], kept there by teammate_public_featured_sync(), so every reader written
--    against the single column and the published gate teammate_public_approved(user_id,
--    featured_game) keep working with no change at all.
-- 2. The write guard that replaced the old row check (20261112130000) now checks every element of
--    the list as well as the single field, and it runs before the sync trigger (trigger order is
--    the trigger name, and "guard" sorts before "sync"), so the sync never derives a featured game
--    out of a list nobody checked.
-- 3. The access trigger drops a game from featured_games the moment it loses approval. When
--    nothing is left it falls back exactly as it did before: the first game the teammate still
--    has, and an unpublish when there is none.
-- 4. teammate_public_profile_save() takes featuredGames (ordered) next to featuredGame. A client
--    that only knows the old field still saves: one value means a one element list.
-- 5. teammate_public_profile_get() and public_teammate_profile() return featuredGames and keep
--    featuredGame.
--
-- Apply notes: OWNER APPROVAL REQUIRED. Apply only through the normal reviewed migration path.
-- Never db push or apply to the hosted project during development. Test on disposable CI only.
-- No existing migration is edited: every function below is a create or replace of one they
-- installed, which keeps its grants and its security settings.
begin;

-- ---- 1. the column ------------------------------------------------------------------------------
alter table public.teammate_public_profiles add column featured_games text[] not null default '{}';

/* Backfill before the guard learns about the column: an unpublished page can be sitting on a game
   its teammate has since lost, and the list it gets has to be what the page already shows. */
update public.teammate_public_profiles set featured_games = array[featured_game]
  where featured_game is not null and pg_catalog.cardinality(featured_games) = 0;

/* Shape only, and immutable, because a row check is re-evaluated on every write: no duplicates,
   every element one of the safe short labels teammate_public_labels_valid() already defines, and
   no artificial length cap. Which games are allowed is approval, the guard's job below. */
create function public.teammate_public_featured_valid(p_games text[]) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(pg_catalog.array_ndims(p_games) <= 1
    and public.teammate_public_labels_valid(p_games, pg_catalog.cardinality(p_games))
    and not exists(select 1 from pg_catalog.unnest(p_games) x group by x having pg_catalog.count(*) > 1),
    pg_catalog.cardinality(p_games) = 0 or p_games is null);
$$;
alter table public.teammate_public_profiles
  add constraint teammate_public_featured_games_shape check (public.teammate_public_featured_valid(featured_games));

-- ---- 2. featured_game is featured_games[1], always ----------------------------------------------
/*
 * One source of truth with two shapes. A write that only sets featured_games gets its single
 * field derived; a write that only sets featured_game (an older client, or an administrator at a
 * psql prompt) is read as "lead with this one" and keeps the rest of the list behind it.
 *
 * featured_game is NOT NULL, so after this runs the list always holds at least one game. A page
 * whose teammate lost every approved game keeps its stale single game and its stale one element
 * list and is unpublished, which is what the access trigger already did with the single column.
 */
create function public.teammate_public_featured_sync() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.featured_game is distinct from old.featured_game
    and new.featured_games is not distinct from old.featured_games then
    new.featured_games := array[new.featured_game]
      || pg_catalog.array_remove(coalesce(old.featured_games, '{}'::text[]), new.featured_game);
  end if;
  if pg_catalog.cardinality(coalesce(new.featured_games, '{}'::text[])) = 0 then
    new.featured_games := case when new.featured_game is null then '{}'::text[] else array[new.featured_game] end;
  end if;
  new.featured_game := new.featured_games[1];
  return new;
end $$;
create trigger teammate_public_featured_sync before insert or update on public.teammate_public_profiles
  for each row execute function public.teammate_public_featured_sync();

-- ---- 3. the write guard covers the list too ------------------------------------------------------
/* From 20261112130000_public_profiles_default_on.sql; changed: every game in featured_games faces
   the same approval check as featured_game, and only when the list actually changed, so the write
   that unpublishes a teammate who lost everything is still allowed through. */
create or replace function public.teammate_public_featured_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (tg_op = 'INSERT' or new.featured_game is distinct from old.featured_game)
    and not public.teammate_public_approved(new.user_id, new.featured_game) then
    raise exception using errcode = '23514', message = 'Pick a game you are approved for.';
  end if;
  if (tg_op = 'INSERT' or new.featured_games is distinct from old.featured_games)
    and exists(select 1 from pg_catalog.unnest(coalesce(new.featured_games, '{}'::text[])) g
      where not public.teammate_public_approved(new.user_id, g)) then
    raise exception using errcode = '23514', message = 'Pick games you are approved for.';
  end if;
  return new;
end $$;

-- ---- 4. losing approval drops that game from the list -------------------------------------------
/* From 20261114130000_gamer_girl_profiles.sql; changed: the whole featured list is filtered down
   to the games the teammate still has, in the order they chose, and only an empty result falls
   back to teammate_public_featured_pick() and the unpublish it already did. */
create or replace function public.teammate_public_profile_access_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
declare p public.teammate_public_profiles;
  v_games text[] := coalesce(new.approved_games, '{}'::text[])
    || case when new.gg_access then array['social']::text[] else '{}'::text[] end;
  v_slug text; v_featured text; v_kept text[];
begin
  select * into p from public.teammate_public_profiles where user_id = new.user_id;
  if p.user_id is null then
    if pg_catalog.cardinality(v_games) = 0 or not public.teammate_public_active(new.user_id) then return new; end if;
    v_slug := public.teammate_public_slug_pick(new.user_id);
    if v_slug is null then return new; end if;
    v_featured := public.teammate_public_featured_pick(v_games);
    insert into public.teammate_public_profiles(user_id, slug, published, published_at, featured_game, featured_games, accent)
      values (new.user_id, v_slug, true, pg_catalog.clock_timestamp(), v_featured, array[v_featured],
        case when new.gg_access then 'pink' else 'lavender' end)
      on conflict (user_id) do nothing;
    return new;
  end if;
  select coalesce(pg_catalog.array_agg(g order by ord), '{}'::text[]) into v_kept
    from pg_catalog.unnest(coalesce(p.featured_games, array[p.featured_game])) with ordinality t(g, ord)
    where g = any(v_games);
  if v_kept is not distinct from p.featured_games then return new; end if;
  if pg_catalog.cardinality(v_kept) > 0 then
    update public.teammate_public_profiles set featured_games = v_kept, updated_at = pg_catalog.clock_timestamp()
      where user_id = new.user_id;
    return new;
  end if;
  v_featured := public.teammate_public_featured_pick(v_games);
  if v_featured is null then
    update public.teammate_public_profiles set published = false, updated_at = pg_catalog.clock_timestamp()
      where user_id = new.user_id;
  else
    update public.teammate_public_profiles set featured_game = v_featured, featured_games = array[v_featured],
      updated_at = pg_catalog.clock_timestamp() where user_id = new.user_id;
  end if;
  return new;
end $$;

-- ---- 5. saving the list -------------------------------------------------------------------------
/* From 20261112120000_public_teammate_profiles.sql; changed: the optional featuredGames key, its
   validation and dedupe, and the two columns it writes. Everything else is the live definition. */
create or replace function public.teammate_public_profile_save(p_settings jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid:=auth.uid(); p public.teammate_public_profiles; s jsonb:=p_settings; g jsonb; target text;
  tags text[]; roles_ text[]; picks_ text[]; keys int; featured_ text[];
begin
  if not public.teammate_public_active(u) then return public.order_error(403,'Teammate role required.'); end if;
  -- Serialize new profiles, slug claims, renames and retirements including across users.
  perform pg_catalog.pg_advisory_xact_lock(617420111212::bigint);
  perform 1 from public.teammate_order_access where user_id=u for share;
  select * into p from public.teammate_public_profiles where user_id=u for update;
  if s is null or pg_catalog.jsonb_typeof(s)<>'object' then return public.order_error(400,'Check your public profile settings.'); end if;
  select pg_catalog.count(*) into keys from pg_catalog.jsonb_object_keys(s);
  if keys < 9 or keys > 10
    or not s ?& array['published','slug','accent','banner','featuredGame','vibeTags','showCountry','coaching','games']
    or (keys = 10 and not s ? 'featuredGames')
    or pg_catalog.jsonb_typeof(s->'published')<>'boolean' or pg_catalog.jsonb_typeof(s->'showCountry')<>'boolean' or pg_catalog.jsonb_typeof(s->'coaching')<>'boolean'
    or pg_catalog.jsonb_typeof(s->'slug')<>'string' or not public.teammate_public_slug_valid(s->>'slug')
    or pg_catalog.jsonb_typeof(s->'vibeTags')<>'array' or pg_catalog.jsonb_array_length(s->'vibeTags')>3
    or pg_catalog.jsonb_typeof(s->'games')<>'array' or pg_catalog.jsonb_array_length(s->'games')>16
    or s->>'accent' is null or s->>'accent' not in ('violet','lavender','cyan','mint','pink','coral','gold','ice')
    or s->>'banner' is null or s->>'banner' not in ('grid','slash','pulse','orbit')
    or not public.teammate_public_approved(u,s->>'featuredGame') then
    return public.order_error(400,'Check your public profile settings.');
  end if;
  /* The ordered featured list. Absent means an older client: the single field is the whole list.
     Duplicates are dropped rather than refused, keeping the first place each game appears. */
  if s ? 'featuredGames' then
    if pg_catalog.jsonb_typeof(s->'featuredGames')<>'array'
      or pg_catalog.jsonb_array_length(s->'featuredGames') < 1
      or exists(select 1 from pg_catalog.jsonb_array_elements(s->'featuredGames') v where pg_catalog.jsonb_typeof(v)<>'string') then
      return public.order_error(400,'Feature at least one game you are approved for.');
    end if;
    select coalesce(pg_catalog.array_agg(d.v order by d.ord),'{}') into featured_ from (
      select t.v, pg_catalog.min(t.ord) ord from pg_catalog.jsonb_array_elements_text(s->'featuredGames') with ordinality t(v,ord) group by t.v) d;
    if exists(select 1 from pg_catalog.unnest(featured_) game where not public.teammate_public_approved(u,game)) then
      return public.order_error(400,'Feature at least one game you are approved for.');
    end if;
  else
    featured_ := array[s->>'featuredGame'];
  end if;
  if exists(select 1 from pg_catalog.jsonb_array_elements(s->'vibeTags') v where pg_catalog.jsonb_typeof(v)<>'string') then return public.order_error(400,'Invalid vibe tags.'); end if;
  select coalesce(pg_catalog.array_agg(v),'{}') into tags from pg_catalog.jsonb_array_elements_text(s->'vibeTags') v;
  if not tags <@ array['Chill','Shotcaller','Teaches as we play','Tryhard','Patient','Funny','Quiet focus','Night owl','Strategy nerd','Mechanics first']::text[] then return public.order_error(400,'Invalid vibe tags.'); end if;
  if (s->>'published')::boolean and exists(select 1 from public.profiles where id=u and not public.teammate_public_bio_valid(bio)) then
    return public.order_error(400,'Remove contact details and links from your bio before publishing.');
  end if;
  target:=s->>'slug';
  if exists(select 1 from public.teammate_public_profiles where slug=target and user_id<>u)
    or exists(select 1 from public.teammate_public_slug_history where slug=target and user_id is distinct from u and retired_at>pg_catalog.now()-interval '90 days') then
    return public.order_error(409,'That profile link is unavailable.');
  end if;
  -- Validate the whole games payload before changing any rows.
  if (select pg_catalog.count(*) from pg_catalog.jsonb_array_elements(s->'games'))<>(select pg_catalog.count(distinct v->>'game') from pg_catalog.jsonb_array_elements(s->'games') v) then return public.order_error(400,'Pick each game once.'); end if;
  for g in select value from pg_catalog.jsonb_array_elements(s->'games') loop
    if pg_catalog.jsonb_typeof(g)<>'object' or (select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(g))<>3 or not g ?& array['game','roles','picks']
      or pg_catalog.jsonb_typeof(g->'roles')<>'array' or pg_catalog.jsonb_typeof(g->'picks')<>'array' or not public.teammate_public_approved(u,g->>'game') then return public.order_error(400,'Invalid game settings.'); end if;
    if exists(select 1 from pg_catalog.jsonb_array_elements((g->'roles')||(g->'picks')) v where pg_catalog.jsonb_typeof(v)<>'string') then return public.order_error(400,'Invalid roles or picks.'); end if;
    select coalesce(pg_catalog.array_agg(v),'{}') into roles_ from pg_catalog.jsonb_array_elements_text(g->'roles') v;
    select coalesce(pg_catalog.array_agg(v),'{}') into picks_ from pg_catalog.jsonb_array_elements_text(g->'picks') v;
    if not public.teammate_public_labels_valid(roles_,3) or not public.teammate_public_labels_valid(picks_,5) then return public.order_error(400,'Invalid roles or picks.'); end if;
  end loop;
  if p.slug is not null and p.slug<>target then
    insert into public.teammate_public_slug_history(slug,user_id) values(p.slug,u)
      on conflict(slug) do update set user_id=excluded.user_id,retired_at=pg_catalog.clock_timestamp();
  end if;
  delete from public.teammate_public_slug_history where slug=target;
  insert into public.teammate_public_profiles(user_id,slug,published,published_at,accent,banner,featured_game,featured_games,vibe_tags,show_country,coaching)
    values(u,target,(s->>'published')::boolean,case when (s->>'published')::boolean then pg_catalog.clock_timestamp() end,s->>'accent',s->>'banner',featured_[1],featured_,tags,(s->>'showCountry')::boolean,(s->>'coaching')::boolean)
    on conflict(user_id) do update set slug=excluded.slug,published=excluded.published,
      published_at=case when excluded.published then coalesce(teammate_public_profiles.published_at,excluded.published_at) else teammate_public_profiles.published_at end,
      updated_at=pg_catalog.clock_timestamp(),accent=excluded.accent,banner=excluded.banner,featured_game=excluded.featured_game,featured_games=excluded.featured_games,vibe_tags=excluded.vibe_tags,show_country=excluded.show_country,coaching=excluded.coaching;
  for g in select value from pg_catalog.jsonb_array_elements(s->'games') loop
    select coalesce(pg_catalog.array_agg(v),'{}') into roles_ from pg_catalog.jsonb_array_elements_text(g->'roles') v;
    select coalesce(pg_catalog.array_agg(v),'{}') into picks_ from pg_catalog.jsonb_array_elements_text(g->'picks') v;
    insert into public.teammate_game_ranks(user_id,game,roles,picks) values(u,g->>'game',roles_,picks_)
      on conflict(user_id,game) do update set roles=excluded.roles,picks=excluded.picks;
  end loop;
  return public.teammate_public_profile_get();
exception when check_violation or invalid_text_representation or invalid_parameter_value then return public.order_error(400,'Check your public profile settings.');
  when unique_violation then return public.order_error(409,'That profile link is unavailable.');
end $$;

-- ---- 6. the settings read -----------------------------------------------------------------------
/* Body copied from 20261115090000_profile_header_service_grants.sql; only featuredGames added.
   A teammate who has never saved gets their first approved game as the one element list, which is
   the list the settings screen then shows as featured. */
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
    'featuredGame',coalesce(p.featured_game,a[1],''),
    'featuredGames',coalesce(nullif(p.featured_games,'{}'::text[]),pg_catalog.array_remove(array[coalesce(p.featured_game,a[1])],null)),
    'vibeTags',coalesce(p.vibe_tags,'{}'),'showCountry',coalesce(p.show_country,false),'coaching',coalesce(p.coaching,false),
    'games',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('game',g,'roles',coalesce(r.roles,'{}'),'picks',coalesce(r.picks,'{}')) order by g='social',g)
      from pg_catalog.unnest(a) g left join public.teammate_game_ranks r on r.user_id=u and r.game=g),'[]'::jsonb)),
    'approvedGames',a,'ranks',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('game',r.game,'rank',r.rank,'peakRank',r.peak_rank,'verified',r.verified_at is not null) order by r.game)
      from public.teammate_game_ranks r where r.user_id=u and r.game=any(a)),'[]'::jsonb),'hidden',coalesce(p.admin_hidden,false),
    'header',p.header_image);
end $$;

-- ---- 7. the public profile ----------------------------------------------------------------------
/* Body copied from 20261114130000_gamer_girl_profiles.sql; only featuredGames added. The published
   gate still reads featured_game, which is featured_games[1], so the rule is unchanged. */
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

-- ---- 8. grants ----------------------------------------------------------------------------------
-- No implicit PUBLIC execute on either new function, the same rule 20261112120000 set.
revoke all on function public.teammate_public_featured_valid(text[]) from public, anon, authenticated, service_role;
revoke all on function public.teammate_public_featured_sync() from public, anon, authenticated, service_role;
/*
 * The same lesson 20261115090000_profile_header_service_grants.sql learned about the slug check.
 * Every UPDATE re-checks the row's constraints as the caller, and the header endpoint
 * (src/server/teammates/profile-header.ts) updates header_image as the service role, so that role
 * has to be able to run the new row check and the label validator it reuses. Both are immutable
 * and read nothing; a profile header upload 503s without them.
 */
grant execute on function public.teammate_public_featured_valid(text[]) to service_role;
grant execute on function public.teammate_public_labels_valid(text[], int) to service_role;

commit;
