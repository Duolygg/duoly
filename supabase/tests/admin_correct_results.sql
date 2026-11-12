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

-- Rollback-only checks for 20261105140000_admin_correct_results.sql. Run after the migration body in
-- one transaction (begin; <migration without begin/commit>; <this file>; rollback;).
-- A owner admin, B admin with only Payouts, T teammate, C customer; one completed win/loss order.
create function pg_temp.ok(b boolean, l text) returns void language plpgsql as $$
begin if b is distinct from true then raise exception 'correct results assertion: %', l; end if; end $$;
create function pg_temp.as_user(u uuid) returns void language plpgsql as $$ begin
  perform pg_catalog.set_config('request.jwt.claim.sub', u::text, true);
  perform pg_catalog.set_config('request.jwt.claims', pg_catalog.jsonb_build_object('role','authenticated','sub',u)::text, true); end $$;

insert into auth.users(id,aud,role,email,raw_user_meta_data,raw_app_meta_data) values
 ('7b000000-0000-4000-8000-0000000000a0','authenticated','authenticated','cr-a@example.invalid','{}','{}'),
 ('7b000000-0000-4000-8000-0000000000a2','authenticated','authenticated','cr-b@example.invalid','{}','{}'),
 ('7b000000-0000-4000-8000-000000000051','authenticated','authenticated','cr-t@example.invalid','{}','{}'),
 ('7b000000-0000-4000-8000-0000000000c1','authenticated','authenticated','cr-c@example.invalid','{}','{}');
update public.account_roles set role='admin', owner=true where user_id='7b000000-0000-4000-8000-0000000000a0';
update public.account_roles set role='admin' where user_id='7b000000-0000-4000-8000-0000000000a2';
insert into public.admin_permissions(user_id, sections) values ('7b000000-0000-4000-8000-0000000000a2', array['payouts']);
update public.account_roles set role='teammate' where user_id='7b000000-0000-4000-8000-000000000051';
insert into public.teammate_order_access(user_id,approved_games,discord_id,discord_verified_at)
  values ('7b000000-0000-4000-8000-000000000051',array['lol'],'730000000000000051',pg_catalog.now());

-- a completed 3-game win/loss order with a report the teammate made up (3 wins)
insert into public.orders(id,customer_id,game,service,title,units,unit,region,ign,customer_name,amount_eur_cents,booking_fx,payout_usd_cents,created_at,queued_at)
  values('7b000000-0000-4000-8000-0000000000e1','7b000000-0000-4000-8000-0000000000c1','lol','duo1','Duo Plus',3,'game','EUW','Viewer#EUW','C',1497,1.08,900,
    pg_catalog.clock_timestamp()-interval '2 hours',pg_catalog.clock_timestamp()-interval '2 hours');
insert into public.order_assignments(id,order_id,teammate_id,accepted_at,ended_at,end_reason)
  values('7b000000-0000-4000-8000-0000000000f1','7b000000-0000-4000-8000-0000000000e1','7b000000-0000-4000-8000-000000000051',
    pg_catalog.clock_timestamp()-interval '90 minutes',pg_catalog.clock_timestamp()-interval '10 minutes','completed');
update public.orders set status='completed',assigned_teammate_id='7b000000-0000-4000-8000-000000000051',
  current_assignment_id='7b000000-0000-4000-8000-0000000000f1',accepted_at=pg_catalog.clock_timestamp()-interval '90 minutes',
  completed_at=pg_catalog.clock_timestamp()-interval '10 minutes' where id='7b000000-0000-4000-8000-0000000000e1';
insert into public.order_match_reports(assignment_id,order_id,teammate_id,games,wins,losses) values
 ('7b000000-0000-4000-8000-0000000000f1','7b000000-0000-4000-8000-0000000000e1','7b000000-0000-4000-8000-000000000051',
  '[{"teammateIgn":"T#1","customerIgn":"Viewer#EUW","link":"https://example.test/1"},{"teammateIgn":"T#1","customerIgn":"Viewer#EUW","link":"https://example.test/2"},{"teammateIgn":"T#1","customerIgn":"Viewer#EUW","link":"https://example.test/3"}]',3,0);
insert into public.order_proof_uploads(id,order_id,assignment_id,uploader_id,request_id,state,mime,byte_size,sha256,ready_at) values
 ('7b000000-0000-4000-8000-00000000aa01','7b000000-0000-4000-8000-0000000000e1','7b000000-0000-4000-8000-0000000000f1','7b000000-0000-4000-8000-000000000051',
  pg_catalog.gen_random_uuid(),'ready','image/png',100,pg_catalog.repeat('a',64),pg_catalog.clock_timestamp()+interval '1 second'),
 ('7b000000-0000-4000-8000-00000000aa02','7b000000-0000-4000-8000-0000000000e1','7b000000-0000-4000-8000-0000000000f1','7b000000-0000-4000-8000-000000000051',
  pg_catalog.gen_random_uuid(),'ready','image/png',100,pg_catalog.repeat('b',64),pg_catalog.clock_timestamp()+interval '1 second');

-- B (only Payouts) can't touch it
select pg_temp.as_user('7b000000-0000-4000-8000-0000000000a2');
select pg_temp.ok((public.admin_edit_match_report('7b000000-0000-4000-8000-0000000000f1','[]',0,0,'x')->'error'->>'code')='403','B cannot edit reports');
select pg_temp.ok((public.admin_order_proofs('7b000000-0000-4000-8000-0000000000e1')->'error'->>'code')='403','B cannot see screenshots');

-- A corrects the report
select pg_temp.as_user('7b000000-0000-4000-8000-0000000000a0');
select pg_temp.ok((public.admin_edit_match_report('7b000000-0000-4000-8000-0000000000f1',
  '[{"teammateIgn":"T#1","customerIgn":"Viewer#EUW","link":"https://example.test/1"}]',1,0,'Match history')->'error'->>'code')='400','must keep all games');
select pg_temp.ok((public.admin_edit_match_report('7b000000-0000-4000-8000-0000000000f1',
  (select games from public.order_match_reports where assignment_id='7b000000-0000-4000-8000-0000000000f1'),2,2,'Match history')->'error'->>'code')='400','wins+losses = games');
select pg_temp.ok((public.admin_edit_match_report('7b000000-0000-4000-8000-0000000000f1',
  (select games from public.order_match_reports where assignment_id='7b000000-0000-4000-8000-0000000000f1'),1,2,'')->'error'->>'code')='400','reason required');
select pg_temp.ok(public.admin_edit_match_report('7b000000-0000-4000-8000-0000000000f1',
  (select games from public.order_match_reports where assignment_id='7b000000-0000-4000-8000-0000000000f1'),1,2,'Match history shows 2 losses')->'report'->>'wins'='1','corrected');
select pg_temp.ok(public.teammate_winloss('7b000000-0000-4000-8000-000000000051') = '{"wins":1,"losses":2}'::jsonb,'winrate follows');
select pg_temp.ok(exists(select 1 from pg_catalog.jsonb_array_elements(public.admin_match_reports()->'reports') e
  where e->>'assignmentId'='7b000000-0000-4000-8000-0000000000f1' and e->'edited'->>'reason'='Match history shows 2 losses'),'listed as corrected');
select pg_temp.ok(exists(select 1 from public.admin_audit_log where action='Corrected match report' and detail like '3W 0L → 1W 2L:%'),'logged');

-- A removes a wrong screenshot
select pg_temp.ok((public.admin_set_order_proof_removed('7b000000-0000-4000-8000-0000000000e1','7b000000-0000-4000-8000-00000000aa02',true,'')->'error'->>'code')='400','reason required to remove');
select pg_temp.ok(pg_catalog.jsonb_array_length(public.admin_set_order_proof_removed('7b000000-0000-4000-8000-0000000000e1','7b000000-0000-4000-8000-00000000aa02',true,'Not from this match')->'proofs')=2,'admins still list it');
select pg_temp.ok(exists(select 1 from pg_catalog.jsonb_array_elements(public.admin_order_proofs('7b000000-0000-4000-8000-0000000000e1')->'proofs') e
  where e->>'id'='7b000000-0000-4000-8000-00000000aa02' and e->'removed'->>'reason'='Not from this match'),'marked removed');
select pg_temp.ok(public.get_order_proof('7b000000-0000-4000-8000-0000000000e1','7b000000-0000-4000-8000-00000000aa02') ? 'proof','admins can still open it');

-- the customer and the teammate no longer see it
select pg_temp.as_user('7b000000-0000-4000-8000-0000000000c1');
select pg_temp.ok(pg_catalog.jsonb_array_length(public.list_order_proofs('7b000000-0000-4000-8000-0000000000e1')->'proofs')=1,'customer sees 1');
do $$ begin
  perform public.get_order_proof('7b000000-0000-4000-8000-0000000000e1','7b000000-0000-4000-8000-00000000aa02');
  raise exception 'correct results assertion: customer opened a removed screenshot';
exception when sqlstate 'PT404' then null; end $$;
select pg_temp.as_user('7b000000-0000-4000-8000-000000000051');
select pg_temp.ok(pg_catalog.jsonb_array_length(public.list_order_proofs('7b000000-0000-4000-8000-0000000000e1')->'proofs')=1,'teammate sees 1');

-- A adds a correct one: reserved on the order's assignment, as the teammate's file
select pg_temp.as_user('7b000000-0000-4000-8000-0000000000a0');
select pg_catalog.set_config('cr.up', (public.admin_begin_order_proof_upload('7b000000-0000-4000-8000-0000000000e1', pg_catalog.gen_random_uuid())->>'id'), true);
select pg_temp.ok((select state='pending' and uploader_id='7b000000-0000-4000-8000-000000000051' and assignment_id='7b000000-0000-4000-8000-0000000000f1'
  from public.order_proof_uploads where id=pg_catalog.current_setting('cr.up')::uuid),'reserved');
select pg_temp.ok(exists(select 1 from public.order_proof_admin_uploads where proof_id=pg_catalog.current_setting('cr.up')::uuid),'marked as admin upload');
do $$ begin
  perform public.admin_finalize_order_proof_upload(pg_catalog.current_setting('cr.up')::uuid,'image/png',100,pg_catalog.repeat('c',64));
  raise exception 'correct results assertion: finalized without a stored file';
exception when sqlstate 'PT409' then null; end $$;
-- the teammate's own finalize can't be used for it
do $$ begin
  perform public.finalize_order_proof_upload(pg_catalog.current_setting('cr.up')::uuid,'image/png',100,pg_catalog.repeat('c',64));
  raise exception 'correct results assertion: teammate finalize accepted an admin upload on a finished order';
exception when sqlstate 'PT409' then null; end $$;
-- restore
select pg_temp.ok(pg_catalog.jsonb_array_length(public.list_order_proofs('7b000000-0000-4000-8000-0000000000e1')->'proofs')=1,'list hides removed for admins too');
select pg_temp.ok(not exists(select 1 from pg_catalog.jsonb_array_elements(public.admin_set_order_proof_removed('7b000000-0000-4000-8000-0000000000e1','7b000000-0000-4000-8000-00000000aa02',false,'')->'proofs') e
  where e->'removed' <> 'null'::jsonb),'shown again');
select pg_temp.ok(not has_function_privilege('authenticated','public.admin_finalize_order_proof_upload(uuid,text,integer,text)','execute'),'finalize is server only');

select 'correct results ok' as result;
