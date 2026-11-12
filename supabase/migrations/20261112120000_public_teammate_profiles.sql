-- Purpose: opt-in public teammate profiles, private settings and admin-verified game ranks.
-- Apply notes: OWNER APPROVAL REQUIRED. Apply only through the normal reviewed migration path.
-- Never db push or apply to the hosted project during development. Test on disposable CI only.
-- Keep PUBLIC_PROFILES_ENABLED off until privacy copy and the review notice are live.
-- public_profile_notice_at deliberately starts NULL: historic review text is never public.
begin;

create function public.teammate_public_slug_valid(p_slug text) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(pg_catalog.char_length(p_slug) between 3 and 24
    and p_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    and p_slug <> all(array['admin','api','duoly','support','help','teammates','teammate','login','signin','signup','settings','profile','staff','team','official','moderator','mod','null','undefined','new','edit']), false);
$$;

-- Union of game and service ladders in src/design-reference/lib/ranks.js. No invented divisions.
create function public.teammate_public_rank_valid(p_game text, p_rank text) returns boolean
language sql immutable set search_path = '' as $$
  select p_rank is null or case p_game
    when 'lol' then p_rank = any(array['Iron','Bronze','Silver','Gold','Platinum','Emerald','Diamond','Master','Grandmaster','Challenger','Wood','Gladiator']::text[])
    when 'tft' then p_rank = any(array['Iron','Bronze','Silver','Gold','Platinum','Emerald','Diamond','Master','Grandmaster','Challenger']::text[])
    when 'val' then p_rank = any(array['Iron','Bronze','Silver','Gold','Platinum','Diamond','Ascendant','Immortal','Radiant']::text[])
    when 'cs2' then p_rank = any(array['Premier 0–4,999','Premier 5,000–9,999','Premier 10,000–14,999','Premier 15,000–19,999','Premier 20,000–24,999','Premier 25,000+','Silver','Gold Nova','Master Guardian','Distinguished Master Guardian','Legendary Eagle','Legendary Eagle Master','Supreme','Global Elite','FACEIT Level 1','FACEIT Level 2','FACEIT Level 3','FACEIT Level 4','FACEIT Level 5','FACEIT Level 6','FACEIT Level 7','FACEIT Level 8','FACEIT Level 9','FACEIT Level 10']::text[])
    when 'fn' then p_rank = any(array['Bronze','Silver','Gold','Platinum','Diamond','Elite','Champion','Unreal']::text[])
    when 'cod' then p_rank = any(array['Bronze','Silver','Gold','Platinum','Diamond','Crimson','Iridescent','Top 250']::text[])
    when 'apex' then p_rank = any(array['Rookie','Bronze','Silver','Gold','Platinum','Diamond','Master','Apex Predator']::text[])
    when 'r6' then p_rank = any(array['Copper','Bronze','Silver','Gold','Platinum','Emerald','Diamond','Champion']::text[])
    when 'mr' then p_rank = any(array['Bronze','Silver','Gold','Platinum','Diamond','Grandmaster','Celestial','Eternity','One Above All']::text[])
    when 'ow' then p_rank = any(array['Bronze','Silver','Gold','Platinum','Diamond','Master','Grandmaster','Champion','Top 500']::text[])
    when 'rl' then p_rank = any(array['Bronze','Silver','Gold','Platinum','Diamond','Champion','Grand Champion','Supersonic Legend']::text[])
    when 'fc' then p_rank = any(array['Division 10','Division 8','Division 6','Division 4','Division 3','Division 2','Division 1','Elite']::text[])
    when 'pu' then p_rank = any(array['Beginner','Great','Expert','Veteran','Ultra','Master','Legend']::text[])
    when 'dota' then p_rank = any(array['Herald','Guardian','Crusader','Archon','Legend','Ancient','Divine','Immortal']::text[])
    when 'wr' then p_rank = any(array['Iron','Bronze','Silver','Gold','Platinum','Emerald','Diamond','Master','Grandmaster','Challenger','Sovereign']::text[])
    when 'pubg' then p_rank = any(array['Bronze','Silver','Gold','Platinum','Crystal','Diamond','Master']::text[])
    when 'dl' then p_rank = any(array['Initiate','Seeker','Alchemist','Arcanist','Ritualist','Emissary','Archon','Oracle','Phantom','Ascendant','Eternus']::text[])
    when 'wow' then p_rank = any(array['Mythic+ under 1,500','Mythic+ 1,500–1,999','Mythic+ 2,000–2,499','Mythic+ 2,500–2,999','Mythic+ 3,000–3,499','Mythic+ 3,500+','Arena under 1,400','Combatant 1,400+','Challenger 1,600+','Rival 1,800+','Duelist 2,100+','Elite 2,400+']::text[])
    else false end;
$$;

create function public.teammate_public_labels_valid(p_labels text[], p_max int) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(pg_catalog.cardinality(p_labels) <= p_max
    and pg_catalog.array_ndims(p_labels) <= 1
    and not exists(select 1 from pg_catalog.unnest(p_labels) x where x is null or pg_catalog.char_length(x) not between 1 and 24
      or x ~ '[[:cntrl:]]|[@:/\\.]'
      or x ~* '\m(pass(word|wort)?|paypal|venmo|cash ?app|iban|crypto|whatsapp|telegram|snapchat|discord)\M'), pg_catalog.cardinality(p_labels) = 0);
$$;

create function public.teammate_public_bio_valid(p_bio text) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(p_bio !~* '\m(pass(word|wort)?|login details|account details|paypal|venmo|cash ?app|iban|bank transfer|crypto|whatsapp|telegram|snapchat|pay (me|you) (directly|outside)|discord)\M'
    and p_bio !~* '(@|https?://|www\.|[[:alnum:]-]+\.[a-z]{2,}(/|\M))', true);
$$;

create table public.teammate_public_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  slug text not null unique check (public.teammate_public_slug_valid(slug)),
  published boolean not null default false,
  published_at timestamptz,
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  accent text not null default 'lavender' check (accent in ('violet','lavender','cyan','mint','pink','coral','gold','ice')),
  banner text not null default 'slash' check (banner in ('grid','slash','pulse','orbit')),
  featured_game text not null,
  vibe_tags text[] not null default '{}' check (pg_catalog.cardinality(vibe_tags) <= 3 and pg_catalog.array_position(vibe_tags,null) is null
    and vibe_tags <@ array['Chill','Shotcaller','Teaches as we play','Tryhard','Patient','Funny','Quiet focus','Night owl','Strategy nerd','Mechanics first']::text[]),
  show_country boolean not null default false,
  coaching boolean not null default false,
  admin_hidden boolean not null default false,
  admin_hidden_reason text not null default '' check (pg_catalog.char_length(admin_hidden_reason) <= 500)
);
create table public.teammate_public_slug_history (
  slug text primary key check (public.teammate_public_slug_valid(slug)),
  user_id uuid references public.profiles(id) on delete set null,
  retired_at timestamptz not null default pg_catalog.clock_timestamp()
);
create index teammate_public_slug_history_user on public.teammate_public_slug_history(user_id);
create table public.teammate_game_ranks (
  user_id uuid not null references public.profiles(id) on delete cascade,
  game text not null,
  rank text check (public.teammate_public_rank_valid(game, rank)),
  peak_rank text check (public.teammate_public_rank_valid(game, peak_rank)),
  roles text[] not null default '{}' check (public.teammate_public_labels_valid(roles,3)),
  picks text[] not null default '{}' check (public.teammate_public_labels_valid(picks,5)),
  verified_at timestamptz,
  verified_by uuid references public.profiles(id) on delete set null,
  primary key(user_id,game),
  check (verified_at is null or rank is not null)
);
create table public.teammate_public_profile_settings (
  singleton boolean primary key default true check (singleton),
  public_profile_notice_at timestamptz default null
);
insert into public.teammate_public_profile_settings(singleton) values(true);

alter table public.teammate_public_profiles enable row level security;
revoke all on table public.teammate_public_profiles from public, anon, authenticated, service_role;
alter table public.teammate_public_slug_history enable row level security;
revoke all on table public.teammate_public_slug_history from public, anon, authenticated, service_role;
alter table public.teammate_game_ranks enable row level security;
revoke all on table public.teammate_game_ranks from public, anon, authenticated, service_role;
alter table public.teammate_public_profile_settings enable row level security;
revoke all on table public.teammate_public_profile_settings from public, anon, authenticated, service_role;

-- Cross-table checks are enforced on writes too, never only in the HTTP handler.
create function public.teammate_public_approved(p_user uuid, p_game text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.teammate_order_access a where a.user_id=p_user and p_game=any(a.approved_games));
$$;
alter table public.teammate_public_profiles add constraint teammate_public_featured_approved check (public.teammate_public_approved(user_id,featured_game));
alter table public.teammate_game_ranks add constraint teammate_public_rank_approved check (public.teammate_public_approved(user_id,game));

create function public.teammate_public_active(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.account_roles r join public.teammate_order_access a on a.user_id=r.user_id
    join auth.users u on u.id=r.user_id join public.profiles pr on pr.id=r.user_id
    where r.user_id=p_user and r.role='teammate' and not a.suspended
      and (u.banned_until is null or u.banned_until <= pg_catalog.now()) and u.deleted_at is null);
$$;

create function public.public_teammate_profile(p_slug text) returns jsonb
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
    'avatar',case when pr.image ~ '^/assets/avatars/avatar-([1-9]|10)\.png$' then pr.image else '/assets/avatars/avatar-1.png' end,
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

create function public.public_teammate_cards(p_game text default null, p_limit int default 6, p_exclude_slug text default null) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(pg_catalog.jsonb_agg(q.card order by q.online desc,q.sessions desc,q.slug),'[]'::jsonb) from (
    select p.slug, (d->>'online')::boolean online, (d->>'sessions')::bigint sessions,
      pg_catalog.jsonb_build_object('slug',d->'slug','name',d->'name','avatar',d->'avatar','accent',d->'accent',
        'tier',d->'tier','online',d->'online','game',g->'game','rank',case when (g->>'verified')::boolean then g->'rank' else 'null'::jsonb end,'rating',d->'rating') card
    from public.teammate_public_profiles p
    cross join lateral (select public.public_teammate_profile(p.slug) d) v
    cross join lateral (select e g from pg_catalog.jsonb_array_elements(coalesce(d->'games','[]')) e where e->>'game'=coalesce(p_game,d->>'featuredGame') limit 1) a
    where d ? 'slug' and not d ? 'status' and (p_exclude_slug is null or p.slug<>p_exclude_slug)
    order by online desc,sessions desc,p.slug limit greatest(1,least(coalesce(p_limit,6),100))
  ) q;
$$;
create function public.public_teammate_indexable() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('slug',p.slug,'updatedAt',p.updated_at) order by p.slug),'[]'::jsonb)
  from public.teammate_public_profiles p join public.profiles pr on pr.id=p.user_id
  where p.published and not p.admin_hidden and public.teammate_public_active(p.user_id) and public.teammate_public_approved(p.user_id,p.featured_game)
    and exists(select 1 from public.teammate_game_ranks r where r.user_id=p.user_id and r.verified_at is not null and r.rank is not null and public.teammate_public_approved(r.user_id,r.game))
    and ((public.teammate_public_bio_valid(pr.bio) and pg_catalog.char_length(pg_catalog.btrim(pr.bio))>=60) or public.payout_valid_count(p.user_id)>=5);
$$;

create function public.teammate_public_profile_get() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare u uuid:=auth.uid(); p public.teammate_public_profiles; a text[];
begin
  if not public.teammate_public_active(u) then return public.order_error(403,'Teammate role required.'); end if;
  select * into p from public.teammate_public_profiles where user_id=u;
  select approved_games into a from public.teammate_order_access where user_id=u;
  return pg_catalog.jsonb_build_object('settings',pg_catalog.jsonb_build_object(
    'published',coalesce(p.published,false),'slug',coalesce(p.slug,''),'accent',coalesce(p.accent,'lavender'),'banner',coalesce(p.banner,'slash'),
    'featuredGame',coalesce(p.featured_game,a[1],''),'vibeTags',coalesce(p.vibe_tags,'{}'),'showCountry',coalesce(p.show_country,false),'coaching',coalesce(p.coaching,false),
    'games',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('game',g,'roles',coalesce(r.roles,'{}'),'picks',coalesce(r.picks,'{}')) order by g)
      from pg_catalog.unnest(a) g left join public.teammate_game_ranks r on r.user_id=u and r.game=g),'[]'::jsonb)),
    'approvedGames',a,'ranks',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('game',r.game,'rank',r.rank,'peakRank',r.peak_rank,'verified',r.verified_at is not null) order by r.game)
      from public.teammate_game_ranks r where r.user_id=u and r.game=any(a)),'[]'::jsonb),'hidden',coalesce(p.admin_hidden,false));
end $$;

create function public.teammate_public_slug_available(p_slug text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare u uuid:=auth.uid();
begin
  if not public.teammate_public_active(u) then return public.order_error(403,'Teammate role required.'); end if;
  return pg_catalog.jsonb_build_object('available',public.teammate_public_slug_valid(p_slug)
    and not exists(select 1 from public.teammate_public_profiles where slug=p_slug and user_id<>u)
    and not exists(select 1 from public.teammate_public_slug_history where slug=p_slug and user_id is distinct from u and retired_at>pg_catalog.now()-interval '90 days'));
end $$;

create function public.teammate_public_profile_save(p_settings jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid:=auth.uid(); p public.teammate_public_profiles; s jsonb:=p_settings; g jsonb; target text;
  tags text[]; roles_ text[]; picks_ text[];
begin
  if not public.teammate_public_active(u) then return public.order_error(403,'Teammate role required.'); end if;
  -- Serialize new profiles, slug claims, renames and retirements including across users.
  perform pg_catalog.pg_advisory_xact_lock(617420111212::bigint);
  perform 1 from public.teammate_order_access where user_id=u for share;
  select * into p from public.teammate_public_profiles where user_id=u for update;
  if s is null or pg_catalog.jsonb_typeof(s)<>'object'
    or (select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(s))<>9
    or not s ?& array['published','slug','accent','banner','featuredGame','vibeTags','showCountry','coaching','games']
    or pg_catalog.jsonb_typeof(s->'published')<>'boolean' or pg_catalog.jsonb_typeof(s->'showCountry')<>'boolean' or pg_catalog.jsonb_typeof(s->'coaching')<>'boolean'
    or pg_catalog.jsonb_typeof(s->'slug')<>'string' or not public.teammate_public_slug_valid(s->>'slug')
    or pg_catalog.jsonb_typeof(s->'vibeTags')<>'array' or pg_catalog.jsonb_array_length(s->'vibeTags')>3
    or pg_catalog.jsonb_typeof(s->'games')<>'array' or pg_catalog.jsonb_array_length(s->'games')>16
    or s->>'accent' is null or s->>'accent' not in ('violet','lavender','cyan','mint','pink','coral','gold','ice')
    or s->>'banner' is null or s->>'banner' not in ('grid','slash','pulse','orbit')
    or not public.teammate_public_approved(u,s->>'featuredGame') then
    return public.order_error(400,'Check your public profile settings.');
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
  insert into public.teammate_public_profiles(user_id,slug,published,published_at,accent,banner,featured_game,vibe_tags,show_country,coaching)
    values(u,target,(s->>'published')::boolean,case when (s->>'published')::boolean then pg_catalog.clock_timestamp() end,s->>'accent',s->>'banner',s->>'featuredGame',tags,(s->>'showCountry')::boolean,(s->>'coaching')::boolean)
    on conflict(user_id) do update set slug=excluded.slug,published=excluded.published,
      published_at=case when excluded.published then coalesce(teammate_public_profiles.published_at,excluded.published_at) else teammate_public_profiles.published_at end,
      updated_at=pg_catalog.clock_timestamp(),accent=excluded.accent,banner=excluded.banner,featured_game=excluded.featured_game,vibe_tags=excluded.vibe_tags,show_country=excluded.show_country,coaching=excluded.coaching;
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

create function public.admin_set_game_rank(p_user_id uuid, p_game text, p_rank text, p_peak_rank text default null, p_verified boolean default true) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid; actor_name text;
begin
  select id,name into actor,actor_name from public.admin_caller_for('teammates');
  if actor is null then return public.order_error(403,'Admins only.'); end if;
  perform 1 from public.teammate_order_access where user_id=p_user_id for share;
  if not public.teammate_public_approved(p_user_id,p_game) or not exists(select 1 from public.account_roles where user_id=p_user_id and role='teammate') then return public.order_error(400,'Pick an approved game.'); end if;
  if p_verified is null or (p_verified and p_rank is null) or not public.teammate_public_rank_valid(p_game,p_rank) or not public.teammate_public_rank_valid(p_game,p_peak_rank) then return public.order_error(400,'Pick a rank from this game.'); end if;
  insert into public.teammate_game_ranks(user_id,game,rank,peak_rank,verified_at,verified_by)
    values(p_user_id,p_game,p_rank,p_peak_rank,case when p_verified then pg_catalog.clock_timestamp() end,case when p_verified then actor end)
    on conflict(user_id,game) do update set rank=excluded.rank,peak_rank=excluded.peak_rank,verified_at=excluded.verified_at,verified_by=excluded.verified_by;
  update public.teammate_public_profiles set updated_at=pg_catalog.clock_timestamp() where user_id=p_user_id;
  perform public.admin_log(actor,actor_name,'Updated public game rank',p_user_id::text,p_game||': '||coalesce(p_rank,'Unranked'));
  return pg_catalog.jsonb_build_object('ok',true);
end $$;
create function public.admin_hide_public_profile(p_slug text,p_hidden boolean,p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid; actor_name text;
begin
  select id,name into actor,actor_name from public.admin_caller_for('teammates');
  if actor is null then return public.order_error(403,'Admins only.'); end if;
  if p_hidden is null or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_reason,''))) not between 1 and 500 then return public.order_error(400,'Give a reason.'); end if;
  update public.teammate_public_profiles set admin_hidden=p_hidden,admin_hidden_reason=pg_catalog.btrim(p_reason),updated_at=pg_catalog.clock_timestamp() where slug=p_slug;
  if not found then return public.order_error(404,'Profile not found.'); end if;
  perform public.admin_log(actor,actor_name,case when p_hidden then 'Hid public profile' else 'Restored public profile' end,p_slug,p_reason);
  return pg_catalog.jsonb_build_object('ok',true);
end $$;

-- Read for the existing admin teammate detail without broadening the roster DTO.
create function public.admin_public_profile_get(p_user_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.admin_caller_for('teammates')) then return public.order_error(403,'Admins only.'); end if;
  return pg_catalog.jsonb_build_object('slug',(select slug from public.teammate_public_profiles where user_id=p_user_id),
    'hidden',coalesce((select admin_hidden from public.teammate_public_profiles where user_id=p_user_id),false),
    'reason',coalesce((select admin_hidden_reason from public.teammate_public_profiles where user_id=p_user_id),''),
    'approvedGames',coalesce((select approved_games from public.teammate_order_access where user_id=p_user_id),'{}'),
    'ranks',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('game',game,'rank',rank,'peakRank',peak_rank,'verified',verified_at is not null)) from public.teammate_game_ranks where user_id=p_user_id),'[]'::jsonb));
end $$;

-- Deletions retain a tombstone, not an identifier, so the last public URL answers 410.
create function public.teammate_public_account_deleted() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.teammate_public_slug_history(slug,user_id)
    select slug,null from public.teammate_public_profiles where user_id=old.id
    on conflict(slug) do update set user_id=null,retired_at=pg_catalog.clock_timestamp();
  return old;
end $$;
create trigger teammate_public_account_deleted before delete on public.profiles for each row execute function public.teammate_public_account_deleted();
create function public.teammate_public_profile_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists(select 1 from public.teammate_public_profiles where user_id=new.id and published) and not public.teammate_public_bio_valid(new.bio) then
    raise exception using errcode='23514',message='Remove contact details and links from your public bio.';
  end if;
  update public.teammate_public_profiles set updated_at=pg_catalog.clock_timestamp() where user_id=new.id;
  return new;
end $$;
create trigger teammate_public_profile_changed after update of name,image,bio,languages,country on public.profiles for each row execute function public.teammate_public_profile_changed();

-- No implicit PUBLIC execute on helpers, triggers or RPCs.
DO $acl$
declare f regprocedure;
begin
  for f in select p.oid::regprocedure from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('teammate_public_slug_valid','teammate_public_rank_valid','teammate_public_labels_valid','teammate_public_bio_valid','teammate_public_approved','teammate_public_active','public_teammate_profile','public_teammate_cards','public_teammate_indexable','teammate_public_profile_get','teammate_public_slug_available','teammate_public_profile_save','admin_set_game_rank','admin_hide_public_profile','admin_public_profile_get','teammate_public_account_deleted','teammate_public_profile_changed')
  loop execute pg_catalog.format('revoke all on function %s from public, anon, authenticated, service_role',f); end loop;
end $acl$;
grant execute on function public.public_teammate_profile(text),public.public_teammate_cards(text,int,text),public.public_teammate_indexable() to anon,authenticated;
grant execute on function public.teammate_public_slug_available(text),public.teammate_public_profile_get(),public.teammate_public_profile_save(jsonb),public.admin_set_game_rank(uuid,text,text,text,boolean),public.admin_hide_public_profile(text,boolean,text),public.admin_public_profile_get(uuid) to authenticated;
commit;
