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

-- Rollback-only checks for 20261104120000_payout_minimum_25_optional_tax.sql.
-- Run with the migration body (without its begin/commit) inserted after this begin.
begin;

create function pg_temp.ok(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'payout minimum assertion: %',label; end if; end $$;
create function pg_temp.login(actor uuid) returns void language plpgsql as $$
begin
  perform pg_catalog.set_config('request.jwt.claim.sub',actor::text,true);
  perform pg_catalog.set_config('request.jwt.claims',pg_catalog.jsonb_build_object('role','authenticated','sub',actor)::text,true);
end $$;

insert into auth.users(id,aud,role,email,raw_user_meta_data,raw_app_meta_data) values
 ('7d000000-0000-4000-8000-000000000001','authenticated','authenticated','m25-teammate@example.invalid','{}','{}'),
 ('7d000000-0000-4000-8000-000000000002','authenticated','authenticated','m25-admin@example.invalid','{}','{}');
update public.account_roles set role='teammate' where user_id='7d000000-0000-4000-8000-000000000001';
update public.account_roles set role='admin' where user_id='7d000000-0000-4000-8000-000000000002';

-- No live definition mentions the old minimum any more.
select pg_temp.ok(pg_catalog.strpos(pg_catalog.pg_get_functiondef(f::regprocedure),'<1000')=0
  and pg_catalog.strpos(pg_catalog.pg_get_functiondef(f::regprocedure),'''minimum'',10')=0,f||' rewritten')
from unnest(array['public.payout_freeze_week(timestamptz)','public.payout_refresh_order_hold(uuid)',
  'public.payout_pay_locked(public.payout_lines,uuid,text,text)','public.payout_stripe_prepare(uuid,uuid,text,numeric,text)',
  'public.admin_payouts()','public.teammate_payout_summary(uuid)']) f;

-- 24 USD is below the minimum and carries; 1 USD more the next week reaches exactly 25 USD.
insert into public.teammate_adjustments(teammate_id,amount_usd_cents,reason,created_by,created_at) values
 ('7d000000-0000-4000-8000-000000000001',2400,'Below the new minimum','7d000000-0000-4000-8000-000000000002','2025-09-05 10:00+00');
select public.payout_freeze_week(public.payout_week_start('2025-09-05 10:00+00'));
select pg_temp.ok((select status='carried' from public.payout_lines where teammate_id='7d000000-0000-4000-8000-000000000001'
  and week_start=public.payout_week_start('2025-09-05 10:00+00')),'24 USD carried');
insert into public.teammate_adjustments(teammate_id,amount_usd_cents,reason,created_by,created_at) values
 ('7d000000-0000-4000-8000-000000000001',100,'Reach the new minimum','7d000000-0000-4000-8000-000000000002','2025-09-12 10:00+00');
select public.payout_freeze_week(public.payout_week_start('2025-09-12 10:00+00'));
select pg_temp.ok((select status='scheduled' and public.payout_line_total(id)=2500 from public.payout_lines where teammate_id='7d000000-0000-4000-8000-000000000001'
  and week_start=public.payout_week_start('2025-09-12 10:00+00')),'25 USD with carry is scheduled');

-- A line frozen before the change between 10 and 25 USD stays scheduled, but the pay guard still
-- refuses anything under 25 USD (this one is 15 USD).
do $$ declare l uuid; begin
  insert into public.payout_lines(teammate_id,week_start,week_end,status)
    values('7d000000-0000-4000-8000-000000000001',public.payout_week_start('2025-09-19 10:00+00'),public.payout_week_end(public.payout_week_start('2025-09-19 10:00+00')),'scheduled')
    returning id into l;
  insert into public.teammate_adjustments(id,teammate_id,amount_usd_cents,reason,created_by,created_at)
    values('7d000000-0000-4000-8000-0000000000a1','7d000000-0000-4000-8000-000000000001',1500,'Fixture','7d000000-0000-4000-8000-000000000002','2025-09-19 10:00+00');
  insert into public.payout_line_items(line_id,kind,source_id,amount_usd_cents) values(l,'adjustment','7d000000-0000-4000-8000-0000000000a1',1500);
  perform pg_catalog.set_config('m25.line',l::text,true);
end $$;

select pg_temp.login('7d000000-0000-4000-8000-000000000002');
select pg_temp.ok(public.admin_payout_pay(current_setting('m25.line')::uuid,'wise','W-1')->'error'->>'message'
  ='Below the $25 minimum. It stays owed until it reaches $25.','pay guard uses 25 USD');
select pg_temp.ok((public.admin_payouts()->>'minimum')::int=25,'admin read model says 25');
select pg_temp.ok((public.teammate_payout_summary('7d000000-0000-4000-8000-000000000001')->>'minimum')::int=25,'teammate summary says 25');

-- The tax number is optional: empty is stored as null and read back as ''; a 1-character one is refused.
select pg_temp.login('7d000000-0000-4000-8000-000000000001');
select pg_temp.ok(public.teammate_save_payout_details('Legal Name','Test Street 1, Vienna','Austria','1990-01-02','  ','wise','wise@example.invalid')
  ->'details'->>'taxNumber'='','saved without tax number');
reset role;
select pg_temp.ok((select tax_number is null from public.teammate_payout_details where teammate_id='7d000000-0000-4000-8000-000000000001'),'empty tax number is null');
select pg_temp.ok(public.payout_details_complete('7d000000-0000-4000-8000-000000000001'),'details complete without tax number');
select pg_temp.login('7d000000-0000-4000-8000-000000000001');
select pg_temp.ok((public.teammate_save_payout_details('Legal Name','Test Street 1, Vienna','Austria','1990-01-02','A','wise','wise@example.invalid')
  ->'error'->>'code')::int=400,'1-character tax number refused');
select pg_temp.ok(public.teammate_save_payout_details('Legal Name','Test Street 1, Vienna','Austria','1990-01-02','ATU123','wise','wise@example.invalid')
  ->'details'->>'taxNumber'='ATU123','tax number still saved when given');
reset role;

rollback;
