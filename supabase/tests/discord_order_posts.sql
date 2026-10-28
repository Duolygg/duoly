-- Rollback-only checks for 20261026140000_discord_order_posts.sql (ledger #41).
-- Run with the migration body prepended in one transaction; everything is rolled back.
begin;
insert into auth.users (id,aud,role,email,raw_user_meta_data,raw_app_meta_data)
select ('d4100000-0000-4000-8000-' || pg_catalog.lpad(n::text,12,'0'))::uuid,'authenticated','authenticated',
  'dposts-' || n || '@example.invalid','{}','{}'
from pg_catalog.generate_series(1,9) as n;
-- 1 admin, 2 and 4 to 8 customers, 9 a teammate the customer of D switched away from, 3 val teammate with verified Discord
update public.profiles set name = case right(id::text,1) when '3' then 'Kira Nova' else 'Posts ' || right(id::text,1) end
 where id::text like 'd4100000-0000-4000-8000-%';
update public.account_roles set role = case right(user_id::text,1) when '1' then 'admin' when '3' then 'teammate' when '9' then 'teammate' else 'customer' end
 where user_id::text like 'd4100000-0000-4000-8000-%';
insert into public.teammate_order_access(user_id,approved_games,gg_access,discord_id,discord_verified_at,suspended)
 values ('d4100000-0000-4000-8000-000000000003',array['val'],false,'99410000000000003',pg_catalog.clock_timestamp(),false),
        ('d4100000-0000-4000-8000-000000000009',array['val'],false,'99410000000000009',pg_catalog.clock_timestamp(),false);

-- A waited 2 min (due), B 30 s (too early), C 4m50s (link about to die), D for re-roll, E for a failed post
insert into public.orders(id,public_reference,customer_id,game,service,title,units,unit,rank,region,ign,note,voice,customer_name,customer_country,amount_eur_cents,booking_fx,payout_usd_cents,created_at,queued_at)
select ('d4200000-0000-4000-8000-00000000000' || n)::uuid, 'DL-99410' || n, ('d4100000-0000-4000-8000-00000000000' || (n + 3))::uuid,
  'val','duo','Duo Pro',3,'game','Gold 3','EU','Secret#EU','call me on 0664 123','true'::boolean,'Secret Customer','at',1999,1.08,1086,
  pg_catalog.clock_timestamp() - interval '10 minutes', pg_catalog.clock_timestamp() - case n when 1 then interval '2 minutes' when 2 then interval '30 seconds'
    when 3 then interval '290 seconds' else interval '150 seconds' end
from pg_catalog.generate_series(1,5) as n;
insert into public.checkout_intents(id,customer_id,status,game,service,title,units,unit,region,ign,amount_eur_cents,payout_usd_cents,booking_fx,order_id,expires_at)
select ('d4300000-0000-4000-8000-00000000000' || n)::uuid,('d4100000-0000-4000-8000-00000000000' || (n + 3))::uuid,'paid','val','duo','Duo Pro',3,'game','EU','Secret#EU',1999,1086,1.08,
  ('d4200000-0000-4000-8000-00000000000' || n)::uuid, pg_catalog.clock_timestamp() + interval '1 hour'
from pg_catalog.generate_series(1,5) as n;
insert into public.order_payments(order_id,intent_id,stripe_payment_intent_id,amount_minor,currency,amount_eur_cents,payment_method_type,state)
select ('d4200000-0000-4000-8000-00000000000' || n)::uuid, ('d4300000-0000-4000-8000-00000000000' || n)::uuid,
  'pi_dpostsfixture' || n, 1999,'eur',1999,'card','authorized'
from pg_catalog.generate_series(1,5) as n;

insert into public.order_assignments(order_id,teammate_id,accepted_at,ended_at,end_reason)
 values ('d4200000-0000-4000-8000-000000000004','d4100000-0000-4000-8000-000000000009',
  pg_catalog.clock_timestamp() - interval '9 minutes', pg_catalog.clock_timestamp() - interval '8 minutes','customer_reroll');

create temporary table dposts(k text primary key, v text) on commit drop;
grant all on dposts to authenticated;
savepoint fixture;

do $$
declare due jsonb; r jsonb; r2 jsonb; q timestamptz; n int;
begin
  due := public.discord_order_posts_due(100);
  if (select pg_catalog.array_agg(e->>'reference' order by e->>'reference') from pg_catalog.jsonb_array_elements(due) e)
     <> array['DL-994101','DL-994104','DL-994105'] then raise exception 'due set wrong: %', due; end if;
  -- public channel: nothing about the customer
  if due::text ~* '(secret|0664|customer|ign|note|country)' then raise exception 'post facts leak customer data: %', due; end if;
  if (due->0->>'payoutUsdCents')::int <> 1086 or due->0->>'rank' <> 'Gold 3' or not (due->0->>'voice')::boolean
     or due->0->>'cancelsAt' is null then raise exception 'post facts incomplete: %', due->0; end if;

  -- claim A once, never twice
  select o.queued_at into q from public.orders o where o.id = 'd4200000-0000-4000-8000-000000000001';
  r := public.discord_order_post_claim('d4200000-0000-4000-8000-000000000001', q, '1561391966049271968');
  if r is null or r->>'token' !~ '^[A-Za-z0-9_-]{24}$' then raise exception 'claim failed: %', r; end if;
  if public.discord_order_post_claim('d4200000-0000-4000-8000-000000000001', q, '1561391966049271968') is not null then
    raise exception 'claimed twice'; end if;
  if public.discord_order_post_claim('d4200000-0000-4000-8000-000000000001', q - interval '1 second', '1561391966049271968') is not null then
    raise exception 'claimed with a stale queue key'; end if;
  if public.discord_order_post_claim('d4200000-0000-4000-8000-000000000002', (select queued_at from public.orders where id='d4200000-0000-4000-8000-000000000002'), 'nope') is not null then
    raise exception 'bad channel id accepted'; end if;
  if exists (select 1 from pg_catalog.jsonb_array_elements(public.discord_order_posts_due(100)) e where e->>'reference' = 'DL-994101') then
    raise exception 'claimed order still due'; end if;
  if not exists (select 1 from public.order_handovers h where h.order_id = 'd4200000-0000-4000-8000-000000000001' and h.kind = 'bot'
     and h.created_by is null and h.created_by_name = 'Duoly bot' and h.revoked_at is null
     and h.token_hash = pg_catalog.encode(extensions.digest(r->>'token','sha256'),'hex')
     and h.expires_at = q + interval '5 minutes') then raise exception 'bot handover not stored as hash'; end if;
  if not public.discord_order_post_saved((r->>'post')::uuid, '1564984101792907334') then raise exception 'save failed'; end if;
  if public.discord_order_post_saved((r->>'post')::uuid, '1564984101792907335') then raise exception 'saved twice'; end if;
  if public.discord_order_posts_to_close() <> '[]'::jsonb then raise exception 'waiting order closed early'; end if;
  insert into dposts values ('a_token', r->>'token'), ('a_post', r->>'post');

  -- E: Discord refused, the reservation and its link go away and it is due again
  select o.queued_at into q from public.orders o where o.id = 'd4200000-0000-4000-8000-000000000005';
  r2 := public.discord_order_post_claim('d4200000-0000-4000-8000-000000000005', q, '1561391966049271968');
  if not public.discord_order_post_failed((r2->>'post')::uuid) then raise exception 'failed() refused'; end if;
  if exists (select 1 from public.order_handovers h where h.order_id = 'd4200000-0000-4000-8000-000000000005' and h.revoked_at is null) then
    raise exception 'failed post kept a live link'; end if;
  if not exists (select 1 from pg_catalog.jsonb_array_elements(public.discord_order_posts_due(100)) e where e->>'reference' = 'DL-994105') then
    raise exception 'failed post not retried'; end if;
  -- a reservation that never finished is retried after a minute, not before
  r2 := public.discord_order_post_claim('d4200000-0000-4000-8000-000000000005', q, '1561391966049271968');
  if exists (select 1 from pg_catalog.jsonb_array_elements(public.discord_order_posts_due(100)) e where e->>'reference' = 'DL-994105') then
    raise exception 'fresh reservation reposted'; end if;
  update public.discord_order_posts set created_at = created_at - interval '2 minutes' where id = (r2->>'post')::uuid;
  if not exists (select 1 from pg_catalog.jsonb_array_elements(public.discord_order_posts_due(100)) e where e->>'reference' = 'DL-994105') then
    raise exception 'stuck reservation never retried'; end if;
  if public.discord_order_post_claim('d4200000-0000-4000-8000-000000000005', q, '1561391966049271968') is null then
    raise exception 'stuck reservation blocks a new claim'; end if;

  -- D: posted, then re-rolled (new queue round): old post closes as rerolled
  select o.queued_at into q from public.orders o where o.id = 'd4200000-0000-4000-8000-000000000004';
  r2 := public.discord_order_post_claim('d4200000-0000-4000-8000-000000000004', q, '1561391966049271968');
  perform public.discord_order_post_saved((r2->>'post')::uuid, '1564984101792907336');
  update public.orders set queued_at = pg_catalog.clock_timestamp() where id = 'd4200000-0000-4000-8000-000000000004';
  r := public.discord_order_posts_to_close();
  if pg_catalog.jsonb_array_length(r) <> 1 or r->0->>'outcome' <> 'rerolled' or r->0->>'messageId' <> '1564984101792907336'
     or r->0->>'teammate' is not null then raise exception 'reroll close wrong: %', r; end if;
  if r::text ~* '(secret|0664)' then raise exception 'close payload leaks customer data'; end if;
  if exists (select 1 from public.order_handovers h where h.order_id = 'd4200000-0000-4000-8000-000000000004' and h.revoked_at is null) then
    raise exception 're-roll kept the bot link alive'; end if;
  if not public.discord_order_post_closed((r2->>'post')::uuid, 'rerolled') then raise exception 'close failed'; end if;
  if public.discord_order_post_closed((r2->>'post')::uuid, 'rerolled') then raise exception 'closed twice'; end if;
  if public.discord_order_post_closed((r->0->>'post')::uuid, 'bogus') then raise exception 'bogus outcome accepted'; end if;
  insert into dposts values ('d_post', r2->>'post');
  -- the new round of D gets a new bot link
  r2 := public.discord_order_post_claim('d4200000-0000-4000-8000-000000000004', (select queued_at from public.orders where id='d4200000-0000-4000-8000-000000000004'), '1561391966049271968');
  if r2 is null then raise exception 'new queue round not claimable'; end if;
  insert into dposts values ('d_token', r2->>'token');
end $$;

-- An admin link next to the bot link: both stay valid
set local role authenticated;
select pg_catalog.set_config('request.jwt.claims','{"role":"authenticated","sub":"d4100000-0000-4000-8000-000000000001"}',true);
select pg_catalog.set_config('request.jwt.claim.sub','d4100000-0000-4000-8000-000000000001',true);
do $$
declare r jsonb;
begin
  r := public.admin_create_handover('d4200000-0000-4000-8000-000000000001');
  if r ? 'error' then raise exception 'admin handover failed: %', r; end if;
  r := public.admin_create_handover('d4200000-0000-4000-8000-000000000001');
  if r ? 'error' then raise exception 'second admin handover failed: %', r; end if;
end $$;
reset role;
do $$
begin
  if (select count(*) from public.order_handovers h where h.order_id = 'd4200000-0000-4000-8000-000000000001' and h.revoked_at is null) <> 2
     or not exists (select 1 from public.order_handovers h where h.order_id = 'd4200000-0000-4000-8000-000000000001' and h.kind = 'bot' and h.revoked_at is null)
  then raise exception 'admin link replaced the bot link'; end if;
end $$;

-- The teammate takes A through the posted bot link
set local role authenticated;
select pg_catalog.set_config('request.jwt.claims','{"role":"authenticated","sub":"d4100000-0000-4000-8000-000000000003"}',true);
select pg_catalog.set_config('request.jwt.claim.sub','d4100000-0000-4000-8000-000000000003',true);
select pg_catalog.set_config('request.jwt.claim.sub','d4100000-0000-4000-8000-000000000009',true);
do $$
begin
  if (public.accept_handover(pg_catalog.encode(extensions.digest((select v from dposts where k = 'd_token'),'sha256'),'hex'))->'error'->>'code')::int <> 403 then
    raise exception 'bot link gave the order back to a re-rolled teammate'; end if;
end $$;
select pg_catalog.set_config('request.jwt.claim.sub','d4100000-0000-4000-8000-000000000003',true);
do $$
declare r jsonb;
begin
  r := public.accept_handover(pg_catalog.encode(extensions.digest((select v from dposts where k = 'a_token'),'sha256'),'hex'));
  if r ? 'error' then raise exception 'bot link not accepted: %', r; end if;
  -- a signed-in user can't call the bot functions
  begin perform public.discord_order_posts_due(100); raise exception 'authenticated read due posts';
  exception when insufficient_privilege then null; end;
  begin perform public.discord_order_post_claim('d4200000-0000-4000-8000-000000000002', pg_catalog.now(), '1561391966049271968'); raise exception 'authenticated claimed';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.discord_order_posts; raise exception 'authenticated read posts';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$
declare r jsonb;
begin
  r := public.discord_order_posts_to_close();
  if pg_catalog.jsonb_array_length(r) <> 1 or r->0->>'outcome' <> 'taken' or r->0->>'teammate' <> 'Kira'
     or (r->0->>'waitedMs')::bigint < 119000 or r->0->>'reference' <> 'DL-994101' then raise exception 'taken close wrong: %', r; end if;
  if exists (select 1 from public.order_handovers h where h.order_id = 'd4200000-0000-4000-8000-000000000001' and h.revoked_at is null) then
    raise exception 'accept left a link alive'; end if;
  perform public.discord_order_post_closed((r->0->>'post')::uuid, 'taken');
end $$;

-- Customer cancels and expiry: posted orders close with the right outcome
do $$
declare r jsonb; p1 jsonb; p2 jsonb;
begin
  p1 := public.discord_order_post_claim('d4200000-0000-4000-8000-000000000003', (select queued_at from public.orders where id='d4200000-0000-4000-8000-000000000003'), '1561391966049271968');
  if p1 is not null then raise exception 'order about to expire was claimed'; end if;
  p2 := public.discord_order_post_claim('d4200000-0000-4000-8000-000000000005', (select queued_at from public.orders where id='d4200000-0000-4000-8000-000000000005'), '1561391966049271968');
  -- E was claimed above (stuck retry); find that post and open it
  update public.discord_order_posts set state = 'open', message_id = '1564984101792907337'
   where order_id = 'd4200000-0000-4000-8000-000000000005' and state = 'posting';
  update public.orders set status = 'cancelled', cancelled_at = pg_catalog.clock_timestamp(), cancel_reason = 'customer_cancelled'
   where id = 'd4200000-0000-4000-8000-000000000005';
  r := public.discord_order_posts_to_close();
  if pg_catalog.jsonb_array_length(r) <> 1 or r->0->>'outcome' <> 'cancelled_customer' then raise exception 'customer cancel close wrong: %', r; end if;
  perform public.discord_order_post_closed((r->0->>'post')::uuid, 'gone');
  if (select outcome from public.discord_order_posts where id = (r->0->>'post')::uuid) <> 'gone' then raise exception 'deleted post not closed'; end if;

  -- an open post whose order ran past 5 minutes closes as expired even before the sweep cancels it
  insert into public.discord_order_posts(order_id,queue_key,channel_id,message_id,state)
   select id, queued_at, '1561391966049271968', '1564984101792907338', 'open' from public.orders where id = 'd4200000-0000-4000-8000-000000000003';
  update public.orders set queued_at = queued_at - interval '20 seconds' where id = 'd4200000-0000-4000-8000-000000000003';
  update public.discord_order_posts set queue_key = queue_key - interval '20 seconds' where order_id = 'd4200000-0000-4000-8000-000000000003';
  r := public.discord_order_posts_to_close();
  if pg_catalog.jsonb_array_length(r) <> 1 or r->0->>'outcome' <> 'expired' then raise exception 'expiry close wrong: %', r; end if;
end $$;

-- Permissions
do $$
begin
  if has_function_privilege('anon','public.discord_order_posts_due(integer)','execute')
     or has_function_privilege('authenticated','public.discord_order_post_claim(uuid,timestamptz,text)','execute')
     or has_function_privilege('authenticated','public.discord_order_posts_to_close()','execute')
     or has_function_privilege('anon','public.discord_order_post_closed(uuid,text)','execute')
     or not has_function_privilege('service_role','public.discord_order_post_saved(uuid,text)','execute')
     or not has_function_privilege('service_role','public.discord_order_post_failed(uuid)','execute')
     or has_table_privilege('service_role','public.discord_order_posts','insert')
     or has_table_privilege('authenticated','public.discord_order_posts','select')
  then raise exception 'permissions wrong'; end if;
  if not exists (select 1 from cron.job where jobname = 'duoly-discord-orders-tick' and schedule = '10 seconds' and active) then
    raise exception 'orders tick not scheduled'; end if;
  if not exists (select 1 from cron.job where jobname = 'duoly-discord-roles-log-prune' and command like '%duoly-discord-orders-tick%') then
    raise exception 'log prune misses the orders tick'; end if;
end $$;

select 'discord_order_posts: all checks passed' as result;
rollback;
