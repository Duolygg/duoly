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

-- Rollback-only checks for 20261112153802_teammate_remove_proofs.sql: a teammate hides their own
-- screenshot on the open assignment, the slot frees up, nobody else can remove it, and a removed
-- screenshot can't finish the order (20261112144155).
begin;

create function pg_temp.removal_assert(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'proof removal assertion: %',label; end if; end $$;
create function pg_temp.removal_login(actor uuid) returns void language plpgsql as $$
begin
 perform pg_catalog.set_config('request.jwt.claim.sub',coalesce(actor::text,''),true);
 perform pg_catalog.set_config('request.jwt.claims',pg_catalog.jsonb_build_object('role','authenticated','sub',actor)::text,true);
end $$;
-- the error code of an order_error result, or of a raised PT error
create function pg_temp.removal_code(sql text) returns text language plpgsql as $$
declare v jsonb;
begin
 execute sql into v;
 return coalesce(v #>> '{error,code}','ok');
exception when others then
 return sqlstate;
end $$;

insert into auth.users(id,aud,role,email,raw_user_meta_data,raw_app_meta_data) values
 ('5e000000-0000-4000-8000-000000000001','authenticated','authenticated','removal-customer@example.invalid','{}','{}'),
 ('5e000000-0000-4000-8000-000000000002','authenticated','authenticated','removal-teammate@example.invalid','{}','{}'),
 ('5e000000-0000-4000-8000-000000000003','authenticated','authenticated','removal-other@example.invalid','{}','{}');
update public.account_roles set role='teammate' where user_id in ('5e000000-0000-4000-8000-000000000002','5e000000-0000-4000-8000-000000000003');
insert into public.teammate_order_access(user_id,approved_games,discord_id,discord_verified_at,priority_base) values
 ('5e000000-0000-4000-8000-000000000002',array['lol'],'95e0000000000000002',pg_catalog.clock_timestamp(),0),
 ('5e000000-0000-4000-8000-000000000003',array['lol'],'95e0000000000000003',pg_catalog.clock_timestamp(),0);

do $$
declare c uuid:='5e000000-0000-4000-8000-000000000001'; t uuid:='5e000000-0000-4000-8000-000000000002';
 o uuid:=pg_catalog.gen_random_uuid(); a uuid:=pg_catalog.gen_random_uuid(); i uuid:=pg_catalog.gen_random_uuid();
 n timestamptz:=pg_catalog.clock_timestamp(); k integer; ids uuid[]:='{}'; p uuid;
begin
 insert into public.orders(id,customer_id,game,service,title,units,unit,region,ign,customer_name,amount_eur_cents,booking_fx,payout_usd_cents,created_at,queued_at)
 values(o,c,'lol','duo','Removal fixture',1,'game','EUW','Fixture','Customer',999,1.08,105,n,n);
 insert into public.order_assignments(id,order_id,teammate_id,accepted_at) values(a,o,t,n);
 update public.orders set status='in_progress',assigned_teammate_id=t,current_assignment_id=a,accepted_at=n where id=o;
 insert into public.checkout_intents(id,customer_id,game,service,title,units,unit,region,ign,amount_eur_cents,payout_usd_cents,booking_fx,expires_at)
 values(i,c,'lol','duo','Removal fixture',1,'game','EUW','Fixture',999,105,1.08,n+interval '1 hour');
 insert into public.order_payments(order_id,intent_id,stripe_payment_intent_id,amount_minor,currency,amount_eur_cents,payment_method_type,state,settle)
 values(o,i,'pi_removal'||pg_catalog.replace(i::text,'-',''),999,'eur',999,'card','captured','none');
 -- five ready screenshots: every slot taken
 for k in 1..5 loop
  p:=pg_catalog.gen_random_uuid(); ids:=ids||p;
  insert into public.order_proof_uploads(id,order_id,assignment_id,uploader_id,request_id,state,mime,byte_size,sha256,created_at,ready_at)
  values(p,o,a,t,pg_catalog.gen_random_uuid(),'ready','image/png',12,pg_catalog.repeat('a',64),n,n);
 end loop;
 perform pg_catalog.set_config('removal.fixture',pg_catalog.jsonb_build_object('order',o,'assignment',a,'proofs',pg_catalog.to_jsonb(ids))::text,true);
end $$;

set local role authenticated;
do $$
declare f jsonb:=pg_catalog.current_setting('removal.fixture')::jsonb; o text:=f->>'order'; a text:=f->>'assignment';
 first text:=f#>>'{proofs,0}'; second text:=f#>>'{proofs,1}'; v jsonb;
begin
 perform pg_temp.removal_login('5e000000-0000-4000-8000-000000000002');
 perform pg_temp.removal_assert(pg_temp.removal_code(pg_catalog.format('select public.begin_order_proof_upload(%L,%L,%L)',o,a,pg_catalog.gen_random_uuid())) = 'PT409','five ready screenshots fill every slot');
 -- another teammate can't touch it
 perform pg_temp.removal_login('5e000000-0000-4000-8000-000000000003');
 perform pg_temp.removal_assert(pg_temp.removal_code(pg_catalog.format('select public.teammate_remove_order_proof(%L,%L,%L)',o,a,first)) = 'PT404','someone else cannot remove it');
 -- the uploader can, once
 perform pg_temp.removal_login('5e000000-0000-4000-8000-000000000002');
 v:=public.teammate_remove_order_proof(o::uuid,a::uuid,first::uuid);
 perform pg_temp.removal_assert(v->>'removed'='true','own screenshot removed');
 perform pg_temp.removal_assert(pg_catalog.jsonb_array_length(public.list_order_proofs(o::uuid)->'proofs')=4,'removed screenshot is no longer listed');
 perform pg_temp.removal_assert(pg_temp.removal_code(pg_catalog.format('select public.get_order_proof(%L,%L)',o,first)) = 'PT404','removed screenshot no longer opens');
 perform pg_temp.removal_assert(pg_temp.removal_code(pg_catalog.format('select public.begin_order_proof_upload(%L,%L,%L)',o,a,pg_catalog.gen_random_uuid())) = 'ok','the slot is free again');
 -- a removed screenshot cannot finish the order; the others can
 v:=public.complete_order(o::uuid,a::uuid,array[first::uuid],pg_catalog.gen_random_uuid());
 perform pg_temp.removal_assert(v #>> '{error,code}'='400','completion refuses a removed screenshot');
 v:=public.complete_order(o::uuid,a::uuid,array[second::uuid],pg_catalog.gen_random_uuid());
 perform pg_temp.removal_assert(v #>> '{completion,payout_usd_cents}'='105','completion with a kept screenshot');
 -- the assignment is over: nothing can be removed any more
 perform pg_temp.removal_assert(pg_temp.removal_code(pg_catalog.format('select public.teammate_remove_order_proof(%L,%L,%L)',o,a,second)) = 'PT409','no removal after completion');
end $$;
reset role;
do $$
declare f jsonb:=pg_catalog.current_setting('removal.fixture')::jsonb;
begin
 perform pg_temp.removal_assert(exists(select 1 from public.order_proof_removals where proof_id=(f#>>'{proofs,0}')::uuid
   and removed_by='5e000000-0000-4000-8000-000000000002' and reason='Removed by the teammate before finishing.'),'removal recorded for admins');
 perform pg_temp.removal_assert(exists(select 1 from public.order_proof_uploads where id=(f#>>'{proofs,0}')::uuid and state='ready'),'the file record is kept');
end $$;

select 'proof removal passed' as result;
rollback;
