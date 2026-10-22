-- Managed pg_net objects can retain PUBLIC grants that postgres cannot revoke.
-- Never place the service credential in that queue. Use bounded synchronous HTTP
-- with a private counts-only outcome log owned by the migration operator instead.
begin;
create extension if not exists http with schema extensions;
create table public.order_proof_cleanup_runs (
  id bigint generated always as identity primary key,
  called_at timestamptz not null default clock_timestamp(),
  outcome text not null check (outcome in ('ok','configuration_missing','http_error','transport_error','invalid_response')),
  http_status integer,
  claimed integer check (claimed between 0 and 25),
  deleted integer check (deleted between 0 and 25),
  failed integer check (failed between 0 and 25),
  check ((claimed is null and deleted is null and failed is null) or (claimed is not null and deleted is not null and failed is not null and deleted + failed = claimed))
);
alter table public.order_proof_cleanup_runs enable row level security;
revoke all on public.order_proof_cleanup_runs from public, anon, authenticated, service_role;
revoke all on sequence public.order_proof_cleanup_runs_id_seq from public, anon, authenticated, service_role;

create function public.run_order_proof_cleanup() returns void
language plpgsql security invoker set search_path = '' as $function$
declare
  v_url text; v_key text; v_ref text; v_payload text; v_status integer; v_body text; v_counts jsonb;
  v_claimed integer; v_deleted integer; v_failed integer; v_name text;
begin
  if (select count(*) from vault.decrypted_secrets where name='duoly_private_proof_cleanup_url') <> 1
    or (select count(*) from vault.decrypted_secrets where name='duoly_private_proof_cleanup_service_role_key') <> 1 then
    insert into public.order_proof_cleanup_runs(outcome) values ('configuration_missing'); return;
  end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name='duoly_private_proof_cleanup_url';
  select decrypted_secret into v_key from vault.decrypted_secrets where name='duoly_private_proof_cleanup_service_role_key';
  if v_url is null or v_url !~ '^https://[a-z0-9]+[.]supabase[.]co/functions/v1/private-proof-cleanup$'
    or v_key is null or length(v_key)=0 then
    insert into public.order_proof_cleanup_runs(outcome) values ('configuration_missing'); return;
  end if;
  -- Bind the destination to the trusted provisioned JWT's own project claim.
  -- This is configuration checking, not authentication of caller-provided JWTs.
  begin
    v_payload := translate(split_part(v_key,'.',2),'-_','+/');
    v_ref := (convert_from(decode(rpad(v_payload,((length(v_payload)+3)/4)*4,'='),'base64'),'UTF8')::jsonb)->>'ref';
    if v_ref is null or v_ref !~ '^[a-z0-9]+$'
      or v_url <> 'https://' || v_ref || '.supabase.co/functions/v1/private-proof-cleanup' then
      raise exception 'configuration mismatch';
    end if;
  exception when others then
    insert into public.order_proof_cleanup_runs(outcome) values ('configuration_missing'); return;
  end;
  begin
    perform extensions.http_set_curlopt('CURLOPT_CONNECTTIMEOUT_MS', '3000');
    perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS', '25000');
    -- pgsql-http 1.6 follows at most five redirects and cannot disable them.
    -- Only the trusted project-bound function URL above receives the credential.
    select status,content into v_status,v_body from extensions.http((
      'POST', v_url,
      array[extensions.http_header('Authorization','Bearer ' || v_key)],
      'application/json', '{}'
    )::extensions.http_request);
    perform extensions.http_reset_curlopt();
  exception when others then
    perform extensions.http_reset_curlopt();
    insert into public.order_proof_cleanup_runs(outcome) values ('transport_error'); return;
  end;
  if v_status is distinct from 200 then
    insert into public.order_proof_cleanup_runs(outcome,http_status) values ('http_error',v_status); return;
  end if;
  begin
    -- Never persist response text, credentials, headers or diagnostics.
    if octet_length(v_body)>256 then raise exception 'invalid response'; end if;
    v_counts := v_body::jsonb;
    if v_counts is null or jsonb_typeof(v_counts) <> 'object' then raise exception 'invalid response'; end if;
    if (select count(*) from jsonb_object_keys(v_counts)) <> 3 then raise exception 'invalid response'; end if;
    foreach v_name in array array['claimed','deleted','failed'] loop
      if jsonb_typeof(v_counts->v_name) is distinct from 'number'
        or (v_counts->>v_name) !~ '^(0|[1-9][0-9]?)$' then raise exception 'invalid response'; end if;
    end loop;
    v_claimed := (v_counts->>'claimed')::integer;
    v_deleted := (v_counts->>'deleted')::integer;
    v_failed := (v_counts->>'failed')::integer;
    if v_claimed>25 or v_deleted+v_failed<>v_claimed then raise exception 'invalid response'; end if;
    insert into public.order_proof_cleanup_runs(outcome,http_status,claimed,deleted,failed)
      values ('ok',v_status,v_claimed,v_deleted,v_failed);
  exception when others then
    insert into public.order_proof_cleanup_runs(outcome,http_status) values ('invalid_response',v_status);
  end;
end;
$function$;
revoke all on function public.run_order_proof_cleanup() from public, anon, authenticated, service_role;
select cron.schedule('private-proof-cleanup','*/15 * * * *','select public.run_order_proof_cleanup();');
-- cron.schedule can preserve a previously disabled row; make activation explicit.
select cron.alter_job(jobid,active := true) from cron.job
  where jobname='private-proof-cleanup' and username=current_user;
select cron.schedule('private-proof-cleanup-log-prune','25 3 * * *', $prune$
  delete from public.order_proof_cleanup_runs where called_at<clock_timestamp()-interval '7 days';
  delete from cron.job_run_details where jobid in (
    select jobid from cron.job where jobname in ('private-proof-cleanup','private-proof-cleanup-log-prune')
      and username=current_user
  ) and end_time<clock_timestamp()-interval '7 days';
$prune$);
commit;
