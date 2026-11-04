-- Teammates go offline on their own after 4 hours without any activity (docs/product/presence-afk.md).
--
-- Activity is what the desk and every other Duoly page already send with each heartbeat (lastActive:
-- clicks, typing, scrolling, mouse moves, loading a page), stored as teammate_presence.last_active_at.
-- desk_check_in now:
--   * keeps the clock at zero while the teammate is busy: playing an order, or a streaming booking for
--     them waiting to be accepted (the same "taken" rules as streamer_busy). The 4 hours start once
--     they're free again.
--   * switches them offline once last_active_at is 4 hours old, with set_offline_reason
--     'No activity for 4 hours' and no admin (set_offline_by null). The desk shows it like an admin
--     action, worded as automatic.
--   * a check-in without lastActive no longer counts as activity (it used to count as "now").
-- presence_desk_result gains afk_in: seconds until that happens while online and free, else null.
-- The pages warn 5 minutes before (browser notification, and a banner on the desk).
-- From 20261024142000_presence.sql: presence_desk_result, desk_check_in. Grants are kept by replace.
begin;

create function public.presence_afk_limit() returns interval
language sql immutable security invoker set search_path = '' as $$ select interval '4 hours' $$;

-- Busy: playing an order, or a streaming booking for them still waiting to be accepted.
create function public.presence_busy(p_user uuid) returns boolean
language sql stable security invoker set search_path = '' as $$
  select exists (select 1 from public.orders as o where o.assigned_teammate_id = p_user and o.status = 'in_progress')
    or exists (select 1 from public.order_streamer_bookings as k join public.orders as o on o.id = k.order_id
                where k.teammate_id = p_user and o.status = 'queued'
                  and o.queued_at + interval '5 minutes' > pg_catalog.clock_timestamp());
$$;

-- From 20261024142000_presence.sql; changed: afk_in.
create or replace function public.presence_desk_result(p_user uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select pg_catalog.jsonb_build_object(
    'online', coalesce(x.online and x.last_seen_at > pg_catalog.clock_timestamp()-interval '20 seconds',false),
    'online_since', x.online_since,
    'forced_offline', case when not coalesce(x.online,false) and x.set_offline_reason <> '' then
      pg_catalog.jsonb_build_object('reason',x.set_offline_reason,'by',coalesce((
        select coalesce(nullif(p.name,'Player'),u.email,'Admin') from auth.users u
        left join public.profiles p on p.id=u.id where u.id=x.set_offline_by
      ),'')) end,
    'afk_in', case when coalesce(x.online,false) and not public.presence_busy(p_user) then
      greatest(0, pg_catalog.floor(extract(epoch from
        coalesce(x.last_active_at, x.online_since) + public.presence_afk_limit() - pg_catalog.clock_timestamp())))::integer end
  ) from (select p.* from public.teammate_presence p where p.user_id=p_user) x
  right join (select 1) seed on true;
$$;

-- From 20261024142000_presence.sql; changed: busy keeps the clock at zero, 4 hours idle goes offline,
-- and a missing lastActive is not activity.
create or replace function public.desk_check_in(p_last_active timestamptz default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_now timestamptz := pg_catalog.clock_timestamp(); v public.teammate_presence;
begin
  if v_actor is null then return public.order_error(401,'Authentication required.'); end if;
  if not exists(select 1 from public.account_roles where user_id=v_actor and role='teammate') then return public.order_error(403,'Teammates only.'); end if;
  if not public.presence_teammate_ready(v_actor) then
    update public.teammate_presence set online=false,online_since=null where user_id=v_actor;
    return public.presence_desk_result(v_actor);
  end if;
  update public.teammate_presence set last_seen_at=v_now,
    last_active_at=case when public.presence_busy(v_actor) then v_now
      else greatest(coalesce(last_active_at,online_since,'epoch'::timestamptz),
                    least(v_now,coalesce(p_last_active,'epoch'::timestamptz))) end
   where user_id=v_actor and online
  returning * into v;
  if v.user_id is not null and v.last_active_at + public.presence_afk_limit() <= v_now then
    update public.teammate_presence set online=false,online_since=null,
      set_offline_reason='No activity for 4 hours',set_offline_by=null
     where user_id=v_actor;
  end if;
  return public.presence_desk_result(v_actor);
end;
$$;

revoke all on function public.presence_afk_limit(), public.presence_busy(uuid) from public, anon, authenticated, service_role;

commit;
