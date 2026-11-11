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

-- Rollback-only checks for 20261026130000_connect_payouts.sql (M9, Stripe Connect payouts).
-- Run with python3 supabase/tests/build_connect_payouts_rollback.py <out.sql>, then
-- Execute only using disposable local CI.
begin;

create function pg_temp.ok(v boolean,label text) returns void language plpgsql as $$
begin if v is distinct from true then raise exception 'connect payout assertion: %',label; end if; end $$;
create function pg_temp.login(actor uuid) returns void language plpgsql as $$
begin
  perform pg_catalog.set_config('request.jwt.claim.sub',actor::text,true);
  perform pg_catalog.set_config('request.jwt.claims',pg_catalog.jsonb_build_object('role','authenticated','sub',actor)::text,true);
end $$;
create function pg_temp.make_earning(t uuid,c uuid,at_time timestamptz,payout integer) returns uuid language plpgsql as $$
declare o uuid:=pg_catalog.gen_random_uuid(); a uuid:=pg_catalog.gen_random_uuid(); i uuid:=pg_catalog.gen_random_uuid();
begin
  insert into public.orders(id,customer_id,game,service,title,units,unit,region,ign,customer_name,amount_eur_cents,booking_fx,payout_usd_cents,created_at,queued_at)
  values(o,c,'lol','duo','Connect fixture',1,'game','EUW','Fixture','Customer',999,1.08,payout,at_time,at_time);
  insert into public.order_assignments(id,order_id,teammate_id,accepted_at,ended_at,end_reason) values(a,o,t,at_time,at_time,'completed');
  update public.orders set status='completed',assigned_teammate_id=t,current_assignment_id=a,accepted_at=at_time,completed_at=at_time where id=o;
  insert into public.checkout_intents(id,customer_id,game,service,title,units,unit,region,ign,amount_eur_cents,payout_usd_cents,booking_fx,expires_at)
  values(i,c,'lol','duo','Connect fixture',1,'game','EUW','Fixture',999,payout,1.08,at_time+interval '1 hour');
  insert into public.order_payments(order_id,intent_id,stripe_payment_intent_id,amount_minor,currency,amount_eur_cents,payment_method_type,state,settle)
  values(o,i,'pi_m9'||pg_catalog.replace(i::text,'-',''),999,'eur',999,'card','captured','none');
  insert into public.teammate_earning_entries(order_id,assignment_id,teammate_id,request_id,proof_ids,completed_at,prior_completed_count,trust_tier,payout_usd_cents,deposit_percent,held_usd_cents,net_usd_cents,source_snapshot,result)
  values(o,a,t,pg_catalog.gen_random_uuid(),array[pg_catalog.gen_random_uuid()],at_time,1000,'legend',payout,0,0,payout,'{}','{}');
  return o;
end $$;
create function pg_temp.line(t uuid) returns uuid language sql security definer as $$
  select id from public.payout_lines where teammate_id=t and week_start=current_setting('m9.week')::timestamptz;
$$;
create function pg_temp.audits(action text) returns bigint language sql security definer as $$
  select pg_catalog.count(*) from public.admin_audit_log where action=$1;
$$;

-- 7c..01 ready + details, 02 manual (details, no Connect), 03 ready without details, 04 ready but
-- below the minimum, 05 ready + details (failure path), 08 customer, 09 admin.
insert into auth.users(id,aud,role,email,raw_user_meta_data,raw_app_meta_data)
select ('7c000000-0000-4000-8000-0000000000'||n)::uuid,'authenticated','authenticated','m9-'||n||'@example.invalid','{}','{}'
from pg_catalog.unnest(array['01','02','03','04','05','08','09']) n;
update public.profiles set name='Connect '||pg_catalog.right(id::text,2) where id::text like '7c000000-0000-4000-8000-0000000000%';
update public.account_roles set role='teammate' where user_id::text like '7c000000-0000-4000-8000-00000000000%' and user_id::text not like '%08' and user_id::text not like '%09';
update public.account_roles set role='admin' where user_id='7c000000-0000-4000-8000-000000000009';
insert into public.teammate_payout_details(teammate_id,legal_name,address,country,date_of_birth,tax_number,payout_method,payout_account)
select ('7c000000-0000-4000-8000-0000000000'||n)::uuid,'Legal '||n,'Street 1, Vienna','Austria','1990-01-01','AT'||n,'wise','m9-'||n||'@wise.invalid'
from pg_catalog.unnest(array['01','02','04','05']) n;

select pg_catalog.set_config('m9.week',public.payout_week_start('2024-09-10 12:00+00')::text,true);
select pg_temp.ok(current_setting('m9.week')::timestamptz='2024-09-05 22:00+00','fixture week is Friday 00:00 Vienna');
select pg_catalog.set_config('m9.o1',pg_temp.make_earning('7c000000-0000-4000-8000-000000000001','7c000000-0000-4000-8000-000000000008','2024-09-07 10:00+00',2000)::text,true);
select pg_temp.make_earning('7c000000-0000-4000-8000-000000000002','7c000000-0000-4000-8000-000000000008','2024-09-07 10:00+00',1500);
select pg_temp.make_earning('7c000000-0000-4000-8000-000000000003','7c000000-0000-4000-8000-000000000008','2024-09-07 10:00+00',1500);
select pg_temp.make_earning('7c000000-0000-4000-8000-000000000004','7c000000-0000-4000-8000-000000000008','2024-09-07 10:00+00',500);
select pg_temp.make_earning('7c000000-0000-4000-8000-000000000005','7c000000-0000-4000-8000-000000000008','2024-09-07 10:00+00',1200);
select public.payout_freeze_week(current_setting('m9.week')::timestamptz);
select pg_temp.ok((select status from public.payout_lines where id=pg_temp.line('7c000000-0000-4000-8000-000000000004'))='carried','10 USD minimum unchanged: 5 USD carried');
select pg_temp.ok((select pg_catalog.count(*) from public.payout_lines where week_start=current_setting('m9.week')::timestamptz and status='scheduled')=4,'four scheduled lines');

-- ---- permissions --------------------------------------------------------------------------
set local role anon;
do $$begin begin perform public.teammate_connect_status(); raise exception 'anon status'; exception when insufficient_privilege then null; end; end$$;
reset role; set local role authenticated;
select pg_temp.login('7c000000-0000-4000-8000-000000000009');
do $$begin
  begin perform public.payout_stripe_prepare(pg_temp.line('7c000000-0000-4000-8000-000000000001'),'7c000000-0000-4000-8000-000000000009','eur',1.1,'ecb'); raise exception 'admin prepared directly'; exception when insufficient_privilege then null; end;
  begin perform public.payout_stripe_record(pg_catalog.gen_random_uuid(),'tr_x','acct_x',1,'eur'); raise exception 'admin recorded directly'; exception when insufficient_privilege then null; end;
  begin perform public.payout_stripe_reversal('tr_x',1); raise exception 'admin reversed directly'; exception when insufficient_privilege then null; end;
  begin perform public.payout_stripe_fail(pg_catalog.gen_random_uuid(),'x'); raise exception 'admin failed directly'; exception when insufficient_privilege then null; end;
  begin perform public.connect_account_link('7c000000-0000-4000-8000-000000000001','acct_x','AT'); raise exception 'admin linked directly'; exception when insufficient_privilege then null; end;
  begin perform public.connect_account_sync('acct_x',true,true,true,null,0); raise exception 'admin synced directly'; exception when insufficient_privilege then null; end;
  begin perform public.connect_payout_failed('acct_x','po_x','x'); raise exception 'admin payout failed directly'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.teammate_connect_accounts; raise exception 'table read'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.payout_transfers; raise exception 'table read'; exception when insufficient_privilege then null; end;
end$$;
select pg_temp.login('7c000000-0000-4000-8000-000000000008');
select pg_temp.ok((public.teammate_connect_status()->'error'->>'code')::int=403,'customer has no connect status');
select pg_temp.ok((public.admin_payout_pay_all_manual('wise','X')->'error'->>'code')::int=403,'customer cannot pay all');
select pg_temp.login('7c000000-0000-4000-8000-000000000002');
select pg_temp.ok(public.teammate_connect_status()->'connect'->>'status'='not_started','teammate without account is not started');
reset role; set local role service_role;
do $$begin
  begin perform 1 from public.teammate_connect_accounts; raise exception 'service table read'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.payout_transfer_reversals; raise exception 'service table read'; exception when insufficient_privilege then null; end;
  begin perform public.teammate_connect_status(); raise exception 'service teammate rpc'; exception when insufficient_privilege then null; end;
end$$;
-- the server role can run every Connect and transfer function (unknown ids are harmless no-ops)
select pg_temp.ok(public.connect_account_for('7c000000-0000-4000-8000-000000000002') is null,'service reads connect account');
select pg_temp.ok(not (public.connect_account_sync('acct_m9none',true,true,true,null,0)->>'updated')::boolean,'service sync');
select pg_temp.ok(not (public.connect_payout_failed('acct_m9none','po_m9none','x')->>'updated')::boolean,'service payout failed');
select pg_temp.ok(public.payout_stripe_prepare(pg_catalog.gen_random_uuid(),'7c000000-0000-4000-8000-000000000009','usd',null,null)->'error'->>'code'='404','service prepare');
select pg_temp.ok(not (public.payout_stripe_record(pg_catalog.gen_random_uuid(),'tr_m9none','acct_m9none',1,'usd')->>'recorded')::boolean,'service record');
select pg_temp.ok(not (public.payout_stripe_fail(pg_catalog.gen_random_uuid(),'x')->>'updated')::boolean,'service fail');
select pg_temp.ok(not (public.payout_stripe_reversal('tr_m9none',1)->>'updated')::boolean,'service reversal');

reset role;
-- ---- onboarding status ----------------------------------------------------------------------
select pg_temp.ok(public.connect_account_status(false,false,false,'requirements.past_due',3)='not_started','not submitted');
select pg_temp.ok(public.connect_account_status(true,false,false,'requirements.pending_verification',0)='pending','pending verification');
select pg_temp.ok(public.connect_account_status(true,false,true,null,0)='pending','submitted, payouts not enabled yet');
select pg_temp.ok(public.connect_account_status(true,true,true,null,0)='ready','ready');
select pg_temp.ok(public.connect_account_status(true,true,true,'rejected.fraud',0)='restricted','rejected');
select pg_temp.ok(public.connect_account_status(true,false,false,'requirements.past_due',2)='restricted','needs information');
select pg_temp.ok(public.connect_account_status(true,true,false,null,1)='restricted','transfers inactive with due items');

select pg_temp.ok((public.connect_account_link('7c000000-0000-4000-8000-000000000008','acct_m9cust','AT')->'error'->>'code')::int=403,'customers cannot link');
select pg_temp.ok((public.connect_account_link('7c000000-0000-4000-8000-000000000001','acct_m9one','AT')->>'linked')::boolean,'teammate linked');
select pg_temp.ok(not (public.connect_account_link('7c000000-0000-4000-8000-000000000001','acct_m9one','AT')->>'linked')::boolean,'same account link is a no-op');
select pg_temp.ok((public.connect_account_link('7c000000-0000-4000-8000-000000000001','acct_m9other','DE')->'error'->>'code')::int=409,'second account refused');
do $$begin begin perform public.connect_account_link('7c000000-0000-4000-8000-000000000002','acct_bad id','AT'); raise exception 'bad id'; exception when others then if sqlerrm<>'invalid connect account' then raise; end if; end; end$$;
select public.connect_account_link(('7c000000-0000-4000-8000-0000000000'||n)::uuid,'acct_m9'||n,'DE') from pg_catalog.unnest(array['03','04','05']) n;
select pg_temp.ok(public.connect_account_sync('acct_m9one',true,false,false,'requirements.pending_verification',0)->>'status'='pending','sync pending');
select pg_temp.ok(public.connect_account_sync('acct_m9one',true,true,true,null,0)->>'status'='ready','sync ready');
select pg_temp.ok(not (public.connect_account_sync('acct_m9one',true,true,true,null,0)->>'changed')::boolean,'sync replay unchanged');
select pg_temp.ok(not (public.connect_account_sync('acct_m9unknown',true,true,true,null,0)->>'updated')::boolean,'unknown account ignored');
select public.connect_account_sync('acct_m9'||n,true,true,true,null,0) from pg_catalog.unnest(array['03','04','05']) n;
select pg_temp.ok(pg_temp.audits('Stripe payouts status changed')>=5 and pg_temp.audits('Started Stripe payouts setup')>=4,'onboarding audited');
select pg_temp.ok(public.payout_teammate_dto('7c000000-0000-4000-8000-000000000001')->>'connect'='ready','admin dto shows ready');
select pg_temp.ok(public.payout_teammate_dto('7c000000-0000-4000-8000-000000000002')->>'connect'='not_started','admin dto shows manual');

-- connected-account bank payout failure is recorded and cleared when payouts are enabled again
select pg_temp.ok(not (public.connect_payout_failed('acct_m9five','po_m9fail','account_closed')->>'updated')::boolean,'unknown payout account ignored');
select pg_temp.ok((public.connect_payout_failed('acct_m905','po_m9fail','account_closed')->>'updated')::boolean,'payout failure recorded');
select pg_temp.ok((public.connect_status_dto('7c000000-0000-4000-8000-000000000005')->>'payoutFailed')::boolean,'teammate sees payout failure');
select public.connect_account_sync('acct_m905',true,false,true,null,1);
select public.connect_account_sync('acct_m905',true,true,true,null,0);
select pg_temp.ok(not (public.connect_status_dto('7c000000-0000-4000-8000-000000000005')->>'payoutFailed')::boolean,'failure cleared when payouts enabled again');
select pg_temp.ok(pg_temp.audits('Stripe bank payout failed')>=1,'payout failure audited');

-- ---- rail selection and payout rules on Pay via Stripe --------------------------------------
select pg_temp.ok((public.payout_stripe_prepare(pg_temp.line('7c000000-0000-4000-8000-000000000001'),'7c000000-0000-4000-8000-000000000008','eur',1.1,'ecb')->'error'->>'code')::int=403,'only admins prepare');
select pg_temp.ok(public.payout_stripe_prepare(pg_temp.line('7c000000-0000-4000-8000-000000000002'),'7c000000-0000-4000-8000-000000000009','eur',1.1,'ecb')->'error'->>'message' like '%Pay this one manually%','no Connect account: manual rail');
select pg_temp.ok(public.payout_stripe_prepare(pg_temp.line('7c000000-0000-4000-8000-000000000003'),'7c000000-0000-4000-8000-000000000009','eur',1.1,'ecb')->'error'->>'message' like '%payout details%','DAC7 details still required');
select pg_temp.ok(public.payout_stripe_prepare(pg_temp.line('7c000000-0000-4000-8000-000000000004'),'7c000000-0000-4000-8000-000000000009','eur',1.1,'ecb')->'error'->>'message' like '%$10 minimum%','carried line is not payable');
do $$begin begin perform public.payout_stripe_prepare(pg_temp.line('7c000000-0000-4000-8000-000000000001'),'7c000000-0000-4000-8000-000000000009','eur',null,'ecb'); raise exception 'no rate'; exception when others then if sqlerrm<>'invalid transfer rate' then raise; end if; end; end$$;
do $$begin begin perform public.payout_stripe_prepare(pg_temp.line('7c000000-0000-4000-8000-000000000001'),'7c000000-0000-4000-8000-000000000009','eur',1.08,'fallback'); raise exception 'fallback rate'; exception when others then if sqlerrm<>'invalid transfer rate' then raise; end if; end; end$$;
-- a restricted account falls back to the manual rail
select public.connect_account_sync('acct_m905',true,false,false,'requirements.past_due',2);
select pg_temp.ok(public.payout_stripe_prepare(pg_temp.line('7c000000-0000-4000-8000-000000000005'),'7c000000-0000-4000-8000-000000000009','usd',null,null)->'error'->>'message' like '%no ready Stripe account%','restricted account not payable via Stripe');
select public.connect_account_sync('acct_m905',true,true,true,null,0);
-- an on-hold line is refused
reset role; set local role authenticated; select pg_temp.login('7c000000-0000-4000-8000-000000000009');
select pg_temp.ok((public.admin_payout_hold(pg_temp.line('7c000000-0000-4000-8000-000000000005'),'Checking')->>'ok')::boolean,'hold line 5');
reset role;
select pg_temp.ok(public.payout_stripe_prepare(pg_temp.line('7c000000-0000-4000-8000-000000000005'),'7c000000-0000-4000-8000-000000000009','usd',null,null)->'error'->>'message'='Release the hold first.','on hold refused');
reset role; set local role authenticated; select pg_temp.login('7c000000-0000-4000-8000-000000000009');
select public.admin_payout_release(pg_temp.line('7c000000-0000-4000-8000-000000000005'));
reset role;

-- ---- prepare, idempotency, locks ------------------------------------------------------------
select pg_catalog.set_config('m9.t1',(public.payout_stripe_prepare(pg_temp.line('7c000000-0000-4000-8000-000000000001'),'7c000000-0000-4000-8000-000000000009','eur',1.1,'ecb')->'transfer')::text,true);
select pg_temp.ok((current_setting('m9.t1')::jsonb->>'amountMinor')::bigint=1818 and (current_setting('m9.t1')::jsonb->>'amountUsdCents')::bigint=2000
  and current_setting('m9.t1')::jsonb->>'currency'='eur' and current_setting('m9.t1')::jsonb->>'accountId'='acct_m9one','EUR amount at the recorded ECB rate');
select pg_temp.ok(current_setting('m9.t1')::jsonb->>'idempotencyKey'='duoly-payout-'||pg_temp.line('7c000000-0000-4000-8000-000000000001')||'-1','idempotency key per line and attempt');
select pg_temp.ok((public.payout_stripe_prepare(pg_temp.line('7c000000-0000-4000-8000-000000000001'),'7c000000-0000-4000-8000-000000000009','eur',1.2,'ecb')->'transfer'->>'resumed')::boolean
  and (select pg_catalog.count(*) from public.payout_transfers where line_id=pg_temp.line('7c000000-0000-4000-8000-000000000001'))=1
  and (select amount_minor from public.payout_transfers where line_id=pg_temp.line('7c000000-0000-4000-8000-000000000001'))=1818,'second press resumes the same transfer and amount');
select pg_temp.ok(pg_temp.audits('Started Stripe payout')>=1,'prepare audited');
do $$begin begin insert into public.payout_transfers(line_id,teammate_id,stripe_account_id,attempt,idempotency_key,amount_usd_cents,currency,amount_minor,created_by)
  values(pg_temp.line('7c000000-0000-4000-8000-000000000001'),'7c000000-0000-4000-8000-000000000001','acct_m9one',9,'duoly-payout-'||pg_temp.line('7c000000-0000-4000-8000-000000000001')||'-9',2000,'usd',2000,'7c000000-0000-4000-8000-000000000009');
  raise exception 'two live transfers'; exception when unique_violation then null; end; end$$;
reset role; set local role authenticated; select pg_temp.login('7c000000-0000-4000-8000-000000000009');
select pg_temp.ok(public.admin_payout_pay(pg_temp.line('7c000000-0000-4000-8000-000000000001'),'wise','W-1')->'error'->>'message' like 'A Stripe transfer%','manual pay refused while pending');
select pg_temp.ok(public.admin_payout_hold(pg_temp.line('7c000000-0000-4000-8000-000000000001'),'x')->'error'->>'message' like 'A Stripe transfer%','hold refused while pending');
select pg_temp.ok(public.admin_payouts()->'payouts' @> pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('id',pg_temp.line('7c000000-0000-4000-8000-000000000001'),'connect','ready','status','Scheduled',
  'transfer',pg_catalog.jsonb_build_object('state','pending','currency','EUR'))),'admin screen shows pending Stripe transfer');
reset role;
-- an automatic hold does not change a line whose transfer amount is fixed
do $$ declare o uuid:=current_setting('m9.o1')::uuid; a uuid; begin
  select assignment_id into a from public.teammate_earning_entries where order_id=o;
  insert into public.order_reports(id,order_id,assignment_id,customer_id,teammate_id,type,description)
  values(pg_catalog.gen_random_uuid(),o,a,'7c000000-0000-4000-8000-000000000008','7c000000-0000-4000-8000-000000000001','toxic','Open report while a Stripe transfer is pending.');
end $$;
select pg_temp.ok(not exists(select 1 from public.payout_order_holds where order_id=current_setting('m9.o1')::uuid)
  and public.payout_line_total(pg_temp.line('7c000000-0000-4000-8000-000000000001'))=2000,'pending line not auto-held');

select pg_temp.ok(public.payout_stripe_record((current_setting('m9.t1')::jsonb->>'id')::uuid,'tr_m9one','acct_m9one',1817,'eur')->>'reason'='mismatch','wrong amount not recorded');
select pg_temp.ok(public.payout_stripe_record((current_setting('m9.t1')::jsonb->>'id')::uuid,'tr_m9one','acct_m9wrong',1818,'eur')->>'reason'='mismatch','wrong destination not recorded');
select pg_temp.ok((public.payout_stripe_record((current_setting('m9.t1')::jsonb->>'id')::uuid,'tr_m9one','acct_m9one',1818,'eur')->>'recorded')::boolean,'transfer recorded');
select pg_temp.ok((select status='paid' and paid_method='stripe' and paid_reference='tr_m9one' and paid_usd_cents=2000 and paid_by='7c000000-0000-4000-8000-000000000009'
  from public.payout_lines where id=pg_temp.line('7c000000-0000-4000-8000-000000000001')),'line paid via Stripe');
select pg_temp.ok(public.payout_stripe_record((current_setting('m9.t1')::jsonb->>'id')::uuid,'tr_m9one','acct_m9one',1818,'eur')->>'reason'='already_recorded','record replay is a no-op');
select pg_temp.ok(public.payout_stripe_prepare(pg_temp.line('7c000000-0000-4000-8000-000000000001'),'7c000000-0000-4000-8000-000000000009','eur',1.1,'ecb')->'error'->>'message'='This payout was already paid.','paid twice refused');
select pg_temp.ok(pg_temp.audits('Paid payout with Stripe')>=1,'payment audited');

-- ---- refused transfer, retry with a new attempt, late confirmation --------------------------
select pg_catalog.set_config('m9.t5',(public.payout_stripe_prepare(pg_temp.line('7c000000-0000-4000-8000-000000000005'),'7c000000-0000-4000-8000-000000000009','usd',null,null)->'transfer')::text,true);
select pg_temp.ok((current_setting('m9.t5')::jsonb->>'amountMinor')::bigint=1200 and current_setting('m9.t5')::jsonb->>'currency'='usd','USD transfer equals the line');
select pg_temp.ok((public.payout_stripe_fail((current_setting('m9.t5')::jsonb->>'id')::uuid,'balance_insufficient')->>'updated')::boolean,'refusal recorded');
select pg_temp.ok((select status from public.payout_lines where id=pg_temp.line('7c000000-0000-4000-8000-000000000005'))='scheduled','refused line stays scheduled');
select pg_temp.ok(pg_temp.audits('Stripe payout failed')>=1,'refusal audited');
select pg_catalog.set_config('m9.t5b',(public.payout_stripe_prepare(pg_temp.line('7c000000-0000-4000-8000-000000000005'),'7c000000-0000-4000-8000-000000000009','usd',null,null)->'transfer')::text,true);
select pg_temp.ok(current_setting('m9.t5b')::jsonb->>'idempotencyKey' like '%-2' and not (current_setting('m9.t5b')::jsonb->>'resumed')::boolean,'retry is attempt 2 with a new key');
select pg_temp.ok(public.payout_stripe_record((current_setting('m9.t5')::jsonb->>'id')::uuid,'tr_m9late','acct_m905',1200,'usd')->>'reason'='superseded','late attempt 1 does not pay the line again');
select pg_temp.ok((public.payout_stripe_record((current_setting('m9.t5b')::jsonb->>'id')::uuid,'tr_m9five','acct_m905',1200,'usd')->>'recorded')::boolean,'attempt 2 recorded');

-- ---- pay all on the manual rail skips Stripe-ready lines --------------------------------------
reset role; set local role authenticated; select pg_temp.login('7c000000-0000-4000-8000-000000000009');
select pg_catalog.set_config('m9.all',public.admin_payout_pay_all_manual('wise','BATCH-9')::text,true);
reset role;
select pg_temp.ok((select status='paid' and paid_method='wise' from public.payout_lines where id=pg_temp.line('7c000000-0000-4000-8000-000000000002')),'manual line paid in batch');
select pg_temp.ok((select status='scheduled' from public.payout_lines where id=pg_temp.line('7c000000-0000-4000-8000-000000000003')),'Stripe-ready line skipped by manual batch');
select pg_temp.ok((current_setting('m9.all')::jsonb->>'stripe')::int>=1,'batch reports lines left for Stripe');

-- ---- reversals ------------------------------------------------------------------------------

select pg_temp.ok((public.payout_stripe_reversal('tr_m9one',909)->>'owedUsdCents')::bigint=1000,'half reversed: 10 USD owed again');
select pg_temp.ok(not (public.payout_stripe_reversal('tr_m9one',909)->>'updated')::boolean,'reversal replay unchanged');
select pg_temp.ok(not (public.payout_stripe_reversal('tr_m9one',100)->>'updated')::boolean,'older smaller total ignored');
select pg_temp.ok(public.payout_stripe_reversal('tr_m9one',1818)->>'state'='reversed','full reversal');
select pg_temp.ok((select pg_catalog.sum(r.amount_usd_cents) from public.payout_transfer_reversals r join public.payout_transfers t on t.id=r.transfer_id where t.stripe_transfer_id='tr_m9one')=2000,'reversals sum to the paid USD');
select pg_temp.ok(not (public.payout_stripe_reversal('tr_m9unknown',5)->>'updated')::boolean,'unknown transfer ignored');
select pg_temp.ok(pg_temp.audits('Stripe payout reversed')>=2,'reversal audited');
reset role;
select pg_temp.ok((public.payout_pending('7c000000-0000-4000-8000-000000000001',pg_catalog.clock_timestamp())->>'reversals')::bigint=2000,'reversal owed in the running week');
select pg_temp.ok((select status from public.payout_lines where id=pg_temp.line('7c000000-0000-4000-8000-000000000001'))='paid','paid line history kept');
do $$begin begin update public.payout_transfer_reversals set amount_usd_cents=0; raise exception 'mutable reversal'; exception when sqlstate 'PT409' then null; end; end$$;
select public.payout_freeze_week(public.payout_week_start(pg_catalog.clock_timestamp()));
select pg_temp.ok((select pg_catalog.sum(i.amount_usd_cents) from public.payout_line_items i join public.payout_lines l on l.id=i.line_id
  where l.teammate_id='7c000000-0000-4000-8000-000000000001' and i.kind='transfer_reversal')=2000,'reversal counted once in the next line');
select pg_temp.ok((select (public.payout_line_dto(l.id)->>'adjust')::numeric=20 and pg_catalog.jsonb_array_length(public.payout_line_dto(l.id)->'adjustments')>=1
  from public.payout_lines l where l.teammate_id='7c000000-0000-4000-8000-000000000001' and l.week_start=public.payout_week_start(pg_catalog.clock_timestamp())),'reversal shown as an adjustment');

-- negative amounts can never be paid
do $$begin begin insert into public.payout_transfers(line_id,teammate_id,stripe_account_id,attempt,idempotency_key,amount_usd_cents,currency,amount_minor,created_by)
  values(pg_temp.line('7c000000-0000-4000-8000-000000000004'),'7c000000-0000-4000-8000-000000000004','acct_m904',1,'duoly-payout-'||pg_temp.line('7c000000-0000-4000-8000-000000000004')||'-1',-500,'usd',-500,'7c000000-0000-4000-8000-000000000009');
  raise exception 'negative transfer'; exception when check_violation then null; end; end$$;

select 'connect payouts ok' as result;
rollback;
