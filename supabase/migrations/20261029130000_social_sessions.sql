-- Social sessions (Fabian 2026-10-29): a 16th "game", 'social', for Gamer Girl only time together
-- (just chat, watch together, sleep call, karaoke). Every Social service is a Gamer Girl service,
-- so the existing rules already route it: only gg_access teammates take gg orders, for every game.
-- Additive: 'social' joins the game lists below. Per-game admin approval (approved_games,
-- admin_set_access) and teammate applications stay without it on purpose.
begin;

alter table public.orders drop constraint orders_game_check;
alter table public.orders add constraint orders_game_check
  check (game in ('lol','val','cs2','fn','cod','apex','r6','mr','ow','rl','tft','fc','arc','mc','pu','social'));

alter table public.checkout_intents drop constraint checkout_intents_game_check;
alter table public.checkout_intents add constraint checkout_intents_game_check
  check (game in ('lol','val','cs2','fn','cod','apex','r6','mr','ow','rl','tft','fc','arc','mc','pu','social'));

alter table public.teammate_order_access drop constraint teammate_order_access_enabled_games_check;
alter table public.teammate_order_access add constraint teammate_order_access_enabled_games_check check (
  pg_catalog.cardinality(enabled_games) <= 16
  and enabled_games <@ array['lol','val','cs2','fn','cod','apex','r6','mr','ow','rl','tft','fc','arc','mc','pu','social']::text[]
  and pg_catalog.array_position(enabled_games,null) is null);
alter table public.teammate_order_access alter column enabled_games
  set default array['lol','val','cs2','fn','cod','apex','r6','mr','ow','rl','tft','fc','arc','mc','pu','social']::text[];
-- Gamer Girls see Social orders right away; each can switch it off in her queue settings.
update public.teammate_order_access
   set enabled_games = enabled_games || array['social']::text[]
 where gg_access and not ('social' = any(enabled_games));

-- From 20261024210000_queue_settings.sql, with 'social' in the Gamer Girl list.
create or replace function public.teammate_queue_settings() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_access public.teammate_order_access; v_allowed text[]; v_enabled text[];
begin
  if v_actor is null then return public.order_error(401,'Authentication required.'); end if;
  select a.* into v_access from public.account_roles r
    join public.teammate_order_access a on a.user_id=r.user_id
    where r.user_id=v_actor and r.role='teammate';
  if v_access.user_id is null then return public.order_error(403,'Teammates only.'); end if;
  v_allowed := case when v_access.gg_access then
    array['lol','val','cs2','fn','cod','apex','r6','mr','ow','rl','tft','fc','arc','mc','pu','social']::text[]
    else v_access.approved_games end;
  select coalesce(pg_catalog.array_agg(g order by n),'{}'::text[]) into v_enabled
    from pg_catalog.unnest(array['lol','val','cs2','fn','cod','apex','r6','mr','ow','rl','tft','fc','arc','mc','pu','social']::text[]) with ordinality x(g,n)
    where g=any(v_allowed) and g=any(v_access.enabled_games);
  return pg_catalog.jsonb_build_object('allowed_games',v_allowed,'enabled_games',v_enabled,'gg_access',v_access.gg_access,'voice_opt_in',v_access.voice_opt_in);
end;
$$;

create or replace function public.set_teammate_queue_settings(p_enabled_games text[],p_voice_opt_in boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_access public.teammate_order_access; v_allowed text[];
begin
  if v_actor is null then return public.order_error(401,'Authentication required.'); end if;
  perform 1 from public.account_roles where user_id=v_actor and role='teammate' for update;
  if not found then return public.order_error(403,'Teammates only.'); end if;
  select a.* into v_access from public.teammate_order_access a where a.user_id=v_actor for update;
  if v_access.user_id is null then return public.order_error(403,'Teammate access required.'); end if;
  v_allowed := case when v_access.gg_access then
    array['lol','val','cs2','fn','cod','apex','r6','mr','ow','rl','tft','fc','arc','mc','pu','social']::text[]
    else v_access.approved_games end;
  if p_enabled_games is null or p_voice_opt_in is null
    or pg_catalog.cardinality(p_enabled_games)>16
    or pg_catalog.array_position(p_enabled_games,null) is not null
    or not p_enabled_games <@ v_allowed
    or (select pg_catalog.count(*) from pg_catalog.unnest(p_enabled_games) g) <> (select pg_catalog.count(distinct g) from pg_catalog.unnest(p_enabled_games) g)
  then return public.order_error(400,'Choose only games approved for your account.'); end if;
  update public.teammate_order_access set enabled_games=p_enabled_games,voice_opt_in=p_voice_opt_in where user_id=v_actor;
  return public.teammate_queue_settings();
end;
$$;

-- From 20261025230000_home_public_stats.sql, with 'social' in the game list.
create or replace function public.home_public_stats() returns jsonb
language sql stable security definer set search_path = '' as $$
  with games(g) as (
    select pg_catalog.unnest(array['lol','val','cs2','fn','cod','apex','r6','mr','ow','rl','tft','fc','arc','mc','pu','social']::text[])
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

commit;
