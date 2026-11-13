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

-- 20261113130000_trophy_case.sql: teammates submit trophies, staff review them, the public profile
-- shows approved ones only, proof files are private and cleaned up with their trophy. Rolled back.

create function pg_temp.ok(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'trophy case: %', label; end if;
end;
$$;
create function pg_temp.as_user(u uuid) returns void language plpgsql as $$ begin
  perform pg_catalog.set_config('request.jwt.claim.sub', u::text, true);
  perform pg_catalog.set_config('request.jwt.claims', pg_catalog.jsonb_build_object('role','authenticated','sub',u)::text, true); end $$;
create function pg_temp.code(r jsonb) returns text language sql as $$ select r->'error'->>'code' $$;

truncate public.storage_cleanup;
insert into auth.users(id, aud, role, email, raw_user_meta_data, raw_app_meta_data) values
  ('9d000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'trophy@example.invalid', '{}', '{}'),
  ('9d000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'trophy-c@example.invalid', '{}', '{}'),
  ('9d000000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated', 'trophy-a@example.invalid', '{}', '{}');
update public.account_roles set role = 'teammate' where user_id = '9d000000-0000-4000-8000-000000000001';
update public.account_roles set role = 'admin' where user_id = '9d000000-0000-4000-8000-0000000000a1';
insert into public.admin_permissions(user_id, sections) values ('9d000000-0000-4000-8000-0000000000a1', array['teammates']);
insert into public.teammate_order_access(user_id, approved_games)
  values ('9d000000-0000-4000-8000-000000000001', array['lol', 'val']);
update public.teammate_public_profiles set slug = 'trophy-fixture'
  where user_id = '9d000000-0000-4000-8000-000000000001';
select pg_temp.ok(exists (select 1 from public.teammate_public_profiles where slug = 'trophy-fixture' and published),
  'fixture teammate has a published profile');

-- ---------------------------------------------------------------- locked down
select pg_temp.ok((select relrowsecurity from pg_catalog.pg_class
  where oid = 'public.teammate_trophies'::pg_catalog.regclass), 'trophies have RLS');
select pg_temp.ok(not pg_catalog.has_table_privilege(r, 'public.teammate_trophies', p), r || ' ' || p || ' denied')
  from pg_catalog.unnest(array['anon','authenticated','service_role']) r,
    pg_catalog.unnest(array['SELECT','INSERT','UPDATE','DELETE']) p;
select pg_temp.ok(exists (select 1 from storage.buckets where id = 'trophy-proofs' and not public
  and file_size_limit = 1048576 and allowed_mime_types = array['image/webp','image/jpeg']), 'private bounded proof bucket');
select pg_temp.ok(pg_catalog.has_function_privilege('anon', 'public.public_teammate_trophies(text)', 'EXECUTE'),
  'visitors read approved trophies');
select pg_temp.ok(not pg_catalog.has_function_privilege('anon', f, 'EXECUTE')
  and pg_catalog.has_function_privilege('authenticated', f, 'EXECUTE'), 'signed-in only: ' || f)
  from pg_catalog.unnest(array['public.teammate_trophy_list()', 'public.teammate_trophy_submit(jsonb,text)',
    'public.teammate_trophy_delete(uuid)', 'public.admin_trophy_queue(text,integer)',
    'public.admin_trophy_review(uuid,text,text,text)']) f;
select pg_temp.ok(not pg_catalog.has_function_privilege(r, f, 'EXECUTE'), r || ' cannot run ' || f)
  from pg_catalog.unnest(array['anon','authenticated']) r,
    pg_catalog.unnest(array['public.teammate_trophy_json(public.teammate_trophies,boolean)',
      'public.storage_cleanup_trophies()']) f;

-- ---------------------------------------------------------------- submitting
select pg_temp.as_user('9d000000-0000-4000-8000-000000000002');
select pg_temp.ok(pg_temp.code(public.teammate_trophy_submit('{"game":"lol","kind":"title","title":"x","proofUrl":"https://op.gg/x"}', null)) = '403',
  'customers cannot submit');
select pg_temp.ok(pg_temp.code(public.teammate_trophy_list()) = '403', 'customers have no trophy list');
select pg_temp.as_user('9d000000-0000-4000-8000-000000000001');
select pg_temp.ok(pg_temp.code(public.teammate_trophy_submit('{"game":"cs2","kind":"title","title":"x","proofUrl":"https://faceit.com/x","rarity":"rare"}', null)) = '400',
  'only approved games');
select pg_temp.ok(pg_temp.code(public.teammate_trophy_submit('{"game":"lol","kind":"rank","ladder":"rank","tier":"challenger","rarity":"mythic"}', null)) = '400',
  'a rank needs moment, season and proof');
select pg_temp.ok(pg_temp.code(public.teammate_trophy_submit('{"game":"lol","kind":"title","title":"<b>x</b>","proofUrl":"https://op.gg/x","rarity":"rare"}', null)) = '400',
  'no markup in text');
select pg_temp.ok(pg_temp.code(public.teammate_trophy_submit('{"game":"lol","kind":"title","title":"x","proofUrl":"javascript:alert(1)","rarity":"rare"}', null)) = '400',
  'https links only');
select pg_temp.ok(pg_temp.code(public.teammate_trophy_submit('{"game":"lol","kind":"title","title":"x","rarity":"rare"}',
  '9d000000-0000-4000-8000-000000000002/0123456789abcdef.webp')) = '400', 'proof files from own folder only');
select pg_temp.ok(pg_temp.code(public.teammate_trophy_submit('{"game":"lol","kind":"leaderboard","position":"abc","season":"S1","proofUrl":"https://op.gg/x","rarity":"rare"}', null)) = '400',
  'bad numbers are a 400, not an error');

create temp table t_ids(name text primary key, id uuid);
insert into t_ids select 'chall', (public.teammate_trophy_submit('{"game":"lol","kind":"rank","ladder":"rank","tier":"challenger",
  "value":1204,"moment":"peak","season":"2026 Split 2","region":"EUW","proofUrl":"https://op.gg/summoners/euw/Valerie-EUW","rarity":"mythic"}',
  '9d000000-0000-4000-8000-000000000001/0123456789abcdef.webp')->'trophy'->>'id')::uuid;
insert into t_ids select 'plat', (public.teammate_trophy_submit('{"game":"lol","kind":"rank","ladder":"rank","tier":"platinum","division":"II",
  "moment":"season_end","season":"2024","rarity":"uncommon"}', '9d000000-0000-4000-8000-000000000001/1111111111111111.jpg')->'trophy'->>'id')::uuid;
insert into t_ids select 'cup', (public.teammate_trophy_submit('{"game":"val","kind":"tournament","event":"Community Cup 4","position":2,
  "proofUrl":"https://liquipedia.net/valorant/x","rarity":"epic"}', null)->'trophy'->>'id')::uuid;
select pg_temp.ok((select pg_catalog.count(*) from t_ids where id is not null) = 3, 'three valid trophies saved');
select pg_temp.ok((select pg_catalog.jsonb_array_length(public.teammate_trophy_list()->'trophies')) = 3, 'owner sees all three');
select pg_temp.ok((select bool_and(x->>'status' = 'pending' and x->'verifiedAt' = 'null'::jsonb)
  from pg_catalog.jsonb_array_elements(public.teammate_trophy_list()->'trophies') x), 'new trophies wait for review');
select pg_temp.ok(public.public_teammate_trophies('trophy-fixture') = '[]'::jsonb, 'pending trophies stay private');

-- ---------------------------------------------------------------- reviewing
select pg_temp.ok(pg_temp.code(public.admin_trophy_queue()) = '403', 'teammates cannot open the queue');
select pg_temp.ok(pg_temp.code(public.admin_trophy_review((select id from t_ids where name = 'chall'), 'approved', null, null)) = '403',
  'teammates cannot approve their own');
select pg_temp.as_user('9d000000-0000-4000-8000-0000000000a1');
select pg_temp.ok((select pg_catalog.jsonb_array_length(public.admin_trophy_queue()->'trophies')) >= 3, 'staff see the queue');
select pg_temp.ok((select x->>'proofPath' from pg_catalog.jsonb_array_elements(public.admin_trophy_queue()->'trophies') x
  where (x->>'id')::uuid = (select id from t_ids where name = 'chall')) = '9d000000-0000-4000-8000-000000000001/0123456789abcdef.webp',
  'staff get the proof path to sign');
select pg_temp.ok(pg_temp.code(public.admin_trophy_review((select id from t_ids where name = 'cup'), 'rejected', null, null)) = '400',
  'a rejection needs a note');
select pg_temp.ok(pg_temp.code(public.admin_trophy_review((select id from t_ids where name = 'chall'), 'approved', 'shiny', null)) = '400',
  'unknown rarity refused');
select pg_temp.ok(public.admin_trophy_review((select id from t_ids where name = 'chall'), 'approved', null, null)->'trophy'->>'status' = 'approved',
  'approve keeps the rarity');
select pg_temp.ok(public.admin_trophy_review((select id from t_ids where name = 'cup'), 'approved', 'rare', null)->'trophy'->>'rarity' = 'rare',
  'staff can set the rarity');
select pg_temp.ok(public.admin_trophy_review((select id from t_ids where name = 'plat'), 'rejected', 'Crop shows no season.', null) is not null,
  'reject with note');
select pg_temp.ok(exists (select 1 from public.admin_audit_log where action = 'Approved trophy'), 'approvals are logged');

-- ---------------------------------------------------------------- the public case
select pg_temp.ok(pg_catalog.jsonb_array_length(public.public_teammate_trophies('trophy-fixture')) = 2, 'two approved trophies show');
select pg_temp.ok(public.public_teammate_trophies('trophy-fixture')->0->>'tier' = 'challenger', 'rarest first');
select pg_temp.ok(not (public.public_teammate_trophies('trophy-fixture')->0 ?| array['status','reviewNote','hasImage','proofPath','note','userId']),
  'visitors never see private fields');
select pg_temp.ok(public.public_teammate_trophies('trophy-fixture')->0->>'verifiedAt' is not null, 'approved trophies carry a date');
update public.teammate_public_profiles set admin_hidden = true where slug = 'trophy-fixture';
select pg_temp.ok(public.public_teammate_trophies('trophy-fixture') = '[]'::jsonb, 'a hidden profile shows nothing');
update public.teammate_public_profiles set admin_hidden = false where slug = 'trophy-fixture';
select pg_temp.ok(public.public_teammate_trophies('no-such-teammate') = '[]'::jsonb, 'unknown slug is empty');

-- ---------------------------------------------------------------- withdrawing and cleanup
select pg_temp.as_user('9d000000-0000-4000-8000-000000000002');
select pg_temp.ok(pg_temp.code(public.teammate_trophy_delete((select id from t_ids where name = 'plat'))) = '404',
  'nobody deletes another teammate''s trophy');
select pg_temp.as_user('9d000000-0000-4000-8000-000000000001');
select pg_temp.ok(public.teammate_trophy_delete((select id from t_ids where name = 'plat'))->>'ok' = 'true', 'owner withdraws');
select pg_temp.ok(exists (select 1 from public.storage_cleanup where bucket = 'trophy-proofs'
  and path = '9d000000-0000-4000-8000-000000000001/1111111111111111.jpg'), 'its proof file is queued');
select pg_temp.ok(not public.storage_cleanup_in_use('trophy-proofs', '9d000000-0000-4000-8000-000000000001/1111111111111111.jpg'),
  'a withdrawn proof is unused');
select pg_temp.ok(public.storage_cleanup_in_use('trophy-proofs', '9d000000-0000-4000-8000-000000000001/0123456789abcdef.webp'),
  'a live proof is in use');
-- Same cleanup an operator runs before deleting an account: rows that do not cascade.
do $$ declare c record; begin
  for c in select conrelid::regclass t, a.attname col from pg_catalog.pg_constraint k
    join pg_catalog.pg_attribute a on a.attrelid = k.conrelid and a.attnum = k.conkey[1]
    where k.contype = 'f' and k.confdeltype <> 'c'
      and k.confrelid in ('public.profiles'::regclass, 'auth.users'::regclass)
      and pg_catalog.cardinality(k.conkey) = 1
  loop
    execute pg_catalog.format('delete from %s where %I = %L', c.t, c.col, '9d000000-0000-4000-8000-000000000001');
  end loop;
end $$;
delete from auth.users where id = '9d000000-0000-4000-8000-000000000001';
select pg_temp.ok(exists (select 1 from public.storage_cleanup where bucket = 'trophy-proofs'
  and path = '9d000000-0000-4000-8000-000000000001/0123456789abcdef.webp'), 'a deleted account queues its proofs');
select pg_temp.ok(not exists (select 1 from public.teammate_trophies where user_id = '9d000000-0000-4000-8000-000000000001'),
  'and its trophies are gone');

do $$ begin raise notice 'trophy_case.sql passed'; end $$;
rollback;
