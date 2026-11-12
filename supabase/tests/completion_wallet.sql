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

-- Rollback-only checks for 20261112144155_complete_wallet_orders.sql: an order the Duoly balance paid
-- in full (no order_payments row, checkout_spend entries instead) can be completed; one whose spend
-- was given back, or that never had one, cannot.
begin;

create function pg_temp.wallet_assert(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'wallet completion assertion: %',label; end if; end $$;
create function pg_temp.wallet_login(actor uuid) returns void language plpgsql as $$
begin
 perform pg_catalog.set_config('request.jwt.claim.sub',coalesce(actor::text,''),true);
 perform pg_catalog.set_config('request.jwt.claims',pg_catalog.jsonb_build_object('role','authenticated','sub',actor)::text,true);
end $$;
-- One accepted, wallet-paid order with a ready proof. spend: 'none' | 'spent' | 'returned'.
create function pg_temp.wallet_order(c uuid,t uuid,admin uuid,spend text) returns jsonb language plpgsql as $$
declare o uuid:=pg_catalog.gen_random_uuid(); a uuid:=pg_catalog.gen_random_uuid(); i uuid:=pg_catalog.gen_random_uuid();
 p uuid:=pg_catalog.gen_random_uuid(); s uuid:=pg_catalog.gen_random_uuid(); n timestamptz:=pg_catalog.clock_timestamp();
begin
 insert into public.orders(id,customer_id,game,service,title,units,unit,region,ign,customer_name,amount_eur_cents,booking_fx,payout_usd_cents,wallet_eur_cents,created_at,queued_at)
 values(o,c,'lol','duo','Wallet fixture',1,'game','EUW','Fixture','Customer',249,1.08,165,249,n,n);
 insert into public.order_assignments(id,order_id,teammate_id,accepted_at) values(a,o,t,n);
 update public.orders set status='in_progress',assigned_teammate_id=t,current_assignment_id=a,accepted_at=n where id=o;
 insert into public.order_proof_uploads(id,order_id,assignment_id,uploader_id,request_id,state,mime,byte_size,sha256,created_at,ready_at)
 values(p,o,a,t,pg_catalog.gen_random_uuid(),'ready','image/png',12,pg_catalog.repeat('a',64),n,n);
 insert into public.checkout_intents(id,customer_id,game,service,title,units,unit,region,ign,amount_eur_cents,payout_usd_cents,booking_fx,wallet_eur_cents,expires_at)
 values(i,c,'lol','duo','Wallet fixture',1,'game','EUW','Fixture',249,165,1.08,249,n+interval '1 hour');
 if spend <> 'none' then
  insert into public.wallet_entries(customer_id,amount_eur_cents,kind,cashable,created_by,reason) values(c,249,'admin_credit',false,admin,'Wallet completion test setup');
  insert into public.wallet_entries(id,customer_id,amount_eur_cents,kind,cashable,order_id,checkout_intent_id,reason) values(s,c,-249,'checkout_spend',false,o,i,'Paid for order');
 end if;
 if spend = 'returned' then
  insert into public.wallet_entries(customer_id,amount_eur_cents,kind,cashable,order_id,checkout_intent_id,reverses_id,reason) values(c,249,'checkout_release',false,o,i,s,'Wallet completion test return');
 end if;
 return pg_catalog.jsonb_build_object('order',o,'assignment',a,'proof',p);
end $$;

insert into auth.users(id,aud,role,email,raw_user_meta_data,raw_app_meta_data) values
 ('5d000000-0000-4000-8000-000000000001','authenticated','authenticated','wallet-paid@example.invalid','{}','{}'),
 ('5d000000-0000-4000-8000-000000000002','authenticated','authenticated','wallet-returned@example.invalid','{}','{}'),
 ('5d000000-0000-4000-8000-000000000003','authenticated','authenticated','wallet-unspent@example.invalid','{}','{}'),
 ('5d000000-0000-4000-8000-000000000004','authenticated','authenticated','wallet-teammate@example.invalid','{}','{}'),
 ('5d000000-0000-4000-8000-000000000005','authenticated','authenticated','wallet-admin@example.invalid','{}','{}');
update public.account_roles set role='teammate' where user_id='5d000000-0000-4000-8000-000000000004';
insert into public.teammate_order_access(user_id,approved_games,discord_id,discord_verified_at,priority_base)
values('5d000000-0000-4000-8000-000000000004',array['lol'],'95d0000000000000004',pg_catalog.clock_timestamp(),0);

do $$
declare t uuid:='5d000000-0000-4000-8000-000000000004'; adm uuid:='5d000000-0000-4000-8000-000000000005';
 paid jsonb; returned jsonb; unspent jsonb; v jsonb;
begin
 paid:=pg_temp.wallet_order('5d000000-0000-4000-8000-000000000001',t,adm,'spent');
 returned:=pg_temp.wallet_order('5d000000-0000-4000-8000-000000000002',t,adm,'returned');
 unspent:=pg_temp.wallet_order('5d000000-0000-4000-8000-000000000003',t,adm,'none');
 perform pg_temp.wallet_assert(public.order_wallet_paid((paid->>'order')::uuid),'paid in full from the wallet');
 perform pg_temp.wallet_assert(not public.order_wallet_paid((returned->>'order')::uuid),'a returned spend no longer pays the order');
 perform pg_temp.wallet_assert(not public.order_wallet_paid((unspent->>'order')::uuid),'a wallet amount without a spend pays nothing');
 perform pg_catalog.set_config('wallet.fixture',pg_catalog.jsonb_build_object('paid',paid,'returned',returned,'unspent',unspent)::text,true);
end $$;

set local role authenticated;
do $$
declare f jsonb:=pg_catalog.current_setting('wallet.fixture')::jsonb; v jsonb; k text;
begin
 perform pg_temp.wallet_login('5d000000-0000-4000-8000-000000000004');
 v:=public.complete_order((f#>>'{paid,order}')::uuid,(f#>>'{paid,assignment}')::uuid,array[(f#>>'{paid,proof}')::uuid],pg_catalog.gen_random_uuid());
 perform pg_temp.wallet_assert(v #>> '{completion,payout_usd_cents}' = '165','wallet-paid order completes with its full payout');
 foreach k in array array['returned','unspent'] loop
  v:=public.complete_order((f#>>array[k,'order'])::uuid,(f#>>array[k,'assignment'])::uuid,array[(f#>>array[k,'proof'])::uuid],pg_catalog.gen_random_uuid());
  perform pg_temp.wallet_assert(v ? 'error' and v::text like '%Captured settled payment required.%','refused without a wallet spend: ' || k);
 end loop;
end $$;
reset role;
do $$
declare f jsonb:=pg_catalog.current_setting('wallet.fixture')::jsonb;
begin
 perform pg_temp.wallet_assert(exists(select 1 from public.orders where id=(f#>>'{paid,order}')::uuid and status='completed'),'order completed');
 perform pg_temp.wallet_assert(exists(select 1 from public.order_assignments where id=(f#>>'{paid,assignment}')::uuid and end_reason='completed'),'assignment ended');
 perform pg_temp.wallet_assert(exists(select 1 from public.orders where id=(f#>>'{returned,order}')::uuid and status='in_progress'),'returned stays open');
end $$;

select 'wallet completion passed' as result;
rollback;
