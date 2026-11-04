-- Suspension locks the account, and taking the Teammate role on Discord suspends.
--
-- 1. A suspended teammate can't sign in anymore. Suspending sets the Supabase Auth ban
--    (auth.users.banned_until = 'infinity'), so Auth refuses every sign-in (email, Google, Discord)
--    and every token refresh, and their open sessions are deleted. The app also signs out anyone
--    whose account is banned on the next page load (src/server/auth/context.ts), which covers the
--    access token that is still valid for up to an hour. Reinstating lifts the ban.
-- 2. When an admin takes the "Teammate" role from a teammate in the Discord server, the role sync
--    (src/server/discord/role-sync.ts) notices on its next read of that member and calls
--    discord_teammate_role_removed: the teammate is suspended exactly like from the admin panel,
--    with the reason "Teammate role removed on Discord". Someone playing an order is suspended
--    once the order is finished (the sync asks again). The sync no longer gives the Teammate role
--    back to suspended teammates; reinstating in the admin panel gives it back.
--
-- teammate_apply_suspension is the one place both paths go through.
-- From 20261024142000_presence.sql: admin_set_suspended (now calls teammate_apply_suspension).
begin;

-- Suspend or reinstate (callers check who may do it). p_actor null = done by the Discord sync.
create function public.teammate_apply_suspension(p_user_id uuid, p_suspended boolean, p_reason text,
  p_actor uuid, p_actor_name text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_label text; v_reason text := pg_catalog.btrim(coalesce(p_reason, ''));
begin
  insert into public.teammate_order_access(user_id) values (p_user_id) on conflict (user_id) do nothing;
  update public.teammate_order_access set suspended = coalesce(p_suspended, false),
    suspended_reason = case when p_suspended then pg_catalog.left(v_reason, 200) else '' end,
    suspended_by = case when p_suspended then p_actor end,
    suspended_at = case when p_suspended then pg_catalog.clock_timestamp() end
   where user_id = p_user_id;
  if p_suspended then
    update public.teammate_presence set online = false, online_since = null,
      set_offline_reason = 'Suspended: ' || pg_catalog.left(v_reason, 80), set_offline_by = p_actor
     where user_id = p_user_id;
    update public.streamer_settings set stream_online = false, online_since = null, updated_at = pg_catalog.clock_timestamp()
     where user_id = p_user_id and stream_online;
    -- locked out: no new sign-in or refresh, and the open sessions end
    update auth.users set banned_until = 'infinity'::timestamptz where id = p_user_id;
    delete from auth.sessions where user_id = p_user_id;
  else
    update auth.users set banned_until = null where id = p_user_id;
  end if;
  select coalesce(nullif(p.name, 'Player'), u.email, '') into v_label
    from auth.users u left join public.profiles p on p.id = u.id where u.id = p_user_id;
  perform public.admin_log(p_actor, p_actor_name,
    case when p_suspended then 'Suspended teammate' else 'Reinstated teammate' end, v_label, v_reason);
end $$;

-- From 20261024142000_presence.sql; changed: the work moved to teammate_apply_suspension (adds the login lock).
create or replace function public.admin_set_suspended(p_user_id uuid,p_suspended boolean,p_reason text default '') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid; v_name text; v_role text; v_reason text := pg_catalog.btrim(coalesce(p_reason,''));
begin
  select id,name into v_actor,v_name from public.admin_caller();
  if v_actor is null then return public.order_error(403,'Admins only.'); end if;
  select role into v_role from public.account_roles where user_id=p_user_id for update;
  if v_role is null then return public.order_error(404,'Account not found.'); end if;
  if v_role<>'teammate' then return public.order_error(409,'Only teammates can be suspended.'); end if;
  if p_suspended and exists(select 1 from public.orders where assigned_teammate_id=p_user_id and status='in_progress') then return public.order_error(409,'They’re playing an order right now. Suspend them once it’s finished.'); end if;
  if p_suspended and pg_catalog.char_length(v_reason)<3 then return public.order_error(400,'Add a reason. It goes into the audit log.'); end if;
  perform public.teammate_apply_suspension(p_user_id, coalesce(p_suspended,false), v_reason, v_actor, v_name);
  return pg_catalog.jsonb_build_object('ok',true);
end;
$$;

-- Discord sync only: someone took the Teammate role from this Discord member by hand.
-- Returns status: suspended | busy (playing an order; ask again later) | ignored.
create function public.discord_teammate_role_removed(p_discord_id text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_user uuid;
begin
  select a.user_id into v_user
    from public.teammate_order_access as a
    join public.account_roles as r on r.user_id = a.user_id and r.role = 'teammate'
   where a.discord_id = p_discord_id and not a.suspended
   for update of a;
  if v_user is null then return pg_catalog.jsonb_build_object('status', 'ignored'); end if;
  if exists (select 1 from public.orders where assigned_teammate_id = v_user and status = 'in_progress') then
    return pg_catalog.jsonb_build_object('status', 'busy', 'userId', v_user);
  end if;
  perform public.teammate_apply_suspension(v_user, true, 'Teammate role removed on Discord', null, 'Discord');
  return pg_catalog.jsonb_build_object('status', 'suspended', 'userId', v_user);
end $$;

revoke all on function public.teammate_apply_suspension(uuid, boolean, text, uuid, text),
  public.discord_teammate_role_removed(text) from public, anon, authenticated, service_role;
grant execute on function public.discord_teammate_role_removed(text) to service_role;

commit;
