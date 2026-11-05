-- Loyalty perks after favorites (owner decisions 2026-11-05):
--
-- 1. "Pick any teammate" (Diamond) is gone. Favorites give every customer what it was for: a
--    teammate they liked sees their order first (20261106150000_customer_favorites.sql). Diamond
--    now gets Duoly PRO free instead (20261106160000_diamond_free_pro.sql). The pick window itself
--    stays: Play again (20261106180000) uses it to give the same teammate the new order first.
--    customer_perks: 'pickTeammate' becomes 'freePro' (eligible at Diamond, the same rule as
--    pro_included). customer_pickable_teammates answers "not eligible" for older pages.
-- 2. Re-rolls per order: 2 for everyone, 4 from Gold (loyalty index 2, 250 valid orders), unlimited
--    with PRO (is_pro, which includes Diamond). Still only in the first 5 minutes after accept.
--    customer_reroll_limit() tells the order room the customer's own limit (null = unlimited).
--
-- From 20261026160000_perks.sql: customer_perks_for, customer_pickable_teammates;
-- 20261030140000_duo_tiers.sql: order_pick_start; 20261105100000_twitch_streaming.sql: reroll_order.
-- Each notes its change; CREATE OR REPLACE keeps the grants.
-- Deploy order: this migration first, then the code (the code reads 'freePro' and the new RPC).
begin;

-- ---- 1. no more Diamond pick ------------------------------------------------------------------

-- From 20261030140000_duo_tiers.sql; changed: no Diamond check. The app no longer sends a Diamond
-- pick, so checkout_intents.pick_source_order_id now only comes from Play again
-- (20261106180000_play_again.sql): the teammate of that order gets the new one alone for 60 s.
create or replace function public.order_pick_start(p_order_id uuid, p_source uuid) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare o public.orders; v_teammate uuid;
begin
  select * into o from public.orders where id = p_order_id;
  if o.id is null or o.status <> 'queued' or p_source is null then return false; end if;
  v_teammate := public.order_pick_candidate(o.customer_id, p_source, o.game, o.gg, o.voice, pg_catalog.clock_timestamp());
  if v_teammate is null then return false; end if;
  -- Duo tiers: the window wins over the Apex wait, but never over a Plus only level.
  if (select public.order_tier_open_at(o, a) from public.teammate_order_access a where a.user_id = v_teammate) is null then
    return false;
  end if;
  insert into public.order_teammate_picks(order_id, customer_id, teammate_id, source_order_id, queue_key, window_ends_at)
    values (o.id, o.customer_id, v_teammate, p_source, o.queued_at, o.queued_at + interval '60 seconds')
    on conflict (order_id) do nothing;
  return true;
end $$;

-- From 20261026160000_perks.sql; changed: always "not eligible", for pages from before this change.
create or replace function public.customer_pickable_teammates(p_game text, p_gg boolean, p_voice boolean) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_actor uuid := auth.uid();
begin
  if v_actor is null then return public.order_error(401, 'Authentication required.'); end if;
  if not exists(select 1 from public.account_roles r where r.user_id = v_actor and r.role = 'customer') then
    return public.order_error(403, 'Customer role required.');
  end if;
  return pg_catalog.jsonb_build_object('eligible', false, 'teammates', '[]'::jsonb);
end $$;

-- From 20261026160000_perks.sql; changed: 'pickTeammate' is now 'freePro'.
create or replace function public.customer_perks_for(p_customer uuid) returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare v_level jsonb; v_index integer; v_month date; v_used boolean;
begin
  v_level := public.loyalty_level(public.loyalty_valid_count(p_customer));
  v_index := (v_level->>'index')::integer;
  v_month := public.free_coaching_month(pg_catalog.clock_timestamp());
  v_used := exists(select 1 from public.free_coaching_claims f where f.customer_id = p_customer and f.month = v_month and f.state = 'used');
  return pg_catalog.jsonb_build_object(
    'level', v_level->>'id',
    'freeCoaching', pg_catalog.jsonb_build_object('eligible', v_index >= 3, 'used', v_used,
      'available', v_index >= 3 and not v_used, 'month', pg_catalog.to_char(v_month, 'YYYY-MM')),
    'freePro', pg_catalog.jsonb_build_object('eligible', v_index >= 4));
end $$;

-- ---- 2. re-rolls: 2, 4 from Gold, unlimited with PRO ------------------------------------------

-- null = unlimited.
create function public.customer_reroll_limit_for(p_customer uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select case when public.is_pro(p_customer) then null
              when (public.loyalty_level(public.loyalty_valid_count(p_customer))->>'index')::integer >= 2 then 4
              else 2 end;
$$;

-- The signed-in customer's own limit, for the order room: { limit: integer | null }.
create function public.customer_reroll_limit() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_actor uuid := auth.uid();
begin
  if v_actor is null then return public.order_error(401, 'Authentication required.'); end if;
  if not exists(select 1 from public.account_roles r where r.user_id = v_actor and r.role = 'customer') then
    return public.order_error(403, 'Customer role required.');
  end if;
  return pg_catalog.jsonb_build_object('limit', public.customer_reroll_limit_for(v_actor));
end $$;

-- From 20261105100000_twitch_streaming.sql; changed: the limit is customer_reroll_limit_for.
create or replace function public.reroll_order(p_order_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v public.orders; v_now timestamptz; v_limit integer;
begin
  if v_actor is null then return public.order_error(401, 'Authentication required.'); end if;
  if not exists (select 1 from public.account_roles as r where r.user_id = v_actor and r.role = 'customer') then return public.order_error(403, 'Customer role required.'); end if;
  select o.* into v from public.orders as o where o.id = p_order_id and o.customer_id = v_actor for update;
  if v.id is null then return public.order_error(404, 'Order not found.'); end if;
  if public.order_expire_locked(v.id) or v.status = 'cancelled' then return public.order_error(410, 'Order expired or cancelled.'); end if;
  if public.order_streamer(v.id) is not null then return public.order_error(409, 'You booked this streamer, so this order can’t be rerolled.'); end if;
  perform public.order_sweep(100);
  v_now := pg_catalog.clock_timestamp();
  v_limit := public.customer_reroll_limit_for(v_actor);
  if v.status <> 'in_progress' or (v_limit is not null and v.rerolls >= v_limit) or v.accepted_at + interval '5 minutes' < v_now then return public.order_error(409, 'Reroll unavailable.'); end if;
  update public.order_assignments set ended_at = v_now, end_reason = 'customer_reroll' where id = v.current_assignment_id;
  update public.orders set status = 'queued', queued_at = v_now, accepted_at = null, assigned_teammate_id = null, current_assignment_id = null, rerolls = rerolls + 1 where id = v.id returning * into v;
  return pg_catalog.jsonb_build_object('order', public.order_customer_dto(v));
end;
$$;

revoke all on function public.customer_reroll_limit_for(uuid), public.customer_reroll_limit()
  from public, anon, authenticated, service_role;
grant execute on function public.customer_reroll_limit() to authenticated;

commit;
