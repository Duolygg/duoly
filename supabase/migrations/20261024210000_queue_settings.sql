-- Durable teammate queue settings (ledger #33).
-- Personal settings filter the normal queue and acceptance. Admin handovers intentionally keep only admin-approved access checks.
begin;

alter table public.teammate_order_access
  add column enabled_games text[] not null default array['lol','val','cs2','fn','cod','apex','r6','mr','ow','rl','tft','fc','arc','mc','pu']::text[] check (
    pg_catalog.cardinality(enabled_games) <= 15
    and enabled_games <@ array['lol','val','cs2','fn','cod','apex','r6','mr','ow','rl','tft','fc','arc','mc','pu']::text[]
    and pg_catalog.array_position(enabled_games,null) is null),
  add column voice_opt_in boolean not null default true;

create function public.teammate_queue_settings() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_access public.teammate_order_access; v_allowed text[]; v_enabled text[];
begin
  if v_actor is null then return public.order_error(401,'Authentication required.'); end if;
  select a.* into v_access from public.account_roles r
    join public.teammate_order_access a on a.user_id=r.user_id
    where r.user_id=v_actor and r.role='teammate';
  if v_access.user_id is null then return public.order_error(403,'Teammates only.'); end if;
  v_allowed := case when v_access.gg_access then
    array['lol','val','cs2','fn','cod','apex','r6','mr','ow','rl','tft','fc','arc','mc','pu']::text[]
    else v_access.approved_games end;
  select coalesce(pg_catalog.array_agg(g order by n),'{}'::text[]) into v_enabled
    from pg_catalog.unnest(array['lol','val','cs2','fn','cod','apex','r6','mr','ow','rl','tft','fc','arc','mc','pu']::text[]) with ordinality x(g,n)
    where g=any(v_allowed) and g=any(v_access.enabled_games);
  return pg_catalog.jsonb_build_object('allowed_games',v_allowed,'enabled_games',v_enabled,'gg_access',v_access.gg_access,'voice_opt_in',v_access.voice_opt_in);
end;
$$;

create function public.set_teammate_queue_settings(p_enabled_games text[],p_voice_opt_in boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_access public.teammate_order_access; v_allowed text[];
begin
  if v_actor is null then return public.order_error(401,'Authentication required.'); end if;
  perform 1 from public.account_roles where user_id=v_actor and role='teammate' for update;
  if not found then return public.order_error(403,'Teammates only.'); end if;
  select a.* into v_access from public.teammate_order_access a where a.user_id=v_actor for update;
  if v_access.user_id is null then return public.order_error(403,'Teammate access required.'); end if;
  v_allowed := case when v_access.gg_access then
    array['lol','val','cs2','fn','cod','apex','r6','mr','ow','rl','tft','fc','arc','mc','pu']::text[]
    else v_access.approved_games end;
  if p_enabled_games is null or p_voice_opt_in is null
    or pg_catalog.cardinality(p_enabled_games)>15
    or pg_catalog.array_position(p_enabled_games,null) is not null
    or not p_enabled_games <@ v_allowed
    or (select pg_catalog.count(*) from pg_catalog.unnest(p_enabled_games) g) <> (select pg_catalog.count(distinct g) from pg_catalog.unnest(p_enabled_games) g)
  then return public.order_error(400,'Choose only games approved for your account.'); end if;
  update public.teammate_order_access set enabled_games=p_enabled_games,voice_opt_in=p_voice_opt_in where user_id=v_actor;
  return public.teammate_queue_settings();
end;
$$;

create function public.teammate_queue_personal_eligible(p_order public.orders,p_user uuid) returns boolean
language sql stable security invoker set search_path = '' as $$
  select exists(select 1 from public.teammate_order_access a where a.user_id=p_user
    and p_order.game=any(a.enabled_games) and (a.voice_opt_in or not p_order.voice));
$$;

-- Latest definition from origin/main 20261022093000_order_foundation.sql, with the personal settings predicate added.
create or replace function public.teammate_order_queue() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_result jsonb;
begin
  if v_actor is null then return public.order_error(401, 'Authentication required.'); end if;
  if not exists (select 1 from public.account_roles as r join public.teammate_order_access as a on a.user_id = r.user_id where r.user_id = v_actor and r.role = 'teammate' and a.discord_id is not null and a.discord_verified_at is not null and not a.suspended) then return public.order_error(403, 'Verified teammate access required.'); end if;
  perform public.order_sweep(100);
  select coalesce(pg_catalog.jsonb_agg(public.order_teammate_dto(q) order by q.queued_at desc, q.id), '[]'::jsonb) into v_result
    from (select o.* from public.orders as o where o.status = 'queued' and o.queued_at + interval '5 minutes' > pg_catalog.clock_timestamp()
      and public.order_eligible(o, v_actor) and public.teammate_queue_personal_eligible(o,v_actor)
      and not exists (select 1 from public.orders as busy where busy.assigned_teammate_id = v_actor and busy.status = 'in_progress')
      order by o.queued_at desc, o.id limit 100) as q;
  return pg_catalog.jsonb_build_object('orders', v_result);
end;
$$;

-- Latest definition from origin/main 20261022093000_order_foundation.sql, with the personal settings predicate added before mutation.
create or replace function public.accept_order(p_order_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v public.orders; v_assignment uuid; v_now timestamptz;
begin
  if v_actor is null then return public.order_error(401, 'Authentication required.'); end if;
  perform 1 from public.account_roles as r where r.user_id = v_actor and r.role = 'teammate' for update;
  if not found then return public.order_error(403, 'Teammate role required.'); end if;
  perform 1 from public.teammate_order_access as a where a.user_id = v_actor and a.discord_id is not null and a.discord_verified_at is not null and not a.suspended for share;
  if not found then return public.order_error(403, 'Verified teammate access required.'); end if;
  select o.* into v from public.orders as o where o.id = p_order_id for update;
  if v.id is null or not public.order_eligible(v, v_actor) or not public.teammate_queue_personal_eligible(v,v_actor) then return public.order_error(404, 'Order not found.'); end if;
  if public.order_expire_locked(v.id) or v.status = 'cancelled' then return public.order_error(410, 'Order expired or cancelled.'); end if;
  perform public.order_sweep(100);
  if v.status <> 'queued' then return public.order_error(409, 'Order already taken.'); end if;
  if exists (select 1 from public.orders as o where o.assigned_teammate_id = v_actor and o.status = 'in_progress') then return public.order_error(409, 'Teammate already busy.'); end if;
  v_now := pg_catalog.clock_timestamp();
  insert into public.order_assignments(order_id, teammate_id, accepted_at) values(v.id, v_actor, v_now) returning id into v_assignment;
  update public.orders set status = 'in_progress', assigned_teammate_id = v_actor, current_assignment_id = v_assignment, accepted_at = v_now
    where id = v.id and status = 'queued'
      and queued_at + interval '5 minutes' > pg_catalog.clock_timestamp() returning * into v;
  if not found then
    delete from public.order_assignments where id = v_assignment;
    perform public.order_expire_locked(p_order_id);
    return public.order_error(410, 'Order expired or cancelled.');
  end if;
  return pg_catalog.jsonb_build_object('order', public.order_teammate_dto(v));
end;
$$;

revoke all on function public.teammate_queue_settings(),public.set_teammate_queue_settings(text[],boolean),public.teammate_queue_personal_eligible(public.orders,uuid)
 from public,anon,authenticated,service_role;
grant execute on function public.teammate_queue_settings(),public.set_teammate_queue_settings(text[],boolean) to authenticated;

commit;
