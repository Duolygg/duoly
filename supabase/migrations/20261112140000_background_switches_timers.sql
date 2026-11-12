-- Event-driven background work, step B: switches, timer registration and the fixer.
-- Read docs/product/background-work.md first; it holds the contract this migration implements.
--
-- What this does NOT do, on purpose:
--   * it does not pause duoly-dispatch (only public.background_finalize() does, by hand later);
--   * it does not contain a single secret value (Vault names only, created by the owner);
--   * it does not change any existing migration, job command, predicate or endpoint.
-- All four kinds land in 'shadow': timers get registered and the app only logs what it would do,
-- while duoly-dispatch keeps doing the work. Flipping a kind is one UPDATE, never a deploy.
--
-- Registration carries a 5-minute HMAC over the exact body instead of a bearer, because pg_net
-- keeps request headers in a queue table whose PUBLIC grants cannot be revoked on managed
-- Supabase (oai-review F9). The secret never leaves Vault; the signature binds body and time.
--
-- Rollback (owner, no deploy needed):
--   update public.background_switches set mode = 'shadow', updated_at = pg_catalog.now();
--   select public.background_rollback();   -- only if the dispatcher is currently paused
-- In that order: the dispatcher is back before the timers stop acting, so no window has nobody
-- doing the work. Full removal (only after the switches are 'legacy' and the fixer is unscheduled):
--   begin;
--   drop trigger orders_background_timers_requeue on public.orders;
--   drop trigger orders_background_timers_insert on public.orders;
--   drop function public.background_order_timers();
--   drop function public.background_register_timer(text, text, bigint, bigint);
--   drop function public.background_finalize(text); drop function public.background_rollback();
--   drop function public.background_fix(); drop function public.background_overdue();
--   drop function public.background_mode(text); drop table public.background_switches;
--   -- then restore duoly_dispatch() from 20261112090000_gated_cron_dispatch.sql
--   commit;
begin;

-- ---------------------------------------------------------------- the switches
-- One row per legacy dispatcher kind. This table is the only thing that decides who does the work.
--   legacy  nothing new happens; duoly_dispatch owns the work
--   shadow  timers are registered and fire; the handler only logs; duoly_dispatch owns the work
--   live    the timer path acts and duoly_dispatch skips this kind
create table public.background_switches (
  kind text primary key check (kind in ('orders','payments','analytics','roles')),
  mode text not null default 'shadow' check (mode in ('legacy','shadow','live')),
  updated_at timestamptz not null default pg_catalog.now()
);
alter table public.background_switches enable row level security;
revoke all on table public.background_switches from public, anon, authenticated, service_role;
-- The app reads the mode on every fire; it never writes it. No policy exists, so a browser token
-- sees nothing even if a future grant slipped in. Flipping a kind is an owner UPDATE in the SQL
-- editor (the table owner), which is deliberately not a capability any API key has.
grant select on table public.background_switches to service_role;
comment on table public.background_switches is
  'Who does each kind of background work: legacy (dispatcher), shadow (timers log only), live (timers act). See docs/product/background-work.md.';

insert into public.background_switches(kind, mode)
  select k, 'shadow' from pg_catalog.unnest(array['orders','payments','analytics','roles']) k;

-- Fail-safe read: a missing row, an unknown kind or any error all mean 'legacy', so nothing new
-- happens before the owner has decided. Used by the trigger and by duoly_dispatch.
create function public.background_mode(p_kind text) returns text
language plpgsql stable security definer set search_path = '' as $$
declare v_mode text;
begin
  select s.mode into v_mode from public.background_switches s where s.kind = p_kind;
  return coalesce(v_mode, 'legacy');
exception when others then
  raise warning 'background_mode % unreadable [%]: %; treating as legacy', p_kind, sqlstate, sqlerrm;
  return 'legacy';
end;
$$;
revoke all on function public.background_mode(text) from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------- registration
-- POST <background_timers_url>/timers, signed exactly as src/contracts/background.ts verifies it:
--   signature = 'v1=' || hex(hmac_sha256(secret, timestamp || '.' || body))
-- The signed text is jsonb::text, which is deterministic (keys by length then bytes, ", " and ": "
-- separators) and is also exactly what pg_net puts on the wire for body := v_body, so the bytes the
-- worker verifies are the bytes we signed. Returns false, never raises, when anything is missing.
create function public.background_register_timer(
  p_kind text, p_ref text, p_epoch bigint, p_at bigint) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_url text; v_secret text; v_valid boolean; v_count bigint;
  v_body jsonb; v_text text; v_ts bigint; v_sig text;
begin
  if p_kind is null or p_ref is null or p_epoch is null or p_at is null
    or p_kind not in ('order-post','order-expire','settle-retry','analytics-retry','presence-check')
    or p_ref !~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$'
    or p_epoch < 0 or p_epoch > 4102444800000
    or p_at < 1767225600000 or p_at > 4102444800000 then
    raise warning 'background_register_timer refused %:%:% at %', p_kind, p_ref, p_epoch, p_at;
    return false;
  end if;
  -- No Vault, no entries, a short secret or a URL that is not plain https: skip in silence.
  -- This is what keeps local CI and the SQL suites quiet, and it is also the deploy-window
  -- behaviour: the owner creates the Vault entries before applying this migration.
  if pg_catalog.to_regclass('vault.decrypted_secrets') is null then return false; end if;
  select pg_catalog.count(*), pg_catalog.min(decrypted_secret) into v_count, v_url
    from vault.decrypted_secrets where name = 'background_timers_url';
  if v_count <> 1 or v_url is null
    or v_url !~ '^https://[a-z0-9]([a-z0-9.-]{1,126}[a-z0-9])?(/[a-z0-9._-]{1,64}){0,4}$' then
    return false;
  end if;
  select pg_catalog.count(*), pg_catalog.min(decrypted_secret),
    pg_catalog.bool_and(pg_catalog.length(decrypted_secret) >= 32)
    into v_count, v_secret, v_valid from vault.decrypted_secrets where name = 'background_register_secret';
  if v_count <> 1 or not coalesce(v_valid, false) then return false; end if;
  -- Key order in the text below is jsonb's, not this one; the signature covers the text.
  v_body := pg_catalog.jsonb_build_object('kind', p_kind, 'ref', p_ref, 'epoch', p_epoch, 'at', p_at);
  v_text := v_body::text;
  v_ts := pg_catalog.floor(extract(epoch from pg_catalog.clock_timestamp()) * 1000)::bigint;
  v_sig := 'v1=' || pg_catalog.encode(
    extensions.hmac(v_ts::text || '.' || v_text, v_secret, 'sha256'), 'hex');
  -- Fixed destination, bounded body, no caller-chosen URL and no reusable credential in the queue.
  perform net.http_post(
    url := v_url || '/timers',
    headers := pg_catalog.jsonb_build_object(
      'Content-Type', 'application/json',
      'x-duoly-timestamp', v_ts::text,
      'x-duoly-signature', v_sig),
    body := v_body,
    timeout_milliseconds := 5000);
  return true;
end;
$$;
revoke all on function public.background_register_timer(text, text, bigint, bigint)
  from public, anon, authenticated, service_role;

-- Orders enter the queue through SQL (create_paid_order, team seats, wallet and free wrappers, play
-- again, reroll, handover), not only through app code, so the registration boundary is a trigger on
-- the committed row (oai-review F1, F2). pg_net sends after commit, so a rolled back transaction
-- never registers anything. The timer is a wake-up: the exact post time is recomputed at fire time
-- from order_public_queued_at, which only ever returns a LATER instant than queued_at + 100 s.
-- Any failure here is a warning, never a failed checkout or accept (oai-review F10).
create function public.background_order_timers() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_epoch bigint;
begin
  begin
    v_epoch := pg_catalog.floor(extract(epoch from new.queued_at) * 1000)::bigint;
    -- Each timer is gated by the switch of the dispatcher that owns the same work today, so no
    -- work ever has two owners: the public post is the orders tick, expiry is the payments tick.
    if public.background_mode('orders') <> 'legacy' then
      perform public.background_register_timer('order-post', new.id::text, v_epoch, v_epoch + 100000);
    end if;
    if public.background_mode('payments') <> 'legacy' then
      perform public.background_register_timer('order-expire', new.id::text, v_epoch, v_epoch + 300000);
    end if;
  exception when others then
    raise warning 'background_order_timers % [%]: %', new.id, sqlstate, sqlerrm;
  end;
  return new;
end;
$$;
revoke all on function public.background_order_timers() from public, anon, authenticated, service_role;

create trigger orders_background_timers_insert after insert on public.orders
  for each row when (new.status = 'queued') execute function public.background_order_timers();
create trigger orders_background_timers_requeue after update of status, queued_at on public.orders
  for each row when (new.status = 'queued'
    and (new.status is distinct from old.status or new.queued_at is distinct from old.queued_at))
  execute function public.background_order_timers();

-- ---------------------------------------------------------------- dispatcher skips live kinds
-- Unchanged from 20261112090000_gated_cron_dispatch.sql except for the switch check at the top of
-- the loop: a kind the timers own is skipped entirely, including its state row, so flipping back to
-- 'shadow' hands the work straight back without a backfill. Anything other than 'live', including an
-- unreadable switch, keeps the dispatcher doing the work.
create or replace function public.duoly_dispatch() returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_kind text; v_url text; v_secret_name text; v_timeout integer;
  v_due boolean; v_secret text; v_count bigint; v_valid boolean;
begin
  for v_kind, v_url, v_secret_name, v_timeout in
    select * from (values
      ('orders', 'https://duoly.gg/api/discord/orders/tick', 'discord_roles_tick_secret', 9000),
      ('payments', 'https://duoly.gg/api/payments/tick', 'payments_tick_secret', null::integer),
      ('analytics', 'https://duoly.gg/api/internal/analytics/drain', 'analytics_drain_secret', 25000),
      ('roles', 'https://duoly.gg/api/discord/roles/tick', 'discord_roles_tick_secret', 25000)
    ) as kinds(kind, url, secret_name, timeout_ms)
  loop
    -- The timer path owns this kind; do not call the legacy handler and do not touch its state.
    if public.background_mode(v_kind) = 'live' then
      continue;
    end if;
    -- Preserve each old handler's minimum cadence even on predicate fail-open.
    -- State lookup errors fail closed rather than bypassing the safety bound.
    if exists (select 1 from public.duoly_dispatch_state s where s.kind = v_kind
      and s.last_called_at > pg_catalog.clock_timestamp() - case v_kind
        when 'payments' then interval '20 seconds'
        when 'roles' then interval '30 seconds'
        when 'analytics' then interval '60 seconds'
        else interval '10 seconds' end) then
      continue;
    end if;
    begin
      v_due := not exists (select 1 from public.duoly_dispatch_state s
        where s.kind = v_kind and s.last_called_at > pg_catalog.clock_timestamp() - interval '10 minutes');
      if not v_due then v_due := public.duoly_dispatch_has_work(v_kind); end if;
    exception when others then
      raise warning 'duoly_dispatch predicate % failed [%]: %; calling anyway', v_kind, sqlstate, sqlerrm;
      v_due := true;
    end;
    if not v_due then continue; end if;
    begin
      -- Same count/length gate as the original cron commands. No secret is created here.
      select pg_catalog.count(*), pg_catalog.min(decrypted_secret),
        pg_catalog.bool_and(pg_catalog.length(decrypted_secret) >= 32)
        into v_count, v_secret, v_valid from vault.decrypted_secrets where name = v_secret_name;
      if v_count <> 1 or not coalesce(v_valid, false) then
        raise warning 'duoly_dispatch % missing/invalid Vault configuration', v_kind;
        continue;
      end if;
      if v_kind = 'payments' then
        -- Keep the actual production timeout without a hosted lookup or guessed value.
        -- The old job is paused, not dropped; its command remains the source of truth.
        select (pg_catalog.regexp_match(command,
          'timeout_milliseconds\s*(?::=|=>)\s*([0-9]+)\s*[,)]', 'i'))[1]::integer
          into v_timeout from cron.job
          where jobname = 'duoly-payments-tick' and username = current_user;
      end if;
      if v_timeout is null then
        -- Omit the argument to preserve the installed pg_net default, not a guessed version.
        perform net.http_post(url := v_url,
          headers := pg_catalog.jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
          body := '{}'::jsonb);
      else
        perform net.http_post(url := v_url,
          headers := pg_catalog.jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
          body := '{}'::jsonb, timeout_milliseconds := v_timeout);
      end if;
      -- Only successful enqueue advances the fallback; this is NOT a delivery acknowledgement.
      insert into public.duoly_dispatch_state(kind, last_called_at) values (v_kind, pg_catalog.clock_timestamp())
        on conflict (kind) do update set last_called_at = excluded.last_called_at;
    exception when others then
      raise warning 'duoly_dispatch enqueue % failed [%]: %', v_kind, sqlstate, sqlerrm;
    end;
  end loop;
end;
$$;
revoke all on function public.duoly_dispatch() from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------- the fixer
-- One read-only boolean per kind, straight from duoly_dispatch_has_work, so the backstop and the
-- dispatcher can never disagree about what counts as work. A predicate that errors reads as true:
-- the fixer then calls the real handler, which is the safe direction (oai-review F20).
create function public.background_overdue() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_kind text; v_result jsonb := '{}'::jsonb; v_work boolean;
begin
  foreach v_kind in array array['orders','payments','analytics','roles'] loop
    begin
      v_work := public.duoly_dispatch_has_work(v_kind);
    exception when others then
      raise warning 'background_overdue predicate % failed [%]: %; reporting overdue', v_kind, sqlstate, sqlerrm;
      v_work := true;
    end;
    v_result := v_result || pg_catalog.jsonb_build_object(v_kind, v_work);
  end loop;
  return v_result;
end;
$$;
revoke all on function public.background_overdue() from public, anon, authenticated, service_role;

-- The scheduled backstop. It posts to /api/internal/reconcile ONLY when something is actually
-- overdue, which is also the signal that a timer was missed: the kinds it found travel in the body
-- so the endpoint can name them in its '[background-fix] reconciling ...' line, and the warning
-- below leaves the same evidence in the Postgres log. Those two lines are the whole alert: the app
-- has no admin-channel helper today, and adding one would need a secret that is not on the owner's
-- list (docs/product/background-work.md). Nothing here talks to Discord.
-- /api/internal/reconcile keeps a plain bearer: that credential grants only "run the existing
-- reconcile handlers", the same narrow capability duoly_dispatch already enqueues today.
create function public.background_fix() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_overdue jsonb; v_kinds text[]; v_secret text; v_valid boolean; v_count bigint;
begin
  v_overdue := public.background_overdue();
  select pg_catalog.array_agg(e.key order by e.key) into v_kinds
    from pg_catalog.jsonb_each(v_overdue) e where e.value = 'true'::jsonb;
  if v_kinds is null then
    return pg_catalog.jsonb_build_object('overdue', v_overdue, 'called', false);
  end if;
  raise warning 'background_fix found overdue work: %', v_kinds;
  select pg_catalog.count(*), pg_catalog.min(decrypted_secret),
    pg_catalog.bool_and(pg_catalog.length(decrypted_secret) >= 32)
    into v_count, v_secret, v_valid from vault.decrypted_secrets where name = 'background_reconcile_secret';
  if v_count <> 1 or not coalesce(v_valid, false) then
    raise warning 'background_fix missing/invalid Vault configuration';
    return pg_catalog.jsonb_build_object('overdue', v_overdue, 'called', false);
  end if;
  perform net.http_post(
    url := 'https://duoly.gg/api/internal/reconcile',
    headers := pg_catalog.jsonb_build_object(
      'Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
    body := pg_catalog.jsonb_build_object('reason', 'overdue', 'kinds', pg_catalog.to_jsonb(v_kinds)),
    timeout_milliseconds := 25000);
  return pg_catalog.jsonb_build_object('overdue', v_overdue, 'called', true, 'kinds', pg_catalog.to_jsonb(v_kinds));
exception when others then
  -- A cron job that raises writes a failed run row and nothing else; keep the evidence instead.
  raise warning 'background_fix failed [%]: %', sqlstate, sqlerrm;
  return pg_catalog.jsonb_build_object('overdue', coalesce(v_overdue, '{}'::jsonb), 'called', false,
    'error', sqlstate);
end;
$$;
revoke all on function public.background_fix() from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------- finalize and rollback
-- Called BY HAND by the owner, never by this migration and never by a job. finalize refuses until
-- all four kinds are live, pauses duoly-dispatch (alter_job, never unschedule) and schedules the
-- fixer; rollback does the reverse. Both are idempotent and both leave the switches alone, so the
-- order under pressure is always: switches to 'shadow' first, then background_rollback().
create function public.background_finalize(p_schedule text default '0 * * * *') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_fields integer; v_laggards text[]; v_job record;
begin
  -- Only a five field cron expression: a sub-minute schedule here would reintroduce the writes
  -- this whole build exists to remove. '*/10 * * * *' is the recommended value (oai-review F4).
  if p_schedule !~ '^[0-9*/, -]{5,100}$' then
    raise exception 'background_finalize: unsupported schedule %', p_schedule;
  end if;
  select pg_catalog.cardinality(pg_catalog.string_to_array(pg_catalog.btrim(p_schedule), ' '))
    into v_fields;
  if v_fields <> 5 then
    raise exception 'background_finalize: schedule must have five fields, got %', v_fields;
  end if;
  -- Refuse the one dangerous ordering: pausing the dispatcher while a kind is still 'shadow' or
  -- 'legacy' would leave that kind with nobody doing the work at all.
  if not exists (select 1 from public.background_switches) then
    raise exception 'background_finalize: no switches configured';
  end if;
  select pg_catalog.array_agg(s.kind || '=' || s.mode order by s.kind) into v_laggards
    from public.background_switches s where s.mode <> 'live';
  if v_laggards is not null then
    raise exception 'background_finalize: every kind must be live first (%)', v_laggards;
  end if;
  perform cron.schedule('duoly-background-fix', p_schedule, 'select public.background_fix();');
  for v_job in select jobid from cron.job
    where jobname = 'duoly-background-fix' and username = current_user
  loop
    perform cron.alter_job(job_id := v_job.jobid, active := true);
  end loop;
  -- Pause, never unschedule: the command stays the source of truth for the rollback.
  for v_job in select jobid from cron.job
    where jobname = 'duoly-dispatch' and username = current_user and active
  loop
    perform cron.alter_job(job_id := v_job.jobid, active := false);
  end loop;
  return pg_catalog.jsonb_build_object('fixer', p_schedule, 'dispatcher', 'paused');
end;
$$;
revoke all on function public.background_finalize(text) from public, anon, authenticated, service_role;

create function public.background_rollback() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_job record; v_dispatcher boolean := false;
begin
  for v_job in select jobid from cron.job
    where jobname = 'duoly-background-fix' and username = current_user and active
  loop
    perform cron.alter_job(job_id := v_job.jobid, active := false);
  end loop;
  for v_job in select jobid from cron.job
    where jobname = 'duoly-dispatch' and username = current_user
  loop
    perform cron.alter_job(job_id := v_job.jobid, active := true);
    v_dispatcher := true;
  end loop;
  if not v_dispatcher then
    raise warning 'background_rollback: duoly-dispatch is not scheduled for %', current_user;
  end if;
  return pg_catalog.jsonb_build_object('fixer', 'paused', 'dispatcher',
    case when v_dispatcher then 'active' else 'missing' end);
end;
$$;
revoke all on function public.background_rollback() from public, anon, authenticated, service_role;

-- Deliberately NOT done here: duoly-dispatch stays active and duoly-background-fix stays
-- unscheduled until the owner calls background_finalize() after all four kinds are live and clean.
commit;
