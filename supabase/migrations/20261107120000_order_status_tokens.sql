-- Per-seat read capabilities. No order lifecycle helper is called by any function here.
begin;
create table public.order_status_tokens (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  check (expires_at > created_at)
);
create unique index order_status_one_active on public.order_status_tokens(order_id) where revoked_at is null;
alter table public.order_status_tokens enable row level security;
revoke all on public.order_status_tokens from public, anon, authenticated;
grant select, insert, update, delete on public.order_status_tokens to service_role;

-- p_customer_id is supplied ONLY by the server's verified session, never request JSON.
-- Lock the owner row to serialize issue/revoke, including the first issuance.
create function public.issue_order_status_token(p_order_id uuid, p_customer_id uuid, p_token_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_now timestamptz; v_expires timestamptz;
begin
  perform 1 from public.orders o where o.id = p_order_id and o.customer_id = p_customer_id for update;
  if not found then return pg_catalog.jsonb_build_object('error', 'not_found'); end if;
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid token hash'; end if;
  v_now := pg_catalog.clock_timestamp();
  v_expires := v_now + interval '7 days';
  update public.order_status_tokens set revoked_at = v_now where order_id = p_order_id and revoked_at is null;
  insert into public.order_status_tokens(order_id, token_hash, created_at, expires_at)
    values (p_order_id, p_token_hash, v_now, v_expires);
  return pg_catalog.jsonb_build_object('expiresAt', v_expires);
end $$;
create function public.revoke_order_status_token(p_order_id uuid, p_customer_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.orders o where o.id = p_order_id and o.customer_id = p_customer_id for update;
  if not found then return pg_catalog.jsonb_build_object('error', 'not_found'); end if;
  update public.order_status_tokens set revoked_at = pg_catalog.clock_timestamp()
    where order_id = p_order_id and revoked_at is null;
  return pg_catalog.jsonb_build_object('revoked', true);
end $$;

-- Explicit approved projection only. STABLE is an additional no-write boundary.
-- A stale queued row stays queued. The authenticated room, never this read, sweeps expiry.
create function public.mcp_order_status(p_token_hash text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select pg_catalog.jsonb_build_object(
    'status', o.status, 'game', o.game, 'service', o.service, 'title', o.title,
    'quantity', pg_catalog.jsonb_build_object('value', o.units, 'unit', o.unit),
    'rank', o.rank, 'region', o.region,
    'paidEurMinor', case when exists (select 1 from public.free_coaching_claims f where f.order_id = o.id) then 0 else o.amount_eur_cents end,
    'accepted', o.status in ('in_progress','completed') and o.assigned_teammate_id is not null,
    'teammateDisplayName', case when o.status in ('in_progress','completed') then p.name end,
    'bookedAt', o.created_at, 'searchingAt', o.queued_at,
    'acceptedAt', case when o.status in ('in_progress','completed') then o.accepted_at end,
    'completedAt', o.completed_at,
    'team', case when t.id is not null then pg_catalog.jsonb_build_object(
      'status', t.status, 'seats', t.seats, 'startedAt', t.started_at, 'endedAt', t.ended_at,
      'filled', (select pg_catalog.count(*) from public.orders s where s.team_id=t.id and s.status in ('in_progress','completed')),
      'members', (select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'status', s.status, 'name', case when s.status in ('in_progress','completed') then sp.name end,
        'thisSeat', s.id=o.id) order by s.seat)
        from public.orders s left join public.profiles sp on sp.id=s.assigned_teammate_id where s.team_id=t.id)
    ) end,
    -- Room link is view-only metadata at the MCP boundary. It grants no room access.
    'roomUrl', 'https://duoly.gg/queue/' || o.id::text
  )
  from public.order_status_tokens k join public.orders o on o.id=k.order_id
  left join public.profiles p on p.id=o.assigned_teammate_id
  left join public.order_teams t on t.id=o.team_id
  where k.token_hash=p_token_hash and k.revoked_at is null and k.expires_at > pg_catalog.statement_timestamp();
$$;
revoke all on function public.issue_order_status_token(uuid,uuid,text), public.revoke_order_status_token(uuid,uuid), public.mcp_order_status(text) from public, anon, authenticated, service_role;
grant execute on function public.issue_order_status_token(uuid,uuid,text), public.revoke_order_status_token(uuid,uuid), public.mcp_order_status(text) to service_role;
commit;
