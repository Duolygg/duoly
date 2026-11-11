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

-- Run as database owner ONLY in an isolated local/development database, with ON_ERROR_STOP.
-- This is real role-switched SQL, but has NOT been executed by its author.
-- All rows use synthetic reserved fixture IDs; no credentials/providers/private data.
-- Explicit public_reference values avoid nontransactional nextval changes.
-- Parent must additionally run TWO independent sessions for race acceptance; this
-- single-session rollback suite cannot prove lock scheduling or concurrent winners.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';
do $$
begin
  if exists (select 1 from auth.users where id::text like 'f6220000-0000-4000-8000-%')
    or exists (select 1 from public.orders where id::text like 'e6220000-0000-4000-8000-%' or public_reference like 'DL-990622%')
    or exists (select 1 from public.order_assignments where id::text like 'd6220000-0000-4000-8000-%')
    or exists (select 1 from public.teammate_order_access where discord_id like '990622%') then
    raise exception 'Fixture collision: refusing to overwrite existing data';
  end if;
end;
$$;
-- IDs 1..8 customers; 9..11 regular teammates; 12 GG; 13 admin;
-- 14 unlinked teammate, 15 suspended teammate, 16 default/no-access teammate.
insert into auth.users(id, raw_user_meta_data)
select ('f6220000-0000-4000-8000-' || pg_catalog.lpad(n::text, 12, '0'))::uuid,
  '{"role":"admin","admin":true,"gg_access":true,"priority_base":0}'::jsonb
from pg_catalog.generate_series(1,16) as n;
update public.account_roles set role = case when user_id = 'f6220000-0000-4000-8000-000000000013' then 'admin' else 'teammate' end
where user_id::text like 'f6220000-0000-4000-8000-%' and user_id >= 'f6220000-0000-4000-8000-000000000009';
insert into public.teammate_order_access(user_id,approved_games,gg_access,discord_id,discord_verified_at,suspended,priority_base)
select ('f6220000-0000-4000-8000-' || pg_catalog.lpad(n::text,12,'0'))::uuid,
  array['lol']::text[], n = 12,
  case when n = 14 then null else '990622000000000' || pg_catalog.lpad(n::text,3,'0') end,
  case when n = 14 then null else pg_catalog.clock_timestamp() end, n = 15, 0
from pg_catalog.generate_series(9,15) as n where n <> 13;
-- Orders 1 reroll flow, 2 queued cancellation, 3 expired, 4 GG,
-- 5 unapproved game, 6 priority-gated, 7 spare/busy, 8 five-minute reroll window.
insert into public.orders(id,public_reference,customer_id,game,service,title,units,unit,gg,region,ign,customer_name,amount_eur_cents,booking_fx,payout_usd_cents,created_at,queued_at)
select ('e6220000-0000-4000-8000-' || pg_catalog.lpad(n::text,12,'0'))::uuid,
  'DL-990622' || pg_catalog.lpad(n::text,4,'0'),
  ('f6220000-0000-4000-8000-' || pg_catalog.lpad(n::text,12,'0'))::uuid,
  case when n in (4,5) then 'val' else 'lol' end, 'duo', 'Fixture duo', 1, 'game', n = 4,
  'EUW', 'FixturePlayer', 'Fixture', 999, 1.08, 646,
  pg_catalog.clock_timestamp() - interval '10 minutes',
  pg_catalog.clock_timestamp() - case when n = 3 then interval '6 minutes' when n = 6 then interval '0 seconds' else interval '2 minutes' end
from pg_catalog.generate_series(1,8) as n;
-- Teammate own-order exclusion even if a trusted producer misclassifies an account.
insert into public.orders(id,public_reference,customer_id,game,service,title,units,unit,region,ign,customer_name,amount_eur_cents,booking_fx,payout_usd_cents,created_at,queued_at)
values('e6220000-0000-4000-8000-000000000009','DL-9906220009','f6220000-0000-4000-8000-000000000009',
  'lol','duo','Own fixture',1,'game','EUW','FixturePlayer','Fixture',999,1.08,646,
  pg_catalog.clock_timestamp() - interval '3 minutes',pg_catalog.clock_timestamp() - interval '2 minutes');

-- Owner constraint assertions catch silent CHECK/NULL and foreign-key mistakes.
do $$
begin
  begin
    insert into public.orders select (pg_catalog.jsonb_populate_record(null::public.orders,
      pg_catalog.to_jsonb(o) || '{"id":"e6220000-0000-4000-8000-000000000099","public_reference":"DL-9906220099"}'::jsonb)).*
      from public.orders as o where o.id = 'e6220000-0000-4000-8000-000000000001';
    raise exception 'Duplicate open customer allowed';
  exception when unique_violation then null; end;
  begin
    update public.orders set units = 11 where id = 'e6220000-0000-4000-8000-000000000001';
    raise exception 'Unbounded units allowed';
  exception when check_violation then null; end;
  begin
    update public.orders set note = pg_catalog.repeat('x',201) where id = 'e6220000-0000-4000-8000-000000000001';
    raise exception 'Unbounded note allowed';
  exception when check_violation then null; end;
  begin
    update public.orders set status = 'cancelled', cancel_reason = 'queue_expired' where id = 'e6220000-0000-4000-8000-000000000001';
    raise exception 'NULL cancellation time bypassed state constraint';
  exception when check_violation then null; end;
  begin
    update public.orders set customer_id = 'f6220000-0000-4000-8000-000000009999' where id = 'e6220000-0000-4000-8000-000000000001';
    raise exception 'Orphan customer allowed';
  exception when foreign_key_violation then null; end;
  begin
    insert into public.refund_credits(order_id,customer_id,kind,amount_eur_cents)
      values('e6220000-0000-4000-8000-000000000005','f6220000-0000-4000-8000-000000000001','queued_refund',999);
    raise exception 'Refund customer identity mismatch allowed';
  exception when foreign_key_violation then null; end;
  begin
    insert into public.refund_credits(order_id,customer_id,kind,amount_eur_cents)
      values('e6220000-0000-4000-8000-000000000005','f6220000-0000-4000-8000-000000000005','queued_refund',100);
    raise exception 'Refund amount mismatch allowed';
  exception when foreign_key_violation then null; end;
  if exists (select 1 from pg_catalog.pg_class as c join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname in ('orders','order_assignments','teammate_order_access','refund_credits') and not c.relrowsecurity)
    or (select count(*) from pg_catalog.pg_class as c join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname in ('orders','order_assignments','teammate_order_access','refund_credits') and c.relrowsecurity) <> 4 then
    raise exception 'RLS not enabled on all order tables';
  end if;
  if exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename in ('orders','order_assignments','teammate_order_access','refund_credits')) then
    raise exception 'Unexpected raw-table policy: RPC-only surface required';
  end if;
  if not exists (select 1 from public.account_roles where user_id = 'f6220000-0000-4000-8000-000000000001' and role = 'customer') then raise exception 'Metadata bootstrapped privileged role'; end if;
end;
$$;

set local role anon;
select pg_catalog.set_config('request.jwt.claims','{}',true);
select pg_catalog.set_config('request.jwt.claim.sub','',true);
do $$
begin
  begin perform public.customer_active_order(); raise exception 'Anonymous RPC allowed'; exception when insufficient_privilege then null; end;
  begin perform public.teammate_order_queue(); raise exception 'Anonymous queue allowed'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.orders; raise exception 'Anonymous raw orders allowed'; exception when insufficient_privilege then null; end;
end;
$$;
reset role;
set local role authenticated;
-- Authenticated database role with no JWT subject must not be an actor.
select pg_catalog.set_config('request.jwt.claims','{"role":"authenticated","user_metadata":{"role":"admin"}}',true);
select pg_catalog.set_config('request.jwt.claim.sub','',true);
do $$
begin
  if (public.customer_active_order() #>> '{error,code}')::integer is distinct from 401 then raise exception 'No-subject customer denial failed'; end if;
  if (public.teammate_order_queue() #>> '{error,code}')::integer is distinct from 401 then raise exception 'No-subject teammate denial failed'; end if;
  if (public.accept_order('e6220000-0000-4000-8000-000000000001') #>> '{error,code}')::integer is distinct from 401 then raise exception 'No-subject accept denial failed'; end if;
end;
$$;
select pg_catalog.set_config('request.jwt.claims','{"sub":"f6220000-0000-4000-8000-000000000001","role":"authenticated","user_metadata":{"role":"admin","gg_access":true}}',true);
select pg_catalog.set_config('request.jwt.claim.sub','f6220000-0000-4000-8000-000000000001',true);
do $$
declare v jsonb; t text;
begin
  if (public.customer_active_order() #>> '{order,id}') is distinct from 'e6220000-0000-4000-8000-000000000001' then raise exception 'Own active order failed'; end if;
  if (public.customer_order('e6220000-0000-4000-8000-000000000002') #>> '{error,code}')::integer is distinct from 404 then raise exception 'Cross-customer disclosure'; end if;
  if (public.cancel_queued_order('e6220000-0000-4000-8000-000000000002') #>> '{error,code}')::integer is distinct from 404 then raise exception 'Cross-customer cancellation'; end if;
  if (public.reroll_order('e6220000-0000-4000-8000-000000000002') #>> '{error,code}')::integer is distinct from 404 then raise exception 'Cross-customer reroll'; end if;
  if (public.teammate_order_queue() #>> '{error,code}')::integer is distinct from 403 then raise exception 'Metadata escalated queue role'; end if;
  if (public.accept_order('e6220000-0000-4000-8000-000000000001') #>> '{error,code}')::integer is distinct from 403 then raise exception 'Customer accepted'; end if;
  v := public.customer_order_history();
  if pg_catalog.jsonb_array_length(v -> 'orders') <> 1 then raise exception 'History not own-row scoped'; end if;
  if public.customer_refund_credits() -> 'credits' is distinct from '[]'::jsonb then raise exception 'Cross-customer credits'; end if;
  if (public.customer_order_history(null,0) #>> '{error,code}')::integer is distinct from 400 then raise exception 'NULL pagination accepted'; end if;
  if (public.customer_refund_credits(101,0) #>> '{error,code}')::integer is distinct from 400 then raise exception 'Unbounded pagination accepted'; end if;
  foreach t in array array['orders','order_assignments','teammate_order_access','refund_credits'] loop
    begin execute pg_catalog.format('select * from public.%I',t); raise exception 'Authenticated raw SELECT allowed: %',t; exception when insufficient_privilege then null; end;
    begin execute pg_catalog.format('delete from public.%I',t); raise exception 'Authenticated DELETE allowed: %',t; exception when insufficient_privilege then null; end;
  end loop;
  begin insert into public.orders(id) values(pg_catalog.gen_random_uuid()); raise exception 'Client order insert allowed'; exception when insufficient_privilege then null; end;
  begin update public.orders set amount_eur_cents = 99; raise exception 'Client financial update allowed'; exception when insufficient_privilege then null; end;
  begin update public.orders set status = 'completed'; raise exception 'Completion without proof allowed'; exception when insufficient_privilege then null; end;
  begin insert into public.order_assignments(order_id,teammate_id,accepted_at) values('e6220000-0000-4000-8000-000000000001','f6220000-0000-4000-8000-000000000009',pg_catalog.clock_timestamp()); raise exception 'Client assignment insert allowed'; exception when insufficient_privilege then null; end;
  begin insert into public.refund_credits(order_id,customer_id,kind,amount_eur_cents) values('e6220000-0000-4000-8000-000000000001','f6220000-0000-4000-8000-000000000001','queued_refund',999); raise exception 'Client refund insert allowed'; exception when insufficient_privilege then null; end;
  begin update public.teammate_order_access set priority_base = 0, gg_access = true; raise exception 'Client access write allowed'; exception when insufficient_privilege then null; end;
  begin perform public.order_sweep(100); raise exception 'Private sweep executable'; exception when insufficient_privilege then null; end;
  begin perform public.order_expire_locked('e6220000-0000-4000-8000-000000000001'); raise exception 'Private expiry executable'; exception when insufficient_privilege then null; end;
  begin perform public.sweep_expired_orders(100); raise exception 'Authenticated scheduler allowed'; exception when insufficient_privilege then null; end;
  begin perform pg_catalog.nextval('public.order_reference_seq'); raise exception 'Client sequence allowed'; exception when insufficient_privilege then null; end;
end;
$$;
reset role;
-- Expiry caused by customer read is durable within this transaction and exactly once.
do $$
begin
  if not exists (select 1 from public.orders where id = 'e6220000-0000-4000-8000-000000000003' and status = 'cancelled') then raise exception 'Pre-read sweep did not persist expiry'; end if;
  if (select count(*) from public.refund_credits where order_id = 'e6220000-0000-4000-8000-000000000003' and amount_eur_cents = 999) <> 1 then raise exception 'Expiry credit missing or duplicated'; end if;
end;
$$;

-- Cancellation is own-queued only and idempotent.
set local role authenticated;
select pg_catalog.set_config('request.jwt.claims','{"sub":"f6220000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select pg_catalog.set_config('request.jwt.claim.sub','f6220000-0000-4000-8000-000000000002',true);
do $$
begin
  if public.cancel_queued_order('e6220000-0000-4000-8000-000000000002') #>> '{order,status}' is distinct from 'cancelled' then raise exception 'Queued cancel failed'; end if;
  perform public.cancel_queued_order('e6220000-0000-4000-8000-000000000002');
  if pg_catalog.jsonb_array_length(public.customer_refund_credits() -> 'credits') <> 1 then raise exception 'Cancellation credit not own/exactly once'; end if;
end;
$$;
reset role;
do $$
begin
  if (select count(*) from public.refund_credits where order_id = 'e6220000-0000-4000-8000-000000000002') <> 1 then raise exception 'Cancel credit duplicate'; end if;
  begin
    insert into public.refund_credits(order_id,customer_id,kind,amount_eur_cents) values('e6220000-0000-4000-8000-000000000002','f6220000-0000-4000-8000-000000000002','queued_refund',999);
    raise exception 'Duplicate refund key accepted';
  exception when unique_violation then null; end;
end;
$$;

-- Priority-gated order 6: explicit 100-second delay, no sleeps or invented time inputs.
update public.teammate_order_access set priority_base = 100 where user_id = 'f6220000-0000-4000-8000-000000000009';
set local role authenticated;
select pg_catalog.set_config('request.jwt.claims','{"sub":"f6220000-0000-4000-8000-000000000009","role":"authenticated"}',true);
select pg_catalog.set_config('request.jwt.claim.sub','f6220000-0000-4000-8000-000000000009',true);
do $$
declare v jsonb; item jsonb;
begin
  v := public.teammate_order_queue();
  if not exists (select 1 from pg_catalog.jsonb_array_elements(v -> 'orders') as q where q ->> 'id' = 'e6220000-0000-4000-8000-000000000001') then raise exception 'Eligible released fixture absent'; end if;
  if exists (select 1 from pg_catalog.jsonb_array_elements(v -> 'orders') as q where q ->> 'id' in ('e6220000-0000-4000-8000-000000000004','e6220000-0000-4000-8000-000000000005','e6220000-0000-4000-8000-000000000006','e6220000-0000-4000-8000-000000000009')) then raise exception 'GG/game/unreleased/own fixture leaked'; end if;
  for item in select value from pg_catalog.jsonb_array_elements(v -> 'orders') loop
    if item ?| array['customer_id','amount_eur_cents','booking_fx','queued_at','created_at','accepted_at','cancelled_at','completed_at','deadline','priority_base','priority_adjustment','rerolls','previous_assignments','previous_teammates','proof','payment'] then raise exception 'Private teammate projection'; end if;
  end loop;
  if v ?| array['priority','hidden_count','not_yet_visible','now','expired_count'] then raise exception 'Hidden queue aggregate leaked'; end if;
  if (public.accept_order('e6220000-0000-4000-8000-000000000006') #>> '{error,code}')::integer is distinct from 404 then raise exception 'Early accept allowed'; end if;
  if (public.accept_order('e6220000-0000-4000-8000-000000000004') #>> '{error,code}')::integer is distinct from 404 then raise exception 'Regular accepted GG'; end if;
  if (public.accept_order('e6220000-0000-4000-8000-000000000005') #>> '{error,code}')::integer is distinct from 404 then raise exception 'Unapproved game accepted'; end if;
  if (public.accept_order('e6220000-0000-4000-8000-000000000009') #>> '{error,code}')::integer is distinct from 404 then raise exception 'Own order accepted'; end if;
  v := public.accept_order('e6220000-0000-4000-8000-000000000001');
  if v #>> '{order,status}' is distinct from 'in_progress' then raise exception 'Eligible accept failed: %',v; end if;
  if v -> 'order' ?| array['customer_id','amount_eur_cents','queued_at','accepted_at','previous_assignments','rerolls'] then raise exception 'Accept projection leaked'; end if;
  if (public.accept_order('e6220000-0000-4000-8000-000000000007') #>> '{error,code}')::integer is distinct from 409 then raise exception 'Busy teammate acquired second order'; end if;
  if public.teammate_order_queue() -> 'orders' is distinct from '[]'::jsonb then raise exception 'Busy queue should be empty'; end if;
  if public.teammate_current_assignment() #>> '{order,id}' is distinct from 'e6220000-0000-4000-8000-000000000001' then raise exception 'Current assignment missing'; end if;
end;
$$;
reset role;
-- Active assignment visibility must follow fresh game/GG access revocation.
update public.teammate_order_access set approved_games = '{}' where user_id = 'f6220000-0000-4000-8000-000000000009';
set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub','f6220000-0000-4000-8000-000000000009',true);
do $$ begin
  if public.teammate_current_assignment() -> 'order' is distinct from 'null'::jsonb then raise exception 'Game approval revocation ignored'; end if;
end $$;
reset role;
update public.teammate_order_access set approved_games = array['lol'], gg_access = true where user_id = 'f6220000-0000-4000-8000-000000000009';
set local role authenticated;
do $$ begin
  if public.teammate_current_assignment() -> 'order' is distinct from 'null'::jsonb then raise exception 'GG-only revocation ignored'; end if;
end $$;
reset role;
update public.teammate_order_access set gg_access = false where user_id = 'f6220000-0000-4000-8000-000000000009';
-- Taken is 409, with no payload, for a different eligible teammate.
set local role authenticated;
select pg_catalog.set_config('request.jwt.claims','{"sub":"f6220000-0000-4000-8000-000000000010","role":"authenticated"}',true);
select pg_catalog.set_config('request.jwt.claim.sub','f6220000-0000-4000-8000-000000000010',true);
do $$
declare v jsonb;
begin
  v := public.accept_order('e6220000-0000-4000-8000-000000000001');
  if (v #>> '{error,code}')::integer is distinct from 409 or v ? 'order' or pg_catalog.jsonb_typeof(v #> '{error,code}') <> 'number' or v #>> '{error,message}' is null then raise exception 'Taken error envelope invalid: %',v; end if;
end;
$$;
reset role;
-- Positive adjustment subtracts delay, expires freshly, and NULL expiry is permanent.
update public.teammate_order_access set priority_base = 100, priority_adjustment = 35,
  priority_adjustment_expires_at = pg_catalog.clock_timestamp() + interval '1 day'
  where user_id = 'f6220000-0000-4000-8000-000000000010';
update public.orders set queued_at = pg_catalog.clock_timestamp() - interval '70 seconds'
  where id = 'e6220000-0000-4000-8000-000000000006';
set local role authenticated;
do $$
begin
  if not exists (select 1 from pg_catalog.jsonb_array_elements(public.teammate_order_queue() -> 'orders') as q where q ->> 'id' = 'e6220000-0000-4000-8000-000000000006') then raise exception 'Active priority buff not applied'; end if;
end;
$$;
reset role;
update public.teammate_order_access set priority_adjustment_expires_at = pg_catalog.clock_timestamp() - interval '1 second'
  where user_id = 'f6220000-0000-4000-8000-000000000010';
set local role authenticated;
do $$
begin
  if (public.accept_order('e6220000-0000-4000-8000-000000000006') #>> '{error,code}')::integer is distinct from 404 then raise exception 'Expired adjustment still active'; end if;
end;
$$;
reset role;
update public.teammate_order_access set priority_adjustment_expires_at = null
  where user_id = 'f6220000-0000-4000-8000-000000000010';
set local role authenticated;
do $$
begin
  if not exists (select 1 from pg_catalog.jsonb_array_elements(public.teammate_order_queue() -> 'orders') as q where q ->> 'id' = 'e6220000-0000-4000-8000-000000000006') then raise exception 'Permanent priority buff not applied'; end if;
end;
$$;
reset role;
update public.teammate_order_access set priority_base = 0, priority_adjustment = 0
  where user_id = 'f6220000-0000-4000-8000-000000000010';
-- Database constraint independent of RPC mutex.
do $$
declare a uuid; v_constraint text;
begin
  begin
    update public.order_assignments set end_reason = 'customer_reroll'
      where order_id = 'e6220000-0000-4000-8000-000000000001';
    raise exception 'NULL assignment end time bypassed constraint';
  exception when check_violation then null; end;
  begin
    insert into public.order_assignments(id,order_id,teammate_id,accepted_at) values('d6220000-0000-4000-8000-000000000001','e6220000-0000-4000-8000-000000000007','f6220000-0000-4000-8000-000000000009',pg_catalog.clock_timestamp());
    raise exception 'One current teammate assignment constraint missing';
  exception when unique_violation then null; end;
  begin
    -- Temporarily end the first history row to isolate the orders unique index.
    -- The expected unique violation rolls back this entire nested block.
    update public.order_assignments set ended_at = pg_catalog.clock_timestamp(), end_reason = 'customer_reroll'
      where order_id = 'e6220000-0000-4000-8000-000000000001';
    insert into public.order_assignments(id,order_id,teammate_id,accepted_at)
      values('d6220000-0000-4000-8000-000000000002','e6220000-0000-4000-8000-000000000007','f6220000-0000-4000-8000-000000000009',pg_catalog.clock_timestamp()) returning id into a;
    update public.orders set status = 'in_progress', assigned_teammate_id = 'f6220000-0000-4000-8000-000000000009', current_assignment_id = a, accepted_at = pg_catalog.clock_timestamp()
      where id = 'e6220000-0000-4000-8000-000000000007';
    raise exception 'One active orders teammate constraint missing';
  exception when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint <> 'orders_one_active_teammate' then raise exception 'Unexpected unique constraint: %',v_constraint; end if;
  end;
  begin
    update public.orders set assigned_teammate_id = 'f6220000-0000-4000-8000-000000000010' where id = 'e6220000-0000-4000-8000-000000000001';
    raise exception 'Mismatched assignment identity allowed';
  exception when foreign_key_violation then null; end;
end;
$$;
-- Own customer cannot cancel accepted order; reroll clears assignment and creates no credit.
set local role authenticated;
select pg_catalog.set_config('request.jwt.claims','{"sub":"f6220000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select pg_catalog.set_config('request.jwt.claim.sub','f6220000-0000-4000-8000-000000000001',true);
do $$
begin
  if (public.cancel_queued_order('e6220000-0000-4000-8000-000000000001') #>> '{error,code}')::integer is distinct from 409 then raise exception 'Accepted cancel allowed'; end if;
  if public.reroll_order('e6220000-0000-4000-8000-000000000001') #>> '{order,status}' is distinct from 'queued' then raise exception 'First reroll failed'; end if;
  if public.customer_refund_credits() -> 'credits' is distinct from '[]'::jsonb then raise exception 'Reroll created refund'; end if;
end;
$$;
reset role;
do $$
begin
  if not exists (select 1 from public.order_assignments where order_id = 'e6220000-0000-4000-8000-000000000001' and teammate_id = 'f6220000-0000-4000-8000-000000000009' and end_reason = 'customer_reroll' and ended_at is not null) then raise exception 'Old assignment lost'; end if;
  if not exists (select 1 from public.orders where id = 'e6220000-0000-4000-8000-000000000001' and current_assignment_id is null and assigned_teammate_id is null and accepted_at is null and rerolls = 1 and queued_at > created_at) then raise exception 'Reroll reset invalid'; end if;
end;
$$;
-- Old teammate cannot see or take the rerolled order, including current RPC.
set local role authenticated;
select pg_catalog.set_config('request.jwt.claims','{"sub":"f6220000-0000-4000-8000-000000000009","role":"authenticated"}',true);
select pg_catalog.set_config('request.jwt.claim.sub','f6220000-0000-4000-8000-000000000009',true);
do $$
begin
  if (public.accept_order('e6220000-0000-4000-8000-000000000001') #>> '{error,code}')::integer is distinct from 404 then raise exception 'Rerolled teammate reacquired order'; end if;
  if public.teammate_current_assignment() -> 'order' is distinct from 'null'::jsonb then raise exception 'Old assignment still visible'; end if;
  if exists (select 1 from pg_catalog.jsonb_array_elements(public.teammate_order_queue() -> 'orders') as q where q ->> 'id' = 'e6220000-0000-4000-8000-000000000001') then raise exception 'Rerolled queue exclusion failed'; end if;
end;
$$;
reset role;
set local role authenticated;
select pg_catalog.set_config('request.jwt.claims','{"sub":"f6220000-0000-4000-8000-000000000010","role":"authenticated"}',true);
select pg_catalog.set_config('request.jwt.claim.sub','f6220000-0000-4000-8000-000000000010',true);
do $$
declare v jsonb;
begin
  v := public.accept_order('e6220000-0000-4000-8000-000000000001');
  if v #>> '{order,status}' is distinct from 'in_progress' then raise exception 'Second assignment failed'; end if;
  if v -> 'order' ?| array['rerolls','previous_assignments','previous_teammates','accepted_at','queued_at'] then raise exception 'Reroll history/timing leaked'; end if;
end;
$$;
reset role;
set local role authenticated;
select pg_catalog.set_config('request.jwt.claims','{"sub":"f6220000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select pg_catalog.set_config('request.jwt.claim.sub','f6220000-0000-4000-8000-000000000001',true);
do $$
begin
  if (public.reroll_order('e6220000-0000-4000-8000-000000000001') #>> '{order,rerolls}')::integer is distinct from 2 then raise exception 'Second reroll failed'; end if;
end;
$$;
reset role;
set local role authenticated;
select pg_catalog.set_config('request.jwt.claims','{"sub":"f6220000-0000-4000-8000-000000000011","role":"authenticated"}',true);
select pg_catalog.set_config('request.jwt.claim.sub','f6220000-0000-4000-8000-000000000011',true);
do $$
begin
  if public.accept_order('e6220000-0000-4000-8000-000000000001') #>> '{order,status}' is distinct from 'in_progress' then raise exception 'Third assignment failed'; end if;
end;
$$;
reset role;
set local role authenticated;
select pg_catalog.set_config('request.jwt.claims','{"sub":"f6220000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select pg_catalog.set_config('request.jwt.claim.sub','f6220000-0000-4000-8000-000000000001',true);
do $$
begin
  if (public.reroll_order('e6220000-0000-4000-8000-000000000001') #>> '{error,code}')::integer is distinct from 409 then raise exception 'Third reroll allowed'; end if;
end;
$$;
reset role;
do $$
begin
  if (select count(distinct id) from public.order_assignments where order_id = 'e6220000-0000-4000-8000-000000000001') <> 3 then raise exception 'Assignment isolation identities not preserved'; end if;
end;
$$;
-- GG-only across games; roles, suspension and verified link must come from fresh rows.
set local role authenticated;
select pg_catalog.set_config('request.jwt.claims','{"sub":"f6220000-0000-4000-8000-000000000012","role":"authenticated"}',true);
select pg_catalog.set_config('request.jwt.claim.sub','f6220000-0000-4000-8000-000000000012',true);
do $$
begin
  if exists (select 1 from pg_catalog.jsonb_array_elements(public.teammate_order_queue() -> 'orders') as q where not (q ->> 'gg')::boolean) then raise exception 'GG teammate saw regular orders'; end if;
  if public.accept_order('e6220000-0000-4000-8000-000000000004') #>> '{order,status}' is distinct from 'in_progress' then raise exception 'GG accept failed'; end if;
end;
$$;
reset role;
update public.account_roles set role = 'customer' where user_id = 'f6220000-0000-4000-8000-000000000012';
set local role authenticated;
do $$
begin
  if (public.teammate_current_assignment() #>> '{error,code}')::integer is distinct from 403 then raise exception 'Stale role retained assignment access'; end if;
end;
$$;
reset role;
-- Admin has no special order access or playing privilege.
set local role authenticated;
select pg_catalog.set_config('request.jwt.claims','{"sub":"f6220000-0000-4000-8000-000000000013","role":"authenticated"}',true);
select pg_catalog.set_config('request.jwt.claim.sub','f6220000-0000-4000-8000-000000000013',true);
do $$
begin
  if (public.teammate_order_queue() #>> '{error,code}')::integer is distinct from 403 then raise exception 'Admin queue bypass'; end if;
  if (public.accept_order('e6220000-0000-4000-8000-000000000007') #>> '{error,code}')::integer is distinct from 403 then raise exception 'Admin played order'; end if;
  if (public.customer_order_history() #>> '{error,code}')::integer is distinct from 403 then raise exception 'Admin customer history bypass'; end if;
  begin perform count(*) from public.orders; raise exception 'Admin raw order access'; exception when insufficient_privilege then null; end;
end;
$$;
reset role;
set local role authenticated;
do $$
declare n integer;
begin
  for n in 14..16 loop
    perform pg_catalog.set_config('request.jwt.claim.sub','f6220000-0000-4000-8000-' || pg_catalog.lpad(n::text,12,'0'),true);
    perform pg_catalog.set_config('request.jwt.claims',pg_catalog.jsonb_build_object('sub','f6220000-0000-4000-8000-' || pg_catalog.lpad(n::text,12,'0'),'role','authenticated','user_metadata',pg_catalog.jsonb_build_object('discord_id','990622000000000999','suspended',false,'approved_games',array['lol']))::text,true);
    if (public.teammate_order_queue() #>> '{error,code}')::integer is distinct from 403 then raise exception 'Unlinked/suspended/default access bypass %',n; end if;
    if (public.accept_order('e6220000-0000-4000-8000-000000000007') #>> '{error,code}')::integer is distinct from 403 then raise exception 'Invalid access accepted %',n; end if;
  end loop;
end;
$$;
reset role;

-- Expired accept returns 410 while cancellation and credit survive the business error.
-- Reuse spare 7, deliberately age it AS OWNER, never via an actor-supplied time.
update public.orders set queued_at = pg_catalog.clock_timestamp() - interval '6 minutes' where id = 'e6220000-0000-4000-8000-000000000007';
set local role authenticated;
select pg_catalog.set_config('request.jwt.claims','{"sub":"f6220000-0000-4000-8000-000000000010","role":"authenticated"}',true);
select pg_catalog.set_config('request.jwt.claim.sub','f6220000-0000-4000-8000-000000000010',true);
do $$
declare v jsonb;
begin
  v := public.accept_order('e6220000-0000-4000-8000-000000000007');
  if (v #>> '{error,code}')::integer is distinct from 410 or v ? 'order' then raise exception 'Expired accept envelope wrong: %',v; end if;
  perform public.accept_order('e6220000-0000-4000-8000-000000000007');
end;
$$;
reset role;
do $$
begin
  if not exists (select 1 from public.orders where id = 'e6220000-0000-4000-8000-000000000007' and status = 'cancelled' and cancel_reason = 'queue_expired') then raise exception '410 rolled back expiry'; end if;
  if (select count(*) from public.refund_credits where order_id = 'e6220000-0000-4000-8000-000000000007' and amount_eur_cents = 999) <> 1 then raise exception '410 credit missing/duplicate'; end if;
end;
$$;
-- Five-minute reroll cutoff on separate fixture 8.
set local role authenticated;
do $$
begin
  if public.accept_order('e6220000-0000-4000-8000-000000000008') #>> '{order,status}' is distinct from 'in_progress' then raise exception 'Window fixture accept failed'; end if;
end;
$$;
reset role;
-- Queue must precede accept; set both with matching assignment timestamp.
update public.orders set queued_at = created_at, accepted_at = pg_catalog.clock_timestamp() - interval '6 minutes' where id = 'e6220000-0000-4000-8000-000000000008';
update public.order_assignments set accepted_at = pg_catalog.clock_timestamp() - interval '6 minutes' where order_id = 'e6220000-0000-4000-8000-000000000008';
set local role authenticated;
select pg_catalog.set_config('request.jwt.claims','{"sub":"f6220000-0000-4000-8000-000000000008","role":"authenticated"}',true);
select pg_catalog.set_config('request.jwt.claim.sub','f6220000-0000-4000-8000-000000000008',true);
do $$
begin
  if (public.reroll_order('e6220000-0000-4000-8000-000000000008') #>> '{error,code}')::integer is distinct from 409 then raise exception 'Late reroll allowed'; end if;
end;
$$;
reset role;

-- Bounded service-only scheduler and private trusted access writes.
-- No other expired rows remain in this isolated fixture at this point.
update public.orders set queued_at = pg_catalog.clock_timestamp() - interval '6 minutes' where id in ('e6220000-0000-4000-8000-000000000005','e6220000-0000-4000-8000-000000000006');
set local role service_role;
select pg_catalog.set_config('request.jwt.claims','{"role":"service_role"}',true);
select pg_catalog.set_config('request.jwt.claim.sub','',true);
do $$
begin
  if (public.sweep_expired_orders(0) #>> '{error,code}')::integer is distinct from 400 then raise exception 'Unbounded zero sweep'; end if;
  if (public.sweep_expired_orders(501) #>> '{error,code}')::integer is distinct from 400 then raise exception 'Unbounded large sweep'; end if;
  if (public.sweep_expired_orders(null) #>> '{error,code}')::integer is distinct from 400 then raise exception 'NULL sweep accepted'; end if;
  if (public.sweep_expired_orders(1) ->> 'expired_count')::integer is distinct from 1 then raise exception 'Bounded sweep failed'; end if;
  if (public.sweep_expired_orders(1) ->> 'expired_count')::integer is distinct from 1 then raise exception 'Second bounded sweep failed'; end if;
  if (public.sweep_expired_orders(1) ->> 'expired_count')::integer is distinct from 0 then raise exception 'Sweep not idempotent'; end if;
  update public.teammate_order_access set suspended = true where user_id = 'f6220000-0000-4000-8000-000000000009';
  begin update public.refund_credits set amount_eur_cents = 100; raise exception 'Service can rewrite permanent credits'; exception when insufficient_privilege then null; end;
  begin delete from public.refund_credits; raise exception 'Service can erase permanent credits'; exception when insufficient_privilege then null; end;
end;
$$;
reset role;
set local role authenticated;
select pg_catalog.set_config('request.jwt.claims','{"sub":"f6220000-0000-4000-8000-000000000009","role":"authenticated"}',true);
select pg_catalog.set_config('request.jwt.claim.sub','f6220000-0000-4000-8000-000000000009',true);
do $$
begin
  if (public.teammate_order_queue() #>> '{error,code}')::integer is distinct from 403 then raise exception 'Fresh suspension ignored'; end if;
end;
$$;
reset role;
-- Final invariant assertions before rollback. No client order creation/completion exists.
do $$
begin
  if (select count(*) from public.refund_credits where order_id::text like 'e6220000-0000-4000-8000-%') <> 5 then raise exception 'Unexpected refund posting count'; end if;
  if exists (select 1 from public.refund_credits as c join public.orders as o on o.id = c.order_id where o.id::text like 'e6220000-0000-4000-8000-%' and (o.customer_id <> c.customer_id or o.amount_eur_cents <> c.amount_eur_cents or o.status <> 'cancelled')) then raise exception 'Credit/order mismatch'; end if;
  if exists (select 1 from public.orders where id::text like 'e6220000-0000-4000-8000-%' and status = 'completed') then raise exception 'Unproven completion'; end if;
end;
$$;
rollback;
