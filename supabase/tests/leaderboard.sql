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

-- Rollback-only checks for 20261024200000_leaderboard.sql.
-- Run with the migration body (without its begin/commit) inserted right after this begin, in one transaction:
--   (echo 'begin;'; sed '/^begin;$/d;/^commit;$/d' supabase/migrations/20261024200000_leaderboard.sql; sed '1,/^begin;$/d' supabase/tests/leaderboard.sql) > /tmp/lb.sql
-- Execute only using disposable local CI.
begin;
insert into auth.users(id,aud,role,email,raw_user_meta_data,raw_app_meta_data) values
 ('7b000000-0000-4000-8000-000000000001','authenticated','authenticated','lb-customer@example.invalid','{}','{}'),
 ('7b000000-0000-4000-8000-000000000002','authenticated','authenticated','lb-alpha@example.invalid','{}','{}'),
 ('7b000000-0000-4000-8000-000000000003','authenticated','authenticated','lb-bravo@example.invalid','{}','{}'),
 ('7b000000-0000-4000-8000-000000000004','authenticated','authenticated','lb-former@example.invalid','{}','{}');
update public.profiles set name=case id
 when '7b000000-0000-4000-8000-000000000001' then 'Lb Customer'
 when '7b000000-0000-4000-8000-000000000002' then 'Alpha'
 when '7b000000-0000-4000-8000-000000000003' then '  '
 else 'Former' end,
 image=case when id='7b000000-0000-4000-8000-000000000002' then '/assets/avatars/avatar-3.png' else '/assets/avatars/avatar-1.png' end,
 country='de'
where id::text like '7b000000-0000-4000-8000-00000000000%';
update public.account_roles set role=case when user_id='7b000000-0000-4000-8000-000000000001' then 'customer' else 'teammate' end
where user_id::text like '7b000000-0000-4000-8000-00000000000%';
insert into public.teammate_order_access(user_id,approved_games,discord_id,discord_verified_at) values
 ('7b000000-0000-4000-8000-000000000002',array['lol','val'],'223456789012345678',now()),
 ('7b000000-0000-4000-8000-000000000003',array['val'],'323456789012345678',now()),
 ('7b000000-0000-4000-8000-000000000004',array['lol'],'423456789012345678',now());

-- n, teammate, game, days ago, rating (0 = unrated)
do $$ declare f record; o uuid; a uuid; t timestamptz; begin
 for f in select * from (values
   (1,'7b000000-0000-4000-8000-000000000002'::uuid,'lol',2,5),
   (2,'7b000000-0000-4000-8000-000000000002'::uuid,'lol',10,4),
   (3,'7b000000-0000-4000-8000-000000000002'::uuid,'val',40,5),
   (4,'7b000000-0000-4000-8000-000000000003'::uuid,'val',1,3),
   (5,'7b000000-0000-4000-8000-000000000003'::uuid,'val',3,0),
   (6,'7b000000-0000-4000-8000-000000000004'::uuid,'lol',1,5)) as v(n,tm,game,days,rating) order by days desc
 loop
  o := ('7b100000-0000-4000-8000-00000000000'||f.n)::uuid; a := ('7b200000-0000-4000-8000-00000000000'||f.n)::uuid;
  t := now() - pg_catalog.make_interval(days => f.days);
  insert into public.orders(id,customer_id,customer_name,game,service,title,units,unit,rank,region,ign,amount_eur_cents,payout_usd_cents,booking_fx,created_at,queued_at)
   values(o,'7b000000-0000-4000-8000-000000000001','Lb Customer',f.game,'duo','Duo',1,'game','Gold','EUW','Lb',1000,600,1.1,t-interval '3 hours',t-interval '2 hours');
  insert into public.order_assignments(id,order_id,teammate_id,accepted_at,ended_at,end_reason)
   values(a,o,f.tm,t-interval '1 hour',t,'completed');
  update public.orders set status='completed',assigned_teammate_id=f.tm,current_assignment_id=a,accepted_at=t-interval '1 hour',completed_at=t where id=o;
  insert into public.teammate_earning_entries(order_id,assignment_id,teammate_id,request_id,proof_ids,completed_at,
   prior_completed_count,trust_tier,payout_usd_cents,deposit_percent,held_usd_cents,net_usd_cents,source_snapshot,result)
   values(o,a,f.tm,('7b300000-0000-4000-8000-00000000000'||f.n)::uuid,array[('7b400000-0000-4000-8000-00000000000'||f.n)::uuid],t,0,'rookie',600,10,60,540,'{}','{}');
  if f.rating > 0 then
   insert into public.order_reviews(order_id,assignment_id,customer_id,teammate_id,rating,text,tags)
    values(o,a,'7b000000-0000-4000-8000-000000000001',f.tm,f.rating,'private review text',array['Patient']);
  end if;
 end loop;
end $$;
-- Former teammate: earned entries stay, but the account is no longer a teammate, so it is not ranked.
update public.account_roles set role='customer' where user_id='7b000000-0000-4000-8000-000000000004';

create temporary table lb_result(r jsonb) on commit drop;
grant all on lb_result to authenticated;

set local role authenticated;
select pg_catalog.set_config('request.jwt.claims','{"role":"authenticated","sub":"7b000000-0000-4000-8000-000000000001"}',true);
select pg_catalog.set_config('request.jwt.claim.sub','7b000000-0000-4000-8000-000000000001',true);
do $$ begin
 if (public.teammate_stats()->'error'->>'code')::int<>403 then raise exception 'customer read leaderboard'; end if;
 begin perform public.teammate_leaderboard(now()); raise exception 'helper callable by authenticated';
 exception when insufficient_privilege then null; end;
end $$;
select pg_catalog.set_config('request.jwt.claims','{"role":"authenticated","sub":"7b000000-0000-4000-8000-000000000002"}',true);
select pg_catalog.set_config('request.jwt.claim.sub','7b000000-0000-4000-8000-000000000002',true);
insert into lb_result select public.teammate_stats();
reset role;

do $$ declare r jsonb := (select r from lb_result); b jsonb := r->'leaderboard'; j jsonb;
begin
 if r ? 'error' then raise exception 'teammate stats failed: %',r; end if;
 if (select pg_catalog.array_agg(k order by k) from pg_catalog.jsonb_object_keys(b) k)<>array['all','month','week'] then raise exception 'periods wrong: %',b; end if;
 if not (b->'week' ? 'global' and b->'month' ? 'global' and b->'all' ? 'global') then raise exception 'global tab missing'; end if;

 -- public fields only (only fixture rows are checked, so live rows never affect the result)
 for j in select x from pg_catalog.jsonb_array_elements(b->'all'->'global') x where x->>'id' like '7b000000-%' loop
  if (select pg_catalog.array_agg(k order by k) from pg_catalog.jsonb_object_keys(j) k)
     <>array['fives','id','image','main','name','orders','points','rating'] then raise exception 'non public field: %',j; end if;
 end loop;
 if b::text like '%example.invalid%' or b::text like '%private review text%' or b::text like '%Lb Customer%' then raise exception 'private data leaked'; end if;

 -- week: Bravo 2 orders (20 pts, 3.00), Alpha 1 order with a five (15 pts)
 select pg_catalog.jsonb_agg(x order by n) into j from pg_catalog.jsonb_array_elements(b->'week'->'global') with ordinality as e(x,n) where x->>'id' like '7b000000-%';
 if j <> '[{"id":"7b000000-0000-4000-8000-000000000003","name":"Teammate","image":"/assets/avatars/avatar-1.png","orders":2,"main":"val","rating":3.00,"fives":0,"points":20},
              {"id":"7b000000-0000-4000-8000-000000000002","name":"Alpha","image":"/assets/avatars/avatar-3.png","orders":1,"main":"lol","rating":5.00,"fives":1,"points":15}]'::jsonb
 then raise exception 'week board wrong: %',j; end if;
 if pg_catalog.jsonb_path_exists(b->'week'->'lol','$[*] ? (@.id == "7b000000-0000-4000-8000-000000000003")') then raise exception 'val teammate in lol tab'; end if;
 if not pg_catalog.jsonb_path_exists(b->'week'->'lol','$[*] ? (@.id == "7b000000-0000-4000-8000-000000000002" && @.points == 15)') then raise exception 'lol tab wrong: %',b->'week'->'lol'; end if;

 -- month: Alpha 2 lol orders (25 pts, 4.50) passes Bravo
 select pg_catalog.jsonb_agg(x->>'id'||':'||(x->>'points')||':'||(x->>'rating') order by n) into j from pg_catalog.jsonb_array_elements(b->'month'->'global') with ordinality as e(x,n) where x->>'id' like '7b000000-%';
 if j <> '["7b000000-0000-4000-8000-000000000002:25:4.50","7b000000-0000-4000-8000-000000000003:20:3.00"]'::jsonb then raise exception 'month board wrong: %',j; end if;

 -- all time: Alpha 3 orders, two fives, mostly lol; val tab ranks Bravo (20) over Alpha (15)
 select x into j from pg_catalog.jsonb_array_elements(b->'all'->'global') x where x->>'id'='7b000000-0000-4000-8000-000000000002';
 if j->>'points'<>'40' or j->>'rating'<>'4.67' or j->>'main'<>'lol' or j->>'orders'<>'3' then raise exception 'all time row wrong: %',j; end if;
 select pg_catalog.jsonb_agg(x->>'id'||':'||(x->>'points')||':'||(x->>'main') order by n) into j from pg_catalog.jsonb_array_elements(b->'all'->'val') with ordinality as e(x,n) where x->>'id' like '7b000000-%';
 if j <> '["7b000000-0000-4000-8000-000000000003:20:val","7b000000-0000-4000-8000-000000000002:15:val"]'::jsonb then raise exception 'val tab wrong: %',j; end if;

 -- former teammate is never ranked
 if b::text like '%7b000000-0000-4000-8000-000000000004%' then raise exception 'former teammate ranked'; end if;
 -- the stats part is unchanged
 if r->'stats'->>'completed'<>'3' or r->'stats'->>'reviews'<>'3' or r->>'me'<>'7b000000-0000-4000-8000-000000000002' then raise exception 'stats changed: %',r->'stats'; end if;
end $$;

select 'leaderboard: all checks passed' as result;
rollback;
