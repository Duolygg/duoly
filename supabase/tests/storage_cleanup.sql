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

-- 20261113100100_storage_cleanup.sql: old photos and headers, and a deleted account's files, are
-- queued for the app to delete; files something still shows are never deleted. Rolled back.

create function pg_temp.ok(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'storage cleanup: %', label; end if;
end;
$$;
create function pg_temp.queued() returns text[] language sql as $$
  select coalesce(pg_catalog.array_agg(bucket || ':' || path || ':' || reason order by bucket, path),
    '{}'::text[]) from public.storage_cleanup;
$$;

truncate public.storage_cleanup;
insert into auth.users(id, aud, role, email, raw_user_meta_data, raw_app_meta_data) values
  ('9c000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'clean@example.invalid', '{}', '{}'),
  ('9c000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'other@example.invalid', '{}', '{}');
update public.account_roles set role = 'teammate' where user_id = '9c000000-0000-4000-8000-000000000001';
insert into public.teammate_order_access(user_id, approved_games)
  values ('9c000000-0000-4000-8000-000000000001', array['lol']);
update public.teammate_public_profiles set slug = 'cleanup-fixture'
  where user_id = '9c000000-0000-4000-8000-000000000001';
select pg_temp.ok(exists (select 1 from public.teammate_public_profiles where slug = 'cleanup-fixture'),
  'fixture teammate has a public profile');

-- ---------------------------------------------------------------- locked down
select pg_temp.ok((select relrowsecurity from pg_catalog.pg_class
  where oid = 'public.storage_cleanup'::pg_catalog.regclass), 'queue has RLS');
select pg_temp.ok(not pg_catalog.has_table_privilege(r, 'public.storage_cleanup', p), r || ' ' || p || ' denied')
  from pg_catalog.unnest(array['anon','authenticated','service_role']) r,
    pg_catalog.unnest(array['SELECT','INSERT','UPDATE','DELETE']) p;
select pg_temp.ok(pg_catalog.has_function_privilege('service_role', f, 'EXECUTE')
  and not pg_catalog.has_function_privilege('anon', f, 'EXECUTE')
  and not pg_catalog.has_function_privilege('authenticated', f, 'EXECUTE'), 'only the app runs ' || f)
  from pg_catalog.unnest(array['public.storage_cleanup_claim(integer)',
    'public.storage_cleanup_finish(text,text[],boolean)']) f;
select pg_temp.ok(not pg_catalog.has_function_privilege(r, f, 'EXECUTE'), r || ' cannot run ' || f)
  from pg_catalog.unnest(array['anon','authenticated','service_role']) r,
    pg_catalog.unnest(array['public.storage_cleanup_enqueue(text,text,text)',
      'public.storage_cleanup_in_use(text,text)']) f;

-- ---------------------------------------------------------------- replacing a photo or header
update public.profiles set image =
  'https://x.supabase.co/storage/v1/object/public/avatars/9c000000-0000-4000-8000-000000000001/aaaaaaaaaaaaaaaa.webp'
  where id = '9c000000-0000-4000-8000-000000000001';
select pg_temp.ok(pg_temp.queued() = '{}'::text[], 'a first photo queues nothing');
update public.profiles set image =
  'https://x.supabase.co/storage/v1/object/public/avatars/9c000000-0000-4000-8000-000000000001/bbbbbbbbbbbbbbbb.jpg'
  where id = '9c000000-0000-4000-8000-000000000001';
select pg_temp.ok(pg_temp.queued() = array[
  'avatars:9c000000-0000-4000-8000-000000000001/aaaaaaaaaaaaaaaa.webp:replaced'], 'the replaced photo is queued');
update public.profiles set name = 'Renamed' where id = '9c000000-0000-4000-8000-000000000001';
select pg_temp.ok(pg_catalog.cardinality(pg_temp.queued()) = 1, 'other profile edits queue nothing');
-- Somebody else's file, a Discord picture or a stock avatar is never ours to delete.
update public.profiles set image = 'https://cdn.discordapp.com/avatars/1/2.png'
  where id = '9c000000-0000-4000-8000-000000000002';
update public.profiles set image =
  'https://x.supabase.co/storage/v1/object/public/avatars/9c000000-0000-4000-8000-000000000001/cccccccccccccccc.webp'
  where id = '9c000000-0000-4000-8000-000000000002';
update public.profiles set image = '/assets/avatars/avatar-1.png' where id = '9c000000-0000-4000-8000-000000000002';
select pg_temp.ok(pg_catalog.cardinality(pg_temp.queued()) = 1, 'only the owner''s own uploads are queued');

update public.teammate_public_profiles set header_image =
  'https://x.supabase.co/storage/v1/object/public/profile-headers/9c000000-0000-4000-8000-000000000001/dddddddddddddddd.webp'
  where slug = 'cleanup-fixture';
update public.teammate_public_profiles set header_image = null where slug = 'cleanup-fixture';
select pg_temp.ok('profile-headers:9c000000-0000-4000-8000-000000000001/dddddddddddddddd.webp:replaced'
  = any(pg_temp.queued()), 'a removed header is queued');

-- ---------------------------------------------------------------- claim re-checks use
-- The person picks the old photo again (same content, same name): it must survive.
update public.profiles set image =
  'https://x.supabase.co/storage/v1/object/public/avatars/9c000000-0000-4000-8000-000000000001/aaaaaaaaaaaaaaaa.webp'
  where id = '9c000000-0000-4000-8000-000000000001';
select pg_temp.ok(not exists (select 1 from public.storage_cleanup_claim(100) c
  where c.path like '%aaaaaaaaaaaaaaaa.webp'), 'a file back in use is never handed out');
select pg_temp.ok(not exists (select 1 from public.storage_cleanup
  where path like '%aaaaaaaaaaaaaaaa.webp'), 'and its row is dropped');
select pg_temp.ok(exists (select 1 from public.storage_cleanup_claim(100) c
  where c.path like '%bbbbbbbbbbbbbbbb.jpg'), 'the photo it replaced is handed out');

-- ---------------------------------------------------------------- finish
select pg_temp.ok(public.storage_cleanup_finish('avatars',
  array['9c000000-0000-4000-8000-000000000001/bbbbbbbbbbbbbbbb.jpg'], false) = 1, 'a failed delete counts');
select pg_temp.ok((select attempts = 1 from public.storage_cleanup where path like '%bbbbbbbbbbbbbbbb.jpg'),
  'the row stays with one attempt');
update public.storage_cleanup set attempts = 20 where path like '%bbbbbbbbbbbbbbbb.jpg';
select pg_temp.ok(not exists (select 1 from public.storage_cleanup_claim(100) c
  where c.path like '%bbbbbbbbbbbbbbbb.jpg'), 'after 20 attempts it is left for inspection');
select pg_temp.ok(public.storage_cleanup_finish('avatars',
  array['9c000000-0000-4000-8000-000000000001/bbbbbbbbbbbbbbbb.jpg'], true) = 1, 'a delete removes the row');
select pg_temp.ok(not exists (select 1 from public.storage_cleanup where path like '%bbbbbbbbbbbbbbbb.jpg'),
  'the deleted file is off the queue');

-- ---------------------------------------------------------------- deleting an account
-- Every file in the person's folders goes, including the photo in use and copies chat still shows.
insert into storage.objects(bucket_id, name, owner_id) values
  ('avatars', '9c000000-0000-4000-8000-000000000001/aaaaaaaaaaaaaaaa.webp', '9c000000-0000-4000-8000-000000000001'),
  ('avatars', '9c000000-0000-4000-8000-000000000001/eeeeeeeeeeeeeeee.webp', '9c000000-0000-4000-8000-000000000001'),
  ('profile-headers', '9c000000-0000-4000-8000-000000000001/ffffffffffffffff.jpg', '9c000000-0000-4000-8000-000000000001'),
  ('avatars', '9c000000-0000-4000-8000-000000000002/1111111111111111.webp', '9c000000-0000-4000-8000-000000000002');
truncate public.storage_cleanup;
-- Same cleanup an operator runs before deleting an account: rows that do not cascade.
do $$ declare c record; begin
  for c in select conrelid::regclass t, a.attname col from pg_catalog.pg_constraint k
    join pg_catalog.pg_attribute a on a.attrelid = k.conrelid and a.attnum = k.conkey[1]
    where k.contype = 'f' and k.confdeltype <> 'c'
      and k.confrelid in ('public.profiles'::regclass, 'auth.users'::regclass)
      and pg_catalog.cardinality(k.conkey) = 1
  loop
    execute pg_catalog.format('delete from %s where %I = %L', c.t, c.col, '9c000000-0000-4000-8000-000000000001');
  end loop;
end $$;
delete from auth.users where id = '9c000000-0000-4000-8000-000000000001';
select pg_temp.ok(pg_temp.queued() = array[
  'avatars:9c000000-0000-4000-8000-000000000001/aaaaaaaaaaaaaaaa.webp:account',
  'avatars:9c000000-0000-4000-8000-000000000001/eeeeeeeeeeeeeeee.webp:account',
  'profile-headers:9c000000-0000-4000-8000-000000000001/ffffffffffffffff.jpg:account'],
  'a deleted account queues all its files and nobody else''s: ' || pg_temp.queued()::text);
-- A chat message still shows the deleted person's photo; the person asked to leave, so it goes.
insert into public.storage_cleanup(bucket, path, reason) values
  ('avatars', '9c000000-0000-4000-8000-000000000002/1111111111111111.webp', 'orphan');
update public.profiles set image =
  'https://x.supabase.co/storage/v1/object/public/avatars/9c000000-0000-4000-8000-000000000002/1111111111111111.webp'
  where id = '9c000000-0000-4000-8000-000000000002';
select pg_temp.ok((select pg_catalog.count(*) = 3 from public.storage_cleanup_claim(100)),
  'account rows are handed out regardless; an orphan in use is not');

-- ---------------------------------------------------------------- never breaks the user's write
select pg_temp.ok((select pg_catalog.count(*) = 0 from public.storage_cleanup where path = 'nonsense'),
  'precondition');
do $$ begin
  perform public.storage_cleanup_enqueue('avatars', 'nonsense', 'replaced');
  perform public.storage_cleanup_enqueue('order-proof',
    '9c000000-0000-4000-8000-000000000002/1111111111111111.webp', 'replaced');
end $$;
select pg_temp.ok(not exists (select 1 from public.storage_cleanup where path = 'nonsense'
  or bucket = 'order-proof'), 'a bad row is refused with a warning, never an error');

rollback;
