-- Rollback-only checks for 20261023120000_stripe_payments.sql.
begin;
do $$ begin
  if exists (select 1 from auth.users where id in ('5e100000-0000-4000-8000-000000000001','5e100000-0000-4000-8000-000000000002'))
  then raise exception 'Fixture collision'; end if;
end $$;
insert into auth.users (id, aud, role, email, raw_user_meta_data, raw_app_meta_data) values
  ('5e100000-0000-4000-8000-000000000001','authenticated','authenticated','duoly-pay-a@example.invalid','{}','{}'),
  ('5e100000-0000-4000-8000-000000000002','authenticated','authenticated','duoly-pay-b@example.invalid','{}','{}');
update public.profiles set name = 'Pay Tester', country = 'at' where id = '5e100000-0000-4000-8000-000000000001';

insert into public.checkout_intents (id, customer_id, game, service, title, units, unit, region, ign,
  amount_eur_cents, payout_usd_cents, booking_fx, expires_at) values
  ('5e1a0000-0000-4000-8000-000000000001','5e100000-0000-4000-8000-000000000001','lol','duo2','Duo Pro',3,'game','EUW','Tester#EUW',1617,1047,1.08, now() + interval '30 minutes'),
  ('5e1a0000-0000-4000-8000-000000000002','5e100000-0000-4000-8000-000000000001','lol','duo2','Duo Pro',1,'game','EUW','Tester#EUW',599,387,1.08, now() + interval '30 minutes');

do $$
declare r jsonb; r2 jsonb; o public.orders; pay public.order_payments;
begin
  r := public.create_paid_order('5e1a0000-0000-4000-8000-000000000001','pi_test1',1617,'EUR','card','authorized');
  if not (r ? 'order_id') or (r->>'created')::boolean is not true then raise exception 'first create failed: %', r; end if;
  r2 := public.create_paid_order('5e1a0000-0000-4000-8000-000000000001','pi_test1',1617,'EUR','card','authorized');
  if r2->>'order_id' <> r->>'order_id' or (r2->>'created')::boolean then raise exception 'not idempotent: %', r2; end if;
  select * into o from public.orders where id = (r->>'order_id')::uuid;
  if o.status <> 'queued' or o.customer_name <> 'Pay Tester' or o.customer_country <> 'at' or o.amount_eur_cents <> 1617 then
    raise exception 'order fields wrong'; end if;
  -- A second paid checkout while one order is open is a conflict, not a second order.
  r2 := public.create_paid_order('5e1a0000-0000-4000-8000-000000000002','pi_test2',599,'eur','card','authorized');
  if (r2->>'conflict')::boolean is not true then raise exception 'conflict expected: %', r2; end if;
  if (select status from public.checkout_intents where id = '5e1a0000-0000-4000-8000-000000000002') <> 'conflict' then raise exception 'intent not marked conflict'; end if;

  -- Customer cancel releases the authorization and posts no wallet credit.
  update public.orders set status = 'cancelled', cancelled_at = clock_timestamp(), cancel_reason = 'customer_cancelled' where id = o.id;
  select * into pay from public.order_payments where order_id = o.id;
  if pay.settle <> 'release' then raise exception 'cancel must request release, got %', pay.settle; end if;
  if exists (select 1 from public.refund_credits where order_id = o.id) then raise exception 'no wallet credit for Stripe orders'; end if;
  if (select count(*) from public.claim_payment_settlements(10) where order_id = o.id) <> 1 then raise exception 'claim failed'; end if;
  perform public.finish_payment_settlement(o.id, 'voided');
  select * into pay from public.order_payments where order_id = o.id;
  if pay.state <> 'voided' or pay.settle <> 'none' then raise exception 'finish failed'; end if;
end $$;

-- Accept requests capture.
insert into public.checkout_intents (id, customer_id, game, service, title, units, unit, region, ign,
  amount_eur_cents, payout_usd_cents, booking_fx, expires_at) values
  ('5e1a0000-0000-4000-8000-000000000003','5e100000-0000-4000-8000-000000000001','lol','duo2','Duo Pro',1,'game','EUW','Tester#EUW',599,387,1.08, now() + interval '30 minutes');
do $$
declare r jsonb; v_assignment uuid; v_order uuid;
begin
  r := public.create_paid_order('5e1a0000-0000-4000-8000-000000000003','pi_test3',599,'eur','paypal','authorized');
  v_order := (r->>'order_id')::uuid;
  if v_order is null then raise exception 'third create failed: %', r; end if;
  insert into public.order_assignments(order_id, teammate_id, accepted_at) values (v_order, '5e100000-0000-4000-8000-000000000002', clock_timestamp()) returning id into v_assignment;
  update public.orders set status = 'in_progress', assigned_teammate_id = '5e100000-0000-4000-8000-000000000002',
    current_assignment_id = v_assignment, accepted_at = clock_timestamp() where id = v_order;
  if (select settle from public.order_payments where order_id = v_order) <> 'capture' then raise exception 'accept must request capture'; end if;
end $$;

-- Clients cannot touch payment tables or functions.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"5e100000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$
begin
  begin perform 1 from public.order_payments; raise exception 'order_payments readable';
  exception when insufficient_privilege then null; end;
  begin perform public.create_paid_order('5e1a0000-0000-4000-8000-000000000003','pi_x',1,'eur','card','captured'); raise exception 'create_paid_order callable';
  exception when insufficient_privilege then null; end;
  if (public.customer_checkout_status('5e1a0000-0000-4000-8000-000000000003')->>'status') <> 'paid' then raise exception 'own status not visible'; end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"5e100000-0000-4000-8000-000000000002","role":"authenticated"}', true);
do $$ begin
  if public.customer_checkout_status('5e1a0000-0000-4000-8000-000000000003') ? 'status' then raise exception 'foreign intent visible'; end if;
end $$;
reset role;

select 'stripe_payments: all checks passed' as result;
rollback;
