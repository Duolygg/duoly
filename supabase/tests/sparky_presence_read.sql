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

-- Rollback-only checks for 20261026170000_sparky_presence_read.sql.
-- Run: begin; migration body; savepoint s; this file; rollback;
begin;
create function pg_temp.spr_assert(ok boolean, message text) returns void language plpgsql as $$
begin if ok is not true then raise exception 'sparky_presence_read: %', message; end if; end $$;

select pg_temp.spr_assert(has_column_privilege('service_role','public.teammate_presence','online','select')
  and has_column_privilege('service_role','public.teammate_presence','last_seen_at','select')
  and has_column_privilege('service_role','public.teammate_presence','set_offline_reason','select')
  and has_column_privilege('service_role','public.teammate_presence','user_id','select'), 'four columns readable');
select pg_temp.spr_assert(not has_column_privilege('service_role','public.teammate_presence','set_offline_by','select')
  and not has_column_privilege('service_role','public.teammate_presence','online_since','select')
  and not has_column_privilege('service_role','public.teammate_presence','last_active_at','select'), 'other columns private');
select pg_temp.spr_assert(not has_table_privilege('service_role','public.teammate_presence','insert')
  and not has_table_privilege('service_role','public.teammate_presence','update')
  and not has_table_privilege('service_role','public.teammate_presence','delete'), 'no writes');
select pg_temp.spr_assert(not has_column_privilege('authenticated','public.teammate_presence','online','select')
  and not has_column_privilege('anon','public.teammate_presence','online','select'), 'browser roles unchanged');

set local role service_role;
select count(*) from (select user_id, online, last_seen_at, set_offline_reason from public.teammate_presence) x;
do $$ begin perform set_offline_by from public.teammate_presence limit 1; raise exception 'set_offline_by readable';
exception when insufficient_privilege then null; end $$;
reset role;

select 'sparky_presence_read: all checks passed' as result;
rollback;
