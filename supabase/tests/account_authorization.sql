-- Run with psql as the approved dev database owner (must be able to SET ROLE).
-- Example: psql -X --set ON_ERROR_STOP=1 --file supabase/tests/account_authorization.sql
-- No pgTAP required. Every success/failure path is rollback-only; do not COMMIT.
-- On failure ON_ERROR_STOP exits psql, disconnecting and rolling back the transaction.
\set ON_ERROR_STOP on
begin;
set local plpgsql.check_asserts = off; -- Explicit RAISE checks must still be effective.

-- Do not delete/reuse a pre-existing account if the fixed fixture IDs collide.
do $$
begin
  if exists (select 1 from auth.users where id in (
    'a1100000-0000-4000-8000-000000000001',
    'a1100000-0000-4000-8000-000000000002'
  ) or email in ('duoly-auth-a@example.invalid', 'duoly-auth-b@example.invalid')) then
    raise exception 'Fixture collision: aborting without changing existing accounts';
  end if;
end;
$$;

-- Hosted postgres cannot SET ROLE supabase_auth_admin. Exercise GoTrue account
-- creation separately through its admin API; these are rollback-only DB fixtures.
insert into auth.users (id, aud, role, email, raw_user_meta_data, raw_app_meta_data)
values
  ('a1100000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
   'duoly-auth-a@example.invalid', '{"role":"admin","name":"Metadata Admin"}', '{"role":"admin"}'),
  ('a1100000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
   'duoly-auth-b@example.invalid', '{"role":"teammate"}', '{}');

do $$
begin
  if (select count(*) from public.profiles where id in (
      'a1100000-0000-4000-8000-000000000001', 'a1100000-0000-4000-8000-000000000002'
    ) and name = 'Player' and country = '' and image = '/assets/avatars/avatar-1.png'
      and created_at is not null and updated_at is not null) <> 2 then
    raise exception 'Auth trigger must create default profiles, ignoring metadata';
  end if;
  if (select count(*) from public.account_roles where user_id in (
      'a1100000-0000-4000-8000-000000000001', 'a1100000-0000-4000-8000-000000000002'
    ) and role = 'customer') <> 2 then
    raise exception 'Metadata must never bootstrap privileged roles';
  end if;
  if pg_catalog.has_function_privilege('authenticated', 'public.handle_new_account()', 'EXECUTE')
     or pg_catalog.has_function_privilege('anon', 'public.handle_new_account()', 'EXECUTE')
     or pg_catalog.has_function_privilege('authenticated', 'public.touch_profile_updated_at()', 'EXECUTE')
     or pg_catalog.has_function_privilege('anon', 'public.touch_profile_updated_at()', 'EXECUTE') then
    raise exception 'Trigger functions must not be executable by application roles';
  end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
do $$
begin
  if exists (select 1 from public.profiles) or exists (select 1 from public.account_roles) then
    raise exception 'Authenticated context without a subject must see no accounts';
  end if;
end;
$$;
select set_config('request.jwt.claim.sub', 'a1100000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"a1100000-0000-4000-8000-000000000001","role":"authenticated"}', true);

do $$
declare
  changed integer;
  old_updated timestamptz;
  command text;
  denied boolean;
begin
  if (select count(*) from public.profiles) <> 1
     or not exists (select 1 from public.profiles where id = 'a1100000-0000-4000-8000-000000000001') then
    raise exception 'A must see only own profile';
  end if;
  if (select count(*) from public.account_roles) <> 1
     or not exists (select 1 from public.account_roles where user_id = 'a1100000-0000-4000-8000-000000000001' and role = 'customer') then
    raise exception 'A must see only own customer role';
  end if;

  select updated_at into strict old_updated from public.profiles
    where id = 'a1100000-0000-4000-8000-000000000001';
  perform pg_catalog.pg_sleep(0.001);
  update public.profiles set name = 'Account A', country = 'at', image = '/assets/avatars/avatar-10.png'
    where id = 'a1100000-0000-4000-8000-000000000001';
  get diagnostics changed = row_count;
  if changed <> 1 or not exists (select 1 from public.profiles
      where name = 'Account A' and country = 'at' and image = '/assets/avatars/avatar-10.png'
        and updated_at > old_updated) then
    raise exception 'Own permitted update or server timestamp failed';
  end if;
  update public.profiles set country = '', image = ''
    where id = 'a1100000-0000-4000-8000-000000000001';
  if not exists (select 1 from public.profiles where country = '' and image = '') then
    raise exception 'Empty country/avatar must remain permitted';
  end if;

  update public.profiles set name = 'Stolen' where id = 'a1100000-0000-4000-8000-000000000002';
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'Cross-user profile update succeeded'; end if;

  -- Only permission errors count as denial, not arbitrary SQL/runtime errors.
  foreach command in array array[
    $q$update public.profiles set id = 'a1100000-0000-4000-8000-000000000003' where id = 'a1100000-0000-4000-8000-000000000001'$q$,
    $q$update public.profiles set created_at = now()$q$,
    $q$update public.profiles set updated_at = now()$q$,
    $q$insert into public.profiles (id) values ('a1100000-0000-4000-8000-000000000001')$q$,
    $q$delete from public.profiles where id = 'a1100000-0000-4000-8000-000000000001'$q$,
    $q$update public.account_roles set role = 'admin' where user_id = 'a1100000-0000-4000-8000-000000000001'$q$,
    $q$update public.account_roles set user_id = 'a1100000-0000-4000-8000-000000000003'$q$,
    $q$insert into public.account_roles (user_id, role) values ('a1100000-0000-4000-8000-000000000001', 'admin')$q$,
    $q$delete from public.account_roles where user_id = 'a1100000-0000-4000-8000-000000000001'$q$
  ] loop
    denied := false;
    begin
      execute command;
    exception when insufficient_privilege then
      denied := true;
    end;
    if not denied then raise exception 'Forbidden authenticated write succeeded: %', command; end if;
  end loop;

  foreach command in array array[
    $q$update public.profiles set name = ''$q$,
    $q$update public.profiles set name = 'A'$q$,
    $q$update public.profiles set name = repeat('A', 33)$q$,
    $q$update public.profiles set name = null$q$,
    $q$update public.profiles set country = 'zz'$q$,
    $q$update public.profiles set country = 'AT'$q$,
    $q$update public.profiles set country = null$q$,
    $q$update public.profiles set image = '/assets/avatars/avatar-0.png'$q$,
    $q$update public.profiles set image = '/assets/avatars/avatar-11.png'$q$,
    $q$update public.profiles set image = 'https://example.invalid/avatar.png'$q$,
    $q$update public.profiles set image = null$q$
  ] loop
    denied := false;
    begin
      execute command;
    exception when check_violation or not_null_violation then
      denied := true;
    end;
    if not denied then raise exception 'Invalid profile value accepted: %', command; end if;
  end loop;
end;
$$;

-- A second independent JWT context must not see A's edited profile or role.
select set_config('request.jwt.claim.sub', 'a1100000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"a1100000-0000-4000-8000-000000000002","role":"authenticated"}', true);
do $$
begin
  if (select count(*) from public.profiles) <> 1
     or not exists (select 1 from public.profiles where id = 'a1100000-0000-4000-8000-000000000002' and name = 'Player') then
    raise exception 'B must see only own unmodified default profile';
  end if;
  if (select count(*) from public.account_roles) <> 1
     or not exists (select 1 from public.account_roles where user_id = 'a1100000-0000-4000-8000-000000000002' and role = 'customer') then
    raise exception 'B must see only own customer role';
  end if;
end;
$$;

reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$
declare
  command text;
  denied boolean;
begin
  foreach command in array array[
    $q$select * from public.profiles$q$,
    $q$select * from public.account_roles$q$,
    $q$insert into public.profiles (id) values ('a1100000-0000-4000-8000-000000000001')$q$,
    $q$update public.profiles set name = 'Anon'$q$,
    $q$delete from public.profiles$q$,
    $q$insert into public.account_roles (user_id) values ('a1100000-0000-4000-8000-000000000001')$q$,
    $q$update public.account_roles set role = 'admin'$q$,
    $q$delete from public.account_roles$q$
  ] loop
    denied := false;
    begin
      execute command;
    exception when insufficient_privilege then
      denied := true;
    end;
    if not denied then raise exception 'Anonymous table access succeeded: %', command; end if;
  end loop;
end;
$$;

reset role;
-- Privileged fixture cleanup exercises FK cascades; the transaction still rolls back.
delete from auth.users where id in (
  'a1100000-0000-4000-8000-000000000001', 'a1100000-0000-4000-8000-000000000002'
);
do $$
begin
  if exists (select 1 from public.profiles where id in (
      'a1100000-0000-4000-8000-000000000001', 'a1100000-0000-4000-8000-000000000002'
    )) or exists (select 1 from public.account_roles where user_id in (
      'a1100000-0000-4000-8000-000000000001', 'a1100000-0000-4000-8000-000000000002'
    )) then
    raise exception 'Deleting auth users must cascade to both account tables';
  end if;
end;
$$;

rollback;
\echo 'Account authorization checks passed; all fixtures and changes rolled back.'
