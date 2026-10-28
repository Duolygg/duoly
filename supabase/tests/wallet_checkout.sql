-- Rollback-only checks for 20261025260000_wallet_checkout.sql.
-- Run after the migration body in one transaction, with a savepoint before this body.
create function pg_temp.wallet_checkout_assert(ok boolean,message text) returns void language plpgsql as $$ begin if not ok then raise exception '%',message; end if; end $$;

insert into auth.users(id,aud,role,email,raw_user_meta_data,raw_app_meta_data) values
 ('b4000000-0000-4000-8000-000000000001','authenticated','authenticated','wallet-checkout-admin@example.invalid','{}','{}'),
 ('b4000000-0000-4000-8000-000000000002','authenticated','authenticated','wallet-checkout-customer@example.invalid','{}','{}');
update public.profiles set name=case when id='b4000000-0000-4000-8000-000000000001' then 'Wallet Checkout Admin' else 'Wallet Checkout Customer' end
 where id in ('b4000000-0000-4000-8000-000000000001','b4000000-0000-4000-8000-000000000002');
update public.account_roles set role=case when user_id='b4000000-0000-4000-8000-000000000001' then 'admin' else 'customer' end
 where user_id in ('b4000000-0000-4000-8000-000000000001','b4000000-0000-4000-8000-000000000002');

-- A cancelled no-payment order supplies 6 EUR of cashable credit through the live refund path.
insert into public.orders(id,customer_id,customer_name,game,service,title,units,unit,rank,region,ign,amount_eur_cents,payout_usd_cents,booking_fx,created_at,queued_at,status,cancelled_at,cancel_reason)
values('b4100000-0000-4000-8000-000000000001','b4000000-0000-4000-8000-000000000002','Wallet Checkout Customer','lol','duo2','Duo Pro',1,'game','Gold','EUW','Wallet#EUW',600,360,1.1,now()-interval '10 minutes',now()-interval '9 minutes','cancelled',now()-interval '8 minutes','queue_expired');
insert into public.wallet_entries(customer_id,amount_eur_cents,kind,cashable,created_by,reason)
values('b4000000-0000-4000-8000-000000000002',500,'admin_credit',false,'b4000000-0000-4000-8000-000000000001','Wallet checkout promo fixture');
select pg_temp.wallet_checkout_assert((select cashable_eur_cents=600 and promo_eur_cents=500 from public.wallet_balances where customer_id='b4000000-0000-4000-8000-000000000002'),'starting buckets are wrong');

-- Creator discount is already applied to amount_eur_cents before wallet splitting.
insert into public.checkout_intents(id,customer_id,game,service,title,units,unit,region,ign,amount_eur_cents,payout_usd_cents,booking_fx,first_order_discount_cents,expires_at)
values('b4200000-0000-4000-8000-000000000001','b4000000-0000-4000-8000-000000000002','lol','duo2','Duo Pro',1,'game','EUW','Wallet#EUW',1000,660,1.1,100,now()+interval '30 minutes');
do $$ declare r jsonb; r2 jsonb; begin
 r:=public.checkout_reserve_wallet('b4200000-0000-4000-8000-000000000001');
 r2:=public.checkout_reserve_wallet('b4200000-0000-4000-8000-000000000001');
 if (r->>'wallet_eur_cents')::int<>1000 or (r->>'card_eur_cents')::int<>0 or r2<>r then raise exception 'full-wallet split or idempotency wrong: %, %',r,r2; end if;
end $$;
select pg_temp.wallet_checkout_assert((select count(*)=2 from public.wallet_entries where checkout_intent_id='b4200000-0000-4000-8000-000000000001' and kind='checkout_hold'),'reserve was duplicated');
select pg_temp.wallet_checkout_assert((select amount_eur_cents=-500 from public.wallet_entries where checkout_intent_id='b4200000-0000-4000-8000-000000000001' and kind='checkout_hold' and not cashable),'promo was not held first');
select pg_temp.wallet_checkout_assert((select amount_eur_cents=-500 from public.wallet_entries where checkout_intent_id='b4200000-0000-4000-8000-000000000001' and kind='checkout_hold' and cashable),'cashable remainder is wrong');

do $$ declare r jsonb; oid uuid; begin
 r:=public.create_wallet_order('b4200000-0000-4000-8000-000000000001');
 oid:=(r->>'order_id')::uuid;
 if oid is null or not (r->>'created')::boolean then raise exception 'wallet order failed: %',r; end if;
 if exists(select 1 from public.order_payments where order_id=oid) then raise exception 'wallet-only order created a Stripe payment'; end if;
 if (select amount_eur_cents<>1000 or wallet_eur_cents<>1000 or payout_usd_cents<>660 from public.orders where id=oid) then raise exception 'wallet order totals or teammate payout changed'; end if;
 update public.orders set status='cancelled',cancelled_at=pg_catalog.clock_timestamp(),cancel_reason='customer_cancelled' where id=oid;
end $$;
select pg_temp.wallet_checkout_assert((select cashable_eur_cents=600 and promo_eur_cents=500 and held_eur_cents=0 and spent_eur_cents=0 from public.wallet_balances where customer_id='b4000000-0000-4000-8000-000000000002'),'full-wallet cancel did not restore original buckets');

-- A mixed order spends promo first, preserves the 0.50 EUR Stripe minimum and returns both buckets on cancel.
insert into public.checkout_intents(id,customer_id,game,service,title,units,unit,region,ign,amount_eur_cents,payout_usd_cents,booking_fx,expires_at)
values('b4200000-0000-4000-8000-000000000002','b4000000-0000-4000-8000-000000000002','lol','duo2','Duo Pro',1,'game','EUW','Wallet#EUW',1600,990,1.1,now()+interval '30 minutes');
do $$ declare r jsonb; paid jsonb; oid uuid; begin
 r:=public.checkout_reserve_wallet('b4200000-0000-4000-8000-000000000002');
 if (r->>'wallet_eur_cents')::int<>1100 or (r->>'card_eur_cents')::int<>500 then raise exception 'mixed split wrong: %',r; end if;
 paid:=public.create_paid_order('b4200000-0000-4000-8000-000000000002','pi_walletmixed',500,'eur','card','authorized');
 oid:=(paid->>'order_id')::uuid;
 if oid is null then raise exception 'mixed order failed: %',paid; end if;
 if (select amount_eur_cents<>500 from public.order_payments where order_id=oid) then raise exception 'Stripe share wrong'; end if;
 update public.orders set status='cancelled',cancelled_at=pg_catalog.clock_timestamp(),cancel_reason='customer_cancelled' where id=oid;
end $$;
select pg_temp.wallet_checkout_assert((select cashable_eur_cents=600 and promo_eur_cents=500 and held_eur_cents=0 and spent_eur_cents=0 from public.wallet_balances where customer_id='b4000000-0000-4000-8000-000000000002'),'mixed cancel did not restore original buckets');

-- Expiry releases a hold exactly once. Repeated reserve/release calls model concurrent retries safely.
insert into public.checkout_intents(id,customer_id,game,service,title,units,unit,region,ign,amount_eur_cents,payout_usd_cents,booking_fx,expires_at)
values('b4200000-0000-4000-8000-000000000003','b4000000-0000-4000-8000-000000000002','lol','duo2','Duo Pro',1,'game','EUW','Wallet#EUW',1200,720,1.1,now()-interval '1 hour');
select public.checkout_reserve_wallet('b4200000-0000-4000-8000-000000000003');
select public.checkout_release_wallet('b4200000-0000-4000-8000-000000000003','expired');
select public.checkout_release_wallet('b4200000-0000-4000-8000-000000000003','expired');
select pg_temp.wallet_checkout_assert((select total_eur_cents=1100 and held_eur_cents=0 from public.wallet_balances where customer_id='b4000000-0000-4000-8000-000000000002'),'expired hold was not released once');

insert into public.checkout_intents(id,customer_id,game,service,title,units,unit,region,ign,amount_eur_cents,payout_usd_cents,booking_fx,expires_at)
values('b4200000-0000-4000-8000-000000000004','b4000000-0000-4000-8000-000000000002','lol','duo2','Duo Pro',1,'game','EUW','Wallet#EUW',1200,720,1.1,now()+interval '30 minutes');
do $$ begin
 begin
  insert into public.wallet_entries(customer_id,amount_eur_cents,kind,cashable,checkout_intent_id,reason)
  values('b4000000-0000-4000-8000-000000000002',-501,'checkout_hold',false,'b4200000-0000-4000-8000-000000000004','overspend probe');
  raise exception 'promo bucket went below zero';
 exception when sqlstate 'PT409' then null; end;
end $$;

-- Browser roles can read only their aggregate RPC and cannot reserve, release or inspect entries.
set local role authenticated;
select pg_catalog.set_config('request.jwt.claims','{"role":"authenticated","sub":"b4000000-0000-4000-8000-000000000002"}',true);
select pg_catalog.set_config('request.jwt.claim.sub','b4000000-0000-4000-8000-000000000002',true);
select pg_temp.wallet_checkout_assert((public.customer_wallet_balance()->>'total_eur_cents')::int=1100,'customer aggregate balance wrong');
do $$ begin
 begin perform public.checkout_reserve_wallet('b4200000-0000-4000-8000-000000000003'); raise exception 'customer reserved wallet'; exception when insufficient_privilege then null; end;
 begin perform 1 from public.wallet_entries; raise exception 'customer read wallet entries'; exception when insufficient_privilege then null; end;
end $$;
reset role;

select 'wallet_checkout: all checks passed' as result;
rollback to savepoint s;
