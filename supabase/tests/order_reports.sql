-- Rollback-only checks for 20261024220000_order_reports.sql.
begin;
insert into auth.users(id,aud,role,email,raw_user_meta_data,raw_app_meta_data) values
 ('9a000000-0000-4000-8000-000000000001','authenticated','authenticated','report-customer@example.invalid','{}','{}'),
 ('9a000000-0000-4000-8000-000000000002','authenticated','authenticated','report-teammate@example.invalid','{}','{}'),
 ('9a000000-0000-4000-8000-000000000003','authenticated','authenticated','report-other@example.invalid','{}','{}'),
 ('9a000000-0000-4000-8000-000000000004','authenticated','authenticated','report-admin@example.invalid','{}','{}');
update public.profiles set name=case id when '9a000000-0000-4000-8000-000000000001' then 'Report Customer' when '9a000000-0000-4000-8000-000000000002' then 'Report Teammate' when '9a000000-0000-4000-8000-000000000004' then 'Report Admin' else 'Other Customer' end where id::text like '9a000000-0000-4000-8000-00000000000%';
update public.account_roles set role=case when user_id='9a000000-0000-4000-8000-000000000002' then 'teammate' when user_id='9a000000-0000-4000-8000-000000000004' then 'admin' else 'customer' end where user_id::text like '9a000000-0000-4000-8000-00000000000%';
insert into public.teammate_order_access(user_id,approved_games,discord_id,discord_verified_at) values('9a000000-0000-4000-8000-000000000002',array['lol'],'923456789012345678',now());
insert into public.orders(id,customer_id,customer_name,game,service,title,units,unit,rank,region,ign,amount_eur_cents,payout_usd_cents,booking_fx,created_at,queued_at)
 values('9a100000-0000-4000-8000-000000000001','9a000000-0000-4000-8000-000000000001','Report Customer','lol','duo','Duo',1,'game','Gold','EUW','Reporter',1000,600,1.1,now()-interval '1 hour',now()-interval '50 minutes');
insert into public.order_assignments(id,order_id,teammate_id,accepted_at) values('9a200000-0000-4000-8000-000000000001','9a100000-0000-4000-8000-000000000001','9a000000-0000-4000-8000-000000000002',now()-interval '40 minutes');
update public.orders set status='in_progress',assigned_teammate_id='9a000000-0000-4000-8000-000000000002',current_assignment_id='9a200000-0000-4000-8000-000000000001',accepted_at=now()-interval '40 minutes' where id='9a100000-0000-4000-8000-000000000001';
insert into storage.objects(bucket_id,name,metadata) values
 ('report-evidence','9a100000-0000-4000-8000-000000000001/9a300000-0000-4000-8000-000000000001/9a400000-0000-4000-8000-000000000001','{"size":9,"mimetype":"image/png"}'),
 ('report-evidence','9a100000-0000-4000-8000-000000000001/9a300000-0000-4000-8000-000000000002/9a400000-0000-4000-8000-000000000002','{"size":9,"mimetype":"image/png"}');

set local role authenticated;
select pg_catalog.set_config('request.jwt.claims','{"role":"authenticated","sub":"9a000000-0000-4000-8000-000000000003"}',true);
select pg_catalog.set_config('request.jwt.claim.sub','9a000000-0000-4000-8000-000000000003',true);
do $$ begin if (public.order_report_create('9a300000-0000-4000-8000-000000000001','9a100000-0000-4000-8000-000000000001','toxic','Private description',pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('id','9a400000-0000-4000-8000-000000000001','mime','image/png','byte_size',9,'sha256',pg_catalog.repeat('a',64))))->'error'->>'code')::int<>404 then raise exception 'other customer reported order'; end if; end $$;
select pg_catalog.set_config('request.jwt.claims','{"role":"authenticated","sub":"9a000000-0000-4000-8000-000000000001"}',true);
select pg_catalog.set_config('request.jwt.claim.sub','9a000000-0000-4000-8000-000000000001',true);
do $$ declare r jsonb; begin
 r:=public.order_report_create('9a300000-0000-4000-8000-000000000001','9a100000-0000-4000-8000-000000000001','toxic','They repeatedly insulted me in chat.',pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('id','9a400000-0000-4000-8000-000000000001','mime','image/png','byte_size',9,'sha256',pg_catalog.repeat('a',64))));
 if r->'report'->>'status'<>'open' or r->'report'->>'bounty_eur_cents'<>'5000' then raise exception 'report result wrong: %',r; end if;
 if (public.order_report_create('9a300000-0000-4000-8000-000000000002','9a100000-0000-4000-8000-000000000001','toxic','More repeated toxic messages.',pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('id','9a400000-0000-4000-8000-000000000002','mime','image/png','byte_size',9,'sha256',pg_catalog.repeat('b',64))))->'error'->>'code')::int<>409 then raise exception 'duplicate report type accepted'; end if;
 r:=public.customer_order('9a100000-0000-4000-8000-000000000001');
 if pg_catalog.jsonb_array_length(r->'order'->'reports')<>1 or r->'order'->'reports'->0 ? 'description' then raise exception 'customer report DTO wrong: %',r; end if;
end $$;
select pg_catalog.set_config('request.jwt.claims','{"role":"authenticated","sub":"9a000000-0000-4000-8000-000000000004"}',true);
select pg_catalog.set_config('request.jwt.claim.sub','9a000000-0000-4000-8000-000000000004',true);
do $$ declare r jsonb; begin
 r:=public.admin_order_reports();
 if pg_catalog.jsonb_array_length(r->'reports')<>1 or r->'reports'->0->>'byName'<>'Report Customer' or r->'reports'->0->'evidence'->0->>'storage_key' is null then raise exception 'admin report queue wrong: %',r; end if;
 if (public.admin_order_report_decide('9a300000-0000-4000-8000-000000000001','approved','x')->'error'->>'code')::int<>400 then raise exception 'short reason accepted'; end if;
 r:=public.admin_order_report_decide('9a300000-0000-4000-8000-000000000001','approved','Screenshot confirms repeated toxic messages.');
 if r->'report'->>'status'<>'approved' or r->'report'->>'bounty_owed'<>'true' then raise exception 'approval wrong: %',r; end if;
 if (public.admin_order_report_decide('9a300000-0000-4000-8000-000000000001','rejected','Changed mind')->'error'->>'code')::int<>409 then raise exception 'report decided twice'; end if;
 if (public.admin_audit(1)->'audit'->0->>'action')<>'Approved report' then raise exception 'decision not audited'; end if;
end $$;
reset role;
do $$ begin
 if (select count(*) from public.order_report_bounties where report_id='9a300000-0000-4000-8000-000000000001' and status='owed' and amount_eur_cents=5000)<>1 then raise exception 'manual bounty owed row missing'; end if;
 if exists(select 1 from public.refund_credits where order_id='9a100000-0000-4000-8000-000000000001') then raise exception 'report moved customer money'; end if;
 begin update public.order_report_bounties set amount_eur_cents=4000; raise exception 'bounty row mutable'; exception when sqlstate 'PT409' then null; end;
end $$;
select 'order_reports: all checks passed' as result;
rollback;
