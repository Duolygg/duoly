-- Rollback-only checks for 20261105100000_twitch_streaming.sql (with 20261105110000 and 20261105150000). Run after the migration bodies in one
-- transaction (begin; <migration without begin/commit>; <this file>; rollback;).
-- Fixtures: A admin, S streamer (lol + val approved), T other teammate (lol), C customer.

create function pg_temp.ts_assert(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'twitch streaming assertion: %',label; end if; end $$;
create function pg_temp.ts_login(actor uuid) returns void language plpgsql as $$
begin
  perform pg_catalog.set_config('request.jwt.claim.sub',coalesce(actor::text,''),true);
  perform pg_catalog.set_config('request.jwt.claims',
    case when actor is null then '{"role":"anon"}' else pg_catalog.jsonb_build_object('role','authenticated','sub',actor)::text end,true);
end $$;

insert into auth.users(id,aud,role,email,raw_user_meta_data,raw_app_meta_data) values
 ('7e000000-0000-4000-8000-0000000000a0','authenticated','authenticated','ts-a@example.invalid','{}','{}'),
 ('7e000000-0000-4000-8000-000000000051','authenticated','authenticated','ts-s@example.invalid','{}','{}'),
 ('7e000000-0000-4000-8000-000000000052','authenticated','authenticated','ts-t@example.invalid','{}','{}'),
 ('7e000000-0000-4000-8000-0000000000c1','authenticated','authenticated','ts-c@example.invalid','{}','{}');
update public.profiles set name='Lea Streamer' where id='7e000000-0000-4000-8000-000000000051';
update public.profiles set name='Tom Teammate' where id='7e000000-0000-4000-8000-000000000052';
update public.account_roles set role='admin' where user_id='7e000000-0000-4000-8000-0000000000a0';
update public.account_roles set role='teammate' where user_id in ('7e000000-0000-4000-8000-000000000051','7e000000-0000-4000-8000-000000000052');
insert into public.teammate_order_access(user_id,approved_games,enabled_games,discord_id,discord_verified_at) values
 ('7e000000-0000-4000-8000-000000000051',array['lol','val'],array['val'],'700000000000000051',pg_catalog.now()),
 ('7e000000-0000-4000-8000-000000000052',array['lol'],array['lol'],'700000000000000052',pg_catalog.now());
insert into public.teammate_presence(user_id,online,online_since,last_seen_at)
  values ('7e000000-0000-4000-8000-000000000051',true,pg_catalog.clock_timestamp(),pg_catalog.clock_timestamp()),
         ('7e000000-0000-4000-8000-000000000052',true,pg_catalog.clock_timestamp(),pg_catalog.clock_timestamp())
  on conflict (user_id) do update set online=true,online_since=excluded.online_since,last_seen_at=excluded.last_seen_at;

-- admin: only approved games are kept
select pg_temp.ts_login('7e000000-0000-4000-8000-000000000052');
select pg_temp.ts_assert((public.admin_set_stream_access('7e000000-0000-4000-8000-000000000051',array['lol'])->'error'->>'code')='403','non-admin refused');
select pg_temp.ts_login('7e000000-0000-4000-8000-0000000000a0');
select pg_temp.ts_assert(public.admin_set_stream_access('7e000000-0000-4000-8000-000000000051',array['cs2','lol'])->'access'->'stream'='["lol"]'::jsonb,'admin grant keeps approved games only');

-- streamer panel
select pg_temp.ts_login('7e000000-0000-4000-8000-000000000052');
select pg_temp.ts_assert(public.streamer_desk()='{"streaming":null}'::jsonb,'no access = no panel');
select pg_temp.ts_assert((public.streamer_desk_save(true,1500,array[1],null)->'error'->>'code')='403','no access = cannot save');
select pg_temp.ts_login('7e000000-0000-4000-8000-000000000051');
select pg_temp.ts_assert((public.streamer_desk_save(true,400,array[1],null)->'error'->>'code')='400','rate below 5 EUR refused');
select pg_temp.ts_assert((public.streamer_desk_save(true,1500,array[1],'no')->'error'->>'code')='400','bad twitch name refused');
select pg_temp.ts_assert((public.streamer_desk_save(true,1500,array[1],null)->'error'->>'code')='400','no twitch name = cannot go online');
select pg_temp.ts_assert((public.streamer_desk_save(true,998,array[1],'lea_tv')->'error'->>'code')='400','rate below 9.99 EUR refused');
-- 20261105190000: listed as soon as they go online, nothing asks Twitch
select pg_temp.ts_assert((public.streamer_desk_save(true,1500,array[2,1,2,11],'lea_tv')->'streaming'->>'live')::boolean,'online and live');
select pg_temp.ts_assert(not (public.streamer_desk()->'streaming' ? 'twitchLive'),'no twitchLive');
select pg_temp.ts_assert(public.streamer_desk()->'streaming'->'durations'='[1,2]'::jsonb,'durations cleaned');

-- public list and checkout quote
select pg_temp.ts_login(null);
select pg_catalog.set_config('ts.handle',(select handle::text from public.streamer_settings where user_id='7e000000-0000-4000-8000-000000000051'),true);
select pg_temp.ts_assert(exists(select 1 from pg_catalog.jsonb_array_elements(public.home_streamers()) e
  where e->>'handle'=pg_catalog.current_setting('ts.handle') and e->>'name'='Lea' and (e->>'rateEurCents')::int=1500
    and e->'games'='["lol"]'::jsonb and e->>'twitch'='lea_tv' and not (e ? 'userId')),'listed publicly without id');
select pg_temp.ts_assert((public.streamer_checkout_quote(pg_catalog.current_setting('ts.handle')::uuid,'lol',2)->>'rateEurCents')::int=1500,'quote ok');
select pg_temp.ts_assert((public.streamer_checkout_quote(pg_catalog.current_setting('ts.handle')::uuid,'val',2)->'error'->>'code')='400','game not streamed');
select pg_temp.ts_assert((public.streamer_checkout_quote(pg_catalog.current_setting('ts.handle')::uuid,'lol',3)->'error'->>'code')='400','length not offered');

-- a stale desk heartbeat hides the streamer
update public.teammate_presence set last_seen_at=pg_catalog.clock_timestamp()-interval '30 seconds' where user_id='7e000000-0000-4000-8000-000000000051';
select pg_temp.ts_assert(not public.streamer_live('7e000000-0000-4000-8000-000000000051')
  and public.home_streamers()='[]'::jsonb,'stale desk = not listed');
update public.teammate_presence set last_seen_at=pg_catalog.clock_timestamp() where user_id='7e000000-0000-4000-8000-000000000051';

-- a paid booking: the intent trigger records the streamer with the order
insert into public.orders(id,customer_id,game,service,title,units,unit,region,ign,customer_name,amount_eur_cents,booking_fx,payout_usd_cents)
  values('7e000000-0000-4000-8000-0000000000e1','7e000000-0000-4000-8000-0000000000c1','lol','stream','Twitch stream with Lea',2,'hour','EUW','Viewer','Customer',3000,1.08,1943);
insert into public.checkout_intents(id,customer_id,game,service,title,units,unit,region,ign,amount_eur_cents,payout_usd_cents,booking_fx,expires_at,streamer_id,streamer_name,streamer_rate_eur_cents)
  values('7e000000-0000-4000-8000-0000000000f1','7e000000-0000-4000-8000-0000000000c1','lol','stream','Twitch stream with Lea',2,'hour','EUW','Viewer',3000,1943,1.08,
    pg_catalog.clock_timestamp()+interval '1 hour','7e000000-0000-4000-8000-000000000051','Lea',1500);
update public.checkout_intents set status='paid',order_id='7e000000-0000-4000-8000-0000000000e1' where id='7e000000-0000-4000-8000-0000000000f1';
select pg_temp.ts_assert(public.order_streamer('7e000000-0000-4000-8000-0000000000e1')='7e000000-0000-4000-8000-000000000051','booking recorded');
select pg_temp.ts_assert(public.order_public_queued_at((select o from public.orders o where id='7e000000-0000-4000-8000-0000000000e1'))='infinity','never in the normal queue');

-- visible at once to the streamer only (even with lol switched off in their queue settings)
select pg_temp.ts_login('7e000000-0000-4000-8000-000000000052');
select pg_temp.ts_assert(not exists(select 1 from pg_catalog.jsonb_array_elements(public.teammate_order_queue()->'orders') e where e->>'id'='7e000000-0000-4000-8000-0000000000e1'),'hidden from others');
select pg_temp.ts_assert((public.accept_order('7e000000-0000-4000-8000-0000000000e1')->'error'->>'code')='404','others cannot accept');
select pg_temp.ts_login('7e000000-0000-4000-8000-000000000051');
select pg_temp.ts_assert(exists(select 1 from pg_catalog.jsonb_array_elements(public.teammate_order_queue()->'orders') e where e->>'id'='7e000000-0000-4000-8000-0000000000e1'),'streamer sees it at once');
select pg_temp.ts_assert(public.accept_order('7e000000-0000-4000-8000-0000000000e1')->'error' is null,'streamer accepts');
select pg_temp.ts_assert(not public.streamer_live('7e000000-0000-4000-8000-000000000051'),'busy streamer is not bookable');

-- the customer can't reroll a booking
select pg_temp.ts_login('7e000000-0000-4000-8000-0000000000c1');
select pg_temp.ts_assert((public.reroll_order('7e000000-0000-4000-8000-0000000000e1')->'error'->>'code')='409','no reroll');

-- revoking access
select pg_temp.ts_login('7e000000-0000-4000-8000-0000000000a0');
select pg_temp.ts_assert(public.admin_set_stream_access('7e000000-0000-4000-8000-000000000051','{}')->'access'->'stream'='[]'::jsonb,'revoking clears the games');
-- a separate statement, so it sees the update the function made
select pg_temp.ts_assert(not (select stream_online from public.streamer_settings where user_id='7e000000-0000-4000-8000-000000000051'),'revoking switches streaming off');

select 'twitch streaming ok' as result;
