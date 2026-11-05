-- Customers favorite the teammates they liked (owner decision 2026-11-05).
--
-- Favorites are for every customer: a heart on the teammate card in the order room, on the review
-- screen and on the dashboard's "Your teammates" list. The dashboard lists favorites with who is
-- online right now. Rebook opens checkout on the game they last played together.
--
-- Teammate user ids never leave the database. The browser names a teammate by a handle: one of the
-- customer's own orders that teammate played (in progress or completed).
--
-- Queue: a teammate the customer favorited sees that customer's orders the moment they reach the
-- normal queue, with no priority delay (owner decision 2026-11-05). Everyone else keeps their usual
-- delay, so the order reaches more teammates the longer it waits. What stays as it is:
--   * a pick window still open from before 20261106170000 (which ends the Diamond pick): favorites
--     see the order when it goes public (order_public_queued_at), like everyone else.
--   * Twitch bookings: only the booked streamer ever sees them (20261105100000_twitch_streaming.sql).
--   * game access, Gamer Girl access, a plus-only duo level, queue settings, suspension, re-roll.
-- A favorite skips the 100-second wait on Apex duo orders: that gate is a delay too.
-- From 20261105100000_twitch_streaming.sql: order_visible_at, order_tier_open_at (each notes its change).
begin;

create table public.customer_favorites (
  customer_id uuid not null references public.profiles(id) on delete cascade,
  teammate_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  primary key (customer_id, teammate_id),
  check (customer_id <> teammate_id)
);
alter table public.customer_favorites enable row level security;
revoke all on table public.customer_favorites from public, anon, authenticated, service_role;

create function public.customer_favorites_max() returns integer
language sql immutable security invoker set search_path = '' as $$ select 100 $$;

-- The teammate behind one of the actor's own orders, or an error answer.
create function public.customer_favorite_order(p_actor uuid, p_order uuid, out teammate uuid, out refusal jsonb)
language plpgsql stable security invoker set search_path = '' as $$
declare v public.orders;
begin
  if p_actor is null then refusal := public.order_error(401, 'Authentication required.'); return; end if;
  if not exists(select 1 from public.account_roles r where r.user_id = p_actor and r.role = 'customer') then
    refusal := public.order_error(403, 'Customer role required.'); return;
  end if;
  select o.* into v from public.orders o where o.id = p_order and o.customer_id = p_actor;
  if v.id is null then refusal := public.order_error(404, 'Order not found.'); return; end if;
  if v.status not in ('in_progress', 'completed') then return; end if;
  teammate := v.assigned_teammate_id;
end $$;

-- GET: { favorite, available } for the teammate on one of the customer's orders. available is false
-- while nobody plays the order (queued or cancelled).
create function public.customer_order_favorite(p_order uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v record;
begin
  select * into v from public.customer_favorite_order(v_actor, p_order);
  if v.refusal is not null then return v.refusal; end if;
  return pg_catalog.jsonb_build_object('available', v.teammate is not null,
    'favorite', v.teammate is not null and exists(select 1 from public.customer_favorites f
      where f.customer_id = v_actor and f.teammate_id = v.teammate));
end $$;

-- POST: favorite (p_on true) or unfavorite the teammate on one of the customer's orders.
create function public.customer_order_favorite_set(p_order uuid, p_on boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v record;
begin
  if p_on is null then return public.order_error(400, 'Invalid order request.'); end if;
  select * into v from public.customer_favorite_order(v_actor, p_order);
  if v.refusal is not null then return v.refusal; end if;
  if v.teammate is null then return public.order_error(409, 'You can favorite your teammate once they accept.'); end if;
  if not p_on then
    delete from public.customer_favorites f where f.customer_id = v_actor and f.teammate_id = v.teammate;
  elsif not exists(select 1 from public.customer_favorites f where f.customer_id = v_actor and f.teammate_id = v.teammate) then
    -- one at a time per customer, so the cap holds under concurrent clicks
    perform 1 from public.profiles p where p.id = v_actor for update;
    if (select pg_catalog.count(*) from public.customer_favorites f where f.customer_id = v_actor)
       >= public.customer_favorites_max() then
      return public.order_error(409, 'You can have up to 100 favorites. Remove one first.');
    end if;
    insert into public.customer_favorites(customer_id, teammate_id) values (v_actor, v.teammate)
      on conflict do nothing;
  end if;
  return pg_catalog.jsonb_build_object('available', true, 'favorite', p_on);
end $$;

-- The dashboard list: online first, then busy (playing an order), then offline; newest favorite first.
-- handle and game are the latest completed (not refunded) order the customer played with them, else
-- the latest other one (Rebook opens that game).
create function public.customer_favorites() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_actor uuid := auth.uid();
begin
  if v_actor is null then return public.order_error(401, 'Authentication required.'); end if;
  if not exists(select 1 from public.account_roles r where r.user_id = v_actor and r.role = 'customer') then
    return public.order_error(403, 'Customer role required.');
  end if;
  return pg_catalog.jsonb_build_object(
    'favorites', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('handle', x.handle, 'name', p.name,
          'image', p.image, 'country', p.country, 'game', x.game, 'orders', x.done, 'status', x.status)
        order by case x.status when 'online' then 0 when 'busy' then 1 else 2 end, f.created_at desc, x.handle)
      from public.customer_favorites f
      join public.profiles p on p.id = f.teammate_id
      cross join lateral (
        select o.id handle, o.game,
          (select pg_catalog.count(*)::integer from public.orders c where c.customer_id = v_actor
             and c.assigned_teammate_id = f.teammate_id and c.status = 'completed') done,
          case when not coalesce((select t.online and t.last_seen_at > pg_catalog.clock_timestamp() - interval '20 seconds'
                 from public.teammate_presence t where t.user_id = f.teammate_id), false)
                 or not public.presence_teammate_ready(f.teammate_id) then 'offline'
               when public.presence_busy(f.teammate_id) then 'busy'
               else 'online' end status
        from public.orders o
        where o.customer_id = v_actor and o.assigned_teammate_id = f.teammate_id
          and o.status in ('in_progress', 'completed')
        order by (o.status = 'completed' and o.admin_refunded_at is null) desc, o.completed_at desc nulls last, o.id
        limit 1
      ) x
      where f.customer_id = v_actor
    ), '[]'::jsonb));
end $$;

-- ---- queue: no delay for the customer's favorites ---------------------------------------------

create function public.customer_favorite_of(p_customer uuid, p_teammate uuid) returns boolean
language sql stable security invoker set search_path = '' as $$
  select exists(select 1 from public.customer_favorites f where f.customer_id = p_customer and f.teammate_id = p_teammate);
$$;

-- From 20261105100000_twitch_streaming.sql; changed: a favorite sees it when it goes public, no delay.
create or replace function public.order_visible_at(p_order public.orders, p_access public.teammate_order_access, p_now timestamptz)
returns timestamptz
language plpgsql stable security invoker set search_path = '' as $$
begin
  if exists (select 1 from public.order_streamer_bookings as b where b.order_id = p_order.id and b.teammate_id = p_access.user_id) then
    return p_order.queued_at;
  end if;
  if exists(select 1 from public.order_teammate_picks k where k.order_id = p_order.id and k.queue_key = p_order.queued_at
              and k.teammate_id = p_access.user_id and k.release_reason is distinct from 'declined') then
    return p_order.queued_at;
  end if;
  if public.customer_favorite_of(p_order.customer_id, p_access.user_id) then
    return public.order_public_queued_at(p_order);
  end if;
  return public.order_public_queued_at(p_order)
    + pg_catalog.make_interval(secs => public.teammate_priority_delay(p_order, p_access, p_now));
end $$;

-- From 20261105100000_twitch_streaming.sql; changed: a favorite skips the Apex wait (not plus-only).
create or replace function public.order_tier_open_at(p_order public.orders, p_access public.teammate_order_access)
returns timestamptz
language plpgsql stable security invoker set search_path = '' as $$
declare v_tier text := public.duo_tier(p_order.service); v_streamer uuid := public.order_streamer(p_order.id);
begin
  if v_streamer is not null then
    return case when v_streamer = p_access.user_id then p_order.queued_at end;
  end if;
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
  if public.customer_favorite_of(p_order.customer_id, p_access.user_id) then
    return public.order_public_queued_at(p_order);
  end if;
  return public.order_public_queued_at(p_order) + interval '100 seconds';
end $$;

revoke all on function public.customer_favorite_of(uuid,uuid) from public, anon, authenticated, service_role;

revoke all on function public.customer_favorites_max(), public.customer_favorite_order(uuid,uuid),
  public.customer_order_favorite(uuid), public.customer_order_favorite_set(uuid,boolean), public.customer_favorites()
  from public, anon, authenticated, service_role;
grant execute on function public.customer_order_favorite(uuid), public.customer_order_favorite_set(uuid,boolean),
  public.customer_favorites() to authenticated;

commit;
