-- Photo and header files are removed from storage when nobody uses them any more.
--
-- Three ways a file stops being used:
--   * replaced   a profile photo or header is replaced or removed (trigger below queues the old file)
--   * account    an account is deleted (its auth user, which cascades to public.profiles); every
--                file in that user's avatars and profile-headers folders is queued
--   * orphan     files already left behind before this migration (one-off backfill below)
--
-- Postgres cannot delete storage files (storage.protect_delete refuses), so the queue is drained by
-- the app through the Storage API: duoly-background-fix (every 10 minutes) calls
-- /api/internal/reconcile with files=true only while the queue has work. Deleting a file that is
-- already gone succeeds, so a retry after a lost answer is harmless.
--
-- File names are content hashes, so a file queued as replaced can become current again when someone
-- picks the same picture again, and chat history keeps copies of photo URLs. The claim therefore
-- re-checks at delete time and drops replaced or orphan rows that any of those still reference.
-- Rows queued because the account was deleted are deleted regardless: the person asked to leave.
begin;

create table public.storage_cleanup (
  bucket text not null check (bucket in ('avatars', 'profile-headers')),
  path text not null check (path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{16}\.(webp|jpg)$'),
  reason text not null check (reason in ('replaced', 'account', 'orphan')),
  queued_at timestamptz not null default pg_catalog.now(),
  attempts integer not null default 0 check (attempts >= 0),
  primary key (bucket, path)
);
alter table public.storage_cleanup enable row level security;
revoke all on table public.storage_cleanup from public, anon, authenticated, service_role;
comment on table public.storage_cleanup is
  'Storage files to delete (old photos and headers, deleted accounts). Drained by /api/internal/reconcile. Rows at 20 attempts stay for inspection.';

-- The object path of one of this user's own uploads in a public bucket, or null.
create function public.storage_cleanup_path(p_url text, p_bucket text, p_owner uuid) returns text
language sql immutable set search_path = '' as $$
  select case
    when v.path ~ ('^' || p_owner::text || '/[0-9a-f]{16}\.(webp|jpg)$') then v.path
  end
  from (select pg_catalog.split_part(coalesce(p_url, ''),
    '/storage/v1/object/public/' || p_bucket || '/', 2) as path) v;
$$;
revoke all on function public.storage_cleanup_path(text, text, uuid) from public, anon, authenticated, service_role;

-- Never fails the user's write: a queueing problem only leaves a file behind, with a warning.
create function public.storage_cleanup_enqueue(p_bucket text, p_path text, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_path is null then return; end if;
  insert into public.storage_cleanup(bucket, path, reason) values (p_bucket, p_path, p_reason)
    on conflict (bucket, path) do update set reason =
      case when excluded.reason = 'account' then 'account' else public.storage_cleanup.reason end;
exception when others then
  raise warning 'storage_cleanup_enqueue %/% failed [%]: %', p_bucket, p_path, sqlstate, sqlerrm;
end;
$$;
revoke all on function public.storage_cleanup_enqueue(text, text, text) from public, anon, authenticated, service_role;

create function public.storage_cleanup_profiles() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_object record;
begin
  if tg_op = 'DELETE' then
    for v_object in select o.bucket_id, o.name from storage.objects o
      where o.bucket_id in ('avatars', 'profile-headers')
        and o.name like old.id::text || '/%'
    loop
      if v_object.name ~ ('^' || old.id::text || '/[0-9a-f]{16}\.(webp|jpg)$') then
        perform public.storage_cleanup_enqueue(v_object.bucket_id, v_object.name, 'account');
      end if;
    end loop;
  elsif old.image is distinct from new.image then
    perform public.storage_cleanup_enqueue('avatars',
      public.storage_cleanup_path(old.image, 'avatars', old.id), 'replaced');
  end if;
  return null;
exception when others then
  raise warning 'storage_cleanup_profiles % failed [%]: %', tg_op, sqlstate, sqlerrm;
  return null;
end;
$$;
revoke all on function public.storage_cleanup_profiles() from public, anon, authenticated, service_role;
create trigger storage_cleanup_profiles
  after update of image or delete on public.profiles
  for each row execute function public.storage_cleanup_profiles();

create function public.storage_cleanup_headers() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.header_image is distinct from new.header_image then
    perform public.storage_cleanup_enqueue('profile-headers',
      public.storage_cleanup_path(old.header_image, 'profile-headers', old.user_id), 'replaced');
  end if;
  return null;
exception when others then
  raise warning 'storage_cleanup_headers failed [%]: %', sqlstate, sqlerrm;
  return null;
end;
$$;
revoke all on function public.storage_cleanup_headers() from public, anon, authenticated, service_role;
create trigger storage_cleanup_headers
  after update of header_image on public.teammate_public_profiles
  for each row execute function public.storage_cleanup_headers();

-- True while some place still shows this file: a profile, a header, or a copy in chat history.
create function public.storage_cleanup_in_use(p_bucket text, p_path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case p_bucket
    when 'avatars' then
      exists (select 1 from public.profiles p
        where pg_catalog.split_part(p.image, '/storage/v1/object/public/avatars/', 2) = p_path)
      or exists (select 1 from public.order_chat_messages m
        where pg_catalog.split_part(m.image, '/storage/v1/object/public/avatars/', 2) = p_path)
      or exists (select 1 from public.support_conversations s
        where pg_catalog.split_part(s.image, '/storage/v1/object/public/avatars/', 2) = p_path)
      or exists (select 1 from public.order_chat_attempts a
        where pg_catalog.strpos(a.result::text, '/storage/v1/object/public/avatars/' || p_path) > 0)
    else
      exists (select 1 from public.teammate_public_profiles t
        where pg_catalog.split_part(t.header_image, '/storage/v1/object/public/profile-headers/', 2) = p_path)
  end;
$$;
revoke all on function public.storage_cleanup_in_use(text, text) from public, anon, authenticated, service_role;

-- The app's side. Claim returns the next files to delete; rows for files still in use (replaced or
-- orphan only) are dropped first. Finish removes deleted rows or counts a failed attempt.
create function public.storage_cleanup_claim(p_limit integer default 100)
returns table (bucket text, path text)
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.storage_cleanup c
    where c.reason <> 'account' and public.storage_cleanup_in_use(c.bucket, c.path);
  return query
    select c.bucket, c.path from public.storage_cleanup c
    where c.attempts < 20
    order by c.queued_at, c.bucket, c.path
    limit least(greatest(coalesce(p_limit, 100), 1), 500);
end;
$$;
revoke all on function public.storage_cleanup_claim(integer) from public, anon, authenticated, service_role;
grant execute on function public.storage_cleanup_claim(integer) to service_role;

create function public.storage_cleanup_finish(p_bucket text, p_paths text[], p_deleted boolean)
returns integer
language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  if p_deleted then
    delete from public.storage_cleanup c where c.bucket = p_bucket and c.path = any(p_paths);
  else
    update public.storage_cleanup c set attempts = c.attempts + 1
      where c.bucket = p_bucket and c.path = any(p_paths);
  end if;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.storage_cleanup_finish(text, text[], boolean) from public, anon, authenticated, service_role;
grant execute on function public.storage_cleanup_finish(text, text[], boolean) to service_role;

-- One-off: files already left behind. Only files older than an hour, so an upload whose profile
-- update is still on its way is never caught; the claim re-checks use anyway.
insert into public.storage_cleanup(bucket, path, reason)
  select o.bucket_id, o.name, 'orphan' from storage.objects o
  where o.bucket_id in ('avatars', 'profile-headers')
    and o.name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{16}\.(webp|jpg)$'
    and o.created_at < pg_catalog.now() - interval '1 hour'
    and not public.storage_cleanup_in_use(o.bucket_id, o.name)
  on conflict (bucket, path) do nothing;

-- The fixer, as in 20261112140000_background_switches_timers.sql, plus the storage queue: it calls
-- the app when a kind is overdue OR files are waiting, and says which in the body.
create or replace function public.background_fix() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_overdue jsonb; v_kinds text[]; v_files boolean; v_secret text; v_valid boolean; v_count bigint;
begin
  v_overdue := public.background_overdue();
  select pg_catalog.array_agg(e.key order by e.key) into v_kinds
    from pg_catalog.jsonb_each(v_overdue) e where e.value = 'true'::jsonb;
  v_files := exists (select 1 from public.storage_cleanup c where c.attempts < 20);
  if v_kinds is null and not v_files then
    return pg_catalog.jsonb_build_object('overdue', v_overdue, 'files', false, 'called', false);
  end if;
  if v_kinds is not null then
    raise warning 'background_fix found overdue work: %', v_kinds;
  end if;
  select pg_catalog.count(*), pg_catalog.min(decrypted_secret),
    pg_catalog.bool_and(pg_catalog.length(decrypted_secret) >= 32)
    into v_count, v_secret, v_valid from vault.decrypted_secrets where name = 'background_reconcile_secret';
  if v_count <> 1 or not coalesce(v_valid, false) then
    raise warning 'background_fix missing/invalid Vault configuration';
    return pg_catalog.jsonb_build_object('overdue', v_overdue, 'files', v_files, 'called', false);
  end if;
  perform net.http_post(
    url := 'https://duoly.gg/api/internal/reconcile',
    headers := pg_catalog.jsonb_build_object(
      'Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
    body := pg_catalog.jsonb_build_object(
      'reason', case when v_kinds is null then 'files' else 'overdue' end,
      'kinds', pg_catalog.to_jsonb(coalesce(v_kinds, '{}'::text[])),
      'files', v_files),
    timeout_milliseconds := 25000);
  return pg_catalog.jsonb_build_object('overdue', v_overdue, 'files', v_files, 'called', true,
    'kinds', pg_catalog.to_jsonb(coalesce(v_kinds, '{}'::text[])));
exception when others then
  raise warning 'background_fix failed [%]: %', sqlstate, sqlerrm;
  return pg_catalog.jsonb_build_object('overdue', coalesce(v_overdue, '{}'::jsonb), 'called', false,
    'error', sqlstate);
end;
$$;
revoke all on function public.background_fix() from public, anon, authenticated, service_role;

commit;
