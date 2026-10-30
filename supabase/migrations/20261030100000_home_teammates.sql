-- Hero teammate cards (Fabian 2026-10-30): real teammates gliding across the homepage hero.
-- Ledger #43: real data only. Public by design (anon can execute), so it returns only what a
-- card shows: first name, avatar, up to 3 games, Gamer Girl, online now, review average and
-- completed sessions. No ids, full names, emails, countries, payouts, priority or reviews texts.
-- Teammates who are suspended, have no game access or no real first name ("Player") are left out.
begin;

create function public.home_teammates() returns jsonb
language sql stable security definer set search_path = '' as $$
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
            from pg_catalog.unnest(array['lol','val','cs2','fn','cod','apex','r6','mr','ow','rl','tft','fc','arc','mc','pu','social']::text[])
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
revoke all on function public.home_teammates() from public, anon, authenticated, service_role;
grant execute on function public.home_teammates() to anon, authenticated;

commit;
