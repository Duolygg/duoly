-- Leaderboard (#29) from real completed orders and customer ratings.
-- Rules from the original lib/ledger.js leaderboard():
--   periods: week = last 7 days, month = last 30 days, all = all time (by completion time)
--   tabs: global plus one tab per game that has completions in the period
--   points: 10 per completed order plus 5 per five-star review
--   ranking: points desc, then completed orders desc (teammate id breaks remaining ties)
--   rating: average stars of the rated orders in the period, two decimals, null when unrated
-- Public fields only: id, display name, avatar, main game, completed orders, rating, five-star count, points.
-- No email, country, earnings, review text or customer data. Only current teammates are ranked.
-- Read only through teammate_stats(), which already requires the teammate role.
-- Depends on 20261024160000_order_reviews.sql: teammate_stats starts from that version, only 'leaderboard' changes.
begin;

create function public.teammate_leaderboard(p_now timestamptz) returns jsonb
language sql stable security invoker set search_path = '' as $$
  with periods(period, since) as (
    values ('week', p_now - interval '7 days'),
           ('month', p_now - interval '30 days'),
           ('all', '-infinity'::timestamptz)
  ),
  entries as (
    select e.teammate_id, e.completed_at, o.game, r.rating
    from public.teammate_earning_entries as e
    join public.orders as o on o.id = e.order_id
    join public.account_roles as ar on ar.user_id = e.teammate_id and ar.role = 'teammate'
    left join public.order_reviews as r on r.order_id = e.order_id
    where e.completed_at <= p_now
  ),
  scoped as (
    select p.period, t.tab, x.teammate_id, x.completed_at, x.game, x.rating
    from periods as p
    join entries as x on x.completed_at >= p.since
    cross join lateral (values ('global'), (x.game)) as t(tab)
  ),
  per_game as (
    select period, tab, teammate_id, game, pg_catalog.count(*) as n, pg_catalog.max(completed_at) as last_at
    from scoped group by period, tab, teammate_id, game
  ),
  main as (
    select distinct on (period, tab, teammate_id) period, tab, teammate_id, game
    from per_game order by period, tab, teammate_id, n desc, last_at desc, game
  ),
  agg as (
    select period, tab, teammate_id,
      pg_catalog.count(*) as orders,
      pg_catalog.round(pg_catalog.avg(rating), 2) as rating,
      pg_catalog.count(*) filter (where rating = 5) as fives
    from scoped group by period, tab, teammate_id
  ),
  board as (
    select a.period, a.tab,
      pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', a.teammate_id,
        'name', coalesce(nullif(pg_catalog.btrim(p.name), ''), 'Teammate'),
        'image', coalesce(p.image, ''),
        'orders', a.orders,
        'main', m.game,
        'rating', a.rating,
        'fives', a.fives,
        'points', a.orders * 10 + a.fives * 5)
        order by a.orders * 10 + a.fives * 5 desc, a.orders desc, a.teammate_id) as list
    from agg as a
    join main as m on m.period = a.period and m.tab = a.tab and m.teammate_id = a.teammate_id
    left join public.profiles as p on p.id = a.teammate_id
    group by a.period, a.tab
  )
  select pg_catalog.jsonb_object_agg(p.period,
    pg_catalog.jsonb_build_object('global', '[]'::jsonb)
      || coalesce((select pg_catalog.jsonb_object_agg(b.tab, b.list) from board as b where b.period = p.period), '{}'::jsonb))
  from periods as p;
$$;
revoke all on function public.teammate_leaderboard(timestamptz) from public,anon,authenticated,service_role;

create or replace function public.teammate_stats() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_count bigint; v_trust jsonb; v_result jsonb;
begin
 if v_actor is null then return public.order_error(401,'Authentication required.'); end if;
 perform 1 from public.account_roles where user_id=v_actor and role='teammate';
 if not found then return public.order_error(403,'Teammate role required.'); end if;
 select pg_catalog.count(*) into v_count from public.teammate_earning_entries where teammate_id=v_actor;
 v_trust := public.completion_trust(v_count);
 select pg_catalog.jsonb_build_object(
   'now',(pg_catalog.date_part('epoch',pg_catalog.clock_timestamp())*1000)::bigint,
   'me',v_actor,
   'stats',pg_catalog.jsonb_build_object(
     'completed',v_count,
     'tier',pg_catalog.jsonb_build_object('name',pg_catalog.initcap(v_trust->>'trust_tier'),'deposit',(v_trust->>'deposit_percent')::integer),
     'held',coalesce((select pg_catalog.sum(e.held_usd_cents) from public.teammate_earning_entries as e
       where e.teammate_id=v_actor and e.completed_at > pg_catalog.clock_timestamp()-interval '14 days'),0)/100.0,
     'saved',coalesce((select pg_catalog.sum((10-e.deposit_percent)*e.payout_usd_cents) from public.teammate_earning_entries as e where e.teammate_id=v_actor),0)/10000.0,
     'rating',(select pg_catalog.round(pg_catalog.avg(r.rating),2) from public.order_reviews as r where r.teammate_id=v_actor),
     'reviews',(select pg_catalog.count(*) from public.order_reviews as r where r.teammate_id=v_actor),
     'tipsTotal',0,
     'recent',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
       'orderId',e.order_id,'at',(pg_catalog.date_part('epoch',e.completed_at)*1000)::bigint,
       'net',e.net_usd_cents/100.0,'tip',0,'game',o.game) order by e.completed_at desc)
       from public.teammate_earning_entries as e join public.orders as o on o.id=e.order_id
       where e.teammate_id=v_actor and e.completed_at > pg_catalog.clock_timestamp()-interval '8 days'),'[]'::jsonb),
     'latestReviews',coalesce((select pg_catalog.jsonb_agg(q.item order by q.created_at desc) from (
       select r.created_at,pg_catalog.jsonb_build_object('rating',r.rating,'text',r.text,'tags',pg_catalog.to_jsonb(r.tags),
         'customer',o.customer_name,'game',o.game,'at',(pg_catalog.date_part('epoch',r.created_at)*1000)::bigint) as item
       from public.order_reviews as r join public.orders as o on o.id=r.order_id
       where r.teammate_id=v_actor and (r.text<>'' or pg_catalog.cardinality(r.tags)>0)
       order by r.created_at desc,r.order_id limit 5) as q),'[]'::jsonb),
     'adjustments','[]'::jsonb),
   'leaderboard',public.teammate_leaderboard(pg_catalog.clock_timestamp())) into v_result;
 return v_result;
end $$;
revoke all on function public.teammate_stats() from public,anon,authenticated,service_role;
grant execute on function public.teammate_stats() to authenticated;

commit;
