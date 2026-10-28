-- Rollback-only test for 20261025230000_home_public_stats.sql (run after the migration body).
begin;
set local role anon;
do $$
declare s jsonb := public.home_public_stats();
begin
  if (s->>'online') is null or (s->>'sessions') is null or (s->>'reviews') is null then
    raise exception 'missing figures: %', s;
  end if;
  if pg_catalog.jsonb_typeof(s->'onlineByGame') <> 'object'
     or (select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(s->'onlineByGame')) <> 15 then
    raise exception 'per game figures wrong: %', s->'onlineByGame';
  end if;
  if (select pg_catalog.array_agg(k order by k) from pg_catalog.jsonb_object_keys(s->'onlineByRegion') k)
     <> array['ao','eu','na','sa'] then
    raise exception 'regions wrong: %', s->'onlineByRegion';
  end if;
  -- Only aggregate keys leave the database.
  if (select pg_catalog.array_agg(k order by k) from pg_catalog.jsonb_object_keys(s) k)
     <> array['matchSeconds','online','onlineByGame','onlineByRegion','rating','reviews','sessions'] then
    raise exception 'unexpected keys: %', s;
  end if;
  if (s->>'online')::integer <> public.presence_public_count() then
    raise exception 'online differs from presence_public_count';
  end if;
end $$;
reset role;
select 'home_public_stats: all checks passed' as result;
rollback;
