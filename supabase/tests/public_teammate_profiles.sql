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


begin;
create temp table assertions(label text);
create function pg_temp.ok(ok boolean,label text) returns void language plpgsql security definer as $$ begin if ok is distinct from true then raise exception 'public profile: %',label; end if; insert into pg_temp.assertions values(label); end $$;
create function pg_temp.login(actor uuid) returns void language plpgsql as $$ begin perform pg_catalog.set_config('request.jwt.claim.sub',actor::text,true); perform pg_catalog.set_config('request.jwt.claims',pg_catalog.jsonb_build_object('role','authenticated','sub',actor)::text,true); end $$;
create function pg_temp.make_earning(t uuid,c uuid,age interval,payment_state text default 'captured') returns uuid language plpgsql as $$
declare o uuid:=pg_catalog.gen_random_uuid(); a uuid:=pg_catalog.gen_random_uuid(); i uuid:=pg_catalog.gen_random_uuid(); n timestamptz:=pg_catalog.clock_timestamp()-age; held integer:=10;
begin
 insert into public.orders(id,customer_id,game,service,title,units,unit,region,ign,customer_name,amount_eur_cents,booking_fx,payout_usd_cents,created_at,queued_at)
 values(o,c,'lol','duo','Trust fixture',1,'game','EUW','Fixture','Customer',999,1.08,100,n,n);
 insert into public.order_assignments(id,order_id,teammate_id,accepted_at,ended_at,end_reason) values(a,o,t,n,n,'completed');
 update public.orders set status='completed',assigned_teammate_id=t,current_assignment_id=a,accepted_at=n,completed_at=n where id=o;
 insert into public.checkout_intents(id,customer_id,game,service,title,units,unit,region,ign,amount_eur_cents,payout_usd_cents,booking_fx,expires_at)
 values(i,c,'lol','duo','Trust fixture',1,'game','EUW','Fixture',999,100,1.08,n+interval '1 hour');
 insert into public.order_payments(order_id,intent_id,stripe_payment_intent_id,amount_minor,currency,amount_eur_cents,payment_method_type,state,settle)
 values(o,i,'pi_trust'||pg_catalog.replace(i::text,'-',''),999,'eur',999,'card',payment_state,'none');
 insert into public.teammate_earning_entries(order_id,assignment_id,teammate_id,request_id,proof_ids,completed_at,prior_completed_count,trust_tier,payout_usd_cents,deposit_percent,held_usd_cents,net_usd_cents,source_snapshot,result)
 values(o,a,t,pg_catalog.gen_random_uuid(),array[pg_catalog.gen_random_uuid()],n,0,'rookie',100,10,held,90,'{}','{}');
 return o;
end $$;
insert into auth.users(id,aud,role,email,raw_user_meta_data,raw_app_meta_data) values
 ('9f000000-0000-4000-8000-000000000001','authenticated','authenticated','public-one@example.invalid','{}','{}'),
 ('9f000000-0000-4000-8000-000000000002','authenticated','authenticated','public-two@example.invalid','{}','{}'),
 ('9f000000-0000-4000-8000-000000000003','authenticated','authenticated','public-customer@example.invalid','{}','{}'),
 ('9f000000-0000-4000-8000-000000000004','authenticated','authenticated','public-admin@example.invalid','{}','{}');
update public.account_roles set role='teammate' where user_id in ('9f000000-0000-4000-8000-000000000001','9f000000-0000-4000-8000-000000000002');
update public.account_roles set role='admin',owner=true where user_id='9f000000-0000-4000-8000-000000000004';
update public.profiles set name='Nyx PrivateSurname',country='at',bio='Calm calls and patient jungle pathing. Happy to explain objective setups.' where id='9f000000-0000-4000-8000-000000000001';
insert into public.teammate_order_access(user_id,approved_games) values
 ('9f000000-0000-4000-8000-000000000001',array['lol','val']),('9f000000-0000-4000-8000-000000000002',array['lol']);
create temp table settings(value jsonb);
insert into settings values('{"published":false,"slug":"nyx","accent":"mint","banner":"slash","featuredGame":"lol","vibeTags":["Chill"],"showCountry":false,"coaching":false,"games":[{"game":"lol","roles":["Jungle"],"picks":["Ahri"]}]}');
grant select on settings to authenticated;
select pg_temp.ok(public.public_teammate_profile('unknown')->>'status'='missing','unknown slug missing');
set local role authenticated;
select pg_temp.login('9f000000-0000-4000-8000-000000000003');
select pg_temp.ok(public.teammate_public_profile_get()#>>'{error,code}'='403','customer settings denied');
select pg_temp.ok(public.teammate_public_profile_save((select value from settings))#>>'{error,code}'='403','customer save denied');
select pg_temp.login('9f000000-0000-4000-8000-000000000001');
select pg_temp.ok(public.teammate_public_profile_save((select value from settings))#>>'{settings,slug}'='nyx','teammate saves settings');
select pg_temp.ok(public.public_teammate_profile('nyx')->>'status'='gone','unpublished hidden');
-- 20261112130000 gives every approved teammate a page, so the second teammate in this
-- fixture now has one of their own. What is under test here is still the same thing:
-- the page this teammate switched off is in no list a visitor can read.
select pg_temp.ok(not exists(select 1 from pg_catalog.jsonb_array_elements(public.public_teammate_cards()) v
  where v->>'slug'='nyx'),'unpublished not in cards');
select pg_temp.ok(public.public_teammate_indexable() = '[]','unpublished not indexable');
do $$ declare s text; begin
 foreach s in array array['-bad','bad-','a--b','ABc','ab','too-long-slug-123456789012345','admin','api','duoly','support','help','teammates','teammate','login','signin','signup','settings','profile','staff','team','official','moderator','mod','null','undefined','new','edit'] loop
  perform pg_temp.ok(public.teammate_public_profile_save((select value from settings)||pg_catalog.jsonb_build_object('slug',s))#>>'{error,code}'='400','reject slug '||s);
 end loop;
end $$;
select pg_temp.ok(public.teammate_public_profile_save((select value from settings)||'{"featuredGame":"cs2"}')#>>'{error,code}'='400','featured game approval');
select pg_temp.ok(public.teammate_public_profile_save((select value from settings)||'{"accent":"red"}')#>>'{error,code}'='400','accent allowlist');
select pg_temp.ok(public.teammate_public_profile_save((select value from settings)||'{"banner":"photo"}')#>>'{error,code}'='400','banner allowlist');
select pg_temp.ok(public.teammate_public_profile_save((select value from settings)||'{"vibeTags":["fake"]}')#>>'{error,code}'='400','vibe allowlist');
select pg_temp.ok(public.teammate_public_profile_save((select value from settings)||'{"vibeTags":["Chill","Patient","Funny","Tryhard"]}')#>>'{error,code}'='400','vibe maximum');
select pg_temp.ok(public.teammate_public_profile_save((select value from settings)||'{"games":[{"game":"lol","roles":["a","b","c","d"],"picks":[]}]}')#>>'{error,code}'='400','roles maximum');
select pg_temp.ok(public.teammate_public_profile_save((select value from settings)||'{"games":[{"game":"lol","roles":[],"picks":["a","b","c","d","e","f"]}]}')#>>'{error,code}'='400','picks maximum');
select pg_temp.ok(public.teammate_public_profile_save((select value from settings)||'{"games":[{"game":"lol","roles":[],"picks":[],"rank":"Challenger"}]}')#>>'{error,code}'='400','rank injection denied');
select pg_temp.ok(public.teammate_public_profile_save((select value from settings)||'{"published":true}')#>>'{settings,published}'='true','publish');
-- 20261112130000 replaced the indexing rule: a verified rank is one of three ways to
-- qualify instead of the only one, because profiles are on by default now and an honest
-- page should not wait for a rank check only an admin can do. This teammate has a 73
-- character bio, so they qualify on that alone, before any rank exists.
select pg_temp.ok(pg_catalog.jsonb_array_length(public.public_teammate_indexable())=1,'a real bio qualifies on its own');
select pg_temp.ok(public.admin_set_game_rank('9f000000-0000-4000-8000-000000000001','lol','Challenger')#>>'{error,code}'='403','teammate cannot verify own rank');
select pg_temp.login('9f000000-0000-4000-8000-000000000004');
select pg_temp.ok(public.admin_set_game_rank('9f000000-0000-4000-8000-000000000001','lol','Radiant')#>>'{error,code}'='400','cross-game rank rejected');
select pg_temp.ok(public.admin_set_game_rank('9f000000-0000-4000-8000-000000000001','lol','Challenger','Master')->>'ok'='true','admin verifies rank');
select pg_temp.ok(pg_catalog.jsonb_array_length(public.public_teammate_indexable())=1,'long bio and rank qualify');
reset role;
update public.profiles set bio='Short bio.' where id='9f000000-0000-4000-8000-000000000001';
select pg_temp.ok(pg_catalog.jsonb_array_length(public.public_teammate_indexable())=1,'a verified rank carries a short bio');
-- Nothing left to point at: an unverified rank, a bio nobody wrote and no sessions. The
-- rank stays unverified from here, so the assertions below test the track record branch
-- of the rule instead of riding on a rank that already qualified.
update public.teammate_game_ranks set verified_at=null where user_id='9f000000-0000-4000-8000-000000000001';
select pg_temp.ok(public.public_teammate_indexable()='[]','short bio, unverified rank and no sessions noindex');

-- Four reviews and 19 reported games: both stats must be null. Default NULL cutoff hides all text.
do $$ declare o uuid; a uuid; begin
 for i in 1..4 loop
  o:=pg_temp.make_earning('9f000000-0000-4000-8000-000000000001','9f000000-0000-4000-8000-000000000003',interval '1 day');
  select current_assignment_id into a from public.orders where id=o;
  insert into public.order_reviews(order_id,assignment_id,customer_id,teammate_id,rating,text,tags,created_at)
   values(o,a,'9f000000-0000-4000-8000-000000000003','9f000000-0000-4000-8000-000000000001',5,'Private review text',array['Patient'],now()-interval '1 day');
  if i=1 then insert into public.order_match_reports(assignment_id,order_id,teammate_id,games,wins,losses)
   values(a,o,'9f000000-0000-4000-8000-000000000001',(select jsonb_agg('{}'::jsonb) from generate_series(1,19)),10,9); end if;
 end loop;
end $$;
select pg_temp.ok(public.public_teammate_profile('nyx')->'rating'='null','four reviews no rating');
select pg_temp.ok(public.public_teammate_profile('nyx')->'winRate'='null','19 games no winrate');
select pg_temp.ok(not exists(select 1 from jsonb_array_elements(public.public_teammate_profile('nyx')->'reviews') v where v->>'text'<>''),'null cutoff no review texts');
select pg_temp.ok(public.public_teammate_profile('nyx')#>>'{reviewTags,0,count}'='4','tags from old reviews');
select pg_temp.ok(public.public_teammate_profile('nyx')->>'sessions'='4','sessions from valid completed earnings');
select pg_temp.ok(public.public_teammate_indexable()='[]','four sessions and short bio noindex');
update public.teammate_public_profile_settings set public_profile_notice_at=now()-interval '1 hour';
do $$ declare o uuid; a uuid; begin
 for i in 1..3 loop
  o:=pg_temp.make_earning('9f000000-0000-4000-8000-000000000001','9f000000-0000-4000-8000-000000000003',interval '1 minute');
  select current_assignment_id into a from public.orders where id=o;
  insert into public.order_reviews(order_id,assignment_id,customer_id,teammate_id,rating,text,tags)
   values(o,a,'9f000000-0000-4000-8000-000000000003','9f000000-0000-4000-8000-000000000001',5,'Consented public review',array['Patient']);
  if i=1 then
   insert into public.order_match_reports(assignment_id,order_id,teammate_id,games,wins,losses) values(a,o,'9f000000-0000-4000-8000-000000000001','[{}]',1,0);
   perform pg_temp.ok(public.public_teammate_profile('nyx')#>>'{rating,count}'='5','five reviews rating shown');
   perform pg_temp.ok(public.public_teammate_profile('nyx')#>>'{winRate,games}'='20','20 games winrate shown');
   perform pg_temp.ok(pg_catalog.jsonb_array_length(public.public_teammate_indexable())=1,'five sessions qualify');
  end if;
 end loop;
end $$;
set local role anon;
select pg_temp.ok(public.public_teammate_profile('nyx')#>>'{reviews,0,text}'='Consented public review','newest consented text public');
select pg_temp.ok(jsonb_array_length(public.public_teammate_profile('nyx')->'reviews')=6,'six newest reviews only');
select pg_temp.ok(public.public_teammate_profile('nyx')#>>'{reviews,5,text}'='','old text remains private after cutoff');
select pg_temp.ok(public.public_teammate_profile('nyx')->'country'='null','country opt in required');
select pg_temp.ok(public.public_teammate_profile('nyx')->>'name'='Nyx','surname excluded');
select pg_temp.ok(not exists(select 1 from jsonb_object_keys(public.public_teammate_profile('nyx')) k where k not in ('slug','name','avatar','country','languages','bio','accent','banner','vibeTags','featuredGame','coaching','online','memberSince','sessions','tier','rating','reviewTags','winRate','games','reviews','updatedAt')),'exact profile whitelist');
select pg_temp.ok(public.public_teammate_profile('nyx')::text !~* '9f000000|example.invalid|PrivateSurname|Private review text','no identifiers or private data');
-- Every approved teammate has a page since 20261112130000, so this list is no longer
-- empty. The exclusion is still exactly what is under test: nyx is in the League list
-- and gone from the same list asked for nyx's own page.
select pg_temp.ok(exists(select 1 from jsonb_array_elements(public.public_teammate_cards('lol',6,null)) v where v->>'slug'='nyx')
  and not exists(select 1 from jsonb_array_elements(public.public_teammate_cards('lol',6,'nyx')) v where v->>'slug'='nyx'),'exclude current slug');
select pg_temp.ok(public.public_teammate_cards('cs2',6,null)='[]','filter game');
do $$ declare t text; begin
 foreach t in array array['teammate_public_profiles','teammate_public_slug_history','teammate_game_ranks','teammate_public_profile_settings'] loop
  begin execute format('select * from public.%I',t); raise exception 'anon selected %',t; exception when insufficient_privilege then perform pg_temp.ok(true,'anon table denied '||t); end;
 end loop;
end $$;
reset role;
set local role authenticated;
select pg_temp.login('9f000000-0000-4000-8000-000000000001');
select pg_temp.ok(public.teammate_public_profile_save((select value from settings)||'{"published":true,"slug":"nyx-new","showCountry":true}')#>>'{settings,slug}'='nyx-new','rename');
select pg_temp.ok(public.public_teammate_profile('nyx')->>'status'='moved' and public.public_teammate_profile('nyx')->>'slug'='nyx-new','old slug 301 target');
select pg_temp.ok(public.public_teammate_profile('nyx-new')->>'country'='at','country opt in');
select pg_temp.login('9f000000-0000-4000-8000-000000000002');
select pg_temp.ok(public.teammate_public_profile_save((select value from settings))#>>'{error,code}'='409','history claim blocked for 90 days');
select pg_temp.login('9f000000-0000-4000-8000-000000000004');
select pg_temp.ok(public.admin_hide_public_profile('nyx-new',true,'Moderation')->>'ok'='true','admin hide');
select pg_temp.ok(public.public_teammate_profile('nyx-new')->>'status'='gone','hidden gone');
select pg_temp.ok(public.public_teammate_profile('nyx')->>'status'='gone','hidden history gone');
select pg_temp.ok(public.public_teammate_indexable()='[]','hidden excluded from sitemap');
select pg_temp.ok(public.admin_hide_public_profile('nyx-new',false,'Reviewed')->>'ok'='true','admin restore');
reset role;
update public.teammate_order_access set suspended=true where user_id='9f000000-0000-4000-8000-000000000001';
select pg_temp.ok(public.public_teammate_profile('nyx-new')->>'status'='gone','suspended gone');
update public.teammate_order_access set suspended=false where user_id='9f000000-0000-4000-8000-000000000001';
update public.account_roles set role='customer' where user_id='9f000000-0000-4000-8000-000000000001';
select pg_temp.ok(public.public_teammate_profile('nyx-new')->>'status'='gone','non teammate gone');
update public.account_roles set role='teammate' where user_id='9f000000-0000-4000-8000-000000000001';
do $$ begin
 begin update public.profiles set bio='Contact me at https://example.invalid' where id='9f000000-0000-4000-8000-000000000001'; raise exception 'public bio link accepted'; exception when check_violation then perform pg_temp.ok(true,'public bio filter'); end;
end $$;
set local role authenticated;
select pg_temp.login('9f000000-0000-4000-8000-000000000001');
select pg_temp.ok(public.teammate_public_profile_save((select value from settings)||'{"slug":"nyx-new"}')#>>'{settings,published}'='false','unpublish');
select pg_temp.ok(public.public_teammate_profile('nyx-new')->>'status'='gone','unpublished gone immediately');
reset role;
select count(*) as public_profile_assertions_passed from assertions;
rollback;
