-- The teammate directory grows into a marketplace: filters for language, play style and coaching,
-- the games each teammate plays on their card, and a short review quote. Every one of those facts
-- is already public on the profile page itself (public_teammate_profile), so the card simply
-- passes more of the same object through. Nothing private is added.
--
-- 1. public_teammate_cards() keeps its signature, order, limit and every field it returned, and
--    adds: games (game ids the profile lists, in profile order), languages, vibeTags, coaching
--    and quote (the newest written review text, or null).
-- 2. customer_favorite_slugs(): the public slugs of the signed-in customer's saved teammates
--    whose profile a visitor can open, so the directory can mark saved cards and show a
--    "Your saved teammates" row. Customers only; everyone else gets an empty list.

begin;

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
        'quote',coalesce((select r->'text' from pg_catalog.jsonb_array_elements(coalesce(d->'reviews','[]')) r
          where pg_catalog.length(pg_catalog.btrim(r->>'text')) > 0 limit 1),'null'::jsonb)) card
    from public.teammate_public_profiles p
    cross join lateral (select public.public_teammate_profile(p.slug) d) v
    cross join lateral (select e g from pg_catalog.jsonb_array_elements(coalesce(d->'games','[]')) e where e->>'game'=coalesce(p_game,d->>'featuredGame') limit 1) a
    where d ? 'slug' and not d ? 'status' and (p_exclude_slug is null or p.slug<>p_exclude_slug)
    order by online desc,sessions desc,p.slug limit greatest(1,least(coalesce(p_limit,6),100))
  ) q;
$$;

create function public.customer_favorite_slugs() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(pg_catalog.jsonb_agg(p.slug order by f.created_at desc), '[]'::jsonb)
  from public.customer_favorites f
  join public.teammate_public_profiles p on p.user_id = f.teammate_id
  where f.customer_id = auth.uid()
    and exists(select 1 from public.account_roles r where r.user_id = auth.uid() and r.role = 'customer')
    -- Only pages a visitor can actually open, the same test the profile route applies.
    and public.public_teammate_profile(p.slug) ? 'slug'
    and not public.public_teammate_profile(p.slug) ? 'status';
$$;
revoke all on function public.customer_favorite_slugs() from public, anon, authenticated, service_role;
grant execute on function public.customer_favorite_slugs() to authenticated;

commit;
