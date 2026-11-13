-- Retire the gated dispatcher (20261112090000_gated_cron_dispatch.sql) and the per-kind cron ticks
-- it replaced. Since 2026-11-12 every kind runs on timers (20261112140000_background_switches_timers.sql)
-- with duoly-background-fix as the 10-minute backstop, and duoly-dispatch has been paused since.
-- Keeping paused jobs and a rollback function around only invites switching them back on next to
-- the timers, which would run the same work twice.
--
-- After this migration:
--   * every kind is live, and duoly-background-fix runs every 10 minutes (production already is;
--     a fresh database, such as the CI one, is brought to the same state here)
--   * the seven retired cron jobs are unscheduled
--   * duoly_dispatch(), duoly_dispatch_state, background_finalize() and background_rollback() are gone
--   * duoly_dispatch_has_work() stays: background_overdue() (the fixer's check) uses it
--   * a kind set to 'legacy' (or a switch that cannot be read) gets no new timers; the fixer still
--     reconciles it every 10 minutes, so 'legacy' is now the off switch for one kind's timers
--
-- Rollback: there is no dispatcher to return to. To stop one kind's timers, set its switch to
-- 'legacy' (update public.background_switches set mode = 'legacy' where kind = '<kind>'); the
-- fixer keeps that kind's work moving at 10-minute latency.
begin;

update public.background_switches
  set mode = 'live', updated_at = pg_catalog.now()
  where mode <> 'live';

do $$
declare v_job record; v_found boolean := false;
begin
  for v_job in select jobid, active from cron.job
    where jobname = 'duoly-background-fix' and username = current_user
  loop
    v_found := true;
    if not v_job.active then
      perform cron.alter_job(job_id := v_job.jobid, active := true);
    end if;
  end loop;
  if not v_found then
    perform cron.schedule('duoly-background-fix', '*/10 * * * *', 'select public.background_fix();');
  end if;

  for v_job in select jobid from cron.job
    where username = current_user and jobname in (
      'duoly-dispatch',
      'duoly-payments-tick',
      'duoly-discord-orders-tick',
      'duoly-discord-roles-tick',
      'duoly-discord-roles-log-prune',
      'duoly-analytics-drain',
      'duoly-analytics-log-prune')
  loop
    perform cron.unschedule(v_job.jobid);
  end loop;
end;
$$;

drop function if exists public.background_finalize(text);
drop function if exists public.background_rollback();
drop function if exists public.duoly_dispatch();
drop table if exists public.duoly_dispatch_state;

comment on table public.background_switches is
  'Per kind: live (timers act) or legacy (no new timers; duoly-background-fix still reconciles every 10 minutes). shadow only logs. See docs/product/background-work.md.';

commit;
