-- Analytics outbox schedule (POSTHOG-SPEC section 8). The drain posts queued marketplace facts
-- to PostHog every minute; the nightly reconcile re-derives anything a trigger missed and the
-- cleanup removes sent rows after 30 days. The drain call is inert until the Vault secret
-- analytics_drain_secret (32+ characters, its own secret, never the Discord one) exists, and
-- the endpoint does nothing unless analytics is enabled on Vercel.
begin;

select cron.schedule(
  'duoly-analytics-drain', '* * * * *',
  $job$
    select net.http_post(
      url := 'https://duoly.gg/api/internal/analytics/drain',
      headers := pg_catalog.jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          select decrypted_secret from vault.decrypted_secrets
          where name = 'analytics_drain_secret'
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 25000
    )
    where (
      select count(*) = 1 and bool_and(pg_catalog.length(decrypted_secret) >= 32)
      from vault.decrypted_secrets
      where name = 'analytics_drain_secret'
    );
  $job$
);

select cron.schedule(
  'duoly-analytics-reconcile', '10 3 * * *',
  $job$ select public.analytics_outbox_reconcile(pg_catalog.now() - interval '2 days'); $job$
);

select cron.schedule(
  'duoly-analytics-cleanup', '20 3 * * *',
  $job$ select public.analytics_outbox_cleanup(); $job$
);

-- 1,440 drain runs a day: keep a week of run history for these jobs.
select cron.schedule(
  'duoly-analytics-log-prune', '40 3 * * *',
  $prune$
    delete from cron.job_run_details
    where jobid in (
      select jobid from cron.job
      where jobname in ('duoly-analytics-drain', 'duoly-analytics-reconcile',
        'duoly-analytics-cleanup', 'duoly-analytics-log-prune')
        and username = current_user
    ) and end_time < pg_catalog.clock_timestamp() - interval '7 days';
  $prune$
);

commit;
