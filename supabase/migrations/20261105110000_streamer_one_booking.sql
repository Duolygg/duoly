-- Twitch streaming: one booking at a time (docs/product/twitch-streaming.md).
--
-- A streamer was already hidden while playing an order. Two customers could still book the same
-- streamer a few minutes apart: while the first booking waited in the queue, or while the first
-- customer was still paying. The second booking would then be cancelled for availability.
-- Now a streamer is not bookable while any of these is true:
--   * they are playing an order (as before)
--   * a booking for them is waiting in the queue (until accepted, or expired after 5 minutes)
--   * another customer started paying for them in the last 10 minutes (an open checkout intent)
-- They are bookable again automatically once the session ends, the booking expires, or the other
-- checkout is abandoned for 10 minutes. The customer whose checkout it is can still retry it.
--
-- streamer_ready + streamer_busy(user, customer) are the rule; streamer_live(user) keeps its meaning for the public
-- list and the desk (nobody is exempt). streamer_checkout_quote gains p_customer so checkout can exempt
-- the customer's own open intent; the 3-argument version is dropped (no deployed code calls it yet).
-- From 20261105100000_twitch_streaming.sql: streamer_live, streamer_checkout_quote.
begin;

-- Online for streaming and allowed to stream (the rules from 20261105100000).
create function public.streamer_ready(p_user uuid) returns boolean
language sql stable security invoker set search_path = '' as $$
  select exists (
    select 1 from public.streamer_settings as s
      join public.account_roles as r on r.user_id = s.user_id and r.role = 'teammate'
      join public.teammate_order_access as a on a.user_id = s.user_id
      join public.teammate_presence as p on p.user_id = s.user_id
     where s.user_id = p_user and s.stream_online and s.rate_eur_cents is not null
       and pg_catalog.cardinality(public.streamer_games(a)) > 0
       and not a.suspended and a.discord_id is not null and a.discord_verified_at is not null
       and p.online and p.last_seen_at > pg_catalog.clock_timestamp() - interval '20 seconds');
$$;

-- Already taken: playing an order, a booking waiting for them, or another customer paying for them.
create function public.streamer_busy(p_user uuid, p_customer uuid) returns boolean
language sql stable security invoker set search_path = '' as $$
  select exists (select 1 from public.orders as b where b.assigned_teammate_id = p_user and b.status = 'in_progress')
    or exists (select 1 from public.order_streamer_bookings as k join public.orders as o on o.id = k.order_id
                where k.teammate_id = p_user and o.status = 'queued'
                  and o.queued_at + interval '5 minutes' > pg_catalog.clock_timestamp())
    or exists (select 1 from public.checkout_intents as i
                where i.streamer_id = p_user and i.status in ('open', 'processing')
                  and i.created_at > pg_catalog.clock_timestamp() - interval '10 minutes'
                  and i.customer_id is distinct from p_customer);
$$;

-- From 20261105100000_twitch_streaming.sql; changed: one booking at a time (streamer_ready and not streamer_busy).
create or replace function public.streamer_live(p_user uuid) returns boolean
language sql stable security invoker set search_path = '' as $$
  select public.streamer_ready(p_user) and not public.streamer_busy(p_user, null);
$$;

drop function public.streamer_checkout_quote(uuid, text, integer);

-- From 20261105100000_twitch_streaming.sql; changed: p_customer, and a clear "already booked" answer.
create function public.streamer_checkout_quote(p_handle uuid, p_game text, p_hours integer, p_customer uuid)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare s public.streamer_settings; a public.teammate_order_access; v_name text;
begin
  select * into s from public.streamer_settings where handle = p_handle;
  if s.user_id is null then return public.order_error(409, 'That streamer just went offline.'); end if;
  v_name := coalesce(public.streamer_first_name(s.user_id), 'This streamer');
  if not public.streamer_ready(s.user_id) then return public.order_error(409, 'That streamer just went offline.'); end if;
  if public.streamer_busy(s.user_id, p_customer) then
    return public.order_error(409, v_name || ' is already booked. Try again when they’re back online.');
  end if;
  select * into a from public.teammate_order_access where user_id = s.user_id;
  if not (p_game = any(public.streamer_games(a))) then return public.order_error(400, 'That streamer doesn’t stream this game.'); end if;
  if not (p_hours = any(s.durations)) then return public.order_error(400, 'That streamer doesn’t offer this length.'); end if;
  return pg_catalog.jsonb_build_object('streamerId', s.user_id, 'name', public.streamer_first_name(s.user_id),
    'rateEurCents', s.rate_eur_cents);
end $$;

revoke all on function public.streamer_ready(uuid), public.streamer_busy(uuid, uuid), public.streamer_checkout_quote(uuid, text, integer, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.streamer_checkout_quote(uuid, text, integer, uuid) to service_role;

commit;
