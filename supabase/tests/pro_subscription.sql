-- Rollback-only checks for 20261026120000_pro_subscription.sql (Duoly PRO, ledger #39, R1 to R6).
-- Run after the migration body in one transaction, with a savepoint before this body:
--   python3 ../run_rollback.py supabase/migrations/20261026120000_pro_subscription.sql -- supabase/tests/pro_subscription.sql
create function pg_temp.pro_assert(ok boolean, message text) returns void language plpgsql as $$
begin if ok is not true then raise exception '%', message; end if; end $$;

-- 1 = PRO customer, 2 = second customer (card reuse), 3 = teammate, 4 = plain customer.
insert into auth.users(id,aud,role,email,raw_user_meta_data,raw_app_meta_data) values
 ('b9000000-0000-4000-8000-000000000001','authenticated','authenticated','pro-1@example.invalid','{}','{}'),
 ('b9000000-0000-4000-8000-000000000002','authenticated','authenticated','pro-2@example.invalid','{}','{}'),
 ('b9000000-0000-4000-8000-000000000003','authenticated','authenticated','pro-mate@example.invalid','{}','{}'),
 ('b9000000-0000-4000-8000-000000000004','authenticated','authenticated','pro-4@example.invalid','{}','{}');
update public.profiles set name = 'Pro Fixture' where id::text like 'b9000000-0000-4000-8000-%';
update public.account_roles set role = case when user_id = 'b9000000-0000-4000-8000-000000000003' then 'teammate' else 'customer' end
 where user_id::text like 'b9000000-0000-4000-8000-%';

-- Billing customers: linked once, race keeps the first, teammates refused.
select pg_temp.pro_assert(public.pro_link_customer('b9000000-0000-4000-8000-000000000001','cus_proA') = 'cus_proA', 'link failed');
select pg_temp.pro_assert(public.pro_link_customer('b9000000-0000-4000-8000-000000000001','cus_proOther') = 'cus_proA', 'second link replaced the first');
select pg_temp.pro_assert(public.pro_link_customer('b9000000-0000-4000-8000-000000000002','cus_proB') = 'cus_proB', 'link B failed');
select pg_temp.pro_assert(public.pro_billing_customer('b9000000-0000-4000-8000-000000000001') = 'cus_proA', 'lookup failed');
do $$ begin
  begin perform public.pro_link_customer('b9000000-0000-4000-8000-000000000003','cus_proMate'); raise exception 'teammate linked';
  exception when sqlstate 'PT403' then null; end;
end $$;

-- Start: not PRO, trial available (R4 per customer).
select pg_temp.pro_assert(not public.is_pro('b9000000-0000-4000-8000-000000000001'), 'PRO before subscribing');
select pg_temp.pro_assert(public.pro_trial_eligible('b9000000-0000-4000-8000-000000000001'), 'new customer has no trial');
select pg_temp.pro_assert(not public.is_pro(null), 'null user is PRO');

-- Trial: member, trial used, card check pending.
do $$ declare r jsonb; begin
  r := public.pro_apply_subscription(clock_timestamp() - interval '10 minutes', 'sub_proA', 'cus_proA', 'trialing',
    clock_timestamp(), clock_timestamp() + interval '7 days', clock_timestamp() + interval '7 days', false, null, null,
    'b9000000-0000-4000-8000-000000000001');
  if not (r->>'created')::boolean or not (r->>'member')::boolean or not (r->>'trial_check_needed')::boolean or (r->>'duplicate')::boolean then
    raise exception 'trial start wrong: %', r; end if;
end $$;
select pg_temp.pro_assert(public.is_pro('b9000000-0000-4000-8000-000000000001'), 'trialing is not PRO');
select pg_temp.pro_assert(not public.pro_trial_eligible('b9000000-0000-4000-8000-000000000001'), 'second trial allowed');

-- Replay of the same event is idempotent; an older event is ignored.
do $$ declare r jsonb; begin
  r := public.pro_apply_subscription(clock_timestamp() - interval '10 minutes', 'sub_proA', 'cus_proA', 'trialing',
    clock_timestamp(), clock_timestamp() + interval '7 days', clock_timestamp() + interval '7 days', false, null, null, null);
  if (r->>'created')::boolean then raise exception 'replay created a second row'; end if;
  r := public.pro_apply_subscription(clock_timestamp() - interval '1 hour', 'sub_proA', 'cus_proA', 'canceled',
    null, null, null, false, clock_timestamp(), clock_timestamp(), null);
  if r->>'ignored' <> 'stale_event' then raise exception 'stale event applied: %', r; end if;
end $$;
select pg_temp.pro_assert((select count(*) = 1 and bool_and(status = 'trialing') from public.pro_subscriptions where user_id = 'b9000000-0000-4000-8000-000000000001'), 'replay or stale event changed state');

-- Wrong customer or metadata user never attaches a subscription to an account.
do $$ declare r jsonb; begin
  r := public.pro_apply_subscription(clock_timestamp(), 'sub_proX', 'cus_unknown', 'active', null, null, null, false, null, null, null);
  if r->>'ignored' <> 'unknown_customer' then raise exception 'unknown customer accepted: %', r; end if;
  r := public.pro_apply_subscription(clock_timestamp(), 'sub_proX', 'cus_proA', 'active', null, null, null, false, null, null,
    'b9000000-0000-4000-8000-000000000002');
  if r->>'ignored' <> 'user_mismatch' then raise exception 'metadata mismatch accepted: %', r; end if;
end $$;

-- R4 per card: first account keeps the fingerprint, a second account's trial is refused.
select pg_temp.pro_assert(public.pro_claim_trial_card('sub_proA', 'fpCardAAAA1111'), 'own card refused');
select pg_temp.pro_assert(public.pro_claim_trial_card('sub_proA', 'fpCardAAAA1111'), 'repeat claim refused');
select public.pro_apply_subscription(clock_timestamp() - interval '5 minutes', 'sub_proB', 'cus_proB', 'trialing',
  clock_timestamp(), clock_timestamp() + interval '7 days', clock_timestamp() + interval '7 days', false, null, null, null);
select pg_temp.pro_assert(not public.pro_claim_trial_card('sub_proB', 'fpCardAAAA1111'), 'card reused for a second trial');
select pg_temp.pro_assert((select trial_card_checked from public.pro_subscriptions where stripe_subscription_id = 'sub_proB'), 'card check not recorded');
do $$ declare r jsonb; begin
  r := public.pro_apply_subscription(clock_timestamp() - interval '4 minutes', 'sub_proB', 'cus_proB', 'trialing',
    clock_timestamp(), clock_timestamp() + interval '7 days', clock_timestamp() + interval '7 days', false, null, null, null);
  if (r->>'trial_check_needed')::boolean then raise exception 'checked trial asked again'; end if;
end $$;
-- The webhook ends B's trial: B pays at once and stays PRO while active.
select public.pro_apply_subscription(clock_timestamp() - interval '3 minutes', 'sub_proB', 'cus_proB', 'active',
  clock_timestamp(), clock_timestamp(), clock_timestamp() + interval '1 month', false, null, null, null);
select pg_temp.pro_assert(public.is_pro('b9000000-0000-4000-8000-000000000002'), 'paid B not PRO');

-- Active, then cancel at period end: still PRO until the period ends.
select public.pro_apply_subscription(clock_timestamp() - interval '9 minutes', 'sub_proA', 'cus_proA', 'active',
  null, null, clock_timestamp() + interval '1 month', true, clock_timestamp(), null, null);
select pg_temp.pro_assert(public.is_pro('b9000000-0000-4000-8000-000000000001'), 'cancel at period end removed PRO early');
select pg_temp.pro_assert((public.pro_status_dto('b9000000-0000-4000-8000-000000000001') #>> '{subscription,cancel_at_period_end}')::boolean, 'DTO misses cancel at period end');

-- R6: past_due keeps PRO for 3 days from the first failure, then stops; a retry keeps the start.
select public.pro_apply_subscription(clock_timestamp() - interval '8 minutes', 'sub_proA', 'cus_proA', 'past_due',
  null, null, clock_timestamp() + interval '1 month', false, null, null, null);
select pg_temp.pro_assert(public.is_pro('b9000000-0000-4000-8000-000000000001'), 'past_due lost PRO inside grace');
select pg_temp.pro_assert(public.pro_status_dto('b9000000-0000-4000-8000-000000000001') #>> '{subscription,grace_until}' is not null, 'DTO misses grace end');
update public.pro_subscriptions set past_due_since = clock_timestamp() - interval '4 days' where stripe_subscription_id = 'sub_proA';
select public.pro_apply_subscription(clock_timestamp() - interval '7 minutes', 'sub_proA', 'cus_proA', 'past_due',
  null, null, clock_timestamp() + interval '1 month', false, null, null, null);
select pg_temp.pro_assert(not public.is_pro('b9000000-0000-4000-8000-000000000001'), 'past_due kept PRO after 3 days');
-- Payment recovered: active again, grace cleared.
select public.pro_apply_subscription(clock_timestamp() - interval '6 minutes', 'sub_proA', 'cus_proA', 'active',
  null, null, clock_timestamp() + interval '1 month', false, null, null, null);
select pg_temp.pro_assert(public.is_pro('b9000000-0000-4000-8000-000000000001'), 'recovered payment not PRO');
select pg_temp.pro_assert((select past_due_since is null from public.pro_subscriptions where stripe_subscription_id = 'sub_proA'), 'grace start not cleared');
-- unpaid and stale periods never count.
update public.pro_subscriptions set current_period_end = clock_timestamp() - interval '4 days' where stripe_subscription_id = 'sub_proA';
select pg_temp.pro_assert(not public.is_pro('b9000000-0000-4000-8000-000000000001'), 'stale active period kept PRO');
update public.pro_subscriptions set current_period_end = clock_timestamp() + interval '1 month' where stripe_subscription_id = 'sub_proA';

-- A second live subscription for the same account is flagged so the webhook cancels it.
do $$ declare r jsonb; begin
  perform public.pro_link_customer('b9000000-0000-4000-8000-000000000004','cus_proD');
  r := public.pro_apply_subscription(clock_timestamp(), 'sub_proA2', 'cus_proA', 'active', null, null,
    clock_timestamp() + interval '1 month', false, null, null, null);
  if not (r->>'duplicate')::boolean then raise exception 'duplicate not flagged: %', r; end if;
end $$;
select public.pro_apply_subscription(clock_timestamp() + interval '1 second', 'sub_proA2', 'cus_proA', 'canceled', null, null,
  clock_timestamp() + interval '1 month', false, clock_timestamp(), clock_timestamp(), null);

-- Invoices: audit only, idempotent, never wallet credit or loyalty (R5).
select public.pro_record_invoice(clock_timestamp() - interval '2 minutes', 'in_proA1', 'sub_proA', 'failed', 499, 'eur');
select public.pro_record_invoice(clock_timestamp() - interval '1 minute', 'in_proA1', 'sub_proA', 'paid', 499, 'eur');
select public.pro_record_invoice(clock_timestamp() - interval '3 minutes', 'in_proA1', 'sub_proA', 'failed', 499, 'eur');
select pg_temp.pro_assert((select count(*) = 1 and bool_and(state = 'paid') from public.pro_invoices where stripe_invoice_id = 'in_proA1'), 'invoice replay or order wrong');
select pg_temp.pro_assert(public.pro_record_invoice(clock_timestamp(), 'in_proZ', 'sub_unknown', 'paid', 499, 'eur')->>'ignored' = 'unknown_subscription', 'unknown invoice recorded');
select pg_temp.pro_assert(not exists (select 1 from public.wallet_entries where customer_id = 'b9000000-0000-4000-8000-000000000001'), 'PRO fee created wallet entries');

-- Checkout guard: PRO discount only for members, never together with the creator discount.
insert into public.checkout_intents(customer_id,game,service,title,units,unit,region,ign,amount_eur_cents,payout_usd_cents,booking_fx,pro_discount_cents,expires_at)
values('b9000000-0000-4000-8000-000000000001','lol','duo2','Duo Pro',1,'game','EUW','Pro#EUW',900,660,1.1,100,clock_timestamp()+interval '30 minutes');
do $$ begin
  begin
    insert into public.checkout_intents(customer_id,game,service,title,units,unit,region,ign,amount_eur_cents,payout_usd_cents,booking_fx,pro_discount_cents,expires_at)
    values('b9000000-0000-4000-8000-000000000004','lol','duo2','Duo Pro',1,'game','EUW','Plain#EUW',900,660,1.1,100,clock_timestamp()+interval '30 minutes');
    raise exception 'non-member got the PRO discount';
  exception when sqlstate 'PT409' then null; end;
  begin
    insert into public.checkout_intents(customer_id,game,service,title,units,unit,region,ign,amount_eur_cents,payout_usd_cents,booking_fx,pro_discount_cents,first_order_discount_cents,expires_at)
    values('b9000000-0000-4000-8000-000000000001','lol','duo2','Duo Pro',1,'game','EUW','Pro#EUW',800,660,1.1,100,100,clock_timestamp()+interval '30 minutes');
    raise exception 'PRO and creator discount stacked';
  exception when check_violation then null; end;
end $$;

-- R2: re-rolls. Teammate fixture, an in-progress order with 2 re-rolls already used.
insert into public.orders(id,customer_id,customer_name,game,service,title,units,unit,region,ign,amount_eur_cents,payout_usd_cents,booking_fx,created_at,queued_at)
values
 ('b9100000-0000-4000-8000-000000000001','b9000000-0000-4000-8000-000000000001','Pro Fixture','lol','duo2','Duo Pro',1,'game','EUW','Pro#EUW',900,660,1.1,clock_timestamp()-interval '3 minutes',clock_timestamp()-interval '2 minutes'),
 ('b9100000-0000-4000-8000-000000000004','b9000000-0000-4000-8000-000000000004','Pro Fixture','lol','duo2','Duo Pro',1,'game','EUW','Plain#EUW',900,660,1.1,clock_timestamp()-interval '3 minutes',clock_timestamp()-interval '2 minutes');
insert into public.order_assignments(id,order_id,teammate_id,accepted_at) values
 ('b9200000-0000-4000-8000-000000000001','b9100000-0000-4000-8000-000000000001','b9000000-0000-4000-8000-000000000003',clock_timestamp()-interval '1 minute');
update public.orders set status='in_progress', assigned_teammate_id='b9000000-0000-4000-8000-000000000003',
  current_assignment_id='b9200000-0000-4000-8000-000000000001', accepted_at=clock_timestamp()-interval '1 minute', rerolls=2
 where id='b9100000-0000-4000-8000-000000000001';
do $$ begin
  begin
    update public.orders set rerolls = 21 where id = 'b9100000-0000-4000-8000-000000000001';
    raise exception 'rerolls above 20 accepted';
  exception when check_violation then null; end;
end $$;

-- Browser role: own status only, no tables, no service functions.
set local role authenticated;
select pg_catalog.set_config('request.jwt.claims','{"role":"authenticated","sub":"b9000000-0000-4000-8000-000000000001"}',true);
select pg_catalog.set_config('request.jwt.claim.sub','b9000000-0000-4000-8000-000000000001',true);
select pg_temp.pro_assert((public.pro_my_status()->>'member')::boolean, 'own status not PRO');
select pg_temp.pro_assert(public.pro_my_status() #>> '{subscription,status}' = 'active', 'own status wrong');
do $$ declare v jsonb; begin
  -- PRO member: third re-roll inside 5 minutes works.
  v := public.reroll_order('b9100000-0000-4000-8000-000000000001');
  if v ? 'error' or (v #>> '{order,rerolls}')::int <> 3 then raise exception 'PRO third re-roll refused: %', v; end if;
  begin perform public.is_pro('b9000000-0000-4000-8000-000000000001'); raise exception 'browser called is_pro'; exception when insufficient_privilege then null; end;
  begin perform public.pro_status_dto('b9000000-0000-4000-8000-000000000002'); raise exception 'browser read another status'; exception when insufficient_privilege then null; end;
  begin perform public.pro_apply_subscription(clock_timestamp(),'sub_proEvil','cus_proA','active',null,null,null,false,null,null,null); raise exception 'browser wrote a subscription'; exception when insufficient_privilege then null; end;
  begin perform public.pro_link_customer('b9000000-0000-4000-8000-000000000001','cus_proEvil'); raise exception 'browser linked a customer'; exception when insufficient_privilege then null; end;
  begin perform public.pro_claim_trial_card('sub_proA','fpCardEvil1111'); raise exception 'browser claimed a card'; exception when insufficient_privilege then null; end;
  begin perform public.pro_record_invoice(clock_timestamp(),'in_evil','sub_proA','paid',0,'eur'); raise exception 'browser recorded an invoice'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.pro_subscriptions; raise exception 'browser read subscriptions'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.pro_billing_customers; raise exception 'browser read customers'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.pro_trial_cards; raise exception 'browser read trial cards'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.pro_invoices; raise exception 'browser read invoices'; exception when insufficient_privilege then null; end;
end $$;
reset role;

-- Non-member: the limit of 2 stays.
insert into public.order_assignments(id,order_id,teammate_id,accepted_at) values
 ('b9200000-0000-4000-8000-000000000004','b9100000-0000-4000-8000-000000000004','b9000000-0000-4000-8000-000000000003',clock_timestamp()-interval '1 minute');
update public.orders set status='in_progress', assigned_teammate_id='b9000000-0000-4000-8000-000000000003',
  current_assignment_id='b9200000-0000-4000-8000-000000000004', accepted_at=clock_timestamp()-interval '1 minute', rerolls=2
 where id='b9100000-0000-4000-8000-000000000004';
set local role authenticated;
select pg_catalog.set_config('request.jwt.claims','{"role":"authenticated","sub":"b9000000-0000-4000-8000-000000000004"}',true);
select pg_catalog.set_config('request.jwt.claim.sub','b9000000-0000-4000-8000-000000000004',true);
select pg_temp.pro_assert((public.pro_my_status()->>'member')::boolean = false, 'plain customer is PRO');
select pg_temp.pro_assert((public.reroll_order('b9100000-0000-4000-8000-000000000004') #>> '{error,code}')::int = 409, 'non-member third re-roll allowed');
reset role;

-- Anonymous: nothing.
set local role anon;
do $$ begin
  begin perform public.pro_my_status(); raise exception 'anon read PRO status'; exception when insufficient_privilege then null; end;
end $$;
reset role;

-- Service role: functions yes, direct writes no.
set local role service_role;
do $$ begin
  perform public.is_pro('b9000000-0000-4000-8000-000000000001');
  begin insert into public.pro_subscriptions(stripe_subscription_id,user_id,stripe_customer_id,status,last_event_at)
    values('sub_proDirect','b9000000-0000-4000-8000-000000000001','cus_proA','active',clock_timestamp());
    raise exception 'service role wrote the table directly';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

select pg_temp.pro_assert(pg_catalog.has_function_privilege('authenticated','public.reroll_order(uuid)','execute'), 'reroll grant lost');
select pg_temp.pro_assert(not pg_catalog.has_function_privilege('anon','public.reroll_order(uuid)','execute'), 'anon can reroll');
select 'pro_subscription: all checks passed' as result;
