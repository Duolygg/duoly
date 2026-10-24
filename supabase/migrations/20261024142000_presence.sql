-- Durable teammate and admin dashboard presence (ledger #15).
-- Client table access stays closed. Every read and write goes through a narrow RPC.
begin;

create table public.teammate_presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  online boolean not null default false,
  online_since timestamptz,
  last_seen_at timestamptz,
  last_active_at timestamptz,
  set_offline_reason text not null default '' check (pg_catalog.char_length(set_offline_reason) <= 120),
  set_offline_by uuid references auth.users(id) on delete set null,
  check ((online and online_since is not null and last_seen_at is not null) or (not online and online_since is null))
);
alter table public.teammate_presence enable row level security;
revoke all on table public.teammate_presence from public, anon, authenticated, service_role;
create index teammate_presence_fresh on public.teammate_presence(last_seen_at) where online;

create function public.presence_teammate_ready(p_user uuid) returns boolean
language sql stable security invoker set search_path = '' as $$
  select exists (
    select 1 from public.account_roles r
    join public.teammate_order_access a on a.user_id=r.user_id
    join public.discord_accounts d on d.user_id=r.user_id
    where r.user_id=p_user and r.role='teammate' and not a.suspended
  );
$$;

create function public.presence_desk_result(p_user uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select pg_catalog.jsonb_build_object(
    'online', coalesce(x.online and x.last_seen_at > pg_catalog.clock_timestamp()-interval '20 seconds',false),
    'online_since', x.online_since,
    'forced_offline', case when not coalesce(x.online,false) and x.set_offline_reason <> '' then
      pg_catalog.jsonb_build_object('reason',x.set_offline_reason,'by',coalesce((
        select coalesce(nullif(p.name,'Player'),u.email,'Admin') from auth.users u
        left join public.profiles p on p.id=u.id where u.id=x.set_offline_by
      ),'')) end
  ) from (select p.* from public.teammate_presence p where p.user_id=p_user) x
  right join (select 1) seed on true;
$$;

create function public.desk_set_online(p_online boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_role text; v_suspended boolean; v_discord boolean; v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if v_actor is null then return public.order_error(401,'Authentication required.'); end if;
  select r.role,coalesce(a.suspended,false),d.user_id is not null into v_role,v_suspended,v_discord
    from public.account_roles r left join public.teammate_order_access a on a.user_id=r.user_id
    left join public.discord_accounts d on d.user_id=r.user_id where r.user_id=v_actor;
  if v_role <> 'teammate' or v_role is null then return public.order_error(403,'Teammates only.'); end if;
  if coalesce(p_online,false) and not coalesce(v_discord,false) then return public.order_error(409,'Connect Discord to go online.'); end if;
  if coalesce(p_online,false) and coalesce(v_suspended,false) then return public.order_error(409,'Suspended teammates can’t go online.'); end if;
  insert into public.teammate_presence(user_id,online,online_since,last_seen_at,last_active_at,set_offline_reason,set_offline_by)
    values(v_actor,coalesce(p_online,false),case when p_online then v_now end,case when p_online then v_now end,
      case when p_online then v_now end,'',null)
  on conflict(user_id) do update set
    online=coalesce(p_online,false),
    online_since=case when p_online then case when public.teammate_presence.online and public.teammate_presence.last_seen_at > v_now-interval '20 seconds'
      then public.teammate_presence.online_since else v_now end end,
    last_seen_at=case when p_online then v_now else public.teammate_presence.last_seen_at end,
    last_active_at=case when p_online then v_now else public.teammate_presence.last_active_at end,
    set_offline_reason='',set_offline_by=null;
  return public.presence_desk_result(v_actor);
end;
$$;

create function public.desk_check_in(p_last_active timestamptz default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if v_actor is null then return public.order_error(401,'Authentication required.'); end if;
  if not exists(select 1 from public.account_roles where user_id=v_actor and role='teammate') then return public.order_error(403,'Teammates only.'); end if;
  if not public.presence_teammate_ready(v_actor) then
    update public.teammate_presence set online=false,online_since=null where user_id=v_actor;
    return public.presence_desk_result(v_actor);
  end if;
  update public.teammate_presence set last_seen_at=v_now,
    last_active_at=greatest(coalesce(last_active_at,'epoch'::timestamptz),least(v_now,coalesce(p_last_active,v_now)))
   where user_id=v_actor and online;
  return public.presence_desk_result(v_actor);
end;
$$;

create function public.admin_presence_check_in(p_online boolean default true) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid; v_now timestamptz := pg_catalog.clock_timestamp();
begin
  select id into v_actor from public.admin_caller();
  if v_actor is null then return public.order_error(403,'Admins only.'); end if;
  insert into public.teammate_presence(user_id,online,online_since,last_seen_at,last_active_at)
    values(v_actor,coalesce(p_online,false),case when p_online then v_now end,case when p_online then v_now end,case when p_online then v_now end)
  on conflict(user_id) do update set online=coalesce(p_online,false),
    online_since=case when p_online then case when public.teammate_presence.online and public.teammate_presence.last_seen_at > v_now-interval '20 seconds'
      then public.teammate_presence.online_since else v_now end end,
    last_seen_at=case when p_online then v_now else public.teammate_presence.last_seen_at end,
    last_active_at=case when p_online then v_now else public.teammate_presence.last_active_at end,
    set_offline_reason='',set_offline_by=null;
  return public.presence_desk_result(v_actor);
end;
$$;

create function public.admin_presence() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.admin_caller()) then return public.order_error(403,'Admins only.'); end if;
  return pg_catalog.jsonb_build_object('now',extract(epoch from pg_catalog.clock_timestamp())*1000,'online',coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id',r.user_id,'name',coalesce(nullif(p.name,'Player'),u.email,''),'email',coalesce(u.email,''),'image',coalesce(p.image,''),
      'admin',r.role='admin','online',true,'playing',o.id is not null,'since',coalesce(tp.online_since,o.accepted_at),
      'lastActive',coalesce(tp.last_active_at,tp.last_seen_at,o.accepted_at),'games',pg_catalog.to_jsonb(coalesce(a.approved_games,'{}')),
      'order',case when o.id is not null then pg_catalog.jsonb_build_object('id',o.public_reference,'title',o.title,'games',o.units,'unit',o.unit,'game',o.game) end
    ) order by (o.id is not null) desc,coalesce(tp.last_active_at,tp.last_seen_at,o.accepted_at) desc)
    from public.account_roles r join auth.users u on u.id=r.user_id left join public.profiles p on p.id=r.user_id
    left join public.teammate_order_access a on a.user_id=r.user_id left join public.teammate_presence tp on tp.user_id=r.user_id
    left join public.orders o on o.assigned_teammate_id=r.user_id and o.status='in_progress'
    where (r.role='admin' and tp.online and tp.last_seen_at > pg_catalog.clock_timestamp()-interval '20 seconds')
       or (r.role='teammate' and (o.id is not null or (not coalesce(a.suspended,false) and tp.online and tp.last_seen_at > pg_catalog.clock_timestamp()-interval '20 seconds')))
  ),'[]'::jsonb));
end;
$$;

create function public.admin_set_teammate_offline(p_user uuid,p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid; v_name text; v_target text; v_reason text := pg_catalog.btrim(coalesce(p_reason,'')); v_now timestamptz := pg_catalog.clock_timestamp();
begin
  select id,name into v_actor,v_name from public.admin_caller();
  if v_actor is null then return public.order_error(403,'Admins only.'); end if;
  if v_reason not in ('AFK / dashboard left open','Not answering orders','Asked to be set offline','Other') then return public.order_error(400,'Choose a set-offline reason.'); end if;
  perform 1 from public.account_roles where user_id=p_user and role='teammate' for update;
  if not found then return public.order_error(404,'Teammate not found.'); end if;
  if exists(select 1 from public.orders where assigned_teammate_id=p_user and status='in_progress') then
    return public.order_error(409,'They’re playing an order. It has to be finished first.');
  end if;
  if not exists(select 1 from public.teammate_presence where user_id=p_user and online and last_seen_at > v_now-interval '20 seconds' for update) then
    return public.order_error(409,'They’re not online any more.');
  end if;
  update public.teammate_presence set online=false,online_since=null,set_offline_reason=v_reason,set_offline_by=v_actor where user_id=p_user;
  select coalesce(nullif(p.name,'Player'),u.email,'') into v_target from auth.users u left join public.profiles p on p.id=u.id where u.id=p_user;
  perform public.admin_log(v_actor,v_name,'Set teammate offline',v_target,v_reason);
  return pg_catalog.jsonb_build_object('ok',true);
end;
$$;

create function public.presence_public_count() returns integer
language sql stable security definer set search_path = '' as $$
  select pg_catalog.count(*)::integer from public.account_roles r
  left join public.teammate_order_access a on a.user_id=r.user_id
  left join public.teammate_presence p on p.user_id=r.user_id
  where r.role='teammate' and (exists(select 1 from public.orders o where o.assigned_teammate_id=r.user_id and o.status='in_progress')
    or (not coalesce(a.suspended,false) and p.online and p.last_seen_at > pg_catalog.clock_timestamp()-interval '20 seconds'));
$$;

create function public.support_online_admins() returns jsonb
language sql stable security definer set search_path = '' as $$
  select pg_catalog.jsonb_build_object('ids',coalesce(pg_catalog.jsonb_agg(r.user_id),'[]'::jsonb))
  from public.account_roles r join public.teammate_presence p on p.user_id=r.user_id
  where r.role='admin' and p.online and p.last_seen_at > pg_catalog.clock_timestamp()-interval '20 seconds';
$$;

-- Role changes away from teammate force the desk offline.
create or replace function public.admin_apply_role(p_actor uuid,p_actor_name text,p_target uuid,p_role text) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare v public.account_roles; v_label text;
begin
  if p_role not in ('customer','teammate','admin') then return public.order_error(400,'Unknown role.'); end if;
  select * into v from public.account_roles where user_id=p_target for update;
  if v.user_id is null then return public.order_error(404,'Account not found.'); end if;
  if v.owner then return public.order_error(403,'Owners are set in ADMIN_EMAILS and can’t be changed here.'); end if;
  if p_target=p_actor then return public.order_error(403,'You can’t change your own role.'); end if;
  if v.role=p_role then return pg_catalog.jsonb_build_object('account',public.admin_account_dto(p_target,p_actor)); end if;
  if p_role<>'teammate' and exists(select 1 from public.orders where assigned_teammate_id=p_target and status='in_progress') then return public.order_error(409,'They’re playing an order right now. Change their role once it’s finished.'); end if;
  if p_role<>'customer' and exists(select 1 from public.orders where customer_id=p_target and status in ('queued','in_progress')) then return public.order_error(409,'They have an order open as a customer. Change their role once it’s finished.'); end if;
  update public.account_roles set role=p_role,role_set_by=p_actor,role_set_at=pg_catalog.clock_timestamp() where user_id=p_target;
  if p_role='teammate' then insert into public.teammate_order_access(user_id) values(p_target) on conflict(user_id) do nothing;
  else update public.teammate_presence set online=false,online_since=null,set_offline_reason='Your role changed',set_offline_by=p_actor where user_id=p_target; end if;
  select coalesce(nullif(p.name,'Player'),u.email,'') into v_label from auth.users u left join public.profiles p on p.id=u.id where u.id=p_target;
  perform public.admin_log(p_actor,p_actor_name,'Changed role',v_label,pg_catalog.initcap(v.role)||' → '||pg_catalog.initcap(p_role));
  return pg_catalog.jsonb_build_object('account',public.admin_account_dto(p_target,p_actor));
end;
$$;

-- Suspension also forces the desk offline in the same transaction.
create or replace function public.admin_set_suspended(p_user_id uuid,p_suspended boolean,p_reason text default '') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid; v_name text; v_role text; v_label text; v_reason text := pg_catalog.btrim(coalesce(p_reason,''));
begin
  select id,name into v_actor,v_name from public.admin_caller();
  if v_actor is null then return public.order_error(403,'Admins only.'); end if;
  select role into v_role from public.account_roles where user_id=p_user_id for update;
  if v_role is null then return public.order_error(404,'Account not found.'); end if;
  if v_role<>'teammate' then return public.order_error(409,'Only teammates can be suspended.'); end if;
  if p_suspended and exists(select 1 from public.orders where assigned_teammate_id=p_user_id and status='in_progress') then return public.order_error(409,'They’re playing an order right now. Suspend them once it’s finished.'); end if;
  if p_suspended and pg_catalog.char_length(v_reason)<3 then return public.order_error(400,'Add a reason. It goes into the audit log.'); end if;
  insert into public.teammate_order_access(user_id) values(p_user_id) on conflict(user_id) do nothing;
  update public.teammate_order_access set suspended=coalesce(p_suspended,false),suspended_reason=case when p_suspended then pg_catalog.left(v_reason,200) else '' end,
    suspended_by=case when p_suspended then v_actor end,suspended_at=case when p_suspended then pg_catalog.clock_timestamp() end where user_id=p_user_id;
  if p_suspended then update public.teammate_presence set online=false,online_since=null,set_offline_reason='Suspended: '||pg_catalog.left(v_reason,80),set_offline_by=v_actor where user_id=p_user_id; end if;
  select coalesce(nullif(p.name,'Player'),u.email,'') into v_label from auth.users u left join public.profiles p on p.id=u.id where u.id=p_user_id;
  perform public.admin_log(v_actor,v_name,case when p_suspended then 'Suspended teammate' else 'Reinstated teammate' end,v_label,v_reason);
  return pg_catalog.jsonb_build_object('ok',true);
end;
$$;

-- Add durable presence to the existing teammate roster payload.
create or replace function public.admin_teammates() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.admin_caller()) then return public.order_error(403,'Admins only.'); end if;
  return pg_catalog.jsonb_build_object('teammates',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id',r.user_id,'name',coalesce(nullif(p.name,'Player'),u.email,''),'email',coalesce(u.email,''),'image',coalesce(p.image,''),'country',coalesce(p.country,''),
    'joined',coalesce(r.role_set_at,u.created_at),'lastSeen',u.last_sign_in_at,'games',pg_catalog.to_jsonb(coalesce(a.approved_games,'{}')),'gg',coalesce(a.gg_access,false),'discord',d.username,
    'suspended',case when coalesce(a.suspended,false) then pg_catalog.jsonb_build_object('reason',a.suspended_reason,'at',a.suspended_at,'by',coalesce((select coalesce(nullif(bp.name,'Player'),bu.email) from auth.users bu left join public.profiles bp on bp.id=bu.id where bu.id=a.suspended_by),'')) end,
    'online',exists(select 1 from public.teammate_presence tp where tp.user_id=r.user_id and tp.online and tp.last_seen_at > pg_catalog.clock_timestamp()-interval '20 seconds') or exists(select 1 from public.orders o where o.assigned_teammate_id=r.user_id and o.status='in_progress'),
    'playing',exists(select 1 from public.orders o where o.assigned_teammate_id=r.user_id and o.status='in_progress'),
    'completed',(select pg_catalog.count(*) from public.orders o where o.assigned_teammate_id=r.user_id and o.status='completed'),
    'accepted',(select pg_catalog.count(*) from public.order_assignments h where h.teammate_id=r.user_id),
    'earned30UsdCents',coalesce((select pg_catalog.sum(o.payout_usd_cents) from public.orders o where o.assigned_teammate_id=r.user_id and o.status='completed' and o.completed_at > pg_catalog.clock_timestamp()-interval '30 days'),0),
    'warnings',(select pg_catalog.count(*) from public.order_chat_flags f where f.actor_id=r.user_id and f.status='warned')) order by coalesce(r.role_set_at,u.created_at) desc)
    from public.account_roles r join auth.users u on u.id=r.user_id left join public.profiles p on p.id=r.user_id
    left join public.teammate_order_access a on a.user_id=r.user_id left join public.discord_accounts d on d.user_id=r.user_id where r.role='teammate'),'[]'::jsonb));
end;
$$;

revoke all on function public.presence_teammate_ready(uuid),public.presence_desk_result(uuid),public.desk_set_online(boolean),public.desk_check_in(timestamptz),
 public.admin_presence_check_in(boolean),public.admin_presence(),public.admin_set_teammate_offline(uuid,text),public.presence_public_count(),public.support_online_admins()
 from public,anon,authenticated,service_role;
grant execute on function public.desk_set_online(boolean),public.desk_check_in(timestamptz),public.admin_presence_check_in(boolean),public.admin_presence(),public.admin_set_teammate_offline(uuid,text) to authenticated;
grant execute on function public.presence_public_count() to anon,authenticated;
grant execute on function public.support_online_admins() to service_role;

commit;
