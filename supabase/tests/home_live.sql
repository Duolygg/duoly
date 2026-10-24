-- Rollback-only checks for 20261024180000_home_live.sql.
-- Run after the body of 20261024180000_home_live.sql in one transaction (begin and commit stripped).
begin;
insert into auth.users(id,aud,role,email,raw_user_meta_data,raw_app_meta_data) values
 ('7b000000-0000-4000-8000-000000000001','authenticated','authenticated','home-customer@example.invalid','{}','{}'),
 ('7b000000-0000-4000-8000-000000000002','authenticated','authenticated','home-teammate@example.invalid','{}','{}'),
 ('7b000000-0000-4000-8000-000000000003','authenticated','authenticated','home-mail@example.invalid','{}','{}');
update public.account_roles set role='teammate' where user_id='7b000000-0000-4000-8000-000000000002';
insert into public.teammate_order_access(user_id,approved_games,discord_id,discord_verified_at)
 values('7b000000-0000-4000-8000-000000000002',array['val','cs2'],'223456789012345678',now());

-- Completed and reviewed (first name only, 58 s to match, rated 4).
insert into public.orders(id,customer_id,customer_name,game,service,title,units,unit,rank,region,ign,note,amount_eur_cents,payout_usd_cents,booking_fx,created_at,queued_at)
 values('7b100000-0000-4000-8000-000000000001','7b000000-0000-4000-8000-000000000001','Zelda Secretlast','val','duo','Duo Pro',3,'game','Gold','EUW','PrivateIgn#123','secret note',2000,1200,1.1,now()-interval '3 hours',now()-interval '2 hours');
insert into public.order_assignments(id,order_id,teammate_id,accepted_at,ended_at,end_reason) values
 ('7b200000-0000-4000-8000-000000000001','7b100000-0000-4000-8000-000000000001','7b000000-0000-4000-8000-000000000002',now()-interval '2 hours'+interval '58 seconds',now()-interval '1 hour','completed');
update public.orders set status='completed',assigned_teammate_id='7b000000-0000-4000-8000-000000000002',
 current_assignment_id='7b200000-0000-4000-8000-000000000001',accepted_at=now()-interval '2 hours'+interval '58 seconds',completed_at=now()-interval '1 hour'
 where id='7b100000-0000-4000-8000-000000000001';
insert into public.teammate_earning_entries(order_id,assignment_id,teammate_id,request_id,proof_ids,completed_at,
 prior_completed_count,trust_tier,payout_usd_cents,deposit_percent,held_usd_cents,net_usd_cents,source_snapshot,result)
 values('7b100000-0000-4000-8000-000000000001','7b200000-0000-4000-8000-000000000001','7b000000-0000-4000-8000-000000000002',
 '7b300000-0000-4000-8000-000000000001',array['7b400000-0000-4000-8000-000000000001'::uuid],now()-interval '1 hour',0,'rookie',1200,10,120,1080,'{}','{}');
insert into public.order_reviews(order_id,assignment_id,customer_id,teammate_id,rating,text)
 values('7b100000-0000-4000-8000-000000000001','7b200000-0000-4000-8000-000000000001','7b000000-0000-4000-8000-000000000001','7b000000-0000-4000-8000-000000000002',4,'private review text');

-- Completed, no review, name looks like an email: name must be null.
insert into public.orders(id,customer_id,customer_name,game,service,title,units,unit,rank,region,ign,amount_eur_cents,payout_usd_cents,booking_fx,created_at,queued_at)
 values('7b100000-0000-4000-8000-000000000002','7b000000-0000-4000-8000-000000000003','home-mail@example.invalid','cs2','duo','Duo Apex',1,'game','','EUW','MailIgn',1000,600,1.1,now()-interval '40 minutes',now()-interval '30 minutes');
insert into public.order_assignments(id,order_id,teammate_id,accepted_at,ended_at,end_reason) values
 ('7b200000-0000-4000-8000-000000000002','7b100000-0000-4000-8000-000000000002','7b000000-0000-4000-8000-000000000002',now()-interval '30 minutes'+interval '68 seconds',now()-interval '5 minutes','completed');
update public.orders set status='completed',assigned_teammate_id='7b000000-0000-4000-8000-000000000002',
 current_assignment_id='7b200000-0000-4000-8000-000000000002',accepted_at=now()-interval '30 minutes'+interval '68 seconds',completed_at=now()-interval '5 minutes'
 where id='7b100000-0000-4000-8000-000000000002';

-- Completed 40 days ago: outside the window.
insert into public.orders(id,customer_id,customer_name,game,service,title,units,unit,rank,region,ign,amount_eur_cents,payout_usd_cents,booking_fx,created_at,queued_at)
 values('7b100000-0000-4000-8000-000000000003','7b000000-0000-4000-8000-000000000001','Oldname','val','duo','Duo Old',1,'game','','EUW','OldIgn',1000,600,1.1,now()-interval '41 days',now()-interval '41 days');
insert into public.order_assignments(id,order_id,teammate_id,accepted_at,ended_at,end_reason) values
 ('7b200000-0000-4000-8000-000000000003','7b100000-0000-4000-8000-000000000003','7b000000-0000-4000-8000-000000000002',now()-interval '41 days'+interval '1 minute',now()-interval '40 days','completed');
update public.orders set status='completed',assigned_teammate_id='7b000000-0000-4000-8000-000000000002',
 current_assignment_id='7b200000-0000-4000-8000-000000000003',accepted_at=now()-interval '41 days'+interval '1 minute',completed_at=now()-interval '40 days'
 where id='7b100000-0000-4000-8000-000000000003';

-- Still queued: never listed.
insert into public.orders(id,customer_id,customer_name,game,service,title,units,unit,rank,region,ign,amount_eur_cents,payout_usd_cents,booking_fx,created_at,queued_at)
 values('7b100000-0000-4000-8000-000000000004','7b000000-0000-4000-8000-000000000001','Queuedname','val','duo','Duo Queued',1,'game','','EUW','QueuedIgn',1000,600,1.1,now(),now());

set local role anon;
select pg_catalog.set_config('request.jwt.claims','{"role":"anon"}',true);
do $$ declare r jsonb; a jsonb; b jsonb; begin
 r := public.home_recent_matches();
 if pg_catalog.jsonb_typeof(r) <> 'array' or pg_catalog.jsonb_array_length(r) > 20 then raise exception 'not a bounded array: %',r; end if;
 select x into a from pg_catalog.jsonb_array_elements(r) x where x->>'title'='Duo Pro' and x->>'name'='Zelda';
 select x into b from pg_catalog.jsonb_array_elements(r) x where x->>'title'='Duo Apex' and x->>'game'='cs2' and (x->>'matchSeconds')::int=68;
 if a is null then raise exception 'reviewed match missing or name not first-name only: %',r; end if;
 if a->>'game'<>'val' or (a->>'matchSeconds')::int<>58 or (a->>'rating')::int<>4 or (a->>'units')::int<>3 then raise exception 'reviewed match wrong: %',a; end if;
 if b is null or b->'name'<>'null'::jsonb or b->'rating'<>'null'::jsonb then raise exception 'email-like name leaked or rating invented: %',b; end if;
 if exists(select 1 from pg_catalog.jsonb_array_elements(r) x where x->>'title' in ('Duo Old','Duo Queued')) then raise exception 'old or open order listed'; end if;
 if exists(select 1 from pg_catalog.jsonb_array_elements(r) x, pg_catalog.jsonb_object_keys(x) k
   where k not in ('game','name','title','units','matchSeconds','rating')) then raise exception 'unexpected field exposed: %',r; end if;
 if r::text ~* '(secretlast|privateign|secret note|private review|example\.invalid|7b[0-9]00000)' then raise exception 'private data exposed: %',r; end if;
 -- Newest first: the email-named order completed after Zelda's.
 if (select min(n) from pg_catalog.jsonb_array_elements(r) with ordinality e(x,n) where x->>'title'='Duo Apex' and x->>'game'='cs2')
   > (select min(n) from pg_catalog.jsonb_array_elements(r) with ordinality e(x,n) where x->>'name'='Zelda') then raise exception 'not newest first'; end if;
end $$;
do $$ begin
 perform 1 from public.orders;
 raise exception 'anon read orders directly';
exception when insufficient_privilege then null;
end $$;
reset role;

do $$ begin
 if has_function_privilege('anon','public.home_recent_matches()','execute') is not true then raise exception 'anon cannot execute'; end if;
 if has_function_privilege('public','public.home_recent_matches()','execute') then raise exception 'public can execute'; end if;
 if (select prosecdef from pg_catalog.pg_proc where oid='public.home_recent_matches()'::regprocedure) is not true then raise exception 'not security definer'; end if;
 if (select provolatile from pg_catalog.pg_proc where oid='public.home_recent_matches()'::regprocedure) <> 's' then raise exception 'not stable'; end if;
end $$;
select 'home_live: all checks passed' as result;
rollback;
