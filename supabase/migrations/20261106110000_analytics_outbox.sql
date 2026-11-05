-- Transactional business facts, not a delivery-time consent decision. No provider calls.
begin;

create table public.analytics_outbox (
  id bigserial primary key,
  event text not null,
  dedup_key text not null unique,
  occurred_at timestamptz not null default pg_catalog.now(),
  user_id uuid,
  properties jsonb not null default '{}'::jsonb,
  uuid uuid not null default pg_catalog.gen_random_uuid(),
  claimed_until timestamptz,
  attempts integer not null default 0,
  sent_at timestamptz,
  failed_at timestamptz,
  last_error text
);
create index analytics_outbox_pending on public.analytics_outbox (occurred_at, id)
  where sent_at is null and failed_at is null;
create index analytics_outbox_sent on public.analytics_outbox (sent_at)
  where sent_at is not null;
alter table public.analytics_outbox enable row level security;
revoke all on table public.analytics_outbox from public, anon, authenticated;
revoke all on sequence public.analytics_outbox_id_seq from public, anon, authenticated;
grant select, insert, update, delete on table public.analytics_outbox to service_role;
grant usage, select on sequence public.analytics_outbox_id_seq to service_role;

create function public.analytics_enqueue(
  p_event text, p_dedup_key text, p_user_id uuid,
  p_properties jsonb, p_occurred_at timestamptz
) returns void language sql security definer set search_path = '' as $$
  insert into public.analytics_outbox(event, dedup_key, user_id, properties, occurred_at)
  values (p_event, p_dedup_key, p_user_id, p_properties, coalesce(p_occurred_at, pg_catalog.now()))
  on conflict (dedup_key) do nothing;
$$;
revoke all on function public.analytics_enqueue(text, text, uuid, jsonb, timestamptz) from public, anon, authenticated;
grant execute on function public.analytics_enqueue(text, text, uuid, jsonb, timestamptz) to service_role;

commit;
