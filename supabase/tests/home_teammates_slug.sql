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

-- 20261112170000_home_teammates_profile_slug.sql: home_teammates() carries the public profile slug
-- for the cards whose profile a visitor could open, and null for every other card. Everything the
-- function exposed before is unchanged.

begin;
create temp table assertions(label text);
create function pg_temp.ok(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'home teammates slug: %', label; end if;
  insert into pg_temp.assertions values(label);
end $$;
create function pg_temp.card(p_name text) returns jsonb language sql as $$
  select x from pg_catalog.jsonb_array_elements(public.home_teammates()) x where x->>'name' = p_name;
$$;

insert into auth.users(id,aud,role,email,raw_user_meta_data,raw_app_meta_data) values
 ('c1100000-0000-4000-8000-000000000001','authenticated','authenticated','tc-public@example.invalid','{}','{}'),
 ('c1100000-0000-4000-8000-000000000002','authenticated','authenticated','tc-unpublished@example.invalid','{}','{}'),
 ('c1100000-0000-4000-8000-000000000003','authenticated','authenticated','tc-hidden@example.invalid','{}','{}'),
 ('c1100000-0000-4000-8000-000000000004','authenticated','authenticated','tc-dropped@example.invalid','{}','{}'),
 ('c1100000-0000-4000-8000-000000000005','authenticated','authenticated','tc-nopage@example.invalid','{}','{}'),
 ('c1100000-0000-4000-8000-000000000006','authenticated','authenticated','tc-suspended@example.invalid','{}','{}');
update public.account_roles set role='teammate' where user_id::text like 'c1100000%';
update public.profiles set name='Linkedpat' where id='c1100000-0000-4000-8000-000000000001';
update public.profiles set name='Draftdana' where id='c1100000-0000-4000-8000-000000000002';
update public.profiles set name='Hiddenhana' where id='c1100000-0000-4000-8000-000000000003';
update public.profiles set name='Droppeddev' where id='c1100000-0000-4000-8000-000000000004';
update public.profiles set name='Pagelesspim' where id='c1100000-0000-4000-8000-000000000005';
update public.profiles set name='Suspendedsam' where id='c1100000-0000-4000-8000-000000000006';

-- The access trigger would hand every one of these teammates a published page. Each case below
-- states its own profile row instead, so what the slug depends on is visible in this file.
alter table public.teammate_order_access disable trigger teammate_public_profile_access_changed;
insert into public.teammate_order_access(user_id,approved_games,enabled_games) values
 ('c1100000-0000-4000-8000-000000000001',array['val','lol'],array['val','lol']),
 ('c1100000-0000-4000-8000-000000000002',array['val'],array['val']),
 ('c1100000-0000-4000-8000-000000000003',array['val'],array['val']),
 ('c1100000-0000-4000-8000-000000000004',array['val'],array['val']),
 ('c1100000-0000-4000-8000-000000000005',array['val'],array['val']),
 ('c1100000-0000-4000-8000-000000000006',array['val'],array['val']);
update public.teammate_order_access set suspended=true where user_id='c1100000-0000-4000-8000-000000000006';

insert into public.teammate_public_profiles(user_id,slug,published,published_at,featured_game) values
 ('c1100000-0000-4000-8000-000000000001','published-pat',true,pg_catalog.clock_timestamp(),'val'),
 ('c1100000-0000-4000-8000-000000000002','draft-dana',false,null,'val'),
 ('c1100000-0000-4000-8000-000000000003','hidden-hana',true,pg_catalog.clock_timestamp(),'val'),
 ('c1100000-0000-4000-8000-000000000004','dropped-dev',true,pg_catalog.clock_timestamp(),'val');
update public.teammate_public_profiles set admin_hidden=true, admin_hidden_reason='test'
 where user_id='c1100000-0000-4000-8000-000000000003';
-- Droppeddev keeps a page featuring a game they are no longer approved for: a visitor opening it
-- gets 410, so the card must not link to it.
update public.teammate_order_access set approved_games=array['lol'], enabled_games=array['lol']
 where user_id='c1100000-0000-4000-8000-000000000004';
alter table public.teammate_order_access enable trigger teammate_public_profile_access_changed;

-- ---- the slug a card carries ---------------------------------------------------------------
select pg_temp.ok(pg_temp.card('Linkedpat')->>'slug' = 'published-pat','public profile links from its card');
select pg_temp.ok(pg_temp.card('Draftdana')->'slug' = 'null'::jsonb,'unpublished profile sends no link');
select pg_temp.ok(pg_temp.card('Hiddenhana')->'slug' = 'null'::jsonb,'admin-hidden profile sends no link');
select pg_temp.ok(pg_temp.card('Droppeddev')->'slug' = 'null'::jsonb,'profile featuring an unapproved game sends no link');
select pg_temp.ok(pg_temp.card('Pagelesspim')->'slug' = 'null'::jsonb,'teammate without a page sends no link');
select pg_temp.ok(pg_temp.card('Pagelesspim') is not null,'a teammate without a page is still a card');
select pg_temp.ok(pg_temp.card('Suspendedsam') is null,'suspended teammate is not a card at all');

-- The same four tests public_teammate_profile() applies: a card links only where that read
-- function would return the profile rather than a status.
select pg_temp.ok(public.public_teammate_profile('published-pat') ? 'slug','the linked page is the one the read function serves');
select pg_temp.ok(public.public_teammate_profile('draft-dana')->>'status' = 'gone','unpublished page answers gone');
select pg_temp.ok(public.public_teammate_profile('hidden-hana')->>'status' = 'gone','hidden page answers gone');
select pg_temp.ok(public.public_teammate_profile('dropped-dev')->>'status' = 'gone','unapproved featured game answers gone');

-- ---- nothing else about the function changed ------------------------------------------------
select pg_temp.ok(not exists(select 1 from pg_catalog.jsonb_array_elements(public.home_teammates()) x,
  pg_catalog.jsonb_object_keys(x) k
  where k not in ('name','image','games','gg','online','rating','reviews','sessions','slug')),'field allowlist plus slug only');
select pg_temp.ok(not exists(select 1 from pg_catalog.jsonb_array_elements(public.home_teammates()) x
  where (select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(x) k) <> 9),'all nine fields on every card');
select pg_temp.ok(pg_catalog.jsonb_typeof(public.home_teammates()) = 'array'
  and pg_catalog.jsonb_array_length(public.home_teammates()) <= 24,'still a bounded array');
select pg_temp.ok(pg_temp.card('Linkedpat')->>'image' = '/assets/avatars/avatar-1.png','image unchanged');
-- Demand order, not the order the games were approved in: lol leads val in the canonical list.
select pg_temp.ok(pg_temp.card('Linkedpat')->'games' = '["lol","val"]'::jsonb,'games unchanged and in demand order');
select pg_temp.ok(pg_temp.card('Linkedpat')->'rating' = 'null'::jsonb
  and (pg_temp.card('Linkedpat')->>'reviews')::int = 0
  and (pg_temp.card('Linkedpat')->>'sessions')::int = 0,'counts unchanged and never invented');
select pg_temp.ok(public.home_teammates()::text !~* '(example\.invalid|c1100000-0000)','no identifiers or emails exposed');

-- ---- anon reads it, the grant is the old one -------------------------------------------------
set local role anon;
select pg_catalog.set_config('request.jwt.claims','{"role":"anon"}',true);
do $$ begin
  if (select public.home_teammates()) is null then raise exception 'anon cannot read home_teammates'; end if;
  if not exists(select 1 from pg_catalog.jsonb_array_elements(public.home_teammates()) x
    where x->>'name' = 'Linkedpat' and x->>'slug' = 'published-pat') then
    raise exception 'anon does not see the profile link';
  end if;
end $$;
do $$ begin
  perform 1 from public.teammate_public_profiles;
  raise exception 'anon read teammate_public_profiles directly';
exception when insufficient_privilege then null;
end $$;
reset role;

select pg_temp.ok(has_function_privilege('anon','public.home_teammates()','execute'),'anon may execute');
select pg_temp.ok(has_function_privilege('authenticated','public.home_teammates()','execute'),'authenticated may execute');
select pg_temp.ok(not has_function_privilege('public','public.home_teammates()','execute'),'PUBLIC may not execute');
select pg_temp.ok(not has_function_privilege('service_role','public.home_teammates()','execute'),'service_role may not execute');
select pg_temp.ok((select prosecdef from pg_catalog.pg_proc where oid='public.home_teammates()'::regprocedure),'still security definer');
select pg_temp.ok((select provolatile from pg_catalog.pg_proc where oid='public.home_teammates()'::regprocedure) = 's','still stable');
-- Postgres stores `set search_path = ''` quoted, the same spelling order_proofs.sql checks for.
select pg_temp.ok((select proconfig from pg_catalog.pg_proc where oid='public.home_teammates()'::regprocedure) = array['search_path=""']::text[],'still an empty search_path');

select 'home_teammates_slug: ' || pg_catalog.count(*) || ' checks passed' as result from pg_temp.assertions;
rollback;
