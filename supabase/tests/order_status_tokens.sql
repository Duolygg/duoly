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

\set ON_ERROR_STOP on
-- Run after migrations on disposable local Supabase only. Everything rolls back.
begin;
insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data) values
 ('d0510000-0000-4000-8000-000000000001','authenticated','authenticated','status-owner@example.invalid','{}','{}'),
 ('d0510000-0000-4000-8000-000000000002','authenticated','authenticated','status-other@example.invalid','{}','{}');
insert into public.orders(id,customer_id,game,service,title,units,unit,region,ign,customer_name,amount_eur_cents,booking_fx,payout_usd_cents)
 values('d0520000-0000-4000-8000-000000000001','d0510000-0000-4000-8000-000000000001','val','duo2','Duo Pro',3,'game','EU','PRIVATE#ID','PRIVATE Customer',1617,1.08,1047);
do $$
declare r jsonb; snapshot jsonb; o uuid := 'd0520000-0000-4000-8000-000000000001'; c uuid := 'd0510000-0000-4000-8000-000000000001';
begin
 assert (select relrowsecurity from pg_class where oid='public.order_status_tokens'::regclass);
 assert not has_table_privilege('anon','public.order_status_tokens','select');
 assert not has_table_privilege('authenticated','public.order_status_tokens','select');
 assert not has_function_privilege('anon','public.mcp_order_status(text)','execute');
 assert not has_function_privilege('authenticated','public.issue_order_status_token(uuid,uuid,text)','execute');
 assert not has_function_privilege('authenticated','public.revoke_order_status_token(uuid,uuid)','execute');
 assert has_function_privilege('service_role','public.mcp_order_status(text)','execute');
 assert (select provolatile='s' from pg_proc where oid='public.mcp_order_status(text)'::regprocedure);
 r:=public.issue_order_status_token(o,'d0510000-0000-4000-8000-000000000002',repeat('a',64));
 assert r->>'error'='not_found';
 assert not exists(select from public.order_status_tokens where order_id=o);
 r:=public.issue_order_status_token(o,c,repeat('a',64));
 assert (select expires_at-created_at=interval '7 days' from public.order_status_tokens where token_hash=repeat('a',64));
 select to_jsonb(orders) into snapshot from public.orders where id=o;
 r:=public.mcp_order_status(repeat('a',64));
 assert r->>'status'='queued'; assert r->>'accepted'='false'; assert r->'teammateDisplayName'='null'::jsonb;
 assert not r ?| array['email','customer_id','id','public_reference','ign','note','payment','chat','current_assignment_id'];
 assert r::text not like '%PRIVATE%';
 assert (select to_jsonb(orders)=snapshot from public.orders where id=o);
 perform public.issue_order_status_token(o,c,repeat('b',64));
 assert public.mcp_order_status(repeat('a',64)) is null;
 r:=public.revoke_order_status_token(o,'d0510000-0000-4000-8000-000000000002');
 assert r->>'error'='not_found'; assert public.mcp_order_status(repeat('b',64)) is not null;
 perform public.revoke_order_status_token(o,c);
 assert public.mcp_order_status(repeat('b',64)) is null;
 perform public.issue_order_status_token(o,c,repeat('c',64));
 update public.order_status_tokens set created_at=clock_timestamp()-interval '8 days', expires_at=clock_timestamp()-interval '1 day' where token_hash=repeat('c',64);
 assert public.mcp_order_status(repeat('c',64)) is null;
 assert public.mcp_order_status(repeat('d',64)) is null;
end $$;
set local role service_role;
select public.mcp_order_status(repeat('d',64));
reset role;
select 'order status tokens ok' as result;
rollback;
