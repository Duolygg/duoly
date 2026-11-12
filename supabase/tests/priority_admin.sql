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

-- Rollback-only checks for 20261024230000_priority_admin.sql.
begin;
insert into auth.users (id,aud,role,email,raw_user_meta_data,raw_app_meta_data) values
 ('5c000000-0000-4000-8000-000000000001','authenticated','authenticated','prio-admin@example.invalid','{}','{}'),
 ('5c000000-0000-4000-8000-000000000002','authenticated','authenticated','prio-main@example.invalid','{}','{}'),
 ('5c000000-0000-4000-8000-000000000003','authenticated','authenticated','prio-miss@example.invalid','{}','{}'),
 ('5c000000-0000-4000-8000-000000000004','authenticated','authenticated','prio-offline@example.invalid','{}','{}'),
 ('5c000000-0000-4000-8000-000000000005','authenticated','authenticated','prio-reroll@example.invalid','{}','{}'),
 ('5c000000-0000-4000-8000-000000000006','authenticated','authenticated','prio-busy@example.invalid','{}','{}'),
 ('5c000000-0000-4000-8000-000000000007','authenticated','authenticated','prio-customer@example.invalid','{}','{}'),
 ('5c000000-0000-4000-8000-000000000008','authenticated','authenticated','prio-customer2@example.invalid','{}','{}'),
 ('5c000000-0000-4000-8000-000000000009','authenticated','authenticated','prio-customer3@example.invalid','{}','{}');
update public.profiles set name=case id
  when '5c000000-0000-4000-8000-000000000001' then 'Priority Admin'
  when '5c000000-0000-4000-8000-000000000002' then 'Main Mate'
  when '5c000000-0000-4000-8000-000000000003' then 'Miss Mate'
  else 'Priority Customer' end
 where id::text like '5c000000-0000-4000-8000-00000000000%';
update public.account_roles set role='admin' where user_id='5c000000-0000-4000-8000-000000000001';
update public.account_roles set role='teammate' where user_id in
 ('5c000000-0000-4000-8000-000000000002','5c000000-0000-4000-8000-000000000003',
  '5c000000-0000-4000-8000-000000000004','5c000000-0000-4000-8000-000000000005',
  '5c000000-0000-4000-8000-000000000006');
insert into public.teammate_order_access(user_id,approved_games,discord_id,discord_verified_at) values
 ('5c000000-0000-4000-8000-000000000001',array['lol'],'100000000000000001',now()),
 ('5c000000-0000-4000-8000-000000000002',array['lol'],'100000000000000002',now()),
 ('5c000000-0000-4000-8000-000000000003',array['lol'],'100000000000000003',now()),
 ('5c000000-0000-4000-8000-000000000004',array['lol'],'100000000000000004',now()),
 ('5c000000-0000-4000-8000-000000000005',array['lol'],'100000000000000005',now()),
 ('5c000000-0000-4000-8000-000000000006',array['lol'],'100000000000000006',now());
-- The admin is online in presence and even holds an access row: still never on the Priority screen.
insert into public.teammate_presence(user_id,online,online_since,last_seen_at,last_active_at) values
 ('5c000000-0000-4000-8000-000000000001',true,now()-interval '1 hour',now(),now());
-- Orders used by the miss fixtures.
insert into public.orders(id,customer_id,customer_name,game,service,title,units,unit,rank,region,ign,amount_eur_cents,payout_usd_cents,booking_fx,status,cancelled_at,cancel_reason,created_at,queued_at) values
 ('5c100000-0000-4000-8000-000000000001','5c000000-0000-4000-8000-000000000007','Prio Customer','lol','duo','Duo',1,'game','','EUW','PrioTester',1000,600,1.1,'cancelled',now()-interval '175 minutes','queue_expired',now()-interval '3 hours',now()-interval '3 hours'),
 ('5c100000-0000-4000-8000-000000000002','5c000000-0000-4000-8000-000000000007','Prio Customer','lol','duo','Duo',1,'game','','EUW','PrioTester',1000,600,1.1,'cancelled',now()-interval '115 minutes','queue_expired',now()-interval '2 hours',now()-interval '2 hours');

-- A customer gets 403 everywhere and cannot read the misses table.
set local role authenticated;
select pg_catalog.set_config('request.jwt.claims','{"role":"authenticated","sub":"5c000000-0000-4000-8000-000000000007"}',true);
select pg_catalog.set_config('request.jwt.claim.sub','5c000000-0000-4000-8000-000000000007',true);
do $$ begin
 if (public.admin_priority()->'error'->>'code')::int <> 403 then raise exception 'customer read priority'; end if;
 if (public.admin_set_priority('5c000000-0000-4000-8000-000000000002',30)->'error'->>'code')::int <> 403 then raise exception 'customer set priority'; end if;
end $$;
do $$ begin
  perform 1 from public.order_misses limit 1;
  raise exception 'customer read order_misses';
exception when insufficient_privilege then null;
end $$;

-- Baseline: default 50 for everyone, custom false, no adjustment, no penalty; the admin is not listed.
select pg_catalog.set_config('request.jwt.claims','{"role":"authenticated","sub":"5c000000-0000-4000-8000-000000000001"}',true);
select pg_catalog.set_config('request.jwt.claim.sub','5c000000-0000-4000-8000-000000000001',true);
do $$ declare r jsonb; a jsonb; begin
 r := public.admin_priority();
 if (r->>'default')::int <> 50 or (r->'rules'->>'perMiss')::int <> 10 or (r->'rules'->>'cap')::int <> 50 or (r->'rules'->>'days')::int <> 7 then
   raise exception 'rules wrong: %', r; end if;
 if pg_catalog.jsonb_path_exists(r,'$.accounts[*] ? (@.id == "5c000000-0000-4000-8000-000000000001")') then raise exception 'admin listed'; end if;
 if pg_catalog.jsonb_path_exists(r,'$.accounts[*] ? (@.id == "5c000000-0000-4000-8000-000000000007")') then raise exception 'customer listed'; end if;
 a := (select x from pg_catalog.jsonb_array_elements(r->'accounts') x where x->>'id' = '5c000000-0000-4000-8000-000000000002');
 if a is null or (a->>'prio')::int <> 50 or (a->>'custom')::boolean or a->>'adj' is not null
   or (a->>'penalty')::int <> 0 or (a->>'effective')::int <> 50 or (a->>'missed')::int <> 0
   or a->>'name' <> 'Main Mate' or a->>'email' <> 'prio-main@example.invalid' then
   raise exception 'baseline wrong: %', a; end if;
end $$;

-- Set, validation and reset of the base priority.
do $$ declare r jsonb; begin
 if (public.admin_set_priority('5c000000-0000-4000-8000-000000000002',101)->'error'->>'code')::int <> 400 then raise exception 'range not enforced'; end if;
 if (public.admin_set_priority('5c000000-0000-4000-8000-000000000007',30)->'error'->>'code')::int <> 404 then raise exception 'non-teammate not 404'; end if;
 r := public.admin_set_priority('5c000000-0000-4000-8000-000000000002',30);
 if (r->'account'->>'prio')::int <> 30 or not (r->'account'->>'custom')::boolean
   or r->'account'->>'changedBy' <> 'Priority Admin' or (r->'account'->>'effective')::int <> 30 then
   raise exception 'set wrong: %', r; end if;
 r := public.admin_reset_priority('5c000000-0000-4000-8000-000000000002');
 if (r->'account'->>'prio')::int <> 50 or (r->'account'->>'custom')::boolean then raise exception 'reset wrong: %', r; end if;
 r := public.admin_set_priority('5c000000-0000-4000-8000-000000000002',30);
end $$;

-- Buffs and nerfs: tier and duration enforced, expiry honoured, reason kept.
do $$ declare r jsonb; begin
 if (public.admin_adjust_priority('5c000000-0000-4000-8000-000000000002',15,'7d','')->'error'->>'code')::int <> 400 then raise exception 'bad tier accepted'; end if;
 if (public.admin_adjust_priority('5c000000-0000-4000-8000-000000000002',20,'x','')->'error'->>'code')::int <> 400 then raise exception 'bad duration accepted'; end if;
 r := public.admin_adjust_priority('5c000000-0000-4000-8000-000000000002',20,'7d','great week');
 if (r->'account'->'adj'->>'points')::int <> 20 or r->'account'->'adj'->>'reason' <> 'great week'
   or r->'account'->'adj'->>'by' <> 'Priority Admin' or r->'account'->'adj'->>'until' is null
   or (r->'account'->>'effective')::int <> 10 then raise exception 'buff wrong: %', r; end if;
 r := public.admin_adjust_priority('5c000000-0000-4000-8000-000000000002',-10,'perm','');
 if (r->'account'->'adj'->>'points')::int <> -10 or r->'account'->'adj'->>'until' is not null
   or (r->'account'->>'effective')::int <> 40 then raise exception 'perm nerf wrong: %', r; end if;
 r := public.admin_clear_adjustment('5c000000-0000-4000-8000-000000000002');
 if r->'account'->>'adj' is not null or (r->'account'->>'effective')::int <> 30 then raise exception 'clear wrong: %', r; end if;
end $$;
-- An expired adjustment does not count.
reset role;
update public.teammate_order_access set priority_adjustment=20, priority_adjustment_expires_at=now()-interval '1 second'
 where user_id='5c000000-0000-4000-8000-000000000002';
set local role authenticated;
select pg_catalog.set_config('request.jwt.claims','{"role":"authenticated","sub":"5c000000-0000-4000-8000-000000000001"}',true);
select pg_catalog.set_config('request.jwt.claim.sub','5c000000-0000-4000-8000-000000000001',true);
do $$ declare r jsonb; begin
 r := public.admin_priority();
 if (select (x->>'effective')::int from pg_catalog.jsonb_array_elements(r->'accounts') x where x->>'id' = '5c000000-0000-4000-8000-000000000002') <> 30 then
   raise exception 'expired adjustment counted: %', r; end if;
end $$;
reset role;
update public.teammate_order_access set priority_adjustment=0, priority_adjustment_expires_at=null
 where user_id='5c000000-0000-4000-8000-000000000002';

-- Missed orders: penalty 10 each, capped at 50, gone after forgiveness.
insert into public.order_misses(order_id,teammate_id,seen_sec,missed_at) values
 ('5c100000-0000-4000-8000-000000000001','5c000000-0000-4000-8000-000000000003',120,now()-interval '1 hour'),
 ('5c100000-0000-4000-8000-000000000002','5c000000-0000-4000-8000-000000000003',240,now());
set local role authenticated;
select pg_catalog.set_config('request.jwt.claims','{"role":"authenticated","sub":"5c000000-0000-4000-8000-000000000001"}',true);
select pg_catalog.set_config('request.jwt.claim.sub','5c000000-0000-4000-8000-000000000001',true);
do $$ declare r jsonb; a jsonb; begin
 r := public.admin_priority();
 a := (select x from pg_catalog.jsonb_array_elements(r->'accounts') x where x->>'id' = '5c000000-0000-4000-8000-000000000003');
 if (a->>'penalty')::int <> 20 or (a->>'missed')::int <> 2 or (a->>'effective')::int <> 70
   or pg_catalog.jsonb_array_length(a->'misses') <> 2 or a->'misses'->0->>'id' not like 'DL-%' then
   raise exception 'misses wrong: %', a; end if;
 r := public.admin_forgive_misses('5c000000-0000-4000-8000-000000000003');
 if (r->'account'->>'penalty')::int <> 0 or (r->'account'->>'missed')::int <> 0 or (r->'account'->>'effective')::int <> 50 then
   raise exception 'forgive wrong: %', r; end if;
end $$;
reset role;
do $$ begin
 if not exists (select 1 from public.admin_audit_log where action='Forgave missed orders' and detail='2 missed · 20 s') then
   raise exception 'forgive audit missing'; end if;
 if not exists (select 1 from public.admin_audit_log where action='Changed base priority' and detail='50 s → 30 s') then
   raise exception 'set audit missing'; end if;
 if not exists (select 1 from public.admin_audit_log where action='Buffed priority' and detail='+20 Buff · 7 days · great week') then
   raise exception 'buff audit missing'; end if;
 if not exists (select 1 from public.admin_audit_log where action='Removed buff/nerf' and detail='−10 Prio nerf') then
   raise exception 'clear audit missing'; end if;
end $$;

-- order_eligible honours base priority and the missed-order penalty.
-- Main Mate has base 30 (set above), so a 40 second old order is theirs until misses push them past 40.
reset role;
insert into public.orders(id,customer_id,customer_name,game,service,title,units,unit,rank,region,ign,amount_eur_cents,payout_usd_cents,booking_fx,created_at,queued_at)
 values('5c100000-0000-4000-8000-000000000003','5c000000-0000-4000-8000-000000000007','Prio Customer','lol','duo','Duo',1,'game','','EUW','PrioTester',1000,600,1.1,now()-interval '40 seconds',now()-interval '40 seconds');
do $$ declare o public.orders; begin
 select * into o from public.orders where id='5c100000-0000-4000-8000-000000000003';
 if not public.order_eligible(o,'5c000000-0000-4000-8000-000000000002') then raise exception 'base 30 cannot see a 40 s old order'; end if;
end $$;
insert into public.order_misses(order_id,teammate_id,seen_sec,missed_at) values
 ('5c100000-0000-4000-8000-000000000001','5c000000-0000-4000-8000-000000000002',120,now()),
 ('5c100000-0000-4000-8000-000000000002','5c000000-0000-4000-8000-000000000002',120,now());
do $$ declare o public.orders; begin
 select * into o from public.orders where id='5c100000-0000-4000-8000-000000000003';
 if public.order_eligible(o,'5c000000-0000-4000-8000-000000000002') then raise exception 'penalty not delaying (effective 50 > 40)'; end if;
end $$;
set local role authenticated;
select pg_catalog.set_config('request.jwt.claims','{"role":"authenticated","sub":"5c000000-0000-4000-8000-000000000001"}',true);
select pg_catalog.set_config('request.jwt.claim.sub','5c000000-0000-4000-8000-000000000001',true);
do $$ begin
 perform public.admin_forgive_misses('5c000000-0000-4000-8000-000000000002');
end $$;
reset role;
do $$ declare o public.orders; begin
 select * into o from public.orders where id='5c100000-0000-4000-8000-000000000003';
 if not public.order_eligible(o,'5c000000-0000-4000-8000-000000000002') then raise exception 'forgiven penalty still delaying'; end if;
end $$;

-- A timed out order notes exactly the teammates who were online and could take it.
insert into public.orders(id,customer_id,customer_name,game,service,title,units,unit,rank,region,ign,amount_eur_cents,payout_usd_cents,booking_fx,created_at,queued_at) values
 ('5c100000-0000-4000-8000-000000000004','5c000000-0000-4000-8000-000000000008','Prio Customer','lol','duo','Duo',1,'game','','EUW','PrioTester',1000,600,1.1,now()-interval '10 minutes',now()-interval '10 minutes'),
 ('5c100000-0000-4000-8000-000000000005','5c000000-0000-4000-8000-000000000009','Prio Customer','lol','duo','Duo',1,'game','','EUW','PrioTester',1000,600,1.1,now()-interval '1 hour',now()-interval '1 hour');
insert into public.order_assignments(id,order_id,teammate_id,accepted_at) values
 ('5c200000-0000-4000-8000-000000000002','5c100000-0000-4000-8000-000000000005','5c000000-0000-4000-8000-000000000006',now()-interval '30 minutes');
update public.orders set status='in_progress',assigned_teammate_id='5c000000-0000-4000-8000-000000000006',
 current_assignment_id='5c200000-0000-4000-8000-000000000002',accepted_at=now()-interval '30 minutes'
 where id='5c100000-0000-4000-8000-000000000005';
insert into public.teammate_presence(user_id,online,online_since,last_seen_at,last_active_at) values
 ('5c000000-0000-4000-8000-000000000002',true,now()-interval '15 minutes',now(),now()),
 ('5c000000-0000-4000-8000-000000000005',true,now()-interval '15 minutes',now(),now()),
 ('5c000000-0000-4000-8000-000000000006',true,now()-interval '15 minutes',now(),now());
insert into public.order_assignments(id,order_id,teammate_id,accepted_at,ended_at,end_reason) values
 ('5c200000-0000-4000-8000-000000000001','5c100000-0000-4000-8000-000000000004','5c000000-0000-4000-8000-000000000005',now()-interval '9 minutes',now()-interval '8 minutes','customer_reroll');
do $$ begin
 if not public.order_expire_locked('5c100000-0000-4000-8000-000000000004') then raise exception 'order not expired'; end if;
 if not exists (select 1 from public.orders where id='5c100000-0000-4000-8000-000000000004' and status='cancelled' and cancel_reason='queue_expired') then
   raise exception 'expiry state wrong'; end if;
 if (select count(*) from public.order_misses where order_id='5c100000-0000-4000-8000-000000000004') <> 1 then
   raise exception 'expected exactly one miss, got %', (select count(*) from public.order_misses where order_id='5c100000-0000-4000-8000-000000000004'); end if;
 if not exists (select 1 from public.order_misses where order_id='5c100000-0000-4000-8000-000000000004'
   and teammate_id='5c000000-0000-4000-8000-000000000002' and seen_sec between 60 and 700) then
   raise exception 'online teammate miss missing or seen_sec off'; end if;
 if exists (select 1 from public.order_misses where order_id='5c100000-0000-4000-8000-000000000004'
   and teammate_id in ('5c000000-0000-4000-8000-000000000004','5c000000-0000-4000-8000-000000000005','5c000000-0000-4000-8000-000000000006','5c000000-0000-4000-8000-000000000001')) then
   raise exception 'offline, rerolled, busy or admin teammate got a miss'; end if;
end $$;

select 'ALL CHECKS PASSED' as result;
rollback;
