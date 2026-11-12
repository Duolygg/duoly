-- Purpose: the homepage carousel cards link to the teammate's public profile.
-- Owner approval 12 Nov 2026 for the "Meet your teammates" carousel only.
--
-- Apply notes: OWNER APPROVAL REQUIRED. Apply only through the normal reviewed migration path.
-- Never db push or apply to the hosted project during development. Test on disposable CI only.
--
-- 20261030100000_home_teammates.sql and 20261108120000_new_games.sql are never edited: this is a
-- create or replace of the function the latter installed, with one field added.
begin;

/*
 * home_teammates() gains a nullable `slug`: the teammate's public profile link when that profile
 * is one a visitor could open anyway, and null otherwise. The condition is the same four tests
 * public_teammate_profile() applies before it returns a profile instead of 'gone' (published, not
 * admin hidden, an active teammate, still approved for the game the profile features), called
 * through the same two helpers so the two cannot drift apart. A card never carries a link to a
 * page that would answer 410.
 *
 * Everything else is unchanged from 20261108120000_new_games.sql: the same rows, the same eight
 * fields in the same order ahead of the new one, the same ordering and the same limit of 24. The
 * grants are re-asserted below rather than assumed.
 */
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
      'sessions', t.sessions,
      'slug', t.slug) as item
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
          where v.teammate_id = r.user_id) as rating,
        (select tp.slug from public.teammate_public_profiles as tp
          where tp.user_id = r.user_id
            and tp.published
            and not tp.admin_hidden
            and public.teammate_public_active(tp.user_id)
            and public.teammate_public_approved(tp.user_id, tp.featured_game)) as slug
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

-- Same grant as 20261030100000_home_teammates.sql: no implicit PUBLIC execute, anon and
-- authenticated may read. create or replace keeps the existing grants; this re-asserts them.
revoke all on function public.home_teammates() from public, anon, authenticated, service_role;
grant execute on function public.home_teammates() to anon, authenticated;

commit;
