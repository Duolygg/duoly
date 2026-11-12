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

-- Rollback-only checks for 20261024127000_admin_customers.sql.
begin;
insert into auth.users (id, aud, role, email, raw_user_meta_data, raw_app_meta_data) values
  ('ad400000-0000-4000-8000-000000000001','authenticated','authenticated','cu-admin@example.invalid','{}','{}'),
  ('ad400000-0000-4000-8000-000000000002','authenticated','authenticated','cu-cust@example.invalid','{}','{"provider":"google"}'),
  ('ad400000-0000-4000-8000-000000000003','authenticated','authenticated','cu-mate@example.invalid','{}','{}');
update public.profiles set name = 'Cust Two' where id = 'ad400000-0000-4000-8000-000000000002';
update public.account_roles set role = 'admin' where user_id = 'ad400000-0000-4000-8000-000000000001';
-- Current admin section model: this synthetic admin exercises all historical sections.
insert into public.admin_permissions(user_id, sections) values ('ad400000-0000-4000-8000-000000000001', public.admin_section_ids());
update public.account_roles set role = 'teammate' where user_id = 'ad400000-0000-4000-8000-000000000003';
insert into public.orders (id, customer_id, game, service, title, units, unit, region, ign, customer_name, amount_eur_cents, booking_fx, payout_usd_cents, status, cancelled_at, cancel_reason)
  values ('ad4a0000-0000-4000-8000-000000000001','ad400000-0000-4000-8000-000000000002','val','duo','Duo',1,'game','EU','C#EU','Cust Two',999,1.08,700,'cancelled',pg_catalog.clock_timestamp(),'queue_expired');

set local role authenticated;
select pg_catalog.set_config('request.jwt.claims','{"role":"authenticated","sub":"ad400000-0000-4000-8000-000000000002"}',true);
select pg_catalog.set_config('request.jwt.claim.sub','ad400000-0000-4000-8000-000000000002',true);
do $$ begin
  if (public.admin_customers()->'error'->>'code')::int <> 403 then raise exception 'customer listed customers'; end if;
  if (public.admin_set_blocked('ad400000-0000-4000-8000-000000000002', false, '')->'error'->>'code')::int <> 403 then raise exception 'self unblock'; end if;
end $$;
select pg_catalog.set_config('request.jwt.claims','{"role":"authenticated","sub":"ad400000-0000-4000-8000-000000000001"}',true);
select pg_catalog.set_config('request.jwt.claim.sub','ad400000-0000-4000-8000-000000000001',true);
do $$ declare c jsonb; begin
  select x into c from pg_catalog.jsonb_array_elements(public.admin_customers()->'customers') as x where x->>'id' = 'ad400000-0000-4000-8000-000000000002';
  -- The expired order was credited in full by the existing refund trigger; not counted as spent.
  if c is null or c->>'name' <> 'Cust Two' or c->>'provider' <> 'google' or (c->>'placed')::int <> 1
     or (c->>'spentCents')::int <> 0 or (c->>'walletCents')::int <> 999 or c->'blocked' <> 'null'::jsonb
  then raise exception 'customer row wrong: %', c; end if;
  if exists (select 1 from pg_catalog.jsonb_array_elements(public.admin_customers()->'customers') as x where x->>'id' = 'ad400000-0000-4000-8000-000000000003')
  then raise exception 'teammate listed as customer'; end if;
  if (public.admin_set_blocked('ad400000-0000-4000-8000-000000000002', true, '')->'error'->>'code')::int <> 400 then raise exception 'blocked without reason'; end if;
  if (public.admin_set_blocked('ad400000-0000-4000-8000-000000000003', true, 'xyz reason')->'error'->>'code')::int <> 409 then raise exception 'teammate blockable'; end if;
  perform public.admin_set_blocked('ad400000-0000-4000-8000-000000000002', true, 'Chargeback fraud');
  select x into c from pg_catalog.jsonb_array_elements(public.admin_customers()->'customers') as x where x->>'id' = 'ad400000-0000-4000-8000-000000000002';
  if c->'blocked'->>'reason' <> 'Chargeback fraud' then raise exception 'block not stored: %', c; end if;
  if (public.admin_audit(1)->'audit'->0->>'action') <> 'Blocked customer' then raise exception 'not audited'; end if;
  perform public.admin_set_blocked('ad400000-0000-4000-8000-000000000002', false, '');
  if (public.admin_audit(1)->'audit'->0->>'action') <> 'Unblocked customer' then raise exception 'unblock not audited'; end if;
end $$;
reset role;
do $$ begin
  if exists (select 1 from public.customer_blocks where user_id = 'ad400000-0000-4000-8000-000000000002') then raise exception 'unblock left row'; end if;
end $$;
select 'admin_customers: all checks passed' as result;
rollback;
