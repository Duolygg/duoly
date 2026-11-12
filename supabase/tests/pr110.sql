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

-- Execute only using disposable local CI.
begin;
create function pg_temp.check110(ok boolean, label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'PR110: %', label; end if; end $$;
create function pg_temp.login110(actor uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(actor::text,''), true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', actor, 'role','authenticated')::text, true);
end $$;
insert into auth.users(id,aud,role,email,raw_user_meta_data,raw_app_meta_data)
select ('ae110000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,'authenticated','authenticated',
  'pr110-'||n||'@example.invalid','{}','{}' from generate_series(1,7) n;
update public.profiles set name = case right(id::text,1) when '1' then 'Review One' when '2' then 'Review Two' else 'Player' end
 where id::text like 'ae110000-%';
update public.account_roles set role='teammate' where user_id::text like 'ae110000-%' and right(user_id::text,1) in ('1','2','3','4');
insert into public.teammate_order_access(user_id,approved_games,discord_id,discord_verified_at,gg_access,suspended)
 select ('ae110000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,array['lol'],
 '91100000000000000'||n,now(),n=3,n=4 from generate_series(1,4) n;
insert into public.teammate_presence(user_id,online,online_since,last_seen_at)
select user_id,true,now(),now() from public.teammate_order_access where user_id::text like 'ae110000-%';

-- Real booking rows exercise the new game constraints, not a string search of SQL.
insert into public.orders(id,customer_id,game,service,title,units,unit,region,ign,customer_name,amount_eur_cents,booking_fx,payout_usd_cents,gg)
values ('ae110001-0000-4000-8000-000000000001','ae110000-0000-4000-8000-000000000007','social','chat','Just Chat',1,'hour','EU','DiscordCustomer','Review',999,1.08,647,true);
insert into public.checkout_intents(customer_id,game,service,title,units,unit,region,ign,amount_eur_cents,payout_usd_cents,booking_fx,expires_at,gg)
values ('ae110000-0000-4000-8000-000000000005','social','chat','Just Chat',1,'hour','EU','DiscordCustomer',999,647,1.08,now()+interval '1 hour',true);
do $$ begin
  begin
    update public.orders set game='unknown' where id='ae110001-0000-4000-8000-000000000001';
    raise exception 'unknown booking game accepted';
  exception when check_violation then null; end;
  begin
    update public.checkout_intents set game='unknown' where customer_id='ae110000-0000-4000-8000-000000000005';
    raise exception 'unknown checkout game accepted';
  exception when check_violation then null; end;
  begin
    update public.teammate_order_access set approved_games=array['social'] where user_id='ae110000-0000-4000-8000-000000000001';
    raise exception 'Social approved as a non GG game';
  exception when check_violation then null; end;
end $$;
select pg_temp.login110('ae110000-0000-4000-8000-000000000003');
select pg_temp.check110(public.set_teammate_queue_settings(array['social'],true)->'enabled_games'='["social"]'::jsonb,'GG can enable Social');
select pg_temp.login110('ae110000-0000-4000-8000-000000000001');
select pg_temp.check110(public.set_teammate_queue_settings(array['social'],true)#>>'{error,code}'='400','non GG cannot enable Social');

-- Completed fixtures with assignments and actual reviews for retention, satisfaction and volume.
do $$ declare t uuid; c uuid; o uuid; a uuid; n integer; k integer; at timestamptz:=now()-interval '2 days'; begin
 for n in 1..2 loop
  t:=('ae110000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid;
  for k in 1..(case n when 1 then 3 else 2 end) loop
   c:=case when k=1 then 'ae110000-0000-4000-8000-000000000005'::uuid else 'ae110000-0000-4000-8000-000000000006'::uuid end;
   o:=gen_random_uuid(); a:=gen_random_uuid();
   insert into public.orders(id,customer_id,game,service,title,units,unit,region,ign,customer_name,amount_eur_cents,booking_fx,payout_usd_cents,created_at,queued_at)
   values(o,c,'lol','duo1','Plus fixture',1,'game','EUW','Review','Review Customer',999,1.08,600,at,at);
   insert into public.order_assignments(id,order_id,teammate_id,accepted_at,ended_at,end_reason) values(a,o,t,at,at,'completed');
   update public.orders set status='completed',assigned_teammate_id=t,current_assignment_id=a,accepted_at=at,completed_at=at where id=o;
   insert into public.teammate_earning_entries(order_id,assignment_id,teammate_id,request_id,proof_ids,completed_at,prior_completed_count,trust_tier,payout_usd_cents,deposit_percent,held_usd_cents,net_usd_cents,source_snapshot,result)
   values(o,a,t,gen_random_uuid(),array[gen_random_uuid()],at,0,'rookie',600,10,60,540,'{}','{}');
   insert into public.order_reviews(order_id,assignment_id,customer_id,teammate_id,rating,text) values(o,a,c,t,case n when 1 then 5 else 3 end,'Review fixture');
  end loop;
 end loop;
end $$;
-- Isolate ranking percentiles from any existing development accounts, inside this rollback only.
update public.teammate_order_access set suspended=true where user_id::text not like 'ae110000-%';
update public.performance_settings set min_orders=2,min_reviews=2,min_customers=2;
select public.performance_recalculate('manual','rollback test');
select pg_temp.check110((select eligible and completed_orders=3 and reviews=3 and customers=2 and returning_customers=1
 and retention_score=50 and satisfaction_score=100 and orders_score=100 and score=77.5 and rank=1 and bracket=50
 from public.performance_scores where teammate_id='ae110000-0000-4000-8000-000000000001' order by run_id desc limit 1),'calculation and TOP 50');
select pg_temp.check110((select eligible and score=17.5 and rank=2 and bracket is null from public.performance_scores
 where teammate_id='ae110000-0000-4000-8000-000000000002' order by run_id desc limit 1),'second ranked outside brackets');
select pg_temp.check110((select not eligible and reason='Needs 2 completed orders' from public.performance_scores
 where teammate_id='ae110000-0000-4000-8000-000000000003' order by run_id desc limit 1),'eligibility reason');
select pg_temp.check110(not exists(select 1 from public.performance_scores where teammate_id='ae110000-0000-4000-8000-000000000004'),'suspended excluded');

-- Public hero RPC exposes only its exact allowlisted fields, first name, real counts and rating.
set local role anon;
do $$ declare card jsonb; begin
 select x into card from jsonb_array_elements(public.home_teammates()) x where x->>'name'='Review';
 perform pg_temp.check110(card is not null and card->>'sessions'='3' and card->>'rating'='5.0','hero uses real aggregates');
 perform pg_temp.check110(not exists(select 1 from jsonb_array_elements(public.home_teammates()) x,jsonb_object_keys(x) k
 where k not in ('name','image','games','gg','online','rating','reviews','sessions','slug')),'hero privacy allowlist');
end $$;
reset role;
set local role authenticated;
select pg_temp.login110('ae110000-0000-4000-8000-000000000005');
select pg_temp.check110(public.admin_performance()#>>'{error,code}'='403','customer admin read denied');
select pg_temp.check110(public.admin_performance_recalculate()#>>'{error,code}'='403','customer admin recalc denied');
select pg_temp.check110(public.admin_set_performance_settings(45,35,20,90,2,2,2)#>>'{error,code}'='403','customer settings denied');
select pg_temp.check110(public.admin_set_duo_level('ae110000-0000-4000-8000-000000000001','plus_only')#>>'{error,code}'='403','customer duo mutation denied');
do $$ begin
 begin perform public.performance_role_targets(); raise exception 'browser read sync targets'; exception when insufficient_privilege then null; end;
 begin perform public.performance_set_sync('[]'); raise exception 'browser ack sync'; exception when insufficient_privilege then null; end;
end $$;
reset role;
update public.account_roles set role='admin' where user_id='ae110000-0000-4000-8000-000000000005';
set local role authenticated;
select pg_temp.login110('ae110000-0000-4000-8000-000000000005');
select pg_temp.check110(public.admin_set_performance_settings(45,35,21,90,2,2,2)#>>'{error,code}'='400','admin invalid weights rejected');
select pg_temp.check110(public.admin_set_performance_settings(45,35,20,90,2,2,2)->'settings' is not null,'admin valid settings accepted');
select pg_temp.check110(public.admin_performance_recalculate()->>'run' is not null,'admin recalculation accepted');
select pg_temp.check110(public.admin_performance()->'contractors' is not null,'admin ranking readable');
select pg_temp.check110(public.admin_performance_history('ae110000-0000-4000-8000-000000000001')->'history' is not null,'admin history readable');
select pg_temp.check110(public.admin_set_duo_level('ae110000-0000-4000-8000-000000000001','plus_only')->>'level'='plus_only','admin tier update works');
select pg_temp.check110(public.admin_set_duo_level('ae110000-0000-4000-8000-000000000001','standard')->>'level'='standard','admin tier restore works');
reset role;

-- Duo tier helper plus real order eligibility retain game access and customer pick windows.
do $$ declare o public.orders; a public.teammate_order_access; queued timestamptz:=clock_timestamp(); begin
 select * into a from public.teammate_order_access where user_id='ae110000-0000-4000-8000-000000000001';
 select * into o from public.orders where id='ae110001-0000-4000-8000-000000000001';
 o.gg:=false; o.game:='lol'; o.service:='duo3'; o.queued_at:=queued;
 perform pg_temp.check110(public.order_tier_open_at(o,a)=queued+interval '100 seconds','Apex standard delay');
 a.duo_level:='plus_only';
 perform pg_temp.check110(public.order_tier_open_at(o,a) is null,'Plus only denied Apex');
 o.service:='duo2'; perform pg_temp.check110(public.order_tier_open_at(o,a) is null,'Plus only denied Pro');
 o.service:='vod'; perform pg_temp.check110(public.order_tier_open_at(o,a) is null,'Plus only denied coaching');
 o.service:='duo1'; perform pg_temp.check110(public.order_tier_open_at(o,a)=queued,'Plus only allowed Plus');
 o.gg:=true; o.service:='chat'; perform pg_temp.check110(public.order_tier_open_at(o,a)=queued,'GG not tier restricted');
 a.duo_level:='standard'; o.gg:=false; o.service:='duo3';
 update public.performance_scores set bracket=5 where teammate_id=a.user_id;
 perform pg_temp.check110(public.order_tier_open_at(o,a)=queued,'TOP 5 immediate Apex');
 update public.performance_scores set bracket=50 where teammate_id=a.user_id;
 update public.orders set game='lol',gg=false,service='duo3',queued_at=queued where id=o.id;
 select * into o from public.orders where id=o.id;
 insert into public.order_teammate_picks(order_id,customer_id,teammate_id,source_order_id,queue_key,window_ends_at)
 values(o.id,o.customer_id,a.user_id,(select id from public.orders where assigned_teammate_id=a.user_id limit 1),queued,queued+interval '60 seconds');
 perform pg_temp.check110(public.order_tier_open_at(o,a)=queued,'Diamond pick bypasses Apex delay');
 perform pg_temp.check110(public.order_public_queued_at(o)>queued,'existing pick reservation retained');
 perform pg_temp.check110(public.order_eligible(o,a.user_id),'picked standard teammate can claim Apex');
 perform pg_temp.check110(not public.order_eligible(o,'ae110000-0000-4000-8000-000000000002'),'pick reservation excludes another standard teammate');
 update public.teammate_order_access set duo_level='plus_only' where user_id=a.user_id;
 perform pg_temp.check110(not public.order_eligible(o,a.user_id),'actual eligibility denies picked Plus only Apex');
 update public.orders set service='duo2' where id=o.id;
 select * into o from public.orders where id=o.id;
 perform pg_temp.check110(not public.order_eligible(o,a.user_id),'actual eligibility denies Plus only Pro');
 update public.orders set service='duo1' where id=o.id;
 select * into o from public.orders where id=o.id;
 perform pg_temp.check110(public.order_eligible(o,a.user_id),'actual eligibility allows Plus only Plus');
 update public.teammate_order_access set suspended=true where user_id=a.user_id;
 perform pg_temp.check110(not public.order_eligible(o,a.user_id),'tier never bypasses suspension');
 update public.teammate_order_access set suspended=false,duo_level='standard' where user_id=a.user_id;
 a.duo_level:='plus_only'; perform pg_temp.check110(public.order_tier_open_at(o,a)=queued,'Plus only still accepts Plus with pick');
 o.service:='duo3'; perform pg_temp.check110(public.order_tier_open_at(o,a) is null,'pick cannot bypass Plus only');
end $$;

-- Canonical identity lifecycle, failed cleanup retry, snapshot acknowledgements and ABA relinks.
insert into public.discord_accounts(user_id,discord_id) values('ae110000-0000-4000-8000-000000000001','911000000000000001');
do $$ declare snap jsonb; fresh jsonb; old_cleanup jsonb; u uuid:='ae110000-0000-4000-8000-000000000001'; begin
 select x into snap from jsonb_array_elements(public.performance_role_targets()) x where x->>'userId'=u::text;
 perform public.performance_set_sync(jsonb_build_array(snap||jsonb_build_object('status','synced','applied',true,'cleaned','[]'::jsonb)));
 perform pg_temp.check110(exists(select 1 from public.performance_role_identities where teammate_id=u and discord_id='911000000000000001'),'success persists applied identity');
 delete from public.discord_accounts where user_id=u;
 select x into fresh from jsonb_array_elements(public.performance_role_targets()) x where x->>'userId'=u::text;
 perform pg_temp.check110(fresh->'discordId'='null'::jsonb and jsonb_array_length(fresh->'cleanup')=1,'unlink returns former identity');
 perform public.performance_set_sync(jsonb_build_array(fresh||jsonb_build_object('status','error','applied',false,'cleaned','[]'::jsonb)));
 select x into fresh from jsonb_array_elements(public.performance_role_targets()) x where x->>'userId'=u::text;
 perform pg_temp.check110(jsonb_array_length(fresh->'cleanup')=1,'failed cleanup retained for retry');
 insert into public.discord_accounts(user_id,discord_id) values(u,'922000000000000002');
 select x into fresh from jsonb_array_elements(public.performance_role_targets()) x where x->>'userId'=u::text;
 old_cleanup:=fresh->'cleanup';
 perform public.performance_set_sync(jsonb_build_array(snap||jsonb_build_object('status','synced','applied',true,'cleaned','[]'::jsonb)));
 perform pg_temp.check110((select status='pending' from public.performance_discord where teammate_id=u),'stale assignment cannot overwrite new identity');
 perform public.performance_set_sync(jsonb_build_array(fresh||jsonb_build_object('status','synced','applied',true,'cleaned',old_cleanup)));
 perform pg_temp.check110(exists(select 1 from public.performance_role_identities where teammate_id=u and discord_id='911000000000000001' and cleaned_at is not null),'cleanup acknowledged without forgetting identity');
 -- A late PUT ack after cleanup must restore the former identity as a retry target.
 perform public.performance_set_sync(jsonb_build_array(snap||jsonb_build_object('status','synced','applied',true,'cleaned','[]'::jsonb)));
 perform pg_temp.check110(exists(select 1 from public.performance_role_identities where teammate_id=u and discord_id='911000000000000001' and cleaned_at is null),'late applied identity not lost');
 update public.discord_accounts set discord_id='911000000000000001' where user_id=u;
 perform public.performance_role_targets();
 update public.discord_accounts set discord_id='922000000000000002' where user_id=u;
 perform public.performance_set_sync(jsonb_build_array(fresh||jsonb_build_object('status','synced','applied',true,'cleaned',old_cleanup)));
 perform pg_temp.check110(exists(select 1 from public.performance_role_identities where teammate_id=u and discord_id='911000000000000001' and cleaned_at is null),'ABA stale cleanup cannot acknowledge new generation');
 select x into fresh from jsonb_array_elements(public.performance_role_targets()) x where x->>'userId'=u::text;
 update public.performance_discord set bracket=25,status='pending',updated_at=clock_timestamp() where teammate_id=u;
 perform public.performance_set_sync(jsonb_build_array(fresh||jsonb_build_object('status','synced','applied',true,'cleaned','[]'::jsonb)));
 perform pg_temp.check110((select bracket=25 and status='pending' from public.performance_discord where teammate_id=u),'stale ranking cannot overwrite newer desired state');
 delete from public.discord_accounts where user_id=u;
 select x into fresh from jsonb_array_elements(public.performance_role_targets()) x where x->>'userId'=u::text;
 perform public.performance_set_sync(jsonb_build_array(fresh||jsonb_build_object('status','no_discord','applied',false,'cleaned',fresh->'cleanup')));
 perform pg_temp.check110(not exists(select 1 from public.performance_role_identities where teammate_id=u and cleaned_at is null),'successful unlink cleanup acknowledged for all targets');
 select x into fresh from jsonb_array_elements(public.performance_role_targets()) x where x->>'userId'=u::text;
 perform pg_temp.check110(jsonb_array_length(fresh->'cleanup')=2,'retired identities remain auditable after interrupted stale writes');
end $$;
select pg_temp.check110(not has_table_privilege('authenticated','public.performance_role_identities','SELECT')
 and not has_table_privilege('service_role','public.performance_role_identities','INSERT'),'identity ledger is RPC only');
select 'pr110: all checks passed (five migrations, rollback only)' as result;
rollback;
