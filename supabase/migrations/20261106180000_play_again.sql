-- Play again (owner decisions 2026-11-05, docs/product/play-again.md).
--
-- In the order room, once the teammate closed the order (status completed: proof and W/L in), the
-- customer can book the same session again with one tap: same game, service, units or bundle,
-- server, rank, in-game name, voice and mood, paid from the balance first and then a card they
-- saved at checkout. The new order's checkout intent carries pick_source_order_id = that order, so
-- create_paid_order -> order_pick_start (20261106170000) gives the same teammate the order alone
-- for 60 seconds; then it reaches the normal queue like any other order.
--
-- customer_play_again(order) tells the order room whether the button shows, and the server checks
-- it again before any payment. Reasons it doesn't:
--   not_done             the order isn't completed, or an admin refunded it
--   streamer             a Twitch booking (rebooked from the homepage)
--   free_coaching        the free monthly coaching order
--   open_order           the customer already has an order queued or in progress
--   teammate_busy        the teammate is playing another order
--   teammate_away        the teammate is offline
--   teammate_unavailable online and free, but can't take it (game access, queue settings, voice,
--                        suspended, duo level)
begin;

create function public.customer_play_again(p_order uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); o public.orders; v_now timestamptz := pg_catalog.clock_timestamp();
  v_online boolean; v_reason text;
begin
  if v_actor is null then return public.order_error(401, 'Authentication required.'); end if;
  if not exists(select 1 from public.account_roles r where r.user_id = v_actor and r.role = 'customer') then
    return public.order_error(403, 'Customer role required.');
  end if;
  select * into o from public.orders where id = p_order and customer_id = v_actor;
  if o.id is null then return public.order_error(404, 'Order not found.'); end if;
  v_online := coalesce((select t.online and t.last_seen_at > v_now - interval '20 seconds'
    from public.teammate_presence t where t.user_id = o.assigned_teammate_id), false);
  v_reason := case
    when o.status <> 'completed' or o.admin_refunded_at is not null then 'not_done'
    when public.order_streamer(o.id) is not null then 'streamer'
    when exists(select 1 from public.free_coaching_claims c where c.order_id = o.id) then 'free_coaching'
    when exists(select 1 from public.orders b where b.customer_id = v_actor and b.status in ('queued','in_progress')) then 'open_order'
    when exists(select 1 from public.orders b where b.assigned_teammate_id = o.assigned_teammate_id and b.status = 'in_progress') then 'teammate_busy'
    when not v_online then 'teammate_away'
    when public.order_pick_candidate(v_actor, o.id, o.game, o.gg, o.voice, v_now) is null
      or (select public.order_tier_open_at(o, a) from public.teammate_order_access a
           where a.user_id = o.assigned_teammate_id) is null then 'teammate_unavailable'
  end;
  return pg_catalog.jsonb_build_object('available', v_reason is null, 'reason', v_reason);
end $$;

revoke all on function public.customer_play_again(uuid) from public, anon, authenticated, service_role;
grant execute on function public.customer_play_again(uuid) to authenticated;

commit;
