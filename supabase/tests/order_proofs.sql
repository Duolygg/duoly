-- OWNER ONLY, isolated development database, ON_ERROR_STOP. NOT EXECUTED here.
-- Rollback-only synthetic metadata fixtures do NOT create actual Storage bytes.
-- Provider HTTP acceptance must additionally check real PNG/JPEG/WebP, metadata
-- size/mimetype conventions, actual hash/magic, no-store/nosniff, and deletion.
-- Two sessions still required: fifth/sixth + same-key races; finalize/reroll;
-- stale/finalize in both lock schedules, reversed-order multi-order claims,
-- blocked order SKIP LOCKED, and abandon/finalize racing compensators.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';
do $$
declare r text; f text;
begin
  if exists (select 1 from auth.users where id::text like 'f6230000-0000-4000-8000-%')
    or exists (select 1 from public.orders where id::text like 'e6230000-0000-4000-8000-%' or public_reference like 'DL-990623%')
    or exists (select 1 from public.order_assignments where id::text like 'd6230000-0000-4000-8000-%')
    or exists (select 1 from public.order_proof_uploads where id::text like 'c6230000-0000-4000-8000-%')
    or exists (select 1 from public.teammate_order_access where discord_id like '990623%')
    or exists (select 1 from pg_catalog.pg_policies where schemaname = 'storage' and policyname = 'proof_test_permissive') then
    raise exception 'Fixture collision: refusing to overwrite existing data';
  end if;
  if not exists (select 1 from pg_catalog.pg_class where oid = 'public.order_proof_uploads'::regclass and relrowsecurity) then raise exception 'Proof RLS missing'; end if;
  if not exists (select 1 from storage.buckets where id = 'order-proof' and not public and file_size_limit = 1572864
    and allowed_mime_types @> array['image/png','image/jpeg','image/webp'] and pg_catalog.cardinality(allowed_mime_types) = 3) then raise exception 'Private bucket configuration wrong'; end if;
  foreach r in array array['anon','authenticated','service_role'] loop
    foreach f in array array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] loop
      if pg_catalog.has_table_privilege(r,'public.order_proof_uploads',f) then raise exception 'Unexpected proof table privilege: % %',r,f; end if;
    end loop;
    foreach f in array array['public.order_proof_player(public.orders,uuid)','public.order_proof_observer(public.orders,uuid)',
      'public.order_proof_dto(public.order_proof_uploads)','public.order_proof_guard()','public.order_proof_assignment_ended()'] loop
      if pg_catalog.has_function_privilege(r,f,'EXECUTE') then raise exception 'Helper executable: % %',r,f; end if;
    end loop;
  end loop;
  foreach f in array array['public.finalize_order_proof_upload(uuid,text,integer,text)','public.abandon_order_proof_upload(uuid)',
    'public.claim_stale_order_proof_uploads(integer)'] loop
    if pg_catalog.has_function_privilege('anon',f,'EXECUTE') or pg_catalog.has_function_privilege('authenticated',f,'EXECUTE')
      or not pg_catalog.has_function_privilege('service_role',f,'EXECUTE') then raise exception 'Service RPC privilege mismatch: %',f; end if;
  end loop;
  foreach f in array array['public.authorize_order_proof_upload(uuid,uuid)','public.begin_order_proof_upload(uuid,uuid,uuid)','public.list_order_proofs(uuid)','public.get_order_proof(uuid,uuid)'] loop
    if pg_catalog.has_function_privilege('anon',f,'EXECUTE') or pg_catalog.has_function_privilege('service_role',f,'EXECUTE')
      or not pg_catalog.has_function_privilege('authenticated',f,'EXECUTE') then raise exception 'User RPC privilege mismatch: %',f; end if;
  end loop;
  -- Installed definitions, not just source text: owner, SECURITY DEFINER,
  -- empty search_path, and PUBLIC execute revocation for every proof function.
  foreach f in array array[
    'order_proof_player(public.orders,uuid)', 'authorize_order_proof_upload(uuid,uuid)',
    'begin_order_proof_upload(uuid,uuid,uuid)', 'order_proof_guard()',
    'order_proof_dto(public.order_proof_uploads)', 'finalize_order_proof_upload(uuid,text,integer,text)',
    'order_proof_observer(public.orders,uuid)', 'list_order_proofs(uuid)',
    'get_order_proof(uuid,uuid)', 'abandon_order_proof_upload(uuid)',
    'order_proof_assignment_ended()', 'claim_stale_order_proof_uploads(integer)'
  ] loop
    if not exists (select 1 from pg_catalog.pg_proc as p
      where p.oid = ('public.' || f)::regprocedure
        and p.proowner = (select relowner from pg_catalog.pg_class where oid = 'public.order_proof_uploads'::regclass)
        and pg_catalog.pg_get_userbyid(p.proowner) not in ('anon','authenticated','service_role')
        and p.prosecdef = (p.proname not in ('order_proof_player','order_proof_guard','order_proof_dto','order_proof_observer'))
        and p.proconfig = array['search_path=""']::text[]
        and not exists (select 1 from pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) as a
          where a.grantee = 0 and a.privilege_type = 'EXECUTE')) then
      raise exception 'Installed owner/prosecdef/search_path/PUBLIC grants mismatch: %',f;
    end if;
  end loop;
  if not exists (select 1 from pg_catalog.pg_class where oid = 'public.order_proof_cleanup_cursor'::regclass
    and relrowsecurity and relowner = (select relowner from pg_catalog.pg_class where oid = 'public.order_proof_uploads'::regclass)) then
    raise exception 'Private cursor RLS/owner mismatch';
  end if;
  foreach r in array array['anon','authenticated','service_role'] loop
    foreach f in array array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] loop
      if pg_catalog.has_table_privilege(r,'public.order_proof_cleanup_cursor',f) then raise exception 'Private cursor exposed: % %',r,f; end if;
    end loop;
  end loop;
end;
$$;
-- 1 owner, 2 current teammate, 3 replacement teammate, 4 admin, 5 unrelated owner.
insert into auth.users(id,raw_user_meta_data,raw_app_meta_data)
select ('f6230000-0000-4000-8000-' || pg_catalog.lpad(n::text,12,'0'))::uuid,
  '{"role":"admin","suspended":false,"discord_id":"990623999999999999","approved_games":["lol"]}'::jsonb,
  '{"role":"admin"}'::jsonb from pg_catalog.generate_series(1,5) as n;
update public.account_roles set role = case when user_id = 'f6230000-0000-4000-8000-000000000004' then 'admin' else 'teammate' end
  where user_id in ('f6230000-0000-4000-8000-000000000002','f6230000-0000-4000-8000-000000000003','f6230000-0000-4000-8000-000000000004');
insert into public.teammate_order_access(user_id,approved_games,discord_id,discord_verified_at,priority_base)
select ('f6230000-0000-4000-8000-' || pg_catalog.lpad(n::text,12,'0'))::uuid,
  array['lol'],'99062300000000000' || n::text,pg_catalog.clock_timestamp(),0 from pg_catalog.generate_series(2,4) as n;
insert into public.orders(id,public_reference,customer_id,game,service,title,units,unit,region,ign,customer_name,
  amount_eur_cents,booking_fx,payout_usd_cents,created_at,queued_at)
select ('e6230000-0000-4000-8000-' || pg_catalog.lpad(n::text,12,'0'))::uuid,'DL-990623000' || n::text,
  ('f6230000-0000-4000-8000-' || case when n = 1 then '000000000001' else '000000000005' end)::uuid,
  'lol','duo','Proof fixture',1,'game','EUW','Fixture','Fixture',999,1.08,646,
  pg_catalog.clock_timestamp() - interval '4 minutes',pg_catalog.clock_timestamp() - interval '1 minute'
  from pg_catalog.generate_series(1,2) as n;
-- Deliberately hostile permissive policy proves the production restrictive policy
-- actually denies clients even when unrelated permissive policies match everything.
create policy proof_test_permissive on storage.objects for all to anon, authenticated using (true) with check (true);

set local role anon;
select pg_catalog.set_config('request.jwt.claim.sub','',true);
select pg_catalog.set_config('request.jwt.claims','{}',true);
do $$ begin
  begin perform public.list_order_proofs('e6230000-0000-4000-8000-000000000001'); raise exception 'Anon list allowed'; exception when insufficient_privilege then null; end;
  begin perform public.get_order_proof(null,null); raise exception 'Anon get allowed'; exception when insufficient_privilege then null; end;
  begin perform public.begin_order_proof_upload(null,null,null); raise exception 'Anon begin allowed'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.order_proof_uploads; raise exception 'Anon table allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
select pg_catalog.set_config('request.jwt.claims','{"role":"authenticated","user_metadata":{"role":"admin"}}',true);
select pg_catalog.set_config('request.jwt.claim.sub','',true);
do $$ begin
  begin perform public.list_order_proofs('e6230000-0000-4000-8000-000000000001'); raise exception 'No-subject read allowed'; exception when sqlstate 'PT404' then null; end;
  begin perform public.begin_order_proof_upload(null,null,null); raise exception 'No-subject begin allowed'; exception when sqlstate 'PT401' then null; end;
end $$;
select pg_catalog.set_config('request.jwt.claim.sub','f6230000-0000-4000-8000-000000000002',true);
select pg_catalog.set_config('request.jwt.claims','{"role":"authenticated","sub":"f6230000-0000-4000-8000-000000000002"}',true);
do $$
declare v jsonb; v_retry jsonb; n integer; ids jsonb := '[]'::jsonb; a uuid;
begin
  v := public.accept_order('e6230000-0000-4000-8000-000000000001');
  if v #>> '{order,status}' is distinct from 'in_progress' then raise exception 'Fixture accept failed: %',v; end if;
  a := (v #>> '{order,current_assignment_id}')::uuid;
  perform pg_catalog.set_config('proof_test.assignment',a::text,true);
  for n in 1..5 loop
    v := public.begin_order_proof_upload('e6230000-0000-4000-8000-000000000001',a,
      ('b6230000-0000-4000-8000-' || pg_catalog.lpad(n::text,12,'0'))::uuid);
    if v ->> 'state' is distinct from 'pending' or (select count(*) from pg_catalog.jsonb_object_keys(v)) <> 4
      or v ->> 'order_id' is distinct from 'e6230000-0000-4000-8000-000000000001' or v ->> 'assignment_id' is distinct from a::text then raise exception 'Begin DTO mismatch: %',v; end if;
    v_retry := public.begin_order_proof_upload('e6230000-0000-4000-8000-000000000001',a,
      ('b6230000-0000-4000-8000-' || pg_catalog.lpad(n::text,12,'0'))::uuid);
    if v_retry is distinct from v then raise exception 'Duplicate reservation mismatch'; end if;
    ids := ids || pg_catalog.jsonb_build_array(v ->> 'id');
  end loop;
  perform pg_catalog.set_config('proof_test.ids',ids::text,true);
  begin perform public.begin_order_proof_upload('e6230000-0000-4000-8000-000000000001',a,'b6230000-0000-4000-8000-000000000006'); raise exception 'Sixth slot allowed'; exception when sqlstate 'PT409' then null; end;
  begin perform public.begin_order_proof_upload('e6230000-0000-4000-8000-000000000001',a,null); raise exception 'NULL request accepted'; exception when sqlstate 'PT400' then null; end;
  if public.list_order_proofs('e6230000-0000-4000-8000-000000000001') is distinct from '{"proofs":[]}'::jsonb then raise exception 'Pending proof leaked'; end if;
  begin perform public.get_order_proof('e6230000-0000-4000-8000-000000000001',(ids ->> 0)::uuid); raise exception 'Pending get allowed'; exception when sqlstate 'PT404' then null; end;
  begin perform 1 from public.order_proof_uploads; raise exception 'Raw proof read allowed'; exception when insufficient_privilege then null; end;
  begin update public.order_proof_uploads set state = 'ready'; raise exception 'Raw proof write allowed'; exception when insufficient_privilege then null; end;
  begin perform public.order_proof_player(null,null); raise exception 'Helper executable'; exception when insufficient_privilege then null; end;
  begin perform public.finalize_order_proof_upload(null,'image/png',1,pg_catalog.repeat('a',64)); raise exception 'Client finalize allowed'; exception when insufficient_privilege then null; end;
  begin perform public.abandon_order_proof_upload(null); raise exception 'Client abandon allowed'; exception when insufficient_privilege then null; end;
  begin perform public.claim_stale_order_proof_uploads(1); raise exception 'Client cleanup allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
-- Expired UNRELATED queue row is created only AFTER accept_order's sweep.
-- Roll this probe back so later existing queue/reroll acceptance is unchanged.
do $$
declare before_orders jsonb; before_proofs jsonb; before_credits jsonb; v jsonb;
begin
  begin
    update public.orders set created_at = pg_catalog.clock_timestamp() - interval '2 days',
      queued_at = pg_catalog.clock_timestamp() - interval '1 day'
      where id = 'e6230000-0000-4000-8000-000000000002';
    select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(o) order by o.id) into before_orders from public.orders as o;
    select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(p) order by p.id) into before_proofs from public.order_proof_uploads as p;
    select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(c) order by c.id) into before_credits from public.refund_credits as c;
    set local role authenticated;
    v := public.authorize_order_proof_upload('e6230000-0000-4000-8000-000000000001',pg_catalog.current_setting('proof_test.assignment')::uuid);
    if v is distinct from pg_catalog.jsonb_build_object('order_id','e6230000-0000-4000-8000-000000000001',
      'assignment_id',pg_catalog.current_setting('proof_test.assignment')) then raise exception 'Preflight DTO not strict: %',v; end if;
    begin perform public.authorize_order_proof_upload(null,null); raise exception 'NULL preflight accepted'; exception when sqlstate 'PT400' then null; end;
    begin perform public.authorize_order_proof_upload('e6230000-0000-4000-8000-000000000001','d6230000-0000-4000-8000-000000000099'); raise exception 'Wrong preflight assignment accepted'; exception when sqlstate 'PT409' then null; end;
    begin perform public.authorize_order_proof_upload('e6230000-0000-4000-8000-000000000002',pg_catalog.current_setting('proof_test.assignment')::uuid); raise exception 'Unrelated preflight allowed'; exception when sqlstate 'PT404' then null; end;
    perform pg_catalog.set_config('request.jwt.claim.sub','',true);
    perform pg_catalog.set_config('request.jwt.claims','{}',true);
    begin perform public.authorize_order_proof_upload(null,null); raise exception 'No-subject preflight allowed'; exception when sqlstate 'PT401' then null; end;
    reset role;
    if before_orders is distinct from (select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(o) order by o.id) from public.orders as o)
      or before_proofs is distinct from (select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(p) order by p.id) from public.order_proof_uploads as p)
      or before_credits is distinct from (select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(c) order by c.id) from public.refund_credits as c) then
      raise exception 'Allowed/denied preflight mutated orders/reservations/refunds';
    end if;
    if not exists (select 1 from public.orders where id = 'e6230000-0000-4000-8000-000000000002' and status = 'queued')
      or exists (select 1 from public.refund_credits where order_id = 'e6230000-0000-4000-8000-000000000002') then
      raise exception 'Preflight swept expired unrelated row or generated credits';
    end if;
    raise sqlstate 'P0002' using message = 'rollback preflight probe';
  exception when no_data_found then null; end;
end $$;
reset role;
-- Simulate provider metadata ONLY: this does not assert actual image bytes exist.
insert into storage.objects(bucket_id,name,metadata)
select 'order-proof',p.storage_key,pg_catalog.jsonb_build_object('size',case when n = 0 then 1572864 else 12 end,
  'mimetype',case n when 0 then 'image/png' when 1 then 'image/jpeg' else 'image/webp' end)
from pg_catalog.generate_series(0,2) as n join public.order_proof_uploads as p
  on p.id = ((pg_catalog.current_setting('proof_test.ids')::jsonb) ->> n)::uuid;

-- Prove restrictive RLS with an actual object present under a permissive policy.
set local role anon;
do $$ begin
  if exists (select 1 from storage.objects where bucket_id = 'order-proof') then raise exception 'Anon storage read leaked'; end if;
  begin insert into storage.objects(bucket_id,name) values('order-proof','raw-anon'); raise exception 'Anon raw storage write'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
do $$ declare n integer; begin
  if exists (select 1 from storage.objects where bucket_id = 'order-proof') then raise exception 'Authenticated raw storage read leaked'; end if;
  begin insert into storage.objects(bucket_id,name) values('order-proof','raw-client'); raise exception 'Authenticated raw storage write'; exception when insufficient_privilege then null; end;
  update storage.objects set metadata = '{}'::jsonb where bucket_id = 'order-proof'; get diagnostics n = row_count;
  if n <> 0 then raise exception 'Raw storage update allowed'; end if;
  begin
    delete from storage.objects where bucket_id = 'order-proof'; get diagnostics n = row_count;
    if n <> 0 then raise exception 'Raw storage delete allowed'; end if;
  exception when insufficient_privilege then null; end;
end $$;
reset role;

set local role service_role;
select pg_catalog.set_config('request.jwt.claims','{"role":"service_role"}',true);
select pg_catalog.set_config('request.jwt.claim.sub','',true);
do $$
declare ids jsonb := pg_catalog.current_setting('proof_test.ids')::jsonb; v jsonb; w jsonb; n integer; m text;
begin
  begin perform 1 from public.order_proof_uploads; raise exception 'Service raw proof read'; exception when insufficient_privilege then null; end;
  begin delete from public.order_proof_uploads; raise exception 'Service raw proof delete'; exception when insufficient_privilege then null; end;
  begin perform public.finalize_order_proof_upload((ids ->> 3)::uuid,'image/png',12,pg_catalog.repeat('a',64)); raise exception 'Missing object became ready'; exception when sqlstate 'PT409' then null; end;
  foreach n in array array[0,-1,1572865] loop
    begin perform public.finalize_order_proof_upload((ids ->> 0)::uuid,'image/png',n,pg_catalog.repeat('a',64)); raise exception 'Invalid size accepted: %',n; exception when sqlstate 'PT400' then null; end;
  end loop;
  foreach m in array array['image/jpg','text/plain',''] loop
    begin perform public.finalize_order_proof_upload((ids ->> 0)::uuid,m,1572864,pg_catalog.repeat('a',64)); raise exception 'Invalid MIME accepted'; exception when sqlstate 'PT400' then null; end;
  end loop;
  begin perform public.finalize_order_proof_upload((ids ->> 0)::uuid,null,1572864,pg_catalog.repeat('a',64)); raise exception 'NULL MIME accepted'; exception when sqlstate 'PT400' then null; end;
  begin perform public.finalize_order_proof_upload((ids ->> 0)::uuid,'image/png',null,pg_catalog.repeat('a',64)); raise exception 'NULL size accepted'; exception when sqlstate 'PT400' then null; end;
  begin perform public.finalize_order_proof_upload((ids ->> 0)::uuid,'image/png',1572864,null); raise exception 'NULL digest accepted'; exception when sqlstate 'PT400' then null; end;
  begin perform public.finalize_order_proof_upload((ids ->> 0)::uuid,'image/png',1572864,pg_catalog.repeat('A',64)); raise exception 'Noncanonical digest accepted'; exception when sqlstate 'PT400' then null; end;
  begin perform public.finalize_order_proof_upload((ids ->> 0)::uuid,'image/png',12,pg_catalog.repeat('a',64)); raise exception 'Provider size mismatch accepted'; exception when sqlstate 'PT409' then null; end;
  begin perform public.finalize_order_proof_upload((ids ->> 0)::uuid,'image/jpeg',1572864,pg_catalog.repeat('a',64)); raise exception 'Provider MIME mismatch accepted'; exception when sqlstate 'PT409' then null; end;
  for n in 0..2 loop
    m := case n when 0 then 'image/png' when 1 then 'image/jpeg' else 'image/webp' end;
    v := public.finalize_order_proof_upload((ids ->> n)::uuid,m,case when n = 0 then 1572864 else 12 end,pg_catalog.repeat('a',64));
    w := public.finalize_order_proof_upload((ids ->> n)::uuid,m,case when n = 0 then 1572864 else 12 end,pg_catalog.repeat('a',64));
    if v is distinct from w or v #>> '{proof,mime}' is distinct from m or (select count(*) from pg_catalog.jsonb_object_keys(v -> 'proof')) <> 6 then raise exception 'Ready DTO/idempotency failed: %',v; end if;
    if v -> 'proof' ?| array['uploader_id','storage_key','sha256','request_id','ready_at','state'] then raise exception 'Private metadata leaked'; end if;
  end loop;
  begin perform public.finalize_order_proof_upload((ids ->> 0)::uuid,'image/png',1572864,pg_catalog.repeat('b',64)); raise exception 'Different duplicate accepted'; exception when sqlstate 'PT409' then null; end;
  if public.abandon_order_proof_upload((ids ->> 0)::uuid) is distinct from '{"abandoned":false}'::jsonb then raise exception 'Ready object eligible for deletion'; end if;
  if public.abandon_order_proof_upload(null) is distinct from '{"abandoned":false}'::jsonb then raise exception 'Missing object eligible for deletion'; end if;
end $$;
reset role;
-- Direct owner attempts still cannot rewrite ready evidence; owner cleanup DELETE
-- is intentionally available, tested inside a subtransaction below and rolled back.
do $$ declare v_id uuid := ((pg_catalog.current_setting('proof_test.ids')::jsonb) ->> 0)::uuid; begin
  begin update public.order_proof_uploads set sha256 = pg_catalog.repeat('b',64) where order_proof_uploads.id = v_id; raise exception 'Ready metadata mutable'; exception when sqlstate 'PT409' then null; end;
  begin
    delete from public.order_proof_uploads where order_proof_uploads.id = v_id;
    if exists (select 1 from public.order_proof_uploads where order_proof_uploads.id = v_id) then raise exception 'Owner maintenance DELETE blocked'; end if;
    raise sqlstate 'P0002' using message = 'rollback delete probe';
  exception when no_data_found then null; end;
  if not exists (select 1 from public.order_proof_uploads where order_proof_uploads.id = v_id and sha256 = pg_catalog.repeat('a',64)) then raise exception 'Ready hash not retained privately'; end if;
end $$;
-- Stored object with absent/forged metadata cannot become ready. user_metadata
-- is never consulted; metadata is provider-controlled, verified separately live.
insert into storage.objects(bucket_id,name,metadata,user_metadata)
select 'order-proof',storage_key,'{}'::jsonb,'{"size":12,"mimetype":"image/png"}'::jsonb
  from public.order_proof_uploads where id = ((pg_catalog.current_setting('proof_test.ids')::jsonb) ->> 3)::uuid;
set local role service_role;
do $$ begin
  begin perform public.finalize_order_proof_upload(((pg_catalog.current_setting('proof_test.ids')::jsonb) ->> 3)::uuid,'image/png',12,pg_catalog.repeat('a',64)); raise exception 'Client metadata trusted as provider metadata'; exception when sqlstate 'PT409' then null; end;
end $$;
reset role;

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub','f6230000-0000-4000-8000-000000000002',true);
select pg_catalog.set_config('request.jwt.claims','{"role":"authenticated","sub":"f6230000-0000-4000-8000-000000000002","user_metadata":{"role":"admin","suspended":false}}',true);
do $$ declare v jsonb; begin
  v := public.list_order_proofs('e6230000-0000-4000-8000-000000000001');
  if pg_catalog.jsonb_array_length(v -> 'proofs') <> 3 then raise exception 'Assigned teammate missing ready proof'; end if;
  perform public.get_order_proof('e6230000-0000-4000-8000-000000000001',((pg_catalog.current_setting('proof_test.ids')::jsonb) ->> 0)::uuid);
  begin perform public.get_order_proof('e6230000-0000-4000-8000-000000000002',((pg_catalog.current_setting('proof_test.ids')::jsonb) ->> 0)::uuid); raise exception 'Wrong order pairing leaked'; exception when sqlstate 'PT404' then null; end;
end $$;
reset role;
-- Fresh role revocation, despite stale/forged admin metadata.
update public.account_roles set role = 'customer' where user_id = 'f6230000-0000-4000-8000-000000000002';
set local role authenticated;
do $$ begin
  begin perform public.list_order_proofs('e6230000-0000-4000-8000-000000000001'); raise exception 'Fresh role ignored on read'; exception when sqlstate 'PT404' then null; end;
  begin perform public.begin_order_proof_upload('e6230000-0000-4000-8000-000000000001',pg_catalog.current_setting('proof_test.assignment')::uuid,'b6230000-0000-4000-8000-000000000001'); raise exception 'Fresh role ignored on begin'; exception when sqlstate 'PT403' then null; end;
end $$;
reset role;
set local role service_role;
do $$ begin
  begin perform public.finalize_order_proof_upload(((pg_catalog.current_setting('proof_test.ids')::jsonb) ->> 0)::uuid,'image/png',1572864,pg_catalog.repeat('a',64)); raise exception 'Fresh role ignored on finalize retry'; exception when sqlstate 'PT409' then null; end;
end $$;
reset role;
update public.account_roles set role = 'teammate' where user_id = 'f6230000-0000-4000-8000-000000000002';
-- Exercise each fresh access check in its own rollbackable owner subtransaction.
do $$ declare mode integer; begin
  for mode in 1..4 loop
    begin
      update public.teammate_order_access set suspended = mode = 1,
        discord_id = case when mode = 2 then null else discord_id end,
        discord_verified_at = case when mode = 2 then null else discord_verified_at end,
        approved_games = case when mode = 3 then '{}'::text[] else approved_games end,
        gg_access = mode = 4 where user_id = 'f6230000-0000-4000-8000-000000000002';
      set local role authenticated;
      begin perform public.list_order_proofs('e6230000-0000-4000-8000-000000000001'); raise exception 'Fresh access ignored: %',mode; exception when sqlstate 'PT404' then null; end;
      begin perform public.begin_order_proof_upload('e6230000-0000-4000-8000-000000000001',pg_catalog.current_setting('proof_test.assignment')::uuid,'b6230000-0000-4000-8000-000000000001'); raise exception 'Fresh begin access ignored: %',mode; exception when sqlstate 'PT404' then null; end;
      reset role;
      set local role service_role;
      begin perform public.finalize_order_proof_upload(((pg_catalog.current_setting('proof_test.ids')::jsonb) ->> 0)::uuid,'image/png',1572864,pg_catalog.repeat('a',64)); raise exception 'Fresh finalize access ignored: %',mode; exception when sqlstate 'PT409' then null; end;
      reset role;
      raise sqlstate 'P0002' using message = 'rollback access probe';
    exception when no_data_found then null; end;
  end loop;
end $$;
reset role;
set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub','f6230000-0000-4000-8000-000000000004',true);
do $$ begin
  if pg_catalog.jsonb_array_length(public.list_order_proofs('e6230000-0000-4000-8000-000000000001') -> 'proofs') <> 3 then raise exception 'Admin read denied'; end if;
  perform public.get_order_proof('e6230000-0000-4000-8000-000000000001',((pg_catalog.current_setting('proof_test.ids')::jsonb) ->> 0)::uuid);
  begin perform public.begin_order_proof_upload('e6230000-0000-4000-8000-000000000001',pg_catalog.current_setting('proof_test.assignment')::uuid,'b6230000-0000-4000-8000-000000000001'); raise exception 'Admin upload allowed'; exception when sqlstate 'PT403' then null; end;
end $$;
select pg_catalog.set_config('request.jwt.claim.sub','f6230000-0000-4000-8000-000000000005',true);
do $$ begin
  begin perform public.get_order_proof('e6230000-0000-4000-8000-000000000001',((pg_catalog.current_setting('proof_test.ids')::jsonb) ->> 0)::uuid); raise exception 'Unrelated customer read allowed'; exception when sqlstate 'PT404' then null; end;
  -- Caller owns order 2 but proof 1 belongs to order 1.
  begin perform public.get_order_proof('e6230000-0000-4000-8000-000000000002',((pg_catalog.current_setting('proof_test.ids')::jsonb) ->> 0)::uuid); raise exception 'Owned wrong-order pairing allowed'; exception when sqlstate 'PT404' then null; end;
end $$;
select pg_catalog.set_config('request.jwt.claim.sub','f6230000-0000-4000-8000-000000000003',true);
do $$ begin
  begin perform public.list_order_proofs('e6230000-0000-4000-8000-000000000001'); raise exception 'Unrelated teammate read allowed'; exception when sqlstate 'PT404' then null; end;
end $$;
select pg_catalog.set_config('request.jwt.claim.sub','f6230000-0000-4000-8000-000000000001',true);
do $$ begin
  if pg_catalog.jsonb_array_length(public.list_order_proofs('e6230000-0000-4000-8000-000000000001') -> 'proofs') <> 3 then raise exception 'Customer read denied'; end if;
  if public.reroll_order('e6230000-0000-4000-8000-000000000001') #>> '{order,status}' is distinct from 'queued' then raise exception 'Reroll failed'; end if;
  if pg_catalog.jsonb_array_length(public.list_order_proofs('e6230000-0000-4000-8000-000000000001') -> 'proofs') <> 3 then raise exception 'Historical ready evidence lost'; end if;
end $$;
reset role;
do $$ begin
  if (select count(*) from public.order_proof_uploads where assignment_id = pg_catalog.current_setting('proof_test.assignment')::uuid and state = 'ready') <> 3
    or (select count(*) from public.order_proof_uploads where assignment_id = pg_catalog.current_setting('proof_test.assignment')::uuid and state = 'abandoned') <> 2 then raise exception 'Reroll did not abandon ONLY pending'; end if;
end $$;
set local role service_role;
do $$ begin
  begin perform public.finalize_order_proof_upload(((pg_catalog.current_setting('proof_test.ids')::jsonb) ->> 3)::uuid,'image/png',12,pg_catalog.repeat('a',64)); raise exception 'Old pending finalize survived reroll'; exception when sqlstate 'PT409' then null; end;
  begin perform public.finalize_order_proof_upload(((pg_catalog.current_setting('proof_test.ids')::jsonb) ->> 0)::uuid,'image/png',1572864,pg_catalog.repeat('a',64)); raise exception 'Old ready retry survived reroll'; exception when sqlstate 'PT409' then null; end;
end $$;
reset role;
set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub','f6230000-0000-4000-8000-000000000002',true);
do $$ begin
  begin perform public.list_order_proofs('e6230000-0000-4000-8000-000000000001'); raise exception 'Former teammate read survived reroll'; exception when sqlstate 'PT404' then null; end;
  begin perform public.get_order_proof('e6230000-0000-4000-8000-000000000001',((pg_catalog.current_setting('proof_test.ids')::jsonb) ->> 0)::uuid); raise exception 'Former teammate opened old ready'; exception when sqlstate 'PT404' then null; end;
end $$;
select pg_catalog.set_config('request.jwt.claim.sub','f6230000-0000-4000-8000-000000000003',true);
do $$ declare v jsonb; a uuid; begin
  v := public.accept_order('e6230000-0000-4000-8000-000000000001');
  if v #>> '{order,status}' is distinct from 'in_progress' then raise exception 'Replacement accept failed'; end if;
  a := (v #>> '{order,current_assignment_id}')::uuid;
  perform pg_catalog.set_config('proof_test.replacement',a::text,true);
  if public.list_order_proofs('e6230000-0000-4000-8000-000000000001') is distinct from '{"proofs":[]}'::jsonb then raise exception 'Replacement saw history/count'; end if;
  begin perform public.get_order_proof('e6230000-0000-4000-8000-000000000001',((pg_catalog.current_setting('proof_test.ids')::jsonb) ->> 0)::uuid); raise exception 'Replacement opened old ready'; exception when sqlstate 'PT404' then null; end;
  -- Same request UUID is isolated by assignment; old five slots do not consume new ones.
  v := public.begin_order_proof_upload('e6230000-0000-4000-8000-000000000001',a,'b6230000-0000-4000-8000-000000000001');
  if v ->> 'id' = (pg_catalog.current_setting('proof_test.ids')::jsonb ->> 0) then raise exception 'Request key crossed assignments'; end if;
  perform pg_catalog.set_config('proof_test.new_id',v ->> 'id',true);
end $$;
reset role;
insert into storage.objects(bucket_id,name,metadata)
select 'order-proof',storage_key,'{"size":12,"mimetype":"image/png"}'::jsonb from public.order_proof_uploads where id = pg_catalog.current_setting('proof_test.new_id')::uuid;
set local role service_role;
do $$ begin
  perform public.finalize_order_proof_upload(pg_catalog.current_setting('proof_test.new_id')::uuid,'image/png',12,pg_catalog.repeat('b',64));
end $$;
reset role;
set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub','f6230000-0000-4000-8000-000000000002',true);
do $$ begin
  begin perform public.get_order_proof('e6230000-0000-4000-8000-000000000001',pg_catalog.current_setting('proof_test.new_id')::uuid); raise exception 'Former teammate opened replacement proof'; exception when sqlstate 'PT404' then null; end;
end $$;
select pg_catalog.set_config('request.jwt.claim.sub','f6230000-0000-4000-8000-000000000004',true);
do $$ begin
  if pg_catalog.jsonb_array_length(public.list_order_proofs('e6230000-0000-4000-8000-000000000001') -> 'proofs') <> 4 then raise exception 'Admin lost history after replacement'; end if;
end $$;
reset role;
-- Duplicate request constraint and composite actor/assignment FK independent of RPC.
do $$ begin
  begin
    insert into public.order_proof_uploads(order_id,assignment_id,uploader_id,request_id)
    values('e6230000-0000-4000-8000-000000000001',pg_catalog.current_setting('proof_test.replacement')::uuid,'f6230000-0000-4000-8000-000000000003','b6230000-0000-4000-8000-000000000001');
    raise exception 'Duplicate request constraint missing';
  exception when unique_violation then null; end;
  begin
    insert into public.order_proof_uploads(order_id,assignment_id,uploader_id,request_id)
    values('e6230000-0000-4000-8000-000000000001',pg_catalog.current_setting('proof_test.replacement')::uuid,'f6230000-0000-4000-8000-000000000002','b6230000-0000-4000-8000-000000000099');
    raise exception 'Composite assignment uploader FK missing';
  exception when foreign_key_violation then null; end;
end $$;
-- Owner inserts OLD reservations at creation (immutable created_at cannot be aged
-- afterwards). Only one order in these cleanup fixtures; multi-order locking is
-- a separate two-session acceptance. No production retention/TTL is inferred.
insert into public.order_proof_uploads(id,order_id,assignment_id,uploader_id,request_id,created_at)
select ('c6230000-0000-4000-8000-' || pg_catalog.lpad(n::text,12,'0'))::uuid,
  'e6230000-0000-4000-8000-000000000001',pg_catalog.current_setting('proof_test.replacement')::uuid,
  'f6230000-0000-4000-8000-000000000003',('b6230000-0000-4000-8000-' || pg_catalog.lpad((n+10)::text,12,'0'))::uuid,
  pg_catalog.clock_timestamp() - interval '2 hours' from pg_catalog.generate_series(1,3) as n;
-- Old READY proof must be excluded even though its age qualifies. A fresh
-- pending proof must not be claimed simply because the batch has capacity.
insert into storage.objects(bucket_id,name,metadata)
select 'order-proof',storage_key,'{"size":12,"mimetype":"image/webp"}'::jsonb
  from public.order_proof_uploads where id = 'c6230000-0000-4000-8000-000000000003';
set local role service_role;
do $$ begin
  perform public.finalize_order_proof_upload('c6230000-0000-4000-8000-000000000003','image/webp',12,pg_catalog.repeat('c',64));
end $$;
reset role;
set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub','f6230000-0000-4000-8000-000000000003',true);
do $$ declare v jsonb; begin
  v := public.begin_order_proof_upload('e6230000-0000-4000-8000-000000000001',pg_catalog.current_setting('proof_test.replacement')::uuid,'b6230000-0000-4000-8000-000000000015');
  perform pg_catalog.set_config('proof_test.discard_id',v ->> 'id',true);
end $$;
reset role;
set local role service_role;
do $$ begin
  if public.abandon_order_proof_upload(pg_catalog.current_setting('proof_test.discard_id')::uuid) is distinct from '{"abandoned":true}'::jsonb
    or public.abandon_order_proof_upload(pg_catalog.current_setting('proof_test.discard_id')::uuid) is distinct from '{"abandoned":true}'::jsonb then raise exception 'Pending abandon/retry failed'; end if;
end $$;
reset role;
set local role authenticated;
do $$ declare v jsonb; begin
  v := public.begin_order_proof_upload('e6230000-0000-4000-8000-000000000001',pg_catalog.current_setting('proof_test.replacement')::uuid,'b6230000-0000-4000-8000-000000000014');
  perform pg_catalog.set_config('proof_test.fresh_id',v ->> 'id',true);
end $$;
reset role;
-- In an isolated DB no unrelated stale rows may affect deterministic claim counts.
do $$ begin
  if exists (select 1 from public.order_proof_uploads where state in ('pending','abandoned') and created_at < pg_catalog.clock_timestamp() - interval '1 hour' and id::text not like 'c6230000-0000-4000-8000-%') then raise exception 'Fixture requires isolated DB: unrelated stale reservations'; end if;
end $$;
set local role service_role;
do $$ declare v jsonb; w jsonb; n integer; begin
  foreach n in array array[0,-1,501] loop
    begin perform public.claim_stale_order_proof_uploads(n); raise exception 'Unsafe claim bound accepted'; exception when sqlstate 'PT400' then null; end;
  end loop;
  begin perform public.claim_stale_order_proof_uploads(null); raise exception 'NULL claim accepted'; exception when sqlstate 'PT400' then null; end;
  v := public.claim_stale_order_proof_uploads(1);
  w := public.claim_stale_order_proof_uploads(1);
  if pg_catalog.jsonb_array_length(v -> 'proofs') <> 1 or pg_catalog.jsonb_array_length(w -> 'proofs') <> 1 or v = w then raise exception 'Bounded claim rotation starved later work'; end if;
  if (select count(*) from pg_catalog.jsonb_object_keys(v #> '{proofs,0}')) <> 3 then raise exception 'Cleanup DTO leaked private metadata'; end if;
  v := public.claim_stale_order_proof_uploads(500);
  if pg_catalog.jsonb_array_length(v -> 'proofs') <> 2 then raise exception 'Retryable cleanup not repeatable or ready/new rows claimed'; end if;
  if public.abandon_order_proof_upload('c6230000-0000-4000-8000-000000000001') is distinct from '{"abandoned":true}'::jsonb then raise exception 'Abandon retry failed'; end if;
  begin perform public.finalize_order_proof_upload('c6230000-0000-4000-8000-000000000001','image/png',12,pg_catalog.repeat('a',64)); raise exception 'Stale reservation finalized'; exception when sqlstate 'PT409' then null; end;
  if public.abandon_order_proof_upload(pg_catalog.current_setting('proof_test.new_id')::uuid) is distinct from '{"abandoned":false}'::jsonb then raise exception 'Claim enabled ready deletion'; end if;
end $$;
reset role;
set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub','f6230000-0000-4000-8000-000000000003',true);
do $$ begin
  begin perform public.begin_order_proof_upload('e6230000-0000-4000-8000-000000000001',pg_catalog.current_setting('proof_test.replacement')::uuid,'b6230000-0000-4000-8000-000000000011'); raise exception 'Abandoned request resurrected'; exception when sqlstate 'PT409' then null; end;
end $$;
reset role;
do $$ begin
  if (select count(*) from public.order_proof_uploads where order_id = 'e6230000-0000-4000-8000-000000000001' and state = 'ready') <> 5 then raise exception 'Maintenance modified ready count'; end if;
  if not exists (select 1 from public.order_proof_uploads where id = pg_catalog.current_setting('proof_test.fresh_id')::uuid and state = 'pending' and cleanup_claimed_at is null) then raise exception 'Fresh reservation was claimed'; end if;
  if (select count(*) from public.order_proof_uploads where id::text like 'c6230000-0000-4000-8000-%' and state = 'abandoned' and cleanup_claimed_at is not null) <> 2 then raise exception 'Stale claim not persisted'; end if;
  if exists (select 1 from public.orders where id::text like 'e6230000-0000-4000-8000-%' and (status in ('completed','cancelled') or completed_at is not null or cancelled_at is not null)) then raise exception 'Proof changed lifecycle'; end if;
  if exists (select 1 from public.refund_credits where order_id::text like 'e6230000-0000-4000-8000-%') then raise exception 'Proof generated money'; end if;
end $$;
rollback;
