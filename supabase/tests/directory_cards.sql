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

-- 20261114120000_directory_cards.sql: public_teammate_cards() passes the directory the games,
-- languages, vibe tags, coaching flag and newest review quote the profile page already shows, and
-- customer_favorite_slugs() hands a signed-in customer the public slugs of their saved teammates.

begin;
create temp table assertions(label text);
create function pg_temp.ok(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'directory cards: %', label; end if;
  insert into pg_temp.assertions values(label);
end $$;
create function pg_temp.card(p_slug text) returns jsonb language sql as $$
  select x from pg_catalog.jsonb_array_elements(public.public_teammate_cards(null, 100, null)) x
  where x->>'slug' = p_slug;
$$;

insert into auth.users(id,aud,role,email,raw_user_meta_data,raw_app_meta_data) values
 ('d1200000-0000-4000-8000-000000000001','authenticated','authenticated','dc-shown@example.invalid','{}','{}'),
 ('d1200000-0000-4000-8000-000000000002','authenticated','authenticated','dc-hidden@example.invalid','{}','{}'),
 ('d1200000-0000-4000-8000-000000000003','authenticated','authenticated','dc-customer@example.invalid','{}','{}'),
 ('d1200000-0000-4000-8000-000000000004','authenticated','authenticated','dc-other@example.invalid','{}','{}');
update public.account_roles set role='teammate'
 where user_id in ('d1200000-0000-4000-8000-000000000001','d1200000-0000-4000-8000-000000000002');

alter table public.teammate_order_access disable trigger teammate_public_profile_access_changed;
insert into public.teammate_order_access(user_id,approved_games,enabled_games) values
 ('d1200000-0000-4000-8000-000000000001',array['val','lol'],array['val','lol']),
 ('d1200000-0000-4000-8000-000000000002',array['val'],array['val']);
insert into public.teammate_public_profiles(user_id,slug,published,published_at,featured_game,vibe_tags,coaching) values
 ('d1200000-0000-4000-8000-000000000001','shown-sam',true,pg_catalog.clock_timestamp(),'val',array['Chill','Shotcaller'],true),
 ('d1200000-0000-4000-8000-000000000002','hidden-hal',true,pg_catalog.clock_timestamp(),'val','{}',false);
update public.teammate_public_profiles set admin_hidden=true, admin_hidden_reason='test'
 where user_id='d1200000-0000-4000-8000-000000000002';
alter table public.teammate_order_access enable trigger teammate_public_profile_access_changed;

-- ---- the new card fields ------------------------------------------------------------------------
select pg_temp.ok(pg_temp.card('shown-sam') is not null,'a published profile is a card');
select pg_temp.ok(pg_temp.card('hidden-hal') is null,'an admin-hidden profile is no card');
select pg_temp.ok(pg_catalog.jsonb_typeof(pg_temp.card('shown-sam')->'games') = 'array'
  and pg_temp.card('shown-sam')->'games' @> '["val"]'::jsonb,'games lists the featured game');
select pg_temp.ok(pg_temp.card('shown-sam')->'games'
  = (select pg_catalog.jsonb_agg(x->'game') from pg_catalog.jsonb_array_elements(public.public_teammate_profile('shown-sam')->'games') x),
  'games are exactly the profile''s games, in the profile''s order');
select pg_temp.ok(pg_temp.card('shown-sam')->'vibeTags' = '["Chill","Shotcaller"]'::jsonb,'vibe tags passed through');
select pg_temp.ok(pg_temp.card('shown-sam')->'coaching' = 'true'::jsonb,'coaching flag passed through');
select pg_temp.ok(pg_temp.card('shown-sam')->'languages' = public.public_teammate_profile('shown-sam')->'languages'
  and pg_catalog.jsonb_typeof(pg_temp.card('shown-sam')->'languages') = 'array','languages are the profile''s own');
select pg_temp.ok(pg_temp.card('shown-sam')->'quote' = 'null'::jsonb,'no written review means no quote, never an invented one');

-- ---- nothing that was there before moved -------------------------------------------------------
select pg_temp.ok(not exists(select 1 from pg_catalog.jsonb_array_elements(public.public_teammate_cards(null,100,null)) x,
  pg_catalog.jsonb_object_keys(x) k
  where k not in ('slug','name','avatar','accent','tier','online','game','rank','rating','games','languages','vibeTags','coaching','quote','gamerGirl')),
  'field allowlist: the old nine, the five directory fields and gamerGirl (20261114130000)');
select pg_temp.ok(pg_temp.card('shown-sam')->>'game' = 'val','the card still shows the featured game');
select pg_temp.ok(pg_catalog.jsonb_array_length(public.public_teammate_cards(null,1,null)) <= 1,'the limit still holds');
select pg_temp.ok(public.public_teammate_cards(null,100,null)::text !~* '(example\.invalid|d1200000-0000)','no identifiers or emails exposed');

-- ---- saved teammates --------------------------------------------------------------------------
insert into public.customer_favorites(customer_id,teammate_id) values
 ('d1200000-0000-4000-8000-000000000003','d1200000-0000-4000-8000-000000000001'),
 ('d1200000-0000-4000-8000-000000000003','d1200000-0000-4000-8000-000000000002');

grant insert on assertions to authenticated;
set local role authenticated;
select pg_catalog.set_config('request.jwt.claims','{"sub":"d1200000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select pg_temp.ok(public.customer_favorite_slugs() = '["shown-sam"]'::jsonb,'a customer sees the slugs of saved teammates with an open page only');
select pg_catalog.set_config('request.jwt.claims','{"sub":"d1200000-0000-4000-8000-000000000004","role":"authenticated"}',true);
select pg_temp.ok(public.customer_favorite_slugs() = '[]'::jsonb,'another customer sees nothing of it');
select pg_catalog.set_config('request.jwt.claims','{"sub":"d1200000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select pg_temp.ok(public.customer_favorite_slugs() = '[]'::jsonb,'a teammate gets an empty list');
reset role;

set local role anon;
select pg_catalog.set_config('request.jwt.claims','{"role":"anon"}',true);
do $$ begin
  perform public.customer_favorite_slugs();
  raise exception 'anon executed customer_favorite_slugs';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  if not exists(select 1 from pg_catalog.jsonb_array_elements(public.public_teammate_cards(null,100,null)) x
    where x->>'slug' = 'shown-sam' and x ? 'vibeTags') then
    raise exception 'anon does not read the new card fields';
  end if;
end $$;
reset role;

select pg_temp.ok(has_function_privilege('authenticated','public.customer_favorite_slugs()','execute'),'authenticated may execute');
select pg_temp.ok(not has_function_privilege('anon','public.customer_favorite_slugs()','execute'),'anon may not execute');
select pg_temp.ok(not has_function_privilege('public','public.customer_favorite_slugs()','execute'),'PUBLIC may not execute');
select pg_temp.ok(not has_function_privilege('service_role','public.customer_favorite_slugs()','execute'),'service_role may not execute');
select pg_temp.ok((select prosecdef from pg_catalog.pg_proc where oid='public.customer_favorite_slugs()'::regprocedure),'security definer');
select pg_temp.ok((select proconfig from pg_catalog.pg_proc where oid='public.customer_favorite_slugs()'::regprocedure) = array['search_path=""']::text[],'empty search_path');
select pg_temp.ok(has_function_privilege('anon','public.public_teammate_cards(text,integer,text)','execute'),'cards still readable by anon');
select pg_temp.ok((select proconfig from pg_catalog.pg_proc where oid='public.public_teammate_cards(text,integer,text)'::regprocedure) = array['search_path=""']::text[],'cards keep an empty search_path');

select 'directory_cards: ' || pg_catalog.count(*) || ' checks passed' as result from pg_temp.assertions;
rollback;
