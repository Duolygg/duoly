begin;
-- Defense in depth: runner must also allowlist a disposable loopback target.
do $guard$
declare v_production boolean := false;
begin
  if pg_catalog.to_regclass('vault.secrets') is not null then
    execute 'select exists (select 1 from vault.secrets where name = ''payments_tick_secret'')' into v_production;
  end if;
  if v_production or not exists (select 1 from pg_catalog.pg_namespace where nspname = 'duoly_test_marker') then
    raise exception 'refusing to run tests on production';
  end if;
end;
$guard$;

create function pg_temp.assert_true(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'gated_dispatch: %', label; end if;
end;
$$;
-- Everything is rolled back; pg_net cannot deliver these fixture requests before commit.
-- Start from idle even if the disposable stack has seed data.
truncate public.orders, public.checkout_intents, public.analytics_outbox, public.discord_accounts,
  public.discord_role_sync, public.duoly_dispatch_state cascade;
insert into public.duoly_dispatch_state(kind,last_called_at)
  select k, pg_catalog.clock_timestamp() from unnest(array['orders','payments','analytics','roles']) k;
delete from vault.secrets where name in ('payments_tick_secret','discord_roles_tick_secret','analytics_drain_secret');
select vault.create_secret(pg_catalog.repeat('test-only-',5), 'payments_tick_secret');
select vault.create_secret(pg_catalog.repeat('test-only-',5), 'discord_roles_tick_secret');
select vault.create_secret(pg_catalog.repeat('test-only-',5), 'analytics_drain_secret');

create function pg_temp.expect_dispatch(kinds text[], label text) returns void language plpgsql as $$
declare actual text[]; before_state jsonb;
begin
  -- Trigger-generated analytics must be asserted separately from each isolated kind.
  truncate public.analytics_outbox;
  truncate net.http_request_queue;
  select pg_catalog.jsonb_object_agg(kind,last_called_at) into before_state from public.duoly_dispatch_state;
  perform public.duoly_dispatch();
  select coalesce(pg_catalog.array_agg(case url
    when 'https://duoly.gg/api/discord/orders/tick' then 'orders'
    when 'https://duoly.gg/api/payments/tick' then 'payments'
    when 'https://duoly.gg/api/internal/analytics/drain' then 'analytics'
    when 'https://duoly.gg/api/discord/roles/tick' then 'roles'
    else url end order by url), '{}'::text[]) into actual from net.http_request_queue;
  perform pg_temp.assert_true(
    (select coalesce(pg_catalog.array_agg(x order by x), '{}'::text[]) from unnest(actual) x) =
    (select coalesce(pg_catalog.array_agg(x order by x), '{}'::text[]) from unnest(kinds) x),
    label || ': unexpected URLs ' || actual::text);
  perform pg_temp.assert_true(not exists (select 1 from public.duoly_dispatch_state s
    where not (s.kind = any(kinds)) and pg_catalog.to_jsonb(s.last_called_at) is distinct from before_state->s.kind),
    label || ': idle state was written');
  perform pg_temp.assert_true(not exists (select 1 from net.http_request_queue
    where body <> pg_catalog.convert_to('{}','UTF8') or headers->>'Content-Type' <> 'application/json'
      or headers->>'Authorization' <> 'Bearer ' || pg_catalog.repeat('test-only-',5)), label || ': payload/auth changed');
end;
$$;

select pg_temp.assert_true(not public.duoly_dispatch_has_work(k), 'idle predicate ' || k)
  from unnest(array['orders','payments','analytics','roles']) k;
select pg_temp.expect_dispatch('{}', 'idle');

-- Migration scheduling/pauses: the hand-made payments job may be absent locally.
select pg_temp.assert_true(not exists (select 1 from cron.job where jobname in (
  'duoly-discord-orders-tick','duoly-payments-tick','duoly-discord-roles-tick','duoly-analytics-drain',
  'duoly-discord-roles-log-prune','duoly-analytics-log-prune') and username = current_user and active), 'old jobs paused');
select pg_temp.assert_true(exists (select 1 from cron.job where jobname = 'duoly-dispatch'
  and active and schedule = '10 seconds' and command = 'select public.duoly_dispatch();'), 'dispatcher active');
select pg_temp.assert_true(exists (select 1 from cron.job where jobname = 'private-proof-cleanup'
  and schedule = '*/15 * * * *'), 'proof cleanup unchanged');
select pg_temp.assert_true(exists (select 1 from cron.job where jobname = 'private-proof-cleanup-log-prune'
  and command like '%order_proof_cleanup_runs%' and command not like '%job_run_details%'), 'proof outcomes retained');

-- Missing state and exactly ten-minute-old state both force all four calls.
savepoint idle;
truncate public.duoly_dispatch_state;
select pg_temp.expect_dispatch(array['orders','payments','analytics','roles'], 'first call');
select pg_temp.expect_dispatch('{}', 'fallback coalesces');
update public.duoly_dispatch_state set last_called_at = pg_catalog.clock_timestamp() - interval '10 minutes';
select pg_temp.expect_dispatch(array['orders','payments','analytics','roles'], 'ten-minute fallback');
rollback to idle;

savepoint payments_timeout;
select cron.schedule('duoly-payments-tick', '20 seconds',
  'select net.http_post(url := ''https://duoly.gg/api/payments/tick'', timeout_milliseconds := 18000);');
select cron.alter_job(job_id := jobid, active := false) from cron.job
  where jobname = 'duoly-payments-tick' and username = current_user;
update public.duoly_dispatch_state set last_called_at = pg_catalog.clock_timestamp() - interval '11 minutes' where kind = 'payments';
select pg_temp.expect_dispatch(array['payments'], 'retained payments timeout');
select pg_temp.assert_true((select timeout_milliseconds = 18000 from net.http_request_queue), 'payments timeout inherited');
rollback to payments_timeout;

insert into auth.users(id,aud,role,email,raw_user_meta_data,raw_app_meta_data)
select ('d5500000-0000-4000-8000-' || pg_catalog.lpad(n::text,12,'0'))::uuid,
  'authenticated','authenticated','gated-' || n || '@example.invalid','{}','{}'
from pg_catalog.generate_series(1,3) n;
insert into public.orders(id,customer_id,game,service,title,units,unit,region,ign,customer_name,
  amount_eur_cents,payout_usd_cents,booking_fx,created_at,queued_at)
values ('d5510000-0000-4000-8000-000000000001','d5500000-0000-4000-8000-000000000001',
  'lol','duo2','Dispatch fixture',1,'game','EUW','Fixture#EUW','Fixture',1000,600,1.1,
  pg_catalog.clock_timestamp()-interval '1 hour',pg_catalog.clock_timestamp());
truncate public.analytics_outbox;
savepoint fixture;

-- Due public post and stale claim (superset also covers any open post).
update public.orders set queued_at = pg_catalog.clock_timestamp() - interval '2 minutes';
select pg_temp.assert_true(public.duoly_dispatch_has_work('orders'), 'due post');
select pg_temp.expect_dispatch(array['orders'], 'due post');
insert into public.discord_order_posts(order_id,queue_key,channel_id,state,created_at)
select id,queued_at,'99550000000000001','posting',pg_catalog.clock_timestamp() from public.orders;
select pg_temp.expect_dispatch('{}', 'fresh posting claim');
update public.discord_order_posts set created_at = pg_catalog.clock_timestamp() - interval '2 minutes';
select pg_temp.expect_dispatch(array['orders'], 'stale posting claim');
update public.discord_order_posts set state = 'open',message_id = '99550000000000002';
select pg_temp.expect_dispatch(array['orders'], 'open post');
update public.orders set queued_at = pg_catalog.clock_timestamp();
select pg_temp.assert_true(public.discord_order_posts_to_close() <> '[]'::jsonb, 'reroll closable');
select pg_temp.expect_dispatch(array['orders'], 'closable rerolled post');
rollback to fixture;

update public.orders set queued_at = pg_catalog.clock_timestamp() - interval '6 minutes';
select pg_temp.assert_true(public.duoly_dispatch_has_work('payments'), 'expired queued order');
select pg_temp.expect_dispatch(array['payments'], 'expired queue');
rollback to fixture;

-- Priority pick deadlines can change without updating orders. Streamer bookings never post.
update public.orders set queued_at = pg_catalog.clock_timestamp() - interval '150 seconds';
insert into public.teammate_presence(user_id,online,online_since,last_seen_at,last_active_at)
values ('d5500000-0000-4000-8000-000000000002',true,pg_catalog.clock_timestamp(),pg_catalog.clock_timestamp(),pg_catalog.clock_timestamp());
insert into public.order_teammate_picks(order_id,customer_id,teammate_id,source_order_id,queue_key,window_ends_at,created_at)
select id,customer_id,'d5500000-0000-4000-8000-000000000002',id,queued_at,queued_at + interval '60 seconds',queued_at from public.orders;
select pg_temp.expect_dispatch('{}', 'priority pick delayed public deadline');
update public.order_teammate_picks set released_at = pg_catalog.clock_timestamp() - interval '120 seconds',release_reason = 'declined';
select pg_temp.expect_dispatch(array['orders'], 'priority pick release due');
rollback to fixture;
update public.orders set queued_at = pg_catalog.clock_timestamp() - interval '2 minutes';
insert into public.order_streamer_bookings(order_id,teammate_id,streamer_name,rate_eur_cents)
values ('d5510000-0000-4000-8000-000000000001','d5500000-0000-4000-8000-000000000002','Fixture streamer',1000);
select pg_temp.expect_dispatch('{}', 'streamer infinity does not post');
update public.orders set queued_at = pg_catalog.clock_timestamp() - interval '6 minutes';
select pg_temp.expect_dispatch(array['payments'], 'streamer still expires');
rollback to fixture;

-- Cancelled-team queued straggler is not expired and must still be swept.
insert into public.checkout_intents(id,customer_id,game,service,title,units,unit,region,ign,
  amount_eur_cents,payout_usd_cents,booking_fx,expires_at)
values ('d5520000-0000-4000-8000-000000000001','d5500000-0000-4000-8000-000000000001',
  'lol','duo2','Dispatch fixture',1,'game','EUW','Fixture#EUW',2000,1200,1.1,pg_catalog.clock_timestamp()+interval '1 hour');
insert into public.order_teams(id,customer_id,intent_id,seats,amount_eur_cents,status,ended_at)
values ('d5530000-0000-4000-8000-000000000001','d5500000-0000-4000-8000-000000000001',
  'd5520000-0000-4000-8000-000000000001',2,2000,'cancelled',pg_catalog.clock_timestamp());
update public.orders set team_id = 'd5530000-0000-4000-8000-000000000001',seat = 1;
select pg_temp.expect_dispatch(array['payments'], 'cancelled-team queued straggler');
savepoint team_posting;
update public.order_teams set status = 'waiting',ended_at = null;
update public.orders set queued_at = pg_catalog.clock_timestamp() - interval '2 minutes';
insert into public.orders(id,customer_id,game,service,title,units,unit,region,ign,customer_name,
  amount_eur_cents,payout_usd_cents,booking_fx,created_at,queued_at,team_id,seat)
select 'd5510000-0000-4000-8000-000000000002',customer_id,game,service,title,units,unit,region,ign,customer_name,
  amount_eur_cents,payout_usd_cents,booking_fx,created_at,queued_at,team_id,2 from public.orders;
select pg_temp.assert_true(pg_catalog.jsonb_array_length(public.discord_order_posts_due(100)) = 1, 'only lowest free team seat due');
select pg_temp.expect_dispatch(array['orders'], 'team first seat due');
insert into public.discord_order_posts(order_id,queue_key,channel_id,state)
select id,queued_at,'99550000000000001','posting' from public.orders where seat = 1;
select pg_temp.expect_dispatch('{}', 'team fresh claim blocks other seat');
update public.discord_order_posts set created_at = pg_catalog.clock_timestamp() - interval '2 minutes';
select pg_temp.expect_dispatch(array['orders'], 'team stale claim is a superset');
rollback to team_posting;
-- Reproduce a skipped in-progress seat by changing the team row only after accept.
update public.order_teams set status = 'waiting',ended_at = null;
insert into public.order_assignments(id,order_id,teammate_id,accepted_at)
values ('d5540000-0000-4000-8000-000000000001','d5510000-0000-4000-8000-000000000001',
  'd5500000-0000-4000-8000-000000000002',pg_catalog.clock_timestamp());
update public.orders set status = 'in_progress',assigned_teammate_id = 'd5500000-0000-4000-8000-000000000002',
  current_assignment_id = 'd5540000-0000-4000-8000-000000000001',accepted_at = pg_catalog.clock_timestamp();
update public.order_teams set status = 'cancelled',ended_at = pg_catalog.clock_timestamp();
select pg_temp.expect_dispatch(array['payments'], 'cancelled-team in-progress straggler');
rollback to fixture;

-- Settlement attempts at cap are not claimable. Test the real pending-action predicate.
insert into public.checkout_intents(id,customer_id,game,service,title,units,unit,region,ign,
  amount_eur_cents,payout_usd_cents,booking_fx,expires_at)
values ('d5520000-0000-4000-8000-000000000001','d5500000-0000-4000-8000-000000000001',
  'lol','duo2','Dispatch fixture',1,'game','EUW','Fixture#EUW',1000,600,1.1,pg_catalog.clock_timestamp()+interval '1 hour');
insert into public.order_payments(order_id,intent_id,stripe_payment_intent_id,amount_minor,currency,
  amount_eur_cents,state,settle,attempts)
values ('d5510000-0000-4000-8000-000000000001','d5520000-0000-4000-8000-000000000001',
  'pi_gatedfixture',1000,'eur',1000,'authorized','capture',19);
select pg_temp.expect_dispatch(array['payments'], 'pending settlement');
update public.order_payments set attempts = 20;
select pg_temp.expect_dispatch('{}', 'exhausted settlement');
rollback to fixture;

-- No-session stale wallet hold, ten-minute grace, and paid exclusion.
insert into public.checkout_intents(id,customer_id,game,service,title,units,unit,region,ign,
  amount_eur_cents,payout_usd_cents,booking_fx,expires_at)
values ('d5520000-0000-4000-8000-000000000001','d5500000-0000-4000-8000-000000000001',
  'lol','duo2','Dispatch fixture',1,'game','EUW','Fixture#EUW',1000,600,1.1,pg_catalog.clock_timestamp()-interval '11 minutes');
insert into public.wallet_entries(customer_id,amount_eur_cents,kind,cashable,created_by,reason)
values ('d5500000-0000-4000-8000-000000000001',1000,'admin_credit',false,
  'd5500000-0000-4000-8000-000000000003','Dispatch test credit');
insert into public.wallet_entries(customer_id,amount_eur_cents,kind,cashable,checkout_intent_id,reason)
values ('d5500000-0000-4000-8000-000000000001',-500,'checkout_hold',false,
  'd5520000-0000-4000-8000-000000000001','Dispatch test hold');
select pg_temp.expect_dispatch(array['payments'], 'stale no-session hold');
update public.checkout_intents set expires_at = pg_catalog.clock_timestamp() - interval '9 minutes';
select pg_temp.expect_dispatch('{}', 'hold grace period');
update public.checkout_intents set expires_at = pg_catalog.clock_timestamp() - interval '11 minutes',
  status = 'paid',order_id = 'd5510000-0000-4000-8000-000000000001';
select pg_temp.expect_dispatch('{}', 'paid hold excluded');
rollback to fixture;

-- Outbox leases, sent/parked exclusions and exhausted-lease parking work.
truncate public.analytics_outbox;
insert into public.analytics_outbox(event,dedup_key) values ('test','gated-test');
select pg_temp.assert_true(public.duoly_dispatch_has_work('analytics'), 'claimable outbox');
truncate net.http_request_queue;
select public.duoly_dispatch();
select pg_temp.assert_true((select count(*) = 1 and bool_and(url = 'https://duoly.gg/api/internal/analytics/drain')
  from net.http_request_queue), 'analytics exact queue');
update public.analytics_outbox set claimed_until = pg_catalog.now() + interval '1 minute';
select pg_temp.assert_true(not public.duoly_dispatch_has_work('analytics'), 'active outbox lease');
update public.analytics_outbox set claimed_until = pg_catalog.now() - interval '1 second',attempts = 10;
select pg_temp.assert_true(public.duoly_dispatch_has_work('analytics'), 'expired exhausted lease needs parking');
update public.analytics_outbox set failed_at = pg_catalog.now();
select pg_temp.assert_true(not public.duoly_dispatch_has_work('analytics'), 'parked outbox excluded');
update public.analytics_outbox set failed_at = null,sent_at = pg_catalog.now();
select pg_temp.assert_true(not public.duoly_dispatch_has_work('analytics'), 'sent outbox excluded');
rollback to fixture;

-- Fresh/stale teammate and admin presence, suspension, unlink and nonmember refresh.
update public.account_roles set role = 'teammate' where user_id = 'd5500000-0000-4000-8000-000000000002';
insert into public.discord_accounts(user_id,discord_id,username)
values ('d5500000-0000-4000-8000-000000000002','99550000000000002','gated-fixture');
insert into public.teammate_order_access(user_id,approved_games)
values ('d5500000-0000-4000-8000-000000000002',array['lol']);
insert into public.teammate_presence(user_id,online,online_since,last_seen_at,last_active_at)
values ('d5500000-0000-4000-8000-000000000002',true,pg_catalog.clock_timestamp(),pg_catalog.clock_timestamp(),pg_catalog.clock_timestamp());
select pg_temp.expect_dispatch(array['roles'], 'missing applied identity');
insert into public.discord_role_sync(discord_id,user_id,teammate,online,session,admin)
values ('99550000000000002','d5500000-0000-4000-8000-000000000002',true,true,false,false);
select pg_temp.expect_dispatch('{}', 'fresh applied presence');
update public.teammate_presence set last_seen_at = pg_catalog.clock_timestamp() - interval '21 seconds';
select pg_temp.expect_dispatch(array['roles'], 'presence gone stale');
update public.discord_role_sync set online = false;
select pg_temp.expect_dispatch('{}', 'stale presence already applied');
update public.teammate_order_access set suspended = true;
select pg_temp.expect_dispatch(array['roles'], 'suspension changed');
update public.account_roles set role = 'admin' where user_id = 'd5500000-0000-4000-8000-000000000002';
update public.discord_role_sync set admin = true,teammate = true,online = false;
select pg_temp.expect_dispatch('{}', 'admin teammate role unmanaged');
update public.teammate_presence set last_seen_at = pg_catalog.clock_timestamp();
select pg_temp.expect_dispatch(array['roles'], 'admin freshness');
update public.discord_role_sync set online = true,not_member = true,checked_at = pg_catalog.clock_timestamp() - interval '121 seconds';
select pg_temp.expect_dispatch(array['roles'], 'nonmember refresh');
delete from public.discord_accounts;
select pg_temp.expect_dispatch(array['roles'], 'unlinked identity cleanup');
rollback to fixture;

-- A predicate failure must enqueue its own kind and leave the other three running.
-- This transactional replacement is test-only and rolled back with the suite.
savepoint predicate_failure;
create or replace function public.duoly_dispatch_has_work(p_kind text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_kind = 'orders' then raise exception 'injected predicate failure'; end if;
  return p_kind = 'roles';
end;
$$;
select pg_temp.expect_dispatch(array['orders','roles'], 'fail-open isolation');
rollback to predicate_failure;

-- Missing secret: no enqueue or fallback advance; later kinds still run.
savepoint missing_secret;
delete from vault.secrets where name = 'payments_tick_secret';
update public.duoly_dispatch_state set last_called_at = pg_catalog.clock_timestamp() - interval '11 minutes';
select pg_temp.expect_dispatch(array['orders','analytics','roles'], 'missing secret isolation');
select pg_temp.assert_true((select last_called_at < pg_catalog.clock_timestamp() - interval '10 minutes'
  from public.duoly_dispatch_state where kind = 'payments'), 'missing secret did not advance');
rollback to missing_secret;

-- Run the exact scheduled bounded statement, not a copied implementation.
savepoint retention;
truncate cron.job_run_details;
insert into cron.job_run_details(jobid,runid,job_pid,database,username,command,status,start_time,end_time)
select 999999,900000+n,0,pg_catalog.current_database(),current_user,'test','succeeded',
  pg_catalog.clock_timestamp()-interval '3 days',pg_catalog.clock_timestamp()-interval '2 days'
from pg_catalog.generate_series(1,50001) n;
insert into cron.job_run_details(jobid,runid,job_pid,database,username,command,status,start_time,end_time)
values (999999,999999,0,pg_catalog.current_database(),current_user,'test','succeeded',
  pg_catalog.clock_timestamp()-interval '1 hour',pg_catalog.clock_timestamp()-interval '1 hour');
do $$
declare cmd text;
begin
  select command into strict cmd from cron.job where jobname = 'duoly-cron-log-prune' and username = current_user;
  execute cmd;
  perform pg_temp.assert_true((select count(*) = 2 from cron.job_run_details), 'prune bounded to 50000');
  perform pg_temp.assert_true(exists (select 1 from cron.job_run_details where runid = 999999), 'recent run retained');
  execute cmd;
  perform pg_temp.assert_true((select count(*) = 1 from cron.job_run_details), 'prune backlog clears');
end;
$$;
rollback to retention;

select pg_temp.assert_true(not pg_catalog.has_function_privilege(r,'public.duoly_dispatch()','EXECUTE'), 'execute denied ' || r)
  from unnest(array['anon','authenticated','service_role']) r;
select pg_temp.assert_true(not pg_catalog.has_table_privilege(r,'public.duoly_dispatch_state','SELECT'), 'state denied ' || r)
  from unnest(array['anon','authenticated','service_role']) r;
rollback;
