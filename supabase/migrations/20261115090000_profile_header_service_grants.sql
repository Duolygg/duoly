-- Profile header uploads failed with 503 for every teammate: the endpoint reads and swaps
-- header_image with the service role, but 20261112120000 revoked all table privileges from
-- service_role and 20261112170000 never granted them back. Grant exactly the columns the
-- header endpoint touches (src/server/teammates/profile-header.ts), nothing else.
-- Also return the saved header from teammate_public_profile_get(), so settings show it after a
-- reload and it can be replaced or removed. Body copied from 20261114130000; only header added.
begin;

grant select (user_id, header_image) on table public.teammate_public_profiles to service_role;
grant update (header_image, updated_at) on table public.teammate_public_profiles to service_role;
-- Every UPDATE re-checks the row's constraints as the caller, and the slug check calls this
-- immutable validator, so the service role needs to run it too.
grant execute on function public.teammate_public_slug_valid(text) to service_role;

create or replace function public.teammate_public_profile_get() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare u uuid:=auth.uid(); p public.teammate_public_profiles; a text[];
begin
  if not public.teammate_public_active(u) then return public.order_error(403,'Teammate role required.'); end if;
  select * into p from public.teammate_public_profiles where user_id=u;
  a := coalesce(public.teammate_public_games(u),'{}'::text[]);
  return pg_catalog.jsonb_build_object('settings',pg_catalog.jsonb_build_object(
    'published',coalesce(p.published,false),'slug',coalesce(p.slug,''),
    'accent',coalesce(p.accent,case when 'social'=any(a) then 'pink' else 'lavender' end),'banner',coalesce(p.banner,'slash'),
    'featuredGame',coalesce(p.featured_game,a[1],''),'vibeTags',coalesce(p.vibe_tags,'{}'),'showCountry',coalesce(p.show_country,false),'coaching',coalesce(p.coaching,false),
    'games',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('game',g,'roles',coalesce(r.roles,'{}'),'picks',coalesce(r.picks,'{}')) order by g='social',g)
      from pg_catalog.unnest(a) g left join public.teammate_game_ranks r on r.user_id=u and r.game=g),'[]'::jsonb)),
    'approvedGames',a,'ranks',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('game',r.game,'rank',r.rank,'peakRank',r.peak_rank,'verified',r.verified_at is not null) order by r.game)
      from public.teammate_game_ranks r where r.user_id=u and r.game=any(a)),'[]'::jsonb),'hidden',coalesce(p.admin_hidden,false),
    'header',p.header_image);
end $$;

commit;
