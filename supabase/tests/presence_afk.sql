-- Rollback-only checks for 20261105160000_presence_afk_offline.sql. Run after the migration body in one
-- transaction (begin; <migration without begin/commit>; <this file>; rollback;).
-- Fixtures: T teammate, C customer.
create function pg_temp.afk_assert(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'presence afk assertion: %',label; end if; end $$;
create function pg_temp.afk_login(actor uuid) returns void language plpgsql as $$
begin
  perform pg_catalog.set_config('request.jwt.claim.sub',actor::text,true);
  perform pg_catalog.set_config('request.jwt.claims',pg_catalog.jsonb_build_object('role','authenticated','sub',actor)::text,true);
end $$;

insert into auth.users(id,aud,role,email,raw_user_meta_data,raw_app_meta_data) values
 ('5c000000-0000-4000-8000-000000000002','authenticated','authenticated','afk-t@example.invalid','{}','{}'),
 ('5c000000-0000-4000-8000-000000000003','authenticated','authenticated','afk-c@example.invalid','{}','{}');
update public.account_roles set role='teammate' where user_id='5c000000-0000-4000-8000-000000000002';
insert into public.teammate_order_access(user_id,approved_games,discord_id,discord_verified_at)
  values ('5c000000-0000-4000-8000-000000000002',array['lol'],'700000000000000502',pg_catalog.now());
insert into public.discord_accounts(user_id,discord_id,username)
  values ('5c000000-0000-4000-8000-000000000002','700000000000000502','afk-test');

-- online: about 4 hours left
select pg_temp.afk_login('5c000000-0000-4000-8000-000000000002');
select pg_temp.afk_assert((public.desk_set_online(true)->>'afk_in')::int between 4*3600-5 and 4*3600,'4 hours left after going online');

-- activity moves the clock; a check-in without lastActive doesn't
update public.teammate_presence set last_active_at=pg_catalog.clock_timestamp()-interval '3 hours'
 where user_id='5c000000-0000-4000-8000-000000000002';
select pg_temp.afk_assert((public.desk_check_in(null)->>'afk_in')::int between 3600-5 and 3600,'no lastActive is not activity');
select pg_temp.afk_assert((public.desk_check_in(pg_catalog.clock_timestamp())->>'afk_in')::int > 4*3600-5,'activity resets the clock');

-- 3 h 56 min idle: still online, inside the 5-minute warning
update public.teammate_presence set last_active_at=pg_catalog.clock_timestamp()-interval '3 hours 56 minutes'
 where user_id='5c000000-0000-4000-8000-000000000002';
select pg_temp.afk_assert((public.desk_check_in(null)->>'afk_in')::int between 1 and 300,'warning window');

-- busy: playing an order keeps them online and the clock at zero
insert into public.orders(id,customer_id,game,service,title,units,unit,region,ign,customer_name,amount_eur_cents,booking_fx,payout_usd_cents,status)
 values ('5c200000-0000-4000-8000-000000000001','5c000000-0000-4000-8000-000000000003','lol','duo','AFK order',1,'game','EUW','Player#EUW','Customer',1000,1.1,500,'queued');
insert into public.order_assignments(id,order_id,teammate_id,accepted_at) values
 ('5c100000-0000-4000-8000-000000000001','5c200000-0000-4000-8000-000000000001','5c000000-0000-4000-8000-000000000002',pg_catalog.clock_timestamp());
update public.orders set status='in_progress',assigned_teammate_id='5c000000-0000-4000-8000-000000000002',
 current_assignment_id='5c100000-0000-4000-8000-000000000001',accepted_at=pg_catalog.clock_timestamp()
 where id='5c200000-0000-4000-8000-000000000001';
update public.teammate_presence set last_active_at=pg_catalog.clock_timestamp()-interval '5 hours'
 where user_id='5c000000-0000-4000-8000-000000000002';
select pg_temp.afk_assert((public.desk_check_in(null)->>'online')::boolean,'playing: stays online');
select pg_temp.afk_assert(public.desk_check_in(null)->'afk_in'='null'::jsonb,'playing: no countdown');
select pg_temp.afk_assert((select last_active_at > pg_catalog.clock_timestamp()-interval '1 minute' from public.teammate_presence
  where user_id='5c000000-0000-4000-8000-000000000002'),'playing: clock reset');
update public.orders set status='completed',completed_at=pg_catalog.clock_timestamp() where id='5c200000-0000-4000-8000-000000000001';

-- 4 hours idle and free: switched offline, worded as automatic (no admin)
update public.teammate_presence set last_active_at=pg_catalog.clock_timestamp()-interval '4 hours 1 minute'
 where user_id='5c000000-0000-4000-8000-000000000002';
select pg_temp.afk_assert(public.desk_check_in(null)->>'online'='false','idle 4 hours: offline');
select pg_temp.afk_assert(public.desk_check_in(null)->'forced_offline'
  ='{"reason":"No activity for 4 hours","by":""}'::jsonb,'reason shown, no admin');
select pg_temp.afk_assert((public.desk_set_online(true)->>'online')::boolean,'can go online again');

select 'presence afk ok' as result;
