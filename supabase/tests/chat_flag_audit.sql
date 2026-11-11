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

-- Rollback-only check for 20261024120000_chat_flag_audit.sql.
begin;
insert into auth.users (id, aud, role, email, raw_user_meta_data, raw_app_meta_data) values
  ('ad200000-0000-4000-8000-000000000001','authenticated','authenticated','flag-admin@example.invalid','{}','{}'),
  ('ad200000-0000-4000-8000-000000000002','authenticated','authenticated','flag-cust@example.invalid','{}','{}'),
  ('ad200000-0000-4000-8000-000000000003','authenticated','authenticated','flag-mate@example.invalid','{}','{}');
update public.profiles set name = 'Flag Admin' where id = 'ad200000-0000-4000-8000-000000000001';
update public.account_roles set role = 'admin' where user_id = 'ad200000-0000-4000-8000-000000000001';
insert into public.orders (id, customer_id, game, service, title, units, unit, region, ign, customer_name, amount_eur_cents, booking_fx, payout_usd_cents)
  values ('ad2a0000-0000-4000-8000-000000000001','ad200000-0000-4000-8000-000000000002','val','duo','Duo',1,'game','EU','F#EU','Flag Cust',999,1.08,700);
insert into public.order_assignments (id, order_id, teammate_id, accepted_at)
  values ('ad2b0000-0000-4000-8000-000000000001','ad2a0000-0000-4000-8000-000000000001','ad200000-0000-4000-8000-000000000003', pg_catalog.clock_timestamp());
insert into public.order_chat_rooms (assignment_id, order_id) values ('ad2b0000-0000-4000-8000-000000000001','ad2a0000-0000-4000-8000-000000000001') on conflict do nothing;
insert into public.order_chat_flags (id, order_id, assignment_id, actor_id, sender_name, body, rule)
  values ('ad2c0000-0000-4000-8000-000000000001','ad2a0000-0000-4000-8000-000000000001','ad2b0000-0000-4000-8000-000000000001',
          'ad200000-0000-4000-8000-000000000002','Flag Cust','add me on whatsapp please','Moving off Duoly');
update public.order_chat_flags set status = 'warned', reviewed_by = 'ad200000-0000-4000-8000-000000000001', reviewed_at = pg_catalog.clock_timestamp()
  where id = 'ad2c0000-0000-4000-8000-000000000001';
do $$ declare l public.admin_audit_log; begin
  select * into l from public.admin_audit_log order by id desc limit 1;
  if l.action <> 'Warned user' or l.actor_name <> 'Flag Admin' or l.target <> 'Flag Cust' or l.detail not like 'Moving off Duoly · “add me on whatsapp%'
  then raise exception 'audit row wrong: % % % %', l.action, l.actor_name, l.target, l.detail; end if;
end $$;
select 'chat_flag_audit: all checks passed' as result;
rollback;
