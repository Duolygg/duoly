-- Rollback-only checks for 20261026160000_perks.sql (free monthly Play and Learn, pick any teammate,
-- Veteran high-value head start, Elite priority matching).
-- Build: python3 supabase/tests/build_perks_rollback.py <out.sql>
-- Run: node_modules/.bin/supabase db query --linked -f <out.sql>
begin;

create function pg_temp.pk_assert(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'perks assertion: %',label; end if; end $$;
create function pg_temp.login(actor uuid) returns void language plpgsql as $$
begin
  perform pg_catalog.set_config('request.jwt.claim.sub',actor::text,true);
  perform pg_catalog.set_config('request.jwt.claims',pg_catalog.jsonb_build_object('role','authenticated','sub',actor)::text,true);
end $$;

-- Valid completed, card-paid orders: count for customer loyalty and teammate trust.
create function pg_temp.history(c uuid,t uuid,n integer) returns uuid language plpgsql as $$
declare k integer; o uuid; a uuid; i uuid; at timestamptz;
begin
  for k in 1..n loop
    o:=pg_catalog.gen_random_uuid(); a:=pg_catalog.gen_random_uuid(); i:=pg_catalog.gen_random_uuid();
    at:=pg_catalog.clock_timestamp()-interval '40 days'+k*interval '1 second';
    insert into public.orders(id,customer_id,game,service,title,units,unit,region,ign,customer_name,amount_eur_cents,booking_fx,payout_usd_cents,created_at,queued_at)
      values(o,c,'lol','duo','Perk history',1,'game','EUW','Fixture','Customer',999,1.08,600,at,at);
    insert into public.order_assignments(id,order_id,teammate_id,accepted_at,ended_at,end_reason) values(a,o,t,at,at,'completed');
    update public.orders set status='completed',assigned_teammate_id=t,current_assignment_id=a,accepted_at=at,completed_at=at where id=o;
    insert into public.checkout_intents(id,customer_id,game,service,title,units,unit,region,ign,amount_eur_cents,payout_usd_cents,booking_fx,expires_at)
      values(i,c,'lol','duo','Perk history',1,'game','EUW','Fixture',999,600,1.08,at+interval '1 hour');
    insert into public.order_payments(order_id,intent_id,stripe_payment_intent_id,amount_minor,currency,amount_eur_cents,payment_method_type,state,settle)
      values(o,i,'pi_pk'||pg_catalog.replace(i::text,'-',''),999,'eur',999,'card','captured','none');
    insert into public.teammate_earning_entries(order_id,assignment_id,teammate_id,request_id,proof_ids,completed_at,prior_completed_count,trust_tier,payout_usd_cents,deposit_percent,held_usd_cents,net_usd_cents,source_snapshot,result)
      values(o,a,t,pg_catalog.gen_random_uuid(),array[pg_catalog.gen_random_uuid()],at,0,'rookie',600,10,60,540,'{}','{}');
  end loop;
  return o;
end $$;
-- An open checkout intent; returns its id.
create function pg_temp.intent(c uuid,game text,service text,units integer,unit text,cents integer,free boolean,pick uuid,pro integer default 0) returns uuid language plpgsql as $$
declare i uuid:=pg_catalog.gen_random_uuid();
begin
  insert into public.checkout_intents(id,customer_id,game,service,title,units,unit,region,ign,amount_eur_cents,payout_usd_cents,booking_fx,expires_at,free_coaching,pick_source_order_id,pro_discount_cents)
    values(i,c,game,service,'Perk order',units,unit,'EUW','PerkTester',cents,700,1.08,pg_catalog.clock_timestamp()+interval '1 hour',free,pick,pro);
  return i;
end $$;
-- A plain queued order of a given value and age.
create function pg_temp.queued(id uuid,c uuid,cents integer,age interval) returns uuid language plpgsql as $$
declare at timestamptz:=pg_catalog.clock_timestamp()-age;
begin
  if c is null then
    c:=pg_catalog.gen_random_uuid();
    insert into auth.users(id,aud,role,email,raw_user_meta_data,raw_app_meta_data)
      values(c,'authenticated','authenticated','pk-'||c||'@example.invalid','{}','{}');
  end if;
  insert into public.orders(id,customer_id,game,service,title,units,unit,region,ign,customer_name,amount_eur_cents,booking_fx,payout_usd_cents,created_at,queued_at)
    values(id,c,'lol','duo','Duo',1,'game','EUW','PerkTester','Perk Customer',cents,1.08,600,at-interval '10 minutes',at);
  return id;
end $$;
create function pg_temp.access(u uuid) returns public.teammate_order_access language sql as $$
  select * from public.teammate_order_access where user_id=u $$;
create function pg_temp.ord(o uuid) returns public.orders language sql as $$
  select * from public.orders where id=o $$;

-- Customers: D Diamond, P Platinum, G Gold, X fresh. Teammates: L Legend (1000), E Elite (500),
-- V Veteran (250), R Rookie (0), S stranger (never played with D).
insert into auth.users(id,aud,role,email,raw_user_meta_data,raw_app_meta_data) values
 ('9e000000-0000-4000-8000-0000000000d1','authenticated','authenticated','pk-d@example.invalid','{}','{}'),
 ('9e000000-0000-4000-8000-0000000000a1','authenticated','authenticated','pk-p@example.invalid','{}','{}'),
 ('9e000000-0000-4000-8000-0000000000b1','authenticated','authenticated','pk-g@example.invalid','{}','{}'),
 ('9e000000-0000-4000-8000-0000000000c1','authenticated','authenticated','pk-x@example.invalid','{}','{}'),
 ('9e000000-0000-4000-8000-000000000001','authenticated','authenticated','pk-l@example.invalid','{}','{}'),
 ('9e000000-0000-4000-8000-000000000002','authenticated','authenticated','pk-e@example.invalid','{}','{}'),
 ('9e000000-0000-4000-8000-000000000003','authenticated','authenticated','pk-v@example.invalid','{}','{}'),
 ('9e000000-0000-4000-8000-000000000004','authenticated','authenticated','pk-r@example.invalid','{}','{}'),
 ('9e000000-0000-4000-8000-000000000005','authenticated','authenticated','pk-s@example.invalid','{}','{}');
update public.profiles set name='Perk Person' where id::text like '9e000000-%';
update public.account_roles set role='teammate' where user_id::text like '9e000000-0000-4000-8000-00000000000%';
insert into public.teammate_order_access(user_id,approved_games,discord_id,discord_verified_at)
  select u,array['lol'],'90000000000000000'||pg_catalog.right(u::text,1),pg_catalog.now()
  from pg_catalog.unnest(array['9e000000-0000-4000-8000-000000000001','9e000000-0000-4000-8000-000000000002','9e000000-0000-4000-8000-000000000003',
    '9e000000-0000-4000-8000-000000000004','9e000000-0000-4000-8000-000000000005']::uuid[]) u;
insert into public.teammate_presence(user_id,online,online_since,last_seen_at)
  select user_id,true,pg_catalog.clock_timestamp(),pg_catalog.clock_timestamp() from public.teammate_order_access where user_id::text like '9e000000-%'
  on conflict (user_id) do update set online=true,online_since=excluded.online_since,last_seen_at=excluded.last_seen_at;

select pg_catalog.set_config('pk.d_src',pg_temp.history('9e000000-0000-4000-8000-0000000000d1','9e000000-0000-4000-8000-000000000001',1000)::text,true);
select pg_temp.history('9e000000-0000-4000-8000-0000000000a1','9e000000-0000-4000-8000-000000000002',500);
select pg_temp.history('9e000000-0000-4000-8000-0000000000b1','9e000000-0000-4000-8000-000000000003',250);
select pg_catalog.set_config('pk.x_src',pg_temp.history('9e000000-0000-4000-8000-0000000000c1','9e000000-0000-4000-8000-000000000005',1)::text,true);
select pg_temp.pk_assert(public.payout_valid_count('9e000000-0000-4000-8000-000000000001')=1000
  and public.payout_valid_count('9e000000-0000-4000-8000-000000000002')=500
  and public.payout_valid_count('9e000000-0000-4000-8000-000000000003')=250,'fixture counts');

-- ---- private storage and grants ----
set local role authenticated;
select pg_temp.login('9e000000-0000-4000-8000-0000000000a1');
do $$ begin perform 1 from public.free_coaching_claims limit 1; raise exception 'authenticated read claims';
exception when insufficient_privilege then null; end $$;
do $$ begin perform 1 from public.order_teammate_picks limit 1; raise exception 'authenticated read picks';
exception when insufficient_privilege then null; end $$;
do $$ begin perform public.create_free_coaching_order(pg_catalog.gen_random_uuid()); raise exception 'authenticated created free order';
exception when insufficient_privilege then null; end $$;
do $$ begin perform public.teammate_priority_delay(null,null,null); raise exception 'authenticated read delay';
exception when insufficient_privilege then null; end $$;
reset role;
select pg_temp.pk_assert(has_function_privilege('authenticated','public.customer_perks()','execute')
  and has_function_privilege('authenticated','public.customer_pickable_teammates(text,boolean,boolean)','execute')
  and has_function_privilege('authenticated','public.teammate_pass_picked_order(uuid)','execute')
  and not has_function_privilege('anon','public.customer_perks()','execute')
  and has_function_privilege('service_role','public.create_free_coaching_order(uuid)','execute')
  and not has_function_privilege('authenticated','public.create_paid_order(uuid,text,integer,text,text,text)','execute')
  and has_function_privilege('authenticated','public.teammate_order_queue()','execute')
  and not has_function_privilege('authenticated','public.order_eligible(public.orders,uuid)','execute'),'grants');

-- ---- perk 1: month boundary in Europe/Vienna ----
select pg_temp.pk_assert(public.free_coaching_month('2026-10-31 22:59:59+00')='2026-10-01','23:59:59 Vienna 31 Oct is October (CET)');
select pg_temp.pk_assert(public.free_coaching_month('2026-10-31 23:00:00+00')='2026-11-01','00:00 Vienna 1 Nov is November');
select pg_temp.pk_assert(public.free_coaching_month('2026-07-31 21:59:59+00')='2026-07-01','summer time: 23:59:59 Vienna is July');
select pg_temp.pk_assert(public.free_coaching_month('2026-07-31 22:00:00+00')='2026-08-01','summer time: 00:00 Vienna is August');
select pg_temp.pk_assert(public.free_coaching_service('lol','vod') and public.free_coaching_service('pu','draft')
  and not public.free_coaching_service('lol','duo') and not public.free_coaching_service('val','vod2'),'training services');

-- Perks per level: Gold none, Platinum free coaching, Diamond both.
select pg_temp.pk_assert((public.customer_perks_for('9e000000-0000-4000-8000-0000000000b1')#>>'{freeCoaching,eligible}')='false'
  and (public.customer_perks_for('9e000000-0000-4000-8000-0000000000a1')#>>'{freeCoaching,available}')='true'
  and (public.customer_perks_for('9e000000-0000-4000-8000-0000000000a1')#>>'{pickTeammate,eligible}')='false'
  and (public.customer_perks_for('9e000000-0000-4000-8000-0000000000d1')#>>'{pickTeammate,eligible}')='true','perks by level');

-- Non-Platinum refused (Gold), and the intent is closed.
select pg_catalog.set_config('pk.gi',pg_temp.intent('9e000000-0000-4000-8000-0000000000b1','lol','vod',1,'hour',1500,true,null)::text,true);
select pg_temp.pk_assert(public.create_free_coaching_order(current_setting('pk.gi')::uuid)=pg_catalog.jsonb_build_object('error','free_perk_unavailable','reason','level'),'Gold refused');
select pg_temp.pk_assert((select status='failed' and order_id is null from public.checkout_intents where id=current_setting('pk.gi')::uuid),'Gold intent failed');
-- Wrong service refused; bundle or Gamer Girl or wallet cannot even be stored as free.
select pg_catalog.set_config('pk.si',pg_temp.intent('9e000000-0000-4000-8000-0000000000a1','lol','duo',1,'hour',1500,true,null)::text,true);
select pg_temp.pk_assert(public.create_free_coaching_order(current_setting('pk.si')::uuid)->>'reason'='service','duo is not coaching');
do $$ begin perform pg_temp.intent('9e000000-0000-4000-8000-0000000000a1','lol','vod',2,'hour',3000,true,null); raise exception '2 hours stored as free';
exception when check_violation then null; end $$;
do $$ begin perform pg_temp.intent('9e000000-0000-4000-8000-0000000000a1','lol','vod',1,'hour',1400,true,null,100); raise exception 'PRO discount on free';
exception when check_violation or sqlstate 'PT409' then null; end $$;
do $$ begin
  insert into public.checkout_intents(customer_id,game,service,title,units,unit,region,ign,amount_eur_cents,payout_usd_cents,booking_fx,expires_at,free_coaching,first_order_discount_cents)
    values('9e000000-0000-4000-8000-0000000000a1','lol','vod','x',1,'hour','EUW','x',1400,700,1.08,pg_catalog.clock_timestamp()+interval '1 hour',true,100);
  raise exception 'creator discount on free';
exception when check_violation then null; end $$;
-- A paid (card) call cannot use a free intent, and a free call cannot use a paid intent.
select pg_catalog.set_config('pk.pi',pg_temp.intent('9e000000-0000-4000-8000-0000000000a1','lol','vod',1,'hour',1500,false,null)::text,true);
select pg_temp.pk_assert(public.create_free_coaching_order(current_setting('pk.pi')::uuid)->>'error'='payment_mismatch','free call on paid intent');
select pg_catalog.set_config('pk.fi',pg_temp.intent('9e000000-0000-4000-8000-0000000000a1','lol','vod',1,'hour',1500,true,null)::text,true);
select pg_temp.pk_assert(public.create_paid_order(current_setting('pk.fi')::uuid,'pi_x',1500,'eur','card','captured')->>'error'='payment_mismatch','card call on free intent');

-- Platinum: free order created with the full list price, normal payout, no payment, no wallet.
select pg_catalog.set_config('pk.f1',(public.create_free_coaching_order(current_setting('pk.fi')::uuid)->>'order_id'),true);
select pg_temp.pk_assert((select amount_eur_cents=1500 and payout_usd_cents=700 and wallet_eur_cents=0 and status='queued' from public.orders where id=current_setting('pk.f1')::uuid),'free order row');
select pg_temp.pk_assert(not exists(select 1 from public.order_payments where order_id=current_setting('pk.f1')::uuid),'no payment row');
select pg_temp.pk_assert((select state='used' and loyalty_level='platinum' and prior_completed_count=500 and month=public.free_coaching_month(pg_catalog.clock_timestamp()) from public.free_coaching_claims where order_id=current_setting('pk.f1')::uuid),'claim');
select pg_temp.pk_assert((public.customer_perks_for('9e000000-0000-4000-8000-0000000000a1')#>>'{freeCoaching,used}')='true','used this month');
select pg_temp.pk_assert(public.create_free_coaching_order(current_setting('pk.fi')::uuid)=pg_catalog.jsonb_build_object('order_id',current_setting('pk.f1')::uuid,'created',false),'replay is idempotent');

-- Expired unclaimed (queue_expired) gives it back, with no refund credit.
update public.orders set created_at=created_at-interval '7 minutes',queued_at=pg_catalog.clock_timestamp()-interval '6 minutes' where id=current_setting('pk.f1')::uuid;
select public.order_expire_locked(current_setting('pk.f1')::uuid);
select pg_temp.pk_assert((select status='cancelled' and cancel_reason='queue_expired' from public.orders where id=current_setting('pk.f1')::uuid),'expired');
select pg_temp.pk_assert((select state='returned' and return_reason='cancelled' from public.free_coaching_claims where order_id=current_setting('pk.f1')::uuid),'expiry returns perk');
select pg_temp.pk_assert(not exists(select 1 from public.refund_credits where order_id=current_setting('pk.f1')::uuid),'no refund credit');
select pg_temp.pk_assert((public.customer_perks_for('9e000000-0000-4000-8000-0000000000a1')#>>'{freeCoaching,available}')='true','available again');

-- Second free order the same month; a third is refused while it is used.
select pg_catalog.set_config('pk.f2',(public.create_free_coaching_order(pg_temp.intent('9e000000-0000-4000-8000-0000000000a1','val','aim',1,'hour',1800,true,null))->>'order_id'),true);
select pg_temp.pk_assert(current_setting('pk.f2') <> '','second free order');
-- Customer cancel returns it (status change to cancelled).
update public.orders set status='cancelled',cancelled_at=pg_catalog.clock_timestamp(),cancel_reason='customer_cancelled' where id=current_setting('pk.f2')::uuid;
select pg_temp.pk_assert((select state from public.free_coaching_claims where order_id=current_setting('pk.f2')::uuid)='returned','cancel returns perk');
select pg_catalog.set_config('pk.f3',(public.create_free_coaching_order(pg_temp.intent('9e000000-0000-4000-8000-0000000000a1','lol','champ',1,'hour',1500,true,null))->>'order_id'),true);
-- Teammate E takes it; complete_order passes the payment gate (proof check answers next).
select pg_catalog.set_config('pk.a3',pg_catalog.gen_random_uuid()::text,true);
insert into public.order_assignments(id,order_id,teammate_id,accepted_at) values(current_setting('pk.a3')::uuid,current_setting('pk.f3')::uuid,'9e000000-0000-4000-8000-000000000002',pg_catalog.clock_timestamp());
update public.orders set status='in_progress',assigned_teammate_id='9e000000-0000-4000-8000-000000000002',current_assignment_id=current_setting('pk.a3')::uuid,accepted_at=pg_catalog.clock_timestamp() where id=current_setting('pk.f3')::uuid;
set local role authenticated;
select pg_temp.login('9e000000-0000-4000-8000-000000000002');
select pg_temp.pk_assert((public.complete_order(current_setting('pk.f3')::uuid,current_setting('pk.a3')::uuid,array[pg_catalog.gen_random_uuid()],pg_catalog.gen_random_uuid())#>>'{error,code}')='400','free order reaches proof check');
reset role;
-- A third free order the same month is refused (needs no open order first: complete f3).
insert into public.teammate_earning_entries(order_id,assignment_id,teammate_id,request_id,proof_ids,completed_at,prior_completed_count,trust_tier,payout_usd_cents,deposit_percent,held_usd_cents,net_usd_cents,source_snapshot,result)
  values(current_setting('pk.f3')::uuid,current_setting('pk.a3')::uuid,'9e000000-0000-4000-8000-000000000002',pg_catalog.gen_random_uuid(),array[pg_catalog.gen_random_uuid()],pg_catalog.clock_timestamp(),500,'elite',700,3,21,679,'{}','{}');
update public.order_assignments set ended_at=pg_catalog.clock_timestamp(),end_reason='completed' where id=current_setting('pk.a3')::uuid;
update public.orders set status='completed',completed_at=pg_catalog.clock_timestamp() where id=current_setting('pk.f3')::uuid;
select pg_temp.pk_assert(public.payout_valid_count('9e000000-0000-4000-8000-000000000002')=501,'free order counts for teammate trust');
select pg_temp.pk_assert(public.loyalty_valid_count('9e000000-0000-4000-8000-0000000000a1')=500,'free order does not count for customer loyalty');
select pg_temp.pk_assert(not exists(select 1 from public.loyalty_cashbacks where order_id=current_setting('pk.f3')::uuid),'no cashback');
select pg_temp.pk_assert(not exists(select 1 from public.order_referrals where order_id=current_setting('pk.f3')::uuid),'no creator commission');
select pg_temp.pk_assert(public.create_free_coaching_order(pg_temp.intent('9e000000-0000-4000-8000-0000000000a1','lol','vod',1,'hour',1500,true,null))=pg_catalog.jsonb_build_object('error','free_perk_unavailable','reason','used'),'one per month');
-- Admin refund gives it back and removes the trust count; a refunded paid order still needs Stripe.
update public.orders set admin_refunded_at=pg_catalog.clock_timestamp(),admin_refund_reason='test' where id=current_setting('pk.f3')::uuid;
select pg_temp.pk_assert((select state='returned' and return_reason='refunded' from public.free_coaching_claims where order_id=current_setting('pk.f3')::uuid),'refund returns perk');
select pg_temp.pk_assert(public.payout_valid_count('9e000000-0000-4000-8000-000000000002')=500,'refunded free order leaves trust count');
-- No rollover: a claim moved to last month does not block or add anything this month.
select pg_catalog.set_config('pk.f4',(public.create_free_coaching_order(pg_temp.intent('9e000000-0000-4000-8000-0000000000a1','lol','vod',1,'hour',1500,true,null))->>'order_id'),true);
update public.free_coaching_claims set month=(public.free_coaching_month(pg_catalog.clock_timestamp())-interval '1 month')::date where order_id=current_setting('pk.f4')::uuid;
select pg_catalog.set_config('pk.a4',pg_catalog.gen_random_uuid()::text,true);
insert into public.order_assignments(id,order_id,teammate_id,accepted_at,ended_at,end_reason) values(current_setting('pk.a4')::uuid,current_setting('pk.f4')::uuid,'9e000000-0000-4000-8000-000000000002',pg_catalog.clock_timestamp(),pg_catalog.clock_timestamp(),'completed');
update public.orders set status='completed',assigned_teammate_id='9e000000-0000-4000-8000-000000000002',current_assignment_id=current_setting('pk.a4')::uuid,accepted_at=pg_catalog.clock_timestamp(),completed_at=pg_catalog.clock_timestamp() where id=current_setting('pk.f4')::uuid;
select pg_temp.pk_assert((select state from public.free_coaching_claims where order_id=current_setting('pk.f4')::uuid)='used','completion keeps the claim used');
select pg_temp.pk_assert((public.customer_perks_for('9e000000-0000-4000-8000-0000000000a1')#>>'{freeCoaching,available}')='true','last month claim does not block');
do $$ begin
  insert into public.free_coaching_claims(customer_id,month,intent_id,order_id,loyalty_level,prior_completed_count,list_eur_cents)
    select customer_id,public.free_coaching_month(pg_catalog.clock_timestamp()),intent_id,order_id,'platinum',500,1500 from public.free_coaching_claims where order_id=current_setting('pk.f4')::uuid;
  raise exception 'duplicate claim';
exception when unique_violation then null; end $$;
-- Customer screens: rewards card and order DTO.
set local role authenticated;
select pg_temp.login('9e000000-0000-4000-8000-0000000000a1');
select pg_temp.pk_assert((public.customer_rewards()#>>'{perks,freeCoaching,eligible}')='true','rewards shows perk');
select pg_temp.pk_assert((public.customer_order(current_setting('pk.f4')::uuid)#>>'{order,free_perk}')='true','order DTO free_perk');
select pg_temp.pk_assert((public.customer_perks()#>>'{freeCoaching,available}')='true','customer_perks');
reset role;

-- ---- perks 3 and 4: priority delay ----
select pg_temp.queued('9e100000-0000-4000-8000-000000000001',null,1999,interval '0 seconds');
select pg_temp.queued('9e100000-0000-4000-8000-000000000002',null,2000,interval '0 seconds');
select pg_temp.queued('9e100000-0000-4000-8000-000000000003',null,1900,interval '0 seconds');
insert into public.checkout_intents(customer_id,game,service,title,units,unit,region,ign,amount_eur_cents,payout_usd_cents,booking_fx,expires_at,first_order_discount_cents,order_id,status)
  values((select customer_id from public.orders where id='9e100000-0000-4000-8000-000000000003'),'lol','duo','Duo',1,'game','EUW','PerkTester',1900,600,1.08,pg_catalog.clock_timestamp()+interval '1 hour',100,'9e100000-0000-4000-8000-000000000003','paid');
select pg_temp.pk_assert(public.order_list_eur_cents(pg_temp.ord('9e100000-0000-4000-8000-000000000003'))=2000,'list price adds the discount back');
create function pg_temp.delay(o text,t text) returns integer language sql as $$
  select public.teammate_priority_delay(pg_temp.ord(('9e100000-0000-4000-8000-00000000000'||o)::uuid),pg_temp.access(('9e000000-0000-4000-8000-00000000000'||t)::uuid),pg_catalog.clock_timestamp()) $$;
-- Rookie: 50 below 20 EUR, 65 at exactly 20 EUR and at 19 EUR paid plus 1 EUR PRO discount.
select pg_temp.pk_assert(pg_temp.delay('1','4')=50 and pg_temp.delay('2','4')=65 and pg_temp.delay('3','4')=65,'rookie high-value +15');
-- Veteran: 50 both. Elite (500) and Legend (1000): 40 both.
select pg_temp.pk_assert(pg_temp.delay('1','3')=50 and pg_temp.delay('2','3')=50,'veteran no extra');
select pg_temp.pk_assert(pg_temp.delay('1','2')=40 and pg_temp.delay('2','2')=40 and pg_temp.delay('2','1')=40,'elite and legend -10');
-- Elite floor at 0; boundaries 249 and 499 stay at the lower tier.
update public.teammate_order_access set priority_base=5 where user_id='9e000000-0000-4000-8000-000000000002';
select pg_temp.pk_assert(pg_temp.delay('2','2')=0,'elite floor 0');
update public.teammate_order_access set priority_base=10 where user_id='9e000000-0000-4000-8000-000000000002';
select pg_temp.pk_assert(pg_temp.delay('2','2')=0,'elite exactly 0');
update public.teammate_order_access set priority_base=0 where user_id='9e000000-0000-4000-8000-000000000004';
select pg_temp.pk_assert(pg_temp.delay('2','4')=15,'rookie at 0 still waits 15 on high-value');
update public.teammate_order_access set priority_base=50 where user_id in ('9e000000-0000-4000-8000-000000000002','9e000000-0000-4000-8000-000000000004');
update public.order_payments set state='refunded' where order_id=(select e.order_id from public.teammate_earning_entries e where e.teammate_id='9e000000-0000-4000-8000-000000000003' limit 1);
select pg_temp.pk_assert(pg_temp.delay('2','3')=65,'249 is below Veteran');
update public.order_payments set state='refunded' where order_id=(select e.order_id from public.teammate_earning_entries e join public.order_payments p on p.order_id=e.order_id where e.teammate_id='9e000000-0000-4000-8000-000000000002' and p.state='captured' limit 1);
select pg_temp.pk_assert(pg_temp.delay('1','2')=50 and pg_temp.delay('2','2')=50,'499 is Veteran, not Elite');
-- Queue visibility follows the delay: at 45 seconds Legend sees both, Rookie neither; at 55 Rookie sees only the small one.
update public.orders set queued_at=pg_catalog.clock_timestamp()-interval '45 seconds' where id in ('9e100000-0000-4000-8000-000000000001','9e100000-0000-4000-8000-000000000002');
select pg_temp.pk_assert(public.order_eligible(pg_temp.ord('9e100000-0000-4000-8000-000000000002'),'9e000000-0000-4000-8000-000000000001')
  and not public.order_eligible(pg_temp.ord('9e100000-0000-4000-8000-000000000001'),'9e000000-0000-4000-8000-000000000004'),'45 seconds');
update public.orders set queued_at=pg_catalog.clock_timestamp()-interval '55 seconds' where id in ('9e100000-0000-4000-8000-000000000001','9e100000-0000-4000-8000-000000000002');
select pg_temp.pk_assert(public.order_eligible(pg_temp.ord('9e100000-0000-4000-8000-000000000001'),'9e000000-0000-4000-8000-000000000004')
  and not public.order_eligible(pg_temp.ord('9e100000-0000-4000-8000-000000000002'),'9e000000-0000-4000-8000-000000000004'),'55 seconds');
update public.orders set queued_at=pg_catalog.clock_timestamp()-interval '66 seconds' where id='9e100000-0000-4000-8000-000000000002';
select pg_temp.pk_assert(public.order_eligible(pg_temp.ord('9e100000-0000-4000-8000-000000000002'),'9e000000-0000-4000-8000-000000000004'),'66 seconds');
delete from public.checkout_intents where order_id::text like '9e100000-%';
delete from public.orders where id::text like '9e100000-%' and status='queued';

-- ---- perk 2: pick any teammate ----
update public.teammate_presence set online=true,last_seen_at=pg_catalog.clock_timestamp() where user_id::text like '9e000000-%';
-- Pickable list: D sees L (played together, online) by handle only, never S; Gold sees nothing.
set local role authenticated;
select pg_temp.login('9e000000-0000-4000-8000-0000000000d1');
do $$ declare r jsonb; begin
  r:=public.customer_pickable_teammates('lol',false,false);
  perform pg_temp.pk_assert((r->>'eligible')='true' and pg_catalog.jsonb_array_length(r->'teammates')=1,'D list '||r::text);
  perform pg_temp.pk_assert((r#>>'{teammates,0,orders}')='1000' and (r#>>'{teammates,0,handle}') is not null,'handle and count');
  perform pg_temp.pk_assert(r::text !~ '9e000000-0000-4000-8000-000000000001','no teammate id leaks');
  perform pg_temp.pk_assert(pg_catalog.jsonb_array_length(public.customer_pickable_teammates('val',false,false)->'teammates')=0,'no game access');
  perform pg_temp.pk_assert(pg_catalog.jsonb_array_length(public.customer_pickable_teammates('lol',true,false)->'teammates')=0,'no Gamer Girl access');
end $$;
select pg_temp.login('9e000000-0000-4000-8000-0000000000b1');
select pg_temp.pk_assert(public.customer_pickable_teammates('lol',false,false)=pg_catalog.jsonb_build_object('eligible',false,'teammates','[]'::jsonb),'Gold not eligible');
reset role;
-- Suspended or offline teammates are not pickable.
update public.teammate_order_access set suspended=true where user_id='9e000000-0000-4000-8000-000000000001';
select pg_temp.pk_assert(public.order_pick_candidate('9e000000-0000-4000-8000-0000000000d1',current_setting('pk.d_src')::uuid,'lol',false,false,pg_catalog.clock_timestamp()) is null,'suspended');
update public.teammate_order_access set suspended=false where user_id='9e000000-0000-4000-8000-000000000001';
update public.teammate_presence set last_seen_at=pg_catalog.clock_timestamp()-interval '30 seconds' where user_id='9e000000-0000-4000-8000-000000000001';
select pg_temp.pk_assert(public.order_pick_candidate('9e000000-0000-4000-8000-0000000000d1',current_setting('pk.d_src')::uuid,'lol',false,false,pg_catalog.clock_timestamp()) is null,'stale heartbeat');
update public.teammate_presence set last_seen_at=pg_catalog.clock_timestamp() where user_id='9e000000-0000-4000-8000-000000000001';
-- Another customer's order cannot be used as a handle.
select pg_temp.pk_assert(public.order_pick_candidate('9e000000-0000-4000-8000-0000000000d1',current_setting('pk.x_src')::uuid,'lol',false,false,pg_catalog.clock_timestamp()) is null,'foreign handle');

-- A non-Diamond intent naming a teammate gets an ordinary order.
select pg_catalog.set_config('pk.xo',(public.create_paid_order(pg_temp.intent('9e000000-0000-4000-8000-0000000000c1','lol','duo',1,'game',1000,false,current_setting('pk.x_src')::uuid),'pi_pk'||pg_catalog.md5('x'),1000,'eur','card','authorized')->>'order_id'),true);
select pg_temp.pk_assert(not exists(select 1 from public.order_teammate_picks where order_id=current_setting('pk.xo')::uuid),'fresh customer gets no window');
update public.orders set status='cancelled',cancelled_at=pg_catalog.clock_timestamp(),cancel_reason='customer_cancelled' where id=current_setting('pk.xo')::uuid;

-- Diamond picks L: only L sees it, at once and first; everyone else waits; no Discord post.
select pg_catalog.set_config('pk.po',(public.create_paid_order(pg_temp.intent('9e000000-0000-4000-8000-0000000000d1','lol','duo',1,'game',1500,false,current_setting('pk.d_src')::uuid),'pi_pk'||pg_catalog.md5('d'),1500,'eur','card','authorized')->>'order_id'),true);
select pg_temp.pk_assert((select teammate_id='9e000000-0000-4000-8000-000000000001' and window_ends_at=queue_key+interval '60 seconds' from public.order_teammate_picks where order_id=current_setting('pk.po')::uuid),'pick row');
select pg_temp.pk_assert(public.order_eligible(pg_temp.ord(current_setting('pk.po')::uuid),'9e000000-0000-4000-8000-000000000001'),'picked teammate sees at once');
select pg_temp.pk_assert(not public.order_eligible(pg_temp.ord(current_setting('pk.po')::uuid),'9e000000-0000-4000-8000-000000000002'),'others wait');
update public.teammate_order_access set priority_base=0 where user_id='9e000000-0000-4000-8000-000000000003';
select pg_temp.pk_assert(not public.order_eligible(pg_temp.ord(current_setting('pk.po')::uuid),'9e000000-0000-4000-8000-000000000003'),'even priority 0 waits');
select pg_temp.pk_assert(pg_catalog.jsonb_array_length(public.discord_order_posts_due(0))=0
  or not exists(select 1 from pg_catalog.jsonb_array_elements(public.discord_order_posts_due(0)) x where x->>'id'=current_setting('pk.po')),'no Discord post in window');
select pg_temp.pk_assert(public.discord_order_post_claim(current_setting('pk.po')::uuid,(pg_temp.ord(current_setting('pk.po')::uuid)).queued_at,'123456789012345678') is null,'claim refused in window');
set local role authenticated;
select pg_temp.login('9e000000-0000-4000-8000-000000000001');
do $$ declare q jsonb; begin
  q:=public.teammate_order_queue();
  perform pg_temp.pk_assert((q#>>'{orders,0,id}')=current_setting('pk.po') and (q#>>'{orders,0,picked_for_you}')='true','picked first in L queue');
  perform pg_temp.pk_assert(q::text !~* 'priority|delay|diamond|window','no internals');
end $$;
select pg_temp.login('9e000000-0000-4000-8000-000000000002');
select pg_temp.pk_assert(not exists(select 1 from pg_catalog.jsonb_array_elements(public.teammate_order_queue()->'orders') x where x->>'id'=current_setting('pk.po')),'not in E queue');
select pg_temp.pk_assert((public.teammate_pass_picked_order(current_setting('pk.po')::uuid)#>>'{error,code}')='404','E cannot pass');
reset role;

-- Window expiry: 61 seconds later it is in the normal queue; priority counts from the window end.
update public.orders set created_at=created_at-interval '61 seconds',queued_at=queued_at-interval '61 seconds' where id=current_setting('pk.po')::uuid;
update public.order_teammate_picks set queue_key=queue_key-interval '61 seconds',window_ends_at=window_ends_at-interval '61 seconds' where order_id=current_setting('pk.po')::uuid;
select pg_temp.pk_assert(public.order_public_queued_at(pg_temp.ord(current_setting('pk.po')::uuid))=(select window_ends_at from public.order_teammate_picks where order_id=current_setting('pk.po')::uuid),'public from window end');
select pg_temp.pk_assert(public.order_eligible(pg_temp.ord(current_setting('pk.po')::uuid),'9e000000-0000-4000-8000-000000000003'),'priority 0 sees after window');
select pg_temp.pk_assert(not public.order_eligible(pg_temp.ord(current_setting('pk.po')::uuid),'9e000000-0000-4000-8000-000000000002'),'E (40) still waits after window');
select pg_temp.pk_assert(not public.order_picked_for(pg_temp.ord(current_setting('pk.po')::uuid),'9e000000-0000-4000-8000-000000000001'),'window over');
select pg_temp.pk_assert(not exists(select 1 from pg_catalog.jsonb_array_elements(public.discord_order_posts_due(100)) x where x->>'id'=current_setting('pk.po')),'post waits 100 s after window');
select pg_temp.pk_assert(exists(select 1 from pg_catalog.jsonb_array_elements(public.discord_order_posts_due(0)) x where x->>'id'=current_setting('pk.po')),'post due after window');
update public.orders set status='cancelled',cancelled_at=pg_catalog.clock_timestamp(),cancel_reason='customer_cancelled' where id=current_setting('pk.po')::uuid;

-- Decline: L passes and the order goes to the normal queue at once; L then waits like everyone.
select pg_catalog.set_config('pk.p2',(public.create_paid_order(pg_temp.intent('9e000000-0000-4000-8000-0000000000d1','lol','duo',1,'game',1000,false,current_setting('pk.d_src')::uuid),'pi_pk'||pg_catalog.md5('d2'),1000,'eur','card','authorized')->>'order_id'),true);
set local role authenticated;
select pg_temp.login('9e000000-0000-4000-8000-000000000001');
select pg_temp.pk_assert((public.teammate_pass_picked_order(current_setting('pk.p2')::uuid)->>'passed')='true','pass');
reset role;
select pg_temp.pk_assert((select release_reason='declined' from public.order_teammate_picks where order_id=current_setting('pk.p2')::uuid),'declined');
select pg_temp.pk_assert(public.order_eligible(pg_temp.ord(current_setting('pk.p2')::uuid),'9e000000-0000-4000-8000-000000000003'),'normal queue at once');
select pg_temp.pk_assert(not public.order_eligible(pg_temp.ord(current_setting('pk.p2')::uuid),'9e000000-0000-4000-8000-000000000001'),'L back to normal delay');
update public.orders set status='cancelled',cancelled_at=pg_catalog.clock_timestamp(),cancel_reason='customer_cancelled' where id=current_setting('pk.p2')::uuid;

-- Offline: L goes offline and the window ends at once.
select pg_catalog.set_config('pk.p3',(public.create_paid_order(pg_temp.intent('9e000000-0000-4000-8000-0000000000d1','lol','duo',1,'game',1000,false,current_setting('pk.d_src')::uuid),'pi_pk'||pg_catalog.md5('d3'),1000,'eur','card','authorized')->>'order_id'),true);
select pg_temp.pk_assert(not public.order_eligible(pg_temp.ord(current_setting('pk.p3')::uuid),'9e000000-0000-4000-8000-000000000003'),'window open');
update public.teammate_presence set online=false,online_since=null where user_id='9e000000-0000-4000-8000-000000000001';
select pg_temp.pk_assert((select release_reason='offline' from public.order_teammate_picks where order_id=current_setting('pk.p3')::uuid),'offline release');
select pg_temp.pk_assert(public.order_eligible(pg_temp.ord(current_setting('pk.p3')::uuid),'9e000000-0000-4000-8000-000000000003'),'normal queue after offline');
-- A stale heartbeat (no explicit offline) also ends the window 20 seconds after the last beat.
update public.orders set status='cancelled',cancelled_at=pg_catalog.clock_timestamp(),cancel_reason='customer_cancelled' where id=current_setting('pk.p3')::uuid;
update public.teammate_presence set online=true,online_since=pg_catalog.clock_timestamp(),last_seen_at=pg_catalog.clock_timestamp() where user_id='9e000000-0000-4000-8000-000000000001';
select pg_catalog.set_config('pk.p4',(public.create_paid_order(pg_temp.intent('9e000000-0000-4000-8000-0000000000d1','lol','duo',1,'game',1000,false,current_setting('pk.d_src')::uuid),'pi_pk'||pg_catalog.md5('d4'),1000,'eur','card','authorized')->>'order_id'),true);
select pg_temp.pk_assert(exists(select 1 from public.order_teammate_picks where order_id=current_setting('pk.p4')::uuid and released_at is null),'p4 window');
update public.teammate_presence set last_seen_at=pg_catalog.clock_timestamp()-interval '25 seconds' where user_id='9e000000-0000-4000-8000-000000000001';
select pg_temp.pk_assert(public.order_public_queued_at(pg_temp.ord(current_setting('pk.p4')::uuid))<pg_catalog.clock_timestamp(),'stale heartbeat ends window');
-- Re-queue (customer reroll) gives no new window.
update public.orders set queued_at=pg_catalog.clock_timestamp() where id=current_setting('pk.p4')::uuid;
select pg_temp.pk_assert(public.order_public_queued_at(pg_temp.ord(current_setting('pk.p4')::uuid))=(pg_temp.ord(current_setting('pk.p4')::uuid)).queued_at,'requeue has no window');
-- A free coaching order can also name a teammate (both perks for Diamond).
update public.orders set status='cancelled',cancelled_at=pg_catalog.clock_timestamp(),cancel_reason='customer_cancelled' where id=current_setting('pk.p4')::uuid;
update public.teammate_presence set last_seen_at=pg_catalog.clock_timestamp() where user_id='9e000000-0000-4000-8000-000000000001';
select pg_catalog.set_config('pk.p5',(public.create_free_coaching_order(pg_temp.intent('9e000000-0000-4000-8000-0000000000d1','lol','vod',1,'hour',1500,true,current_setting('pk.d_src')::uuid))->>'order_id'),true);
select pg_temp.pk_assert(exists(select 1 from public.order_teammate_picks where order_id=current_setting('pk.p5')::uuid)
  and exists(select 1 from public.free_coaching_claims where order_id=current_setting('pk.p5')::uuid and loyalty_level='diamond'),'Diamond free and picked');

select 'perks ok' as result;
rollback;
