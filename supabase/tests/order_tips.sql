-- Rollback-only checks for M6 tips. The builder inserts the migration before this body.
begin;
create function pg_temp.ok(v boolean,label text) returns void language plpgsql as $$begin if v is distinct from true then raise exception 'tips assertion: %',label; end if; end$$;
create function pg_temp.login(v uuid) returns void language plpgsql as $$begin
 perform pg_catalog.set_config('request.jwt.claim.sub',v::text,true);
 perform pg_catalog.set_config('request.jwt.claims',pg_catalog.jsonb_build_object('role','authenticated','sub',v)::text,true);
end$$;
create function pg_temp.make_order(v_suffix text,v_teammate uuid,v_customer uuid,v_at timestamptz) returns uuid language plpgsql as $$
declare o uuid:=pg_catalog.gen_random_uuid(); a uuid:=pg_catalog.gen_random_uuid(); i uuid:=pg_catalog.gen_random_uuid();
begin
 insert into public.orders(id,customer_id,game,service,title,units,unit,region,ign,customer_name,amount_eur_cents,booking_fx,payout_usd_cents,created_at,queued_at)
 values(o,v_customer,'lol','duo','Tip fixture',1,'game','EUW','Fixture','Customer',999,1.08,1500,v_at,v_at);
 insert into public.order_assignments(id,order_id,teammate_id,accepted_at,ended_at,end_reason) values(a,o,v_teammate,v_at,v_at,'completed');
 update public.orders set status='completed',assigned_teammate_id=v_teammate,current_assignment_id=a,accepted_at=v_at,completed_at=v_at where id=o;
 insert into public.checkout_intents(id,customer_id,game,service,title,units,unit,region,ign,amount_eur_cents,payout_usd_cents,booking_fx,expires_at)
 values(i,v_customer,'lol','duo','Tip fixture',1,'game','EUW','Fixture',999,1500,1.08,v_at+interval '1 hour');
 insert into public.order_payments(order_id,intent_id,stripe_payment_intent_id,amount_minor,currency,amount_eur_cents,payment_method_type,state,settle)
 values(o,i,'pi_m6order'||v_suffix,999,'eur',999,'card','captured','none');
 insert into public.teammate_earning_entries(order_id,assignment_id,teammate_id,request_id,proof_ids,completed_at,prior_completed_count,trust_tier,payout_usd_cents,deposit_percent,held_usd_cents,net_usd_cents,source_snapshot,result)
 values(o,a,v_teammate,pg_catalog.gen_random_uuid(),array[pg_catalog.gen_random_uuid()],v_at,1000,'legend',1500,0,0,1500,'{}','{}');
 return o;
end$$;
create function pg_temp.review_tip(o uuid,cents integer,pi text,fx numeric default 1) returns uuid language plpgsql as $$
declare r jsonb; t uuid;
begin
 perform pg_temp.login('6f000000-0000-4000-8000-000000000003'); set local role authenticated;
 r:=public.order_review_tip(o,5,'GG',array['Patient'],cents); reset role;
 t:=(r->'tipPrepared'->>'tipId')::uuid;
 perform pg_temp.ok(t is not null,'review and tip created together');
 perform pg_temp.ok((public.order_tip_attach(t,pi,cents,fx)->>'attached')::boolean,'intent attached');
 perform pg_temp.ok((public.order_tip_record_payment(pi,t,cents,'eur')->>'recorded')::boolean,'payment recorded');
 return t;
end$$;
insert into auth.users(id,aud,role,email,raw_user_meta_data,raw_app_meta_data) values
 ('6f000000-0000-4000-8000-000000000001','authenticated','authenticated','mate@example.invalid','{}','{}'),
 ('6f000000-0000-4000-8000-000000000003','authenticated','authenticated','customer@example.invalid','{}','{}'),
 ('6f000000-0000-4000-8000-000000000004','authenticated','authenticated','other@example.invalid','{}','{}'),
 ('6f000000-0000-4000-8000-000000000005','authenticated','authenticated','admin@example.invalid','{}','{}');
update public.profiles set name=case when id='6f000000-0000-4000-8000-000000000001' then 'Tip Mate' else 'Tip Customer' end where id::text like '6f000000-0000-4000-8000-00000000000%';
update public.account_roles set role='teammate' where user_id='6f000000-0000-4000-8000-000000000001';
update public.account_roles set role='admin' where user_id='6f000000-0000-4000-8000-000000000005';
do $$declare k text;begin
 foreach k in array array['min','max','paid','refund','dispute','own','queued'] loop
  perform pg_catalog.set_config('m6.'||k,pg_temp.make_order(k,'6f000000-0000-4000-8000-000000000001','6f000000-0000-4000-8000-000000000003','2025-01-07 10:00+00')::text,true);
 end loop;
 update public.orders set status='in_progress',completed_at=null where id=current_setting('m6.queued')::uuid;
end$$;
-- Permissions and ownership.
set local role anon;
do $$begin begin perform public.order_tip_status(current_setting('m6.own')::uuid); raise exception 'anon status'; exception when insufficient_privilege then null; end; end$$;
reset role; set local role authenticated;
select pg_temp.login('6f000000-0000-4000-8000-000000000004');
select pg_temp.ok((public.order_review_tip(current_setting('m6.own')::uuid,5,'','{}',500)->'error'->>'code')::int=404,'only order customer');
select pg_temp.login('6f000000-0000-4000-8000-000000000001');
select pg_temp.ok((public.order_review_tip(current_setting('m6.own')::uuid,5,'','{}',500)->'error'->>'code')::int=403,'teammate cannot tip');
reset role; set local role service_role;
do $$begin
 begin perform 1 from public.order_tips; raise exception 'service table read'; exception when insufficient_privilege then null; end;
 begin perform public.order_review_tip(current_setting('m6.own')::uuid,5,'','{}',500); raise exception 'service reviewed'; exception when insufficient_privilege then null; end;
end$$;
reset role;
-- Bounds, completed-only, one review and one tip per order.
set local role authenticated; select pg_temp.login('6f000000-0000-4000-8000-000000000003');
select pg_temp.ok((public.order_review_tip(current_setting('m6.min')::uuid,5,'','{}',99)->'error'->>'code')::int=400,'minimum enforced');
select pg_temp.ok((public.order_review_tip(current_setting('m6.max')::uuid,5,'','{}',10001)->'error'->>'code')::int=400,'maximum enforced');
select pg_temp.ok((public.order_review_tip(current_setting('m6.queued')::uuid,5,'','{}',500)->'error'->>'code')::int=409,'completed only');
select pg_catalog.set_config('m6.tip_min',(public.order_review_tip(current_setting('m6.min')::uuid,5,'','{}',100)->'tipPrepared'->>'tipId'),true);
select pg_temp.ok(current_setting('m6.tip_min')::uuid is not null,'minimum accepted');
reset role; set local role service_role;
select pg_temp.ok(not (public.order_tip_attach(current_setting('m6.tip_min')::uuid,'pi_m6wrong',200,1)->>'attached')::boolean,'attached amount cannot change');
select pg_temp.ok((public.order_tip_attach(current_setting('m6.tip_min')::uuid,'pi_m6min',100,1)->>'attached')::boolean,'selected amount attached');
select pg_temp.ok(public.order_tip_record_payment('pi_m6min',current_setting('m6.tip_min')::uuid,200,'eur')->>'reason'='amount_mismatch','webhook amount cannot change');
reset role; set local role authenticated; select pg_temp.login('6f000000-0000-4000-8000-000000000003');
select pg_temp.ok((public.order_review_tip(current_setting('m6.max')::uuid,5,'','{}',10000)->'tipPrepared'->>'amountCents')::int=10000,'maximum accepted');
select pg_temp.ok((public.order_review_tip(current_setting('m6.min')::uuid,5,'','{}',200)->'error'->>'code')::int=409,'only once');
reset role;
select pg_temp.ok((select pg_catalog.count(*)=1 from public.order_tips where order_id=current_setting('m6.min')::uuid),'one tip row');
select pg_temp.ok((public.order_tip_pending(current_setting('m6.min')::uuid,'6f000000-0000-4000-8000-000000000004')) is null,'other customer cannot resume');
-- Paid tips are 100% converted at server FX and never touch wallet or cashback.
select pg_catalog.set_config('m6.wallet',(select pg_catalog.count(*)::text from public.wallet_entries),true);
select pg_catalog.set_config('m6.cashback',(select pg_catalog.count(*)::text from public.loyalty_cashbacks),true);
select pg_catalog.set_config('m6.tip_paid',pg_temp.review_tip(current_setting('m6.paid')::uuid,500,'pi_m6paid',1.1)::text,true);
select pg_temp.ok((select state='paid' and amount_usd_cents=550 from public.order_tips where id=current_setting('m6.tip_paid')::uuid),'100 percent at mid FX');
select pg_temp.ok(public.order_tip_record_payment('pi_m6paid',current_setting('m6.tip_paid')::uuid,500,'eur')->>'reason'='already_paid','webhook replay idempotent');
select pg_temp.ok((select pg_catalog.count(*)::text from public.wallet_entries)=current_setting('m6.wallet'),'wallet untouched');
select pg_temp.ok((select pg_catalog.count(*)::text from public.loyalty_cashbacks)=current_setting('m6.cashback'),'cashback untouched');
-- Tips land in the Vienna week where payment succeeded, not completion week.
select pg_catalog.set_config('m6.tip_refund',pg_temp.review_tip(current_setting('m6.refund')::uuid,600,'pi_m6refund')::text,true);
select pg_catalog.set_config('m6.tip_dispute',pg_temp.review_tip(current_setting('m6.dispute')::uuid,700,'pi_m6dispute')::text,true);
update public.order_tips set paid_at='2025-01-14 10:00+00' where id in (current_setting('m6.tip_refund')::uuid,current_setting('m6.tip_dispute')::uuid);
select public.payout_freeze_week(public.payout_week_start('2025-01-07 10:00+00'));
select pg_temp.ok(not exists(select 1 from public.payout_line_items where kind='tip' and source_id in (current_setting('m6.tip_refund')::uuid,current_setting('m6.tip_dispute')::uuid)),'not in order week');
select public.payout_freeze_week(public.payout_week_start('2025-01-14 10:00+00'));
select pg_temp.ok((select pg_catalog.sum(amount_usd_cents)=1300 from public.payout_line_items where kind='tip' and source_id in (current_setting('m6.tip_refund')::uuid,current_setting('m6.tip_dispute')::uuid)),'in paid Vienna week');
-- Refund and dispute claw back on next payout line, once.
select pg_temp.ok((public.order_tip_record_refund('pi_m6refund',600)->>'movement')::int=-600,'refund clawback');
select pg_temp.ok((public.order_tip_record_refund('pi_m6refund',600)->>'updated')::boolean=false,'refund replay');
select pg_temp.ok((public.order_tip_record_dispute('dp_m6dispute','pi_m6dispute','needs_response')->>'movement')::int=-700,'dispute clawback');
select pg_temp.ok((public.order_tip_record_dispute('dp_m6dispute','pi_m6dispute','lost')->>'movement')::int=0,'lost no second clawback');
select pg_catalog.set_config('m6.now_week',public.payout_week_start(pg_catalog.clock_timestamp())::text,true);
select public.payout_freeze_week(current_setting('m6.now_week')::timestamptz);
select pg_temp.ok((select pg_catalog.sum(i.amount_usd_cents)=-1300 from public.payout_line_items i join public.payout_lines l on l.id=i.line_id where i.kind='tip_adjust' and l.week_start=current_setting('m6.now_week')::timestamptz),'next payout line negative');
-- Read models expose the tip to customer, teammate and admin.
set local role authenticated; select pg_temp.login('6f000000-0000-4000-8000-000000000001');
select pg_temp.ok((public.teammate_stats()->'stats'->>'tipsTotal')::numeric=5.5,'teammate total');
select pg_temp.login('6f000000-0000-4000-8000-000000000003');
select pg_temp.ok(public.order_tip_status(current_setting('m6.paid')::uuid)->'tip'->>'state'='paid','customer status');
select pg_temp.login('6f000000-0000-4000-8000-000000000005');
select pg_temp.ok((select x->'tip'->>'state'='paid' from pg_catalog.jsonb_array_elements(public.admin_orders()->'orders') x where x->>'orderId'=current_setting('m6.paid')),'admin detail');
reset role;
select 'order_tips: all checks passed' result;
rollback;
