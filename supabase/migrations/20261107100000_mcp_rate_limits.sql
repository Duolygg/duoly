-- Apply before enabling /mcp: the application fails closed without this RPC.
-- Independent additive migration. No existing marketplace routines are replaced.
create table public.mcp_rate_limits (
  key_hash text not null check (key_hash ~ '^[a-f0-9]{64}$'),
  window_seconds integer not null check (window_seconds in (60, 86400)),
  bucket_start timestamptz not null,
  calls integer not null check (calls > 0),
  primary key (key_hash, window_seconds, bucket_start)
);
alter table public.mcp_rate_limits enable row level security;
revoke all on public.mcp_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on public.mcp_rate_limits to service_role;
create index mcp_rate_limits_cleanup on public.mcp_rate_limits (bucket_start);

-- Both buckets advance atomically in a single transaction. Upserts lock rows,
-- making parallel requests and separate Vercel instances share the same quota.
create function public.mcp_take_rate_limit(p_key text)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  t timestamptz := clock_timestamp();
  minute_start timestamptz := date_trunc('minute', t);
  day_start timestamptz := date_trunc('day', t at time zone 'UTC') at time zone 'UTC';
  minute_calls integer;
  day_calls integer;
  retry integer := 0;
begin
  if p_key is null or p_key !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid MCP rate limit key';
  end if;
  insert into public.mcp_rate_limits as r values (p_key, 60, minute_start, 1)
    on conflict (key_hash, window_seconds, bucket_start)
    do update set calls = least(r.calls + 1, 61)
    returning calls into minute_calls;
  insert into public.mcp_rate_limits as r values (p_key, 86400, day_start, 1)
    on conflict (key_hash, window_seconds, bucket_start)
    do update set calls = least(r.calls + 1, 2001)
    returning calls into day_calls;
  if minute_calls > 60 then
    retry := greatest(1, ceil(extract(epoch from minute_start + interval '1 minute' - t))::integer);
  end if;
  if day_calls > 2000 then
    retry := greatest(retry, ceil(extract(epoch from day_start + interval '1 day' - t))::integer);
  end if;
  -- Bounded opportunistic cleanup on every call. The next requests finish any backlog.
  delete from public.mcp_rate_limits where ctid in (
    select ctid from public.mcp_rate_limits
    where bucket_start < t - interval '2 days' limit 200 for update skip locked
  );
  return jsonb_build_object('allowed', retry = 0, 'retry_after', retry);
end;
$$;
revoke all on function public.mcp_take_rate_limit(text) from public, anon, authenticated;
grant execute on function public.mcp_take_rate_limit(text) to service_role;
