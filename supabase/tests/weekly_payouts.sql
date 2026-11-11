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

-- Rollback-only checks for 20261025250000_weekly_payouts.sql.
-- Run with the migration body (without its begin/commit) inserted after this begin.
begin;

create function pg_temp.m2_assert(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'weekly payout assertion: %',label; end if; end $$;
create function pg_temp.login(actor uuid) returns void language plpgsql as $$
begin
  perform pg_catalog.set_config('request.jwt.claim.sub',actor::text,true);
  perform pg_catalog.set_config('request.jwt.claims',pg_catalog.jsonb_build_object('role','authenticated','sub',actor)::text,true);
end $$;
create function pg_temp.make_earning(t uuid,c uuid,at_time timestamptz,payout integer,held integer) returns uuid language plpgsql as $$
declare o uuid:=pg_catalog.gen_random_uuid(); a uuid:=pg_catalog.gen_random_uuid(); i uuid:=pg_catalog.gen_random_uuid();
begin
  insert into public.orders(id,customer_id,game,service,title,units,unit,region,ign,customer_name,amount_eur_cents,booking_fx,payout_usd_cents,created_at,queued_at)
  values(o,c,'lol','duo','Payout fixture',1,'game','EUW','Fixture','Customer',999,1.08,payout,at_time,at_time);
  insert into public.order_assignments(id,order_id,teammate_id,accepted_at,ended_at,end_reason) values(a,o,t,at_time,at_time,'completed');
  update public.orders set status='completed',assigned_teammate_id=t,current_assignment_id=a,accepted_at=at_time,completed_at=at_time where id=o;
  insert into public.checkout_intents(id,customer_id,game,service,title,units,unit,region,ign,amount_eur_cents,payout_usd_cents,booking_fx,expires_at)
  values(i,c,'lol','duo','Payout fixture',1,'game','EUW','Fixture',999,payout,1.08,at_time+interval '1 hour');
  insert into public.order_payments(order_id,intent_id,stripe_payment_intent_id,amount_minor,currency,amount_eur_cents,payment_method_type,state,settle)
  values(o,i,'pi_m2'||pg_catalog.replace(i::text,'-',''),999,'eur',999,'card','captured','none');
  insert into public.teammate_earning_entries(order_id,assignment_id,teammate_id,request_id,proof_ids,completed_at,prior_completed_count,trust_tier,payout_usd_cents,deposit_percent,held_usd_cents,net_usd_cents,source_snapshot,result)
  values(o,a,t,pg_catalog.gen_random_uuid(),array[pg_catalog.gen_random_uuid()],at_time,1000,'legend',payout,0,0,payout,'{}','{}');
  return o;
end $$;

insert into auth.users(id,aud,role,email,raw_user_meta_data,raw_app_meta_data) values
 ('6e000000-0000-4000-8000-000000000001','authenticated','authenticated','m2-one@example.invalid','{}','{}'),
 ('6e000000-0000-4000-8000-000000000002','authenticated','authenticated','m2-two@example.invalid','{}','{}'),
 ('6e000000-0000-4000-8000-000000000003','authenticated','authenticated','m2-customer@example.invalid','{}','{}'),
 ('6e000000-0000-4000-8000-000000000004','authenticated','authenticated','m2-admin@example.invalid','{}','{}');
update public.profiles set name=case id
 when '6e000000-0000-4000-8000-000000000001' then 'Payout One'
 when '6e000000-0000-4000-8000-000000000002' then 'Payout Two'
 when '6e000000-0000-4000-8000-000000000004' then 'Payout Admin' else 'Payout Customer' end,
 country=case when id='6e000000-0000-4000-8000-000000000001' then 'at' else country end
where id::text like '6e000000-0000-4000-8000-00000000000%';
update public.account_roles set role='teammate' where user_id in ('6e000000-0000-4000-8000-000000000001','6e000000-0000-4000-8000-000000000002');
-- Current admin section model: this synthetic admin exercises all historical sections.
insert into public.admin_permissions(user_id, sections) values ('6e000000-0000-4000-8000-000000000004', public.admin_section_ids());
update public.account_roles set role='admin' where user_id='6e000000-0000-4000-8000-000000000004';

-- Vienna Friday boundaries remain local-midnight boundaries across both DST changes.
select pg_temp.m2_assert(public.payout_week_start('2026-03-29 12:00+00')='2026-03-26 23:00+00','spring week start');
select pg_temp.m2_assert(public.payout_week_end('2026-03-26 23:00+00')='2026-04-02 22:00+00','spring week is 167 hours');
select pg_temp.m2_assert(public.payout_week_start('2026-10-25 12:00+00')='2026-10-22 22:00+00','autumn week start');
select pg_temp.m2_assert(public.payout_week_end('2026-10-22 22:00+00')='2026-10-29 23:00+00','autumn week is 169 hours');

-- Adjustments enforce plus or minus, non-zero, 1000 USD max, visible reason, role and audit.
set local role authenticated;
select pg_temp.login('6e000000-0000-4000-8000-000000000003');
select pg_temp.m2_assert((public.admin_teammate_adjust('6e000000-0000-4000-8000-000000000001',100,'nope')->'error'->>'code')::int=403,'customer cannot adjust');
select pg_temp.login('6e000000-0000-4000-8000-000000000004');
select pg_temp.m2_assert((public.admin_teammate_adjust('6e000000-0000-4000-8000-000000000001',0,'zero')->'error'->>'code')::int=400,'zero adjustment refused');
select pg_temp.m2_assert((public.admin_teammate_adjust('6e000000-0000-4000-8000-000000000001',100001,'too much')->'error'->>'code')::int=400,'adjustment max enforced');
select pg_temp.m2_assert((public.admin_teammate_adjust('6e000000-0000-4000-8000-000000000001',100,'')->'error'->>'code')::int=400,'reason required');
reset role;

-- A sub-minimum week carries into the next; a negative week is never payable and also carries.
select pg_catalog.set_config('m2.carry_order',pg_temp.make_earning('6e000000-0000-4000-8000-000000000001','6e000000-0000-4000-8000-000000000003','2026-09-05 10:00+00',900,0)::text,true);
select pg_catalog.set_config('m2.negative_order',pg_temp.make_earning('6e000000-0000-4000-8000-000000000002','6e000000-0000-4000-8000-000000000003','2026-09-05 11:00+00',500,0)::text,true);
insert into public.teammate_adjustments(teammate_id,amount_usd_cents,reason,created_by,created_at) values
 ('6e000000-0000-4000-8000-000000000002',-600,'Correction creates a negative week','6e000000-0000-4000-8000-000000000004','2026-09-06 10:00+00');
select public.payout_freeze_week('2026-09-03 22:00+00');
select pg_temp.m2_assert((select status='carried' and public.payout_line_total(id)=900 from public.payout_lines where teammate_id='6e000000-0000-4000-8000-000000000001' and week_start='2026-09-03 22:00+00'),'under 10 USD carried');
select pg_temp.m2_assert((select status='carried' and public.payout_line_total(id)=-100 from public.payout_lines where teammate_id='6e000000-0000-4000-8000-000000000002' and week_start='2026-09-03 22:00+00'),'negative carried');
insert into public.teammate_adjustments(teammate_id,amount_usd_cents,reason,created_by,created_at) values
 ('6e000000-0000-4000-8000-000000000001',200,'Reach the transfer minimum','6e000000-0000-4000-8000-000000000004','2026-09-12 10:00+00'),
 ('6e000000-0000-4000-8000-000000000002',1200,'Offset prior correction','6e000000-0000-4000-8000-000000000004','2026-09-12 10:00+00');
select public.payout_freeze_week('2026-09-10 22:00+00');
select pg_temp.m2_assert((select status='scheduled' and public.payout_line_total(id)=1100 from public.payout_lines where teammate_id='6e000000-0000-4000-8000-000000000001' and week_start='2026-09-10 22:00+00'),'minimum reached with carry');
select pg_temp.m2_assert((select status='scheduled' and public.payout_line_total(id)=1100 from public.payout_lines where teammate_id='6e000000-0000-4000-8000-000000000002' and week_start='2026-09-10 22:00+00'),'negative balance recovered by carry');

-- An open report withholds only its order amount while the unaffected amount stays scheduled.
select pg_catalog.set_config('m2.safe_order',pg_temp.make_earning('6e000000-0000-4000-8000-000000000001','6e000000-0000-4000-8000-000000000003','2026-09-19 10:00+00',1200,0)::text,true);
select pg_catalog.set_config('m2.held_order',pg_temp.make_earning('6e000000-0000-4000-8000-000000000001','6e000000-0000-4000-8000-000000000003','2026-09-19 11:00+00',800,0)::text,true);
do $$ declare o uuid:=current_setting('m2.held_order')::uuid; a uuid; begin
 select assignment_id into a from public.teammate_earning_entries where order_id=o;
 insert into public.order_reports(id,order_id,assignment_id,customer_id,teammate_id,type,description)
 values(pg_catalog.gen_random_uuid(),o,a,'6e000000-0000-4000-8000-000000000003','6e000000-0000-4000-8000-000000000001','toxic','Open report for payout amount hold testing.');
end $$;
select public.payout_freeze_week('2026-09-17 22:00+00');
select pg_temp.m2_assert((select status='scheduled' and public.payout_line_total(id)=1200 from public.payout_lines where teammate_id='6e000000-0000-4000-8000-000000000001' and week_start='2026-09-17 22:00+00'),'only affected order withheld');
select pg_temp.m2_assert((select amount_usd_cents=800 and released_at is null from public.payout_order_holds where order_id=current_setting('m2.held_order')::uuid),'order hold recorded');

-- Manual whole-line hold and release require the right state, reason and audit.
select pg_catalog.set_config('m2.pay_line',(select id::text from public.payout_lines where teammate_id='6e000000-0000-4000-8000-000000000001' and week_start='2026-09-17 22:00+00'),true);
set local role authenticated;
select pg_temp.login('6e000000-0000-4000-8000-000000000004');
do $$ declare l uuid:=current_setting('m2.pay_line')::uuid; begin
 perform pg_temp.m2_assert((public.admin_payout_hold(l,'')->'error'->>'code')::int=400,'hold reason required');
 perform pg_temp.m2_assert(public.admin_payout_hold(l,'Manual review of the whole payout')->>'ok'='true','manual hold works');
 perform pg_temp.m2_assert((public.admin_payout_pay(l,'wise','W-early')->'error'->>'code')::int=409,'held line not paid');
 perform pg_temp.m2_assert(public.admin_payout_release(l)->>'ok'='true','manual release works');
end $$;
reset role;
select pg_temp.m2_assert(exists(select 1 from public.admin_audit_log where action='Held payout' and detail like '%Manual review%'),'hold audited');
select pg_temp.m2_assert(exists(select 1 from public.admin_audit_log where action='Released payout hold'),'release audited');

-- Payout details are required before pay, RLS is own-or-admin, and paid is immutable/manual metadata.
set local role authenticated;
select pg_temp.login('6e000000-0000-4000-8000-000000000004');
do $$ declare l uuid:=current_setting('m2.pay_line')::uuid; begin
 perform pg_temp.m2_assert((public.admin_payout_pay(l,'wise','W-1')->'error'->>'code')::int=409,'details required before pay');
end $$;
select pg_temp.login('6e000000-0000-4000-8000-000000000001');
select pg_temp.m2_assert(public.teammate_save_payout_details('Payout One Legal','Test Street 1, Vienna','Austria','1990-01-02','ATU123456','wise','wise@example.invalid')#>>'{details,method}'='wise','teammate saved payout details');
select pg_temp.login('6e000000-0000-4000-8000-000000000002');
select pg_temp.m2_assert((select pg_catalog.count(*)=0 from public.teammate_payout_details where teammate_id='6e000000-0000-4000-8000-000000000001'),'other teammate cannot read details');
select pg_temp.login('6e000000-0000-4000-8000-000000000004');
select pg_temp.m2_assert((select pg_catalog.count(*)=1 from public.teammate_payout_details where teammate_id='6e000000-0000-4000-8000-000000000001'),'admin can read details');
do $$ declare l uuid:=current_setting('m2.pay_line')::uuid; r jsonb; begin
 r:=public.admin_payout_pay(l,'wise','WISE-TEST-1');
 perform pg_temp.m2_assert(r->>'ok'='true','scheduled line paid');
 perform pg_temp.m2_assert((public.admin_payout_pay(l,'wise','WISE-TEST-2')->'error'->>'code')::int=409,'cannot pay twice');
end $$;
reset role;
select pg_temp.m2_assert((select status='paid' and paid_method='wise' and paid_reference='WISE-TEST-1' and paid_usd_cents=1200 from public.payout_lines where teammate_id='6e000000-0000-4000-8000-000000000001' and week_start='2026-09-17 22:00+00'),'payment metadata recorded');
select pg_temp.m2_assert(exists(select 1 from public.admin_audit_log where action='Marked payout paid' and detail like '%WISE-TEST-1%'),'payment audited');

-- Raw financial tables and internal helpers are unavailable to authenticated customers.
set local role authenticated;
select pg_temp.login('6e000000-0000-4000-8000-000000000003');
do $$ begin
 begin perform 1 from public.payout_lines limit 1; raise exception 'customer read payout lines'; exception when insufficient_privilege then null; end;
 begin perform public.payout_freeze_week('2026-09-24 22:00+00'); raise exception 'customer froze week'; exception when insufficient_privilege then null; end;
 begin perform 1 from public.teammate_adjustments limit 1; raise exception 'customer read adjustments'; exception when insufficient_privilege then null; end;
end $$;
reset role;

-- Creator manual rail: finished month only, aggregate unpaid minimum, exact month amount, once, audited.
do $$ declare cr uuid:=pg_catalog.gen_random_uuid(); o uuid; begin
 insert into public.creators(id,code,name,channel,created_by) values(cr,'M2CREATOR','M2 Creator','','Payout Admin');
 o:=pg_temp.make_earning('6e000000-0000-4000-8000-000000000001','6e000000-0000-4000-8000-000000000003','2026-08-15 10:00+00',1000,0);
 update public.orders set amount_eur_cents=62500 where id=o;
 insert into public.customer_referrals(customer_id,creator_id,code,first_order_id,attributed_at)
 values('6e000000-0000-4000-8000-000000000003',cr,'M2CREATOR',o,'2026-08-01 00:00+00');
 insert into public.order_referrals(order_id,creator_id,customer_id,amount_eur_cents,attributed_at)
 values(o,cr,'6e000000-0000-4000-8000-000000000003',62500,'2026-08-15 10:00+00');
 perform pg_catalog.set_config('m2.creator',cr::text,true);
end $$;
set local role authenticated;
select pg_temp.login('6e000000-0000-4000-8000-000000000003');
select pg_temp.m2_assert((public.admin_creator_payout_pay(current_setting('m2.creator')::uuid,'2026-08','wise','C-1')->'error'->>'code')::int=403,'customer cannot pay creator');
select pg_temp.login('6e000000-0000-4000-8000-000000000004');
select pg_temp.m2_assert(public.admin_creator_payout_pay(current_setting('m2.creator')::uuid,'2026-08','bank','CREATOR-1')->>'ok'='true','creator month paid');
select pg_temp.m2_assert((public.admin_creator_payout_pay(current_setting('m2.creator')::uuid,'2026-08','bank','CREATOR-2')->'error'->>'code')::int=409,'creator month paid once');
reset role;
select pg_temp.m2_assert((select amount_eur_cents=5000 and paid_method='bank' and paid_reference='CREATOR-1' from public.creator_payouts where creator_id=current_setting('m2.creator')::uuid),'creator exact commission recorded');
select pg_temp.m2_assert(exists(select 1 from public.admin_audit_log where action='Marked creator commission paid' and detail like '%CREATOR-1%'),'creator payout audited');
select pg_temp.m2_assert((select (public.admin_creator_dto(c)->>'owedCents')::int=0 and (public.admin_creator_dto(c)->'months'->0->>'paid')::boolean from public.creators c where id=current_setting('m2.creator')::uuid),'creator DTO separates paid and owed');

select 'weekly_payouts: all checks passed' as result;
rollback;
