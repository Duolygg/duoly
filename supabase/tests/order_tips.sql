-- Rollback-only checks for 20261026100000_order_tips.sql (tips, MONEY-RULES T1 to T7).
-- Run with the migration body (without its begin/commit) inserted after this begin, e.g.
--   python3 supabase/tests/build_order_tips_rollback.py "$TMPDIR/tips.sql"
--   node_modules/.bin/supabase db query --linked -f "$TMPDIR/tips.sql"
begin;

create function pg_temp.t_assert(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'order tips assertion: %',label; end if; end $$;
create function pg_temp.login(actor uuid) returns void language plpgsql as $$
begin
  perform pg_catalog.set_config('request.jwt.claim.sub',actor::text,true);
  perform pg_catalog.set_config('request.jwt.claims',pg_catalog.jsonb_build_object('role','authenticated','sub',actor)::text,true);
end $$;
-- A completed, captured order with an earning entry and (optionally) a fresh review.
create function pg_temp.make_order(t uuid,c uuid,at_time timestamptz,payout integer,reviewed boolean) returns uuid language plpgsql as $$
declare o uuid:=pg_catalog.gen_random_uuid(); a uuid:=pg_catalog.gen_random_uuid(); i uuid:=pg_catalog.gen_random_uuid();
begin
  insert into public.orders(id,customer_id,game,service,title,units,unit,region,ign,customer_name,amount_eur_cents,booking_fx,payout_usd_cents,created_at,queued_at)
  values(o,c,'lol','duo','Tip fixture',1,'game','EUW','Fixture','Customer',999,1.08,payout,at_time,at_time);
  insert into public.order_assignments(id,order_id,teammate_id,accepted_at,ended_at,end_reason) values(a,o,t,at_time,at_time,'completed');
  update public.orders set status='completed',assigned_teammate_id=t,current_assignment_id=a,accepted_at=at_time,completed_at=at_time where id=o;
  insert into public.checkout_intents(id,customer_id,game,service,title,units,unit,region,ign,amount_eur_cents,payout_usd_cents,booking_fx,expires_at)
  values(i,c,'lol','duo','Tip fixture',1,'game','EUW','Fixture',999,payout,1.08,at_time+interval '1 hour');
  insert into public.order_payments(order_id,intent_id,stripe_payment_intent_id,amount_minor,currency,amount_eur_cents,payment_method_type,state,settle)
  values(o,i,'pi_m6order'||pg_catalog.replace(i::text,'-',''),999,'eur',999,'card','captured','none');
  insert into public.teammate_earning_entries(order_id,assignment_id,teammate_id,request_id,proof_ids,completed_at,prior_completed_count,trust_tier,payout_usd_cents,deposit_percent,held_usd_cents,net_usd_cents,source_snapshot,result)
  values(o,a,t,pg_catalog.gen_random_uuid(),array[pg_catalog.gen_random_uuid()],at_time,1000,'legend',payout,0,0,payout,'{}','{}');
  if reviewed then
    insert into public.order_reviews(order_id,assignment_id,customer_id,teammate_id,rating) values(o,a,c,t,5);
  end if;
  return o;
end $$;
-- Customer prepares, the server attaches a PaymentIntent and Stripe reports success.
create function pg_temp.pay_tip(o uuid,cents integer,fx numeric,pi text) returns uuid language plpgsql as $$
declare r jsonb; tip uuid;
begin
  perform pg_temp.login('6f000000-0000-4000-8000-000000000003');
  set local role authenticated;
  r:=public.order_tip_prepare(o,cents);
  reset role;
  tip:=(r->>'tipId')::uuid;
  perform pg_temp.t_assert(tip is not null,'prepare returned a tip for '||pi);
  perform pg_temp.t_assert((public.order_tip_attach(tip,pi,cents,fx)->>'attached')::boolean,'attach '||pi);
  perform pg_temp.t_assert((public.order_tip_record_payment(pi,tip,cents,'eur')->>'recorded')::boolean,'record '||pi);
  return tip;
end $$;

insert into auth.users(id,aud,role,email,raw_user_meta_data,raw_app_meta_data) values
 ('6f000000-0000-4000-8000-000000000001','authenticated','authenticated','m6-mate@example.invalid','{}','{}'),
 ('6f000000-0000-4000-8000-000000000002','authenticated','authenticated','m6-mate-two@example.invalid','{}','{}'),
 ('6f000000-0000-4000-8000-000000000003','authenticated','authenticated','m6-customer@example.invalid','{}','{}'),
 ('6f000000-0000-4000-8000-000000000004','authenticated','authenticated','m6-other@example.invalid','{}','{}'),
 ('6f000000-0000-4000-8000-000000000005','authenticated','authenticated','m6-admin@example.invalid','{}','{}');
update public.profiles set name=case id
 when '6f000000-0000-4000-8000-000000000001' then 'Tip Mate'
 when '6f000000-0000-4000-8000-000000000002' then 'Tip Mate Two'
 when '6f000000-0000-4000-8000-000000000005' then 'Tip Admin' else 'Tip Customer' end
where id::text like '6f000000-0000-4000-8000-00000000000%';
update public.account_roles set role='teammate' where user_id in ('6f000000-0000-4000-8000-000000000001','6f000000-0000-4000-8000-000000000002');
update public.account_roles set role='admin' where user_id='6f000000-0000-4000-8000-000000000005';

-- Fixture orders, all completed in the week starting Friday 2025-01-03 (Vienna).
do $$ declare k text; begin
  foreach k in array array['bounds','paid','refund_early','refund_late','partial','dispute_won','dispute_lost','dispute_early','cancel','currency'] loop
    perform pg_catalog.set_config('m6.'||k,pg_temp.make_order('6f000000-0000-4000-8000-000000000001','6f000000-0000-4000-8000-000000000003','2025-01-07 10:00+00',1500,true)::text,true);
  end loop;
  perform pg_catalog.set_config('m6.unrated',pg_temp.make_order('6f000000-0000-4000-8000-000000000001','6f000000-0000-4000-8000-000000000003','2025-01-07 10:00+00',1500,false)::text,true);
  perform pg_catalog.set_config('m6.late',pg_temp.make_order('6f000000-0000-4000-8000-000000000001','6f000000-0000-4000-8000-000000000003','2025-01-07 10:00+00',1500,false)::text,true);
end $$;
-- A rating saved 31 minutes ago is outside the tip window (T5).
insert into public.order_reviews(order_id,assignment_id,customer_id,teammate_id,rating,created_at)
  select e.order_id,e.assignment_id,'6f000000-0000-4000-8000-000000000003',e.teammate_id,4,pg_catalog.clock_timestamp()-interval '31 minutes'
  from public.teammate_earning_entries e where e.order_id=current_setting('m6.late')::uuid;
-- An order still in the queue cannot be tipped.
insert into public.orders(id,customer_id,game,service,title,units,unit,region,ign,customer_name,amount_eur_cents,booking_fx,payout_usd_cents)
  values('6f000000-0000-4000-8000-0000000000aa','6f000000-0000-4000-8000-000000000003','lol','duo','Queued tip fixture',1,'game','EUW','Fixture','Customer',999,1.08,600);

select pg_catalog.set_config('m6.wallet_before',(select pg_catalog.count(*)::text from public.wallet_entries),true);
select pg_catalog.set_config('m6.cashback_before',(select pg_catalog.count(*)::text from public.loyalty_cashbacks),true);

-- ---- permissions ------------------------------------------------------------------------------
set local role anon;
do $$ begin
  begin perform public.order_tip_prepare(current_setting('m6.paid')::uuid,500); raise exception 'anon prepared a tip'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.order_tips limit 1; raise exception 'anon read tips'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
select pg_temp.login('6f000000-0000-4000-8000-000000000003');
do $$ begin
  begin perform 1 from public.order_tips limit 1; raise exception 'customer read tips table'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.order_tip_movements limit 1; raise exception 'customer read tip movements'; exception when insufficient_privilege then null; end;
  begin perform public.order_tip_attach(pg_catalog.gen_random_uuid(),'pi_fake',500,1.1); raise exception 'customer attached'; exception when insufficient_privilege then null; end;
  begin perform public.order_tip_record_payment('pi_fake',pg_catalog.gen_random_uuid(),500,'eur'); raise exception 'customer recorded payment'; exception when insufficient_privilege then null; end;
  begin perform public.order_tip_record_refund('pi_fake',100); raise exception 'customer recorded refund'; exception when insufficient_privilege then null; end;
  begin perform public.order_tip_record_dispute('dp_fake','pi_fake','lost'); raise exception 'customer recorded dispute'; exception when insufficient_privilege then null; end;
  begin perform public.tip_sync_payout(pg_catalog.gen_random_uuid(),'x'); raise exception 'customer synced payout'; exception when insufficient_privilege then null; end;
end $$;
-- Another customer cannot see or tip this order; teammates and admins cannot tip.
select pg_temp.login('6f000000-0000-4000-8000-000000000004');
select pg_temp.t_assert((public.order_tip_prepare(current_setting('m6.paid')::uuid,500)->'error'->>'code')::int=404,'other customer cannot tip');
select pg_temp.t_assert((public.order_tip_status(current_setting('m6.paid')::uuid)->'error'->>'code')::int=404,'other customer cannot read tip');
select pg_temp.login('6f000000-0000-4000-8000-000000000001');
select pg_temp.t_assert((public.order_tip_prepare(current_setting('m6.paid')::uuid,500)->'error'->>'code')::int=403,'teammate cannot tip');
select pg_temp.login('6f000000-0000-4000-8000-000000000005');
select pg_temp.t_assert((public.order_tip_prepare(current_setting('m6.paid')::uuid,500)->'error'->>'code')::int=403,'admin cannot tip');
reset role;
set local role service_role;
do $$ begin
  begin perform 1 from public.order_tips limit 1; raise exception 'service role read tips table'; exception when insufficient_privilege then null; end;
  begin perform public.order_tip_prepare(current_setting('m6.paid')::uuid,500); raise exception 'service role prepared'; exception when insufficient_privilege then null; end;
end $$;
select pg_temp.t_assert(public.order_tip_for_intent('pi_nothing') is null,'service role can look up intents');
reset role;

-- ---- bounds and eligibility (T2, T3, T5) -------------------------------------------------------
set local role authenticated;
select pg_temp.login('6f000000-0000-4000-8000-000000000003');
select pg_temp.t_assert((public.order_tip_prepare(current_setting('m6.bounds')::uuid,99)->'error'->>'code')::int=400,'below 1.00 refused');
select pg_temp.t_assert((public.order_tip_prepare(current_setting('m6.bounds')::uuid,10001)->'error'->>'code')::int=400,'above 100.00 refused');
select pg_temp.t_assert((public.order_tip_prepare(current_setting('m6.bounds')::uuid,null)->'error'->>'code')::int=400,'missing amount refused');
select pg_temp.t_assert((public.order_tip_prepare(current_setting('m6.bounds')::uuid,0)->'error'->>'code')::int=400,'zero refused');
select pg_temp.t_assert((public.order_tip_prepare(current_setting('m6.bounds')::uuid,100)->>'amountCents')::int=100,'1.00 accepted');
select pg_temp.t_assert((public.order_tip_prepare(current_setting('m6.bounds')::uuid,10000)->>'amountCents')::int=10000,'100.00 accepted and amount changed while pending');
select pg_temp.t_assert(public.order_tip_prepare(current_setting('m6.unrated')::uuid,500)->'error'->>'message'='Rate your teammate first, then add your tip.','rating required first');
select pg_temp.t_assert(public.order_tip_prepare(current_setting('m6.late')::uuid,500)->'error'->>'message'='Tips can only be added together with your rating.','tip window closed after 30 minutes');
select pg_temp.t_assert((public.order_tip_status(current_setting('m6.late')::uuid)->>'canTip')::boolean is false,'status says window closed');
select pg_temp.t_assert((public.order_tip_prepare('6f000000-0000-4000-8000-0000000000aa',500)->'error'->>'code')::int=409,'queued order cannot be tipped');
reset role;
select pg_temp.t_assert((select pg_catalog.count(*)=1 from public.order_tips where order_id=current_setting('m6.bounds')::uuid),'one tip row per order');
select pg_temp.t_assert((select pg_catalog.count(*)=0 from public.order_tips where order_id in (current_setting('m6.unrated')::uuid,current_setting('m6.late')::uuid)),'refused prepares stored nothing');

-- ---- payment, idempotency and attach rules (T1, T4) -------------------------------------------
select pg_catalog.set_config('m6.tip_paid',pg_temp.pay_tip(current_setting('m6.paid')::uuid,500,1.1,'pi_m6paid')::text,true);
select pg_temp.t_assert((select state='paid' and amount_cents=500 and amount_usd_cents=550 and paid_at is not null from public.order_tips where id=current_setting('m6.tip_paid')::uuid),'tip paid, 100% converted at the mid rate');
select pg_temp.t_assert(public.order_tip_record_payment('pi_m6paid',current_setting('m6.tip_paid')::uuid,500,'eur')->>'reason'='already_paid','payment replay is a no-op');
select pg_temp.t_assert((select amount_usd_cents=550 from public.order_tips where id=current_setting('m6.tip_paid')::uuid),'replay did not change the amount');
select pg_temp.t_assert(public.order_tip_record_payment('pi_m6paid',pg_catalog.gen_random_uuid(),500,'eur')->>'reason'='unknown_tip','metadata tip id must match');
select pg_temp.t_assert(public.order_tip_record_payment('pi_unknown',current_setting('m6.tip_paid')::uuid,500,'eur')->>'reason'='unknown_tip','unknown intent ignored');
select pg_temp.t_assert(public.order_tip_attach(current_setting('m6.tip_paid')::uuid,'pi_m6other',500,1.1)->>'reason'='paid','paid tip cannot be re-attached');
set local role authenticated;
select pg_temp.login('6f000000-0000-4000-8000-000000000003');
select pg_temp.t_assert(public.order_tip_prepare(current_setting('m6.paid')::uuid,500)->'error'->>'message'='You already tipped for this order. Thank you!','tip only once');
select pg_temp.t_assert((select s->'tip'->>'state'='paid' and (s->'tip'->>'amount')::numeric=5 and (s->>'canTip')::boolean is false
  from (select public.order_tip_status(current_setting('m6.paid')::uuid) s) x),'customer status shows the paid tip');
reset role;

-- A second PaymentIntent cannot replace the attached one; amount outside the rules is not recorded.
do $$ declare r jsonb; tip uuid; begin
  perform pg_temp.login('6f000000-0000-4000-8000-000000000003');
  set local role authenticated;
  r:=public.order_tip_prepare(current_setting('m6.currency')::uuid,300);
  reset role;
  tip:=(r->>'tipId')::uuid;
  perform pg_temp.t_assert((public.order_tip_attach(tip,'pi_m6currency',300,1.1)->>'attached')::boolean,'attach currency tip');
  perform pg_temp.t_assert(public.order_tip_attach(tip,'pi_m6second',300,1.1)->>'reason'='other_intent','second intent refused');
  perform pg_temp.t_assert(public.order_tip_record_payment('pi_m6currency',tip,300,'usd')->>'reason'='amount_mismatch','other currency refused');
  perform pg_temp.t_assert(public.order_tip_record_payment('pi_m6currency',tip,50,'eur')->>'reason'='amount_mismatch','amount below the minimum refused');
  perform pg_temp.t_assert((select state='pending' and last_error is not null from public.order_tips where id=tip),'mismatch stays pending with a reason');
  begin perform public.order_tip_attach(tip,'pi_m6currency',300,5); raise exception 'absurd fx accepted'; exception when raise_exception then
    if sqlerrm<>'invalid tip intent' then raise; end if; end;
end $$;

-- Cancel then retry inside the window opens a new attempt without a PaymentIntent.
do $$ declare r jsonb; tip uuid; begin
  perform pg_temp.login('6f000000-0000-4000-8000-000000000003');
  set local role authenticated;
  r:=public.order_tip_prepare(current_setting('m6.cancel')::uuid,700);
  reset role;
  tip:=(r->>'tipId')::uuid;
  perform public.order_tip_attach(tip,'pi_m6cancel',700,1.1);
  perform pg_temp.t_assert(public.order_tip_record_failure('pi_m6cancel','failed','card_declined')->>'state'='pending','failed attempt keeps the tip open');
  perform pg_temp.t_assert(public.order_tip_record_failure('pi_m6cancel','canceled','')->>'state'='canceled','canceled intent closes the tip');
  perform pg_temp.t_assert(public.order_tip_record_failure('pi_m6cancel','canceled','')->>'updated'='false','cancel replay no-op');
  set local role authenticated;
  r:=public.order_tip_prepare(current_setting('m6.cancel')::uuid,800);
  reset role;
  perform pg_temp.t_assert((r->>'attempt')::int=1 and r->>'paymentIntentId' is null and (r->>'amountCents')::int=800,'retry opens attempt 1');
end $$;

-- ---- payout inclusion: a tip counts in the week it was paid (not the order's week) ---------------
select pg_catalog.set_config('m6.tip_refund_early',pg_temp.pay_tip(current_setting('m6.refund_early')::uuid,400,1.0,'pi_m6early')::text,true);
select pg_catalog.set_config('m6.tip_refund_late',pg_temp.pay_tip(current_setting('m6.refund_late')::uuid,600,1.0,'pi_m6late')::text,true);
select pg_catalog.set_config('m6.tip_partial',pg_temp.pay_tip(current_setting('m6.partial')::uuid,1000,1.0,'pi_m6partial')::text,true);
select pg_catalog.set_config('m6.tip_won',pg_temp.pay_tip(current_setting('m6.dispute_won')::uuid,200,1.0,'pi_m6won')::text,true);
select pg_catalog.set_config('m6.tip_lost',pg_temp.pay_tip(current_setting('m6.dispute_lost')::uuid,300,1.0,'pi_m6lost')::text,true);
select pg_catalog.set_config('m6.tip_dispute_early',pg_temp.pay_tip(current_setting('m6.dispute_early')::uuid,900,1.0,'pi_m6dearly')::text,true);
-- Fixture time travel: the tips were paid in the week after the orders.
update public.order_tips set paid_at='2025-01-14 10:00+00' where teammate_id='6f000000-0000-4000-8000-000000000001' and paid_at is not null and id<>current_setting('m6.tip_paid')::uuid;
select pg_catalog.set_config('m6.w1',public.payout_week_start('2025-01-07 10:00+00')::text,true);
select pg_catalog.set_config('m6.w2',public.payout_week_start('2025-01-14 10:00+00')::text,true);

-- Refunded or disputed before the week is frozen: never counted, nothing to take back.
select pg_temp.t_assert(public.order_tip_record_refund('pi_m6early',400)->>'state'='refunded','early refund recorded');
select pg_temp.t_assert(public.order_tip_record_dispute('dp_m6early','pi_m6dearly','needs_response')->>'state'='disputed','early dispute recorded');
select pg_temp.t_assert((select pg_catalog.count(*)=0 from public.order_tip_movements m join public.order_tips t on t.id=m.tip_id where t.teammate_id='6f000000-0000-4000-8000-000000000001'),'no movement before a tip is counted');
select pg_temp.t_assert((public.payout_pending('6f000000-0000-4000-8000-000000000001','2025-01-20 00:00+00')->>'tips')::int=600+1000+200+300,'pending tips are the payable ones');

select public.payout_freeze_week(current_setting('m6.w1')::timestamptz);
select pg_temp.t_assert((select public.payout_line_total(l.id)=18000 and (public.payout_line_dto(l.id)->>'tips')::numeric=0 from public.payout_lines l
  where l.teammate_id='6f000000-0000-4000-8000-000000000001' and l.week_start=current_setting('m6.w1')::timestamptz),'order week has the earnings and no tips');
select public.payout_freeze_week(current_setting('m6.w2')::timestamptz);
select pg_catalog.set_config('m6.line2',(select id::text from public.payout_lines where teammate_id='6f000000-0000-4000-8000-000000000001' and week_start=current_setting('m6.w2')::timestamptz),true);
select pg_temp.t_assert((select pg_catalog.count(*)=4 and pg_catalog.sum(amount_usd_cents)=2100 from public.payout_line_items where line_id=current_setting('m6.line2')::uuid and kind='tip'),'tips counted in the week they were paid');
select pg_temp.t_assert((select status='scheduled' and public.payout_line_total(id)=2100 and (public.payout_line_dto(id)->>'tips')::numeric=21
  and (public.payout_line_dto(id)->>'gross')::numeric=21 from public.payout_lines where id=current_setting('m6.line2')::uuid),'tip line is payable and the DTO shows tips');
select pg_temp.t_assert(not exists(select 1 from public.payout_line_items where kind='tip' and source_id in (current_setting('m6.tip_refund_early')::uuid,current_setting('m6.tip_dispute_early')::uuid)),'refunded and disputed tips not counted');
select pg_temp.t_assert(not exists(select 1 from public.payout_line_items where kind='tip' and source_id=current_setting('m6.tip_paid')::uuid),'tip paid now stays in the running week');

-- ---- T7: refunds and disputes after counting are taken back next week, replays converge ------------
select pg_temp.t_assert((public.order_tip_record_refund('pi_m6late',600)->>'movement')::int=-600,'late refund takes the tip back');
select pg_temp.t_assert((public.order_tip_record_refund('pi_m6late',600)->>'updated')::boolean is false,'refund replay is a no-op');
select pg_temp.t_assert((public.order_tip_record_refund('pi_m6partial',250)->>'movement')::int=-250,'partial refund takes back its share');
select pg_temp.t_assert((select state='paid' and refunded_cents=250 from public.order_tips where id=current_setting('m6.tip_partial')::uuid),'partial refund keeps the rest paid');
select pg_temp.t_assert((public.order_tip_record_refund('pi_m6partial',100)->>'updated')::boolean is false,'older refund total ignored');
select pg_temp.t_assert((public.order_tip_record_refund('pi_m6partial',1000)->>'movement')::int=-750,'full refund takes back the rest');
select pg_temp.t_assert((select state='refunded' from public.order_tips where id=current_setting('m6.tip_partial')::uuid),'fully refunded');
select pg_temp.t_assert((public.order_tip_record_dispute('dp_m6won','pi_m6won','needs_response')->>'movement')::int=-200,'open dispute takes the tip back');
select pg_temp.t_assert((public.order_tip_record_dispute('dp_m6won','pi_m6won','under_review')->>'movement')::int=0,'dispute update does not take back twice');
select pg_temp.t_assert((public.order_tip_record_dispute('dp_m6won','pi_m6won','won')->>'movement')::int=200,'won dispute gives the tip back');
select pg_temp.t_assert((select state='paid' from public.order_tips where id=current_setting('m6.tip_won')::uuid),'won tip is paid again');
select pg_temp.t_assert((public.order_tip_record_dispute('dp_m6lost','pi_m6lost','needs_response')->>'movement')::int=-300,'second dispute takes back');
select pg_temp.t_assert((public.order_tip_record_dispute('dp_m6lost','pi_m6lost','lost')->>'movement')::int=0,'lost dispute stays taken back once');
select pg_temp.t_assert((select state='disputed' from public.order_tips where id=current_setting('m6.tip_lost')::uuid),'lost tip stays disputed');
select pg_temp.t_assert(public.order_tip_record_dispute('dp_m6order','pi_m6order_unknown','lost')->>'updated'='false','order payment disputes are not tips');
select pg_temp.t_assert(public.order_tip_record_refund('pi_m6order_unknown',100)->>'updated'='false','order payment refunds are not tips');
select pg_temp.t_assert((select pg_catalog.sum(m.amount_usd_cents)=-(600+250+750+200-200+300) from public.order_tip_movements m join public.order_tips t on t.id=m.tip_id where t.teammate_id='6f000000-0000-4000-8000-000000000001'),'movements sum to what was taken back');
select pg_temp.t_assert(exists(select 1 from public.admin_audit_log where action='Tip refunded' and target='Tip Mate'),'refund audited');
select pg_temp.t_assert(exists(select 1 from public.admin_audit_log where action='Tip taken back after dispute'),'dispute audited');
-- The frozen tip week is unchanged (immutable); the take-back lands in the next frozen week.
select pg_temp.t_assert((select public.payout_line_total(id)=2100 from public.payout_lines where id=current_setting('m6.line2')::uuid),'frozen week unchanged');
select pg_temp.t_assert((public.payout_pending('6f000000-0000-4000-8000-000000000001',pg_catalog.clock_timestamp()+interval '1 second')->>'tips')::int=550-1900,'running week shows the paid tip minus take-backs');
select pg_catalog.set_config('m6.w_now',public.payout_week_start(pg_catalog.clock_timestamp())::text,true);
select public.payout_freeze_week(current_setting('m6.w_now')::timestamptz);
select pg_temp.t_assert((select pg_catalog.sum(i.amount_usd_cents)=-1900 and pg_catalog.count(*)=6 from public.payout_line_items i join public.payout_lines l on l.id=i.line_id
  where l.teammate_id='6f000000-0000-4000-8000-000000000001' and l.week_start=current_setting('m6.w_now')::timestamptz and i.kind='tip_adjust'),'take-backs counted in the next week');
select pg_temp.t_assert((select public.payout_line_total(l.id)=550-1900 and l.status='carried' from public.payout_lines l
  where l.teammate_id='6f000000-0000-4000-8000-000000000001' and l.week_start=current_setting('m6.w_now')::timestamptz),'negative week carries forward (E6)');
select pg_temp.t_assert((select (public.payout_line_dto(l.id)->>'tips')::numeric=5.5-19 from public.payout_lines l
  where l.teammate_id='6f000000-0000-4000-8000-000000000001' and l.week_start=current_setting('m6.w_now')::timestamptz),'line DTO nets tips and take-backs');
-- A refund after the take-back week is frozen creates no second take-back.
select pg_temp.t_assert((public.order_tip_record_refund('pi_m6late',600)->>'updated')::boolean is false,'late replay after freeze no-op');
select pg_temp.t_assert(public.tip_sync_payout(current_setting('m6.tip_refund_late')::uuid,'replay')=0,'sync is idempotent');
-- Movements are immutable.
do $$ begin
  begin update public.order_tip_movements set amount_usd_cents=1; raise exception 'movement updated'; exception when sqlstate 'PT409' then null; end;
end $$;

-- ---- teammate view, wallet and cashback untouched (T4, T6) ---------------------------------------
set local role authenticated;
select pg_temp.login('6f000000-0000-4000-8000-000000000001');
select pg_temp.t_assert((public.teammate_stats()->'stats'->>'tipsTotal')::numeric=(550+0+0+0+200+0+0)/100.0,'teammate sees what they keep of their tips');
select pg_temp.login('6f000000-0000-4000-8000-000000000002');
select pg_temp.t_assert((public.teammate_stats()->'stats'->>'tipsTotal')::numeric=0,'other teammate sees none of them');
reset role;
select pg_temp.t_assert((select pg_catalog.count(*)::text from public.wallet_entries)=current_setting('m6.wallet_before'),'tips never touch the wallet');
select pg_temp.t_assert((select pg_catalog.count(*)::text from public.loyalty_cashbacks)=current_setting('m6.cashback_before'),'tips never earn cashback');

-- Admin payouts screen still loads with tips in it.
set local role authenticated;
select pg_temp.login('6f000000-0000-4000-8000-000000000005');
select pg_temp.t_assert(public.admin_payouts() ? 'payouts','admin payouts loads');
reset role;

select 'order_tips: all checks passed' as result;
rollback;
