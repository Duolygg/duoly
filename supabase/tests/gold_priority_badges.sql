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

-- Rollback-only checks for 20261026110000_gold_priority_badges.sql (M7: P2 Gold priority, D5 badges).
-- Build: python3 supabase/tests/build_gold_priority_rollback.py <out.sql>
-- SQL tests run only through the disposable local CI runner.
begin;

create function pg_temp.m7_assert(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'm7 assertion: %',label; end if; end $$;
create function pg_temp.login(actor uuid) returns void language plpgsql as $$
begin
  perform pg_catalog.set_config('request.jwt.claim.sub',actor::text,true);
  perform pg_catalog.set_config('request.jwt.claims',pg_catalog.jsonb_build_object('role','authenticated','sub',actor)::text,true);
end $$;

-- Valid completed, card-paid orders. These count for both customer loyalty and teammate trust.
create function pg_temp.history(c uuid,t uuid,n integer) returns uuid language plpgsql as $$
declare k integer; o uuid; a uuid; i uuid; at timestamptz;
begin
  for k in 1..n loop
    o:=pg_catalog.gen_random_uuid(); a:=pg_catalog.gen_random_uuid(); i:=pg_catalog.gen_random_uuid();
    at:=pg_catalog.clock_timestamp()-interval '40 days'+k*interval '1 second';
    insert into public.orders(id,customer_id,game,service,title,units,unit,region,ign,customer_name,amount_eur_cents,booking_fx,payout_usd_cents,created_at,queued_at)
      values(o,c,'lol','duo','M7 history',1,'game','EUW','Fixture','Customer',999,1.08,600,at,at);
    insert into public.order_assignments(id,order_id,teammate_id,accepted_at,ended_at,end_reason) values(a,o,t,at,at,'completed');
    update public.orders set status='completed',assigned_teammate_id=t,current_assignment_id=a,accepted_at=at,completed_at=at where id=o;
    insert into public.checkout_intents(id,customer_id,game,service,title,units,unit,region,ign,amount_eur_cents,payout_usd_cents,booking_fx,expires_at)
      values(i,c,'lol','duo','M7 history',1,'game','EUW','Fixture',999,600,1.08,at+interval '1 hour');
    insert into public.order_payments(order_id,intent_id,stripe_payment_intent_id,amount_minor,currency,amount_eur_cents,payment_method_type,state,settle)
      values(o,i,'pi_m7'||pg_catalog.replace(i::text,'-',''),999,'eur',999,'card','captured','none');
    insert into public.teammate_earning_entries(order_id,assignment_id,teammate_id,request_id,proof_ids,completed_at,prior_completed_count,trust_tier,payout_usd_cents,deposit_percent,held_usd_cents,net_usd_cents,source_snapshot,result)
      values(o,a,t,pg_catalog.gen_random_uuid(),array[pg_catalog.gen_random_uuid()],at,0,'rookie',600,10,60,540,'{}','{}');
  end loop;
  return o;
end $$;
create function pg_temp.queued(id uuid,c uuid,age interval) returns uuid language plpgsql as $$
declare at timestamptz:=pg_catalog.clock_timestamp()-age;
begin
  if c is null then
    c:=pg_catalog.gen_random_uuid();
    insert into auth.users(id,aud,role,email,raw_user_meta_data,raw_app_meta_data)
      values(c,'authenticated','authenticated','m7-'||c||'@example.invalid','{}','{}');
  end if;
  insert into public.orders(id,customer_id,game,service,title,units,unit,region,ign,customer_name,amount_eur_cents,booking_fx,payout_usd_cents,created_at,queued_at)
    values(id,c,'lol','duo','Duo',1,'game','EUW','M7Tester','M7 Customer',1000,1.08,600,at,at);
  return id;
end $$;

insert into auth.users(id,aud,role,email,raw_user_meta_data,raw_app_meta_data) values
 ('7a000000-0000-4000-8000-000000000001','authenticated','authenticated','m7-worker@example.invalid','{}','{}'),
 ('7a000000-0000-4000-8000-000000000002','authenticated','authenticated','m7-badge@example.invalid','{}','{}'),
 ('7a000000-0000-4000-8000-000000000003','authenticated','authenticated','m7-gold@example.invalid','{}','{}'),
 ('7a000000-0000-4000-8000-000000000004','authenticated','authenticated','m7-silver@example.invalid','{}','{}'),
 ('7a000000-0000-4000-8000-000000000005','authenticated','authenticated','m7-history@example.invalid','{}','{}');
update public.profiles set name=case id
 when '7a000000-0000-4000-8000-000000000001' then 'Queue Mate'
 when '7a000000-0000-4000-8000-000000000002' then 'Badge Mate'
 else 'M7 Customer' end
where id::text like '7a000000-0000-4000-8000-00000000000%';
update public.account_roles set role='teammate' where user_id in
 ('7a000000-0000-4000-8000-000000000001','7a000000-0000-4000-8000-000000000002');
insert into public.teammate_order_access(user_id,approved_games,discord_id,discord_verified_at) values
 ('7a000000-0000-4000-8000-000000000001',array['lol'],'700000000000000001',now()),
 ('7a000000-0000-4000-8000-000000000002',array['lol'],'700000000000000002',now());

-- New storage and helpers remain private. Customer RPCs expose only the badge on their own order.
set local role authenticated;
select pg_temp.login('7a000000-0000-4000-8000-000000000003');
do $$ begin perform 1 from public.order_priority_boosts limit 1; raise exception 'authenticated read boosts';
exception when insufficient_privilege then null; end $$;
do $$ begin perform public.order_has_head_start(gen_random_uuid()); raise exception 'authenticated ran head start helper';
exception when insufficient_privilege then null; end $$;
do $$ begin perform public.teammate_trust_badge('7a000000-0000-4000-8000-000000000002'); raise exception 'authenticated ran badge helper';
exception when insufficient_privilege then null; end $$;
reset role;
set local role anon;
do $$ begin perform 1 from public.order_priority_boosts limit 1; raise exception 'anon read boosts';
exception when insufficient_privilege then null; end $$;
reset role;
set local role service_role;
do $$ begin perform 1 from public.order_priority_boosts limit 1; raise exception 'service role read boosts';
exception when insufficient_privilege then null; end $$;
reset role;

-- Badge boundaries use the live D4 valid count: below 100 none, 100 to 999 Trusted, 1000 Legend.
select pg_catalog.set_config('m7.last',pg_temp.history('7a000000-0000-4000-8000-000000000005','7a000000-0000-4000-8000-000000000002',99)::text,true);
select pg_temp.m7_assert(public.teammate_trust_badge('7a000000-0000-4000-8000-000000000002') is null,'99 has no badge');
select pg_catalog.set_config('m7.last',pg_temp.history('7a000000-0000-4000-8000-000000000005','7a000000-0000-4000-8000-000000000002',1)::text,true);
select pg_temp.m7_assert(public.teammate_trust_badge('7a000000-0000-4000-8000-000000000002')=pg_catalog.jsonb_build_object('id','trusted','name','Trusted'),'100 is Trusted');

-- Gold starts at the level before the queued order. Silver and fresh customers stay unboosted.
select pg_temp.history('7a000000-0000-4000-8000-000000000003','7a000000-0000-4000-8000-000000000002',250);
select pg_catalog.set_config('m7.silver_last',pg_temp.history('7a000000-0000-4000-8000-000000000004','7a000000-0000-4000-8000-000000000002',249)::text,true);
select pg_temp.queued('7a100000-0000-4000-8000-000000000001','7a000000-0000-4000-8000-000000000003',interval '70 seconds');
select pg_temp.queued('7a100000-0000-4000-8000-000000000002',null,interval '60 seconds');
select pg_temp.queued('7a100000-0000-4000-8000-000000000003',null,interval '80 seconds');
select pg_temp.queued('7a100000-0000-4000-8000-000000000004','7a000000-0000-4000-8000-000000000004',interval '90 seconds');
select pg_temp.m7_assert((select customer_level='gold' and prior_completed_count=250 from public.order_priority_boosts where order_id='7a100000-0000-4000-8000-000000000001'),'Gold snapshot uses prior 250');
select pg_temp.m7_assert(not public.order_has_head_start('7a100000-0000-4000-8000-000000000002'),'fresh order unaffected');
select pg_temp.m7_assert(not public.order_has_head_start('7a100000-0000-4000-8000-000000000004'),'Silver order unaffected');

-- Gold is first in line for a teammate once existing priority eligibility allows all four. Normal orders
-- remain visible and retain newest-first ordering. No customer level or boost leaks into teammate DTOs.
set local role authenticated;
select pg_temp.login('7a000000-0000-4000-8000-000000000001');
do $$ declare q jsonb; ids text[]; begin
  q:=public.teammate_order_queue();
  select pg_catalog.array_agg(x->>'id' order by n) into ids from pg_catalog.jsonb_array_elements(q->'orders') with ordinality e(x,n) where x->>'id' like '7a100000-%';
  perform pg_temp.m7_assert(ids=array['7a100000-0000-4000-8000-000000000001','7a100000-0000-4000-8000-000000000002','7a100000-0000-4000-8000-000000000003','7a100000-0000-4000-8000-000000000004'],'queue order '||coalesce(ids::text,'null'));
  perform pg_temp.m7_assert(q::text !~* 'loyalty_gold|platinum|diamond|head_start|priority','teammate DTO hides boost');
end $$;
reset role;
select pg_temp.m7_assert((select amount_eur_cents=1000 and payout_usd_cents=600 from public.orders where id='7a100000-0000-4000-8000-000000000001'),'price and teammate pay unchanged');

-- A refund lowers the live level, but the queued snapshot stays fixed until the order re-enters the queue.
update public.order_payments set state='refunded' where order_id=(select o.id from public.orders o where o.customer_id='7a000000-0000-4000-8000-000000000003' and o.status='completed' order by o.completed_at desc,o.id desc limit 1);
select pg_temp.m7_assert(public.loyalty_valid_count('7a000000-0000-4000-8000-000000000003')=249,'refund lowers Gold count');
select pg_temp.m7_assert(public.order_has_head_start('7a100000-0000-4000-8000-000000000001'),'snapshot remains during same queue entry');
update public.orders set queued_at=pg_catalog.clock_timestamp() where id='7a100000-0000-4000-8000-000000000001';
select pg_temp.m7_assert(not public.order_has_head_start('7a100000-0000-4000-8000-000000000001'),'requeue resnapshots lower level');

-- Reach 999 and 1000 using valid completions. The order customer DTO keeps all M6 keys and exposes the
-- Legend badge only for the teammate assigned to that customer's own order.
select pg_temp.history('7a000000-0000-4000-8000-000000000005','7a000000-0000-4000-8000-000000000002',401);
select pg_temp.m7_assert(public.payout_valid_count('7a000000-0000-4000-8000-000000000002')=999,'valid count 999');
select pg_temp.m7_assert(public.teammate_trust_badge('7a000000-0000-4000-8000-000000000002')=pg_catalog.jsonb_build_object('id','trusted','name','Trusted'),'999 stays Trusted');
select pg_catalog.set_config('m7.last',pg_temp.history('7a000000-0000-4000-8000-000000000005','7a000000-0000-4000-8000-000000000002',1)::text,true);
select pg_temp.m7_assert(public.teammate_trust_badge('7a000000-0000-4000-8000-000000000002')=pg_catalog.jsonb_build_object('id','legend','name','Legend'),'1000 is Legend');
set local role authenticated;
select pg_temp.login('7a000000-0000-4000-8000-000000000005');
do $$ declare d jsonb; begin
  d:=public.customer_order(current_setting('m7.last')::uuid)->'order';
  perform pg_temp.m7_assert(d#>'{teammate,trust_badge}'=pg_catalog.jsonb_build_object('id','legend','name','Legend'),'customer sees Legend');
  perform pg_temp.m7_assert(d ? 'tip' and d ? 'review' and d ? 'reports' and d#>'{teammate,languages}' is not null,'latest order DTO keys kept');
end $$;
reset role;

select pg_temp.m7_assert(has_function_privilege('authenticated','public.teammate_order_queue()','execute')
  and not has_function_privilege('anon','public.teammate_order_queue()','execute')
  and not has_function_privilege('authenticated','public.order_has_head_start(uuid)','execute')
  and not has_function_privilege('service_role','public.teammate_trust_badge(uuid)','execute'),'grants');
select 'gold priority and badges ok' as result;
rollback;
