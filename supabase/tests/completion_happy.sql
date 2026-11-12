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

set local role authenticated;
do $$
declare f jsonb := current_setting('completion.fixture')::jsonb; v jsonb;
begin
 perform pg_temp.completion_login(f->>'teammate');
 v := public.complete_order((f->>'order')::uuid,(f->>'assignment')::uuid,array[(f->>'proof')::uuid],(f->>'request')::uuid);
 perform pg_temp.completion_assert(v #>> '{completion,payout_usd_cents}' = '105','stored payout');
 perform pg_temp.completion_assert(v #>> '{completion,held_usd_cents}' = '11','positive half-up deposit');
 perform pg_temp.completion_assert(v #>> '{completion,net_usd_cents}' = '94','net');
 perform pg_temp.completion_assert(v #>> '{completion,trust_tier}' = 'rookie','pre-completion tier');
 perform set_config('completion.result',v::text,true);
end $$;
reset role;
do $$
declare f jsonb := current_setting('completion.fixture')::jsonb;
begin
 perform pg_temp.completion_assert(exists(select 1 from public.orders where id=(f->>'order')::uuid and status='completed'),'order completed');
 perform pg_temp.completion_assert(exists(select 1 from public.order_assignments where id=(f->>'assignment')::uuid and ended_at is not null and end_reason='completed'),'assignment ended');
end $$;
select 'completion happy path passed' as result;
