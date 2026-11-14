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

-- 20261114130000_gamer_girl_profiles.sql: Social counts as a Gamer Girl's game on public profiles,
-- the profile and its card say gamerGirl, Gamer Girl access alone gives a teammate a page, and
-- losing it moves or unpublishes a Social-featured page.

begin;
create temp table assertions(label text);
create function pg_temp.ok(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'gamer girl profiles: %', label; end if;
  insert into pg_temp.assertions values(label);
end $$;
create function pg_temp.profile(p_user uuid) returns public.teammate_public_profiles language sql as $$
  select * from public.teammate_public_profiles where user_id = p_user;
$$;
create function pg_temp.card(p_slug text, p_game text default null) returns jsonb language sql as $$
  select x from pg_catalog.jsonb_array_elements(public.public_teammate_cards(p_game, 100, null)) x
  where x->>'slug' = p_slug;
$$;

insert into auth.users(id,aud,role,email,raw_user_meta_data,raw_app_meta_data) values
 ('e1300000-0000-4000-8000-000000000001','authenticated','authenticated','gg-only@example.invalid','{}','{}'),
 ('e1300000-0000-4000-8000-000000000002','authenticated','authenticated','gg-comp@example.invalid','{}','{}'),
 ('e1300000-0000-4000-8000-000000000003','authenticated','authenticated','comp-only@example.invalid','{}','{}');
update public.account_roles set role='teammate' where user_id::text like 'e1300000%';
update public.profiles set name='Ggonly' where id='e1300000-0000-4000-8000-000000000001';
update public.profiles set name='Ggcomp' where id='e1300000-0000-4000-8000-000000000002';
update public.profiles set name='Componly' where id='e1300000-0000-4000-8000-000000000003';

-- The trigger runs as it does live: these inserts are what an admin granting access does.
insert into public.teammate_order_access(user_id,approved_games,enabled_games,gg_access) values
 ('e1300000-0000-4000-8000-000000000001','{}','{}',true),
 ('e1300000-0000-4000-8000-000000000002',array['val'],array['val'],true),
 ('e1300000-0000-4000-8000-000000000003',array['val'],array['val'],false);

-- ---- Gamer Girl access alone gives a page, featuring Social -------------------------------------
select pg_temp.ok((pg_temp.profile('e1300000-0000-4000-8000-000000000001')).published,'a Gamer Girl with no competitive game gets a published page');
select pg_temp.ok((pg_temp.profile('e1300000-0000-4000-8000-000000000001')).featured_game = 'social','her page features Social');
select pg_temp.ok((pg_temp.profile('e1300000-0000-4000-8000-000000000002')).featured_game = 'val','a Gamer Girl with a competitive game features that game first');

-- ---- a Gamer Girl's page starts pink; an accent she picked is never changed ----------------------
select pg_temp.ok((pg_temp.profile('e1300000-0000-4000-8000-000000000001')).accent = 'pink','a new Gamer Girl page starts pink');
select pg_temp.ok((pg_temp.profile('e1300000-0000-4000-8000-000000000002')).accent = 'pink','so does one for a Gamer Girl with a competitive game');
select pg_temp.ok((pg_temp.profile('e1300000-0000-4000-8000-000000000003')).accent = 'lavender','everyone else starts lavender');
update public.teammate_public_profiles set accent='mint' where user_id='e1300000-0000-4000-8000-000000000002';
update public.teammate_order_access set approved_games=array['val','lol'], enabled_games=array['val','lol']
 where user_id='e1300000-0000-4000-8000-000000000002';
select pg_temp.ok((pg_temp.profile('e1300000-0000-4000-8000-000000000002')).accent = 'mint','a later access change keeps the accent she picked');
update public.teammate_order_access set approved_games=array['val'], enabled_games=array['val']
 where user_id='e1300000-0000-4000-8000-000000000002';

-- ---- the profile says so, and lists Social last --------------------------------------------------
select pg_catalog.set_config('gg.only',(pg_temp.profile('e1300000-0000-4000-8000-000000000001')).slug,true);
select pg_catalog.set_config('gg.comp',(pg_temp.profile('e1300000-0000-4000-8000-000000000002')).slug,true);
select pg_catalog.set_config('gg.none',(pg_temp.profile('e1300000-0000-4000-8000-000000000003')).slug,true);
select pg_temp.ok(public.public_teammate_profile(current_setting('gg.only')) ? 'slug','the Gamer Girl page is served, not gone');
select pg_temp.ok(public.public_teammate_profile(current_setting('gg.only'))->'gamerGirl' = 'true'::jsonb,'profile says gamerGirl');
select pg_temp.ok(public.public_teammate_profile(current_setting('gg.none'))->'gamerGirl' = 'false'::jsonb,'a teammate without Gamer Girl access does not');
select pg_temp.ok((select pg_catalog.jsonb_agg(g->>'game') from pg_catalog.jsonb_array_elements(public.public_teammate_profile(current_setting('gg.comp'))->'games') g)
  = '["val","social"]'::jsonb,'Social is listed after the competitive games');
select pg_temp.ok(not exists(select 1 from pg_catalog.jsonb_array_elements(public.public_teammate_profile(current_setting('gg.none'))->'games') g where g->>'game'='social'),
  'no Social without Gamer Girl access');

-- ---- cards ----------------------------------------------------------------------------------------
select pg_temp.ok(pg_temp.card(current_setting('gg.only'))->'gamerGirl' = 'true'::jsonb,'card says gamerGirl');
select pg_temp.ok(pg_temp.card(current_setting('gg.only'),'social') is not null
  and pg_temp.card(current_setting('gg.comp'),'social') is not null,'the Social filter finds both Gamer Girls');
select pg_temp.ok(pg_temp.card(current_setting('gg.none'),'social') is null,'and nobody else');
select pg_temp.ok(not exists(select 1 from pg_catalog.jsonb_array_elements(public.public_teammate_cards(null,100,null)) x,
  pg_catalog.jsonb_object_keys(x) k
  where k not in ('slug','name','avatar','accent','tier','online','game','rank','rating','games','languages','vibeTags','coaching','quote','gamerGirl')),
  'card field allowlist plus gamerGirl only');

-- ---- approval and settings ------------------------------------------------------------------------
select pg_temp.ok(public.teammate_public_approved('e1300000-0000-4000-8000-000000000001','social'),'Social is approved for a Gamer Girl');
select pg_temp.ok(not public.teammate_public_approved('e1300000-0000-4000-8000-000000000003','social'),'and not for anyone else');
select pg_temp.ok(not public.teammate_public_approved('e1300000-0000-4000-8000-000000000001','val'),'Gamer Girl access does not approve a competitive game');

set local role authenticated;
select pg_catalog.set_config('request.jwt.claims','{"sub":"e1300000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select pg_temp.ok(public.teammate_public_profile_get()->'approvedGames' = '["val","social"]'::jsonb,'settings offer Social to a Gamer Girl');
reset role;

-- ---- losing Gamer Girl access ----------------------------------------------------------------------
update public.teammate_order_access set gg_access=false where user_id='e1300000-0000-4000-8000-000000000001';
select pg_temp.ok(not (pg_temp.profile('e1300000-0000-4000-8000-000000000001')).published,'a Social-only page is unpublished when Gamer Girl access ends');
update public.teammate_public_profiles set featured_game='social' where user_id='e1300000-0000-4000-8000-000000000002';
update public.teammate_order_access set gg_access=false where user_id='e1300000-0000-4000-8000-000000000002';
select pg_temp.ok((pg_temp.profile('e1300000-0000-4000-8000-000000000002')).featured_game = 'val','a Social-featured page moves to her competitive game');

-- ---- grants ---------------------------------------------------------------------------------------
select pg_temp.ok(not has_function_privilege('anon','public.teammate_public_games(uuid)','execute'),'anon may not call the games helper');
select pg_temp.ok(not has_function_privilege('authenticated','public.teammate_public_games(uuid)','execute'),'authenticated may not call the games helper');
select pg_temp.ok(has_function_privilege('anon','public.public_teammate_profile(text)','execute'),'profiles still readable by anon');
select pg_temp.ok(public.public_teammate_cards(null,100,null)::text !~* '(example\.invalid|e1300000-0000)','no identifiers or emails exposed');

select 'gamer_girl_profiles: ' || pg_catalog.count(*) || ' checks passed' as result from pg_temp.assertions;
rollback;
