do $duoly_test_guard$
declare production_secret boolean := false;
begin
  if not exists (select 1 from pg_catalog.pg_namespace where nspname = 'duoly_test_marker') then
    raise exception 'refusing to run tests on production';
  end if;
  if pg_catalog.to_regclass('vault.secrets') is not null then
    execute 'select exists (select 1 from vault.secrets where name = ''payments_tick_secret'')' into production_secret;
  end if;
  if production_secret then
    raise exception 'refusing to run tests on production';
  end if;
end;
$duoly_test_guard$;

-- 20261115120000_featured_games.sql: a profile features any number of approved games, featured_game
-- stays featured_games[1], the write guard covers the list, losing approval drops a game from it,
-- the save RPC takes the ordered list and still takes the old single field, and both read functions
-- hand the list back.

begin;
create temp table assertions(label text);
create function pg_temp.ok(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'featured games: %', label; end if;
  insert into pg_temp.assertions values(label);
end $$;
create function pg_temp.profile(p_user uuid) returns public.teammate_public_profiles language sql as $$
  select * from public.teammate_public_profiles where user_id = p_user;
$$;
/* The settings payload the profile screen posts, with the featured keys left to the caller. */
create function pg_temp.settings(p_slug text, p_extra jsonb) returns jsonb language sql as $$
  select pg_catalog.jsonb_build_object('published',true,'slug',p_slug,'accent','lavender','banner','slash',
    'vibeTags','[]'::jsonb,'showCountry',false,'coaching',false,'games','[]'::jsonb) || p_extra;
$$;
create function pg_temp.as_user(p_user uuid) returns void language sql as $$
  select pg_catalog.set_config('request.jwt.claims',
    pg_catalog.jsonb_build_object('sub',p_user::text,'role','authenticated')::text, true);
$$;

insert into auth.users(id,aud,role,email,raw_user_meta_data,raw_app_meta_data) values
 ('fe150000-0000-4000-8000-000000000001','authenticated','authenticated','many-games@example.invalid','{}','{}'),
 ('fe150000-0000-4000-8000-000000000002','authenticated','authenticated','two-games@example.invalid','{}','{}'),
 ('fe150000-0000-4000-8000-000000000003','authenticated','authenticated','one-game@example.invalid','{}','{}');
update public.account_roles set role='teammate' where user_id::text like 'fe150000%';
update public.profiles set name='Maelle' where id='fe150000-0000-4000-8000-000000000001';
update public.profiles set name='Vesper' where id='fe150000-0000-4000-8000-000000000002';
update public.profiles set name='Juno' where id='fe150000-0000-4000-8000-000000000003';

-- The access trigger runs as it does live: this is what an admin granting game access does.
insert into public.teammate_order_access(user_id,approved_games,enabled_games,gg_access) values
 ('fe150000-0000-4000-8000-000000000001',array['val','lol','cs2'],array['val','lol','cs2'],false),
 ('fe150000-0000-4000-8000-000000000002',array['val','lol'],array['val','lol'],true),
 ('fe150000-0000-4000-8000-000000000003',array['lol'],array['lol'],false);

-- ---- the shape the backfill leaves behind ------------------------------------------------------
select pg_temp.ok((pg_temp.profile('fe150000-0000-4000-8000-000000000001')).featured_games = array['val'],
  'a new page features exactly its first approved game');
select pg_temp.ok(not exists(select 1 from public.teammate_public_profiles where pg_catalog.cardinality(featured_games) = 0),
  'no page is left with an empty featured list');
select pg_temp.ok(not exists(select 1 from public.teammate_public_profiles where featured_games[1] is distinct from featured_game),
  'featured_game is featured_games[1] on every row');
/* The backfill statement itself, replayed: a list emptied by hand comes back from the single
   field, which is exactly what the migration wrote for the rows that predate the column. */
update public.teammate_public_profiles set featured_games = '{}' where user_id='fe150000-0000-4000-8000-000000000001';
select pg_temp.ok((pg_temp.profile('fe150000-0000-4000-8000-000000000001')).featured_games = array['val'],
  'an empty list is refilled from the single field');

-- ---- the two columns stay in step ---------------------------------------------------------------
update public.teammate_public_profiles set featured_games = array['lol','val']
  where user_id='fe150000-0000-4000-8000-000000000001';
select pg_temp.ok((pg_temp.profile('fe150000-0000-4000-8000-000000000001')).featured_game = 'lol',
  'writing the list moves the single field to its first game');
update public.teammate_public_profiles set featured_game = 'cs2'
  where user_id='fe150000-0000-4000-8000-000000000001';
select pg_temp.ok((pg_temp.profile('fe150000-0000-4000-8000-000000000001')).featured_games = array['cs2','lol','val'],
  'writing the single field leads with it and keeps the rest of the list');

-- ---- shape and approval are both enforced on a write --------------------------------------------
do $$ begin
  update public.teammate_public_profiles set featured_games = array['val','val'] where user_id='fe150000-0000-4000-8000-000000000001';
  raise exception 'duplicate featured game accepted';
exception when check_violation then perform pg_temp.ok(true,'a game cannot be featured twice'); end $$;
do $$ begin
  update public.teammate_public_profiles set featured_games = array['val','fn'] where user_id='fe150000-0000-4000-8000-000000000001';
  raise exception 'unapproved featured game accepted';
exception when check_violation then perform pg_temp.ok(true,'every featured game must be approved'); end $$;
select pg_temp.ok(public.teammate_public_featured_valid(
  (select pg_catalog.array_agg('g' || i::text) from pg_catalog.generate_series(1,40) i)),
  'the shape validator has no artificial featured game cap');
select pg_temp.ok(not public.teammate_public_featured_valid(array['val', null]),
  'null elements are refused');
select pg_temp.ok(not public.teammate_public_featured_valid(array['val','../etc']),
  'unsafe elements are refused by the shape validator itself');
do $$ begin
  update public.teammate_public_profiles set featured_games = array['val','../etc'] where user_id='fe150000-0000-4000-8000-000000000001';
  raise exception 'unsafe featured element accepted';
exception when check_violation then perform pg_temp.ok(true,'an element that is not a plain short label is refused'); end $$;
select pg_temp.ok((pg_temp.profile('fe150000-0000-4000-8000-000000000001')).featured_games = array['cs2','lol','val'],
  'a refused write changes nothing');

-- ---- saving from the profile screen -------------------------------------------------------------
grant insert on assertions to authenticated;
set local role authenticated;
select pg_temp.as_user('fe150000-0000-4000-8000-000000000001');
select pg_temp.ok(public.teammate_public_profile_save(pg_temp.settings('maelle',
  pg_catalog.jsonb_build_object('featuredGame','lol','featuredGames','["lol","cs2","val"]'::jsonb)))
  #>'{settings,featuredGames}' = '["lol","cs2","val"]'::jsonb,'the save keeps the order the teammate chose');
select pg_temp.ok(public.teammate_public_profile_get()#>>'{settings,featuredGame}' = 'lol',
  'and the settings read leads with the first of them');
select pg_temp.ok(public.teammate_public_profile_save(pg_temp.settings('maelle',
  pg_catalog.jsonb_build_object('featuredGame','val','featuredGames','["val","lol","val","cs2","lol"]'::jsonb)))
  #>'{settings,featuredGames}' = '["val","lol","cs2"]'::jsonb,'a game sent twice keeps its first place and is stored once');
select pg_temp.ok(public.teammate_public_profile_save(pg_temp.settings('maelle',
  pg_catalog.jsonb_build_object('featuredGame','val','featuredGames',
    (select pg_catalog.jsonb_agg(case when i % 2 = 0 then 'lol' else 'val' end order by i)
      from pg_catalog.generate_series(1,40) i))))
  #>'{settings,featuredGames}' = '["val","lol"]'::jsonb,
  'a long approved payload is deduped without an artificial cap');
select pg_temp.ok(public.teammate_public_profile_save(pg_temp.settings('maelle',
  pg_catalog.jsonb_build_object('featuredGame','val','featuredGames','["val","fn"]'::jsonb)))
  #>>'{error,code}' = '400','a game nobody approved cannot be featured');
select pg_temp.ok(public.teammate_public_profile_save(pg_temp.settings('maelle',
  pg_catalog.jsonb_build_object('featuredGame','val','featuredGames','[]'::jsonb)))
  #>>'{error,code}' = '400','at least one game has to stay featured');
select pg_temp.ok(public.teammate_public_profile_save(pg_temp.settings('maelle',
  pg_catalog.jsonb_build_object('featuredGame','val','featuredGames','["val",7]'::jsonb)))
  #>>'{error,code}' = '400','the list takes game ids only');
select pg_temp.ok(public.teammate_public_profile_save(pg_temp.settings('maelle',
  pg_catalog.jsonb_build_object('featuredGame','val','featuredGames','["val"]'::jsonb,'extra',1)))
  #>>'{error,code}' = '400','no eleventh key');
select pg_temp.ok(public.teammate_public_profile_save(pg_temp.settings('maelle',
  pg_catalog.jsonb_build_object('featuredGame','val','extra',1)))
  #>>'{error,code}' = '400','and the tenth key can only be the featured list');
/* The old client: nine keys, one featured game, no list. It still saves, and the list it gets is
   that one game. */
select pg_temp.ok(public.teammate_public_profile_save(pg_temp.settings('maelle',
  pg_catalog.jsonb_build_object('featuredGame','cs2')))
  #>'{settings,featuredGames}' = '["cs2"]'::jsonb,'an older payload with only the single field still saves');
select pg_temp.ok(public.teammate_public_profile_save(pg_temp.settings('maelle',
  pg_catalog.jsonb_build_object('featuredGame','val','featuredGames','["val","lol","cs2"]'::jsonb)))
  #>'{settings,featuredGames}' = '["val","lol","cs2"]'::jsonb,'and the list can be set again afterwards');
reset role;

-- ---- what a visitor reads ----------------------------------------------------------------------
select pg_temp.ok(public.public_teammate_profile('maelle')->'featuredGames' = '["val","lol","cs2"]'::jsonb,
  'the public profile carries every featured game in order');
select pg_temp.ok(public.public_teammate_profile('maelle')->>'featuredGame' = 'val',
  'and still carries the lead one on its own');
select pg_temp.ok(not exists(select 1 from pg_catalog.jsonb_object_keys(public.public_teammate_profile('maelle')) k
  where k not in ('slug','name','avatar','country','languages','bio','accent','banner','vibeTags','featuredGame',
    'featuredGames','coaching','online','memberSince','sessions','tier','rating','reviewTags','winRate','games',
    'reviews','updatedAt','header','gamerGirl')),'profile field allowlist plus featuredGames only');
/* The published gate is unchanged: it reads featured_game, which the sync keeps inside the list. */
update public.teammate_order_access set approved_games=array['lol','cs2'], enabled_games=array['lol','cs2']
  where user_id='fe150000-0000-4000-8000-000000000001';
select pg_temp.ok((pg_temp.profile('fe150000-0000-4000-8000-000000000001')).featured_games = array['lol','cs2'],
  'losing approval for a featured game drops it and keeps the order of the rest');
select pg_temp.ok((pg_temp.profile('fe150000-0000-4000-8000-000000000001')).featured_game = 'lol',
  'and the single field follows the new first game');
select pg_temp.ok(public.public_teammate_profile('maelle') ? 'slug','the page is still served');

-- ---- the fallbacks the single column already had ------------------------------------------------
update public.teammate_order_access set approved_games=array['val'], enabled_games=array['val']
  where user_id='fe150000-0000-4000-8000-000000000001';
select pg_temp.ok((pg_temp.profile('fe150000-0000-4000-8000-000000000001')).featured_games = array['val'],
  'losing every featured game falls back to the first game that is left');
select pg_temp.ok((pg_temp.profile('fe150000-0000-4000-8000-000000000001')).published,
  'and the page stays published');
update public.teammate_order_access set approved_games='{}', enabled_games='{}'
  where user_id='fe150000-0000-4000-8000-000000000001';
select pg_temp.ok(not (pg_temp.profile('fe150000-0000-4000-8000-000000000001')).published,
  'losing the last game unpublishes the page instead of emptying the list');
select pg_temp.ok((pg_temp.profile('fe150000-0000-4000-8000-000000000001')).featured_games = array['val'],
  'the unpublished page keeps the game it had, exactly as the single column did');

-- ---- Social is a featured game like any other ---------------------------------------------------
update public.teammate_public_profiles set featured_games = array['val','social','lol']
  where user_id='fe150000-0000-4000-8000-000000000002';
select pg_temp.ok((pg_temp.profile('fe150000-0000-4000-8000-000000000002')).featured_games = array['val','social','lol'],
  'a Gamer Girl can feature Social next to her competitive games');
update public.teammate_order_access set gg_access=false where user_id='fe150000-0000-4000-8000-000000000002';
select pg_temp.ok((pg_temp.profile('fe150000-0000-4000-8000-000000000002')).featured_games = array['val','lol'],
  'losing Gamer Girl access drops Social and leaves the rest featured');

-- ---- every supported approved game's details can be saved together ------------------------------
update public.teammate_order_access
  set approved_games=array['lol','val','cs2','fn','cod','apex','r6','mr','ow','dota','rl','wow','pubg','tft','fc','arc','wr','mc','dl','pu'],
      enabled_games=array['lol','val','cs2','fn','cod','apex','r6','mr','ow','dota','rl','wow','pubg','tft','fc','arc','wr','mc','dl','pu']
  where user_id='fe150000-0000-4000-8000-000000000003';
create temp table all_game_settings as
  select pg_temp.settings('juno',pg_catalog.jsonb_build_object(
    'featuredGame',approved_games[1], 'featuredGames',pg_catalog.to_jsonb(approved_games),
    'games',(select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('game',g,'roles',array['Main'],'picks','[]'::jsonb))
      from pg_catalog.unnest(approved_games) g))) payload
  from public.teammate_order_access where user_id='fe150000-0000-4000-8000-000000000003';
grant select on all_game_settings to authenticated;
set local role authenticated;
select pg_temp.as_user('fe150000-0000-4000-8000-000000000003');
select pg_temp.ok(pg_catalog.jsonb_array_length(public.teammate_public_profile_save(payload)#>'{settings,games}') = 20,
  'twenty unique approved supported game details save without a numeric cap') from all_game_settings;
select pg_temp.ok(public.teammate_public_profile_save(pg_catalog.jsonb_set(payload,'{games}',
  (payload->'games') || pg_catalog.jsonb_build_array(payload#>'{games,0}')))#>>'{error,code}' = '400',
  'removing the cap does not permit duplicate game details') from all_game_settings;
select pg_temp.ok(public.teammate_public_profile_save(pg_catalog.jsonb_set(payload,'{games}',
  (payload->'games') || '[{"game":"social","roles":[],"picks":[]}]'::jsonb))#>>'{error,code}' = '400',
  'removing the cap does not permit unapproved game details') from all_game_settings;
reset role;
select pg_temp.ok((select pg_catalog.count(*) = 20 from public.teammate_game_ranks
  where user_id='fe150000-0000-4000-8000-000000000003' and roles=array['Main']),
  'all twenty game detail rows were actually persisted');

-- ---- grants and security ------------------------------------------------------------------------
select pg_temp.ok(not has_function_privilege('anon','public.teammate_public_featured_valid(text[])','execute')
  and not has_function_privilege('authenticated','public.teammate_public_featured_valid(text[])','execute'),
  'the shape check is not exposed to anon or authenticated');
/* The header endpoint updates header_image as the service role, and an UPDATE re-checks the row
   constraints as the caller, so that role must be able to run the new check and the validator it
   reuses. Without these two grants a header upload is a 503 again (20261115090000). */
select pg_temp.ok(has_function_privilege('service_role','public.teammate_public_featured_valid(text[])','execute')
  and has_function_privilege('service_role','public.teammate_public_labels_valid(text[],int)','execute'),
  'the service role can run the row check the header update re-evaluates');
select pg_temp.ok(not has_function_privilege('anon','public.teammate_public_featured_sync()','execute')
  and not has_function_privilege('authenticated','public.teammate_public_featured_sync()','execute')
  and not has_function_privilege('service_role','public.teammate_public_featured_sync()','execute'),
  'and so is the sync trigger');
select pg_temp.ok(has_function_privilege('anon','public.public_teammate_profile(text)','execute')
  and has_function_privilege('authenticated','public.public_teammate_profile(text)','execute'),
  'the recreated public read keeps its anon and authenticated grants');
select pg_temp.ok(has_function_privilege('authenticated','public.teammate_public_profile_save(jsonb)','execute')
  and has_function_privilege('authenticated','public.teammate_public_profile_get()','execute'),
  'the recreated settings functions keep their authenticated grants');
select pg_temp.ok(not has_function_privilege('anon','public.teammate_public_profile_save(jsonb)','execute'),
  'and anon still cannot save a profile');
select pg_temp.ok(has_column_privilege('service_role','public.teammate_public_profiles','header_image','select')
  and has_column_privilege('service_role','public.teammate_public_profiles','header_image','update'),
  'the header endpoint keeps the two column grants it runs on');
select pg_temp.ok(not has_column_privilege('service_role','public.teammate_public_profiles','featured_games','update'),
  'and the new column is not handed to the service role');
select pg_temp.ok((select pg_catalog.count(*) from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname='public' and p.proname in ('public_teammate_profile','teammate_public_profile_get',
    'teammate_public_profile_save','teammate_public_profile_access_changed','teammate_public_featured_guard')
    and p.prosecdef and p.proconfig @> array['search_path=""']) = 5,
  'every recreated function is still a definer on an empty search path');
select pg_temp.ok((select pg_catalog.count(*) from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname='public' and p.proname in ('teammate_public_featured_valid','teammate_public_featured_sync')
    and p.proconfig @> array['search_path=""']) = 2,
  'and both new functions run on an empty search path too');
select pg_temp.ok(public.public_teammate_profile('maelle')::text !~* '(example\.invalid|fe150000-0000)',
  'no identifiers or emails exposed');

-- Exercise the endpoint's real column-only write, including an unpublished stale profile.
-- The role has no SELECT on featured_games; trigger NEW/OLD and the CHECK must still work.
set local role service_role;
update public.teammate_public_profiles
  set header_image='https://example.supabase.co/storage/v1/object/public/profile-headers/fe150000-0000-4000-8000-000000000001/0123456789abcdef.jpg',
      updated_at=pg_catalog.clock_timestamp()
  where user_id='fe150000-0000-4000-8000-000000000001';
reset role;
select pg_temp.ok((pg_temp.profile('fe150000-0000-4000-8000-000000000001')).header_image =
  'https://example.supabase.co/storage/v1/object/public/profile-headers/fe150000-0000-4000-8000-000000000001/0123456789abcdef.jpg',
  'service-role header writes work even when an unpublished profile has lost approval');
select pg_temp.ok((select pg_catalog.array_agg(t.tgname::text order by t.tgname) =
  array['teammate_public_featured_guard','teammate_public_featured_sync']
  from pg_catalog.pg_trigger t where t.tgrelid='public.teammate_public_profiles'::regclass
    and t.tgname in ('teammate_public_featured_guard','teammate_public_featured_sync')
    and t.tgtype & 2 = 2),
  'the approval guard is a BEFORE trigger ordered before the sync trigger');

select 'featured_games: ' || pg_catalog.count(*) || ' checks passed' as result from pg_temp.assertions;
rollback;
