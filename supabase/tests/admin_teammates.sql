-- Rollback-only checks for 20261024125000_admin_teammates.sql.
begin;
insert into auth.users (id, aud, role, email, raw_user_meta_data, raw_app_meta_data) values
  ('ad300000-0000-4000-8000-000000000001','authenticated','authenticated','tm-admin@example.invalid','{}','{}'),
  ('ad300000-0000-4000-8000-000000000002','authenticated','authenticated','tm-mate@example.invalid','{}','{}'),
  ('ad300000-0000-4000-8000-000000000003','authenticated','authenticated','tm-cust@example.invalid','{}','{}');
update public.profiles set name = 'Mate Two' where id = 'ad300000-0000-4000-8000-000000000002';
update public.account_roles set role = 'admin' where user_id = 'ad300000-0000-4000-8000-000000000001';
update public.account_roles set role = 'teammate' where user_id = 'ad300000-0000-4000-8000-000000000002';
insert into public.teammate_order_access(user_id, approved_games) values ('ad300000-0000-4000-8000-000000000002', array['val']);

set local role authenticated;
select pg_catalog.set_config('request.jwt.claims','{"role":"authenticated","sub":"ad300000-0000-4000-8000-000000000003"}',true);
select pg_catalog.set_config('request.jwt.claim.sub','ad300000-0000-4000-8000-000000000003',true);
do $$ begin
  if (public.admin_teammates()->'error'->>'code')::int <> 403 then raise exception 'customer read roster'; end if;
  if (public.admin_set_suspended('ad300000-0000-4000-8000-000000000002', true, 'nope')->'error'->>'code')::int <> 403 then raise exception 'customer suspended'; end if;
end $$;
select pg_catalog.set_config('request.jwt.claims','{"role":"authenticated","sub":"ad300000-0000-4000-8000-000000000001"}',true);
select pg_catalog.set_config('request.jwt.claim.sub','ad300000-0000-4000-8000-000000000001',true);
do $$ declare r jsonb; t jsonb; begin
  r := public.admin_teammates();
  select x into t from pg_catalog.jsonb_array_elements(r->'teammates') as x where x->>'id' = 'ad300000-0000-4000-8000-000000000002';
  if t is null or t->>'name' <> 'Mate Two' or t->'games' <> '["val"]'::jsonb or t->'suspended' <> 'null'::jsonb then raise exception 'roster row wrong: %', t; end if;
  if (public.admin_set_suspended('ad300000-0000-4000-8000-000000000002', true, '')->'error'->>'code')::int <> 400 then raise exception 'suspended without reason'; end if;
  if (public.admin_set_suspended('ad300000-0000-4000-8000-000000000003', true, 'x reason')->'error'->>'code')::int <> 409 then raise exception 'customer suspendable'; end if;
  r := public.admin_set_suspended('ad300000-0000-4000-8000-000000000002', true, 'Toxic in chat');
  if not (r ? 'ok') then raise exception 'suspend failed: %', r; end if;
  select x into t from pg_catalog.jsonb_array_elements(public.admin_teammates()->'teammates') as x where x->>'id' = 'ad300000-0000-4000-8000-000000000002';
  if t->'suspended'->>'reason' <> 'Toxic in chat' then raise exception 'reason not stored: %', t; end if;
  if (public.admin_audit(1)->'audit'->0->>'action') <> 'Suspended teammate' then raise exception 'not audited'; end if;
  r := public.admin_set_suspended('ad300000-0000-4000-8000-000000000002', false, '');
  if (public.admin_audit(1)->'audit'->0->>'action') <> 'Reinstated teammate' then raise exception 'reinstate not audited'; end if;
end $$;
reset role;
do $$ begin
  if (select suspended or suspended_reason <> '' or suspended_at is not null from public.teammate_order_access where user_id = 'ad300000-0000-4000-8000-000000000002')
  then raise exception 'reinstate left state'; end if;
end $$;
-- Mid-order suspension is refused.
insert into public.orders (id, customer_id, game, service, title, units, unit, region, ign, customer_name, amount_eur_cents, booking_fx, payout_usd_cents)
  values ('ad3a0000-0000-4000-8000-000000000001','ad300000-0000-4000-8000-000000000003','val','duo','Duo',1,'game','EU','C#EU','Cust',999,1.08,700);
insert into public.order_assignments (id, order_id, teammate_id, accepted_at)
  values ('ad3b0000-0000-4000-8000-000000000001','ad3a0000-0000-4000-8000-000000000001','ad300000-0000-4000-8000-000000000002', pg_catalog.clock_timestamp());
update public.orders set status = 'in_progress', assigned_teammate_id = 'ad300000-0000-4000-8000-000000000002',
  current_assignment_id = 'ad3b0000-0000-4000-8000-000000000001', accepted_at = pg_catalog.clock_timestamp()
  where id = 'ad3a0000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_catalog.set_config('request.jwt.claims','{"role":"authenticated","sub":"ad300000-0000-4000-8000-000000000001"}',true);
select pg_catalog.set_config('request.jwt.claim.sub','ad300000-0000-4000-8000-000000000001',true);
do $$ begin
  if (public.admin_set_suspended('ad300000-0000-4000-8000-000000000002', true, 'mid order')->'error'->>'code')::int <> 409 then raise exception 'suspended mid-order'; end if;
end $$;
reset role;
select 'admin_teammates: all checks passed' as result;
rollback;
