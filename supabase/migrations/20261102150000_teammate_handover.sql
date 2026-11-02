-- Teammates hand over an order they're playing (owner request 2026-11-02).
--
-- A customer asks for a specific teammate after someone else took the order. The teammate playing
-- it creates a one-time link (teammate_create_handover) and sends it to that teammate, e.g. on
-- Discord. Opening /claim/<token> and accepting moves the order: the first teammate's assignment
-- ends as 'handed_over' (no proof, no pay), the new teammate gets a fresh assignment and chat, and
-- the customer is told in the chat. No customer confirmation (owner choice).
--
-- Rules: only the teammate currently playing the order, while it's in progress; the link lasts 15
-- minutes and dies when their part ends (completed, cancelled, re-rolled, handed over) or when
-- they make a new one; the new teammate needs the same game access as anyone (Gamer Girl orders:
-- Gamer Girl access; comp: the game approved), must not be busy with another order and can't be
-- the customer. Like an admin's link, it skips the duo tier gate (the customer asked for them).
-- The customer's re-roll window doesn't restart.
--
-- handover_info and accept_handover are the 20261102140000_gg_plus_comp.sql versions with a
-- teammate branch; revoke_order_handover is the 20261024170000 version plus the teammate case.
begin;

alter table public.order_handovers
  drop constraint order_handovers_kind_check,
  add constraint order_handovers_kind_check check (kind in ('admin', 'bot', 'teammate')),
  add column assignment_id uuid references public.order_assignments(id) on delete restrict,
  add constraint order_handovers_teammate_assignment check ((kind = 'teammate') = (assignment_id is not null)),
  drop constraint order_handovers_revoke_reason_check,
  add constraint order_handovers_revoke_reason_check
    check (revoke_reason in ('replaced','accepted','cancelled','rerolled','completed'));

alter table public.order_assignments
  drop constraint order_assignments_end_reason_check,
  add constraint order_assignments_end_reason_check
    check (end_reason in ('customer_reroll','completed','handed_over'));

-- the chat says so when an order moves to another teammate
alter table public.order_chat_messages
  drop constraint order_chat_messages_system_event_check,
  add constraint order_chat_messages_system_event_check
    check (system_event in ('accepted','completed','reviewed','handed_over'));

-- The teammate playing an order makes a link for the teammate who should take over.
create function public.teammate_create_handover(p_order_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_name text; v_order public.orders; v_token text; v_hash text; v_expires timestamptz;
begin
  if v_actor is null then return public.order_error(401, 'Authentication required.'); end if;
  if not exists (select 1 from public.account_roles r join public.teammate_order_access a on a.user_id = r.user_id
      where r.user_id = v_actor and r.role = 'teammate' and not a.suspended
        and a.discord_id is not null and a.discord_verified_at is not null) then
    return public.order_error(403, 'Verified teammate access required.');
  end if;
  select o.* into v_order from public.orders o where o.id = p_order_id for update;
  if v_order.id is null or v_order.assigned_teammate_id is distinct from v_actor then
    return public.order_error(404, 'Order not found.');
  end if;
  if v_order.status <> 'in_progress' then
    return public.order_error(409, 'Only an order you’re playing can be handed over.');
  end if;
  update public.order_handovers set revoked_at = pg_catalog.clock_timestamp(), revoke_reason = 'replaced'
    where order_id = v_order.id and kind = 'teammate' and revoked_at is null;
  select coalesce(nullif(pg_catalog.split_part(p.name, ' ', 1), ''), 'A teammate') into v_name
    from public.profiles p where p.id = v_actor;
  v_token := pg_catalog.rtrim(pg_catalog.translate(pg_catalog.encode(extensions.gen_random_bytes(18), 'base64'), '+/', '-_'), '=');
  v_hash := pg_catalog.encode(extensions.digest(v_token, 'sha256'), 'hex');
  insert into public.order_handovers(order_id, token_hash, kind, created_by, created_by_name, expires_at, assignment_id)
    values(v_order.id, v_hash, 'teammate', v_actor, coalesce(v_name, 'A teammate'),
           pg_catalog.clock_timestamp() + interval '15 minutes', v_order.current_assignment_id)
    returning expires_at into v_expires;
  return pg_catalog.jsonb_build_object('token', v_token, 'expiresAt', v_expires);
end;
$$;

-- The teammate changes their mind: the link stops working.
create function public.teammate_revoke_handover(p_order_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid();
begin
  if v_actor is null then return public.order_error(401, 'Authentication required.'); end if;
  if not exists (select 1 from public.orders o where o.id = p_order_id and o.assigned_teammate_id = v_actor) then
    return public.order_error(404, 'Order not found.');
  end if;
  update public.order_handovers set revoked_at = pg_catalog.clock_timestamp(), revoke_reason = 'replaced'
    where order_id = p_order_id and kind = 'teammate' and created_by = v_actor and revoked_at is null;
  return pg_catalog.jsonb_build_object('revoked', true);
end;
$$;

-- accept_handover's teammate path (the caller already locked the link and the order).
create function public.accept_teammate_handover(v_h public.order_handovers, v_order public.orders, v_actor uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_now timestamptz := pg_catalog.clock_timestamp(); v_assignment uuid; v_from text; v_to text;
begin
  if v_h.expires_at <= v_now then return public.order_error(410, 'This handover link has expired.'); end if;
  if v_order.status <> 'in_progress' or v_order.current_assignment_id is distinct from v_h.assignment_id then
    return public.order_error(409, 'This order isn’t up for handover any more.');
  end if;
  if v_actor = v_h.created_by then
    return public.order_error(409, 'This is your own handover link. Send it to the teammate who should take over.');
  end if;
  if v_order.customer_id = v_actor then return public.order_error(409, 'You cannot take your own order.'); end if;
  if not exists (
    select 1 from public.account_roles r
    join public.teammate_order_access a on a.user_id = r.user_id
    where r.user_id = v_actor and r.role = 'teammate' and not a.suspended
      and a.discord_id is not null and a.discord_verified_at is not null
      and ((a.gg_access and v_order.gg) or (not v_order.gg and v_order.game = any(a.approved_games)))) then
    return public.order_error(403, 'This order is outside your approved game access.');
  end if;
  if exists (select 1 from public.orders o where o.assigned_teammate_id = v_actor and o.status = 'in_progress') then
    return public.order_error(409, 'Finish your current order first.');
  end if;
  update public.order_assignments set ended_at = v_now, end_reason = 'handed_over'
    where id = v_order.current_assignment_id and ended_at is null;
  insert into public.order_assignments(order_id, teammate_id, accepted_at)
    values(v_order.id, v_actor, v_now) returning id into v_assignment;
  -- the order stays in progress: the chat trigger opens the new teammate's chat
  update public.orders set assigned_teammate_id = v_actor, current_assignment_id = v_assignment
    where id = v_order.id
    returning * into v_order;
  select coalesce(nullif(pg_catalog.split_part(p.name, ' ', 1), ''), 'your new teammate') into v_to
    from public.profiles p where p.id = v_actor;
  v_from := v_h.created_by_name;
  perform public.order_chat_append(v_assignment, 'system', 'Duoly', '',
    v_from || ' handed this order to ' || v_to || '. ' || v_to || ' takes it from here.', null, 'handed_over');
  perform public.order_chat_invalidate(v_assignment);
  return pg_catalog.jsonb_build_object('order', public.order_teammate_dto(v_order));
end;
$$;

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
  -- A teammate's link: the order stays theirs (in progress) until someone takes it over.
  if v_h.kind = 'teammate' then
    if v_order.status <> 'in_progress' or v_order.current_assignment_id is distinct from v_h.assignment_id then
      return pg_catalog.jsonb_build_object('state', 'taken', 'kind', v_h.kind, 'order', public.order_teammate_dto(v_order));
    end if;
    if v_actor = v_h.created_by then
      return pg_catalog.jsonb_build_object('state', 'blocked', 'kind', v_h.kind,
        'reason', 'This is your own handover link. Send it to the teammate who should take over.',
        'order', public.order_teammate_dto(v_order), 'by', v_h.created_by_name, 'expiresAt', v_h.expires_at);
    end if;
  elsif v_order.status <> 'queued' then
    return pg_catalog.jsonb_build_object('state', 'taken', 'order', public.order_teammate_dto(v_order));
  end if;
  select a.* into v_access from public.teammate_order_access a where a.user_id = v_actor;
  if v_access.user_id is null or v_access.suspended or v_access.discord_id is null or v_access.discord_verified_at is null then
    return pg_catalog.jsonb_build_object('state', 'blocked', 'reason', 'Connect Discord and make sure your teammate account is active.',
      'order', public.order_teammate_dto(v_order), 'by', v_h.created_by_name, 'expiresAt', v_h.expires_at);
  end if;
  if not ((v_access.gg_access and v_order.gg) or
      (not v_order.gg and v_order.game = any(v_access.approved_games))) then
    return pg_catalog.jsonb_build_object('state', 'blocked', 'reason', 'This order is outside your approved game access.',
      'order', public.order_teammate_dto(v_order), 'by', v_h.created_by_name, 'expiresAt', v_h.expires_at);
  end if;
  if v_h.kind = 'bot' and public.order_tier_open_at(v_order, v_access) is null then
    return pg_catalog.jsonb_build_object('state', 'blocked', 'reason', 'Your teammate level does not include this service.',
      'order', public.order_teammate_dto(v_order), 'by', v_h.created_by_name, 'expiresAt', v_h.expires_at);
  end if;
  return pg_catalog.jsonb_build_object('state', 'open', 'kind', v_h.kind, 'order', public.order_teammate_dto(v_order),
    'by', v_h.created_by_name, 'expiresAt', v_h.expires_at);
end;
$$;

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
  if v_h.kind = 'teammate' then
    return public.accept_teammate_handover(v_h, v_order, v_actor);
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
        (not v_order.gg and v_order.game = any(a.approved_games)))) then
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

create or replace function public.revoke_order_handover() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.status = 'queued' and (new.status <> 'queued' or new.queued_at is distinct from old.queued_at) then
    update public.order_handovers
       set revoked_at = pg_catalog.clock_timestamp(),
           revoke_reason = case
             when new.status = 'in_progress' then 'accepted'
             when new.status = 'cancelled' then 'cancelled'
             else 'rerolled'
           end
     where order_id = new.id and revoked_at is null;
  end if;
  -- A teammate's link (20261102150000): ends with their part of the order.
  if old.status = 'in_progress' and (new.status <> 'in_progress'
      or new.current_assignment_id is distinct from old.current_assignment_id) then
    update public.order_handovers
       set revoked_at = pg_catalog.clock_timestamp(),
           revoke_reason = case
             when new.status = 'in_progress' then 'accepted'
             when new.status = 'completed' then 'completed'
             when new.status = 'cancelled' then 'cancelled'
             else 'rerolled'
           end
     where order_id = new.id and kind = 'teammate' and revoked_at is null;
  end if;
  return new;
end;
$$;
-- it now also runs when the order moves to another teammate (a handover keeps it in progress)
drop trigger orders_revoke_handover on public.orders;
create trigger orders_revoke_handover after update of status, queued_at, current_assignment_id on public.orders
  for each row execute function public.revoke_order_handover();

revoke all on function public.teammate_create_handover(uuid), public.teammate_revoke_handover(uuid),
  public.accept_teammate_handover(public.order_handovers, public.orders, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.teammate_create_handover(uuid), public.teammate_revoke_handover(uuid) to authenticated;

commit;
