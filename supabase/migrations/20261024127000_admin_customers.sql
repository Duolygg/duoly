-- Admin Customers (port of components/admin/Customers.jsx + app/api/admin/people block/unblock).
-- Numbered before the pending order-completion migration (20261024130000) so it still applies in
-- order. Blocking stops new bookings: the checkout API checks customer_blocks with the service
-- role before creating any Stripe session. Wallet adjustments arrive with the wallet ledger.
begin;

create table public.customer_blocks (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  reason text not null check (pg_catalog.char_length(reason) between 3 and 200),
  blocked_by uuid references auth.users(id) on delete set null,
  blocked_at timestamptz not null default pg_catalog.clock_timestamp()
);
alter table public.customer_blocks enable row level security;
revoke all on table public.customer_blocks from public, anon, authenticated, service_role;
grant select on table public.customer_blocks to service_role;

create function public.admin_customers() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.admin_caller()) then return public.order_error(403, 'Admins only.'); end if;
  return pg_catalog.jsonb_build_object('customers', coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id', r.user_id,
      'name', coalesce(nullif(p.name, 'Player'), u.email, ''),
      'email', coalesce(u.email, ''),
      'provider', coalesce(u.raw_app_meta_data ->> 'provider', 'email'),
      'image', coalesce(p.image, ''),
      'country', coalesce(p.country, ''),
      'joined', u.created_at,
      'placed', (select pg_catalog.count(*) from public.orders as o where o.customer_id = r.user_id),
      'completed', (select pg_catalog.count(*) from public.orders as o where o.customer_id = r.user_id and o.status = 'completed'),
      'spentCents', coalesce((select pg_catalog.sum(o.amount_eur_cents) from public.orders as o
                              where o.customer_id = r.user_id and o.status <> 'cancelled'), 0),
      'walletCents', coalesce((select pg_catalog.sum(c.amount_eur_cents) from public.refund_credits as c where c.customer_id = r.user_id), 0),
      'lastOrderAt', (select pg_catalog.max(o.created_at) from public.orders as o where o.customer_id = r.user_id),
      'warnings', (select pg_catalog.count(*) from public.order_chat_flags as f where f.actor_id = r.user_id and f.status = 'warned'),
      'blocked', case when b.user_id is null then null else pg_catalog.jsonb_build_object(
        'reason', b.reason, 'at', b.blocked_at,
        'by', coalesce((select coalesce(nullif(bp.name, 'Player'), bu.email) from auth.users as bu
                        left join public.profiles as bp on bp.id = bu.id where bu.id = b.blocked_by), '')) end)
      order by u.created_at desc)
    from public.account_roles as r
    join auth.users as u on u.id = r.user_id
    left join public.profiles as p on p.id = r.user_id
    left join public.customer_blocks as b on b.user_id = r.user_id
    where r.role = 'customer'), '[]'::jsonb));
end;
$$;

create function public.admin_set_blocked(p_user_id uuid, p_blocked boolean, p_reason text default '') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid; v_name text; v_role text; v_label text; v_reason text := pg_catalog.btrim(coalesce(p_reason, ''));
begin
  select id, name into v_actor, v_name from public.admin_caller();
  if v_actor is null then return public.order_error(403, 'Admins only.'); end if;
  select role into v_role from public.account_roles where user_id = p_user_id for update;
  if v_role is null then return public.order_error(404, 'Account not found.'); end if;
  if v_role <> 'customer' then return public.order_error(409, 'Only customers can be blocked. Suspend teammates instead.'); end if;
  if p_blocked and pg_catalog.char_length(v_reason) < 3 then return public.order_error(400, 'Add a reason. It goes into the audit log.'); end if;
  if p_blocked then
    insert into public.customer_blocks(user_id, reason, blocked_by) values (p_user_id, pg_catalog.left(v_reason, 200), v_actor)
      on conflict (user_id) do update set reason = excluded.reason, blocked_by = excluded.blocked_by, blocked_at = pg_catalog.clock_timestamp();
  else
    delete from public.customer_blocks where user_id = p_user_id;
  end if;
  select coalesce(nullif(p.name, 'Player'), u.email, '') into v_label
    from auth.users as u left join public.profiles as p on p.id = u.id where u.id = p_user_id;
  perform public.admin_log(v_actor, v_name, case when p_blocked then 'Blocked customer' else 'Unblocked customer' end, v_label, v_reason);
  return pg_catalog.jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.admin_customers(), public.admin_set_blocked(uuid,boolean,text) from public, anon, authenticated, service_role;
grant execute on function public.admin_customers(), public.admin_set_blocked(uuid,boolean,text) to authenticated;

commit;
