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
begin;
-- Migration already applied by local stack.

do $$
declare r jsonb; i integer;
begin
  assert (select relrowsecurity from pg_class where oid = 'public.mcp_rate_limits'::regclass);
  assert not has_table_privilege('anon', 'public.mcp_rate_limits', 'select');
  assert not has_table_privilege('authenticated', 'public.mcp_rate_limits', 'insert');
  assert not has_function_privilege('anon', 'public.mcp_take_rate_limit(text)', 'execute');
  assert not has_function_privilege('authenticated', 'public.mcp_take_rate_limit(text)', 'execute');
  assert has_function_privilege('service_role', 'public.mcp_take_rate_limit(text)', 'execute');
  for i in 1..60 loop
    r := public.mcp_take_rate_limit(repeat('a', 64));
    assert (r->>'allowed')::boolean;
  end loop;
  r := public.mcp_take_rate_limit(repeat('a', 64));
  assert not (r->>'allowed')::boolean;
  assert (r->>'retry_after')::integer between 1 and 60;
  -- Force a daily-full bucket independently of the minute limit.
  insert into public.mcp_rate_limits values
    (repeat('b', 64), 86400, date_trunc('day', clock_timestamp() at time zone 'UTC') at time zone 'UTC', 2000);
  r := public.mcp_take_rate_limit(repeat('b', 64));
  assert not (r->>'allowed')::boolean;
  assert (r->>'retry_after')::integer between 1 and 86400;
  r := public.mcp_take_rate_limit(repeat('c', 64));
  assert (r->>'allowed')::boolean;
  insert into public.mcp_rate_limits values (repeat('d', 64), 60, now() - interval '3 days', 1);
  perform public.mcp_take_rate_limit(repeat('c', 64));
  assert not exists (select from public.mcp_rate_limits where key_hash = repeat('d', 64));
  begin
    perform public.mcp_take_rate_limit('raw-ip');
    raise exception 'invalid key accepted';
  exception when raise_exception then
    assert sqlerrm = 'Invalid MCP rate limit key';
  end;
end $$;
set local role service_role;
select public.mcp_take_rate_limit(repeat('e', 64));
reset role;
select 'mcp rate limits ok' as result;
rollback;
