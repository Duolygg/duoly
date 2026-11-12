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

-- Rollback-only checks for 20261024090000_admin_foundation.sql.
begin;
do $$ begin
  if exists (select 1 from auth.users where id::text like 'ad000000-0000-4000-8000-00000000000%')
  then raise exception 'Fixture collision'; end if;
end $$;
-- 1 owner/admin, 2 second admin, 3 customer, 4 teammate (busy), 5 applicant customer
insert into auth.users (id, aud, role, email, raw_user_meta_data, raw_app_meta_data) values
  ('ad000000-0000-4000-8000-000000000001','authenticated','authenticated','owner@example.invalid','{}','{"provider":"email"}'),
  ('ad000000-0000-4000-8000-000000000002','authenticated','authenticated','admin2@example.invalid','{}','{"provider":"email"}'),
  ('ad000000-0000-4000-8000-000000000003','authenticated','authenticated','cust@example.invalid','{}','{"provider":"discord"}'),
  ('ad000000-0000-4000-8000-000000000004','authenticated','authenticated','mate@example.invalid','{}','{"provider":"google"}'),
  ('ad000000-0000-4000-8000-000000000005','authenticated','authenticated','applicant@example.invalid','{}','{"provider":"email"}');
update public.profiles set name = 'Owner One' where id = 'ad000000-0000-4000-8000-000000000001';
update public.profiles set name = 'Cust Three' where id = 'ad000000-0000-4000-8000-000000000003';

-- Service role mirrors ADMIN_EMAILS.
select public.sync_account_owner('ad000000-0000-4000-8000-000000000001', true);
do $$ begin
  if (select role || owner::text from public.account_roles where user_id = 'ad000000-0000-4000-8000-000000000001') <> 'admintrue'
  then raise exception 'owner sync failed'; end if;
  if (select pg_catalog.count(*) from public.admin_audit_log where action = 'Owner added' and target = 'owner@example.invalid') <> 1
  then raise exception 'owner sync not audited'; end if;
end $$;

-- Anonymous and customers are refused; nothing grants raw table access.
set local role anon;
select pg_catalog.set_config('request.jwt.claims','{}',true);
select pg_catalog.set_config('request.jwt.claim.sub','',true);
do $$ begin
  begin perform public.admin_accounts(); raise exception 'anon could call admin_accounts';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.teammate_applications; raise exception 'anon read applications';
  exception when insufficient_privilege then null; end;
  begin perform public.sync_account_owner('ad000000-0000-4000-8000-000000000003', true); raise exception 'anon owner sync';
  exception when insufficient_privilege then null; end;
end $$;

-- Anonymous application from /apply.
do $$ declare r jsonb; begin
  r := public.submit_teammate_application('Appli Cant','Applicant@Example.invalid','appli#1','Austria','val','Immortal 1','EU','Duelist','', '10–20','gg', array['Duo']);
  if not (r ? 'application') then raise exception 'submit failed: %', r; end if;
  r := public.submit_teammate_application('Appli Cant','applicant@example.invalid','appli#1','Austria','val','Immortal 1','EU','','', '10–20','', array['Duo']);
  if (r->'error'->>'code')::int <> 409 then raise exception 'duplicate pending allowed: %', r; end if;
  r := public.submit_teammate_application('X','x@example.invalid','x','','val','r','EU','','', '10–20','', array['Duo']);
  if (r->'error'->>'code')::int <> 400 then raise exception 'short name accepted: %', r; end if;
  r := public.submit_teammate_application('Nope Nope','nope@example.invalid','nope','','val','r','EU','','', '99','', array['Duo']);
  if (r->'error'->>'code')::int <> 400 then raise exception 'bad hours accepted: %', r; end if;
  r := public.submit_teammate_application('Nope Nope','nope@example.invalid','nope','','val','r','EU','','', '10–20','', array['Hacker']);
  if (r->'error'->>'code')::int <> 400 then raise exception 'bad service accepted: %', r; end if;
end $$;
reset role;

set local role authenticated;
select pg_catalog.set_config('request.jwt.claims','{"role":"authenticated","sub":"ad000000-0000-4000-8000-000000000003"}',true);
select pg_catalog.set_config('request.jwt.claim.sub','ad000000-0000-4000-8000-000000000003',true);
do $$ declare r jsonb; begin
  r := public.admin_accounts();
  if (r->'error'->>'code')::int <> 403 then raise exception 'customer listed accounts'; end if;
  r := public.admin_set_role('ad000000-0000-4000-8000-000000000003','admin');
  if (r->'error'->>'code')::int <> 403 then raise exception 'customer self-promoted'; end if;
  r := public.admin_audit(10);
  if (r->'error'->>'code')::int <> 403 then raise exception 'customer read audit'; end if;
  r := public.admin_applications();
  if (r->'error'->>'code')::int <> 403 then raise exception 'customer read applications'; end if;
end $$;
reset role;

-- The owner, acting as admin.
set local role authenticated;
select pg_catalog.set_config('request.jwt.claims','{"role":"authenticated","sub":"ad000000-0000-4000-8000-000000000001"}',true);
select pg_catalog.set_config('request.jwt.claim.sub','ad000000-0000-4000-8000-000000000001',true);
do $$ declare r jsonb; a jsonb; begin
  r := public.admin_accounts();
  select x into a from pg_catalog.jsonb_array_elements(r->'accounts') as x where x->>'id' = 'ad000000-0000-4000-8000-000000000001';
  if (a->>'you')::boolean is not true or (a->>'owner')::boolean is not true then raise exception 'self row wrong: %', a; end if;
  select x into a from pg_catalog.jsonb_array_elements(r->'accounts') as x where x->>'id' = 'ad000000-0000-4000-8000-000000000003';
  if a->>'provider' <> 'discord' or a->>'role' <> 'customer' or a->>'name' <> 'Cust Three' then raise exception 'customer row wrong: %', a; end if;

  r := public.admin_set_role('ad000000-0000-4000-8000-000000000001','customer');
  if (r->'error'->>'code')::int <> 403 then raise exception 'owner demoted: %', r; end if;

  r := public.admin_set_role('ad000000-0000-4000-8000-000000000002','admin');
  if r->'account'->>'role' <> 'admin' or r->'account'->>'roleBy' <> 'Owner One' then raise exception 'promote failed: %', r; end if;

  r := public.admin_set_access('ad000000-0000-4000-8000-000000000004', array['val'], false);
  if (r->'error'->>'code')::int <> 409 then raise exception 'access for non-teammate: %', r; end if;
  r := public.admin_set_role('ad000000-0000-4000-8000-000000000004','teammate');
  if r->'account'->>'role' <> 'teammate' or r->'account'->'access'->'games' <> '[]'::jsonb then raise exception 'teammate failed: %', r; end if;
  r := public.admin_set_access('ad000000-0000-4000-8000-000000000004', array['val','lol','nope','lol'], false);
  if r->'access'->'games' <> '["lol","val"]'::jsonb then raise exception 'access not canonical: %', r; end if;
end $$;
reset role;
do $$ begin
  if (select approved_games from public.teammate_order_access where user_id = 'ad000000-0000-4000-8000-000000000004') <> array['lol','val'] then raise exception 'access not stored'; end if;
end $$;

-- A teammate mid-order can't be demoted (order fixture inserted as owner of the tables).
insert into public.orders (id, customer_id, game, service, title, units, unit, region, ign, customer_name, amount_eur_cents, booking_fx, payout_usd_cents)
  values ('ad0a0000-0000-4000-8000-000000000001','ad000000-0000-4000-8000-000000000003','val','duo','Duo',1,'game','EU','Cust#EU','Cust',999,1.08,700);
insert into public.order_assignments (id, order_id, teammate_id, accepted_at)
  values ('ad0b0000-0000-4000-8000-000000000001','ad0a0000-0000-4000-8000-000000000001','ad000000-0000-4000-8000-000000000004', pg_catalog.clock_timestamp());
update public.orders set status = 'in_progress', assigned_teammate_id = 'ad000000-0000-4000-8000-000000000004',
  current_assignment_id = 'ad0b0000-0000-4000-8000-000000000001', accepted_at = pg_catalog.clock_timestamp()
  where id = 'ad0a0000-0000-4000-8000-000000000001';

set local role authenticated;
select pg_catalog.set_config('request.jwt.claims','{"role":"authenticated","sub":"ad000000-0000-4000-8000-000000000001"}',true);
select pg_catalog.set_config('request.jwt.claim.sub','ad000000-0000-4000-8000-000000000001',true);
do $$ declare r jsonb; v_app uuid; begin
  r := public.admin_set_role('ad000000-0000-4000-8000-000000000004','customer');
  if (r->'error'->>'code')::int <> 409 then raise exception 'busy teammate demoted: %', r; end if;
  -- Customer with an open order can't become staff.
  r := public.admin_set_role('ad000000-0000-4000-8000-000000000003','teammate');
  if (r->'error'->>'code')::int <> 409 then raise exception 'customer with open order promoted: %', r; end if;

  r := public.admin_applications();
  select (x->>'id')::uuid into v_app from pg_catalog.jsonb_array_elements(r->'applications') as x where x->>'email' = 'applicant@example.invalid';
  if v_app is null then raise exception 'application missing'; end if;
  r := public.admin_decide_application(v_app, 'approve');
  if r->>'result' <> 'teammate' or r->'application'->>'status' <> 'approved' then raise exception 'approve failed: %', r; end if;
  perform pg_catalog.set_config('duoly.applicant_checked', 'pending', true);
  r := public.admin_decide_application(v_app, 'reject', 'x');
  if (r->'error'->>'code')::int <> 409 then raise exception 'decided twice: %', r; end if;

  r := public.admin_audit(50);
  if pg_catalog.jsonb_array_length(r->'audit') < 4 then raise exception 'audit too short: %', r; end if;
  if r->'audit'->0->>'action' <> 'Approved application' then raise exception 'audit order wrong: %', r->'audit'->0; end if;
end $$;
reset role;

do $$ begin
  if (select role from public.account_roles where user_id = 'ad000000-0000-4000-8000-000000000005') <> 'teammate' then raise exception 'applicant not teammate'; end if;
  if (select approved_games from public.teammate_order_access where user_id = 'ad000000-0000-4000-8000-000000000005') <> array['val'] then raise exception 'applicant game missing'; end if;
end $$;
-- Application with no account yet; rejection path.
do $$ declare r jsonb; begin
  r := public.submit_teammate_application('Ghost Player','ghost@example.invalid','ghost','','lol','Master','EUW','','', '30+','', array['Duo','Coaching']);
end $$;
do $$ declare v_app uuid; begin
  select id into v_app from public.teammate_applications where email = 'ghost@example.invalid';
  perform pg_catalog.set_config('duoly.test_app', v_app::text, true);
end $$;
set local role authenticated;
select pg_catalog.set_config('request.jwt.claims','{"role":"authenticated","sub":"ad000000-0000-4000-8000-000000000002"}',true);
select pg_catalog.set_config('request.jwt.claim.sub','ad000000-0000-4000-8000-000000000002',true);
do $$ declare r jsonb; begin
  r := public.admin_decide_application(pg_catalog.current_setting('duoly.test_app')::uuid, 'approve');
  if r->>'result' <> 'no-account' then raise exception 'no-account expected: %', r; end if;
  -- Second admin can't touch the owner either.
  r := public.admin_set_role('ad000000-0000-4000-8000-000000000001','teammate');
  if (r->'error'->>'code')::int <> 403 then raise exception 'admin changed owner: %', r; end if;
end $$;
reset role;

-- Owner removal keeps admin but unlocks the row.
select public.sync_account_owner('ad000000-0000-4000-8000-000000000001', false);
do $$ begin
  if (select role || owner::text from public.account_roles where user_id = 'ad000000-0000-4000-8000-000000000001') <> 'adminfalse'
  then raise exception 'owner removal failed'; end if;
end $$;

-- 20261024091000: the approved applicant without an account becomes a teammate once they have a verified one.
insert into auth.users (id, aud, role, email, raw_user_meta_data, raw_app_meta_data) values
  ('ad000000-0000-4000-8000-000000000006','authenticated','authenticated','ghost@example.invalid','{}','{"provider":"email"}');
do $$ begin
  if (select role from public.account_roles where user_id = 'ad000000-0000-4000-8000-000000000006') <> 'customer' then raise exception 'unverified account promoted'; end if;
end $$;
update auth.users set email_confirmed_at = pg_catalog.clock_timestamp() where id = 'ad000000-0000-4000-8000-000000000006';
do $$ begin
  if (select role from public.account_roles where user_id = 'ad000000-0000-4000-8000-000000000006') <> 'teammate' then raise exception 'approved applicant not linked'; end if;
  if (select approved_games from public.teammate_order_access where user_id = 'ad000000-0000-4000-8000-000000000006') <> array['lol'] then raise exception 'applicant game not set'; end if;
  if (select account_id from public.teammate_applications where email = 'ghost@example.invalid') <> 'ad000000-0000-4000-8000-000000000006' then raise exception 'application not linked'; end if;
end $$;

select 'admin_foundation: all checks passed' as result;
rollback;
