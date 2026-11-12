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

-- Rollback-only checks for 20261024160000_order_reviews.sql.
-- Run after the bodies of 20261024142000_presence.sql and 20261024160000_order_reviews.sql in one transaction.
begin;
insert into auth.users(id,aud,role,email,raw_user_meta_data,raw_app_meta_data) values
 ('7a000000-0000-4000-8000-000000000001','authenticated','authenticated','review-customer@example.invalid','{}','{}'),
 ('7a000000-0000-4000-8000-000000000002','authenticated','authenticated','review-teammate@example.invalid','{}','{}'),
 ('7a000000-0000-4000-8000-000000000003','authenticated','authenticated','review-other@example.invalid','{}','{}'),
 ('7a000000-0000-4000-8000-000000000004','authenticated','authenticated','review-admin@example.invalid','{}','{}');
update public.profiles set name=case id
 when '7a000000-0000-4000-8000-000000000001' then 'Review Customer'
 when '7a000000-0000-4000-8000-000000000002' then 'Review Teammate'
 when '7a000000-0000-4000-8000-000000000003' then 'Other Customer'
 else 'Review Admin' end
where id::text like '7a000000-0000-4000-8000-00000000000%';
update public.account_roles set role=case when user_id='7a000000-0000-4000-8000-000000000002' then 'teammate'
 when user_id='7a000000-0000-4000-8000-000000000004' then 'admin' else 'customer' end
where user_id::text like '7a000000-0000-4000-8000-00000000000%';
insert into public.teammate_order_access(user_id,approved_games,discord_id,discord_verified_at)
 values('7a000000-0000-4000-8000-000000000002',array['lol'],'123456789012345678',now());
insert into public.orders(id,customer_id,customer_name,game,service,title,units,unit,rank,region,ign,amount_eur_cents,payout_usd_cents,booking_fx,created_at,queued_at)
 values('7a100000-0000-4000-8000-000000000001','7a000000-0000-4000-8000-000000000001','Review Customer','lol','duo','Duo',1,'game','Gold','EUW','Reviewer',1000,600,1.1,now()-interval '3 hours',now()-interval '2 hours');
insert into public.order_assignments(id,order_id,teammate_id,accepted_at,ended_at,end_reason) values
 ('7a200000-0000-4000-8000-000000000001','7a100000-0000-4000-8000-000000000001','7a000000-0000-4000-8000-000000000002',now()-interval '1 hour',now(),'completed');
update public.orders set status='completed',assigned_teammate_id='7a000000-0000-4000-8000-000000000002',
 current_assignment_id='7a200000-0000-4000-8000-000000000001',accepted_at=now()-interval '1 hour',completed_at=now()
 where id='7a100000-0000-4000-8000-000000000001';
insert into public.orders(id,customer_id,customer_name,game,service,title,units,unit,rank,region,ign,amount_eur_cents,payout_usd_cents,booking_fx,created_at,queued_at)
 values('7a100000-0000-4000-8000-000000000002','7a000000-0000-4000-8000-000000000001','Review Customer','lol','duo','Duo',1,'game','Gold','EUW','Reviewer',1000,600,1.1,now()-interval '2 minutes',now()-interval '1 minute');
insert into public.order_assignments(id,order_id,teammate_id,accepted_at) values
 ('7a200000-0000-4000-8000-000000000002','7a100000-0000-4000-8000-000000000002','7a000000-0000-4000-8000-000000000002',now());
update public.orders set status='in_progress',assigned_teammate_id='7a000000-0000-4000-8000-000000000002',
 current_assignment_id='7a200000-0000-4000-8000-000000000002',accepted_at=now()
 where id='7a100000-0000-4000-8000-000000000002';
insert into public.teammate_earning_entries(order_id,assignment_id,teammate_id,request_id,proof_ids,completed_at,
 prior_completed_count,trust_tier,payout_usd_cents,deposit_percent,held_usd_cents,net_usd_cents,source_snapshot,result)
 values('7a100000-0000-4000-8000-000000000001','7a200000-0000-4000-8000-000000000001','7a000000-0000-4000-8000-000000000002',
 '7a300000-0000-4000-8000-000000000001',array['7a400000-0000-4000-8000-000000000001'::uuid],now(),0,'rookie',600,10,60,540,'{}','{}');

set local role authenticated;
select pg_catalog.set_config('request.jwt.claims','{"role":"authenticated","sub":"7a000000-0000-4000-8000-000000000003"}',true);
select pg_catalog.set_config('request.jwt.claim.sub','7a000000-0000-4000-8000-000000000003',true);
do $$ begin
 if (public.order_review('7a100000-0000-4000-8000-000000000001',5,'private',array[]::text[])->'error'->>'code')::int<>404 then raise exception 'other customer reviewed order'; end if;
end $$;
select pg_catalog.set_config('request.jwt.claims','{"role":"authenticated","sub":"7a000000-0000-4000-8000-000000000001"}',true);
select pg_catalog.set_config('request.jwt.claim.sub','7a000000-0000-4000-8000-000000000001',true);
do $$ declare r jsonb; begin
 if (public.order_review('7a100000-0000-4000-8000-000000000002',5,'early',array[]::text[])->'error'->>'code')::int<>409 then raise exception 'reviewed before completion'; end if;
 if (public.order_review('7a100000-0000-4000-8000-000000000001',0,'bad',array[]::text[])->'error'->>'code')::int<>400 then raise exception 'invalid rating accepted'; end if;
 r:=public.order_review('7a100000-0000-4000-8000-000000000001',5,E'  Great\nplayer  ',array['Unknown','Great comms','Great comms','Patient']);
 if r->'order'->'review'->>'rating'<>'5' or r->'order'->'review'->>'text'<>'Great player'
   or pg_catalog.jsonb_array_length(r->'order'->'review'->'tags')<>2 then raise exception 'review result wrong: %',r; end if;
 if (public.order_review('7a100000-0000-4000-8000-000000000001',4,'again',array[]::text[])->'error'->>'code')::int<>409 then raise exception 'duplicate review accepted'; end if;
end $$;
reset role;
do $$ begin
 if (select count(*) from public.order_reviews)<>1 then raise exception 'review row missing'; end if;
 if (select tags from public.order_reviews)<>array['Great comms','Patient'] then raise exception 'unknown tag not dropped'; end if;
 if not exists(select 1 from public.order_chat_messages where assignment_id='7a200000-0000-4000-8000-000000000001'
   and system_event='reviewed' and body='Rated 5/5. Thank you!') then raise exception 'review chat line missing'; end if;
 begin update public.order_reviews set rating=4; raise exception 'review update accepted'; exception when sqlstate 'PT409' then null; end;
end $$;
set local role authenticated;
select pg_catalog.set_config('request.jwt.claims','{"role":"authenticated","sub":"7a000000-0000-4000-8000-000000000002"}',true);
select pg_catalog.set_config('request.jwt.claim.sub','7a000000-0000-4000-8000-000000000002',true);
do $$ declare r jsonb; begin
 r:=public.teammate_stats();
 if r->'stats'->>'rating'<>'5.00' or r->'stats'->>'reviews'<>'1' or r->'stats'->'latestReviews'->0->>'customer'<>'Review Customer' then raise exception 'teammate stats wrong: %',r; end if;
end $$;
select pg_catalog.set_config('request.jwt.claims','{"role":"authenticated","sub":"7a000000-0000-4000-8000-000000000004"}',true);
select pg_catalog.set_config('request.jwt.claim.sub','7a000000-0000-4000-8000-000000000004',true);
do $$ declare r jsonb; begin
 r:=public.admin_teammates();
 if (select x->>'rating' from pg_catalog.jsonb_array_elements(r->'teammates') x where x->>'id'='7a000000-0000-4000-8000-000000000002')<>'5.00' then raise exception 'admin roster rating missing: %',r; end if;
 if not (select (x ? 'online') and (x ? 'playing') and x->>'reviews'='1' from pg_catalog.jsonb_array_elements(r->'teammates') x
   where x->>'id'='7a000000-0000-4000-8000-000000000002') then raise exception 'presence roster fields lost: %',r; end if;
 r:=public.admin_orders(100);
 if (select x->'review'->>'text' from pg_catalog.jsonb_array_elements(r->'orders') x where x->>'orderId'='7a100000-0000-4000-8000-000000000001')<>'Great player' then raise exception 'admin order review missing: %',r; end if;
end $$;
reset role;
select 'order_reviews: all checks passed' as result;
rollback;
