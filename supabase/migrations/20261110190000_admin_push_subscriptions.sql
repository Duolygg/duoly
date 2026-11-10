-- Phone alerts for the admin support inbox (Web Push). Admins only, and only admins with the
-- Support section: nobody else can save a phone, and alerts are only ever sent to phones whose
-- account is still an admin with Support at the moment of sending.
-- Additive: one new table and three functions. Nothing existing is changed.

create table public.admin_push_subscriptions (
  endpoint text primary key
    check (pg_catalog.length(endpoint) between 20 and 1024 and endpoint ~ '^https://'),
  user_id uuid not null references public.account_roles(user_id) on delete cascade,
  p256dh text not null check (pg_catalog.length(p256dh) between 20 and 200),
  auth text not null check (pg_catalog.length(auth) between 8 and 100),
  device text not null default '' check (pg_catalog.length(device) <= 120),
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp()
);
create index admin_push_subscriptions_user on public.admin_push_subscriptions (user_id);
alter table public.admin_push_subscriptions enable row level security;
-- No direct access for signed-in users at all; only the functions below and the server.
revoke all on table public.admin_push_subscriptions from public, anon, authenticated, service_role;
grant select, delete on table public.admin_push_subscriptions to service_role;

-- Save (or move to the caller) this phone's subscription. Admins with Support only.
create function public.admin_push_subscribe(p_endpoint text, p_p256dh text, p_auth text, p_device text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid;
begin
  select id into v_actor from public.admin_caller_for('support');
  if v_actor is null then return public.order_error(403, 'Admins only.'); end if;
  insert into public.admin_push_subscriptions(endpoint, user_id, p256dh, auth, device)
    values (p_endpoint, v_actor, p_p256dh, p_auth, pg_catalog.left(coalesce(p_device, ''), 120))
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
        device = excluded.device, updated_at = pg_catalog.clock_timestamp();
  return pg_catalog.jsonb_build_object('subscribed', true);
end $$;

-- Remove this phone. Any admin may remove their own; nobody can remove someone else's.
create function public.admin_push_unsubscribe(p_endpoint text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid;
begin
  select id into v_actor from public.admin_caller();
  if v_actor is null then return public.order_error(403, 'Admins only.'); end if;
  delete from public.admin_push_subscriptions where endpoint = p_endpoint and user_id = v_actor;
  return pg_catalog.jsonb_build_object('subscribed', false);
end $$;

-- Server only: the phones to alert right now. The role and sections are checked here, at send
-- time, so an admin who was demoted or lost Support gets nothing, even with a phone saved.
create function public.admin_push_targets()
returns table (endpoint text, p256dh text, auth text)
language sql stable security definer set search_path = '' as $$
  select s.endpoint, s.p256dh, s.auth
    from public.admin_push_subscriptions as s
    join public.account_roles as r on r.user_id = s.user_id
   where r.role = 'admin'
     and public.admin_sections_of(s.user_id) && array['support']::text[];
$$;

revoke all on function public.admin_push_subscribe(text, text, text, text) from public, anon;
revoke all on function public.admin_push_unsubscribe(text) from public, anon;
revoke all on function public.admin_push_targets() from public, anon, authenticated;
grant execute on function public.admin_push_subscribe(text, text, text, text) to authenticated;
grant execute on function public.admin_push_unsubscribe(text) to authenticated;
grant execute on function public.admin_push_targets() to service_role;
