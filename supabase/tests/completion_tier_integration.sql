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

do $$
declare f jsonb := pg_temp.completion_fixture(); h uuid := gen_random_uuid();
 o uuid; a uuid; p uuid; n timestamptz; k integer; v jsonb;
begin
 insert into auth.users(id,raw_user_meta_data,raw_app_meta_data) values(h,'{}','{}');
 -- Seed immutable historical entries, not a mutable counter or client tier.
 for k in 1..100 loop
  o:=gen_random_uuid(); a:=gen_random_uuid(); p:=gen_random_uuid(); n:=clock_timestamp();
  insert into public.orders(id,public_reference,customer_id,game,service,title,units,unit,region,ign,customer_name,amount_eur_cents,booking_fx,payout_usd_cents,created_at,queued_at)
  values(o,'DL-' || ('x' || substr(replace(o::text,'-',''),1,15))::bit(60)::bigint,h,'lol','duo','Prior completion fixture',1,'game','EUW','Fixture','Fixture',999,1.08,105,n,n);
  insert into public.order_assignments(id,order_id,teammate_id,accepted_at,ended_at,end_reason)
  values(a,o,(f->>'teammate')::uuid,n,n,'completed');
  update public.orders set status='completed',assigned_teammate_id=(f->>'teammate')::uuid,current_assignment_id=a,accepted_at=n,completed_at=n where id=o;
  insert into public.order_proof_uploads(id,order_id,assignment_id,uploader_id,request_id,state,mime,byte_size,sha256,created_at,ready_at)
  values(p,o,a,(f->>'teammate')::uuid,gen_random_uuid(),'ready','image/png',12,repeat('a',64),n,n);
  insert into public.teammate_earning_entries(order_id,assignment_id,teammate_id,request_id,proof_ids,completed_at,prior_completed_count,trust_tier,payout_usd_cents,deposit_percent,held_usd_cents,net_usd_cents,source_snapshot,result)
  values(o,a,(f->>'teammate')::uuid,gen_random_uuid(),array[p],n,k-1,'rookie',105,10,11,94,'{}','{}');
  insert into public.order_completion_proofs values(o,p);
 end loop;
 set local role authenticated;
 perform pg_temp.completion_login(f->>'teammate');
 v:=public.complete_order((f->>'order')::uuid,(f->>'assignment')::uuid,array[(f->>'proof')::uuid],(f->>'request')::uuid);
 perform pg_temp.completion_assert(v #>> '{completion,trust_tier}'='trusted','100 prior entries chooses Trusted');
 perform pg_temp.completion_assert(v #>> '{completion,deposit_percent}'='8' and v #>> '{completion,held_usd_cents}'='8','stored payout at Trusted rate');
 reset role;
 perform pg_temp.completion_assert((select prior_completed_count=100 from public.teammate_earning_entries where order_id=(f->>'order')::uuid),'audit pre-completion count');
end $$;
select 'completion tier integration passed' as result;
