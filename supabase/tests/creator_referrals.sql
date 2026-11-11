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

-- Rollback-only checks for 20261025110000_creator_referrals.sql.
-- Run with the migration body (without its begin/commit) inserted right after this begin, in one transaction:
--   (echo 'begin;'; sed '/^begin;$/d;/^commit;$/d' supabase/migrations/20261025110000_creator_referrals.sql; sed '1,/^begin;$/d' supabase/tests/creator_referrals.sql) > "$TMPDIR/cr.sql"
-- Execute only using disposable local CI.
begin;
insert into auth.users (id,aud,role,email,raw_user_meta_data,raw_app_meta_data) values
 ('6c000000-0000-4000-8000-000000000001','authenticated','authenticated','cr-admin@example.invalid','{}','{}'),
 ('6c000000-0000-4000-8000-000000000002','authenticated','authenticated','cr-viewer@example.invalid','{}','{}'),
 ('6c000000-0000-4000-8000-000000000003','authenticated','authenticated','cr-regular@example.invalid','{}','{}'),
 ('6c000000-0000-4000-8000-000000000004','authenticated','authenticated','cr-paused@example.invalid','{}','{}'),
 ('6c000000-0000-4000-8000-000000000005','authenticated','authenticated','cr-old@example.invalid','{}','{}'),
 ('6c000000-0000-4000-8000-000000000009','authenticated','authenticated','cr-mate@example.invalid','{}','{}');
update public.profiles set name=case id
  when '6c000000-0000-4000-8000-000000000001' then 'Creator Admin'
  when '6c000000-0000-4000-8000-000000000009' then 'Creator Mate'
  else 'Viewer' end
 where id::text like '6c000000-0000-4000-8000-00000000000%';
update public.account_roles set role='admin' where user_id='6c000000-0000-4000-8000-000000000001';
update public.account_roles set role='teammate' where user_id='6c000000-0000-4000-8000-000000000009';
insert into public.teammate_order_access(user_id,approved_games,discord_id,discord_verified_at) values
 ('6c000000-0000-4000-8000-000000000009',array['lol'],'600000000000000009',now());

-- Test helpers (temporary schema, gone with the transaction).
create function pg_temp.intent(p_customer uuid, p_ref text, p_amount integer default 1887, p_spoof uuid default null) returns uuid
language sql as $$
  insert into public.checkout_intents(customer_id,game,service,title,units,unit,region,ign,amount_eur_cents,payout_usd_cents,booking_fx,expires_at,ref_code,creator_id)
  values (p_customer,'lol','duo','Duo',1,'game','EUW','Viewer#EUW',p_amount,1200,1.1,now()+interval '30 minutes',p_ref,p_spoof)
  returning id;
$$;
create function pg_temp.pay(p_intent uuid) returns uuid
language plpgsql as $$
declare r jsonb;
begin
  r := public.create_paid_order(p_intent,'pi_cr'||pg_catalog.replace(p_intent::text,'-',''),
    (select amount_eur_cents from public.checkout_intents where id=p_intent),'eur','card','authorized');
  if r->>'order_id' is null then raise exception 'pay failed: %', r; end if;
  return (r->>'order_id')::uuid;
end $$;
create function pg_temp.complete(p_order uuid) returns void
language plpgsql as $$
declare a uuid := pg_catalog.gen_random_uuid(); t timestamptz := pg_catalog.clock_timestamp();
begin
  insert into public.order_assignments(id,order_id,teammate_id,accepted_at,ended_at,end_reason)
    values(a,p_order,'6c000000-0000-4000-8000-000000000009',t,t,'completed');
  update public.orders set status='completed',assigned_teammate_id='6c000000-0000-4000-8000-000000000009',
    current_assignment_id=a,accepted_at=t,completed_at=t where id=p_order;
end $$;

-- A customer gets 403 from every creator command and cannot read or write the tables.
set local role authenticated;
select pg_catalog.set_config('request.jwt.claims','{"role":"authenticated","sub":"6c000000-0000-4000-8000-000000000002"}',true);
select pg_catalog.set_config('request.jwt.claim.sub','6c000000-0000-4000-8000-000000000002',true);
do $$ begin
 if (public.admin_creators()->'error'->>'code')::int <> 403 then raise exception 'customer read creators'; end if;
 if (public.admin_create_creator('SELF','Self',null)->'error'->>'code')::int <> 403 then raise exception 'customer created creator'; end if;
 if (public.admin_set_creator_active(pg_catalog.gen_random_uuid(),false)->'error'->>'code')::int <> 403 then raise exception 'customer paused creator'; end if;
end $$;
do $$ begin perform 1 from public.creators limit 1; raise exception 'customer read creators table';
exception when insufficient_privilege then null; end $$;
do $$ begin perform 1 from public.customer_referrals limit 1; raise exception 'customer read customer_referrals';
exception when insufficient_privilege then null; end $$;
do $$ begin
  insert into public.customer_referrals(customer_id,creator_id,code,first_order_id)
    values ('6c000000-0000-4000-8000-000000000002',pg_catalog.gen_random_uuid(),'SELF',pg_catalog.gen_random_uuid());
  raise exception 'customer wrote customer_referrals';
exception when insufficient_privilege then null; end $$;
do $$ begin
  update public.checkout_intents set ref_code='SELF' where customer_id='6c000000-0000-4000-8000-000000000002';
  raise exception 'customer wrote checkout_intents';
exception when insufficient_privilege then null; end $$;
do $$ begin perform public.checkout_intent_attribute(); raise exception 'customer called trigger function';
exception when insufficient_privilege or feature_not_supported then null; end $$;

-- Admin adds creators: code normalised, validated, unique; every command audited.
select pg_catalog.set_config('request.jwt.claims','{"role":"authenticated","sub":"6c000000-0000-4000-8000-000000000001"}',true);
select pg_catalog.set_config('request.jwt.claim.sub','6c000000-0000-4000-8000-000000000001',true);
do $$ declare r jsonb; begin
 if (public.admin_create_creator('no','Bad code','')->'error'->>'code')::int <> 400 then raise exception 'short code accepted'; end if;
 if (public.admin_create_creator('BAD CODE!','Bad code','')->'error'->>'code')::int <> 400 then raise exception 'bad code accepted'; end if;
 if (public.admin_create_creator('GOODCODE','x','')->'error'->>'code')::int <> 400 then raise exception 'short name accepted'; end if;
 r := public.admin_create_creator('  alpha10 ','Alpha Streams','twitch.tv/alpha');
 if r->'creator'->>'code' <> 'ALPHA10' or not (r->'creator'->>'active')::boolean or r->'creator'->>'createdBy' <> 'Creator Admin'
   or (r->'creator'->>'owedCents')::int <> 0 then raise exception 'create wrong: %', r; end if;
 if (public.admin_create_creator('ALPHA10','Copy','')->'error'->>'code')::int <> 409 then raise exception 'duplicate code accepted'; end if;
 perform public.admin_create_creator('BETA','Beta Plays','');
 perform public.admin_create_creator('PAUSED','Paused Creator','');
 perform public.admin_create_creator('GAMMA','Gamma Big','');
end $$;
do $$ declare r jsonb; v uuid; begin
 select (x->>'id')::uuid into v from pg_catalog.jsonb_array_elements(public.admin_creators()->'creators') x where x->>'code'='PAUSED';
 if (public.admin_set_creator_active(pg_catalog.gen_random_uuid(),false)->'error'->>'code')::int <> 404 then raise exception 'unknown creator not 404'; end if;
 r := public.admin_set_creator_active(v,false);
 if (r->'creator'->>'active')::boolean then raise exception 'pause wrong: %', r; end if;
end $$;
reset role;
do $$ begin
 if (select count(*) from public.admin_audit_log where action='Added creator' and actor_name='Creator Admin') <> 4 then raise exception 'create audit missing'; end if;
 if not exists (select 1 from public.admin_audit_log where action='Added creator' and target='Alpha Streams' and detail='ALPHA10') then raise exception 'create audit detail'; end if;
 if not exists (select 1 from public.admin_audit_log where action='Paused creator' and target='Paused Creator' and detail='PAUSED') then raise exception 'pause audit missing'; end if;
 if exists (select 1 from public.admin_audit_log where actor_name='Viewer') then raise exception 'refused command audited'; end if;
end $$;

-- The checkout's creator is resolved from the code server side; a passed creator_id is ignored.
do $$ declare i uuid; o uuid; beta uuid; spoof uuid; v public.checkout_intents; begin
 select id into beta from public.creators where code='BETA';
 i := pg_temp.intent('6c000000-0000-4000-8000-000000000002','ALPHA10',1887,beta);
 select * into v from public.checkout_intents where id=i;
 if v.creator_id is distinct from (select id from public.creators where code='ALPHA10') then raise exception 'creator not resolved from code: %', v.creator_id; end if;
 if pg_temp.intent('6c000000-0000-4000-8000-000000000003','NOSUCH',1000,beta) is null then raise exception 'unknown code broke checkout'; end if;
 if (select creator_id from public.checkout_intents where customer_id='6c000000-0000-4000-8000-000000000003' and ref_code='NOSUCH') is not null then
   raise exception 'unknown code resolved'; end if;
 spoof := pg_temp.intent('6c000000-0000-4000-8000-000000000003',null,1000,beta);
 if (select creator_id from public.checkout_intents where id = spoof) is not null then
   raise exception 'passed creator_id kept without a code'; end if;
 -- The code on a checkout cannot change afterwards.
 begin
   update public.checkout_intents set ref_code='BETA' where id=i;
   raise exception 'intent ref changed';
 exception when object_not_in_prerequisite_state then null; end;

 -- First paid order: the viewer is attributed to ALPHA10, once.
 o := pg_temp.pay(i);
 if not exists (select 1 from public.customer_referrals where customer_id='6c000000-0000-4000-8000-000000000002'
   and code='ALPHA10' and first_order_id=o) then raise exception 'viewer not attributed'; end if;
 if not exists (select 1 from public.order_referrals where order_id=o and amount_eur_cents=1887
   and creator_id=(select id from public.creators where code='ALPHA10')) then raise exception 'first order not counted'; end if;
 -- Webhook replay creates nothing new.
 if pg_temp.pay(i) <> o then raise exception 'replay made a new order'; end if;
 if (select count(*) from public.order_referrals where customer_id='6c000000-0000-4000-8000-000000000002') <> 1 then raise exception 'replay counted twice'; end if;
 perform pg_temp.complete(o);

 -- Second order arrives with another creator's code: the viewer stays with ALPHA10.
 o := pg_temp.pay(pg_temp.intent('6c000000-0000-4000-8000-000000000002','BETA',2500));
 if (select code from public.customer_referrals where customer_id='6c000000-0000-4000-8000-000000000002') <> 'ALPHA10' then raise exception 'attribution overwritten'; end if;
 if (select creator_id from public.order_referrals where order_id=o) is distinct from (select id from public.creators where code='ALPHA10') then
   raise exception 'second order went to the new code'; end if;
 -- Third order without any code still counts for ALPHA10 (the 12 months run from attribution).
 perform pg_temp.complete(o);
 o := pg_temp.pay(pg_temp.intent('6c000000-0000-4000-8000-000000000002',null,1000));
 if not exists (select 1 from public.order_referrals where order_id=o) then raise exception 'codeless repeat order not counted'; end if;
end $$;

-- Attribution is permanent, even for the database owner.
do $$ begin
 update public.customer_referrals set code='BETA' where customer_id='6c000000-0000-4000-8000-000000000002';
 raise exception 'customer_referrals updated';
exception when object_not_in_prerequisite_state then null; end $$;
do $$ begin
 delete from public.order_referrals where customer_id='6c000000-0000-4000-8000-000000000002';
 raise exception 'order_referrals deleted';
exception when object_not_in_prerequisite_state then null; end $$;

-- A customer with earlier orders is not a referred viewer.
do $$ declare o uuid; begin
 o := pg_temp.pay(pg_temp.intent('6c000000-0000-4000-8000-000000000003',null,1000));
 perform pg_temp.complete(o);
 o := pg_temp.pay(pg_temp.intent('6c000000-0000-4000-8000-000000000003','ALPHA10',1000));
 if exists (select 1 from public.customer_referrals where customer_id='6c000000-0000-4000-8000-000000000003') then raise exception 'existing customer attributed'; end if;
 if exists (select 1 from public.order_referrals where order_id=o) then raise exception 'existing customer order counted'; end if;
end $$;

-- Pausing after checkout creation still blocks a new attribution when payment arrives.
do $$ declare i uuid; o uuid; begin
 update public.creators set active=true where code='PAUSED';
 i := pg_temp.intent('6c000000-0000-4000-8000-000000000004','PAUSED',1000);
 update public.creators set active=false where code='PAUSED';
 o := pg_temp.pay(i);
 if exists (select 1 from public.customer_referrals where customer_id='6c000000-0000-4000-8000-000000000004') then raise exception 'creator paused before payment attributed'; end if;
end $$;

-- Orders after the 12 months do not count.
do $$ declare o uuid; begin
 insert into public.orders(id,customer_id,customer_name,game,service,title,units,unit,rank,region,ign,amount_eur_cents,payout_usd_cents,booking_fx,status,cancelled_at,cancel_reason,created_at,queued_at)
  values('6c100000-0000-4000-8000-000000000001','6c000000-0000-4000-8000-000000000005','Viewer','lol','duo','Duo',1,'game','','EUW','Old',1000,600,1.1,
   'cancelled',now()-interval '13 months'+interval '1 minute','queue_expired',now()-interval '13 months',now()-interval '13 months');
 insert into public.customer_referrals(customer_id,creator_id,code,first_order_id,attributed_at)
  values('6c000000-0000-4000-8000-000000000005',(select id from public.creators where code='BETA'),'BETA','6c100000-0000-4000-8000-000000000001',now()-interval '13 months');
 o := pg_temp.pay(pg_temp.intent('6c000000-0000-4000-8000-000000000005','BETA',1000));
 if exists (select 1 from public.order_referrals where order_id=o) then raise exception 'order after 12 months counted'; end if;
end $$;

-- Tier: 25 counted orders in a month make GAMMA a Partner (10%) for the whole month.
do $$ declare n int; c uuid; o uuid; begin
 for n in 1..25 loop
   c := ('6c200000-0000-4000-8000-0000000000'||pg_catalog.lpad(n::text,2,'0'))::uuid;
   insert into auth.users (id,aud,role,email,raw_user_meta_data,raw_app_meta_data)
     values (c,'authenticated','authenticated','cr-g'||n||'@example.invalid','{}','{}');
   o := pg_temp.pay(pg_temp.intent(c,'GAMMA',1000));
   perform pg_temp.complete(o);
 end loop;
end $$;

-- What the admin screen reads.
set local role authenticated;
select pg_catalog.set_config('request.jwt.claims','{"role":"authenticated","sub":"6c000000-0000-4000-8000-000000000001"}',true);
select pg_catalog.set_config('request.jwt.claim.sub','6c000000-0000-4000-8000-000000000001',true);
do $$ declare r jsonb; a jsonb; g jsonb; b jsonb; begin
 r := public.admin_creators();
 if (r->'rules'->>'months')::int <> 12 or (r->'rules'->>'payoutMinCents')::int <> 5000
   or r->'rules'->'tiers'->1->>'id' <> 'partner' or (r->'rules'->'tiers'->1->>'from')::int <> 25 then raise exception 'rules wrong: %', r->'rules'; end if;
 a := (select x from pg_catalog.jsonb_array_elements(r->'creators') x where x->>'code'='ALPHA10');
 -- Two completed orders (1887 + 2500) at Rising 8%; the third is still queued.
 if (a->>'customers')::int <> 1 or (a->>'orders')::int <> 3 or (a->>'openOrders')::int <> 1
   or (a->>'owedCents')::int <> 351 or (a->'months'->0->>'orders')::int <> 2 or a->'months'->0->>'tier' <> 'rising'
   or (a->'months'->0->>'baseCents')::int <> 4387 then raise exception 'alpha wrong: %', a; end if;
 g := (select x from pg_catalog.jsonb_array_elements(r->'creators') x where x->>'code'='GAMMA');
 if (g->>'owedCents')::int <> 2500 or g->'months'->0->>'tier' <> 'partner' or (g->'months'->0->>'commission')::int <> 10 then
   raise exception 'gamma tier wrong: %', g; end if;
 b := (select x from pg_catalog.jsonb_array_elements(r->'creators') x where x->>'code'='BETA');
 if (b->>'customers')::int <> 1 or (b->>'orders')::int <> 0 then raise exception 'beta wrong: %', b; end if;
 if pg_catalog.jsonb_array_length(r->'orders') <> 28 or r->'orders'->0->>'id' not like 'DL-%' then raise exception 'orders list wrong: %', pg_catalog.jsonb_array_length(r->'orders'); end if;
end $$;

-- A refunded payment stops counting.
reset role;
update public.order_payments set state='refunded' where order_id=(select first_order_id from public.customer_referrals where customer_id='6c000000-0000-4000-8000-000000000002');
set local role authenticated;
select pg_catalog.set_config('request.jwt.claims','{"role":"authenticated","sub":"6c000000-0000-4000-8000-000000000001"}',true);
select pg_catalog.set_config('request.jwt.claim.sub','6c000000-0000-4000-8000-000000000001',true);
do $$ declare a jsonb; begin
 a := (select x from pg_catalog.jsonb_array_elements(public.admin_creators()->'creators') x where x->>'code'='ALPHA10');
 if (a->>'owedCents')::int <> 200 then raise exception 'refunded order still owed: %', a; end if;
end $$;
reset role;

select 'ALL CHECKS PASSED' as result;
rollback;
