-- Rollback-only checks for 20261024210000_queue_settings.sql.
begin;

create function pg_temp.queue_assert(ok boolean, message text) returns void language plpgsql as $$
begin if not coalesce(ok,false) then raise exception '%',message; end if; end;
$$;

insert into auth.users(id,aud,role,email,raw_user_meta_data,raw_app_meta_data) values
 ('5d000000-0000-4000-8000-000000000001','authenticated','authenticated','queue-customer@example.invalid','{}','{}'),
 ('5d000000-0000-4000-8000-000000000004','authenticated','authenticated','voice-customer@example.invalid','{}','{}'),
 ('5d000000-0000-4000-8000-000000000005','authenticated','authenticated','valorant-customer@example.invalid','{}','{}'),
 ('5d000000-0000-4000-8000-000000000006','authenticated','authenticated','handover-customer@example.invalid','{}','{}'),
 ('5d000000-0000-4000-8000-000000000007','authenticated','authenticated','blocked-customer@example.invalid','{}','{}'),
 ('5d000000-0000-4000-8000-000000000002','authenticated','authenticated','queue-teammate@example.invalid','{}','{}'),
 ('5d000000-0000-4000-8000-000000000003','authenticated','authenticated','handover-teammate@example.invalid','{}','{}');
update public.account_roles set role='teammate' where user_id in
 ('5d000000-0000-4000-8000-000000000002','5d000000-0000-4000-8000-000000000003');
insert into public.teammate_order_access(user_id,approved_games,discord_id,discord_verified_at,priority_base) values
 ('5d000000-0000-4000-8000-000000000002','{lol,val}','990625000000000002',pg_catalog.clock_timestamp(),0),
 ('5d000000-0000-4000-8000-000000000003','{lol,val}','990625000000000003',pg_catalog.clock_timestamp(),0);

insert into public.orders(id,public_reference,customer_id,game,service,title,units,unit,region,ign,customer_name,amount_eur_cents,booking_fx,payout_usd_cents,voice,created_at,queued_at) values
 ('5d100000-0000-4000-8000-000000000001','DL-9906250001','5d000000-0000-4000-8000-000000000001','lol','duo','LOL text',1,'game','EUW','Player','Customer',999,1.08,646,false,pg_catalog.clock_timestamp(),pg_catalog.clock_timestamp()),
 ('5d100000-0000-4000-8000-000000000002','DL-9906250002','5d000000-0000-4000-8000-000000000004','lol','duo','LOL voice',1,'game','EUW','Player','Customer',999,1.08,646,true,pg_catalog.clock_timestamp(),pg_catalog.clock_timestamp()),
 ('5d100000-0000-4000-8000-000000000003','DL-9906250003','5d000000-0000-4000-8000-000000000005','val','duo','VAL text',1,'game','EU','Player','Customer',999,1.08,646,false,pg_catalog.clock_timestamp(),pg_catalog.clock_timestamp()),
 ('5d100000-0000-4000-8000-000000000004','DL-9906250004','5d000000-0000-4000-8000-000000000006','val','duo','VAL handover',1,'game','EU','Player','Customer',999,1.08,646,true,pg_catalog.clock_timestamp(),pg_catalog.clock_timestamp()),
 ('5d100000-0000-4000-8000-000000000005','DL-9906250005','5d000000-0000-4000-8000-000000000007','cs2','duo','CS handover',1,'game','EU','Player','Customer',999,1.08,646,false,pg_catalog.clock_timestamp(),pg_catalog.clock_timestamp());

set local role authenticated;
select pg_catalog.set_config('request.jwt.claims','{"role":"authenticated","sub":"5d000000-0000-4000-8000-000000000002"}',true);
select pg_catalog.set_config('request.jwt.claim.sub','5d000000-0000-4000-8000-000000000002',true);
do $$ declare r jsonb; begin
 r := public.teammate_queue_settings();
 perform pg_temp.queue_assert(r->'allowed_games'='["lol","val"]'::jsonb,'approved games missing from defaults: '||r::text);
 perform pg_temp.queue_assert(r->'enabled_games'='["lol","val"]'::jsonb and (r->>'voice_opt_in')::boolean,'defaults wrong: '||r::text);
 r := public.set_teammate_queue_settings('{lol}',false);
 perform pg_temp.queue_assert(r->'enabled_games'='["lol"]'::jsonb and not (r->>'voice_opt_in')::boolean,'save failed: '||r::text);
 r := public.set_teammate_queue_settings('{lol,cs2}',true);
 perform pg_temp.queue_assert((r->'error'->>'code')::int=400,'unapproved game enabled: '||r::text);
 r := public.teammate_order_queue();
 perform pg_temp.queue_assert(pg_catalog.jsonb_array_length(r->'orders')=1 and r->'orders'->0->>'title'='LOL text','queue ignored settings: '||r::text);
 perform pg_temp.queue_assert((public.accept_order('5d100000-0000-4000-8000-000000000002')->'error'->>'code')::int=404,'voice opt-out accepted voice order');
 perform pg_temp.queue_assert((public.accept_order('5d100000-0000-4000-8000-000000000003')->'error'->>'code')::int=404,'disabled game accepted');
 r := public.accept_order('5d100000-0000-4000-8000-000000000001');
 perform pg_temp.queue_assert(r->'order'->>'status'='in_progress','eligible order not accepted: '||r::text);
end $$;
reset role;

-- Admin handover links keep admin-approved game access, but intentionally bypass personal queue settings and voice opt-in.
insert into public.order_handovers(order_id,token_hash,created_by,created_by_name,expires_at) values
 ('5d100000-0000-4000-8000-000000000004',pg_catalog.repeat('a',64),'5d000000-0000-4000-8000-000000000001','Queue Admin',pg_catalog.clock_timestamp()+interval '4 minutes'),
 ('5d100000-0000-4000-8000-000000000005',pg_catalog.repeat('b',64),'5d000000-0000-4000-8000-000000000001','Queue Admin',pg_catalog.clock_timestamp()+interval '4 minutes');
set local role authenticated;
select pg_catalog.set_config('request.jwt.claims','{"role":"authenticated","sub":"5d000000-0000-4000-8000-000000000003"}',true);
select pg_catalog.set_config('request.jwt.claim.sub','5d000000-0000-4000-8000-000000000003',true);
do $$ declare r jsonb; begin
 r := public.set_teammate_queue_settings('{lol}',false);
 perform pg_temp.queue_assert(r->'enabled_games'='["lol"]'::jsonb,'handover teammate settings failed');
 r := public.handover_info(pg_catalog.repeat('a',64));
 perform pg_temp.queue_assert(r->>'state'='open','personal settings blocked handover info: '||r::text);
 r := public.accept_handover(pg_catalog.repeat('a',64));
 perform pg_temp.queue_assert(r->'order'->>'status'='in_progress','personal settings blocked handover accept: '||r::text);
 r := public.handover_info(pg_catalog.repeat('b',64));
 perform pg_temp.queue_assert(r->>'state'='blocked','unapproved handover shown open: '||r::text);
end $$;
reset role;

do $$ begin
 if has_table_privilege('authenticated','public.teammate_order_access','SELECT') then raise exception 'settings table readable directly'; end if;
 if not has_function_privilege('authenticated','public.teammate_queue_settings()','EXECUTE') then raise exception 'settings read RPC unavailable'; end if;
 if not has_function_privilege('authenticated','public.set_teammate_queue_settings(text[],boolean)','EXECUTE') then raise exception 'settings write RPC unavailable'; end if;
end $$;

select 'queue_settings: all checks passed' as result;
rollback;
