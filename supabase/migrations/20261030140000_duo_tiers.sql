-- Duo tiers (Fabian 2026-10-30, docs/product/duo-tiers.md). Builds on 20261030120000 (performance ranking).
--
-- Every game's duo services come in tiers by id: duo1 = Plus, duo2 = Pro, duo3 = Apex.
-- Teammate levels, set per teammate by an admin (Admin → Users):
--   standard   (default) Plus and Pro right away; Apex once it opens (below)
--   plus_only  hired with a lower rank: the Plus tier only, never Pro, Apex or any other non Gamer
--              Girl service
-- Apex orders: only teammates ranked TOP 1% or TOP 5% in the latest performance run (or the
-- customer's Diamond pick) can claim them at first; 100 seconds after the order goes public (the
-- moment it is posted in Discord) every standard teammate approved for the game can. Admin handover
-- links ignore all of this. Gamer Girl orders are not tiered.
begin;

alter table public.teammate_order_access
  add column duo_level text not null default 'standard' check (duo_level in ('standard', 'plus_only'));

create function public.duo_tier(p_service text) returns text
language sql immutable set search_path = '' as $$
  select case p_service when 'duo1' then 'plus' when 'duo2' then 'pro' when 'duo3' then 'apex' end;
$$;

-- When this teammate may claim the order under the tier rules; null = never (their level excludes it).
create function public.order_tier_open_at(p_order public.orders, p_access public.teammate_order_access)
returns timestamptz
language plpgsql stable security invoker set search_path = '' as $$
declare v_tier text := public.duo_tier(p_order.service);
begin
  if p_order.gg then return p_order.queued_at; end if;
  if p_access.duo_level = 'plus_only' then
    return case when v_tier = 'plus' then p_order.queued_at end;
  end if;
  if v_tier is distinct from 'apex' then return p_order.queued_at; end if;
  if exists (select 1 from public.order_teammate_picks k
              where k.order_id = p_order.id and k.queue_key = p_order.queued_at
                and k.teammate_id = p_access.user_id and k.release_reason is distinct from 'declined')
     or exists (select 1 from public.performance_scores s
                 where s.teammate_id = p_access.user_id and s.bracket in (1, 5)
                   and s.run_id = (select pg_catalog.max(r.id) from public.performance_runs r)) then
    return p_order.queued_at;
  end if;
  return public.order_public_queued_at(p_order) + interval '100 seconds';
end $$;

-- ---- replaced functions (live definitions plus the marked tier changes) -------------------------

-- Change: and the tier rule (order_tier_open_at).
create or replace function public.order_eligible(p_order public.orders, p_actor uuid)
 returns boolean
 language sql
 set search_path to ''
as $function$
  select exists (select 1 from public.account_roles as r
    join public.teammate_order_access as a on a.user_id = r.user_id
    where r.user_id = p_actor and r.role = 'teammate' and not a.suspended
      and a.discord_id is not null and a.discord_verified_at is not null
      and p_order.customer_id <> p_actor
      and ((a.gg_access and p_order.gg) or (not a.gg_access and not p_order.gg and p_order.game = any(a.approved_games)))
      and public.order_visible_at(p_order, a, pg_catalog.clock_timestamp()) <= pg_catalog.clock_timestamp()
      and public.order_tier_open_at(p_order, a) <= pg_catalog.clock_timestamp()
      and not exists (select 1 from public.order_assignments as h where h.order_id = p_order.id and h.teammate_id = p_actor and h.end_reason = 'customer_reroll'));
$function$;

-- Change: teammates whose level excludes the order never count it as missed, and Apex counts from
-- the moment it opened for them.
create or replace function public.order_expire_locked(p_id uuid)
 returns boolean
 language plpgsql
 set search_path to ''
as $function$
declare v public.orders; v_now timestamptz := pg_catalog.clock_timestamp();
begin
  select o.* into v from public.orders as o where o.id = p_id for update;
  if v.status = 'queued' and v.queued_at + interval '5 minutes' <= v_now then
    update public.orders set status = 'cancelled', cancelled_at = v_now, cancel_reason = 'queue_expired' where id = v.id;
    insert into public.order_misses(order_id, teammate_id, seen_sec, missed_at)
      select v.id, c.user_id, pg_catalog.floor(extract(epoch from v_now - c.shown_at))::integer, v_now
      from (
        select a.user_id,
               greatest(public.order_visible_at(v, a, v_now), pr.online_since, public.order_tier_open_at(v, a)) as shown_at
          from public.account_roles as r
          join public.teammate_order_access as a on a.user_id = r.user_id
          join public.teammate_presence as pr on pr.user_id = r.user_id
         where r.role = 'teammate' and not a.suspended
           and a.discord_id is not null and a.discord_verified_at is not null
           and v.customer_id <> r.user_id
           and ((a.gg_access and v.gg) or (not a.gg_access and not v.gg and v.game = any(a.approved_games)))
           and public.order_tier_open_at(v, a) is not null
           and pr.online and pr.online_since is not null
           and pr.last_seen_at > v_now - interval '20 seconds'
           and not exists (select 1 from public.order_assignments as h where h.order_id = v.id and h.teammate_id = r.user_id and h.end_reason = 'customer_reroll')
           and not exists (select 1 from public.orders as b where b.assigned_teammate_id = r.user_id and b.status = 'in_progress')
      ) as c
      where v_now - c.shown_at >= interval '60 seconds'
    on conflict (order_id, teammate_id) do nothing;
    return true;
  end if;
  return false;
end;
$function$;

-- Change: the bot link follows the tier rule.
create or replace function public.accept_handover(p_token_hash text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_h public.order_handovers;
  v_order public.orders;
  v_assignment uuid;
  v_now timestamptz;
  v_access public.teammate_order_access;
begin
  if v_actor is null then return public.order_error(401, 'Please log in.'); end if;
  perform 1 from public.account_roles r where r.user_id = v_actor and r.role = 'teammate' for update;
  if not found then return public.order_error(403, 'Only teammates can use handover links.'); end if;
  perform 1 from public.teammate_order_access a
    where a.user_id = v_actor and not a.suspended
      and a.discord_id is not null and a.discord_verified_at is not null for share;
  if not found then return public.order_error(403, 'Verified teammate access required.'); end if;
  select h.* into v_h from public.order_handovers h where h.token_hash = p_token_hash for update;
  if v_h.id is null then return public.order_error(404, 'This handover link is not valid.'); end if;
  select o.* into v_order from public.orders o where o.id = v_h.order_id for update;
  if v_h.revoked_at is not null then
    if v_order.status = 'cancelled' then return public.order_error(410, 'This order was cancelled.'); end if;
    return public.order_error(409, 'Someone already took this order.');
  end if;
  if v_h.expires_at <= pg_catalog.clock_timestamp() or public.order_expire_locked(v_order.id) then
    return public.order_error(410, 'This handover link has expired.');
  end if;
  select o.* into v_order from public.orders o where o.id = v_order.id for update;
  if v_order.status <> 'queued' then return public.order_error(409, 'Someone already took this order.'); end if;
  if v_order.customer_id = v_actor then return public.order_error(409, 'You cannot take your own order.'); end if;
  if public.order_public_queued_at(v_order) > pg_catalog.clock_timestamp() and not public.order_picked_for(v_order, v_actor) then
    return public.order_error(409, 'This order is reserved for another teammate for a moment. Try again shortly.');
  end if;
  if not exists (
    select 1 from public.account_roles r
    join public.teammate_order_access a on a.user_id = r.user_id
    where r.user_id = v_actor and r.role = 'teammate' and not a.suspended
      and a.discord_id is not null and a.discord_verified_at is not null
      and ((a.gg_access and v_order.gg) or
        (not a.gg_access and not v_order.gg and v_order.game = any(a.approved_games)))) then
    return public.order_error(403, 'This order is outside your approved game access.');
  end if;
  -- Duo tiers (20261030140000): the bot's Discord link follows the teammate's level; an admin's link
  -- can give any order to anyone.
  if v_h.kind = 'bot' then
    select a.* into v_access from public.teammate_order_access a where a.user_id = v_actor;
    if public.order_tier_open_at(v_order, v_access) is null then
      return public.order_error(403, 'Your teammate level does not include this service.');
    end if;
    if public.order_tier_open_at(v_order, v_access) > pg_catalog.clock_timestamp() then
      return public.order_error(409, 'This order is for top teammates for a moment. Try again shortly.');
    end if;
  end if;
  -- the bot's link never gives the order back to a teammate the customer switched away from
  -- (the original: wasRerolled && handover !== 'admin'); an admin's link still can
  if v_h.kind = 'bot' and exists (select 1 from public.order_assignments a
       where a.order_id = v_order.id and a.teammate_id = v_actor and a.end_reason = 'customer_reroll') then
    return public.order_error(403, 'The customer switched away from you on this order, so it goes to another teammate.');
  end if;
  if exists (select 1 from public.orders o where o.assigned_teammate_id = v_actor and o.status = 'in_progress') then
    return public.order_error(409, 'Finish your current order first.');
  end if;
  v_now := pg_catalog.clock_timestamp();
  insert into public.order_assignments(order_id, teammate_id, accepted_at)
    values(v_order.id, v_actor, v_now) returning id into v_assignment;
  update public.orders set status = 'in_progress', assigned_teammate_id = v_actor,
      current_assignment_id = v_assignment, accepted_at = v_now
    where id = v_order.id and status = 'queued'
      and queued_at + interval '5 minutes' > pg_catalog.clock_timestamp()
    returning * into v_order;
  if not found then
    delete from public.order_assignments where id = v_assignment;
    perform public.order_expire_locked(v_h.order_id);
    return public.order_error(410, 'This handover link has expired.');
  end if;
  return pg_catalog.jsonb_build_object('order', public.order_teammate_dto(v_order));
end;
$function$;

-- Change: the bot link page says when the level excludes the order.
create or replace function public.handover_info(p_token_hash text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_h public.order_handovers;
  v_order public.orders;
  v_access public.teammate_order_access;
begin
  if v_actor is null then return public.order_error(401, 'Please log in.'); end if;
  if not exists (select 1 from public.account_roles r where r.user_id = v_actor and r.role = 'teammate') then
    return public.order_error(403, 'Only teammates can use handover links.');
  end if;
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then
    return pg_catalog.jsonb_build_object('state', 'invalid');
  end if;
  perform public.order_sweep(100);
  select h.* into v_h from public.order_handovers h where h.token_hash = p_token_hash;
  if v_h.id is null then return pg_catalog.jsonb_build_object('state', 'invalid'); end if;
  select o.* into v_order from public.orders o where o.id = v_h.order_id;
  if v_order.status = 'cancelled' then
    return pg_catalog.jsonb_build_object('state', 'cancelled', 'order', public.order_teammate_dto(v_order));
  end if;
  if v_h.revoked_at is not null then
    return pg_catalog.jsonb_build_object('state', case when v_h.revoke_reason = 'accepted' then 'taken' else 'invalid' end,
      'order', public.order_teammate_dto(v_order));
  end if;
  if v_h.expires_at <= pg_catalog.clock_timestamp() then
    return pg_catalog.jsonb_build_object('state', 'expired', 'order', public.order_teammate_dto(v_order));
  end if;
  if v_order.status <> 'queued' then
    return pg_catalog.jsonb_build_object('state', 'taken', 'order', public.order_teammate_dto(v_order));
  end if;
  select a.* into v_access from public.teammate_order_access a where a.user_id = v_actor;
  if v_access.user_id is null or v_access.suspended or v_access.discord_id is null or v_access.discord_verified_at is null then
    return pg_catalog.jsonb_build_object('state', 'blocked', 'reason', 'Connect Discord and make sure your teammate account is active.',
      'order', public.order_teammate_dto(v_order), 'by', v_h.created_by_name, 'expiresAt', v_h.expires_at);
  end if;
  if not ((v_access.gg_access and v_order.gg) or
      (not v_access.gg_access and not v_order.gg and v_order.game = any(v_access.approved_games))) then
    return pg_catalog.jsonb_build_object('state', 'blocked', 'reason', 'This order is outside your approved game access.',
      'order', public.order_teammate_dto(v_order), 'by', v_h.created_by_name, 'expiresAt', v_h.expires_at);
  end if;
  if v_h.kind = 'bot' and public.order_tier_open_at(v_order, v_access) is null then
    return pg_catalog.jsonb_build_object('state', 'blocked', 'reason', 'Your teammate level does not include this service.',
      'order', public.order_teammate_dto(v_order), 'by', v_h.created_by_name, 'expiresAt', v_h.expires_at);
  end if;
  return pg_catalog.jsonb_build_object('state', 'open', 'order', public.order_teammate_dto(v_order),
    'by', v_h.created_by_name, 'expiresAt', v_h.expires_at);
end;
$$;

-- Change: a Plus only teammate cannot be picked for a Pro or Apex order.
create or replace function public.order_pick_start(p_order_id uuid, p_source uuid) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare o public.orders; v_teammate uuid;
begin
  select * into o from public.orders where id = p_order_id;
  if o.id is null or o.status <> 'queued' or p_source is null then return false; end if;
  if (public.loyalty_level(public.loyalty_valid_count(o.customer_id))->>'index')::integer < 4 then return false; end if;
  v_teammate := public.order_pick_candidate(o.customer_id, p_source, o.game, o.gg, o.voice, pg_catalog.clock_timestamp());
  if v_teammate is null then return false; end if;
  -- Duo tiers: the customer's pick wins over the Apex window, but never over a Plus only level.
  if (select public.order_tier_open_at(o, a) from public.teammate_order_access a where a.user_id = v_teammate) is null then
    return false;
  end if;
  insert into public.order_teammate_picks(order_id, customer_id, teammate_id, source_order_id, queue_key, window_ends_at)
    values (o.id, o.customer_id, v_teammate, p_source, o.queued_at, o.queued_at + interval '60 seconds')
    on conflict (order_id) do nothing;
  return true;
end $$;

-- ---- admin ----------------------------------------------------------------------------------------

create function public.admin_duo_levels() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.admin_caller()) then return public.order_error(403, 'Admins only.'); end if;
  return pg_catalog.jsonb_build_object('levels', coalesce((
    select pg_catalog.jsonb_object_agg(a.user_id, a.duo_level)
      from public.teammate_order_access a
      join public.account_roles r on r.user_id = a.user_id and r.role = 'teammate'), '{}'::jsonb));
end;
$$;

create function public.admin_set_duo_level(p_user uuid, p_level text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid; v_name text; v_label text;
begin
  select id, name into v_actor, v_name from public.admin_caller();
  if v_actor is null then return public.order_error(403, 'Admins only.'); end if;
  if p_level is null or p_level not in ('standard', 'plus_only') then
    return public.order_error(400, 'Unknown teammate level.');
  end if;
  if not exists (select 1 from public.account_roles where user_id = p_user and role = 'teammate') then
    return public.order_error(409, 'Only teammates have a level. Make them a teammate first.');
  end if;
  insert into public.teammate_order_access(user_id, duo_level) values (p_user, p_level)
    on conflict (user_id) do update set duo_level = excluded.duo_level;
  select coalesce(nullif(p.name, 'Player'), u.email, '') into v_label
    from auth.users as u left join public.profiles as p on p.id = u.id where u.id = p_user;
  perform public.admin_log(v_actor, v_name, 'Changed teammate level', v_label,
    case p_level when 'plus_only' then 'Plus only (Duo Plus only)' else 'Standard (Duo Plus and Pro, Apex after 100 s)' end);
  return pg_catalog.jsonb_build_object('userId', p_user, 'level', p_level);
end;
$$;

revoke all on function public.duo_tier(text), public.order_tier_open_at(public.orders, public.teammate_order_access),
  public.admin_duo_levels(), public.admin_set_duo_level(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_duo_levels(), public.admin_set_duo_level(uuid, text) to authenticated;

commit;
