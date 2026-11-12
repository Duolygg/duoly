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

-- 20261112130000_public_profiles_default_on.sql: profiles on by default, the backfill and its slug
-- rules, the access trigger, the new indexing rule and booking with a named teammate.

begin;
create temp table assertions(label text);
create function pg_temp.ok(ok boolean,label text) returns void language plpgsql security definer as $$ begin if ok is distinct from true then raise exception 'default on: %',label; end if; insert into pg_temp.assertions values(label); end $$;
create function pg_temp.login(actor uuid) returns void language plpgsql as $$ begin perform pg_catalog.set_config('request.jwt.claim.sub',actor::text,true); perform pg_catalog.set_config('request.jwt.claims',pg_catalog.jsonb_build_object('role','authenticated','sub',actor)::text,true); end $$;
create function pg_temp.make_earning(t uuid,c uuid,age interval) returns uuid language plpgsql as $$
declare o uuid:=pg_catalog.gen_random_uuid(); a uuid:=pg_catalog.gen_random_uuid(); i uuid:=pg_catalog.gen_random_uuid(); n timestamptz:=pg_catalog.clock_timestamp()-age;
begin
 insert into public.orders(id,customer_id,game,service,title,units,unit,region,ign,customer_name,amount_eur_cents,booking_fx,payout_usd_cents,created_at,queued_at)
 values(o,c,'lol','duo','Default on fixture',1,'game','EUW','Fixture','Customer',999,1.08,100,n,n);
 insert into public.order_assignments(id,order_id,teammate_id,accepted_at,ended_at,end_reason) values(a,o,t,n,n,'completed');
 update public.orders set status='completed',assigned_teammate_id=t,current_assignment_id=a,accepted_at=n,completed_at=n where id=o;
 insert into public.checkout_intents(id,customer_id,game,service,title,units,unit,region,ign,amount_eur_cents,payout_usd_cents,booking_fx,expires_at)
 values(i,c,'lol','duo','Default on fixture',1,'game','EUW','Fixture',999,100,1.08,n+interval '1 hour');
 insert into public.order_payments(order_id,intent_id,stripe_payment_intent_id,amount_minor,currency,amount_eur_cents,payment_method_type,state,settle)
 values(o,i,'pi_dflt'||pg_catalog.replace(i::text,'-',''),999,'eur',999,'card','captured','none');
 insert into public.teammate_earning_entries(order_id,assignment_id,teammate_id,request_id,proof_ids,completed_at,prior_completed_count,trust_tier,payout_usd_cents,deposit_percent,held_usd_cents,net_usd_cents,source_snapshot,result)
 values(o,a,t,pg_catalog.gen_random_uuid(),array[pg_catalog.gen_random_uuid()],n,0,'rookie',100,10,10,90,'{}','{}');
 return o;
end $$;

insert into auth.users(id,aud,role,email,raw_user_meta_data,raw_app_meta_data) values
 ('9f100000-0000-4000-8000-000000000001','authenticated','authenticated','dflt-one@example.invalid','{}','{}'),
 ('9f100000-0000-4000-8000-000000000002','authenticated','authenticated','dflt-two@example.invalid','{}','{}'),
 ('9f100000-0000-4000-8000-000000000003','authenticated','authenticated','dflt-three@example.invalid','{}','{}'),
 ('9f100000-0000-4000-8000-000000000004','authenticated','authenticated','dflt-four@example.invalid','{}','{}'),
 ('9f100000-0000-4000-8000-000000000005','authenticated','authenticated','dflt-five@example.invalid','{}','{}'),
 ('9f100000-0000-4000-8000-000000000006','authenticated','authenticated','dflt-six@example.invalid','{}','{}'),
 ('9f100000-0000-4000-8000-000000000007','authenticated','authenticated','dflt-seven@example.invalid','{}','{}'),
 ('9f100000-0000-4000-8000-000000000008','authenticated','authenticated','dflt-eight@example.invalid','{}','{}'),
 ('9f100000-0000-4000-8000-00000000000c','authenticated','authenticated','dflt-customer@example.invalid','{}','{}'),
 ('9f100000-0000-4000-8000-00000000000a','authenticated','authenticated','dflt-admin@example.invalid','{}','{}');
update public.account_roles set role='teammate' where user_id in (
 '9f100000-0000-4000-8000-000000000001','9f100000-0000-4000-8000-000000000002','9f100000-0000-4000-8000-000000000003',
 '9f100000-0000-4000-8000-000000000004','9f100000-0000-4000-8000-000000000005','9f100000-0000-4000-8000-000000000006',
 '9f100000-0000-4000-8000-000000000007','9f100000-0000-4000-8000-000000000008');
update public.account_roles set role='admin',owner=true where user_id='9f100000-0000-4000-8000-00000000000a';
-- Two teammates share a display name, one is called after a reserved word, one writes in a script
-- the slug rules cannot carry, one is longer than a slug, one has no approved games at all.
update public.profiles set name='Nyx Backfill' where id='9f100000-0000-4000-8000-000000000001';
update public.profiles set name='Nyx Backfill' where id='9f100000-0000-4000-8000-000000000002';
update public.profiles set name='Admin' where id='9f100000-0000-4000-8000-000000000003';
update public.profiles set name='日本語' where id='9f100000-0000-4000-8000-000000000004';
update public.profiles set name='Averyveryverylongteammatename' where id='9f100000-0000-4000-8000-000000000005';
update public.profiles set name='Zoë Café' where id='9f100000-0000-4000-8000-000000000006';
update public.profiles set name='Trigger Teammate' where id='9f100000-0000-4000-8000-000000000007';
update public.profiles set name='Featured Fallback' where id='9f100000-0000-4000-8000-000000000008';

select pg_temp.ok((select public_profile_notice_at from public.teammate_public_profile_settings where singleton) is not null,'review notice cutoff set at apply time');

-- ---- slug rules ---------------------------------------------------------------------------
select pg_temp.ok(public.teammate_public_slug_base('Nyx Backfill')='nyx-backfill','slug base from a display name');
select pg_temp.ok(public.teammate_public_slug_base('Zoë Café')='zoe-cafe','slug base folds Latin accents');
select pg_temp.ok(public.teammate_public_slug_base('  --Nyx!!  ')='nyx','slug base trims and collapses');
select pg_temp.ok(public.teammate_public_slug_base('日本語')='','slug base drops unusable scripts');
select pg_temp.ok(public.teammate_public_slug_base('Averyveryverylongteammatename')='averyveryverylongteammat','slug base caps at 24');
select pg_temp.ok(public.teammate_public_slug_valid(public.teammate_public_slug_base('Zoë Café')),'folded base is a valid slug');

-- ---- backfill -----------------------------------------------------------------------------
-- The trigger would create these pages one insert at a time, so it steps aside while the same
-- loop the migration runs is replayed over exactly these teammates.
alter table public.teammate_order_access disable trigger teammate_public_profile_access_changed;
insert into public.teammate_order_access(user_id,approved_games) values
 ('9f100000-0000-4000-8000-000000000001',array['lol','val']),
 ('9f100000-0000-4000-8000-000000000002',array['tft']),
 ('9f100000-0000-4000-8000-000000000003',array['mc']),
 ('9f100000-0000-4000-8000-000000000004',array['cs2']),
 ('9f100000-0000-4000-8000-000000000005',array['wow']),
 ('9f100000-0000-4000-8000-000000000006',array['pu']);
-- A slug another teammate retired today is out of reach for 90 days, so the name has to fall back.
insert into public.teammate_public_slug_history(slug,user_id) values('zoe-cafe','9f100000-0000-4000-8000-000000000001');
select pg_temp.ok(not exists(select 1 from public.teammate_public_profiles where user_id::text like '9f100000%'),'no pages before the backfill');
do $backfill$
declare r record; v_slug text;
begin
  for r in select a.user_id, a.approved_games from public.teammate_order_access a
    where pg_catalog.cardinality(a.approved_games) > 0
      and public.teammate_public_active(a.user_id)
      and not exists(select 1 from public.teammate_public_profiles p where p.user_id = a.user_id)
      and a.user_id::text like '9f100000%'
    order by a.user_id
  loop
    v_slug := public.teammate_public_slug_pick(r.user_id);
    if v_slug is not null then
      insert into public.teammate_public_profiles(user_id, slug, published, published_at, featured_game)
        values (r.user_id, v_slug, true, pg_catalog.clock_timestamp(), public.teammate_public_featured_pick(r.approved_games))
        on conflict (user_id) do nothing;
    end if;
  end loop;
end $backfill$;
alter table public.teammate_order_access enable trigger teammate_public_profile_access_changed;

select pg_temp.ok((select pg_catalog.count(*) from public.teammate_public_profiles where user_id::text like '9f100000%')=6,'every approved teammate got a page');
select pg_temp.ok((select slug from public.teammate_public_profiles where user_id='9f100000-0000-4000-8000-000000000001')='nyx-backfill','slug from the display name');
select pg_temp.ok((select slug from public.teammate_public_profiles where user_id='9f100000-0000-4000-8000-000000000002')='nyx-backfill-2','the second of the same name appends -2');
select pg_temp.ok((select slug from public.teammate_public_profiles where user_id='9f100000-0000-4000-8000-000000000003')='admin-2','a reserved name appends -2');
select pg_temp.ok((select slug from public.teammate_public_profiles where user_id='9f100000-0000-4000-8000-000000000004') ~ '^teammate-[0-9a-f]{8}$','an unusable name falls back to a stable hash');
select pg_temp.ok((select slug from public.teammate_public_profiles where user_id='9f100000-0000-4000-8000-000000000005')='averyveryverylongteammat','a long name is cut to 24 characters');
select pg_temp.ok((select slug from public.teammate_public_profiles where user_id='9f100000-0000-4000-8000-000000000006')='zoe-cafe-2','a slug retired inside 90 days is skipped');
select pg_temp.ok(not exists(select 1 from public.teammate_public_profiles where user_id::text like '9f100000%' and not public.teammate_public_slug_valid(slug)),'every backfilled slug matches the contract pattern');
select pg_temp.ok((select pg_catalog.count(*) from public.teammate_public_profiles where user_id::text like '9f100000%' and published)=6,'backfilled pages are published');
select pg_temp.ok((select featured_game from public.teammate_public_profiles where user_id='9f100000-0000-4000-8000-000000000001')='lol','featured game is the first approved game');
select pg_temp.ok((select pg_catalog.count(*) from public.teammate_public_profiles p where p.user_id::text like '9f100000%' and p.accent='lavender' and p.banner='slash')=6,'accent and banner keep their defaults');
select pg_temp.ok(public.public_teammate_profile('nyx-backfill')->>'slug'='nyx-backfill','a backfilled page is readable');

-- ---- published default --------------------------------------------------------------------
select pg_temp.ok((select pg_catalog.pg_get_expr(d.adbin,d.adrelid) from pg_catalog.pg_attrdef d
  join pg_catalog.pg_attribute a on a.attrelid=d.adrelid and a.attnum=d.adnum
  where d.adrelid='public.teammate_public_profiles'::regclass and a.attname='published')='true','published defaults to true');

-- ---- the access trigger -------------------------------------------------------------------
insert into public.teammate_order_access(user_id,approved_games) values('9f100000-0000-4000-8000-000000000007','{}');
select pg_temp.ok(not exists(select 1 from public.teammate_public_profiles where user_id='9f100000-0000-4000-8000-000000000007'),'no approved game means no page');
update public.teammate_order_access set approved_games=array['tft','lol'] where user_id='9f100000-0000-4000-8000-000000000007';
select pg_temp.ok((select slug from public.teammate_public_profiles where user_id='9f100000-0000-4000-8000-000000000007')='trigger-teammate','the first approved game creates the page');
select pg_temp.ok((select published and featured_game='tft' from public.teammate_public_profiles where user_id='9f100000-0000-4000-8000-000000000007'),'the new page is published on its first game');
update public.teammate_order_access set approved_games=array['tft','lol','val'] where user_id='9f100000-0000-4000-8000-000000000007';
select pg_temp.ok((select featured_game='tft' from public.teammate_public_profiles where user_id='9f100000-0000-4000-8000-000000000007'),'a later game does not move the featured game');

insert into public.teammate_order_access(user_id,approved_games) values('9f100000-0000-4000-8000-000000000008',array['lol','val']);
select pg_temp.ok((select featured_game='lol' and published from public.teammate_public_profiles where user_id='9f100000-0000-4000-8000-000000000008'),'page created on insert with games');
set local role authenticated;
select pg_temp.login('9f100000-0000-4000-8000-00000000000a');
select pg_temp.ok(public.admin_set_game_rank('9f100000-0000-4000-8000-000000000008','lol','Challenger')->>'ok'='true','admin verifies a rank');
reset role;
update public.teammate_order_access set approved_games=array['val'] where user_id='9f100000-0000-4000-8000-000000000008';
select pg_temp.ok((select featured_game='val' and published from public.teammate_public_profiles where user_id='9f100000-0000-4000-8000-000000000008'),'losing the featured game moves it to the first remaining one');
select pg_temp.ok(exists(select 1 from public.teammate_game_ranks where user_id='9f100000-0000-4000-8000-000000000008' and game='lol' and verified_at is not null),'a rank for a removed game is kept');
select pg_temp.ok(not exists(select 1 from pg_catalog.jsonb_array_elements(public.public_teammate_profile(
  (select slug from public.teammate_public_profiles where user_id='9f100000-0000-4000-8000-000000000008'))->'games') g where g->>'game'='lol'),'a rank for a removed game is not shown');
update public.teammate_order_access set approved_games='{}' where user_id='9f100000-0000-4000-8000-000000000008';
select pg_temp.ok((select not published from public.teammate_public_profiles where user_id='9f100000-0000-4000-8000-000000000008'),'losing every game unpublishes the page');
select pg_temp.ok((select slug from public.teammate_public_profiles where user_id='9f100000-0000-4000-8000-000000000008')='featured-fallback','the slug survives an unpublish');
select pg_temp.ok(public.public_teammate_profile('featured-fallback')->>'status'='gone','the unpublished page is gone');
update public.teammate_order_access set approved_games=array['val'] where user_id='9f100000-0000-4000-8000-000000000008';
select pg_temp.ok((select not published and featured_game='val' from public.teammate_public_profiles where user_id='9f100000-0000-4000-8000-000000000008'),'coming back does not republish behind the teammate');

-- The featured game is still enforced on a write, now by a trigger instead of a row check.
do $$ begin
 begin update public.teammate_public_profiles set featured_game='cod' where user_id='9f100000-0000-4000-8000-000000000001';
  raise exception 'unapproved featured game accepted';
 exception when check_violation then perform pg_temp.ok(true,'featured game must stay approved'); end;
end $$;

-- ---- the new indexing rule ----------------------------------------------------------------
-- Production today: no reviews, no completed sessions, no verified ranks. A real bio has to be
-- enough on its own, and nothing else may slip through.
update public.profiles set bio='Short bio.' where id in ('9f100000-0000-4000-8000-000000000001','9f100000-0000-4000-8000-000000000002');
select pg_temp.ok(not exists(select 1 from pg_catalog.jsonb_array_elements(public.public_teammate_indexable()) v where v->>'slug' in ('nyx-backfill','nyx-backfill-2')),'short bio, no rank and no sessions stays noindex');
update public.profiles set bio='Calm comms and patient jungle pathing. Happy to explain objective setups between games.' where id='9f100000-0000-4000-8000-000000000001';
select pg_temp.ok(exists(select 1 from pg_catalog.jsonb_array_elements(public.public_teammate_indexable()) v where v->>'slug'='nyx-backfill'),'a bio of 60 or more characters qualifies on its own');
set local role authenticated;
select pg_temp.login('9f100000-0000-4000-8000-00000000000a');
select pg_temp.ok(public.admin_set_game_rank('9f100000-0000-4000-8000-000000000002','tft','Diamond')->>'ok'='true','admin verifies the second rank');
reset role;
select pg_temp.ok(exists(select 1 from pg_catalog.jsonb_array_elements(public.public_teammate_indexable()) v where v->>'slug'='nyx-backfill-2'),'a verified rank qualifies with a short bio');
do $$ begin for i in 1..5 loop perform pg_temp.make_earning('9f100000-0000-4000-8000-000000000003','9f100000-0000-4000-8000-00000000000c',interval '1 day'); end loop; end $$;
select pg_temp.ok(public.payout_valid_count('9f100000-0000-4000-8000-000000000003')=5,'five completed sessions counted');
select pg_temp.ok(exists(select 1 from pg_catalog.jsonb_array_elements(public.public_teammate_indexable()) v where v->>'slug'='admin-2'),'five sessions qualify with a short bio');
select pg_temp.ok(not exists(select 1 from pg_catalog.jsonb_array_elements(public.public_teammate_indexable()) v
  where v->>'slug' in ('averyveryverylongteammat','zoe-cafe-2') or v->>'slug' ~ '^teammate-[0-9a-f]{8}$'),'thin pages stay out of the sitemap');
set local role authenticated;
select pg_temp.login('9f100000-0000-4000-8000-00000000000a');
select pg_temp.ok(public.admin_hide_public_profile('nyx-backfill',true,'Moderation')->>'ok'='true','admin hides a qualifying page');
reset role;
select pg_temp.ok(not exists(select 1 from pg_catalog.jsonb_array_elements(public.public_teammate_indexable()) v where v->>'slug'='nyx-backfill'),'a hidden page is never indexable');
set local role authenticated;
select pg_temp.login('9f100000-0000-4000-8000-00000000000a');
select pg_temp.ok(public.admin_hide_public_profile('nyx-backfill',false,'Reviewed')->>'ok'='true','admin restores the page');
reset role;
update public.teammate_order_access set suspended=true where user_id='9f100000-0000-4000-8000-000000000001';
select pg_temp.ok(not exists(select 1 from pg_catalog.jsonb_array_elements(public.public_teammate_indexable()) v where v->>'slug'='nyx-backfill'),'a suspended teammate is never indexable');
update public.teammate_order_access set suspended=false where user_id='9f100000-0000-4000-8000-000000000001';

-- ---- booking with a named teammate --------------------------------------------------------
set local role authenticated;
select pg_temp.login('9f100000-0000-4000-8000-000000000001');
select pg_temp.ok(public.customer_favorite_add_by_slug('nyx-backfill-2')#>>'{error,code}'='403','a teammate cannot use the customer path');
select pg_temp.login('9f100000-0000-4000-8000-00000000000c');
select pg_temp.ok(public.customer_favorite_add_by_slug('no-such-slug')#>>'{error,code}'='404','unknown slug refused');
select pg_temp.ok(public.customer_favorite_add_by_slug('featured-fallback')#>>'{error,code}'='404','an unpublished page cannot be booked');
select pg_temp.ok(public.customer_favorite_add_by_slug('nyx-backfill')->>'favorite'='true','a customer saves a teammate by slug');
select pg_temp.ok(public.customer_favorite_add_by_slug('nyx-backfill')->>'favorite'='true','saving twice is harmless');
select pg_temp.ok(public.customer_favorite_add_by_slug('nyx-backfill')->>'game'='lol','the answer names the game to book');
reset role;
select pg_temp.ok((select pg_catalog.count(*) from public.customer_favorites where customer_id='9f100000-0000-4000-8000-00000000000c' and teammate_id='9f100000-0000-4000-8000-000000000001')=1,'exactly one favorite row');
select pg_temp.ok(not exists(select 1 from public.customer_favorites f join public.orders o on o.customer_id=f.customer_id and o.assigned_teammate_id=f.teammate_id where f.customer_id='9f100000-0000-4000-8000-00000000000c' and f.teammate_id='9f100000-0000-4000-8000-000000000001'),'no source order was needed');
-- The promise on the profile: a favorite sees the order the moment it queues, everybody else waits.
do $$
declare o public.orders; fav public.teammate_order_access; other public.teammate_order_access; n timestamptz:=pg_catalog.clock_timestamp();
begin
 insert into public.orders(id,customer_id,game,service,title,units,unit,region,ign,customer_name,amount_eur_cents,booking_fx,payout_usd_cents,created_at,queued_at)
  values(pg_catalog.gen_random_uuid(),'9f100000-0000-4000-8000-00000000000c','lol','duo','Queue fixture',1,'game','EUW','Fixture','Customer',999,1.08,100,n,n) returning * into o;
 select * into fav from public.teammate_order_access where user_id='9f100000-0000-4000-8000-000000000001';
 select * into other from public.teammate_order_access where user_id='9f100000-0000-4000-8000-000000000002';
 perform pg_temp.ok(public.order_visible_at(o,fav,n)=o.queued_at,'a favorite sees the order the moment it queues');
 perform pg_temp.ok(public.order_visible_at(o,other,n)>o.queued_at,'everyone else still waits out their delay');
end $$;

select count(*) as default_on_assertions_passed from assertions;
rollback;
