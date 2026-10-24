-- Ledger #36: the homepage "Recent matches" ticker reads real completed orders.
-- Public by design (anon can execute). Only a first name, the game, the product title, the
-- time to match and the star rating leave the database: no ids, emails, IGNs, notes,
-- regions, prices or teammate data. Names that look like an email fall back to null.
begin;

create function public.home_recent_matches() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(pg_catalog.jsonb_agg(q.item order by q.completed_at desc, q.id), '[]'::jsonb) from (
    select o.completed_at, o.id, pg_catalog.jsonb_build_object(
      'game', o.game,
      'name', (select case
          when n.first = '' or n.first ~ '[@/:]' or pg_catalog.lower(n.first) = 'player' then null
          else pg_catalog.left(n.first, 16) end
        from (select pg_catalog.split_part(pg_catalog.btrim(pg_catalog.regexp_replace(
          o.customer_name, '[[:cntrl:][:space:]]+', ' ', 'g')), ' ', 1) as first) as n),
      'title', pg_catalog.left(o.title, 40),
      'units', o.units,
      'matchSeconds', greatest(0, pg_catalog.floor(
        pg_catalog.date_part('epoch', o.accepted_at - o.queued_at))::integer),
      'rating', r.rating) as item
    from public.orders as o
    left join public.order_reviews as r on r.order_id = o.id
    where o.status = 'completed'
      and o.completed_at > pg_catalog.clock_timestamp() - interval '30 days'
    order by o.completed_at desc, o.id
    limit 20) as q;
$$;
revoke all on function public.home_recent_matches() from public, anon, authenticated, service_role;
grant execute on function public.home_recent_matches() to anon, authenticated;

commit;
