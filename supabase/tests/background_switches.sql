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

-- 20261112140000_background_switches_timers.sql: the switch table, the orders registration trigger,
-- the dispatcher's live skip, and the fixer plus finalize and rollback. Everything is rolled back,
-- and pg_net cannot deliver a queued fixture request before commit, so nothing leaves this
-- transaction. The fixture worker host is .invalid for the same reason.

create function pg_temp.assert_true(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'background_switches: %', label; end if;
end;
$$;

create function pg_temp.assert_raises(p_sql text, p_expect text, p_label text) returns void
language plpgsql as $$
declare v_msg text; v_raised boolean := false;
begin
  begin
    execute p_sql;
  exception when others then
    v_raised := true; v_msg := sqlerrm;
  end;
  if not v_raised then
    raise exception 'background_switches: % did not raise', p_label;
  end if;
  if pg_catalog.strpos(v_msg, p_expect) = 0 then
    raise exception 'background_switches: % raised the wrong error: %', p_label, v_msg;
  end if;
end;
$$;

-- Which timer kinds the last statement registered, and which app endpoints it called.
create function pg_temp.registered() returns text[] language sql as $$
  select coalesce(pg_catalog.array_agg((pg_catalog.convert_from(body, 'UTF8')::jsonb)->>'kind'
    order by (pg_catalog.convert_from(body, 'UTF8')::jsonb)->>'kind'), '{}'::text[])
    from net.http_request_queue where url like '%/timers';
$$;
create function pg_temp.app_calls() returns text[] language sql as $$
  select coalesce(pg_catalog.array_agg(url order by url), '{}'::text[])
    from net.http_request_queue where url like 'https://duoly.gg/%';
$$;
-- Give the fixture order a new queue epoch, which is the one event the trigger reacts to.
create function pg_temp.requeue() returns void language plpgsql as $$
begin
  truncate net.http_request_queue;
  update public.orders set queued_at = pg_catalog.clock_timestamp();
  if not found then raise exception 'background_switches: the fixture order is gone'; end if;
end;
$$;
-- A skip must come from the Vault entries, never from a switch that happens to be legacy.
create function pg_temp.expect_skip(p_label text) returns void language plpgsql as $$
begin
  perform pg_temp.assert_true((select pg_catalog.bool_and(mode = 'shadow')
    from public.background_switches where kind in ('orders','payments')),
    p_label || ': both switches must be in shadow for a Vault test');
  perform pg_temp.requeue();
  perform pg_temp.assert_true(pg_temp.registered() = '{}'::text[], p_label);
end;
$$;
create function pg_temp.expect_register(p_orders text, p_payments text, p_kinds text[], p_label text)
returns void language plpgsql as $$
begin
  update public.background_switches set mode = p_orders, updated_at = pg_catalog.now() where kind = 'orders';
  update public.background_switches set mode = p_payments, updated_at = pg_catalog.now() where kind = 'payments';
  perform pg_temp.requeue();
  perform pg_temp.assert_true(pg_temp.registered() = p_kinds,
    p_label || ': got ' || pg_temp.registered()::text);
end;
$$;
-- The ten-minute fallback forces every kind, which is the strongest shape for a skip assertion.
create function pg_temp.expect_dispatch(p_kinds text[], p_label text) returns void language plpgsql as $$
declare v_before jsonb; v_actual text[];
begin
  update public.duoly_dispatch_state set last_called_at = pg_catalog.clock_timestamp() - interval '11 minutes';
  truncate net.http_request_queue;
  select pg_catalog.jsonb_object_agg(kind, last_called_at) into v_before from public.duoly_dispatch_state;
  perform public.duoly_dispatch();
  select coalesce(pg_catalog.array_agg(case url
    when 'https://duoly.gg/api/discord/orders/tick' then 'orders'
    when 'https://duoly.gg/api/payments/tick' then 'payments'
    when 'https://duoly.gg/api/internal/analytics/drain' then 'analytics'
    when 'https://duoly.gg/api/discord/roles/tick' then 'roles'
    else url end order by url), '{}'::text[]) into v_actual
    from net.http_request_queue where url like 'https://duoly.gg/%';
  perform pg_temp.assert_true(
    (select coalesce(pg_catalog.array_agg(x order by x), '{}'::text[]) from pg_catalog.unnest(v_actual) x) =
    (select coalesce(pg_catalog.array_agg(x order by x), '{}'::text[]) from pg_catalog.unnest(p_kinds) x),
    p_label || ': unexpected calls ' || v_actual::text);
  perform pg_temp.assert_true(not exists (select 1 from public.duoly_dispatch_state s
    where not (s.kind = any(p_kinds))
      and pg_catalog.to_jsonb(s.last_called_at) is distinct from v_before->s.kind),
    p_label || ': a skipped kind was written');
end;
$$;

-- Start from idle even if the disposable stack has seed data.
truncate public.orders, public.checkout_intents, public.analytics_outbox, public.discord_accounts,
  public.discord_role_sync, public.duoly_dispatch_state cascade;
insert into public.duoly_dispatch_state(kind, last_called_at)
  select k, pg_catalog.clock_timestamp() from pg_catalog.unnest(array['orders','payments','analytics','roles']) k;
delete from vault.secrets where name in ('payments_tick_secret','discord_roles_tick_secret',
  'analytics_drain_secret','background_timers_url','background_register_secret','background_reconcile_secret');
select vault.create_secret(pg_catalog.repeat('test-only-',5), 'payments_tick_secret');
select vault.create_secret(pg_catalog.repeat('test-only-',5), 'discord_roles_tick_secret');
select vault.create_secret(pg_catalog.repeat('test-only-',5), 'analytics_drain_secret');

-- ---------------------------------------------------------------- what the migration left behind
select pg_temp.assert_true((select pg_catalog.count(*) = 4 and pg_catalog.bool_and(mode = 'shadow')
  from public.background_switches), 'all four kinds default to shadow');
select pg_temp.assert_true((select pg_catalog.array_agg(kind order by kind) = array['analytics','orders','payments','roles']
  from public.background_switches), 'exactly the four dispatcher kinds');
select pg_temp.assert_true(exists (select 1 from cron.job where jobname = 'duoly-dispatch'
  and active and schedule = '10 seconds' and command = 'select public.duoly_dispatch();'),
  'the migration did NOT pause duoly-dispatch');
select pg_temp.assert_true(not exists (select 1 from cron.job where jobname = 'duoly-background-fix'),
  'the migration did not schedule the fixer');
select pg_temp.assert_true((select relrowsecurity from pg_catalog.pg_class
  where oid = 'public.background_switches'::pg_catalog.regclass), 'switches have RLS enabled');
select pg_temp.assert_true(not exists (select 1 from pg_catalog.pg_policy
  where polrelid = 'public.background_switches'::pg_catalog.regclass), 'switches have no policy');

-- Only the app may read the mode, and nobody but the owner may change it.
select pg_temp.assert_true(pg_catalog.has_table_privilege('service_role','public.background_switches','SELECT'),
  'service_role reads the switches');
select pg_temp.assert_true(not pg_catalog.has_table_privilege(r,'public.background_switches','SELECT'),
  'switch read denied ' || r) from pg_catalog.unnest(array['anon','authenticated']) r;
select pg_temp.assert_true(not pg_catalog.has_table_privilege(r,'public.background_switches',p),
  'switch ' || p || ' denied ' || r)
  from pg_catalog.unnest(array['anon','authenticated','service_role']) r,
    pg_catalog.unnest(array['INSERT','UPDATE','DELETE']) p;
select pg_temp.assert_true(not pg_catalog.has_function_privilege(r,f,'EXECUTE'), 'execute denied ' || r || ' ' || f)
  from pg_catalog.unnest(array['anon','authenticated','service_role']) r,
    pg_catalog.unnest(array['public.background_mode(text)','public.background_overdue()',
      'public.background_fix()','public.background_finalize(text)','public.background_rollback()',
      'public.background_order_timers()','public.background_register_timer(text,text,bigint,bigint)',
      'public.duoly_dispatch()']) f;

-- A missing row or an unknown kind reads as legacy, so nothing new happens by accident.
select pg_temp.assert_true(public.background_mode('orders') = 'shadow', 'mode reads the row');
select pg_temp.assert_true(public.background_mode('nonsense') = 'legacy', 'unknown kind is legacy');
savepoint no_switch_row;
delete from public.background_switches where kind = 'orders';
select pg_temp.assert_true(public.background_mode('orders') = 'legacy', 'missing row is legacy');
rollback to no_switch_row;

-- ---------------------------------------------------------------- the signature, byte for byte
-- The documented known-answer vector, shared with openssl and the Web Crypto helper in
-- src/contracts/background.ts. If pgcrypto and Web Crypto ever disagree, every registration 401s.
select pg_temp.assert_true(pg_catalog.encode(extensions.hmac(
  '1767225600000.{"ok":true}', 'duoly-background-test-secret-0123456789', 'sha256'), 'hex')
  = 'bf92eb9d79efdbab3e9ee0e2cf0f78376423e844585117b0f990ed22679defd4', 'HMAC known-answer vector');

-- ---------------------------------------------------------------- registration without Vault
-- Local CI, the SQL suites and the deploy window all run with no Vault entries: skip in silence.
insert into auth.users(id,aud,role,email,raw_user_meta_data,raw_app_meta_data)
select ('d5600000-0000-4000-8000-' || pg_catalog.lpad(n::text,12,'0'))::uuid,
  'authenticated','authenticated','background-' || n || '@example.invalid','{}','{}'
from pg_catalog.generate_series(1,3) n;
truncate net.http_request_queue;
insert into public.orders(id,customer_id,game,service,title,units,unit,region,ign,customer_name,
  amount_eur_cents,payout_usd_cents,booking_fx,created_at,queued_at)
values ('d5610000-0000-4000-8000-000000000001','d5600000-0000-4000-8000-000000000001',
  'lol','duo2','Background fixture',1,'game','EUW','Fixture#EUW','Fixture',1000,600,1.1,
  pg_catalog.clock_timestamp()-interval '1 hour',pg_catalog.clock_timestamp());
select pg_temp.assert_true(pg_temp.registered() = '{}'::text[], 'no Vault means no registration');
-- The signup trigger wrote durable facts; analytics must be idle for the predicates below.
truncate public.analytics_outbox;

-- ---------------------------------------------------------------- registration with Vault
select vault.create_secret('https://duoly-timers.example.invalid', 'background_timers_url');
select vault.create_secret(pg_catalog.repeat('bg-register-',4), 'background_register_secret');

select pg_temp.requeue();
select pg_temp.assert_true(pg_temp.registered() = array['order-expire','order-post'],
  'a queued order registers both timers');
select pg_temp.assert_true((select pg_catalog.count(*) = 2 from net.http_request_queue
  where url = 'https://duoly-timers.example.invalid/timers'), 'posted to <base>/timers');
select pg_temp.assert_true((select pg_catalog.bool_and(timeout_milliseconds = 5000)
  from net.http_request_queue), 'bounded registration timeout');

-- No reusable credential is ever enqueued; the secret stays in Vault (oai-review F9).
select pg_temp.assert_true((select pg_catalog.bool_and(
    headers ? 'Content-Type' and headers ? 'x-duoly-timestamp' and headers ? 'x-duoly-signature'
    and not exists (select 1 from pg_catalog.jsonb_object_keys(headers) k
      where pg_catalog.lower(k) = 'authorization')
    and not exists (select 1 from pg_catalog.jsonb_each_text(headers) h where h.value ilike '%bearer%')
    and not exists (select 1 from pg_catalog.jsonb_each_text(headers) h
      where pg_catalog.strpos(h.value, pg_catalog.repeat('bg-register-',4)) > 0))
  from net.http_request_queue), 'registration headers carry a signature, never a bearer');

-- The signature covers exactly the bytes pg_net sends, which is what makes jsonb::text a safe
-- canonical form for signing in SQL. If pg_net ever reserialized the body, this fails here.
select pg_temp.assert_true((select pg_catalog.bool_and(headers->>'x-duoly-signature'
    = 'v1=' || pg_catalog.encode(extensions.hmac(
      (headers->>'x-duoly-timestamp') || '.' || pg_catalog.convert_from(body, 'UTF8'),
      pg_catalog.repeat('bg-register-',4), 'sha256'), 'hex'))
  from net.http_request_queue), 'signature verifies over the sent body');
select pg_temp.assert_true((select pg_catalog.bool_and(
    pg_catalog.convert_from(body,'UTF8') = pg_catalog.convert_from(body,'UTF8')::jsonb::text)
  from net.http_request_queue), 'sent bytes are canonical jsonb text');
select pg_temp.assert_true((select pg_catalog.bool_and(
    (headers->>'x-duoly-timestamp') ~ '^[0-9]{13}$'
    and pg_catalog.abs((headers->>'x-duoly-timestamp')::bigint
      - pg_catalog.floor(pg_catalog.extract(epoch from pg_catalog.clock_timestamp()) * 1000)::bigint) < 60000)
  from net.http_request_queue), 'timestamp is epoch milliseconds inside the replay window');

-- Shape and timings: epoch is queued_at in milliseconds, at is the exact owner-approved deadline.
select pg_temp.assert_true((select pg_catalog.bool_and(
    (b->>'at')::bigint = (b->>'epoch')::bigint
      + case b->>'kind' when 'order-post' then 100000 else 300000 end)
  from (select pg_catalog.convert_from(body,'UTF8')::jsonb as b from net.http_request_queue) q),
  '100 s post and 5 min expiry');
select pg_temp.assert_true((select pg_catalog.bool_and(
    b->>'ref' = o.id::text
    and (b->>'epoch')::bigint = pg_catalog.floor(pg_catalog.extract(epoch from o.queued_at) * 1000)::bigint)
  from (select pg_catalog.convert_from(body,'UTF8')::jsonb as b from net.http_request_queue) q,
    public.orders o), 'ref is the order id, epoch is queued_at in milliseconds');
-- A uuid is a legal ref for src/contracts/background.ts, so the key keeps exactly two colons.
select pg_temp.assert_true((select pg_catalog.bool_and(
    (pg_catalog.convert_from(body,'UTF8')::jsonb)->>'ref' ~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$')
  from net.http_request_queue), 'ref matches the contract regex');
-- Exactly the four contract fields and no key, which the worker parses with a strict schema.
select pg_temp.assert_true((select pg_catalog.bool_and(
    (select pg_catalog.array_agg(k order by k) from pg_catalog.jsonb_object_keys(
      pg_catalog.convert_from(body,'UTF8')::jsonb) k) = array['at','epoch','kind','ref'])
  from net.http_request_queue), 'body carries exactly kind, ref, epoch and at');

-- ---------------------------------------------------------------- trigger conditions
truncate net.http_request_queue;
update public.orders set note = 'unrelated column';
select pg_temp.assert_true(pg_temp.registered() = '{}'::text[], 'an unrelated update registers nothing');
-- A write to a watched column that changes nothing is not a new queue epoch.
update public.orders set queued_at = queued_at;
select pg_temp.assert_true(pg_temp.registered() = '{}'::text[], 'a no-op requeue registers nothing');
-- A reroll keeps the order queued and moves queued_at: a new queue epoch, so new timers.
update public.orders set queued_at = pg_catalog.clock_timestamp();
select pg_temp.assert_true(pg_temp.registered() = array['order-expire','order-post'],
  'a reroll registers the new queue epoch');
select pg_temp.assert_true((select pg_catalog.count(distinct
    (pg_catalog.convert_from(body,'UTF8')::jsonb)->>'epoch') = 1
  from net.http_request_queue), 'both timers of one epoch share it');

truncate net.http_request_queue;
savepoint leaving_the_queue;
-- orders_state_check wants cancelled_at >= queued_at, which the reroll above just moved.
update public.orders set status = 'cancelled',
  cancelled_at = greatest(queued_at, pg_catalog.clock_timestamp()),
  cancel_reason = 'customer_cancelled';
select pg_temp.assert_true(pg_temp.registered() = '{}'::text[], 'leaving the queue registers nothing');
rollback to leaving_the_queue;

-- A rolled back transaction never registers anything, because pg_net sends after commit only.
truncate net.http_request_queue;
savepoint rolled_back;
insert into public.orders(id,customer_id,game,service,title,units,unit,region,ign,customer_name,
  amount_eur_cents,payout_usd_cents,booking_fx,created_at,queued_at)
values ('d5610000-0000-4000-8000-000000000002','d5600000-0000-4000-8000-000000000002',
  'lol','duo2','Background fixture',1,'game','EUW','Fixture#EUW','Fixture',1000,600,1.1,
  pg_catalog.clock_timestamp()-interval '1 hour',pg_catalog.clock_timestamp());
select pg_temp.assert_true(pg_catalog.array_length(pg_temp.registered(),1) = 2,
  'a second queued order registers its own two timers');
rollback to rolled_back;
select pg_temp.assert_true(pg_temp.registered() = '{}'::text[], 'a rolled back insert leaves no request');

-- ---------------------------------------------------------------- switch gating per timer kind
-- Each timer is gated by the switch of the dispatcher that owns the same work today: the public
-- post belongs to the orders tick, expiry belongs to the payments tick.
savepoint gating;
select pg_temp.expect_register('legacy','legacy','{}'::text[], 'legacy registers nothing');
select pg_temp.expect_register('legacy','shadow', array['order-expire'], 'orders legacy keeps expiry');
select pg_temp.expect_register('shadow','legacy', array['order-post'], 'payments legacy keeps the post');
select pg_temp.expect_register('shadow','shadow', array['order-expire','order-post'], 'shadow registers both');
select pg_temp.expect_register('live','live', array['order-expire','order-post'], 'live registers both');
rollback to gating;

-- ---------------------------------------------------------------- a half-configured Vault
savepoint vault_url;
delete from vault.secrets where name = 'background_timers_url';
select pg_temp.expect_skip('no worker URL means no registration');
select vault.create_secret('http://duoly-timers.example.invalid', 'background_timers_url');
select pg_temp.expect_skip('a plain http URL is refused');
rollback to vault_url;
savepoint vault_slash;
delete from vault.secrets where name = 'background_timers_url';
select vault.create_secret('https://duoly-timers.example.invalid/', 'background_timers_url');
select pg_temp.expect_skip('a trailing slash is refused');
rollback to vault_slash;
savepoint vault_secret;
delete from vault.secrets where name = 'background_register_secret';
select pg_temp.expect_skip('no register secret means no registration');
select vault.create_secret('too-short', 'background_register_secret');
select pg_temp.expect_skip('a secret under 32 characters is refused');
rollback to vault_secret;

-- A registration the contract could not describe is refused before any crypto or HTTP work.
select pg_temp.assert_true(not public.background_register_timer('order-post','ok',0,1767225599999),
  'an at before 2026 is refused');
select pg_temp.assert_true(not public.background_register_timer('order-post','has:colon',0,1800000000000),
  'a ref with a colon is refused');
select pg_temp.assert_true(not public.background_register_timer('not-a-kind','ok',0,1800000000000),
  'an unknown kind is refused');
select pg_temp.assert_true(not public.background_register_timer('order-post','',0,1800000000000),
  'an empty ref is refused');
select pg_temp.assert_true(not public.background_register_timer('order-post','ok',-1,1800000000000),
  'a negative epoch is refused');
select pg_temp.assert_true(public.background_register_timer('presence-check','desk',0,1800000000000),
  'a singleton presence timer is accepted');

-- ---------------------------------------------------------------- the dispatcher skips live kinds
savepoint dispatch;
select pg_temp.expect_dispatch(array['orders','payments','analytics','roles'], 'shadow dispatches every kind');
update public.background_switches set mode = 'legacy', updated_at = pg_catalog.now() where kind = 'roles';
select pg_temp.expect_dispatch(array['orders','payments','analytics','roles'], 'legacy still dispatches');
update public.background_switches set mode = 'live', updated_at = pg_catalog.now() where kind = 'analytics';
select pg_temp.expect_dispatch(array['orders','payments','roles'], 'a live kind is skipped');
update public.background_switches set mode = 'live', updated_at = pg_catalog.now();
select pg_temp.expect_dispatch('{}'::text[], 'all live means no dispatcher HTTP at all');
-- Flipping back hands the work straight to the dispatcher, with no backfill needed.
update public.background_switches set mode = 'shadow', updated_at = pg_catalog.now();
select pg_temp.expect_dispatch(array['orders','payments','analytics','roles'], 'shadow takes the work back');
-- A deleted switch row must fail safe towards the dispatcher, never towards nobody.
delete from public.background_switches;
select pg_temp.expect_dispatch(array['orders','payments','analytics','roles'],
  'a missing switch keeps the legacy owner');
rollback to dispatch;

-- ---------------------------------------------------------------- background_overdue
-- Re-pin the fixture first: its deadlines are then 100 s and 5 min out, so "idle" is a fact about
-- the predicates rather than a race against however long this suite has been running.
select pg_temp.requeue();
truncate net.http_request_queue;
select pg_temp.assert_true(public.background_overdue() = pg_catalog.jsonb_build_object(
  'orders', false, 'payments', false, 'analytics', false, 'roles', false), 'idle is four falses');
savepoint overdue;
update public.orders set queued_at = pg_catalog.clock_timestamp() - interval '2 minutes';
select pg_temp.assert_true((public.background_overdue()->>'orders')::boolean, 'a due post is overdue');
select pg_temp.assert_true(not (public.background_overdue()->>'analytics')::boolean,
  'analytics is still idle');
update public.orders set queued_at = pg_catalog.clock_timestamp() - interval '6 minutes';
select pg_temp.assert_true((public.background_overdue()->>'payments')::boolean,
  'an expired queued order is overdue');
insert into public.analytics_outbox(event,dedup_key) values ('test','background-test');
select pg_temp.assert_true((public.background_overdue()->>'analytics')::boolean,
  'an unsent fact is overdue');
rollback to overdue;

-- A predicate that errors reports overdue, so the fixer calls the real handler rather than
-- believing a broken query. This transactional replacement is test-only and rolled back.
savepoint predicate_failure;
create or replace function public.duoly_dispatch_has_work(p_kind text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_kind = 'roles' then raise exception 'injected predicate failure'; end if;
  return false;
end;
$$;
select pg_temp.assert_true(public.background_overdue() = pg_catalog.jsonb_build_object(
  'orders', false, 'payments', false, 'analytics', false, 'roles', true),
  'a failing predicate reads as overdue');
rollback to predicate_failure;

-- ---------------------------------------------------------------- background_fix
select pg_temp.requeue();
truncate net.http_request_queue;
select pg_temp.assert_true(public.background_fix() = pg_catalog.jsonb_build_object(
  'overdue', pg_catalog.jsonb_build_object('orders', false, 'payments', false,
    'analytics', false, 'roles', false),
  'called', false), 'an idle fixer calls nothing');
select pg_temp.assert_true(pg_temp.app_calls() = '{}'::text[], 'an idle fixer enqueues nothing');

savepoint fix_overdue;
update public.orders set queued_at = pg_catalog.clock_timestamp() - interval '6 minutes';
truncate net.http_request_queue;
select pg_temp.assert_true((public.background_fix()->>'called')::boolean is not true,
  'no reconcile secret means no call');
select pg_temp.assert_true(pg_temp.app_calls() = '{}'::text[], 'no reconcile secret enqueues nothing');
select vault.create_secret('short', 'background_reconcile_secret');
truncate net.http_request_queue;
select pg_temp.assert_true((public.background_fix()->>'called')::boolean is not true,
  'a reconcile secret under 32 characters means no call');
select pg_temp.assert_true(pg_temp.app_calls() = '{}'::text[], 'a short secret enqueues nothing');
delete from vault.secrets where name = 'background_reconcile_secret';
select vault.create_secret(pg_catalog.repeat('bg-reconcile-',4), 'background_reconcile_secret');
truncate net.http_request_queue;
select pg_temp.assert_true((public.background_fix()->>'called')::boolean,
  'overdue work calls the reconciler');
select pg_temp.assert_true(pg_temp.app_calls() = array['https://duoly.gg/api/internal/reconcile'],
  'exactly one reconcile call');
select pg_temp.assert_true((select pg_catalog.bool_and(
    headers->>'Authorization' = 'Bearer ' || pg_catalog.repeat('bg-reconcile-',4)
    and headers->>'Content-Type' = 'application/json'
    and timeout_milliseconds = 25000)
  from net.http_request_queue), 'the reconciler keeps the existing narrow bearer');
select pg_temp.assert_true((select pg_catalog.bool_and(
    (pg_catalog.convert_from(body,'UTF8')::jsonb)->>'reason' = 'overdue'
    and (pg_catalog.convert_from(body,'UTF8')::jsonb)->'kinds' ? 'payments'
    and not ((pg_catalog.convert_from(body,'UTF8')::jsonb)->'kinds' ? 'analytics'))
  from net.http_request_queue), 'the body names only the kinds that were overdue');
rollback to fix_overdue;

-- ---------------------------------------------------------------- finalize and rollback
savepoint finalize;
select pg_temp.assert_raises('select public.background_finalize()', 'every kind must be live first',
  'finalize refuses while a kind is in shadow');
select pg_temp.assert_true(exists (select 1 from cron.job where jobname = 'duoly-dispatch' and active),
  'a refused finalize left the dispatcher alone');
update public.background_switches set mode = 'live', updated_at = pg_catalog.now();
select pg_temp.assert_raises('select public.background_finalize(''10 seconds'')',
  'unsupported schedule', 'finalize refuses a sub-minute schedule');
select pg_temp.assert_raises('select public.background_finalize(''0 * * *'')',
  'five fields', 'finalize refuses a four-field schedule');
select pg_temp.assert_raises('select public.background_finalize(''0 * * * *; drop table t'')',
  'unsupported schedule', 'finalize refuses anything but a cron expression');

select pg_temp.assert_true(public.background_finalize() = pg_catalog.jsonb_build_object(
  'fixer', '0 * * * *', 'dispatcher', 'paused'), 'finalize reports what it did');
select pg_temp.assert_true(exists (select 1 from cron.job where jobname = 'duoly-background-fix'
  and active and schedule = '0 * * * *' and command = 'select public.background_fix();'),
  'the fixer is scheduled hourly');
select pg_temp.assert_true(exists (select 1 from cron.job where jobname = 'duoly-dispatch'
  and not active and schedule = '10 seconds' and command = 'select public.duoly_dispatch();'),
  'the dispatcher is paused, never unscheduled');
-- Idempotent, and the recommended ten-minute schedule replaces the hourly one in place.
select pg_temp.assert_true((public.background_finalize('*/10 * * * *')->>'fixer') = '*/10 * * * *',
  'finalize is idempotent and reschedules in place');
select pg_temp.assert_true((select pg_catalog.count(*) = 1 from cron.job
  where jobname = 'duoly-background-fix' and active and schedule = '*/10 * * * *'),
  'one fixer job, rescheduled rather than duplicated');
select pg_temp.assert_true((select pg_catalog.count(*) = 1 from cron.job where jobname = 'duoly-dispatch'),
  'finalize never duplicates or drops the dispatcher');
select pg_temp.assert_true((select pg_catalog.count(*) = 4 and pg_catalog.bool_and(mode = 'live')
  from public.background_switches), 'finalize leaves the switches alone');

select pg_temp.assert_true(public.background_rollback() = pg_catalog.jsonb_build_object(
  'fixer', 'paused', 'dispatcher', 'active'), 'rollback reports what it did');
select pg_temp.assert_true(exists (select 1 from cron.job where jobname = 'duoly-background-fix'
  and not active and schedule = '*/10 * * * *'), 'rollback pauses the fixer, never unschedules it');
select pg_temp.assert_true(exists (select 1 from cron.job where jobname = 'duoly-dispatch' and active),
  'rollback puts the dispatcher back');
select pg_temp.assert_true(public.background_rollback() = pg_catalog.jsonb_build_object(
  'fixer', 'paused', 'dispatcher', 'active'), 'rollback is idempotent');
select pg_temp.assert_true((select pg_catalog.count(*) = 4 and pg_catalog.bool_and(mode = 'live')
  from public.background_switches), 'rollback leaves the switches alone');
-- The documented order under pressure: switches back to shadow first, then rollback.
update public.background_switches set mode = 'shadow', updated_at = pg_catalog.now();
select pg_temp.assert_true((public.background_rollback()->>'dispatcher') = 'active',
  'rollback works with the switches already back in shadow');
rollback to finalize;

rollback;
