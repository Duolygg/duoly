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

-- Rollback-only checks for 20261024100000_admin_orders.sql.
begin;
insert into auth.users (id, aud, role, email, raw_user_meta_data, raw_app_meta_data) values
  ('ad100000-0000-4000-8000-000000000001','authenticated','authenticated','ord-admin@example.invalid','{}','{}'),
  ('ad100000-0000-4000-8000-000000000002','authenticated','authenticated','ord-cust@example.invalid','{}','{}');
update public.account_roles set role = 'admin' where user_id = 'ad100000-0000-4000-8000-000000000001';
insert into public.orders (id, customer_id, game, service, title, units, unit, region, ign, customer_name, amount_eur_cents, booking_fx, payout_usd_cents)
  values ('ad1a0000-0000-4000-8000-000000000001','ad100000-0000-4000-8000-000000000002','lol','duo2','Duo Pro',3,'game','EUW','Ord#EUW','Ord Cust',1617,1.08,1047);
set local role authenticated;
select pg_catalog.set_config('request.jwt.claims','{"role":"authenticated","sub":"ad100000-0000-4000-8000-000000000002"}',true);
select pg_catalog.set_config('request.jwt.claim.sub','ad100000-0000-4000-8000-000000000002',true);
do $$ begin
  if (public.admin_orders()->'error'->>'code')::int <> 403 then raise exception 'customer listed orders'; end if;
end $$;
select pg_catalog.set_config('request.jwt.claims','{"role":"authenticated","sub":"ad100000-0000-4000-8000-000000000001"}',true);
select pg_catalog.set_config('request.jwt.claim.sub','ad100000-0000-4000-8000-000000000001',true);
do $$ declare r jsonb; o jsonb; begin
  r := public.admin_orders(50);
  select x into o from pg_catalog.jsonb_array_elements(r->'orders') as x where x->>'orderId' = 'ad1a0000-0000-4000-8000-000000000001';
  if o is null or o->>'customer' <> 'Ord Cust' or (o->>'amountCents')::int <> 1617 or o->>'status' <> 'queued' or o->'payment' <> 'null'::jsonb
  then raise exception 'order row wrong: %', o; end if;
end $$;
reset role;
select 'admin_orders: all checks passed' as result;
rollback;
