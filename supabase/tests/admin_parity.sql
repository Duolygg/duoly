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

do $$
begin
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='support_conversations' and column_name='discord_message_id') then raise exception 'Discord support message column missing'; end if;
  if to_regprocedure('public.admin_orders_page(integer,integer)') is null then raise exception 'orders paging RPC missing'; end if;
  if to_regprocedure('public.admin_applications_page(integer,integer)') is null then raise exception 'applications paging RPC missing'; end if;
  if to_regprocedure('public.admin_overview()') is null then raise exception 'overview RPC missing'; end if;
  if position('country' in pg_get_functiondef(to_regprocedure('public.teammate_leaderboard(timestamp with time zone)'))) = 0 then raise exception 'leaderboard country missing'; end if;
  if position('depositHeldUsdCents' in pg_get_functiondef(to_regprocedure('public.admin_teammates()'))) = 0 then raise exception 'teammate deposit missing'; end if;
  if position('wallet' in pg_get_functiondef(to_regprocedure('public.admin_support_inbox(uuid)'))) = 0 then raise exception 'support account context missing'; end if;
  if has_function_privilege('anon','public.admin_orders_page(integer,integer)','execute') then raise exception 'anon can page admin orders'; end if;
end $$;

-- Execute every changed RPC as an existing admin so runtime errors surface (all inside the rollback).
do $$
declare v_admin uuid; v jsonb; v_chat uuid;
begin
  perform public.teammate_leaderboard(pg_catalog.now());
  select user_id into v_admin from public.account_roles where role='admin' limit 1;
  if v_admin is null then raise notice 'no admin account, skipping RPC execution'; return; end if;
  perform set_config('request.jwt.claims', pg_catalog.jsonb_build_object('sub',v_admin,'role','authenticated')::text, true);
  v := public.admin_teammates(); if v ? 'error' then raise exception 'admin_teammates: %', v; end if;
  v := public.admin_orders_page(5,0); if v ? 'error' or not v ? 'total' then raise exception 'admin_orders_page: %', v; end if;
  v := public.admin_applications_page(5,0); if v ? 'error' or not v ? 'total' then raise exception 'admin_applications_page: %', v; end if;
  v := public.admin_orders_page(9999,0); if not v ? 'error' then raise exception 'oversized page accepted'; end if;
  v := public.admin_overview(); if v ? 'error' or not v ? 'payoutsDueUsdCents' then raise exception 'admin_overview: %', v; end if;
  select id into v_chat from public.support_conversations order by updated_at desc limit 1;
  v := public.admin_support_inbox(v_chat); if v ? 'error' then raise exception 'admin_support_inbox: %', v; end if;
end $$;
select 'admin parity rollback test ok' as result;
