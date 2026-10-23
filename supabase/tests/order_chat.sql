-- Rollback-only behavioral acceptance. Executed on embedded PostgreSQL (PGlite)
-- with minimal auth/realtime stubs; real Supabase Broadcast remains unverified.
-- Run as owner with psql -X -v ON_ERROR_STOP=1, in an ISOLATED local Supabase only.
-- No real orders, paid-order producer, credentials, remote execution or sequence use.
-- Single-session checks do NOT prove races: separately race reroll/send, 21 sends
-- across assignments, and duplicate warning resolution in independent sessions.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';

do $$
begin
  if exists (select 1 from auth.users where id::text like 'f6240000-0000-4000-8000-%')
    or exists (select 1 from public.orders where id::text like 'e6240000-0000-4000-8000-%' or public_reference like 'DL-990624%')
    or exists (select 1 from public.order_assignments where id::text like 'd6240000-0000-4000-8000-%')
    or exists (select 1 from public.teammate_order_access where discord_id like '990624%') then
    raise exception 'Fixture collision: refusing to overwrite existing data';
  end if;
end;
$$;
create function pg_temp.assert(p_ok boolean,p_message text) returns void
language plpgsql as $$ begin if p_ok is distinct from true then raise exception '%',p_message; end if; end; $$;
-- Helpers are invoker-only; actor is a test JWT GUC, never an application input.
create function pg_temp.actor(p_n integer) returns void language plpgsql as $$
begin
  perform pg_catalog.set_config('request.jwt.claim.sub','f6240000-0000-4000-8000-' || pg_catalog.lpad(p_n::text,12,'0'),true);
end;
$$;
do $$
begin
  execute pg_catalog.format('grant usage on schema %I to authenticated',
    (select n.nspname from pg_catalog.pg_namespace as n where n.oid=pg_catalog.pg_my_temp_schema()));
end;
$$;
grant execute on function pg_temp.assert(boolean,text),pg_temp.actor(integer) to authenticated;
-- Explicit fixtures use trigger-created profiles/account_roles. 1 customer,
-- 2 original teammate, 3 replacement, 4 stranger customer, 5 admin, 6 queued owner.
insert into auth.users(id) select ('f6240000-0000-4000-8000-' || pg_catalog.lpad(n::text,12,'0'))::uuid
  from pg_catalog.generate_series(1,6) as n;
update public.profiles set name = case id::text
  when 'f6240000-0000-4000-8000-000000000001' then 'Fixture Customer'
  when 'f6240000-0000-4000-8000-000000000002' then 'Fixture Teammate'
  else 'Fixture Player' end where id::text like 'f6240000-0000-4000-8000-%';
update public.account_roles set role = case when user_id::text like '%000000000005' then 'admin' else 'teammate' end
  where user_id in ('f6240000-0000-4000-8000-000000000002','f6240000-0000-4000-8000-000000000003','f6240000-0000-4000-8000-000000000005');
insert into public.teammate_order_access(user_id,approved_games,discord_id,discord_verified_at,priority_base)
  select ('f6240000-0000-4000-8000-' || pg_catalog.lpad(n::text,12,'0'))::uuid,array['lol'],
    '99062400000000000' || n::text,pg_catalog.clock_timestamp(),0 from pg_catalog.generate_series(2,3) as n;
insert into public.orders(id,public_reference,customer_id,game,service,title,units,unit,region,ign,customer_name,amount_eur_cents,booking_fx,payout_usd_cents,created_at,queued_at)
values
 ('e6240000-0000-4000-8000-000000000001','DL-9906240001','f6240000-0000-4000-8000-000000000001','lol','duo','Chat fixture',1,'game','EUW','Fixture','Fixture Customer',999,1.08,646,pg_catalog.clock_timestamp()-interval '10 minutes',pg_catalog.clock_timestamp()-interval '2 minutes'),
 ('e6240000-0000-4000-8000-000000000002','DL-9906240002','f6240000-0000-4000-8000-000000000006','lol','duo','Expired chat fixture',1,'game','EUW','Fixture','Fixture Player',999,1.08,646,pg_catalog.clock_timestamp()-interval '10 minutes',pg_catalog.clock_timestamp()-interval '6 minutes');
-- Direct synthetic assignment avoids accept_order's unrelated global expiry sweep.
insert into public.order_assignments(id,order_id,teammate_id,accepted_at)
 values ('d6240000-0000-4000-8000-000000000001','e6240000-0000-4000-8000-000000000001','f6240000-0000-4000-8000-000000000002',pg_catalog.clock_timestamp());
update public.orders set status='in_progress',current_assignment_id='d6240000-0000-4000-8000-000000000001',
 assigned_teammate_id='f6240000-0000-4000-8000-000000000002',accepted_at=pg_catalog.clock_timestamp()
 where id='e6240000-0000-4000-8000-000000000001';

-- Verify every function has empty search_path and raw tables stay inaccessible.
do $$
declare v_name text;
begin
  foreach v_name in array array['rooms','messages','attempts','rate_accounts','typing','flags'] loop
    perform pg_temp.assert((select c.relrowsecurity from pg_catalog.pg_class as c
      where c.oid = ('public.order_chat_' || v_name)::regclass),'Missing private table RLS');
    perform pg_temp.assert(not pg_catalog.has_table_privilege('authenticated','public.order_chat_' || v_name,'SELECT,INSERT,UPDATE,DELETE'),'Raw chat grant');
  end loop;
  perform pg_temp.assert(not exists (select 1 from pg_catalog.pg_proc as p join pg_catalog.pg_namespace as n on n.oid=p.pronamespace
    where n.nspname='public' and (p.proname like 'order_chat_%' or p.proname in
    ('get_order_chat','send_order_chat_message','set_order_chat_typing','list_order_chat_flags','resolve_order_chat_flag'))
    and not coalesce(p.proconfig @> array['search_path=""'],false)),'Unsafe function search_path');
end;
$$;

set local role anon;
select pg_catalog.set_config('request.jwt.claim.sub','',true);
select pg_catalog.set_config('request.jwt.claims','{}',true);
do $$
begin
  begin perform public.get_order_chat('e6240000-0000-4000-8000-000000000001'); raise exception 'Anonymous RPC allowed'; exception when insufficient_privilege then null; end;
  begin perform public.send_order_chat_message('e6240000-0000-4000-8000-000000000001','d6240000-0000-4000-8000-000000000001',pg_catalog.gen_random_uuid(),'hello'); raise exception 'Anonymous send allowed'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.order_chat_messages; raise exception 'Anonymous table allowed'; exception when insufficient_privilege then null; end;
end;
$$;
reset role;
set local role authenticated;
select pg_temp.assert(public.send_order_chat_message('e6240000-0000-4000-8000-000000000001','d6240000-0000-4000-8000-000000000001',pg_catalog.gen_random_uuid(),'hello')->'error'->>'code'='401','Missing JWT send allowed');
select pg_temp.assert(public.set_order_chat_typing('e6240000-0000-4000-8000-000000000001','d6240000-0000-4000-8000-000000000001')->'error'->>'code'='401','Missing JWT typing allowed');
select pg_temp.actor(4);
select pg_temp.assert(public.get_order_chat('e6240000-0000-4000-8000-000000000001')->'error'->>'code'='404','Unrelated customer read');
select pg_temp.assert(public.send_order_chat_message('e6240000-0000-4000-8000-000000000001','d6240000-0000-4000-8000-000000000001',pg_catalog.gen_random_uuid(),'paypal')->'error'->>'code'='403','Unrelated customer send');
select pg_temp.assert(not public.order_chat_can_receive_topic('order-chat:d6240000-0000-4000-8000-000000000001'),'Stranger topic membership');
select pg_temp.assert(not public.order_chat_can_receive_topic('order-chat:not-a-uuid'),'Malformed topic accepted');
select pg_temp.assert(public.list_order_chat_flags()->'error'->>'code'='403','Non-admin flags read');
select pg_temp.actor(6);
select pg_temp.assert(public.get_order_chat('e6240000-0000-4000-8000-000000000002')->>'writable'='false','Queued writable must be boolean false');
reset role;
select pg_temp.assert((select status='queued' from public.orders where id='e6240000-0000-4000-8000-000000000002'),'Chat read swept expired queue');
select pg_temp.assert(not exists (select 1 from public.refund_credits where order_id='e6240000-0000-4000-8000-000000000002'),'Chat read minted refund');
set local role authenticated;
select pg_temp.actor(1);
do $$
declare v jsonb; v_retry jsonb; v_bad jsonb;
begin
  v := public.get_order_chat('e6240000-0000-4000-8000-000000000001');
  perform pg_temp.assert(v->>'viewer'='customer' and v->>'writable'='true','Customer authority');
  perform pg_temp.assert(pg_catalog.jsonb_array_length(v->'messages')=1 and v->'messages'->0->>'kind'='system','Acceptance hook missing/duplicate');
  perform pg_temp.assert(not (v->'participant' ? 'id') and not (v->'participant' ? 'email'),'Participant identity leak');
  v := public.send_order_chat_message('e6240000-0000-4000-8000-000000000001','d6240000-0000-4000-8000-000000000001','c6240000-0000-4000-8000-000000000001','Hi 👋');
  v_retry := public.send_order_chat_message('e6240000-0000-4000-8000-000000000001','d6240000-0000-4000-8000-000000000001','c6240000-0000-4000-8000-000000000001','Hi 👋');
  perform pg_temp.assert(v=v_retry and v->>'outcome'='sent','Lost ACK retry changed result');
  perform pg_temp.assert(v->'message'->>'name'='Fixture Customer' and v->'message'->>'sender'='customer','Server identity not derived');
  perform pg_temp.assert(v->'message'->>'created_at' is not null,'Server timestamp absent');
  v_bad := public.send_order_chat_message('e6240000-0000-4000-8000-000000000001','d6240000-0000-4000-8000-000000000001','c6240000-0000-4000-8000-000000000001','changed');
  perform pg_temp.assert(v_bad->'error'->>'code'='409','Changed-body retry accepted');
  v_bad := public.send_order_chat_message('e6240000-0000-4000-8000-000000000001','d6240000-0000-4000-8000-000000000001',pg_catalog.gen_random_uuid(),E' \t\n');
  perform pg_temp.assert(v_bad->'error'->>'code'='400','Whitespace-only message accepted');
  v_bad := public.send_order_chat_message('e6240000-0000-4000-8000-000000000001','d6240000-0000-4000-8000-000000000001',pg_catalog.gen_random_uuid(),U&'\00A0\2003\FEFF');
  perform pg_temp.assert(v_bad->'error'->>'code'='400','Unicode whitespace-only message accepted');
  v_bad := public.send_order_chat_message('e6240000-0000-4000-8000-000000000001','d6240000-0000-4000-8000-000000000001',pg_catalog.gen_random_uuid(),'hello' || pg_catalog.chr(1));
  perform pg_temp.assert(v_bad->'error'->>'code'='400','Control characters silently rewrote body binding');
  v := public.send_order_chat_message('e6240000-0000-4000-8000-000000000001','d6240000-0000-4000-8000-000000000001',pg_catalog.gen_random_uuid(),pg_catalog.repeat('😀',500));
  perform pg_temp.assert(v->>'outcome'='sent','500 Unicode code points rejected');
  v_bad := public.send_order_chat_message('e6240000-0000-4000-8000-000000000001','d6240000-0000-4000-8000-000000000001',pg_catalog.gen_random_uuid(),pg_catalog.repeat('😀',501));
  perform pg_temp.assert(v_bad->'error'->>'code'='400','501 code points accepted');
  v := public.send_order_chat_message('e6240000-0000-4000-8000-000000000001','d6240000-0000-4000-8000-000000000001','c6240000-0000-4000-8000-000000000002','send PayPal now');
  v_retry := public.send_order_chat_message('e6240000-0000-4000-8000-000000000001','d6240000-0000-4000-8000-000000000001','c6240000-0000-4000-8000-000000000002','send PayPal now');
  perform pg_temp.assert(v=v_retry and v->>'outcome'='blocked' and v->'message'='null'::jsonb,'Blocked retry delivered');
  perform pg_temp.assert(v->>'note'='Not sent: keep payments and account details on Duoly. Never ask for logins or outside payments.','Original BLOCKED_NOTE changed');
  perform public.send_order_chat_message('e6240000-0000-4000-8000-000000000001','d6240000-0000-4000-8000-000000000001',pg_catalog.gen_random_uuid(),'send PayPal now');
end;
$$;
reset role;
select pg_temp.assert((select count(*)=4 from public.order_chat_attempts where actor_id='f6240000-0000-4000-8000-000000000001'),'Retry consumed another rate slot');
select pg_temp.assert((select count(*)=1 from public.order_chat_flags where actor_id='f6240000-0000-4000-8000-000000000001'),'Duplicate fresh UUID flag counted');
select pg_temp.assert(not exists (select 1 from public.order_chat_messages where body like '%PayPal%'),'Blocked text reached recipient');
select pg_temp.assert(not exists (select 1 from public.order_chat_attempts where result::text like '%send PayPal now%'),'Blocked body persisted outside moderation');
-- Exact original regex regression categories, case/boundaries and safe substrings.
do $$
declare v text;
begin
  foreach v in array array['pass','password','passwort','login details','account details'] loop
    perform pg_temp.assert(public.order_chat_block_rule(v)='Account access','Account regex regression: ' || v);
  end loop;
  foreach v in array array['WhatsApp','telegram','snapchat'] loop
    perform pg_temp.assert(public.order_chat_block_rule(v)='Moving off Duoly','Moving regex regression: ' || v);
  end loop;
  foreach v in array array['PayPal','venmo','cashapp','Cash App','iban','bank transfer','crypto','pay me directly','pay you outside'] loop
    perform pg_temp.assert(public.order_chat_block_rule(v)='Off-platform payment','Payment regex regression: ' || v);
  end loop;
  foreach v in array array['compass','passwords','cryptography','telegrams','snapchatter','nice passable gameplay'] loop
    perform pg_temp.assert(public.order_chat_block_rule(v) is null,'False positive regex: ' || v);
  end loop;
end;
$$;
-- 4 counted attempts above +16 blocked attempts =20, independently of retention.
set local role authenticated;
select pg_temp.actor(1);
do $$
declare n integer; v jsonb;
begin
  for n in 1..16 loop
    v := public.send_order_chat_message('e6240000-0000-4000-8000-000000000001','d6240000-0000-4000-8000-000000000001',pg_catalog.gen_random_uuid(),'paypal');
    perform pg_temp.assert(v->>'outcome'='blocked','Blocked rate slot rejected early');
  end loop;
  v := public.send_order_chat_message('e6240000-0000-4000-8000-000000000001','d6240000-0000-4000-8000-000000000001',pg_catalog.gen_random_uuid(),'21st');
  perform pg_temp.assert(v->'error'->>'code'='429','21st global attempt accepted');
  v := public.send_order_chat_message('e6240000-0000-4000-8000-000000000001','d6240000-0000-4000-8000-000000000001','c6240000-0000-4000-8000-000000000001','Hi 👋');
  perform pg_temp.assert(v->>'outcome'='sent','Retry at limit rejected');
end;
$$;
select pg_temp.actor(2);
select pg_temp.assert(public.get_order_chat('e6240000-0000-4000-8000-000000000001')->'archives'='[]'::jsonb,'Teammate archive leak');
select pg_temp.assert(public.set_order_chat_typing('e6240000-0000-4000-8000-000000000001','d6240000-0000-4000-8000-000000000001')->>'ok'='true','Typing rejected');
select pg_temp.actor(1);
select pg_temp.assert(pg_catalog.jsonb_array_length(public.get_order_chat('e6240000-0000-4000-8000-000000000001')->'typing')=1,'Fresh typing missing');
reset role;
select pg_temp.assert((select expires_at-emitted_at=interval '4 seconds' from public.order_chat_typing
 where assignment_id='d6240000-0000-4000-8000-000000000001'),'Typing expiry not four seconds');
-- Repeated typing inside two seconds must preserve the emitted_at marker.
create temporary table order_chat_typing_marker as select emitted_at from public.order_chat_typing
 where assignment_id='d6240000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.actor(2);
select public.set_order_chat_typing('e6240000-0000-4000-8000-000000000001','d6240000-0000-4000-8000-000000000001');
reset role;
select pg_temp.assert((select t.emitted_at=m.emitted_at from public.order_chat_typing as t
 cross join order_chat_typing_marker as m where t.assignment_id='d6240000-0000-4000-8000-000000000001'),'Typing broadcast throttle reset');
-- Deterministic server-time expiry without sleeping or mutating any real row.
update public.order_chat_typing set expires_at=pg_catalog.clock_timestamp()-interval '1 second'
 where assignment_id='d6240000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.actor(1);
select pg_temp.assert(public.get_order_chat('e6240000-0000-4000-8000-000000000001')->'typing'='[]'::jsonb,'Expired typing shown');
select pg_temp.actor(5);
do $$
declare v_id uuid; v jsonb; v_retry jsonb;
begin
  v := public.list_order_chat_flags();
  select (f->>'id')::uuid into v_id from pg_catalog.jsonb_array_elements(v->'flags') as f where f->>'body'='send PayPal now';
  v := public.resolve_order_chat_flag(v_id,'warned');
  v_retry := public.resolve_order_chat_flag(v_id,'warned');
  perform pg_temp.assert(v=v_retry and v->'flag'->>'warning_count'='1','Duplicate warning counted');
  perform pg_temp.assert(public.resolve_order_chat_flag(v_id,'dismissed')->'error'->>'code'='409','Conflicting resolution accepted');
  perform pg_temp.assert(public.resolve_order_chat_flag(v_id,'Warned')->'error'->>'code'='400','Invalid resolution accepted');
  select (f->>'id')::uuid into v_id from pg_catalog.jsonb_array_elements(public.list_order_chat_flags()->'flags') as f where f->>'body'='paypal';
  v := public.resolve_order_chat_flag(v_id,'dismissed');
  perform pg_temp.assert(v->'flag'->>'status'='dismissed' and v->'flag'->>'warning_count'='1','Dismissed flag counted warning');
  perform pg_temp.assert(public.send_order_chat_message('e6240000-0000-4000-8000-000000000001','d6240000-0000-4000-8000-000000000001',pg_catalog.gen_random_uuid(),'admin impersonation')->'error'->>'code'='403','Admin impersonated player');
end;
$$;
reset role;
-- Fresh role, game approval, Discord and suspension checks apply to read and send.
update public.teammate_order_access set suspended=true where user_id='f6240000-0000-4000-8000-000000000002';
set local role authenticated;
select pg_temp.actor(2);
select pg_temp.assert(public.get_order_chat('e6240000-0000-4000-8000-000000000001')->'error'->>'code'='404','Suspended teammate read');
select pg_temp.assert(public.set_order_chat_typing('e6240000-0000-4000-8000-000000000001','d6240000-0000-4000-8000-000000000001')->'error'->>'code'='403','Suspended teammate typing');
reset role;
update public.teammate_order_access set suspended=false,approved_games='{}' where user_id='f6240000-0000-4000-8000-000000000002';
set local role authenticated;
select pg_temp.actor(2);
select pg_temp.assert(public.get_order_chat('e6240000-0000-4000-8000-000000000001')->'error'->>'code'='404','Revoked game teammate read');
reset role;
update public.teammate_order_access set approved_games=array['lol'],discord_id=null,discord_verified_at=null where user_id='f6240000-0000-4000-8000-000000000002';
set local role authenticated;
select pg_temp.actor(2);
select pg_temp.assert(public.get_order_chat('e6240000-0000-4000-8000-000000000001')->'error'->>'code'='404','Unlinked Discord teammate read');
reset role;
update public.teammate_order_access set discord_id='990624000000000002',discord_verified_at=pg_catalog.clock_timestamp() where user_id='f6240000-0000-4000-8000-000000000002';
update public.account_roles set role='customer' where user_id='f6240000-0000-4000-8000-000000000002';
set local role authenticated;
select pg_temp.actor(2);
select pg_temp.assert(public.get_order_chat('e6240000-0000-4000-8000-000000000001')->'error'->>'code'='404','Role-revoked teammate read');
reset role;
update public.account_roles set role='teammate' where user_id='f6240000-0000-4000-8000-000000000002';
-- Synthetic owned reroll, no invocation of global lifecycle sweeps.
update public.order_assignments set ended_at=pg_catalog.clock_timestamp(),end_reason='customer_reroll'
 where id='d6240000-0000-4000-8000-000000000001';
update public.orders set status='queued',queued_at=pg_catalog.clock_timestamp(),accepted_at=null,
 assigned_teammate_id=null,current_assignment_id=null,rerolls=1 where id='e6240000-0000-4000-8000-000000000001';
insert into public.order_assignments(id,order_id,teammate_id,accepted_at)
 values ('d6240000-0000-4000-8000-000000000002','e6240000-0000-4000-8000-000000000001','f6240000-0000-4000-8000-000000000003',pg_catalog.clock_timestamp());
update public.orders set status='in_progress',current_assignment_id='d6240000-0000-4000-8000-000000000002',
 assigned_teammate_id='f6240000-0000-4000-8000-000000000003',accepted_at=pg_catalog.clock_timestamp()
 where id='e6240000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.actor(2);
select pg_temp.assert(public.get_order_chat('e6240000-0000-4000-8000-000000000001','d6240000-0000-4000-8000-000000000001')->'error'->>'code'='404','Former teammate read archive');
select pg_temp.assert(not public.order_chat_can_receive_topic('order-chat:d6240000-0000-4000-8000-000000000001'),'Former teammate topic allowed');
select pg_temp.actor(3);
select pg_temp.assert(public.get_order_chat('e6240000-0000-4000-8000-000000000001','d6240000-0000-4000-8000-000000000001')->'error'->>'code'='404','Replacement read old archive');
select pg_temp.assert(pg_catalog.jsonb_array_length(public.get_order_chat('e6240000-0000-4000-8000-000000000001')->'messages')=1,'Replacement inherited messages');
select pg_temp.actor(1);
select pg_temp.assert(public.get_order_chat('e6240000-0000-4000-8000-000000000001','d6240000-0000-4000-8000-000000000001')->>'writable'='false','Archived customer writeable');
select pg_temp.assert(public.send_order_chat_message('e6240000-0000-4000-8000-000000000001','d6240000-0000-4000-8000-000000000001',pg_catalog.gen_random_uuid(),'stale')->'error'->>'code'='409','Archived send accepted');
select pg_temp.assert(public.send_order_chat_message('e6240000-0000-4000-8000-000000000001','d6240000-0000-4000-8000-000000000002',pg_catalog.gen_random_uuid(),'global limit across assignments')->'error'->>'code'='429','Rate reset by reroll');
reset role;
-- Retention stress via private helper, owner-only, avoids time warp/rate bypass RPC.
do $$
declare n integer;
begin
  for n in 1..205 loop
    perform public.order_chat_append('d6240000-0000-4000-8000-000000000001','customer','Fixture Customer','','Retention fixture ' || n,pg_catalog.gen_random_uuid());
  end loop;
end;
$$;
select pg_temp.assert((select count(*)=200 from public.order_chat_messages where assignment_id='d6240000-0000-4000-8000-000000000001'),'Retention not exactly 200');
set local role authenticated;
select pg_temp.actor(1);
select pg_temp.assert(public.send_order_chat_message('e6240000-0000-4000-8000-000000000001','d6240000-0000-4000-8000-000000000001','c6240000-0000-4000-8000-000000000001','Hi 👋')->'message'->>'body'='Hi 👋','Pruning corrupted durable retry');
reset role;
-- Completion hook only: owner changes a fixture, no completion RPC or money flow.
update public.orders set status='completed',completed_at=pg_catalog.clock_timestamp() where id='e6240000-0000-4000-8000-000000000001';
update public.orders set status='completed' where id='e6240000-0000-4000-8000-000000000001';
select pg_temp.assert((select count(*)=1 from public.order_chat_messages where assignment_id='d6240000-0000-4000-8000-000000000002' and system_event='completed'),'Completion hook duplicated');
set local role authenticated;
select pg_temp.actor(3);
select pg_temp.assert(public.get_order_chat('e6240000-0000-4000-8000-000000000001')->>'writable'='false','Final teammate read-only missing');
select pg_temp.assert(public.send_order_chat_message('e6240000-0000-4000-8000-000000000001','d6240000-0000-4000-8000-000000000002',pg_catalog.gen_random_uuid(),'after complete')->'error'->>'code'='409','Completed send accepted');
select pg_temp.assert(public.order_chat_can_receive_topic('order-chat:d6240000-0000-4000-8000-000000000002'),'Final teammate lost read membership');
do $$
begin
  begin perform 1 from public.order_chat_messages; raise exception 'Direct table read allowed'; exception when insufficient_privilege then null; end;
  begin insert into public.order_chat_rooms(assignment_id,order_id) values('d6240000-0000-4000-8000-000000000099','e6240000-0000-4000-8000-000000000001'); raise exception 'Direct table INSERT allowed'; exception when insufficient_privilege then null; end;
  begin perform public.order_chat_invalidate('d6240000-0000-4000-8000-000000000002'); raise exception 'Private publish helper callable'; exception when insufficient_privilege then null; end;
end;
$$;
reset role;
-- Simulate an unrelated overly broad permissive policy: our restrictive gate wins.
-- Must only run isolated locally, NEVER against a live shared provider.
-- Match Supabase's read-authorization probe: it inserts topic/extension only,
-- not a true private value. Channel privacy belongs to realtime.send(...,true)
-- and private client config, not an optional probe-row column.
insert into realtime.messages(topic,extension)
 values('order-chat:d6240000-0000-4000-8000-000000000002','broadcast');
set local role authenticated;
select pg_temp.actor(3);
select pg_catalog.set_config('realtime.topic','order-chat:d6240000-0000-4000-8000-000000000002',true);
select pg_temp.assert(exists (select 1 from realtime.messages where topic='order-chat:d6240000-0000-4000-8000-000000000002'),'Authorized provider probe denied');
reset role;
create policy order_chat_fixture_permissive on realtime.messages for all to authenticated using (true) with check (true);
set local role authenticated;
select pg_temp.actor(4);
select pg_catalog.set_config('realtime.topic','order-chat:d6240000-0000-4000-8000-000000000002',true);
do $$
begin
  begin
    insert into realtime.messages(topic,extension,event,payload,private)
      values('order-chat:d6240000-0000-4000-8000-000000000002','broadcast','chat_changed','{"spoofed":true}',true);
    raise exception 'Direct realtime INSERT bypassed restrictive policy';
  exception when insufficient_privilege then null; end;
  perform pg_temp.assert(not exists (select 1 from realtime.messages where topic='order-chat:d6240000-0000-4000-8000-000000000002'),'Permissive policy bypassed receive ACL');
end;
$$;
reset role;
-- All rows, JWT GUCs, test helpers and fixture policy roll back together.
rollback;
begin read only;
do $$
begin
  if exists (select 1 from auth.users where id::text like 'f6240000-0000-4000-8000-%')
    or exists (select 1 from public.orders where id::text like 'e6240000-0000-4000-8000-%')
    or exists (select 1 from public.order_assignments where id::text like 'd6240000-0000-4000-8000-%')
    or exists (select 1 from public.order_chat_attempts where actor_id::text like 'f6240000-0000-4000-8000-%')
    or exists (select 1 from public.order_chat_flags where actor_id::text like 'f6240000-0000-4000-8000-%')
    or exists (select 1 from pg_catalog.pg_policies where policyname='order_chat_fixture_permissive') then
    raise exception 'Rollback cleanup failed';
  end if;
end;
$$;
rollback;
