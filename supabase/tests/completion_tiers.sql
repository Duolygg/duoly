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
declare n bigint; expected text; pct integer; v jsonb;
begin
 for n,expected,pct in select * from (values
  (0::bigint,'rookie',10),(99,'rookie',10),(100,'trusted',8),(249,'trusted',8),
  (250,'veteran',5),(499,'veteran',5),(500,'elite',3),(999,'elite',3),(1000,'legend',0),(1001,'legend',0)) as b(n,t,p)
 loop
  v := public.completion_trust(n);
  perform pg_temp.completion_assert(v->>'trust_tier'=expected and (v->>'deposit_percent')::integer=pct,'trust boundary ' || n);
 end loop;
end $$;
select 'completion trust boundaries passed' as result;
