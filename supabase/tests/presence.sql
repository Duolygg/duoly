-- Rollback-only checks for 20261024142000_presence.sql.
begin;
insert into auth.users (id,aud,role,email,raw_user_meta_data,raw_app_meta_data) values
 ('5b000000-0000-4000-8000-000000000001','authenticated','authenticated','presence-admin@example.invalid','{}','{}'),
 ('5b000000-0000-4000-8000-000000000002','authenticated','authenticated','presence-teammate@example.invalid','{}','{}'),
 ('5b000000-0000-4000-8000-000000000003','authenticated','authenticated','presence-customer@example.invalid','{}','{}'),
 ('5b000000-0000-4000-8000-000000000004','authenticated','authenticated','presence-other@example.invalid','{}','{}');
update public.profiles set name=case id
  when '5b000000-0000-4000-8000-000000000001' then 'Presence Admin'
  when '5b000000-0000-4000-8000-000000000002' then 'Presence Teammate'
  else 'Presence Customer' end
 where id::text like '5b000000-0000-4000-8000-00000000000%';
update public.account_roles set role='admin' where user_id='5b000000-0000-4000-8000-000000000001';
update public.account_roles set role='teammate' where user_id='5b000000-0000-4000-8000-000000000002';
insert into public.teammate_order_access(user_id,approved_games) values
 ('5b000000-0000-4000-8000-000000000002',array['lol']);

set local role authenticated;
select pg_catalog.set_config('request.jwt.claims','{"role":"authenticated","sub":"5b000000-0000-4000-8000-000000000003"}',true);
select pg_catalog.set_config('request.jwt.claim.sub','5b000000-0000-4000-8000-000000000003',true);
do $$ begin
 if (public.desk_set_online(true)->'error'->>'code')::int <> 403 then raise exception 'customer went online'; end if;
 if (public.admin_presence()->'error'->>'code')::int <> 403 then raise exception 'customer read admin presence'; end if;
end $$;

select pg_catalog.set_config('request.jwt.claims','{"role":"authenticated","sub":"5b000000-0000-4000-8000-000000000002"}',true);
select pg_catalog.set_config('request.jwt.claim.sub','5b000000-0000-4000-8000-000000000002',true);
do $$ declare r jsonb; begin
 r := public.desk_set_online(true);
 if (r->'error'->>'code')::int <> 409 or r->'error'->>'message' not like 'Connect Discord%' then raise exception 'Discord gate missing: %',r; end if;
end $$;
reset role;
insert into public.discord_accounts(user_id,discord_id,username) values ('5b000000-0000-4000-8000-000000000002','12345678901234567','presence-test');
set local role authenticated;
select pg_catalog.set_config('request.jwt.claims','{"role":"authenticated","sub":"5b000000-0000-4000-8000-000000000002"}',true);
select pg_catalog.set_config('request.jwt.claim.sub','5b000000-0000-4000-8000-000000000002',true);
do $$ declare r jsonb; begin
 r := public.desk_set_online(true);
 if r->>'online' <> 'true' or r->>'online_since' is null then raise exception 'online failed: %',r; end if;
 r := public.desk_check_in(pg_catalog.clock_timestamp() - interval '1 minute');
 if r->>'online' <> 'true' then raise exception 'check-in failed: %',r; end if;
end $$;
reset role;
do $$ begin
 if not exists (select 1 from public.teammate_presence where user_id='5b000000-0000-4000-8000-000000000002' and online and last_active_at <= last_seen_at) then raise exception 'presence row missing'; end if;
end $$;

-- A stale toggle is offline for display, but an in-progress order still displays as Playing.
update public.teammate_presence set last_seen_at=pg_catalog.clock_timestamp()-interval '21 seconds' where user_id='5b000000-0000-4000-8000-000000000002';
set local role authenticated;
select pg_catalog.set_config('request.jwt.claims','{"role":"authenticated","sub":"5b000000-0000-4000-8000-000000000001"}',true);
select pg_catalog.set_config('request.jwt.claim.sub','5b000000-0000-4000-8000-000000000001',true);
do $$ declare r jsonb; begin
 r := public.admin_presence_check_in(true);
 if r->>'online' <> 'true' then raise exception 'admin check-in failed: %',r; end if;
 r := public.admin_presence();
 if pg_catalog.jsonb_path_exists(r,'$.online[*] ? (@.id == "5b000000-0000-4000-8000-000000000002")') then raise exception 'stale teammate shown online: %',r; end if;
 if not pg_catalog.jsonb_path_exists(r,'$.online[*] ? (@.id == "5b000000-0000-4000-8000-000000000001")') then raise exception 'fresh admin missing: %',r; end if;
end $$;
reset role;

insert into public.orders(id,customer_id,game,service,title,units,unit,region,ign,customer_name,amount_eur_cents,booking_fx,payout_usd_cents,status)
 values ('5b200000-0000-4000-8000-000000000001','5b000000-0000-4000-8000-000000000003','lol','duo','Presence order',1,'game','EUW','Player#EUW','Presence Customer',1000,1.1,500,'queued');
insert into public.order_assignments(id,order_id,teammate_id,accepted_at) values
 ('5b100000-0000-4000-8000-000000000001','5b200000-0000-4000-8000-000000000001','5b000000-0000-4000-8000-000000000002',pg_catalog.clock_timestamp());
update public.orders set status='in_progress',assigned_teammate_id='5b000000-0000-4000-8000-000000000002',
 current_assignment_id='5b100000-0000-4000-8000-000000000001',accepted_at=pg_catalog.clock_timestamp()
 where id='5b200000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_catalog.set_config('request.jwt.claims','{"role":"authenticated","sub":"5b000000-0000-4000-8000-000000000001"}',true);
select pg_catalog.set_config('request.jwt.claim.sub','5b000000-0000-4000-8000-000000000001',true);
do $$ declare r jsonb; begin
 r := public.admin_presence();
 if not pg_catalog.jsonb_path_exists(r,'$.online[*] ? (@.id == "5b000000-0000-4000-8000-000000000002" && @.playing == true)') then raise exception 'playing teammate missing: %',r; end if;
 if public.presence_public_count() <> 1 then raise exception 'public count excludes playing'; end if;
 r := public.admin_set_teammate_offline('5b000000-0000-4000-8000-000000000002','AFK / dashboard left open');
 if (r->'error'->>'code')::int <> 409 then raise exception 'playing teammate forced offline: %',r; end if;
 if (public.admin_set_teammate_offline('5b000000-0000-4000-8000-000000000002','free text')->'error'->>'code')::int <> 400 then raise exception 'free-text reason accepted'; end if;
end $$;
reset role;
update public.orders set status='completed',completed_at=pg_catalog.clock_timestamp() where id='5b200000-0000-4000-8000-000000000001';

-- A preset admin action is immediate, audited and reported to the teammate.
set local role authenticated;
select pg_catalog.set_config('request.jwt.claims','{"role":"authenticated","sub":"5b000000-0000-4000-8000-000000000002"}',true);
select pg_catalog.set_config('request.jwt.claim.sub','5b000000-0000-4000-8000-000000000002',true);
select public.desk_set_online(true);
select pg_catalog.set_config('request.jwt.claims','{"role":"authenticated","sub":"5b000000-0000-4000-8000-000000000001"}',true);
select pg_catalog.set_config('request.jwt.claim.sub','5b000000-0000-4000-8000-000000000001',true);
do $$ declare r jsonb; begin
 r := public.admin_set_teammate_offline('5b000000-0000-4000-8000-000000000002','AFK / dashboard left open');
 if r->>'ok' <> 'true' then raise exception 'admin offline failed: %',r; end if;
 if (public.admin_audit(1)->'audit'->0->>'action') <> 'Set teammate offline' then raise exception 'offline action not audited'; end if;
end $$;
select pg_catalog.set_config('request.jwt.claims','{"role":"authenticated","sub":"5b000000-0000-4000-8000-000000000002"}',true);
select pg_catalog.set_config('request.jwt.claim.sub','5b000000-0000-4000-8000-000000000002',true);
do $$ declare r jsonb; begin
 r := public.desk_check_in(null);
 if r->>'online' <> 'false' or r->'forced_offline'->>'reason' <> 'AFK / dashboard left open' then raise exception 'forced notice missing: %',r; end if;
end $$;
reset role;

-- Suspension and role changes force offline in their existing RPC transactions.
set local role authenticated;
select pg_catalog.set_config('request.jwt.claims','{"role":"authenticated","sub":"5b000000-0000-4000-8000-000000000002"}',true);
select pg_catalog.set_config('request.jwt.claim.sub','5b000000-0000-4000-8000-000000000002',true);
select public.desk_set_online(true);
select pg_catalog.set_config('request.jwt.claims','{"role":"authenticated","sub":"5b000000-0000-4000-8000-000000000001"}',true);
select pg_catalog.set_config('request.jwt.claim.sub','5b000000-0000-4000-8000-000000000001',true);
do $$ begin
 if public.admin_set_suspended('5b000000-0000-4000-8000-000000000002',true,'Presence test')->>'ok' <> 'true' then raise exception 'suspend failed'; end if;
end $$;
reset role;
do $$ begin if exists(select 1 from public.teammate_presence where user_id='5b000000-0000-4000-8000-000000000002' and online) then raise exception 'suspend kept online'; end if; end $$;
set local role authenticated;
select pg_catalog.set_config('request.jwt.claims','{"role":"authenticated","sub":"5b000000-0000-4000-8000-000000000001"}',true);
select pg_catalog.set_config('request.jwt.claim.sub','5b000000-0000-4000-8000-000000000001',true);
select public.admin_set_suspended('5b000000-0000-4000-8000-000000000002',false,'');
select pg_catalog.set_config('request.jwt.claims','{"role":"authenticated","sub":"5b000000-0000-4000-8000-000000000002"}',true);
select pg_catalog.set_config('request.jwt.claim.sub','5b000000-0000-4000-8000-000000000002',true);
select public.desk_set_online(true);
select pg_catalog.set_config('request.jwt.claims','{"role":"authenticated","sub":"5b000000-0000-4000-8000-000000000001"}',true);
select pg_catalog.set_config('request.jwt.claim.sub','5b000000-0000-4000-8000-000000000001',true);
select public.admin_set_role('5b000000-0000-4000-8000-000000000002','customer');
reset role;
do $$ begin if exists(select 1 from public.teammate_presence where user_id='5b000000-0000-4000-8000-000000000002' and online) then raise exception 'role change kept online'; end if; end $$;

-- The presence table itself has no authenticated client access.
set local role authenticated;
do $$ begin
 begin perform 1 from public.teammate_presence; raise exception 'authenticated selected presence table';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'presence: all checks passed' as result;
rollback;
