-- Ledger #43: the homepage shows real numbers only (owner decision 2026-10-27).
-- Public by design (anon can execute): aggregate counts only. No ids, names, emails,
-- review texts, prices or per-teammate data leave the database.
--   online           teammates online now (same rule as presence_public_count)
--   onlineByGame     per game: available teammates who can take it, plus busy ones playing it
--   onlineByRegion   the same online teammates by profile country: Europe, North America,
--                    Asia and Oceania, South America (others and unknown are left out)
--   sessions         completed orders, all time
--   reviews, rating  number of reviews and the average star rating (null without reviews)
--   matchSeconds     median time from queue to match over the last 30 days (null under 3 orders)
begin;

create function public.home_public_stats() returns jsonb
language sql stable security definer set search_path = '' as $$
  with games(g) as (
    select pg_catalog.unnest(array['lol','val','cs2','fn','cod','apex','r6','mr','ow','rl','tft','fc','arc','mc','pu']::text[])
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
revoke all on function public.home_public_stats() from public, anon, authenticated, service_role;
grant execute on function public.home_public_stats() to anon, authenticated;

commit;
