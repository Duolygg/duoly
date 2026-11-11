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

-- Rollback-only checks for 20261025100000_discord_role_sync.sql (ledger #40).
-- Run together with the migration body in one transaction that ends in rollback.
begin;
insert into auth.users (id,aud,role,email,raw_user_meta_data,raw_app_meta_data) values
 ('5d000000-0000-4000-8000-000000000001','authenticated','authenticated','roles-admin@example.invalid','{}','{}'),
 ('5d000000-0000-4000-8000-000000000002','authenticated','authenticated','roles-busy@example.invalid','{}','{}'),
 ('5d000000-0000-4000-8000-000000000003','authenticated','authenticated','roles-suspended@example.invalid','{}','{}'),
 ('5d000000-0000-4000-8000-000000000004','authenticated','authenticated','roles-stale@example.invalid','{}','{}'),
 ('5d000000-0000-4000-8000-000000000005','authenticated','authenticated','roles-unlinked@example.invalid','{}','{}'),
 ('5d000000-0000-4000-8000-000000000006','authenticated','authenticated','roles-customer@example.invalid','{}','{}'),
 ('5d000000-0000-4000-8000-000000000007','authenticated','authenticated','roles-rerolled@example.invalid','{}','{}');
update public.account_roles set role='admin' where user_id='5d000000-0000-4000-8000-000000000001';
update public.account_roles set role='teammate' where user_id in
 ('5d000000-0000-4000-8000-000000000002','5d000000-0000-4000-8000-000000000003','5d000000-0000-4000-8000-000000000004',
  '5d000000-0000-4000-8000-000000000005','5d000000-0000-4000-8000-000000000007');
insert into public.teammate_order_access(user_id,approved_games,suspended) values
 ('5d000000-0000-4000-8000-000000000002',array['lol'],false),
 ('5d000000-0000-4000-8000-000000000003',array['lol'],true),
 ('5d000000-0000-4000-8000-000000000004',array['lol'],false),
 ('5d000000-0000-4000-8000-000000000005',array['lol'],false),
 ('5d000000-0000-4000-8000-000000000007',array['lol'],false);
insert into public.discord_accounts(user_id,discord_id,username) values
 ('5d000000-0000-4000-8000-000000000001','50000000000000001','roles-admin'),
 ('5d000000-0000-4000-8000-000000000002','50000000000000002','roles-busy'),
 ('5d000000-0000-4000-8000-000000000003','50000000000000003','roles-suspended'),
 ('5d000000-0000-4000-8000-000000000004','50000000000000004','roles-stale'),
 ('5d000000-0000-4000-8000-000000000006','50000000000000006','roles-customer'),
 ('5d000000-0000-4000-8000-000000000007','50000000000000007','roles-rerolled');
insert into public.teammate_presence(user_id,online,online_since,last_seen_at,last_active_at) values
 ('5d000000-0000-4000-8000-000000000001',true,pg_catalog.clock_timestamp(),pg_catalog.clock_timestamp(),pg_catalog.clock_timestamp()),
 ('5d000000-0000-4000-8000-000000000003',true,pg_catalog.clock_timestamp(),pg_catalog.clock_timestamp(),pg_catalog.clock_timestamp()),
 ('5d000000-0000-4000-8000-000000000004',true,pg_catalog.clock_timestamp()-interval '5 minutes',pg_catalog.clock_timestamp()-interval '21 seconds',pg_catalog.clock_timestamp()-interval '21 seconds');

-- One order: re-rolled away from teammate 7, now played by teammate 2.
insert into public.orders(id,customer_id,game,service,title,units,unit,region,ign,customer_name,amount_eur_cents,booking_fx,payout_usd_cents,status)
 values ('5d200000-0000-4000-8000-000000000001','5d000000-0000-4000-8000-000000000006','lol','duo','Roles order',1,'game','EUW','Player#EUW','Roles Customer',1000,1.1,500,'queued');
insert into public.order_assignments(id,order_id,teammate_id,accepted_at,ended_at,end_reason) values
 ('5d100000-0000-4000-8000-000000000007','5d200000-0000-4000-8000-000000000001','5d000000-0000-4000-8000-000000000007',
  pg_catalog.clock_timestamp()-interval '10 minutes',pg_catalog.clock_timestamp()-interval '5 minutes','customer_reroll');
insert into public.order_assignments(id,order_id,teammate_id,accepted_at) values
 ('5d100000-0000-4000-8000-000000000002','5d200000-0000-4000-8000-000000000001','5d000000-0000-4000-8000-000000000002',pg_catalog.clock_timestamp());
update public.orders set status='in_progress',assigned_teammate_id='5d000000-0000-4000-8000-000000000002',
 current_assignment_id='5d100000-0000-4000-8000-000000000002',accepted_at=pg_catalog.clock_timestamp()
 where id='5d200000-0000-4000-8000-000000000001';

-- Signed-in users and guests can neither read the facts nor the applied state.
set local role authenticated;
select pg_catalog.set_config('request.jwt.claims','{"role":"authenticated","sub":"5d000000-0000-4000-8000-000000000001"}',true);
do $$ begin
 begin perform public.discord_role_facts(null,null); raise exception 'authenticated read role facts';
 exception when insufficient_privilege then null; end;
 begin perform 1 from public.discord_role_sync; raise exception 'authenticated read applied roles';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
do $$ begin
 begin perform public.discord_role_facts(null,null); raise exception 'anon read role facts';
 exception when insufficient_privilege then null; end;
end $$;
reset role;

set local role service_role;
do $$ declare r jsonb; ids text[]; p jsonb; begin
 r := public.discord_role_facts(null,null);
 if (r->>'now')::bigint < (extract(epoch from pg_catalog.clock_timestamp())*1000)::bigint - 5000 then raise exception 'now missing: %',r; end if;
 select pg_catalog.array_agg(x->>'user_id' order by x->>'user_id') into ids from pg_catalog.jsonb_array_elements(r->'people') x
  where x->>'user_id' like '5d000000-%';
 if ids <> array['5d000000-0000-4000-8000-000000000001','5d000000-0000-4000-8000-000000000002','5d000000-0000-4000-8000-000000000003',
   '5d000000-0000-4000-8000-000000000004','5d000000-0000-4000-8000-000000000007'] then
  raise exception 'wrong people (unlinked teammate or linked customer included?): %',ids; end if;

 select x into p from pg_catalog.jsonb_array_elements(r->'people') x where x->>'user_id'='5d000000-0000-4000-8000-000000000001';
 if p->>'role' <> 'admin' or p->>'discord_id' <> '50000000000000001' or (p->>'desk_online')::boolean is not true then raise exception 'admin facts wrong: %',p; end if;
 select x into p from pg_catalog.jsonb_array_elements(r->'people') x where x->>'user_id'='5d000000-0000-4000-8000-000000000002';
 if p->>'role' <> 'teammate' or (p->>'busy')::boolean is not true or (p->>'desk_online')::boolean or p->'last_seen' <> 'null'::jsonb then raise exception 'busy facts wrong: %',p; end if;
 select x into p from pg_catalog.jsonb_array_elements(r->'people') x where x->>'user_id'='5d000000-0000-4000-8000-000000000003';
 if (p->>'suspended')::boolean is not true or (p->>'busy')::boolean then raise exception 'suspended facts wrong: %',p; end if;
 select x into p from pg_catalog.jsonb_array_elements(r->'people') x where x->>'user_id'='5d000000-0000-4000-8000-000000000004';
 if (p->>'desk_online')::boolean is not true or (r->>'now')::bigint - (p->>'last_seen')::bigint < 20000 then raise exception 'stale facts wrong: %',p; end if;
 select x into p from pg_catalog.jsonb_array_elements(r->'people') x where x->>'user_id'='5d000000-0000-4000-8000-000000000007';
 if (p->>'busy')::boolean then raise exception 'rerolled teammate still busy: %',p; end if;

 r := public.discord_role_facts(array['5d000000-0000-4000-8000-000000000003','5d000000-0000-4000-8000-000000000005']::uuid[],null);
 if pg_catalog.jsonb_array_length(r->'people') <> 1 or r->'people'->0->>'user_id' <> '5d000000-0000-4000-8000-000000000003' then
  raise exception 'user scope wrong: %',r; end if;
 r := public.discord_role_facts(null,'5d200000-0000-4000-8000-000000000001');
 select pg_catalog.array_agg(x->>'user_id' order by x->>'user_id') into ids from pg_catalog.jsonb_array_elements(r->'people') x;
 if ids <> array['5d000000-0000-4000-8000-000000000002','5d000000-0000-4000-8000-000000000007'] then raise exception 'order scope wrong: %',ids; end if;
 r := public.discord_role_facts('{}'::uuid[],'5d200000-0000-4000-8000-000000000099');
 if pg_catalog.jsonb_array_length(r->'people') <> 0 then raise exception 'empty scope returned people: %',r; end if;

 insert into public.discord_role_sync(discord_id,user_id,teammate,online,session) values ('50000000000000002','5d000000-0000-4000-8000-000000000002',true,true,true);
 update public.discord_role_sync set online=false where discord_id='50000000000000002';
 delete from public.discord_role_sync where discord_id='50000000000000002';
 begin insert into public.discord_role_sync(discord_id) values ('not-a-discord-id'); raise exception 'bad discord id accepted';
 exception when check_violation then null; end;
end $$;
reset role;

-- The sweep is scheduled, active, and its command holds no secret, only the Vault lookup.
do $$ declare j record; begin
 select * into j from cron.job where jobname='duoly-discord-roles-tick';
 if j.jobid is null or not j.active or j.schedule <> '30 seconds' then raise exception 'sweep job missing: %',j; end if;
 if j.command not like '%https://duoly.gg/api/discord/roles/tick%' or j.command not like '%discord_roles_tick_secret%' or j.command ~ 'Bearer [A-Za-z0-9]' then
  raise exception 'sweep command wrong'; end if;
 if not exists (select 1 from cron.job where jobname='duoly-discord-roles-log-prune' and active) then raise exception 'log prune missing'; end if;
end $$;

-- Unlinking or deleting an account keeps the applied row so the sweep can take the roles away.
insert into public.discord_role_sync(discord_id,user_id,teammate) values ('50000000000000007','5d000000-0000-4000-8000-000000000007',true);
delete from public.discord_accounts where user_id='5d000000-0000-4000-8000-000000000007';
do $$ begin
 if not exists (select 1 from public.discord_role_sync where discord_id='50000000000000007' and teammate) then raise exception 'applied row lost on unlink'; end if;
 if exists (select 1 from pg_catalog.jsonb_array_elements(public.discord_role_facts(null,null)->'people') x where x->>'user_id'='5d000000-0000-4000-8000-000000000007') then
  raise exception 'unlinked teammate still wanted'; end if;
end $$;

select 'discord_role_sync: all checks passed' as result;
rollback;
