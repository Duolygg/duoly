-- Admin Teammates roster (port of components/admin/Teammates.jsx + app/api/admin/people suspend).
-- Suspension itself was already enforced by every teammate RPC (order_eligible, accept, proofs,
-- chat); this adds who/why/when, the roster read and the audited suspend/reinstate command.
begin;

alter table public.teammate_order_access
  add column suspended_reason text not null default '' check (pg_catalog.char_length(suspended_reason) <= 200),
  add column suspended_by uuid references auth.users(id) on delete set null,
  add column suspended_at timestamptz;

create function public.admin_teammates() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.admin_caller()) then return public.order_error(403, 'Admins only.'); end if;
  return pg_catalog.jsonb_build_object('teammates', coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id', r.user_id,
      'name', coalesce(nullif(p.name, 'Player'), u.email, ''),
      'email', coalesce(u.email, ''),
      'image', coalesce(p.image, ''),
      'country', coalesce(p.country, ''),
      'joined', coalesce(r.role_set_at, u.created_at),
      'lastSeen', u.last_sign_in_at,
      'games', pg_catalog.to_jsonb(coalesce(a.approved_games, '{}')),
      'gg', coalesce(a.gg_access, false),
      'discord', d.username,
      'suspended', case when coalesce(a.suspended, false) then pg_catalog.jsonb_build_object(
        'reason', a.suspended_reason, 'at', a.suspended_at,
        'by', coalesce((select coalesce(nullif(bp.name, 'Player'), bu.email) from auth.users as bu
                        left join public.profiles as bp on bp.id = bu.id where bu.id = a.suspended_by), '')) end,
      'playing', exists (select 1 from public.orders as o where o.assigned_teammate_id = r.user_id and o.status = 'in_progress'),
      'completed', (select pg_catalog.count(*) from public.orders as o where o.assigned_teammate_id = r.user_id and o.status = 'completed'),
      'accepted', (select pg_catalog.count(*) from public.order_assignments as h where h.teammate_id = r.user_id),
      'earned30UsdCents', coalesce((select pg_catalog.sum(o.payout_usd_cents) from public.orders as o
        where o.assigned_teammate_id = r.user_id and o.status = 'completed'
          and o.completed_at > pg_catalog.clock_timestamp() - interval '30 days'), 0),
      'warnings', (select pg_catalog.count(*) from public.order_chat_flags as f where f.actor_id = r.user_id and f.status = 'warned'))
      order by coalesce(r.role_set_at, u.created_at) desc)
    from public.account_roles as r
    join auth.users as u on u.id = r.user_id
    left join public.profiles as p on p.id = r.user_id
    left join public.teammate_order_access as a on a.user_id = r.user_id
    left join public.discord_accounts as d on d.user_id = r.user_id
    where r.role = 'teammate'), '[]'::jsonb));
end;
$$;

-- Suspend or reinstate. Spec: you can't suspend someone mid-order; a reason is required.
create function public.admin_set_suspended(p_user_id uuid, p_suspended boolean, p_reason text default '') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid; v_name text; v_role text; v_label text; v_reason text := pg_catalog.btrim(coalesce(p_reason, ''));
begin
  select id, name into v_actor, v_name from public.admin_caller();
  if v_actor is null then return public.order_error(403, 'Admins only.'); end if;
  -- Same row lock accept_order takes, so a suspension can't race an accept.
  select role into v_role from public.account_roles where user_id = p_user_id for update;
  if v_role is null then return public.order_error(404, 'Account not found.'); end if;
  if v_role <> 'teammate' then return public.order_error(409, 'Only teammates can be suspended.'); end if;
  if p_suspended and exists (select 1 from public.orders where assigned_teammate_id = p_user_id and status = 'in_progress') then
    return public.order_error(409, 'They’re playing an order right now. Suspend them once it’s finished.');
  end if;
  if p_suspended and pg_catalog.char_length(v_reason) < 3 then return public.order_error(400, 'Add a reason. It goes into the audit log.'); end if;
  insert into public.teammate_order_access(user_id) values (p_user_id) on conflict (user_id) do nothing;
  update public.teammate_order_access
     set suspended = coalesce(p_suspended, false),
         suspended_reason = case when p_suspended then pg_catalog.left(v_reason, 200) else '' end,
         suspended_by = case when p_suspended then v_actor end,
         suspended_at = case when p_suspended then pg_catalog.clock_timestamp() end
   where user_id = p_user_id;
  select coalesce(nullif(p.name, 'Player'), u.email, '') into v_label
    from auth.users as u left join public.profiles as p on p.id = u.id where u.id = p_user_id;
  perform public.admin_log(v_actor, v_name, case when p_suspended then 'Suspended teammate' else 'Reinstated teammate' end, v_label, v_reason);
  return pg_catalog.jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.admin_teammates(), public.admin_set_suspended(uuid,boolean,text) from public, anon, authenticated, service_role;
grant execute on function public.admin_teammates(), public.admin_set_suspended(uuid,boolean,text) to authenticated;

commit;
