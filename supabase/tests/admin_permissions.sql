-- Rollback-only checks for 20261105130000_admin_permissions.sql. Run after the migration body in one
-- transaction (begin; <migration without begin/commit>; <this file>; rollback;).
-- O owner, A admin with the default sections, B admin with only Payouts, T teammate.
create function pg_temp.ok(b boolean, l text) returns void language plpgsql as $$
begin if b is distinct from true then raise exception 'admin permissions assertion: %', l; end if; end $$;
create function pg_temp.as_user(u uuid) returns void language plpgsql as $$ begin
  perform pg_catalog.set_config('request.jwt.claim.sub', u::text, true);
  perform pg_catalog.set_config('request.jwt.claims', pg_catalog.jsonb_build_object('role','authenticated','sub',u)::text, true); end $$;
create function pg_temp.denied(r jsonb) returns boolean language sql as $$ select coalesce((r->'error'->>'code') = '403', false) $$;

insert into auth.users(id,aud,role,email,raw_user_meta_data,raw_app_meta_data) values
 ('7c000000-0000-4000-8000-0000000000a0','authenticated','authenticated','ap-o@example.invalid','{}','{}'),
 ('7c000000-0000-4000-8000-0000000000a1','authenticated','authenticated','ap-a@example.invalid','{}','{}'),
 ('7c000000-0000-4000-8000-0000000000a2','authenticated','authenticated','ap-b@example.invalid','{}','{}'),
 ('7c000000-0000-4000-8000-000000000051','authenticated','authenticated','ap-t@example.invalid','{}','{}'),
 ('7c000000-0000-4000-8000-0000000000c1','authenticated','authenticated','ap-c@example.invalid','{}','{}');
update public.account_roles set role='admin', owner=true where user_id='7c000000-0000-4000-8000-0000000000a0';
update public.account_roles set role='admin' where user_id in ('7c000000-0000-4000-8000-0000000000a1','7c000000-0000-4000-8000-0000000000a2');
update public.account_roles set role='teammate' where user_id='7c000000-0000-4000-8000-000000000051';
insert into public.admin_permissions(user_id, sections) values ('7c000000-0000-4000-8000-0000000000a2', array['payouts']);

-- A: the defaults
select pg_temp.as_user('7c000000-0000-4000-8000-0000000000a1');
select pg_temp.ok(public.admin_me()->'sections' = pg_catalog.to_jsonb(public.admin_default_sections()), 'A has the defaults');
select pg_temp.ok(public.admin_me()->>'owner' = 'false', 'A is not an owner');
select pg_temp.ok(not pg_temp.denied(public.admin_overview()), 'A sees the overview');
select pg_temp.ok(not pg_temp.denied(public.admin_orders(10)), 'A reads orders for the Live desk');
select pg_temp.ok(not pg_temp.denied(public.admin_priority()), 'A sees priority');
select pg_temp.ok(not pg_temp.denied(public.admin_teammates()), 'A sees teammates');
select pg_temp.ok(not pg_temp.denied(public.admin_accounts()), 'A sees users');
select pg_temp.ok(pg_temp.denied(public.admin_payouts()), 'A: no payouts');
select pg_temp.ok(pg_temp.denied(public.admin_customers()), 'A: no customers');
select pg_temp.ok(pg_temp.denied(public.admin_creators()), 'A: no creators');
select pg_temp.ok(pg_temp.denied(public.admin_refund_order('7c000000-0000-4000-8000-0000000000e1','x')), 'A: no card refunds');
select pg_temp.ok(pg_temp.denied(public.admin_set_role('7c000000-0000-4000-8000-0000000000c1','admin')), 'A cannot make admins');
select pg_temp.ok(pg_temp.denied(public.admin_set_role('7c000000-0000-4000-8000-0000000000a2','customer')), 'A cannot change an admin');
select pg_temp.ok(public.admin_set_role('7c000000-0000-4000-8000-0000000000c1','teammate') ? 'account', 'A can make a teammate');
select pg_temp.ok(pg_temp.denied(public.admin_set_permissions('7c000000-0000-4000-8000-0000000000a2', array['users'])), 'A cannot change permissions');

-- B: only payouts
select pg_temp.as_user('7c000000-0000-4000-8000-0000000000a2');
select pg_temp.ok(not pg_temp.denied(public.admin_payouts()), 'B sees payouts');
select pg_temp.ok(pg_temp.denied(public.admin_overview()), 'B: no overview');
select pg_temp.ok(pg_temp.denied(public.admin_orders(10)), 'B: no orders');
select pg_temp.ok(pg_temp.denied(public.admin_audit(10)), 'B: no audit log');
select pg_temp.ok(pg_temp.denied(public.list_order_chat_flags()), 'B: no chat flags');

-- O: owner sees all and sets permissions
select pg_temp.as_user('7c000000-0000-4000-8000-0000000000a0');
select pg_temp.ok(public.admin_me()->'sections' = pg_catalog.to_jsonb(public.admin_section_ids()), 'owner has all sections');
select pg_temp.ok(not pg_temp.denied(public.admin_customers()), 'owner sees customers');
select pg_temp.ok(public.admin_set_permissions('7c000000-0000-4000-8000-0000000000a1', array['orders','zzz','live'])->'permissions' = '["live","orders"]'::jsonb, 'owner sets A (unknown dropped, ordered)');
select pg_temp.ok((public.admin_set_permissions('7c000000-0000-4000-8000-0000000000a0', array['live'])->'error'->>'code') = '409', 'owner rights are fixed');
select pg_temp.ok(public.admin_set_role('7c000000-0000-4000-8000-000000000051','admin') ? 'account', 'owner promotes T');
select pg_temp.ok((select sections from public.admin_permissions where user_id='7c000000-0000-4000-8000-000000000051') = public.admin_default_sections(), 'new admin starts with the defaults');
select pg_temp.ok(exists(select 1 from public.admin_audit_log where action='Changed admin permissions' and detail='live, orders'), 'logged');

-- A after the change: orders yes, overview no
select pg_temp.as_user('7c000000-0000-4000-8000-0000000000a1');
select pg_temp.ok(pg_temp.denied(public.admin_overview()), 'A lost the overview');
select pg_temp.ok(not pg_temp.denied(public.admin_orders(10)), 'A keeps orders');

select 'admin permissions ok' as result;
