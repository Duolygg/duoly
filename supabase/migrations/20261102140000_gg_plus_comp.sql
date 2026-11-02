-- Gamer Girl access as an add-on (owner request 2026-11-02).
--
-- Until now a teammate had either Gamer Girl access (Gamer Girl and Social orders, every game,
-- nothing else) or approved games (comp orders in those games), never both. Now the two are
-- independent:
--   Gamer Girl orders: gg_access (every game, as before);
--   comp orders:       the game is in approved_games (as before), whether or not gg_access is on.
-- So a Gamer Girl teammate who is good at a game can be approved for its comp orders too, with the
-- same rank tiers as everyone else (order_tier_open_at already treats both kinds).
--
-- Every function below is its live definition with one change: the comp half of the access check
-- loses "not gg_access and". Queue settings, online counts and homepage teammates already give a
-- Gamer Girl teammate every game, and Discord roles don't depend on access, so they stay.
-- No teammate had Gamer Girl access when this was written, so nobody's access changes today.
-- Deploy the code first (teammate_queue_settings gains a key the live code doesn't know yet).
begin;

-- From 20261030140000_duo_tiers.sql; changed: comp orders no longer require "not gg_access" (1x).
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
      and ((a.gg_access and p_order.gg) or (not p_order.gg and p_order.game = any(a.approved_games)))
      and public.order_visible_at(p_order, a, pg_catalog.clock_timestamp()) <= pg_catalog.clock_timestamp()
      and public.order_tier_open_at(p_order, a) <= pg_catalog.clock_timestamp()
      and not exists (select 1 from public.order_assignments as h where h.order_id = p_order.id and h.teammate_id = p_actor and h.end_reason = 'customer_reroll'));
$function$;

-- From 20261030140000_duo_tiers.sql; changed: comp orders no longer require "not gg_access" (1x).
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
           and ((a.gg_access and v.gg) or (not v.gg and v.game = any(a.approved_games)))
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

-- From 20261022093000_order_foundation.sql; changed: comp orders no longer require "not gg_access" (1x).
create or replace function public.teammate_current_assignment() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v public.orders;
begin
  if v_actor is null then return public.order_error(401, 'Authentication required.'); end if;
  if not exists (select 1 from public.account_roles as r join public.teammate_order_access as a on a.user_id = r.user_id where r.user_id = v_actor and r.role = 'teammate' and a.discord_id is not null and a.discord_verified_at is not null and not a.suspended) then return public.order_error(403, 'Verified teammate access required.'); end if;
  perform public.order_sweep(100);
  select o.* into v from public.orders as o
    join public.teammate_order_access as a on a.user_id = v_actor
    where o.assigned_teammate_id = v_actor and o.status = 'in_progress'
      and ((a.gg_access and o.gg) or (not o.gg and o.game = any(a.approved_games)));
  return pg_catalog.jsonb_build_object('order', case when v.id is not null then public.order_teammate_dto(v) else null end);
end;
$$;

-- From 20261022140000_order_proofs.sql; changed: comp orders no longer require "not gg_access" (1x).
create or replace function public.order_proof_player(p_order public.orders, p_actor uuid) returns boolean
language sql volatile security invoker set search_path = '' as $$
  select p_actor is not null and p_order.assigned_teammate_id = p_actor
    and p_order.customer_id <> p_actor
    and exists (select 1 from public.account_roles as r
      join public.teammate_order_access as a on a.user_id = r.user_id
      where r.user_id = p_actor and r.role = 'teammate' and not a.suspended
        and a.discord_id is not null and a.discord_verified_at is not null
        and ((a.gg_access and p_order.gg) or (not p_order.gg and p_order.game = any(a.approved_games))))
    and exists (select 1 from public.order_assignments as a
      where a.id = p_order.current_assignment_id and a.order_id = p_order.id
        and a.teammate_id = p_actor and a.end_reason is distinct from 'customer_reroll');
$$;

-- From 20261024130000_order_completion.sql; changed: comp orders no longer require "not gg_access" (1x).
create or replace function public.order_chat_viewer(p_order public.orders,p_assignment_id uuid) returns text
language sql stable security invoker set search_path = '' as $$
  select case
    when r.role = 'admin' then 'admin'
    when r.role = 'customer' and p_order.customer_id = auth.uid() then 'customer'
    when r.role = 'teammate' and exists (
      select 1 from public.order_assignments as a
      join public.teammate_order_access as x on x.user_id = a.teammate_id
      where a.id = p_assignment_id and a.order_id = p_order.id
        and a.teammate_id = auth.uid()
        and ((a.end_reason is null and a.ended_at is null and p_order.status='in_progress')
          or (a.end_reason='completed' and a.ended_at is not null and p_order.status='completed'))
        and p_order.current_assignment_id = a.id and p_order.assigned_teammate_id = a.teammate_id
        and not x.suspended and x.discord_id is not null and x.discord_verified_at is not null
        and ((x.gg_access and p_order.gg) or (not p_order.gg and p_order.game = any(x.approved_games)))
    ) then 'teammate' else null end
  from public.account_roles as r where r.user_id = auth.uid();
$$;

-- From 20261030140000_duo_tiers.sql; changed: comp orders no longer require "not gg_access" (1x).
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
      (not v_order.gg and v_order.game = any(v_access.approved_games))) then
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

-- From 20261030140000_duo_tiers.sql; changed: comp orders no longer require "not gg_access" (1x).
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

-- From 20261026160000_perks.sql; changed: comp orders no longer require "not gg_access" (1x).
create or replace function public.order_pick_candidate(p_customer uuid, p_source uuid, p_game text, p_gg boolean, p_voice boolean, p_now timestamptz)
returns uuid
language sql stable security invoker set search_path = '' as $$
  select s.assigned_teammate_id from public.orders s
    join public.account_roles r on r.user_id = s.assigned_teammate_id and r.role = 'teammate'
    join public.teammate_order_access a on a.user_id = r.user_id
    join public.teammate_presence tp on tp.user_id = r.user_id
   where s.id = p_source and s.customer_id = p_customer and s.status = 'completed' and s.admin_refunded_at is null
     and s.assigned_teammate_id <> p_customer
     and not a.suspended and a.discord_id is not null and a.discord_verified_at is not null
     and ((a.gg_access and p_gg) or (not p_gg and p_game = any(a.approved_games)))
     and p_game = any(a.enabled_games) and (a.voice_opt_in or not p_voice)
     and tp.online and tp.last_seen_at > p_now - interval '20 seconds'
     and not exists(select 1 from public.orders b where b.assigned_teammate_id = r.user_id and b.status = 'in_progress');
$$;

-- From 20261024090000_admin_foundation.sql; changed: the audit line names the comp games of a Gamer Girl
-- teammate too (they now count).
create or replace function public.admin_set_access(p_user_id uuid, p_games text[], p_gg boolean) returns jsonb
language plpgsql security definer set search_path = '' as $
declare v_actor uuid; v_name text; v_role text; v_games text[]; v_label text;
begin
  select id, name into v_actor, v_name from public.admin_caller();
  if v_actor is null then return public.order_error(403, 'Admins only.'); end if;
  select role into v_role from public.account_roles where user_id = p_user_id for update;
  if v_role is null then return public.order_error(404, 'Account not found.'); end if;
  if v_role <> 'teammate' then return public.order_error(409, 'Only teammates get order access. Make them a teammate first.'); end if;
  -- Canonical order, unknown ids dropped (lib/access.js).
  select coalesce(pg_catalog.array_agg(g order by i), '{}') into v_games
    from pg_catalog.unnest(array['lol','val','cs2','fn','cod','apex','r6','mr','ow','rl','tft','fc','arc','mc','pu']::text[]) with ordinality as t(g, i)
   where g = any(coalesce(p_games, '{}'));
  insert into public.teammate_order_access(user_id, approved_games, gg_access) values (p_user_id, v_games, coalesce(p_gg, false))
    on conflict (user_id) do update set approved_games = excluded.approved_games, gg_access = excluded.gg_access;
  select coalesce(nullif(p.name, 'Player'), u.email, '') into v_label
    from auth.users as u left join public.profiles as p on p.id = u.id where u.id = p_user_id;
  perform public.admin_log(v_actor, v_name, 'Changed order access', v_label,
    case when coalesce(p_gg, false) and pg_catalog.cardinality(v_games) > 0
           then 'Gamer Girl (all games) + comp: ' || pg_catalog.array_to_string(v_games, ', ')
         when coalesce(p_gg, false) then 'Gamer Girl (Gamer Girl orders, all games)'
         when pg_catalog.cardinality(v_games) = 0 then 'no games'
         else pg_catalog.array_to_string(v_games, ', ') end);
  return pg_catalog.jsonb_build_object('access', pg_catalog.jsonb_build_object('games', pg_catalog.to_jsonb(v_games), 'gg', coalesce(p_gg, false)));
end;
$;

-- From 20261029130000_social_sessions.sql; changed: also returns approved_games, the comp games, so
-- the teammate desk can tell a Gamer Girl teammate's comp orders apart (allowed_games is every game
-- for her). Deploy the code first: its contract accepts the key being there or missing.
create or replace function public.teammate_queue_settings() returns jsonb
language plpgsql stable security definer set search_path = '' as $
declare v_actor uuid := auth.uid(); v_access public.teammate_order_access; v_allowed text[]; v_enabled text[];
begin
  if v_actor is null then return public.order_error(401,'Authentication required.'); end if;
  select a.* into v_access from public.account_roles r
    join public.teammate_order_access a on a.user_id=r.user_id
    where r.user_id=v_actor and r.role='teammate';
  if v_access.user_id is null then return public.order_error(403,'Teammates only.'); end if;
  v_allowed := case when v_access.gg_access then
    array['lol','val','cs2','fn','cod','apex','r6','mr','ow','rl','tft','fc','arc','mc','pu','social']::text[]
    else v_access.approved_games end;
  select coalesce(pg_catalog.array_agg(g order by n),'{}'::text[]) into v_enabled
    from pg_catalog.unnest(array['lol','val','cs2','fn','cod','apex','r6','mr','ow','rl','tft','fc','arc','mc','pu','social']::text[]) with ordinality x(g,n)
    where g=any(v_allowed) and g=any(v_access.enabled_games);
  return pg_catalog.jsonb_build_object('allowed_games',v_allowed,'enabled_games',v_enabled,'gg_access',v_access.gg_access,'voice_opt_in',v_access.voice_opt_in,
    'approved_games',v_access.approved_games);
end;
$;

commit;
