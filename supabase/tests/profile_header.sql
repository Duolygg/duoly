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
create temp table assertions(label text);
create function pg_temp.ok(ok boolean,label text) returns void language plpgsql security definer as $$
begin
  if ok is distinct from true then raise exception 'profile header: %',label; end if;
  insert into pg_temp.assertions values(label);
end $$;
insert into auth.users(id,aud,role,email,raw_user_meta_data,raw_app_meta_data) values
 ('9e000000-0000-4000-8000-000000000001','authenticated','authenticated','header@example.invalid','{}','{}');
update public.account_roles set role='teammate' where user_id='9e000000-0000-4000-8000-000000000001';
insert into public.teammate_order_access(user_id,approved_games)
 values ('9e000000-0000-4000-8000-000000000001',array['lol']);
update public.teammate_public_profiles set slug='header-fixture' where user_id='9e000000-0000-4000-8000-000000000001';
select pg_temp.ok(exists(select 1 from storage.buckets where id='profile-headers' and public
 and file_size_limit=307200 and allowed_mime_types=array['image/webp']),'public bounded webp bucket');
select pg_temp.ok(public.public_teammate_profile('header-fixture')->'header'='null'::jsonb,'absent header is null');
update public.teammate_public_profiles set header_image=
 'https://example.supabase.co/storage/v1/object/public/profile-headers/9e000000-0000-4000-8000-000000000001/0123456789abcdef.webp'
 where slug='header-fixture';
select pg_temp.ok(public.public_teammate_profile('header-fixture')->>'header'=
 'https://example.supabase.co/storage/v1/object/public/profile-headers/9e000000-0000-4000-8000-000000000001/0123456789abcdef.webp','published header returned');
do $$ declare bad text; begin
 foreach bad in array array[
 'http://example.supabase.co/storage/v1/object/public/profile-headers/9e000000-0000-4000-8000-000000000001/0123456789abcdef.webp',
 'https://evil.invalid/storage/v1/object/public/profile-headers/9e000000-0000-4000-8000-000000000001/0123456789abcdef.webp',
 'https://example.supabase.co/storage/v1/object/public/avatars/9e000000-0000-4000-8000-000000000001/0123456789abcdef.webp',
 'https://example.supabase.co/storage/v1/object/public/profile-headers/9e000000-0000-4000-8000-000000000002/0123456789abcdef.webp',
 'https://example.supabase.co/storage/v1/object/public/profile-headers/9e000000-0000-4000-8000-000000000001/0123456789abcdef.jpg',
 'https://example.supabase.co/storage/v1/object/public/profile-headers/9e000000-0000-4000-8000-000000000001/0123456789abcdef.webp?x=1',
 'https://example.supabase.co/storage/v1/object/public/profile-headers/9e000000-0000-4000-8000-000000000001/short.webp', ''] loop
  begin
   update public.teammate_public_profiles set header_image=bad where slug='header-fixture';
   raise exception 'invalid header accepted: %',bad;
  exception when check_violation then perform pg_temp.ok(true,'invalid header rejected'); end;
 end loop;
end $$;
grant insert on assertions to anon;
set local role anon;
select pg_temp.ok(public.public_teammate_profile('header-fixture') ? 'header','anon can read published header');
reset role;
update public.teammate_public_profiles set published=false where slug='header-fixture';
select pg_temp.ok(public.public_teammate_profile('header-fixture')='{"status":"gone"}'::jsonb,'opt-out never exposes header');
update public.teammate_public_profiles set published=true,admin_hidden=true where slug='header-fixture';
select pg_temp.ok(public.public_teammate_profile('header-fixture')='{"status":"gone"}'::jsonb,'moderated profile never exposes header');
update public.teammate_public_profiles set admin_hidden=false where slug='header-fixture';
delete from auth.users where id='9e000000-0000-4000-8000-000000000001';
select pg_temp.ok(public.public_teammate_profile('header-fixture')='{"status":"gone"}'::jsonb,'deleted profile never exposes header');
select count(*) as profile_header_assertions from assertions;
rollback;
