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

-- Rollback-only checks for 20261117120000_creator_portal.sql: applying, the admin decision, the
-- money the dashboard shows and that it reconciles with the admin screen, the aggregate click
-- counter, payout details and the self-referral guard. Disposable local database only.
begin;

create function pg_temp.ok(ok boolean, label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'creator portal assertion: %', label; end if; end $$;
create function pg_temp.login(actor uuid) returns void language plpgsql as $$
begin
  perform pg_catalog.set_config('request.jwt.claim.sub', actor::text, true);
  perform pg_catalog.set_config('request.jwt.claims', pg_catalog.jsonb_build_object('role','authenticated','sub',actor)::text, true);
end $$;
create function pg_temp.logout() returns void language plpgsql as $$
begin
  perform pg_catalog.set_config('request.jwt.claim.sub', '', true);
  perform pg_catalog.set_config('request.jwt.claims', '', true);
end $$;

insert into auth.users(id,aud,role,email,raw_user_meta_data,raw_app_meta_data) values
 ('7e000000-0000-4000-8000-000000000001','authenticated','authenticated','cp-admin@example.invalid','{}','{}'),
 ('7e000000-0000-4000-8000-000000000002','authenticated','authenticated','cp-creator@example.invalid','{}','{}'),
 ('7e000000-0000-4000-8000-000000000003','authenticated','authenticated','cp-viewer1@example.invalid','{}','{}'),
 ('7e000000-0000-4000-8000-000000000004','authenticated','authenticated','cp-viewer2@example.invalid','{}','{}'),
 ('7e000000-0000-4000-8000-000000000005','authenticated','authenticated','cp-mate@example.invalid','{}','{}'),
 ('7e000000-0000-4000-8000-000000000006','authenticated','authenticated','cp-second@example.invalid','{}','{}');
insert into public.profiles(id,name) values
 ('7e000000-0000-4000-8000-000000000001','Portal Admin'),
 ('7e000000-0000-4000-8000-000000000002','Alex Creator'),
 ('7e000000-0000-4000-8000-000000000003','Viewer One'),
 ('7e000000-0000-4000-8000-000000000004','Viewer Two'),
 ('7e000000-0000-4000-8000-000000000005','Mate'),
 ('7e000000-0000-4000-8000-000000000006','Second Applicant')
on conflict (id) do update set name = excluded.name;
insert into public.account_roles(user_id,role) values
 ('7e000000-0000-4000-8000-000000000001','admin'),
 ('7e000000-0000-4000-8000-000000000005','teammate')
on conflict (user_id) do update set role = excluded.role;

-- ---- structure and grants ----------------------------------------------------------------------

select pg_temp.ok(pg_catalog.to_regclass('public.creator_applications') is not null, 'applications table exists');
select pg_temp.ok(pg_catalog.to_regclass('public.creator_link_clicks') is not null, 'click table exists');
select pg_temp.ok(pg_catalog.to_regclass('public.creator_payout_details') is not null, 'payout details table exists');
select pg_temp.ok(exists (select 1 from information_schema.columns
  where table_schema='public' and table_name='creators' and column_name='user_id' and is_nullable='YES'),
  'creators.user_id is nullable');
select pg_temp.ok(exists (select 1 from pg_catalog.pg_indexes
  where schemaname='public' and indexname='creator_applications_open'), 'one open application index');
select pg_temp.ok(not pg_catalog.has_function_privilege('anon','public.creator_portal()','execute')
  and not pg_catalog.has_function_privilege('anon','public.creator_apply(text,text,text,text,text,text,text,text,text,boolean,text)','execute')
  and not pg_catalog.has_function_privilege('anon','public.admin_creator_applications()','execute'), 'anon has nothing');
select pg_temp.ok(pg_catalog.has_function_privilege('authenticated','public.creator_portal()','execute')
  and pg_catalog.has_function_privilege('authenticated','public.creator_code_available(text)','execute')
  and pg_catalog.has_function_privilege('authenticated','public.creator_save_payout_details(text,text,text,text,text,boolean,text,boolean)','execute'),
  'signed in callers can read their own portal');
select pg_temp.ok(not pg_catalog.has_function_privilege('authenticated','public.creator_link_click(text)','execute')
  and not pg_catalog.has_function_privilege('anon','public.creator_link_click(text)','execute')
  and pg_catalog.has_function_privilege('service_role','public.creator_link_click(text)','execute'),
  'only the server counts clicks');
select pg_temp.ok(not pg_catalog.has_table_privilege('authenticated','public.creator_applications','select')
  and not pg_catalog.has_table_privilege('authenticated','public.creator_link_clicks','select'),
  'application and click rows are not readable directly');
select pg_temp.ok(pg_catalog.has_table_privilege('authenticated','public.creator_payout_details','select'),
  'payout details are readable through RLS only');

-- ---- applying ------------------------------------------------------------------------------------

select pg_temp.logout();
select pg_temp.ok((public.creator_portal()->'error'->>'code')::int = 401, 'signed out portal is 401');
select pg_temp.ok((public.creator_code_available('ALEX10')->'error'->>'code')::int = 401, 'signed out code check is 401');

select pg_temp.login('7e000000-0000-4000-8000-000000000002');
select pg_temp.ok((public.creator_code_available(' alex10 ')->>'available')::boolean
  and public.creator_code_available('alex10')->>'code' = 'ALEX10', 'free code is available and normalised');
select pg_temp.ok(not (public.creator_code_available('admin')->>'available')::boolean
  and public.creator_code_available('admin')->>'reason' like '%Duoly page%', 'a site path is never a code');
select pg_temp.ok(not (public.creator_code_available('no')->>'available')::boolean, 'a two character code is refused');
select pg_temp.ok(not (public.creator_code_available('ALEX-10')->>'available')::boolean, 'punctuation is refused');

select pg_temp.ok((public.creator_apply('ALEX10','Alex Creator','alex@example.invalid','Twitch',
  'twitch.tv/alex','1K to 10K','lol','Austria','I stream ranked.', false, '2026-11-17')->'error'->>'code')::int = 400,
  'the age confirmation is required');
select pg_temp.ok((public.creator_apply('ALEX10','Alex Creator','alex@example.invalid','Twitch',
  'twitch.tv/alex','1K to 10K','lol','Austria','I stream ranked.', true, 'latest')->'error'->>'code')::int = 400,
  'an unversioned terms acceptance is refused');
select pg_temp.ok((public.creator_apply('ADMIN','Alex Creator','alex@example.invalid','Twitch',
  'twitch.tv/alex','1K to 10K','lol','Austria','', true, '2026-11-17')->'error'->>'code')::int = 409,
  'a reserved code is refused');
do $$ declare r jsonb; begin
  r := public.creator_apply('  alex10 ','Alex Creator','ALEX@Example.invalid','Twitch','twitch.tv/alex',
    '1K to 10K','lol','Austria','I stream ranked every evening.', true, '2026-11-17');
  perform pg_temp.ok(r->'application'->>'code' = 'ALEX10', 'code stored upper case');
  perform pg_temp.ok(r->'application'->>'status' = 'applied', 'application is open');
  perform pg_temp.ok(r->'application'->>'email' = 'alex@example.invalid', 'email stored lower case');
  perform pg_temp.ok(r->'application'->>'termsVersion' = '2026-11-17', 'terms version stored');
end $$;
select pg_temp.ok((public.creator_apply('OTHER','Alex Creator','alex@example.invalid','Twitch','twitch.tv/alex',
  '1K to 10K','lol','Austria','', true, '2026-11-17')->'error'->>'code')::int = 409, 'one open application per account');
select pg_temp.ok(not (public.creator_code_available('ALEX10')->>'available')::boolean,
  'a requested code is reserved while the application is open');
select pg_temp.ok(public.creator_portal()->>'status' = 'applied'
  and public.creator_portal()->'application'->>'channel' = 'twitch.tv/alex'
  and not (public.creator_portal()->>'canApply')::boolean, 'the status page shows the open application');

-- ---- the admin queue ------------------------------------------------------------------------------

select pg_temp.login('7e000000-0000-4000-8000-000000000003');
select pg_temp.ok((public.admin_creator_applications()->'error'->>'code')::int = 403, 'customers cannot read the queue');
select pg_temp.ok((public.admin_decide_creator_application(pg_catalog.gen_random_uuid(), true, null, null)
  ->'error'->>'code')::int = 403, 'customers cannot decide');

-- A second applicant is rejected, sees the reason and waits 30 days.
select pg_temp.login('7e000000-0000-4000-8000-000000000006');
select public.creator_apply('SECOND','Second Applicant','second@example.invalid','YouTube','youtube.com/second',
  'Under 1K','val','Germany','', true, '2026-11-17');
select pg_temp.login('7e000000-0000-4000-8000-000000000001');
do $$ declare v_id uuid; r jsonb; begin
  select (x->>'id')::uuid into v_id from pg_catalog.jsonb_array_elements(public.admin_creator_applications()->'applications') x
   where x->>'code' = 'SECOND';
  perform pg_temp.ok(v_id is not null, 'the queue lists the second application');
  perform pg_temp.ok((public.admin_decide_creator_application(v_id, false, null, '')->'error'->>'code')::int = 400,
    'a rejection needs a reason');
  r := public.admin_decide_creator_application(v_id, false, null, 'Your channel has no gaming content yet.');
  perform pg_temp.ok(r->'application'->>'status' = 'rejected', 'rejected');
  perform pg_temp.ok((public.admin_decide_creator_application(v_id, true, 'SECOND', null)->'error'->>'code')::int = 409,
    'a decided application cannot be decided again');
end $$;
select pg_temp.login('7e000000-0000-4000-8000-000000000006');
select pg_temp.ok(public.creator_portal()->>'status' = 'rejected'
  and public.creator_portal()->'application'->>'reason' = 'Your channel has no gaming content yet.'
  and (public.creator_portal()->>'canReapplyAt')::bigint > (public.creator_portal()->>'now')::bigint
  and not (public.creator_portal()->>'canApply')::boolean, 'a rejected applicant sees the reason and the cooldown');
select pg_temp.ok((public.creator_apply('SECOND2','Second Applicant','second@example.invalid','YouTube',
  'youtube.com/second','Under 1K','val','Germany','', true, '2026-11-17')->'error'->>'code')::int = 409,
  'reapplying inside the cooldown is refused');

-- The default code stays valid while its own application reserves it.
select pg_temp.login('7e000000-0000-4000-8000-000000000001');
savepoint unchanged_creator_code;
select pg_temp.ok((public.admin_decide_creator_application(
  (select id from public.creator_applications where requested_code = 'ALEX10' and status = 'applied'),
  true, null, null)->'creator'->>'code') = 'ALEX10', 'approval accepts the requested code unchanged');
rollback to savepoint unchanged_creator_code;

-- The first applicant is approved with an edited code.
select pg_temp.login('7e000000-0000-4000-8000-000000000001');
do $$ declare v_id uuid; r jsonb; begin
  select (x->>'id')::uuid into v_id from pg_catalog.jsonb_array_elements(public.admin_creator_applications()->'applications') x
   where x->>'code' = 'ALEX10';
  perform pg_temp.ok((public.admin_decide_creator_application(v_id, true, 'admin', null)->'error'->>'code')::int = 409,
    'an approved code cannot be a site path');
  r := public.admin_decide_creator_application(v_id, true, ' alexgg ', null);
  perform pg_temp.ok(r->'application'->>'status' = 'approved', 'approved');
  perform pg_temp.ok(r->'creator'->>'code' = 'ALEXGG', 'the edited code is the creator code');
  perform pg_temp.ok(r->'approved'->>'email' = 'alex@example.invalid', 'the approval carries the address for the email');
end $$;
select pg_temp.ok((select user_id from public.creators where code='ALEXGG') = '7e000000-0000-4000-8000-000000000002',
  'the creator row is linked to the account');
select pg_temp.ok(exists (select 1 from public.admin_audit_log where action='Approved creator application' and detail='ALEXGG')
  and exists (select 1 from public.admin_audit_log where action='Rejected creator application'),
  'both decisions are in the admin log');

-- Creators an admin added by hand, without an account, still work.
select pg_temp.ok((public.admin_create_creator('HANDMADE','Hand Made','')->'creator'->>'code') = 'HANDMADE',
  'admin created creators still work');
select pg_temp.ok((select user_id is null from public.creators where code='HANDMADE'), 'they have no account');

-- ---- orders, money and the admin reconciliation -----------------------------------------------------

reset role;
select pg_temp.logout();
create function pg_temp.order_at(p_customer uuid, p_amount integer, p_when timestamptz, p_complete boolean)
returns uuid language plpgsql as $$
declare o uuid := pg_catalog.gen_random_uuid(); a uuid := pg_catalog.gen_random_uuid();
begin
  insert into public.orders(id,customer_id,game,service,title,units,unit,region,ign,customer_name,
    amount_eur_cents,booking_fx,payout_usd_cents,created_at,queued_at)
  values (o,p_customer,'lol','duo','Duo Pro',1,'game','EUW','Fixture','Viewer',p_amount,1.08,600,p_when,p_when);
  if p_complete then
    insert into public.order_assignments(id,order_id,teammate_id,accepted_at,ended_at,end_reason)
      values (a,o,'7e000000-0000-4000-8000-000000000005',p_when,p_when,'completed');
    update public.orders set status='completed',assigned_teammate_id='7e000000-0000-4000-8000-000000000005',
      current_assignment_id=a,accepted_at=p_when,completed_at=p_when where id=o;
  end if;
  insert into public.order_payments(order_id,amount_minor,currency,amount_eur_cents,payment_method_type,state)
    values (o,p_amount,'eur',p_amount,'card','captured');
  return o;
end $$;

do $$
declare
  v_creator uuid; v_old timestamptz := pg_catalog.clock_timestamp() - interval '100 days';
  v_recent timestamptz := pg_catalog.clock_timestamp() - interval '2 days';
  o_a uuid; o_c uuid; o_d uuid; o_g uuid; o_b uuid; o_h uuid; o_e uuid;
begin
  select id into v_creator from public.creators where code='ALEXGG';
  -- The two viewers were referred by the creator.
  o_a := pg_temp.order_at('7e000000-0000-4000-8000-000000000003', 1887, v_old, true);
  insert into public.customer_referrals(customer_id,creator_id,code,first_order_id,attributed_at)
    values ('7e000000-0000-4000-8000-000000000003', v_creator, 'ALEXGG', o_a, v_old);
  o_b := pg_temp.order_at('7e000000-0000-4000-8000-000000000004', 2020, v_recent, true);
  insert into public.customer_referrals(customer_id,creator_id,code,first_order_id,attributed_at)
    values ('7e000000-0000-4000-8000-000000000004', v_creator, 'ALEXGG', o_b, v_recent);
  -- An older month, all past the 30 day hold: 1887 counted, 2000 with 500 refunded, 1000 refunded
  -- in full, and 1000 held back by an open report.
  o_c := pg_temp.order_at('7e000000-0000-4000-8000-000000000003', 1000, v_old, true);
  update public.order_payments set state='refunded' where order_id=o_c;
  o_d := pg_temp.order_at('7e000000-0000-4000-8000-000000000003', 2000, v_old, true);
  insert into public.refund_credits(order_id,amount_eur_cents) values (o_d, 500);
  o_g := pg_temp.order_at('7e000000-0000-4000-8000-000000000003', 1000, v_old, true);
  insert into public.order_reports(id,order_id,assignment_id,customer_id,teammate_id,type,description,status)
    select pg_catalog.gen_random_uuid(), o_g, a.id, '7e000000-0000-4000-8000-000000000003',
      '7e000000-0000-4000-8000-000000000005', 'toxic', 'Fixture report for the creator portal test.', 'open'
      from public.order_assignments a where a.order_id = o_g;
  -- This month, inside the hold: two orders of 2020, which is where per order rounding and month
  -- rounding disagree (161.6 cents each).
  o_h := pg_temp.order_at('7e000000-0000-4000-8000-000000000004', 2020, v_recent, true);
  -- One order still being played.
  o_e := pg_temp.order_at('7e000000-0000-4000-8000-000000000004', 1500, pg_catalog.clock_timestamp(), false);
  insert into public.order_referrals(order_id,creator_id,customer_id,amount_eur_cents,attributed_at) values
    (o_a, v_creator, '7e000000-0000-4000-8000-000000000003', 1887, v_old),
    (o_c, v_creator, '7e000000-0000-4000-8000-000000000003', 1000, v_old),
    (o_d, v_creator, '7e000000-0000-4000-8000-000000000003', 2000, v_old),
    (o_g, v_creator, '7e000000-0000-4000-8000-000000000003', 1000, v_old),
    (o_b, v_creator, '7e000000-0000-4000-8000-000000000004', 2020, v_recent),
    (o_h, v_creator, '7e000000-0000-4000-8000-000000000004', 2020, v_recent),
    (o_e, v_creator, '7e000000-0000-4000-8000-000000000004', 1500, pg_catalog.clock_timestamp());
end $$;

-- Aggregate clicks: only active codes, counted per day, nothing about the visitor.
select pg_temp.ok(public.creator_link_click('alexgg'), 'a valid code counts');
select pg_temp.ok(public.creator_link_click('ALEXGG'), 'the same code again counts');
select pg_temp.ok(not public.creator_link_click('NOSUCHCODE'), 'an unknown code counts nothing');
select pg_temp.ok(not public.creator_link_click('x'), 'a malformed code counts nothing');
select pg_temp.ok((select clicks from public.creator_link_clicks
  where creator_id=(select id from public.creators where code='ALEXGG')) = 2, 'two clicks on one day in one row');
insert into public.creator_link_clicks(creator_id,day,clicks)
  select id, (pg_catalog.clock_timestamp() at time zone 'UTC')::date - 20, 3 from public.creators where code='ALEXGG';
update public.creators set active=false where code='HANDMADE';
select pg_temp.ok(not public.creator_link_click('HANDMADE'), 'a paused code counts nothing');

-- The dashboard, as the creator.
select pg_temp.login('7e000000-0000-4000-8000-000000000002');
do $$ declare p jsonb; m jsonb; s jsonb; begin
  p := public.creator_portal();
  perform pg_temp.ok(p->>'status' = 'creator', 'the creator sees the dashboard');
  perform pg_temp.ok(p->'creator'->>'code' = 'ALEXGG', 'the hero carries the code');
  m := p->'money';
  -- Old month: 1887 + 1500 + 1000 counted at 8% = 351 cents, of which the held back 1000 stays
  -- pending (80 cents) and the rest is available (271 cents).
  -- This month: 2020 + 2020 at 8% = 323 cents, all inside the 30 day hold.
  perform pg_temp.ok((m->>'availableCents')::bigint = 271, 'available is the part past the hold: ' || (m->>'availableCents'));
  perform pg_temp.ok((m->>'pendingCents')::bigint = 403, 'pending is the hold plus the blocked order: ' || (m->>'pendingCents'));
  perform pg_temp.ok((m->>'earnedCents')::bigint = 674, 'earned is both months: ' || (m->>'earnedCents'));
  perform pg_temp.ok((m->>'reversedCents')::bigint = 120, 'reversed is the refunded order and the refunded part: ' || (m->>'reversedCents'));
  perform pg_temp.ok((m->>'paidCents')::bigint = 0, 'nothing paid yet');
  perform pg_temp.ok((m->>'thresholdCents')::bigint = 5000, 'the threshold is EUR 50');
  -- Month level rounding: two orders of 2020 are 161.6 cents each, 162 when rounded one by one,
  -- but the month is 323, which is what gets paid.
  perform pg_temp.ok((select (x->>'commissionCents')::bigint from pg_catalog.jsonb_array_elements(m->'months') x
    where (x->>'orders')::int = 2) = 323, 'the month total rounds once');
  s := p->'stats';
  perform pg_catalog.jsonb_array_length(p->'orders');
  perform pg_temp.ok((s->'all'->>'revenueCents')::bigint = 8427, 'all time revenue: ' || (s->'all'->>'revenueCents'));
  perform pg_temp.ok((s->'all'->>'commissionCents')::bigint = (m->>'earnedCents')::bigint, 'all time commission is what was earned');
  perform pg_temp.ok((s->'all'->>'clicks')::bigint = 5 and (s->'7d'->>'clicks')::bigint = 2, 'clicks follow the range');
  perform pg_temp.ok((s->'all'->>'customers')::bigint = 2, 'two referred viewers');
  perform pg_temp.ok((s->'all'->>'orders')::bigint = 7, 'seven attributed orders');
  perform pg_temp.ok((s->'7d'->>'revenueCents')::bigint = 4040, 'the 7 day range only has this month');
  -- Anonymised orders: the rows carry no customer at all.
  perform pg_temp.ok(pg_catalog.jsonb_array_length(p->'orders') = 7, 'every attributed order is listed');
  perform pg_temp.ok(p::text not like '%Viewer One%' and p::text not like '%Viewer Two%'
    and p::text not like '%cp-viewer1@example.invalid%'
    and p::text not like '%7e000000-0000-4000-8000-000000000003%', 'no customer name, email or id');
  perform pg_temp.ok((select pg_catalog.count(*) from pg_catalog.jsonb_array_elements(p->'orders') x
    where x->>'state' = 'available') = 2, 'two available orders');
  perform pg_temp.ok((select pg_catalog.count(*) from pg_catalog.jsonb_array_elements(p->'orders') x
    where x->>'state' = 'reversed') = 1, 'one reversed order');
  perform pg_temp.ok((select pg_catalog.count(*) from pg_catalog.jsonb_array_elements(p->'orders') x
    where x->>'state' = 'open') = 1, 'one open order');
  perform pg_temp.ok((select (x->>'commissionCents')::bigint from pg_catalog.jsonb_array_elements(p->'orders') x
    where (x->>'amountCents')::bigint = 2020 limit 1) = 162, 'one order rounds on its own');
  perform pg_temp.ok(p->'month'->'tier'->>'id' = 'rising', 'this month is the starting tier');
  perform pg_temp.ok((p->'rules'->>'payoutMinCents')::int = 5000 and (p->'rules'->>'holdDays')::int = 30,
    'the rules travel with the payload');
end $$;

-- The same numbers as the admin screen.
do $$ declare c public.creators; a jsonb; m jsonb; begin
  select * into c from public.creators where code='ALEXGG';
  a := public.admin_creator_dto(c);
  m := public.creator_portal_money(c.id, pg_catalog.clock_timestamp());
  perform pg_temp.ok((a->>'earnedCents')::bigint = (m->>'earnedCents')::bigint, 'earned matches the admin screen');
  perform pg_temp.ok((a->>'owedCents')::bigint = (m->>'availableCents')::bigint + (m->>'pendingCents')::bigint,
    'owed is what is available plus what is pending');
  perform pg_temp.ok((select pg_catalog.count(*) from pg_catalog.jsonb_array_elements(m->'months') x
    where (x->>'commissionCents')::bigint <> public.creator_month_commission(c.id, pg_catalog.to_date(x->>'month','YYYY-MM'))) = 0,
    'every month equals creator_month_commission');
end $$;

-- A paid month leaves the available balance and shows up in the payout history.
do $$ declare c uuid; v_month date; begin
  select id into c from public.creators where code='ALEXGG';
  select pg_catalog.to_date(x->>'month','YYYY-MM') into v_month
    from pg_catalog.jsonb_array_elements(public.creator_portal_money(c, pg_catalog.clock_timestamp())->'months') x
   where (x->>'availableCents')::bigint = 271;
  insert into public.creator_payouts(creator_id,month,amount_eur_cents,paid_by,paid_method,paid_reference)
    values (c, v_month, 351, '7e000000-0000-4000-8000-000000000001', 'wise', 'W-CP-1');
end $$;
select pg_temp.ok((public.creator_portal()->'money'->>'availableCents')::bigint = 0, 'a paid month is no longer available');
select pg_temp.ok((public.creator_portal()->'money'->>'paidCents')::bigint = 351, 'paid is what the payout recorded');
select pg_temp.ok((public.creator_portal()->'money'->>'pendingCents')::bigint = 323, 'only the unpaid month stays pending');
select pg_temp.ok(public.creator_portal()->'payouts'->0->>'reference' = 'W-CP-1'
  and (public.creator_portal()->'payouts'->0->>'amountCents')::bigint = 351, 'the payout history shows the transfer');

-- ---- payout details --------------------------------------------------------------------------------

select pg_temp.ok((public.creator_save_payout_details('Alex Creator','Teststrasse 1, Vienna','Austria',
  'wise','alex@example.invalid', false, '', false)->'error'->>'code')::int = 400, 'self billing must be agreed');
select pg_temp.ok((public.creator_save_payout_details('Alex Creator','Teststrasse 1, Vienna','Austria',
  'crypto','alex@example.invalid', false, '', true)->'error'->>'code')::int = 400, 'unknown rails are refused');
select pg_temp.ok(public.creator_save_payout_details('Alex Creator','Teststrasse 1, Vienna','Austria',
  'wise','alex@example.invalid', true, 'ATU12345678', true)->'details'->>'vatId' = 'ATU12345678', 'details are saved');
select pg_temp.ok(public.creator_portal()->'details'->>'method' = 'wise', 'the dashboard reads them back');
select pg_temp.login('7e000000-0000-4000-8000-000000000003');
select pg_temp.ok((public.creator_save_payout_details('Someone Else','Street 1','Austria','wise','x@example.invalid',
  false, '', true)->'error'->>'code')::int = 403, 'only creators have payout details');
set local role authenticated;
select pg_temp.ok((select pg_catalog.count(*) from public.creator_payout_details) = 0,
  'another customer cannot read creator payout details');
reset role;

-- ---- the self-referral guard -------------------------------------------------------------------------

select pg_temp.logout();
do $$ declare i uuid; o uuid; begin
  -- The creator opens a checkout with their own code and pays it.
  insert into public.checkout_intents(customer_id,game,service,title,units,unit,region,ign,
    amount_eur_cents,payout_usd_cents,booking_fx,expires_at,ref_code)
  values ('7e000000-0000-4000-8000-000000000002','lol','duo','Duo',1,'game','EUW','Alex#EUW',
    1000,600,1.08,pg_catalog.clock_timestamp()+interval '30 minutes','ALEXGG') returning id into i;
  perform pg_temp.ok((select creator_id is not null from public.checkout_intents where id=i),
    'the code still resolves on the checkout');
  o := pg_temp.order_at('7e000000-0000-4000-8000-000000000002', 1000, pg_catalog.clock_timestamp(), false);
  update public.checkout_intents set status='paid', order_id=o where id=i;
  perform pg_temp.ok(not exists (select 1 from public.customer_referrals
    where customer_id='7e000000-0000-4000-8000-000000000002'), 'a creator never refers themselves');
  perform pg_temp.ok(not exists (select 1 from public.order_referrals where order_id=o),
    'the creator own order never counts');
end $$;

-- A referred viewer is still attributed normally.
do $$ declare i uuid; o uuid; begin
  insert into auth.users(id,aud,role,email,raw_user_meta_data,raw_app_meta_data)
    values ('7e000000-0000-4000-8000-000000000007','authenticated','authenticated','cp-viewer3@example.invalid','{}','{}');
  insert into public.profiles(id,name) values ('7e000000-0000-4000-8000-000000000007','Viewer Three')
    on conflict (id) do nothing;
  insert into public.checkout_intents(customer_id,game,service,title,units,unit,region,ign,
    amount_eur_cents,payout_usd_cents,booking_fx,expires_at,ref_code)
  values ('7e000000-0000-4000-8000-000000000007','lol','duo','Duo',1,'game','EUW','Three#EUW',
    1000,600,1.08,pg_catalog.clock_timestamp()+interval '30 minutes','ALEXGG') returning id into i;
  o := pg_temp.order_at('7e000000-0000-4000-8000-000000000007', 1000, pg_catalog.clock_timestamp(), false);
  update public.checkout_intents set status='paid', order_id=o where id=i;
  perform pg_temp.ok(exists (select 1 from public.customer_referrals
    where customer_id='7e000000-0000-4000-8000-000000000007' and code='ALEXGG'), 'a viewer is still attributed');
end $$;

select 'creator portal: all checks passed' as result;
rollback;
