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

-- 20261115140000_plus_only_per_game.sql: Plus only is set per game. In a Plus only game a teammate
-- takes Duo Plus only; in their other approved games they are Standard. The admin setter keeps
-- approved games only, in canonical order, and needs the Users section.
-- Fixtures: A admin, T teammate (lol + val approved), C customer.

begin;
create function pg_temp.ok(ok boolean, label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'plus only per game: %', label; end if; end $$;
create function pg_temp.login(actor uuid) returns void language plpgsql as $$
begin
  perform pg_catalog.set_config('request.jwt.claim.sub', actor::text, true);
  perform pg_catalog.set_config('request.jwt.claims',
    pg_catalog.jsonb_build_object('role', 'authenticated', 'sub', actor)::text, true);
end $$;

insert into auth.users(id,aud,role,email,raw_user_meta_data,raw_app_meta_data) values
 ('9b150000-0000-4000-8000-0000000000a0','authenticated','authenticated','po-a@example.invalid','{}','{}'),
 ('9b150000-0000-4000-8000-000000000051','authenticated','authenticated','po-t@example.invalid','{}','{}'),
 ('9b150000-0000-4000-8000-0000000000c1','authenticated','authenticated','po-c@example.invalid','{}','{}');
update public.account_roles set role='admin' where user_id='9b150000-0000-4000-8000-0000000000a0';
update public.account_roles set role='teammate' where user_id='9b150000-0000-4000-8000-000000000051';
insert into public.teammate_order_access(user_id,approved_games,enabled_games,discord_id,discord_verified_at) values
 ('9b150000-0000-4000-8000-000000000051',array['lol','val'],array['lol','val'],'915000000000000051',pg_catalog.now());

-- ---- the old single level is gone ---------------------------------------------------------------
select pg_temp.ok(not exists (select 1 from information_schema.columns
  where table_schema='public' and table_name='teammate_order_access' and column_name='duo_level'),'duo_level dropped');
select pg_temp.ok((select plus_only_games from public.teammate_order_access
  where user_id='9b150000-0000-4000-8000-000000000051') = '{}'::text[],'new teammates are Standard everywhere');

-- ---- admin ----------------------------------------------------------------------------------------
select pg_temp.login('9b150000-0000-4000-8000-000000000051');
select pg_temp.ok((public.admin_set_plus_only_games('9b150000-0000-4000-8000-000000000051',array['lol'])#>>'{error,code}')='403','teammates cannot set it');
select pg_temp.ok((public.admin_duo_levels()#>>'{error,code}')='403','teammates cannot read it');

select pg_temp.login('9b150000-0000-4000-8000-0000000000a0');
select pg_temp.ok(public.admin_set_plus_only_games('9b150000-0000-4000-8000-000000000051',array['val','cs2','lol'])->'plusOnly'
  = '["lol","val"]'::jsonb,'keeps approved games only, in canonical order');
select pg_temp.ok((public.admin_set_plus_only_games('9b150000-0000-4000-8000-0000000000c1',array['lol'])#>>'{error,code}')='409','customers have no level');
select pg_temp.ok(public.admin_set_plus_only_games('9b150000-0000-4000-8000-000000000051',array['lol'])->'plusOnly'
  = '["lol"]'::jsonb,'Plus only in League only');
select pg_temp.ok(public.admin_duo_levels()#>'{plusOnly,9b150000-0000-4000-8000-000000000051}' = '["lol"]'::jsonb,'the list reads back');

-- ---- the tier rule, per game ----------------------------------------------------------------------
do $$
declare a public.teammate_order_access; o public.orders; queued timestamptz := pg_catalog.clock_timestamp();
begin
  select * into a from public.teammate_order_access where user_id='9b150000-0000-4000-8000-000000000051';
  o.id := '9b150000-0000-4000-8000-0000000000e1'; o.customer_id := '9b150000-0000-4000-8000-0000000000c1';
  o.queued_at := queued; o.gg := false;

  o.game := 'lol'; o.service := 'duo1';
  perform pg_temp.ok(public.order_tier_open_at(o, a) = queued, 'Plus only game: Duo Plus open');
  o.service := 'duo2';
  perform pg_temp.ok(public.order_tier_open_at(o, a) is null, 'Plus only game: Duo Pro never');
  o.service := 'vod';
  perform pg_temp.ok(public.order_tier_open_at(o, a) is null, 'Plus only game: other services never');

  o.game := 'val'; o.service := 'duo2';
  perform pg_temp.ok(public.order_tier_open_at(o, a) = queued, 'other game: Standard takes Duo Pro');
  o.service := 'vod';
  perform pg_temp.ok(public.order_tier_open_at(o, a) = queued, 'other game: Standard takes other services');

  o.game := 'lol'; o.service := 'chat'; o.gg := true;
  perform pg_temp.ok(public.order_tier_open_at(o, a) = queued, 'Gamer Girl orders are not tiered');
end $$;

-- clearing the list makes them Standard everywhere
select pg_temp.ok(public.admin_set_plus_only_games('9b150000-0000-4000-8000-000000000051','{}')->'plusOnly' = '[]'::jsonb,'clearing works');
do $$
declare a public.teammate_order_access; o public.orders; queued timestamptz := pg_catalog.clock_timestamp();
begin
  select * into a from public.teammate_order_access where user_id='9b150000-0000-4000-8000-000000000051';
  o.id := '9b150000-0000-4000-8000-0000000000e2'; o.customer_id := '9b150000-0000-4000-8000-0000000000c1';
  o.queued_at := queued; o.gg := false; o.game := 'lol'; o.service := 'duo2';
  perform pg_temp.ok(public.order_tier_open_at(o, a) = queued, 'cleared: Duo Pro open again');
end $$;

select 'plus only per game ok' as result;
rollback;
