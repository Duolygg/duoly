-- Trusted infrastructure only. Secrets are provisioned out of band into Vault.
-- An absent/invalid Vault configuration queues no request; it does not expose keys.
begin;
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
revoke all on schema net from public, anon, authenticated, service_role;
revoke all on all tables in schema net from public, anon, authenticated, service_role;
revoke all on all functions in schema net from public, anon, authenticated, service_role;
revoke all on schema cron from public, anon, authenticated, service_role;
revoke all on all tables in schema cron from public, anon, authenticated, service_role;
revoke all on all functions in schema cron from public, anon, authenticated, service_role;

select cron.schedule(
  'private-proof-cleanup', '*/15 * * * *',
  $job$
    select net.http_post(
      url := (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'duoly_private_proof_cleanup_url'
      ),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          select decrypted_secret from vault.decrypted_secrets
          where name = 'duoly_private_proof_cleanup_service_role_key'
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 25000
    )
    where (
      select count(*) = 1 and bool_and(length(decrypted_secret) > 0)
      from vault.decrypted_secrets
      where name = 'duoly_private_proof_cleanup_service_role_key'
    ) and (
      select count(*) = 1 and bool_and(
        decrypted_secret ~ '^https://[a-z0-9]+[.]supabase[.]co/functions/v1/private-proof-cleanup$'
      ) from vault.decrypted_secrets
      where name = 'duoly_private_proof_cleanup_url'
    );
  $job$
);
-- Bound only these two owned jobs' logs; leave unrelated schedules/logs intact.
select cron.schedule(
  'private-proof-cleanup-log-prune', '25 3 * * *',
  $prune$
    delete from cron.job_run_details
    where jobid in (
      select jobid from cron.job
      where jobname in ('private-proof-cleanup', 'private-proof-cleanup-log-prune')
        and username = current_user
    ) and end_time < clock_timestamp() - interval '7 days';
  $prune$
);
commit;
