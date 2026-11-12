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

-- Rollback-only checks for 20261025140000_wallet_ledger.sql.
-- Run after the migration body in one transaction, with a savepoint before this body.
create function pg_temp.wallet_assert(ok boolean,message text) returns void language plpgsql as $$ begin if not ok then raise exception '%',message; end if; end $$;
insert into auth.users(id,aud,role,email,raw_user_meta_data,raw_app_meta_data) values
 ('b1000000-0000-4000-8000-000000000001','authenticated','authenticated','wallet-admin@example.invalid','{}','{}'),
 ('b1000000-0000-4000-8000-000000000002','authenticated','authenticated','wallet-customer@example.invalid','{}','{}'),
 ('b1000000-0000-4000-8000-000000000003','authenticated','authenticated','wallet-other@example.invalid','{}','{}'),
 ('b1000000-0000-4000-8000-000000000004','authenticated','authenticated','wallet-teammate@example.invalid','{}','{}');
update public.profiles set name=case id when 'b1000000-0000-4000-8000-000000000001' then 'Wallet Admin' when 'b1000000-0000-4000-8000-000000000002' then 'Wallet Customer' when 'b1000000-0000-4000-8000-000000000003' then 'Other Customer' else 'Wallet Teammate' end where id::text like 'b1000000-0000-4000-8000-00000000000%';
update public.account_roles set role=case when user_id='b1000000-0000-4000-8000-000000000001' then 'admin' when user_id='b1000000-0000-4000-8000-000000000004' then 'teammate' else 'customer' end where user_id::text like 'b1000000-0000-4000-8000-00000000000%';
-- Current admin section model: this synthetic admin exercises all historical sections.
insert into public.admin_permissions(user_id, sections) values ('b1000000-0000-4000-8000-000000000001', public.admin_section_ids());
insert into public.teammate_order_access(user_id,approved_games,discord_id,discord_verified_at) values('b1000000-0000-4000-8000-000000000004',array['lol'],'923456789012345679',now());

-- A cancelled no-payment order still creates one cashable refund wallet entry through refund_credits.
insert into public.orders(id,customer_id,customer_name,game,service,title,units,unit,rank,region,ign,amount_eur_cents,payout_usd_cents,booking_fx,created_at,queued_at,status,cancelled_at,cancel_reason)
values('b1100000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000002','Wallet Customer','lol','duo','Duo',1,'game','Gold','EUW','Wallet',1200,720,1.1,now()-interval '2 minutes',now()-interval '1 minute','cancelled',now(),'queue_expired');
select pg_temp.wallet_assert((select count(*)=1 from public.wallet_entries where customer_id='b1000000-0000-4000-8000-000000000002' and kind='refund' and cashable and amount_eur_cents=1200),'refund credit was not copied to the ledger exactly once');
select pg_temp.wallet_assert(not exists(select 1 from public.refund_credits c where not exists(select 1 from public.wallet_entries e where e.refund_credit_id=c.id and e.kind='refund' and e.cashable)),'existing refund credits were not fully migrated');

set local role authenticated;
select pg_catalog.set_config('request.jwt.claims','{"role":"authenticated","sub":"b1000000-0000-4000-8000-000000000002"}',true);
select pg_catalog.set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000002',true);
select pg_temp.wallet_assert((public.admin_wallet_adjust('b1000000-0000-4000-8000-000000000002',100,'nope')->'error'->>'code')::int=403,'non-admin adjusted a wallet');
select pg_temp.wallet_assert((public.customer_refund_credits(50,0)->'balance'->>'total_eur_cents')::int=1200,'customer balance is wrong');
reset role;

-- Other customer's balance must not leak through the customer RPC.
insert into public.wallet_entries(customer_id,amount_eur_cents,kind,cashable,created_by,reason) values('b1000000-0000-4000-8000-000000000003',9900,'admin_credit',false,'b1000000-0000-4000-8000-000000000001','Other customer fixture');
set local role authenticated;
select pg_catalog.set_config('request.jwt.claims','{"role":"authenticated","sub":"b1000000-0000-4000-8000-000000000002"}',true);
select pg_catalog.set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000002',true);
select pg_temp.wallet_assert((public.customer_refund_credits(50,0)->'balance'->>'total_eur_cents')::int=1200,'customer saw another wallet');

select pg_catalog.set_config('request.jwt.claims','{"role":"authenticated","sub":"b1000000-0000-4000-8000-000000000001"}',true);
select pg_catalog.set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000001',true);
select pg_temp.wallet_assert((public.admin_wallet_adjust('b1000000-0000-4000-8000-000000000002',0,'zero')->'error'->>'code')::int=400,'zero adjustment accepted');
select pg_temp.wallet_assert((public.admin_wallet_adjust('b1000000-0000-4000-8000-000000000002',100001,'too large')->'error'->>'code')::int=400,'oversized adjustment accepted');
select pg_temp.wallet_assert((public.admin_wallet_adjust('b1000000-0000-4000-8000-000000000002',100,'')->'error'->>'code')::int=400,'blank reason accepted');
select pg_temp.wallet_assert((public.admin_wallet_adjust('b1000000-0000-4000-8000-000000000002',5000,'Goodwill credit')->>'ok')::boolean,'credit failed');
select pg_temp.wallet_assert((public.admin_wallet_adjust('b1000000-0000-4000-8000-000000000002',-5500,'Remove abuse balance')->>'ok')::boolean,'split debit failed');
select pg_temp.wallet_assert((public.admin_wallet_adjust('b1000000-0000-4000-8000-000000000002',-701,'Too much')->'error'->>'code')::int=409,'below-zero adjustment accepted');
select pg_temp.wallet_assert((public.admin_audit(2)->'audit'->0->>'action')='Debited customer wallet','debit audit row missing');
reset role;
select pg_temp.wallet_assert((select total_eur_cents=700 and cashable_eur_cents=700 and promo_eur_cents=0 from public.wallet_balances where customer_id='b1000000-0000-4000-8000-000000000002'),'cashable and promo buckets are wrong');

do $$ begin
 begin update public.wallet_entries set reason='changed' where customer_id='b1000000-0000-4000-8000-000000000002'; raise exception 'wallet update succeeded'; exception when sqlstate 'PT409' then null; end;
 begin delete from public.wallet_entries where customer_id='b1000000-0000-4000-8000-000000000002'; raise exception 'wallet delete succeeded'; exception when sqlstate 'PT409' then null; end;
 begin insert into public.wallet_entries(customer_id,amount_eur_cents,kind,cashable,created_by,reason) values('b1000000-0000-4000-8000-000000000002',-701,'admin_debit',true,'b1000000-0000-4000-8000-000000000001','Direct abuse'); raise exception 'negative bucket succeeded'; exception when sqlstate 'PT409' then null; end;
end $$;

-- Approved report credits the exact 50 EUR promo bounty and records it as wallet-paid once.
insert into public.orders(id,customer_id,customer_name,game,service,title,units,unit,rank,region,ign,amount_eur_cents,payout_usd_cents,booking_fx,created_at,queued_at)
values('b1100000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000002','Wallet Customer','lol','duo','Duo',1,'game','Gold','EUW','Reporter',1000,600,1.1,now()-interval '1 hour',now()-interval '50 minutes');
insert into public.order_assignments(id,order_id,teammate_id,accepted_at) values('b1200000-0000-4000-8000-000000000001','b1100000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000004',now()-interval '40 minutes');
update public.orders set status='in_progress',assigned_teammate_id='b1000000-0000-4000-8000-000000000004',current_assignment_id='b1200000-0000-4000-8000-000000000001',accepted_at=now()-interval '40 minutes' where id='b1100000-0000-4000-8000-000000000002';
insert into public.order_reports(id,order_id,assignment_id,customer_id,teammate_id,type,description) values('b1300000-0000-4000-8000-000000000001','b1100000-0000-4000-8000-000000000002','b1200000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000004','toxic','Repeated toxic messages in chat.');
set local role authenticated;
select pg_catalog.set_config('request.jwt.claims','{"role":"authenticated","sub":"b1000000-0000-4000-8000-000000000001"}',true);
select pg_catalog.set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000001',true);
select pg_temp.wallet_assert(public.admin_order_report_decide('b1300000-0000-4000-8000-000000000001','approved','Evidence confirms the report.')->'report'->>'status'='approved','report approval failed');
select pg_temp.wallet_assert((public.admin_order_report_decide('b1300000-0000-4000-8000-000000000001','approved','Again')->'error'->>'code')::int=409,'report paid twice');
reset role;
select pg_temp.wallet_assert((select count(*)=1 from public.wallet_entries where report_id='b1300000-0000-4000-8000-000000000001' and kind='bounty' and amount_eur_cents=5000 and not cashable),'bounty wallet credit was not exactly once');
select pg_temp.wallet_assert((select status='paid' and payment_note='Wallet credit' from public.order_report_bounties where report_id='b1300000-0000-4000-8000-000000000001'),'bounty was not marked wallet-paid');
select 'wallet_ledger: all checks passed' as result;
rollback to savepoint s;
