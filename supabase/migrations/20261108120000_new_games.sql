-- Five new games (2026-11-08): Dota 2 (dota), World of Warcraft (wow), PUBG: Battlegrounds (pubg),
-- Wild Rift (wr) and Deadlock (dl). Services, ranks and prices live in src/design-reference/lib
-- (catalog.js, ranks.js); this migration only lets the database accept and list the new game ids.
--
-- Canonical game order (demand order, src/design-reference/lib/games.js), now 20 games plus Social:
-- lol, val, cs2, fn, cod, apex, r6, mr, ow, dota, rl, wow, pubg, tft, fc, arc, wr, mc, dl, pu, social
--
-- Every function below is the live definition with only its game list (or service list) extended.
-- Additive: no existing order, access row or setting changes.
begin;

-- Game checks
alter table public.orders drop constraint orders_game_check;
alter table public.orders add constraint orders_game_check
  check (game in ('lol','val','cs2','fn','cod','apex','r6','mr','ow','dota','rl','wow','pubg','tft','fc','arc','wr','mc','dl','pu','social'));

alter table public.checkout_intents drop constraint checkout_intents_game_check;
alter table public.checkout_intents add constraint checkout_intents_game_check
  check (game in ('lol','val','cs2','fn','cod','apex','r6','mr','ow','dota','rl','wow','pubg','tft','fc','arc','wr','mc','dl','pu','social'));

alter table public.teammate_applications drop constraint teammate_applications_game_check;
alter table public.teammate_applications add constraint teammate_applications_game_check
  check (game in ('lol','val','cs2','fn','cod','apex','r6','mr','ow','dota','rl','wow','pubg','tft','fc','arc','wr','mc','dl','pu'));

alter table public.teammate_order_access drop constraint teammate_order_access_approved_games_check;
alter table public.teammate_order_access add constraint teammate_order_access_approved_games_check
  check (pg_catalog.cardinality(approved_games) <= 20
    and approved_games <@ array['lol','val','cs2','fn','cod','apex','r6','mr','ow','dota','rl','wow','pubg','tft','fc','arc','wr','mc','dl','pu']::text[]
    and pg_catalog.array_position(approved_games, null::text) is null);

alter table public.teammate_order_access drop constraint teammate_order_access_enabled_games_check;
alter table public.teammate_order_access add constraint teammate_order_access_enabled_games_check
  check (pg_catalog.cardinality(enabled_games) <= 21
    and enabled_games <@ array['lol','val','cs2','fn','cod','apex','r6','mr','ow','dota','rl','wow','pubg','tft','fc','arc','wr','mc','dl','pu','social']::text[]
    and pg_catalog.array_position(enabled_games, null::text) is null);

alter table public.teammate_order_access drop constraint teammate_order_access_stream_games_check;
alter table public.teammate_order_access add constraint teammate_order_access_stream_games_check
  check (stream_games <@ array['lol','val','cs2','fn','cod','apex','r6','mr','ow','dota','rl','wow','pubg','tft','fc','arc','wr','mc','dl','pu']::text[]
    and pg_catalog.array_position(stream_games, null::text) is null);

alter table public.teammate_order_access alter column enabled_games
  set default array['lol','val','cs2','fn','cod','apex','r6','mr','ow','dota','rl','wow','pubg','tft','fc','arc','wr','mc','dl','pu','social']::text[];

-- Admin → Users: game access in canonical order, unknown ids dropped (lib/access.js).
create or replace function public.admin_set_access(p_user_id uuid, p_games text[], p_gg boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid; v_name text; v_role text; v_games text[]; v_label text;
begin
  select id, name into v_actor, v_name from public.admin_caller_for('users');
  if v_actor is null then return public.order_error(403, 'Admins only.'); end if;
  select role into v_role from public.account_roles where user_id = p_user_id for update;
  if v_role is null then return public.order_error(404, 'Account not found.'); end if;
  if v_role <> 'teammate' then return public.order_error(409, 'Only teammates get order access. Make them a teammate first.'); end if;
  -- Canonical order, unknown ids dropped (lib/access.js).
  select coalesce(pg_catalog.array_agg(g order by i), '{}') into v_games
    from pg_catalog.unnest(array['lol','val','cs2','fn','cod','apex','r6','mr','ow','dota','rl','wow','pubg','tft','fc','arc','wr','mc','dl','pu']::text[]) with ordinality as t(g, i)
   where g = any(coalesce(p_games, '{}'));
  insert into public.teammate_order_access(user_id, approved_games, gg_access) values (p_user_id, v_games, coalesce(p_gg, false))
    on conflict (user_id) do update set approved_games = excluded.approved_games, gg_access = excluded.gg_access;
  select coalesce(nullif(p.name, 'Player'), u.email, '') into v_label
    from auth.users as u left join public.profiles as p on p.id = u.id where u.id = p_user_id;
  perform public.admin_log(v_actor, v_name, 'Changed order access', v_label,
    case when coalesce(p_gg, false) and pg_catalog.cardinality(v_games) > 0
           then 'Gamer Girl (all games) + comp: ' || pg_catalog.array_to_string(v_games, ', ')
         when coalesce(p_gg, false) then 'Gamer Girl (Gamer Girl orders, all games)'
         when pg_catalog.cardinality(v_games) = 0 then 'no games'
         else pg_catalog.array_to_string(v_games, ', ') end);
  return pg_catalog.jsonb_build_object('access', pg_catalog.jsonb_build_object('games', pg_catalog.to_jsonb(v_games), 'gg', coalesce(p_gg, false)));
end;
$$;

create or replace function public.admin_set_stream_access(p_user_id uuid, p_games text[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid; v_name text; a public.teammate_order_access; v_games text[]; v_before text[];
begin
  select id, name into v_actor, v_name from public.admin_caller_for('users');
  if v_actor is null then return public.order_error(403, 'Admins only.'); end if;
  if not exists (select 1 from public.account_roles where user_id = p_user_id and role = 'teammate') then
    return public.order_error(409, 'Only teammates can stream.');
  end if;
  select * into a from public.teammate_order_access where user_id = p_user_id for update;
  if a.user_id is null then return public.order_error(409, 'Give them game access first.'); end if;
  v_before := public.streamer_games(a);
  select coalesce(pg_catalog.array_agg(x.g order by x.i), '{}'::text[]) into v_games
    from pg_catalog.unnest(array['lol','val','cs2','fn','cod','apex','r6','mr','ow','dota','rl','wow','pubg','tft','fc','arc','wr','mc','dl','pu']::text[])
      with ordinality as x(g, i)
   where x.g = any(coalesce(p_games, '{}'::text[])) and x.g = any(a.approved_games);
  update public.teammate_order_access set stream_games = v_games where user_id = p_user_id;
  if pg_catalog.cardinality(v_games) = 0 then
    update public.streamer_settings set stream_online = false, online_since = null, updated_at = pg_catalog.clock_timestamp()
     where user_id = p_user_id and stream_online;
  end if;
  if v_games is distinct from v_before then
    perform public.admin_log(v_actor, v_name, 'Streaming access',
      (select email from auth.users where id = p_user_id),
      case when pg_catalog.cardinality(v_games) = 0 then 'None' else pg_catalog.array_to_string(v_games, ', ') end);
  end if;
  -- same shape as admin_set_access: { access: { stream } }
  return pg_catalog.jsonb_build_object('access', pg_catalog.jsonb_build_object('stream', pg_catalog.to_jsonb(v_games)));
end $$;

create or replace function public.streamer_games(p_access public.teammate_order_access)
returns text[] language sql immutable set search_path = '' as $$
  select coalesce(pg_catalog.array_agg(x.g order by x.i), '{}'::text[])
    from pg_catalog.unnest(array['lol','val','cs2','fn','cod','apex','r6','mr','ow','dota','rl','wow','pubg','tft','fc','arc','wr','mc','dl','pu']::text[])
      with ordinality as x(g, i)
   where x.g = any(p_access.stream_games) and x.g = any(p_access.approved_games);
$$;

-- Teammate queue settings
create or replace function public.set_teammate_queue_settings(p_enabled_games text[], p_voice_opt_in boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_access public.teammate_order_access; v_allowed text[];
begin
  if v_actor is null then return public.order_error(401,'Authentication required.'); end if;
  perform 1 from public.account_roles where user_id=v_actor and role='teammate' for update;
  if not found then return public.order_error(403,'Teammates only.'); end if;
  select a.* into v_access from public.teammate_order_access a where a.user_id=v_actor for update;
  if v_access.user_id is null then return public.order_error(403,'Teammate access required.'); end if;
  v_allowed := case when v_access.gg_access then
    array['lol','val','cs2','fn','cod','apex','r6','mr','ow','dota','rl','wow','pubg','tft','fc','arc','wr','mc','dl','pu','social']::text[]
    else v_access.approved_games end;
  if p_enabled_games is null or p_voice_opt_in is null
    or pg_catalog.cardinality(p_enabled_games)>21
    or pg_catalog.array_position(p_enabled_games,null) is not null
    or not p_enabled_games <@ v_allowed
    or (select pg_catalog.count(*) from pg_catalog.unnest(p_enabled_games) g) <> (select pg_catalog.count(distinct g) from pg_catalog.unnest(p_enabled_games) g)
  then return public.order_error(400,'Choose only games approved for your account.'); end if;
  update public.teammate_order_access set enabled_games=p_enabled_games,voice_opt_in=p_voice_opt_in where user_id=v_actor;
  return public.teammate_queue_settings();
end;
$$;

create or replace function public.teammate_queue_settings()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_access public.teammate_order_access; v_allowed text[]; v_enabled text[];
begin
  if v_actor is null then return public.order_error(401,'Authentication required.'); end if;
  select a.* into v_access from public.account_roles r
    join public.teammate_order_access a on a.user_id=r.user_id
    where r.user_id=v_actor and r.role='teammate';
  if v_access.user_id is null then return public.order_error(403,'Teammates only.'); end if;
  v_allowed := case when v_access.gg_access then
    array['lol','val','cs2','fn','cod','apex','r6','mr','ow','dota','rl','wow','pubg','tft','fc','arc','wr','mc','dl','pu','social']::text[]
    else v_access.approved_games end;
  select coalesce(pg_catalog.array_agg(g order by n),'{}'::text[]) into v_enabled
    from pg_catalog.unnest(array['lol','val','cs2','fn','cod','apex','r6','mr','ow','dota','rl','wow','pubg','tft','fc','arc','wr','mc','dl','pu','social']::text[]) with ordinality x(g,n)
    where g=any(v_allowed) and g=any(v_access.enabled_games);
  return pg_catalog.jsonb_build_object('allowed_games',v_allowed,'enabled_games',v_enabled,'gg_access',v_access.gg_access,'voice_opt_in',v_access.voice_opt_in,
    'approved_games',v_access.approved_games);
end;
$$;

-- Homepage figures
create or replace function public.home_public_stats()
returns jsonb language sql stable security definer set search_path = '' as $$
  with games(g) as (
    select pg_catalog.unnest(array['lol','val','cs2','fn','cod','apex','r6','mr','ow','dota','rl','wow','pubg','tft','fc','arc','wr','mc','dl','pu','social']::text[])
  ),
  people as (
    select r.user_id, pg_catalog.lower(coalesce(pr.country, '')) as country,
      (select o.game from public.orders o
        where o.assigned_teammate_id = r.user_id and o.status = 'in_progress' limit 1) as busy_game,
      (not coalesce(a.suspended, false) and coalesce(p.online, false)
        and p.last_seen_at > pg_catalog.clock_timestamp() - interval '20 seconds') as available,
      case when coalesce(a.gg_access, false) then (select pg_catalog.array_agg(g) from games)
        else coalesce(a.approved_games, '{}'::text[]) end as allowed,
      coalesce(a.enabled_games, '{}'::text[]) as enabled
    from public.account_roles r
    left join public.teammate_order_access a on a.user_id = r.user_id
    left join public.teammate_presence p on p.user_id = r.user_id
    left join public.profiles pr on pr.id = r.user_id
    where r.role = 'teammate'
  ),
  live as (select * from people where busy_game is not null or available),
  per_game as (
    select games.g, (select pg_catalog.count(*) from live
      where live.busy_game = games.g
         or (live.busy_game is null and games.g = any(live.allowed) and games.g = any(live.enabled)))::integer as n
    from games
  ),
  recent as (
    select pg_catalog.date_part('epoch', o.accepted_at - o.queued_at) as s
    from public.orders o
    where o.accepted_at is not null and o.queued_at is not null
      and o.accepted_at > pg_catalog.clock_timestamp() - interval '30 days'
  )
  select pg_catalog.jsonb_build_object(
    'online', (select pg_catalog.count(*)::integer from live),
    'onlineByGame', (select pg_catalog.jsonb_object_agg(g, n) from per_game),
    'onlineByRegion', pg_catalog.jsonb_build_object(
      'eu', (select pg_catalog.count(*)::integer from live where country = any(array['ad','al','at','ax','ba','be','bg','by','ch','cy','cz','de','dk','ee','es','fi','fo','fr','gb','gg','gi','gr','hr','hu','ie','im','is','it','je','li','lt','lu','lv','mc','md','me','mk','mt','nl','no','pl','pt','ro','rs','ru','se','si','sk','sm','ua','va','xk','ic']::text[])),
      'na', (select pg_catalog.count(*)::integer from live where country = any(array['ag','ai','aw','bb','bl','bm','bq','bs','bz','ca','cr','cu','cw','dm','do','gd','gl','gp','gt','hn','ht','jm','kn','ky','lc','mf','mq','ms','mx','ni','pa','pm','pr','sv','sx','tc','tt','um','us','vc','vg','vi']::text[])),
      'ao', (select pg_catalog.count(*)::integer from live where country = any(array['af','am','as','au','az','bd','bn','bt','cc','ck','cn','cx','fj','fm','ge','gu','hk','id','in','io','jp','kg','kh','ki','kp','kr','kz','la','lk','mh','mm','mn','mo','mp','mv','my','nc','nf','np','nr','nu','nz','pf','pg','ph','pk','pn','pw','sb','sg','th','tj','tk','tl','tm','to','tv','tw','uz','vn','vu','wf','ws']::text[])),
      'sa', (select pg_catalog.count(*)::integer from live where country = any(array['ar','bo','br','cl','co','ec','fk','gf','gy','pe','py','sr','uy','ve']::text[]))),
    'sessions', (select pg_catalog.count(*)::integer from public.orders where status = 'completed'),
    'reviews', (select pg_catalog.count(*)::integer from public.order_reviews),
    'rating', (select pg_catalog.round(pg_catalog.avg(rating)::numeric, 1) from public.order_reviews),
    'matchSeconds', (select case when pg_catalog.count(*) >= 3
        then greatest(0, pg_catalog.floor(pg_catalog.percentile_cont(0.5) within group (order by s)))::integer end
      from recent)
  );
$$;

create or replace function public.home_teammates()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(pg_catalog.jsonb_agg(q.item order by q.online desc, q.sessions desc, q.id), '[]'::jsonb)
  from (
    select t.id, t.online, t.sessions, pg_catalog.jsonb_build_object(
      'name', t.first,
      'image', t.image,
      'games', pg_catalog.to_jsonb(t.games),
      'gg', t.gg,
      'online', t.online,
      'rating', t.rating,
      'reviews', t.reviews,
      'sessions', t.sessions) as item
    from (
      select r.user_id as id,
        (select case
            when n.first = '' or n.first ~ '[@/:]' or pg_catalog.lower(n.first) = 'player' then null
            else pg_catalog.left(n.first, 16) end
          from (select pg_catalog.split_part(pg_catalog.btrim(pg_catalog.regexp_replace(
            pr.name, '[[:cntrl:][:space:]]+', ' ', 'g')), ' ', 1) as first) as n) as first,
        pr.image,
        a.gg_access as gg,
        (select coalesce(pg_catalog.array_agg(z.g order by z.i), '{}'::text[]) from (
            select x.g, x.i
            from pg_catalog.unnest(array['lol','val','cs2','fn','cod','apex','r6','mr','ow','dota','rl','wow','pubg','tft','fc','arc','wr','mc','dl','pu','social']::text[])
              with ordinality as x(g, i)
            where x.g = any(a.enabled_games) and (a.gg_access or x.g = any(a.approved_games))
            order by x.i
            limit 3) as z) as games,
        (coalesce(p.online, false)
          and p.last_seen_at > pg_catalog.clock_timestamp() - interval '20 seconds') as online,
        (select pg_catalog.count(*)::integer from public.orders as o
          where o.assigned_teammate_id = r.user_id and o.status = 'completed') as sessions,
        (select pg_catalog.count(*)::integer from public.order_reviews as v
          where v.teammate_id = r.user_id) as reviews,
        (select pg_catalog.round(pg_catalog.avg(v.rating)::numeric, 1) from public.order_reviews as v
          where v.teammate_id = r.user_id) as rating
      from public.account_roles as r
      join public.teammate_order_access as a on a.user_id = r.user_id
      join public.profiles as pr on pr.id = r.user_id
      left join public.teammate_presence as p on p.user_id = r.user_id
      where r.role = 'teammate'
        and not coalesce(a.suspended, false)
        and (a.gg_access or pg_catalog.cardinality(a.approved_games) > 0)
    ) as t
    where t.first is not null
    order by t.online desc, t.sessions desc, t.id
    limit 24
  ) as q;
$$;

-- Win/loss reports: the per-game duo and fill services of Dota 2, Wild Rift and Deadlock join the list.
-- WoW and PUBG are hourly, so they get no report. Same list as src/design-reference/lib/winloss.js.
create or replace function public.order_tracks_wl(p_order public.orders) returns boolean
language sql immutable security invoker set search_path = '' as $$
  select not p_order.gg and (p_order.game, p_order.service) in (values ('lol','duo1'),('lol','duo2'),('lol','duo3'),('lol','ranked5'),('lol','flex'),('lol','clash'),('val','duo1'),('val','duo2'),('val','duo3'),('val','skirm'),('val','stack'),('val','premier'),('cs2','duo1'),('cs2','duo2'),('cs2','duo3'),('cs2','wing'),('cs2','five'),('cs2','faceit5'),('r6','duo1'),('r6','duo2'),('r6','duo3'),('r6','stack'),('mr','duo1'),('mr','duo2'),('mr','duo3'),('mr','teamup'),('mr','six'),('ow','duo1'),('ow','duo2'),('ow','duo3'),('ow','stadium'),('ow','five'),('rl','three'),('pu','duo1'),('pu','duo2'),('pu','duo3'),('pu','squad'),('dota','duo1'),('dota','duo2'),('dota','duo3'),('dota','party5'),('wr','duo1'),('wr','duo2'),('wr','duo3'),('wr','five'),('dl','duo1'),('dl','duo2'),('dl','duo3'),('dl','six'));
$$;

-- Free coaching (perks): every catalog training service, the new games' included.
create or replace function public.free_coaching_service(p_game text, p_service text)
returns boolean language sql immutable set search_path = '' as $$
  select (p_game, p_service) in (('lol','vod'),('lol','champ'),('val','vod'),('val','aim'),('cs2','demo'),('cs2','util'),('fn','learn'),('fn','build'),('cod','learn'),('cod','loadout'),('apex','learn'),('apex','move'),('r6','ops'),('r6','maps'),('mr','hero'),('ow','role'),('rl','mech'),('tft','econ'),('fc','tactics'),('fc','champs'),('arc','pvp'),('mc','pvp'),('mc','bw'),('pu','draft'),
    ('lol','learn'),('val','learn'),('cs2','learn'),('r6','learn'),('mr','learn'),('ow','learn'),('rl','learn'),('pu','learn'),
    ('dota','learn'),('dota','replay'),('dota','hero'),('wow','learn'),('wow','class'),('pubg','learn'),('pubg','spray'),('wr','learn'),('wr','champ'),('dl','learn'),('dl','macro'));
$$;

-- Analytics: the new service ids are reported by name instead of 'unknown'.
create or replace function public.analytics_service_slug(p_service text) returns text
language sql security definer set search_path = '' as $$
  select case when p_service in ('aim','aram','arcade','arena','arena3','box','build','bw','casual','champ','champs','chat','clash','class','clubs','cup','delves','demo','dm','draft','dragon','duo1','duo2','duo3','duos','econ','escort','extra','faceit5','five','flex','friendly','gg1','gg2','hard','hero','karaoke','keys','kickoff','learn','level','loadout','macro','manhunt','maps','mech','mini','mix','move','mp4','norm','ops','party','party5','premier','pubs','pvp','qp','quads','quick','ranked5','rebirth','reload','replay','retake','role','six','skirm','sleep','smp','spray','squad','stack','stadium','stream','surv','swift','tactics','teamup','three','trio','turbo','unranked','unrated','util','vod','watch','wing','zb','zombies') then p_service else 'unknown' end;
$$;

commit;
