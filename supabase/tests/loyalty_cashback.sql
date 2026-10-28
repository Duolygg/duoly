-- Rollback-only checks for 20261025270000_loyalty_cashback.sql.
begin;

create function pg_temp.loyalty_assert(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'loyalty assertion: %',label; end if; end $$;
create function pg_temp.loyalty_login(actor uuid) returns void language plpgsql as $$
begin
 perform pg_catalog.set_config('request.jwt.claim.sub',actor::text,true);
 perform pg_catalog.set_config('request.jwt.claims',pg_catalog.jsonb_build_object('role','authenticated','sub',actor)::text,true);
end $$;
create function pg_temp.loyalty_history(c uuid,t uuid,n integer) returns void language plpgsql as $$
declare k integer; o uuid; a uuid; at timestamptz;
begin
 for k in 1..n loop
  o:=pg_catalog.gen_random_uuid(); a:=pg_catalog.gen_random_uuid();
  at:=pg_catalog.clock_timestamp()-interval '30 days'+k*interval '1 second';
  insert into public.orders(id,customer_id,game,service,title,units,unit,region,ign,customer_name,amount_eur_cents,booking_fx,payout_usd_cents,created_at,queued_at)
  values(o,c,'lol','duo','Loyalty history',1,'game','EUW','Fixture','Customer',1000,1.08,600,at,at);
  insert into public.order_assignments(id,order_id,teammate_id,accepted_at,ended_at,end_reason)
  values(a,o,t,at,at,'completed');
  update public.orders set status='completed',assigned_teammate_id=t,current_assignment_id=a,accepted_at=at,completed_at=at where id=o;
 end loop;
end $$;
create function pg_temp.loyalty_order(c uuid,t uuid,age interval,wallet_spend integer default 0) returns uuid language plpgsql as $$
declare o uuid:=pg_catalog.gen_random_uuid(); a uuid:=pg_catalog.gen_random_uuid(); i uuid:=pg_catalog.gen_random_uuid(); at timestamptz:=pg_catalog.clock_timestamp()-age;
begin
 insert into public.orders(id,customer_id,game,service,title,units,unit,region,ign,customer_name,amount_eur_cents,booking_fx,payout_usd_cents,created_at,queued_at)
 values(o,c,'lol','duo','Loyalty fixture',1,'game','EUW','Fixture','Customer',1000,1.08,600,at,at);
 insert into public.order_assignments(id,order_id,teammate_id,accepted_at,ended_at,end_reason)
 values(a,o,t,at,at,'completed');
 insert into public.checkout_intents(id,customer_id,game,service,title,units,unit,region,ign,amount_eur_cents,payout_usd_cents,booking_fx,expires_at)
 values(i,c,'lol','duo','Loyalty fixture',1,'game','EUW','Fixture',1000,600,1.08,at+interval '1 hour');
 insert into public.order_payments(order_id,intent_id,stripe_payment_intent_id,amount_minor,currency,amount_eur_cents,payment_method_type,state,settle)
 values(o,i,'pi_loyalty'||pg_catalog.replace(i::text,'-',''),1000,'eur',1000,'card','captured','none');
 if wallet_spend>0 then
  insert into public.wallet_entries(customer_id,amount_eur_cents,kind,cashable,created_by,reason) values(c,wallet_spend,'admin_credit',false,'5c000000-0000-4000-8000-000000000006','Loyalty test setup');
  insert into public.wallet_entries(customer_id,amount_eur_cents,kind,cashable,order_id,reason) values(c,-wallet_spend,'checkout_spend',false,o,'Loyalty test wallet spend');
 end if;
 update public.orders set status='completed',assigned_teammate_id=t,current_assignment_id=a,accepted_at=at,completed_at=at where id=o;
 return o;
end $$;

insert into auth.users(id,aud,role,email,raw_user_meta_data,raw_app_meta_data) values
 ('5c000000-0000-4000-8000-000000000001','authenticated','authenticated','loyalty-main@example.invalid','{}','{}'),
 ('5c000000-0000-4000-8000-000000000002','authenticated','authenticated','loyalty-reversal@example.invalid','{}','{}'),
 ('5c000000-0000-4000-8000-000000000003','authenticated','authenticated','loyalty-dispute@example.invalid','{}','{}'),
 ('5c000000-0000-4000-8000-000000000004','authenticated','authenticated','loyalty-young@example.invalid','{}','{}'),
 ('5c000000-0000-4000-8000-000000000005','authenticated','authenticated','loyalty-teammate@example.invalid','{}','{}'),
 ('5c000000-0000-4000-8000-000000000006','authenticated','authenticated','loyalty-admin@example.invalid','{}','{}');
update public.account_roles set role='teammate' where user_id='5c000000-0000-4000-8000-000000000005';
update public.account_roles set role='admin' where user_id='5c000000-0000-4000-8000-000000000006';

-- L1 thresholds are Fabian's exact table.
do $$ declare checks jsonb; begin
 checks:=pg_catalog.jsonb_build_array(public.loyalty_level(0),public.loyalty_level(99),public.loyalty_level(100),public.loyalty_level(249),public.loyalty_level(250),public.loyalty_level(499),public.loyalty_level(500),public.loyalty_level(999),public.loyalty_level(1000));
 perform pg_temp.loyalty_assert(checks#>>'{0,id}'='bronze' and checks#>>'{1,cashback}'='1','Bronze threshold');
 perform pg_temp.loyalty_assert(checks#>>'{2,id}'='silver' and checks#>>'{3,giftEurCents}'='500','Silver threshold');
 perform pg_temp.loyalty_assert(checks#>>'{4,id}'='gold' and checks#>>'{5,cashback}'='3','Gold threshold');
 perform pg_temp.loyalty_assert(checks#>>'{6,id}'='platinum' and checks#>>'{7,giftEurCents}'='4000','Platinum threshold');
 perform pg_temp.loyalty_assert(checks#>>'{8,id}'='diamond' and checks#>>'{8,cashback}'='7' and checks#>>'{8,giftEurCents}'='10000','Diamond threshold');
end $$;

-- The 100th order still earns Bronze cashback, excludes wallet spend and grants Silver once.
select pg_temp.loyalty_history('5c000000-0000-4000-8000-000000000001','5c000000-0000-4000-8000-000000000005',99);
select pg_catalog.set_config('loyalty.main',pg_temp.loyalty_order('5c000000-0000-4000-8000-000000000001','5c000000-0000-4000-8000-000000000005',interval '15 days',400)::text,true);
select pg_temp.loyalty_assert((select prior_completed_count=99 and level='bronze' and cashback_percent=1 from public.loyalty_cashbacks where order_id=current_setting('loyalty.main')::uuid),'level before threshold order');
select pg_temp.loyalty_assert((select amount_eur_cents=500 from public.loyalty_level_gifts where customer_id='5c000000-0000-4000-8000-000000000001' and level='silver'),'automatic Silver gift');
select pg_temp.loyalty_assert(public.loyalty_grant_gifts('5c000000-0000-4000-8000-000000000001')=0,'gift grant idempotent');
select pg_temp.loyalty_assert((select pg_catalog.count(*)=1 from public.loyalty_level_gifts where customer_id='5c000000-0000-4000-8000-000000000001'),'gift stored once');
set local role service_role;
select public.credit_due_cashback(1000);
select public.credit_due_cashback(1000);
reset role;
select pg_temp.loyalty_assert((select state='credited' and card_paid_eur_cents=600 and amount_eur_cents=6 from public.loyalty_cashbacks where order_id=current_setting('loyalty.main')::uuid),'card-only cashback credited after 14 days');
select pg_temp.loyalty_assert((select pg_catalog.count(*)=1 from public.wallet_entries where order_id=current_setting('loyalty.main')::uuid and kind='cashback'),'cashback credit idempotent');

-- A young completion remains pending.
select pg_catalog.set_config('loyalty.young',pg_temp.loyalty_order('5c000000-0000-4000-8000-000000000004','5c000000-0000-4000-8000-000000000005',interval '1 day')::text,true);
select pg_temp.loyalty_assert(public.loyalty_settle_cashback(current_setting('loyalty.young')::uuid)='pending','14-day delay enforced');

-- Refund after credit writes one reversal and keeps level gifts.
update public.order_payments set state='refunded' where order_id=current_setting('loyalty.main')::uuid;
select pg_temp.loyalty_assert((select state='reversed' and reversed_eur_cents=6 and reversal_shortfall_eur_cents=0 from public.loyalty_cashbacks where order_id=current_setting('loyalty.main')::uuid),'refund reversed cashback');
select pg_temp.loyalty_assert((select pg_catalog.count(*)=1 from public.wallet_entries where order_id=current_setting('loyalty.main')::uuid and kind='cashback_reversal' and amount_eur_cents=-6),'one reversal ledger entry');
select pg_temp.loyalty_assert((select pg_catalog.count(*)=1 from public.loyalty_level_gifts where customer_id='5c000000-0000-4000-8000-000000000001'),'refund kept level gift');

-- If promo was spent, reversal floors promo at zero and records the shortfall.
select pg_catalog.set_config('loyalty.shortfall',pg_temp.loyalty_order('5c000000-0000-4000-8000-000000000002','5c000000-0000-4000-8000-000000000005',interval '15 days')::text,true);
set local role service_role;
select public.credit_due_cashback(1000);
reset role;
insert into public.wallet_entries(customer_id,amount_eur_cents,kind,cashable,created_by,reason) values('5c000000-0000-4000-8000-000000000002',-10,'admin_debit',false,'5c000000-0000-4000-8000-000000000006','Spend credited cashback before refund');
update public.order_payments set state='refunded' where order_id=current_setting('loyalty.shortfall')::uuid;
select pg_temp.loyalty_assert((select state='reversed' and reversed_eur_cents=0 and reversal_shortfall_eur_cents=10 and reversal_entry_id is null from public.loyalty_cashbacks where order_id=current_setting('loyalty.shortfall')::uuid),'spent cashback shortfall recorded without negative promo');

-- Open and lost Stripe disputes prevent a due cashback credit.
select pg_catalog.set_config('loyalty.dispute',pg_temp.loyalty_order('5c000000-0000-4000-8000-000000000003','5c000000-0000-4000-8000-000000000005',interval '15 days')::text,true);
insert into public.stripe_disputes(id,order_id,charge_id,payment_intent_id,status,reason)
select 'dp_loyaltyopen',current_setting('loyalty.dispute')::uuid,'ch_loyaltyopen',p.stripe_payment_intent_id,'needs_response','fraudulent' from public.order_payments p where p.order_id=current_setting('loyalty.dispute')::uuid;
select pg_temp.loyalty_assert((select state='blocked' from public.loyalty_cashbacks where order_id=current_setting('loyalty.dispute')::uuid),'open dispute blocked cashback');
set local role service_role;
select public.credit_due_cashback(1000);
reset role;
select pg_temp.loyalty_assert((select state='blocked' from public.loyalty_cashbacks where order_id=current_setting('loyalty.dispute')::uuid),'job respected open dispute');
update public.stripe_disputes set status='lost',closed_at=pg_catalog.clock_timestamp() where id='dp_loyaltyopen';
select pg_temp.loyalty_assert((select state='cancelled' and credit_entry_id is null from public.loyalty_cashbacks where order_id=current_setting('loyalty.dispute')::uuid),'lost dispute cancelled uncredited cashback');
select pg_temp.loyalty_assert(public.loyalty_valid_count('5c000000-0000-4000-8000-000000000003')=1,'unrefunded disputed completion still counts for loyalty level');

-- Customer and admin read the same level summary. Raw loyalty rows and jobs stay private.
set local role authenticated;
select pg_temp.loyalty_login('5c000000-0000-4000-8000-000000000001');
do $$ declare r jsonb:=public.customer_rewards(); begin
 perform pg_temp.loyalty_assert(r->>'orders'='99','customer rewards excludes refunded completion');
 perform pg_temp.loyalty_assert(r#>>'{level,id}'='bronze' and pg_catalog.jsonb_typeof(r->'cashbackOrders')='array','customer rewards contract');
end $$;
do $$ begin
 begin perform 1 from public.loyalty_cashbacks limit 1; raise exception 'authenticated raw cashback read allowed'; exception when insufficient_privilege then null; end;
 begin perform public.credit_due_cashback(1); raise exception 'authenticated cashback job allowed'; exception when insufficient_privilege then null; end;
end $$;
select pg_temp.loyalty_login('5c000000-0000-4000-8000-000000000006');
do $$ declare r jsonb:=public.admin_customers(); begin
 perform pg_temp.loyalty_assert((select x#>>'{loyalty,level,id}'='bronze' from pg_catalog.jsonb_array_elements(r->'customers') x where x->>'id'='5c000000-0000-4000-8000-000000000001'),'admin uses loyalty summary');
end $$;
reset role;
set local role anon;
do $$ begin
 begin perform public.customer_rewards(); raise exception 'anonymous rewards RPC allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;

select 'loyalty_cashback: all checks passed' as result;
rollback;
