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


do $test$ declare definition text; begin
 select pg_get_functiondef('public.order_sweep(integer)'::regprocedure) into definition;
 if position(E'begin
  for v_id' in definition)=0 then raise exception 'Cannot install test-only sweep delay'; end if;
 execute replace(definition,E'begin
  for v_id',E'begin
  perform pg_catalog.pg_sleep(1.2);
  for v_id');
end $test$;
update public.orders set queued_at=clock_timestamp()-interval '299 seconds' where id='e6220000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','f6220000-0000-4000-8000-000000000001',true);
do $test$ begin
 if public.customer_active_order()->'order' is distinct from 'null'::jsonb then raise exception 'Active read returned stale expired order'; end if;
end $test$;
reset role;
do $test$ begin
 if (select status from public.orders where id='e6220000-0000-4000-8000-000000000001') <> 'cancelled' then raise exception 'Target was not expired'; end if;
 if (select count(*) from public.refund_credits where order_id='e6220000-0000-4000-8000-000000000001') <> 1 then raise exception 'Expiry refund not atomic'; end if;
end $test$;
rollback;
