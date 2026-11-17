-- Evaluate each public profile once, before card projection and filtering.
-- Preserve the fields, filters, ordering and security of 20261114130000.
begin;

CREATE OR REPLACE FUNCTION public.public_teammate_cards(p_game text DEFAULT NULL::text, p_limit integer DEFAULT 6, p_exclude_slug text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  WITH profile_docs AS MATERIALIZED (
    SELECT p.slug, public.public_teammate_profile(p.slug) AS d
    FROM public.teammate_public_profiles p
  )
  select coalesce(pg_catalog.jsonb_agg(q.card order by q.online desc,q.sessions desc,q.slug),'[]'::jsonb) from (
    select p.slug, (d->>'online')::boolean online, (d->>'sessions')::bigint sessions,
      pg_catalog.jsonb_build_object('slug',d->'slug','name',d->'name','avatar',d->'avatar','accent',d->'accent',
        'tier',d->'tier','online',d->'online','game',g->'game','rank',case when (g->>'verified')::boolean then g->'rank' else 'null'::jsonb end,'rating',d->'rating',
        'games',coalesce((select pg_catalog.jsonb_agg(x->'game') from pg_catalog.jsonb_array_elements(coalesce(d->'games','[]')) x),'[]'::jsonb),
        'languages',coalesce(d->'languages','[]'::jsonb),
        'vibeTags',coalesce(d->'vibeTags','[]'::jsonb),
        'coaching',coalesce(d->'coaching','false'::jsonb),
        'gamerGirl',coalesce(d->'gamerGirl','false'::jsonb),
        'quote',coalesce((select r->'text' from pg_catalog.jsonb_array_elements(coalesce(d->'reviews','[]')) r
          where pg_catalog.length(pg_catalog.btrim(r->>'text')) > 0 limit 1),'null'::jsonb)) card
    from profile_docs p
    cross join lateral (select e g from pg_catalog.jsonb_array_elements(coalesce(d->'games','[]')) e where e->>'game'=coalesce(p_game,d->>'featuredGame') limit 1) a
    where d ? 'slug' and not d ? 'status' and (p_exclude_slug is null or p.slug<>p_exclude_slug)
    order by online desc,sessions desc,p.slug limit greatest(1,least(coalesce(p_limit,6),100))
  ) q;
$function$
;

grant execute on function public.public_teammate_cards(text, int, text) to anon, authenticated;

commit;
