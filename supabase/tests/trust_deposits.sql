-- Rollback-only checks for 20261025130000_trust_deposits.sql.
begin;

create function pg_temp.trust_assert(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'trust deposit assertion: %',label; end if; end $$;
create function pg_temp.login(actor uuid) returns void language plpgsql as $$
begin
 perform pg_catalog.set_config('request.jwt.claim.sub',actor::text,true);
 perform pg_catalog.set_config('request.jwt.claims',pg_catalog.jsonb_build_object('role','authenticated','sub',actor)::text,true);
end $$;
create function pg_temp.make_earning(t uuid,c uuid,age interval,payment_state text default 'captured') returns uuid language plpgsql as $$
declare o uuid:=pg_catalog.gen_random_uuid(); a uuid:=pg_catalog.gen_random_uuid(); i uuid:=pg_catalog.gen_random_uuid(); n timestamptz:=pg_catalog.clock_timestamp()-age; held integer:=10;
begin
 insert into public.orders(id,customer_id,game,service,title,units,unit,region,ign,customer_name,amount_eur_cents,booking_fx,payout_usd_cents,created_at,queued_at)
 values(o,c,'lol','duo','Trust fixture',1,'game','EUW','Fixture','Customer',999,1.08,100,n,n);
 insert into public.order_assignments(id,order_id,teammate_id,accepted_at,ended_at,end_reason) values(a,o,t,n,n,'completed');
 update public.orders set status='completed',assigned_teammate_id=t,current_assignment_id=a,accepted_at=n,completed_at=n where id=o;
 insert into public.checkout_intents(id,customer_id,game,service,title,units,unit,region,ign,amount_eur_cents,payout_usd_cents,booking_fx,expires_at)
 values(i,c,'lol','duo','Trust fixture',1,'game','EUW','Fixture',999,100,1.08,n+interval '1 hour');
 insert into public.order_payments(order_id,intent_id,stripe_payment_intent_id,amount_minor,currency,amount_eur_cents,payment_method_type,state,settle)
 values(o,i,'pi_trust'||pg_catalog.replace(i::text,'-',''),999,'eur',999,'card',payment_state,'none');
 insert into public.teammate_earning_entries(order_id,assignment_id,teammate_id,request_id,proof_ids,completed_at,prior_completed_count,trust_tier,payout_usd_cents,deposit_percent,held_usd_cents,net_usd_cents,source_snapshot,result)
 values(o,a,t,pg_catalog.gen_random_uuid(),array[pg_catalog.gen_random_uuid()],n,0,'rookie',100,10,held,90,'{}','{}');
 return o;
end $$;

insert into auth.users(id,aud,role,email,raw_user_meta_data,raw_app_meta_data) values
 ('6d000000-0000-4000-8000-000000000001','authenticated','authenticated','trust-one@example.invalid','{}','{}'),
 ('6d000000-0000-4000-8000-000000000002','authenticated','authenticated','trust-two@example.invalid','{}','{}'),
 ('6d000000-0000-4000-8000-000000000003','authenticated','authenticated','trust-customer@example.invalid','{}','{}'),
 ('6d000000-0000-4000-8000-000000000004','authenticated','authenticated','trust-admin@example.invalid','{}','{}');
update public.profiles set name=case id
 when '6d000000-0000-4000-8000-000000000001' then 'Trust One'
 when '6d000000-0000-4000-8000-000000000002' then 'Trust Two'
 when '6d000000-0000-4000-8000-000000000004' then 'Trust Admin' else 'Trust Customer' end
where id::text like '6d000000-0000-4000-8000-00000000000%';
update public.account_roles set role='teammate' where user_id in ('6d000000-0000-4000-8000-000000000001','6d000000-0000-4000-8000-000000000002');
update public.account_roles set role='admin' where user_id='6d000000-0000-4000-8000-000000000004';

select pg_catalog.set_config('trust.release',pg_temp.make_earning('6d000000-0000-4000-8000-000000000001','6d000000-0000-4000-8000-000000000003',interval '15 days')::text,true);
select pg_catalog.set_config('trust.report',pg_temp.make_earning('6d000000-0000-4000-8000-000000000001','6d000000-0000-4000-8000-000000000003',interval '15 days')::text,true);
select pg_catalog.set_config('trust.dispute',pg_temp.make_earning('6d000000-0000-4000-8000-000000000001','6d000000-0000-4000-8000-000000000003',interval '15 days')::text,true);
select pg_catalog.set_config('trust.refund',pg_temp.make_earning('6d000000-0000-4000-8000-000000000001','6d000000-0000-4000-8000-000000000003',interval '1 day','refunded')::text,true);
select pg_catalog.set_config('trust.young',pg_temp.make_earning('6d000000-0000-4000-8000-000000000002','6d000000-0000-4000-8000-000000000003',interval '13 days')::text,true);

-- Open the report before the release sweep so the due deposit is never released.
do $$ declare o uuid:=current_setting('trust.report')::uuid; a uuid; rid uuid:=pg_catalog.gen_random_uuid(); begin
 select assignment_id into a from public.teammate_earning_entries where order_id=o;
 insert into public.order_reports(id,order_id,assignment_id,customer_id,teammate_id,type,description)
 values(rid,o,a,'6d000000-0000-4000-8000-000000000003','6d000000-0000-4000-8000-000000000001','toxic','A report description for the trust deposit test.');
 perform pg_catalog.set_config('trust.report_id',rid::text,true);
end $$;
set local role service_role;
select public.record_stripe_dispute('dp_trustopen','ch_trustopen',(select stripe_payment_intent_id from public.order_payments where order_id=current_setting('trust.dispute')::uuid),'needs_response','fraudulent');
reset role;

-- Timing: only due deposits without a blocker release.
set local role service_role;
select public.release_due_deposits(1000);
reset role;
select pg_temp.trust_assert((select state='released' and released_at is not null from public.deposit_releases where earning_id=current_setting('trust.release')::uuid),'due deposit released');
select pg_temp.trust_assert((select state='waiting' and released_at is null from public.deposit_releases where earning_id=current_setting('trust.young')::uuid),'young deposit stayed waiting');

-- An open report blocks a due deposit; admin rejection unblocks it and is audited.
select pg_temp.trust_assert((select state='blocked' from public.deposit_releases where earning_id=current_setting('trust.report')::uuid),'open report blocked deposit');
set local role service_role;
select public.release_due_deposits(1000);
reset role;
select pg_temp.trust_assert((select state='blocked' from public.deposit_releases where earning_id=current_setting('trust.report')::uuid),'release job respected open report');
set local role authenticated;
select pg_temp.login('6d000000-0000-4000-8000-000000000004');
select public.admin_order_report_decide(current_setting('trust.report_id')::uuid,'rejected','Evidence did not uphold the report.');
reset role;
select pg_temp.trust_assert((select state='waiting' from public.deposit_releases where earning_id=current_setting('trust.report')::uuid),'rejected report unblocked deposit');
select pg_temp.trust_assert((select action='Rejected report' from public.admin_audit_log order by id desc limit 1),'admin report decision audited');

-- Open disputes block, a win unblocks, and a lost dispute forfeits with immutable audit.
select pg_temp.trust_assert((select state='blocked' from public.deposit_releases where earning_id=current_setting('trust.dispute')::uuid),'open Stripe dispute blocked deposit');
set local role service_role;
select public.record_stripe_dispute('dp_trustopen','ch_trustopen',(select stripe_payment_intent_id from public.order_payments where order_id=current_setting('trust.dispute')::uuid),'won','fraudulent');
reset role;
select pg_temp.trust_assert((select state='waiting' from public.deposit_releases where earning_id=current_setting('trust.dispute')::uuid),'won Stripe dispute unblocked deposit');
set local role service_role;
select public.record_stripe_dispute('dp_trustopen','ch_trustopen',(select stripe_payment_intent_id from public.order_payments where order_id=current_setting('trust.dispute')::uuid),'lost','fraudulent');
reset role;
select pg_temp.trust_assert((select state='forfeited' and forfeited_at is not null from public.deposit_releases where earning_id=current_setting('trust.dispute')::uuid),'lost Stripe dispute forfeited deposit');
select pg_temp.trust_assert(exists(select 1 from public.deposit_release_events where earning_id=current_setting('trust.dispute')::uuid and to_state='forfeited' and reason like 'Stripe dispute lost:%'),'forfeiture reason audited');
select pg_temp.trust_assert(exists(select 1 from public.admin_audit_log where action='Forfeited deposit' and actor_name='Stripe' and detail like 'Stripe dispute lost:%'),'forfeiture in admin audit log');
do $$ begin
 begin update public.deposit_release_events set reason='tamper' where earning_id=current_setting('trust.dispute')::uuid; raise exception 'deposit audit update allowed';
 exception when sqlstate 'PT409' then null; end;
end $$;

-- Upheld teammate report also forfeits the deposit.
do $$ declare o uuid:=current_setting('trust.report')::uuid; begin
 update public.order_reports set status='open',decided_at=null,decided_by=null,decision_reason=null where id=current_setting('trust.report_id')::uuid;
 update public.order_reports set status='approved',decided_at=pg_catalog.clock_timestamp(),decided_by='6d000000-0000-4000-8000-000000000004',decision_reason='Report upheld after review.' where id=current_setting('trust.report_id')::uuid;
end $$;
select pg_temp.trust_assert((select state='forfeited' from public.deposit_releases where earning_id=current_setting('trust.report')::uuid),'upheld report forfeited deposit');

-- Refunded and ever-disputed completed orders do not count. Earnings remain immutable.
set local role authenticated;
select pg_temp.login('6d000000-0000-4000-8000-000000000001');
do $$ declare s jsonb:=public.teammate_stats(); begin
 perform pg_temp.trust_assert(s#>>'{stats,completed}'='2','trust count excludes refunded and disputed orders');
 perform pg_temp.trust_assert((s#>>'{stats,forfeited}')::numeric=0.20,'forfeited total scoped to teammate');
end $$;
select pg_temp.login('6d000000-0000-4000-8000-000000000002');
do $$ declare s jsonb:=public.teammate_stats(); begin
 perform pg_temp.trust_assert(s#>>'{stats,completed}'='1','teammate sees only own trust count');
 perform pg_temp.trust_assert((s#>>'{stats,held}')::numeric=0.10,'teammate sees only own held deposit');
end $$;
do $$ begin
 begin perform 1 from public.deposit_releases limit 1; raise exception 'authenticated raw deposit read allowed';
 exception when insufficient_privilege then null; end;
 begin perform public.release_due_deposits(1); raise exception 'authenticated release job allowed';
 exception when insufficient_privilege then null; end;
 begin perform public.record_stripe_dispute('dp_x','ch_x','pi_x','lost','fraudulent'); raise exception 'authenticated dispute write allowed';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select pg_temp.trust_assert((select pg_catalog.count(*)=5 from public.teammate_earning_entries where teammate_id in ('6d000000-0000-4000-8000-000000000001','6d000000-0000-4000-8000-000000000002')),'earnings remained immutable');

select 'trust_deposits: all checks passed' as result;
rollback;
