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

-- 20261112163000_public_profile_photos.sql: the photo a teammate uploaded themselves reaches
-- their public profile and their card, somebody else's upload never does, and everything that is
-- neither a mascot nor their own file still falls back to the mascot.

begin;
create temp table assertions(label text);
create function pg_temp.ok(ok boolean,label text) returns void language plpgsql security definer as $$ begin if ok is distinct from true then raise exception 'profile photos: %',label; end if; insert into pg_temp.assertions values(label); end $$;
create function pg_temp.avatar(p_slug text) returns text language sql stable as $$ select public.public_teammate_profile(p_slug)->>'avatar'; $$;
create function pg_temp.card_avatar(p_slug text) returns text language sql stable as $$
  select v->>'avatar' from pg_catalog.jsonb_array_elements(public.public_teammate_cards('val',100)) v where v->>'slug'=p_slug;
$$;

insert into auth.users(id,aud,role,email,raw_user_meta_data,raw_app_meta_data) values
 ('9f100000-0000-4000-8000-000000000001','authenticated','authenticated','photo-one@example.invalid','{}','{}'),
 ('9f100000-0000-4000-8000-000000000002','authenticated','authenticated','photo-two@example.invalid','{}','{}');
update public.account_roles set role='teammate'
  where user_id in ('9f100000-0000-4000-8000-000000000001','9f100000-0000-4000-8000-000000000002');
update public.profiles set name='Photoone' where id='9f100000-0000-4000-8000-000000000001';
update public.profiles set name='Phototwo' where id='9f100000-0000-4000-8000-000000000002';
-- Approving a game publishes the page and picks the slug (20261112130000_public_profiles_default_on.sql).
insert into public.teammate_order_access(user_id,approved_games) values
 ('9f100000-0000-4000-8000-000000000001',array['val']),('9f100000-0000-4000-8000-000000000002',array['val']);
select pg_temp.ok(public.public_teammate_profile('photoone')->>'slug'='photoone','fixture page is live');

-- The mascots still work exactly as before, and an account with no picture gets one.
update public.profiles set image='/assets/avatars/avatar-7.png' where id='9f100000-0000-4000-8000-000000000001';
select pg_temp.ok(pg_temp.avatar('photoone')='/assets/avatars/avatar-7.png','mascot passes through');
update public.profiles set image='' where id='9f100000-0000-4000-8000-000000000001';
select pg_temp.ok(pg_temp.avatar('photoone')='/assets/avatars/avatar-1.png','no picture falls back to the mascot');

-- The teammate's own upload, in their own folder, is what the page now shows.
update public.profiles set image='https://abcdefghij.supabase.co/storage/v1/object/public/avatars/9f100000-0000-4000-8000-000000000001/a1b2c3d4e5f60718.webp'
  where id='9f100000-0000-4000-8000-000000000001';
select pg_temp.ok(pg_temp.avatar('photoone')='https://abcdefghij.supabase.co/storage/v1/object/public/avatars/9f100000-0000-4000-8000-000000000001/a1b2c3d4e5f60718.webp','own WebP upload passes through');
select pg_temp.ok(pg_temp.card_avatar('photoone')=pg_temp.avatar('photoone'),'cards carry the same photo');
update public.profiles set image='https://abcdefghij.supabase.co/storage/v1/object/public/avatars/9f100000-0000-4000-8000-000000000001/00112233445566ff.jpg'
  where id='9f100000-0000-4000-8000-000000000001';
select pg_temp.ok(pg_temp.avatar('photoone')='https://abcdefghij.supabase.co/storage/v1/object/public/avatars/9f100000-0000-4000-8000-000000000001/00112233445566ff.jpg','own JPEG upload passes through');
-- The other teammate's page is unaffected by the first one's picture.
select pg_temp.ok(pg_temp.avatar('phototwo')='/assets/avatars/avatar-1.png','a photo is not shared between teammates');

-- Everything above went through profiles_image_check, which already refuses a foreign folder and
-- a wrong shape on write. These are the same cases with that constraint out of the way, so the
-- read function is shown to fall back on its own rather than trusting the stored value.
alter table public.profiles drop constraint profiles_image_check;
do $$
declare bad text; mascot text := '/assets/avatars/avatar-1.png';
begin
  foreach bad in array array[
    -- somebody else's folder, with and without a matching host
    'https://abcdefghij.supabase.co/storage/v1/object/public/avatars/9f100000-0000-4000-8000-000000000002/a1b2c3d4e5f60718.webp',
    'https://abcdefghij.supabase.co/storage/v1/object/public/avatars/00000000-0000-4000-8000-000000000000/a1b2c3d4e5f60718.webp',
    -- another bucket, a private object path, a traversal back out of the folder
    'https://abcdefghij.supabase.co/storage/v1/object/public/proofs/9f100000-0000-4000-8000-000000000001/a1b2c3d4e5f60718.webp',
    'https://abcdefghij.supabase.co/storage/v1/object/authenticated/avatars/9f100000-0000-4000-8000-000000000001/a1b2c3d4e5f60718.webp',
    'https://abcdefghij.supabase.co/storage/v1/object/public/avatars/9f100000-0000-4000-8000-000000000001/../9f100000-0000-4000-8000-000000000002/a1b2c3d4e5f60718.webp',
    -- not the file names the uploader writes: wrong length, not hex, wrong type, nested
    'https://abcdefghij.supabase.co/storage/v1/object/public/avatars/9f100000-0000-4000-8000-000000000001/a1b2c3d4e5f607.webp',
    'https://abcdefghij.supabase.co/storage/v1/object/public/avatars/9f100000-0000-4000-8000-000000000001/A1B2C3D4E5F60718.webp',
    'https://abcdefghij.supabase.co/storage/v1/object/public/avatars/9f100000-0000-4000-8000-000000000001/a1b2c3d4e5f60718.svg',
    'https://abcdefghij.supabase.co/storage/v1/object/public/avatars/9f100000-0000-4000-8000-000000000001/sub/a1b2c3d4e5f60718.webp',
    -- a query string or a fragment appended to an otherwise valid object
    'https://abcdefghij.supabase.co/storage/v1/object/public/avatars/9f100000-0000-4000-8000-000000000001/a1b2c3d4e5f60718.webp?x=1',
    -- plain http, and a host that only ends in the right suffix
    'http://abcdefghij.supabase.co/storage/v1/object/public/avatars/9f100000-0000-4000-8000-000000000001/a1b2c3d4e5f60718.webp',
    'https://evil.invalid/storage/v1/object/public/avatars/9f100000-0000-4000-8000-000000000001/a1b2c3d4e5f60718.webp',
    -- not an avatar at all
    '/assets/avatars/avatar-11.png',
    'javascript:alert(1)',
    'data:image/webp;base64,AAAA'
  ] loop
    update public.profiles set image=bad where id='9f100000-0000-4000-8000-000000000001';
    perform pg_temp.ok(pg_temp.avatar('photoone')=mascot,'falls back to the mascot: '||bad);
    perform pg_temp.ok(pg_temp.card_avatar('photoone')=mascot,'card falls back to the mascot: '||bad);
  end loop;
end $$;

-- Replacing the function kept the shape of the result and the grants it was installed with.
do $$
declare d jsonb;
begin
  update public.profiles set image='https://abcdefghij.supabase.co/storage/v1/object/public/avatars/9f100000-0000-4000-8000-000000000001/a1b2c3d4e5f60718.webp'
    where id='9f100000-0000-4000-8000-000000000001';
  d := public.public_teammate_profile('photoone');
  perform pg_temp.ok((select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(d))=21
    and d ?& array['slug','name','avatar','country','languages','bio','accent','banner','vibeTags','featuredGame',
      'coaching','online','memberSince','sessions','tier','rating','reviewTags','winRate','games','reviews','updatedAt'],
    'every whitelisted field is still there and nothing else');
  perform pg_temp.ok(not (d ?| array['user_id','userId','id','email','country_code','earnings']),'still no identifiers');
end $$;
select pg_temp.ok(pg_catalog.has_function_privilege('anon','public.public_teammate_profile(text)','execute')
  and pg_catalog.has_function_privilege('authenticated','public.public_teammate_profile(text)','execute'),
  'grants survived the replace');
select pg_temp.ok((select p.prosecdef and p.provolatile='s' and p.proconfig @> array['search_path=']
  from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='public_teammate_profile'),'still a stable definer with an empty search_path');

select count(*) as public_profile_photo_assertions_passed from assertions;
rollback;
