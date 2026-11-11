-- Step A only: gate the existing app handlers; no timers or application changes.
-- Rollout: verify job owners, Vault secrets and net queue ACLs before owner applies this.
-- Payments inherits a literal timeout from its retained hand-made cron command;
-- absent explicit configuration uses the installed pg_net default (also locally).
-- An unfamiliar timeout expression aborts migration BEFORE any old job is paused.
-- Never enqueue service-role credentials. Existing narrow tick credentials are reused.
-- Rollback (owner, one transaction):
--   begin;
--   select cron.unschedule('duoly-dispatch');
--   select cron.alter_job(job_id := jobid, active := true) from cron.job
--     where jobname in ('duoly-discord-orders-tick','duoly-payments-tick',
--       'duoly-discord-roles-tick','duoly-analytics-drain') and username = current_user;
--   commit;
-- Keep bounded retention on rollback; never delete shared discord_roles_tick_secret
-- (duoly-performance-recalc still uses it). In-flight HTTP requests can still finish.
begin;

-- Refuse to silently replace a nonliteral hand-configured payments timeout.
do $preflight$
declare v_command text;
begin
  select command into v_command from cron.job
    where jobname = 'duoly-payments-tick' and username = current_user;
  if v_command ~* 'timeout_milliseconds' and pg_catalog.regexp_match(v_command,
    'timeout_milliseconds\s*(?::=|=>)\s*([0-9]+)\s*[,)]', 'i') is null then
    raise exception 'unrecognized payments timeout; inspect before rollout';
  end if;
end;
$preflight$;

create table public.duoly_dispatch_state (
  kind text primary key check (kind in ('orders','payments','analytics','roles')),
  last_called_at timestamptz not null
);
alter table public.duoly_dispatch_state enable row level security;
revoke all on table public.duoly_dispatch_state from public, anon, authenticated, service_role;

-- Read-only predicates. False positives are intentional; no claims or sweeps here.
create function public.duoly_dispatch_has_work(p_kind text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  case p_kind
  when 'orders' then
    -- src/server/discord/order-post-tick.ts:349-385 and order-posts.ts:11 (100 s).
    -- Exact due EXISTS from 20261106190000_team_orders.sql:1076-1089.
    -- order_public_queued_at is STABLE and read-only (20261105100000_twitch_streaming.sql:136-153),
    -- including priority picks, fresh presence and streaming-booking infinity.
    return exists (
      select 1 from public.orders o left join public.order_teams t on t.id = o.team_id
      where o.status = 'queued'
        and public.order_public_queued_at(o) <= pg_catalog.clock_timestamp() - interval '100 seconds'
        and o.queued_at + interval '5 minutes' > pg_catalog.clock_timestamp() + interval '20 seconds'
        and (t.id is null or (t.status in ('waiting','started')
          and not exists (select 1 from public.orders s where s.team_id = t.id and s.status = 'queued' and s.seat < o.seat)
          and not exists (select 1 from public.discord_order_posts d join public.orders s on s.id = d.order_id
            where s.team_id = t.id and d.state in ('posting','open'))))
        and not exists (select 1 from public.discord_order_posts d
          where d.order_id = o.id and d.queue_key = o.queued_at
            and (d.state <> 'posting' or d.created_at > pg_catalog.clock_timestamp() - interval '1 minute'))
    ) or exists (
      -- Superset of to_close (20261026140000_discord_order_posts.sql:232-237):
      -- any open row, even one not yet closable, is safe and avoids boundary races.
      select 1 from public.discord_order_posts d where d.state = 'open'
        or (d.state = 'posting' and d.created_at <= pg_catalog.clock_timestamp() - interval '1 minute')
    );
  when 'payments' then
    -- src/server/payments/webhook.ts:531-546, BOTH order_sweep loops:
    -- 20261106190000_team_orders.sql:640-648.
    return exists (select 1 from public.orders o where o.status = 'queued'
      and o.queued_at + interval '5 minutes' <= pg_catalog.clock_timestamp())
      or exists (select 1 from public.orders o join public.order_teams t on t.id = o.team_id
        where t.status = 'cancelled' and o.status in ('queued','in_progress'))
      -- STABLE/read-only, including unreversed holds with no Stripe session:
      -- 20261025260000_wallet_checkout.sql:290-297 (checkout_open_holds:116-122).
      or public.checkout_stale_wallet_holds(1) <> '[]'::jsonb
      -- claim_payment_settlements:20261023120000_stripe_payments.sql:149-152.
      or exists (select 1 from public.order_payments p where p.settle <> 'none' and p.attempts < 20);
  when 'analytics' then
    -- 20261106110000_analytics_outbox.sql:391-408, src/server/analytics/drain.ts:122-193.
    -- Do NOT restrict attempts: the claim also parks exhausted, expired leases.
    return exists (select 1 from public.analytics_outbox o where o.sent_at is null and o.failed_at is null
      and (o.claimed_until is null or o.claimed_until <= pg_catalog.now()));
  when 'roles' then
    -- Facts joins mirror 20261025100000_discord_role_sync.sql:35-51.
    -- wantedRoles/presenceFresh: src/server/discord/role-sync.ts:103-129;
    -- identity cleanup and refresh: :170-179,455-620. Admins never manage Teammate.
    -- Compare derived state, NOT heartbeat timestamps (which change every 10 s).
    return exists (
      with facts as (
        select d.discord_id, r.user_id, r.role = 'admin' as admin,
          not coalesce(a.suspended, false) as teammate,
          coalesce(p.online and p.last_seen_at > pg_catalog.clock_timestamp() - interval '20 seconds', false) as fresh,
          exists (select 1 from public.orders o where o.assigned_teammate_id = r.user_id and o.status = 'in_progress') as busy
        from public.account_roles r join public.discord_accounts d on d.user_id = r.user_id
        left join public.teammate_order_access a on a.user_id = r.user_id
        left join public.teammate_presence p on p.user_id = r.user_id
        where r.role in ('teammate','admin')
      )
      select 1 from facts f full join public.discord_role_sync s on s.discord_id = f.discord_id
      where f.discord_id is null or s.discord_id is null
        or s.user_id is distinct from f.user_id or s.admin is distinct from f.admin
        or (not f.admin and s.teammate is distinct from f.teammate)
        or s.online is distinct from (case when f.admin then f.fresh else f.teammate and (f.fresh or f.busy) end)
        or s.session is distinct from (not f.admin and f.busy)
        -- Preserve the two-minute nonmember refresh, not just the global backstop.
        or s.checked_at < pg_catalog.clock_timestamp() - case when s.not_member then interval '2 minutes' else interval '10 minutes' end
    );
  else
    raise exception 'unknown dispatcher kind: %', p_kind;
  end case;
end;
$$;
revoke all on function public.duoly_dispatch_has_work(text) from public, anon, authenticated, service_role;

create function public.duoly_dispatch() returns void
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

-- Install the backstop before pausing any old poll, atomically at commit.
select cron.schedule('duoly-dispatch', '10 seconds', 'select public.duoly_dispatch();');
select cron.alter_job(job_id := jobid, active := true) from cron.job
  where jobname = 'duoly-dispatch' and username = current_user;
-- Includes the hand-made production payments job. Absence locally is a no-op;
-- retain the actual command/owner for rollback instead of inventing a replacement.
do $$
declare v_job record;
begin
  for v_job in select jobid from cron.job
    where jobname in ('duoly-discord-orders-tick','duoly-payments-tick',
      'duoly-discord-roles-tick','duoly-analytics-drain',
      'duoly-discord-roles-log-prune','duoly-analytics-log-prune') and username = current_user
  loop
    perform cron.alter_job(job_id := v_job.jobid, active := false);
  end loop;
end;
$$;

-- One bounded statement per run: max 50k across ALL jobs, including payments.
-- Terminal end_time only: do not delete live runs. Backlog clears over hours;
-- no bulk migration-time DELETE, VACUUM FULL, rewrite or physical-size promise.
select cron.schedule('duoly-cron-log-prune', '0 * * * *', $prune$
  delete from cron.job_run_details where runid in (
    select runid from cron.job_run_details
    where end_time < pg_catalog.clock_timestamp() - interval '24 hours'
    order by end_time, runid limit 50000
  );
$prune$);
select cron.alter_job(job_id := jobid, active := true) from cron.job
  where jobname = 'duoly-cron-log-prune' and username = current_user;
-- Replace ONLY the cron-log half; retain seven-day proof outcome retention.
select cron.schedule('private-proof-cleanup-log-prune', '25 3 * * *', $proof$
  delete from public.order_proof_cleanup_runs where called_at < pg_catalog.clock_timestamp() - interval '7 days';
$proof$);
-- Everything else, including private-proof-cleanup's 15-minute sync HTTP, is untouched.
commit;
