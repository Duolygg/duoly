-- Twitch streaming bookings (docs/product/twitch-streaming.md).
--
-- Admins grant a teammate streaming for some of their approved games (teammate_order_access.stream_games).
-- The streamer sets an hourly rate (5-100 EUR), the durations customers can book (1-10 hours), an
-- optional Twitch username, and goes online for streaming. They are bookable ("live") only while:
-- streaming is switched on, their desk is online with a fresh heartbeat (20 s, like every other
-- presence check), they have a rate and at least one streaming game, are verified and not suspended,
-- and are not busy with an in-progress order.
--
-- A customer books a live streamer on the homepage (home_streamers, public) and pays as usual. The
-- server prices it from streamer_checkout_quote (rate x hours, payout 60% like every order, no PRO or
-- creator discount, wallet allowed) and stores the streamer on the checkout intent. When the intent
-- becomes paid, a trigger records the booking (order_streamer_bookings) in the same transaction that
-- creates the order, so create_paid_order itself is unchanged.
--
-- Queue: a booked order is visible at once, and only, to the booked streamer:
--   order_public_queued_at  -> 'infinity' for booked orders (no normal queue, no Discord post, no handover)
--   order_visible_at        -> queued_at for the booked streamer (no priority delay)
--   order_tier_open_at      -> queued_at for the booked streamer, never for anyone else
--   teammate_queue_personal_eligible -> the booked streamer always, nobody else (their queue game
--                              toggles and voice preference don't hide their own booking)
-- Everything else in the priority system is unchanged. Unaccepted bookings expire after 5 minutes and
-- are refunded like every queued order. reroll_order refuses booked orders (there is nobody else).
--
-- From: order_public_queued_at, order_visible_at, teammate_priority_delay (20261026160000_perks.sql);
-- order_tier_open_at (20261030140000_duo_tiers.sql); teammate_queue_personal_eligible
-- (20261024210000_queue_settings.sql); reroll_order (20261026120000_pro_subscription.sql);
-- admin_account_dto (20261024090000_admin_foundation.sql). Each one notes its change.
-- Deploy order: this migration first, then the code (the code calls the new functions).
begin;

-- ---- data -------------------------------------------------------------------------------------

alter table public.teammate_order_access
  add column stream_games text[] not null default '{}'
    check (stream_games <@ array['lol','val','cs2','fn','cod','apex','r6','mr','ow','rl','tft','fc','arc','mc','pu']::text[]
      and pg_catalog.array_position(stream_games, null) is null);

create table public.streamer_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  -- what the public list and checkout use instead of the user id
  handle uuid not null unique default pg_catalog.gen_random_uuid(),
  stream_online boolean not null default false,
  rate_eur_cents integer check (rate_eur_cents between 500 and 10000),
  durations integer[] not null default '{1,2}'
    check (pg_catalog.cardinality(durations) between 1 and 10
      and durations <@ array[1,2,3,4,5,6,7,8,9,10]
      and pg_catalog.array_position(durations, null) is null),
  twitch text check (twitch ~ '^[A-Za-z0-9_]{4,25}$'),
  online_since timestamptz,
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  check (not stream_online or rate_eur_cents is not null)
);

create table public.order_streamer_bookings (
  order_id uuid primary key references public.orders(id) on delete cascade,
  teammate_id uuid not null references public.profiles(id) on delete restrict,
  streamer_name text not null check (pg_catalog.char_length(streamer_name) between 1 and 40),
  rate_eur_cents integer not null check (rate_eur_cents between 500 and 10000),
  created_at timestamptz not null default pg_catalog.clock_timestamp()
);
create index order_streamer_bookings_teammate on public.order_streamer_bookings(teammate_id, created_at desc);

alter table public.checkout_intents
  add column streamer_id uuid references public.profiles(id) on delete restrict,
  add column streamer_name text check (pg_catalog.char_length(streamer_name) between 1 and 40),
  add column streamer_rate_eur_cents integer check (streamer_rate_eur_cents between 500 and 10000),
  add constraint checkout_intents_streamer check (
    (streamer_id is null) = (streamer_name is null) and (streamer_id is null) = (streamer_rate_eur_cents is null)
    and (streamer_id is null or (service = 'stream' and unit = 'hour' and not gg and pick_source_order_id is null and not free_coaching)));

alter table public.streamer_settings enable row level security;
alter table public.order_streamer_bookings enable row level security;
revoke all on table public.streamer_settings, public.order_streamer_bookings from public, anon, authenticated, service_role;
grant select on table public.streamer_settings, public.order_streamer_bookings to service_role;

-- ---- helpers ----------------------------------------------------------------------------------

-- Streaming games that still count: granted and still an approved game, in catalog order.
create function public.streamer_games(p_access public.teammate_order_access) returns text[]
language sql immutable security invoker set search_path = '' as $$
  select coalesce(pg_catalog.array_agg(x.g order by x.i), '{}'::text[])
    from pg_catalog.unnest(array['lol','val','cs2','fn','cod','apex','r6','mr','ow','rl','tft','fc','arc','mc','pu']::text[])
      with ordinality as x(g, i)
   where x.g = any(p_access.stream_games) and x.g = any(p_access.approved_games);
$$;

-- First name as the cards show it (home_teammates), or null when there is no real one.
create function public.streamer_first_name(p_user uuid) returns text
language sql stable security invoker set search_path = '' as $$
  select case when n.first = '' or n.first ~ '[@/:]' or pg_catalog.lower(n.first) = 'player' then null
              else pg_catalog.left(n.first, 16) end
    from (select pg_catalog.split_part(pg_catalog.btrim(pg_catalog.regexp_replace(
            coalesce(p.name, ''), '[[:cntrl:][:space:]]+', ' ', 'g')), ' ', 1) as first
            from public.profiles as p where p.id = p_user) as n;
$$;

-- Bookable right now (see the header).
create function public.streamer_live(p_user uuid) returns boolean
language sql stable security invoker set search_path = '' as $$
  select exists (
    select 1 from public.streamer_settings as s
      join public.account_roles as r on r.user_id = s.user_id and r.role = 'teammate'
      join public.teammate_order_access as a on a.user_id = s.user_id
      join public.teammate_presence as p on p.user_id = s.user_id
     where s.user_id = p_user and s.stream_online and s.rate_eur_cents is not null
       and pg_catalog.cardinality(public.streamer_games(a)) > 0
       and not a.suspended and a.discord_id is not null and a.discord_verified_at is not null
       and p.online and p.last_seen_at > pg_catalog.clock_timestamp() - interval '20 seconds'
       and not exists (select 1 from public.orders as b where b.assigned_teammate_id = p_user and b.status = 'in_progress'));
$$;

-- The booked streamer of an order, or null.
create function public.order_streamer(p_order_id uuid) returns uuid
language sql stable security invoker set search_path = '' as $$
  select b.teammate_id from public.order_streamer_bookings as b where b.order_id = p_order_id;
$$;

-- Paid intent with a streamer: record the booking with the order (same transaction as create_paid_order).
create function public.checkout_intent_streamer_booking() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.order_id is not null and old.order_id is null and new.streamer_id is not null then
    insert into public.order_streamer_bookings(order_id, teammate_id, streamer_name, rate_eur_cents)
      values (new.order_id, new.streamer_id, new.streamer_name, new.streamer_rate_eur_cents)
      on conflict (order_id) do nothing;
  end if;
  return null;
end $$;
create trigger checkout_intents_streamer_booking after update of order_id on public.checkout_intents
  for each row execute function public.checkout_intent_streamer_booking();

-- ---- queue visibility (replaced functions) ---------------------------------------------------

-- From 20261026160000_perks.sql; changed: a booked streaming order never enters the normal queue.
create or replace function public.order_public_queued_at(p_order public.orders) returns timestamptz
language plpgsql stable security invoker set search_path = '' as $$
declare k public.order_teammate_picks; v_at timestamptz; v_online boolean; v_seen timestamptz;
begin
  if exists (select 1 from public.order_streamer_bookings as b where b.order_id = p_order.id) then
    return 'infinity'::timestamptz;
  end if;
  select * into k from public.order_teammate_picks where order_id = p_order.id and queue_key = p_order.queued_at;
  if k.order_id is null then return p_order.queued_at; end if;
  v_at := least(k.window_ends_at, coalesce(k.released_at, k.window_ends_at));
  if k.released_at is null then
    select tp.online, tp.last_seen_at into v_online, v_seen from public.teammate_presence tp where tp.user_id = k.teammate_id;
    -- a heartbeat older than 20 seconds counts as offline from that moment
    v_at := least(v_at, coalesce(v_seen + interval '20 seconds', k.created_at));
    if not coalesce(v_online, false) and v_seen is null then v_at := least(v_at, k.created_at); end if;
  end if;
  return greatest(p_order.queued_at, v_at);
end $$;

-- From 20261026160000_perks.sql; changed: the booked streamer sees their booking at once.
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
  return public.order_public_queued_at(p_order)
    + pg_catalog.make_interval(secs => public.teammate_priority_delay(p_order, p_access, p_now));
end $$;

-- From 20261030140000_duo_tiers.sql; changed: a booked streaming order is open to its streamer only.
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
  return public.order_public_queued_at(p_order) + interval '100 seconds';
end $$;

-- From 20261024210000_queue_settings.sql; changed: a booking always shows to its streamer, never to others.
create or replace function public.teammate_queue_personal_eligible(p_order public.orders,p_user uuid) returns boolean
language sql stable security invoker set search_path = '' as $$
  select case when public.order_streamer(p_order.id) is not null then public.order_streamer(p_order.id) = p_user
    else exists(select 1 from public.teammate_order_access a where a.user_id=p_user
      and p_order.game=any(a.enabled_games) and (a.voice_opt_in or not p_order.voice)) end;
$$;

-- From 20261026120000_pro_subscription.sql; changed: booked streaming orders can't be rerolled.
create or replace function public.reroll_order(p_order_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v public.orders; v_now timestamptz;
begin
  if v_actor is null then return public.order_error(401, 'Authentication required.'); end if;
  if not exists (select 1 from public.account_roles as r where r.user_id = v_actor and r.role = 'customer') then return public.order_error(403, 'Customer role required.'); end if;
  select o.* into v from public.orders as o where o.id = p_order_id and o.customer_id = v_actor for update;
  if v.id is null then return public.order_error(404, 'Order not found.'); end if;
  if public.order_expire_locked(v.id) or v.status = 'cancelled' then return public.order_error(410, 'Order expired or cancelled.'); end if;
  if public.order_streamer(v.id) is not null then return public.order_error(409, 'You booked this streamer, so this order can’t be rerolled.'); end if;
  perform public.order_sweep(100);
  v_now := pg_catalog.clock_timestamp();
  if v.status <> 'in_progress' or (v.rerolls >= 2 and not public.is_pro(v_actor)) or v.accepted_at + interval '5 minutes' < v_now then return public.order_error(409, 'Reroll unavailable.'); end if;
  update public.order_assignments set ended_at = v_now, end_reason = 'customer_reroll' where id = v.current_assignment_id;
  update public.orders set status = 'queued', queued_at = v_now, accepted_at = null, assigned_teammate_id = null, current_assignment_id = null, rerolls = rerolls + 1 where id = v.id returning * into v;
  return pg_catalog.jsonb_build_object('order', public.order_customer_dto(v));
end;
$$;

-- ---- admin -----------------------------------------------------------------------------------

-- From 20261024090000_admin_foundation.sql; changed: access.stream (streaming games still approved).
create or replace function public.admin_account_dto(p_user uuid, p_viewer uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select pg_catalog.jsonb_build_object(
    'id', u.id,
    'name', coalesce(p.name, ''),
    'email', coalesce(u.email, ''),
    'image', coalesce(p.image, ''),
    'country', coalesce(p.country, ''),
    'provider', coalesce(u.raw_app_meta_data ->> 'provider', 'email'),
    'role', r.role,
    'owner', r.owner,
    'you', u.id = p_viewer,
    'roleBy', coalesce((select coalesce(nullif(bp.name, 'Player'), bu.email) from auth.users as bu
                        left join public.profiles as bp on bp.id = bu.id where bu.id = r.role_set_by), ''),
    'roleAt', r.role_set_at,
    'firstSeen', u.created_at,
    'lastSeen', u.last_sign_in_at,
    'discord', (select d.username from public.discord_accounts as d where d.user_id = u.id),
    'access', case when a.user_id is null then pg_catalog.jsonb_build_object('games', '[]'::jsonb, 'gg', false, 'suspended', false, 'stream', '[]'::jsonb)
      else pg_catalog.jsonb_build_object('games', pg_catalog.to_jsonb(a.approved_games), 'gg', a.gg_access, 'suspended', a.suspended,
        'stream', pg_catalog.to_jsonb(public.streamer_games(a))) end,
    'busy', exists (select 1 from public.orders as o where o.assigned_teammate_id = u.id and o.status = 'in_progress'))
  from auth.users as u
  join public.account_roles as r on r.user_id = u.id
  left join public.profiles as p on p.id = u.id
  left join public.teammate_order_access as a on a.user_id = u.id
  where u.id = p_user;
$$;

-- Grant or take away streaming per game. Only approved games count; none left switches streaming off.
create function public.admin_set_stream_access(p_user_id uuid, p_games text[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid; v_name text; a public.teammate_order_access; v_games text[]; v_before text[];
begin
  select id, name into v_actor, v_name from public.admin_caller();
  if v_actor is null then return public.order_error(403, 'Admins only.'); end if;
  if not exists (select 1 from public.account_roles where user_id = p_user_id and role = 'teammate') then
    return public.order_error(409, 'Only teammates can stream.');
  end if;
  select * into a from public.teammate_order_access where user_id = p_user_id for update;
  if a.user_id is null then return public.order_error(409, 'Give them game access first.'); end if;
  v_before := public.streamer_games(a);
  select coalesce(pg_catalog.array_agg(x.g order by x.i), '{}'::text[]) into v_games
    from pg_catalog.unnest(array['lol','val','cs2','fn','cod','apex','r6','mr','ow','rl','tft','fc','arc','mc','pu']::text[])
      with ordinality as x(g, i)
   where x.g = any(coalesce(p_games, '{}'::text[])) and x.g = any(a.approved_games);
  update public.teammate_order_access set stream_games = v_games where user_id = p_user_id;
  if pg_catalog.cardinality(v_games) = 0 then
    update public.streamer_settings set stream_online = false, online_since = null, updated_at = pg_catalog.clock_timestamp()
     where user_id = p_user_id and stream_online;
  end if;
  if v_games is distinct from v_before then
    perform public.admin_log(v_actor, v_name, 'Streaming access',
      (select email from auth.users where id = p_user_id),
      case when pg_catalog.cardinality(v_games) = 0 then 'None' else pg_catalog.array_to_string(v_games, ', ') end);
  end if;
  -- same shape as admin_set_access: { access: { stream } }
  return pg_catalog.jsonb_build_object('access', pg_catalog.jsonb_build_object('stream', pg_catalog.to_jsonb(v_games)));
end $;

-- ---- teammate --------------------------------------------------------------------------------

create function public.streamer_desk_dto(p_user uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select pg_catalog.jsonb_build_object(
    'games', pg_catalog.to_jsonb(public.streamer_games(a)),
    'streamOnline', coalesce(s.stream_online, false),
    'live', public.streamer_live(p_user),
    'deskOnline', coalesce(p.online and p.last_seen_at > pg_catalog.clock_timestamp() - interval '20 seconds', false),
    'rateEurCents', s.rate_eur_cents,
    'durations', pg_catalog.to_jsonb(coalesce(s.durations, '{1,2}'::integer[])),
    'twitch', s.twitch,
    'name', public.streamer_first_name(p_user))
  from public.teammate_order_access as a
  left join public.streamer_settings as s on s.user_id = a.user_id
  left join public.teammate_presence as p on p.user_id = a.user_id
  where a.user_id = p_user;
$$;

-- The streaming panel; { streaming: null } when this teammate has no streaming games.
create function public.streamer_desk() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); a public.teammate_order_access;
begin
  if v_actor is null then return public.order_error(401, 'Authentication required.'); end if;
  if not exists (select 1 from public.account_roles where user_id = v_actor and role = 'teammate') then
    return public.order_error(403, 'Teammates only.');
  end if;
  select * into a from public.teammate_order_access where user_id = v_actor;
  if a.user_id is null or pg_catalog.cardinality(public.streamer_games(a)) = 0 then
    return pg_catalog.jsonb_build_object('streaming', null);
  end if;
  return pg_catalog.jsonb_build_object('streaming', public.streamer_desk_dto(v_actor));
end $$;

-- Save rate, durations and Twitch username, and switch streaming on or off.
create function public.streamer_desk_save(p_online boolean, p_rate_eur_cents integer, p_durations integer[], p_twitch text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); a public.teammate_order_access; v_twitch text := nullif(pg_catalog.btrim(coalesce(p_twitch, '')), '');
  v_durations integer[]; v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if v_actor is null then return public.order_error(401, 'Authentication required.'); end if;
  if not exists (select 1 from public.account_roles where user_id = v_actor and role = 'teammate') then
    return public.order_error(403, 'Teammates only.');
  end if;
  select * into a from public.teammate_order_access where user_id = v_actor;
  if a.user_id is null or pg_catalog.cardinality(public.streamer_games(a)) = 0 then
    return public.order_error(403, 'You don’t have streaming access.');
  end if;
  if p_rate_eur_cents is null or p_rate_eur_cents not between 500 and 10000 then
    return public.order_error(400, 'Set an hourly rate between €5 and €100.');
  end if;
  select coalesce(pg_catalog.array_agg(distinct d order by d), '{}'::integer[]) into v_durations
    from pg_catalog.unnest(coalesce(p_durations, '{}'::integer[])) as d where d between 1 and 10;
  if pg_catalog.cardinality(v_durations) = 0 then return public.order_error(400, 'Pick at least one duration.'); end if;
  if v_twitch is not null and v_twitch !~ '^[A-Za-z0-9_]{4,25}$' then
    return public.order_error(400, 'That doesn’t look like a Twitch username.');
  end if;
  if coalesce(p_online, false) and (a.suspended or a.discord_id is null or a.discord_verified_at is null) then
    return public.order_error(409, 'Link Discord first to go online.');
  end if;
  insert into public.streamer_settings(user_id, stream_online, rate_eur_cents, durations, twitch, online_since, updated_at)
    values (v_actor, coalesce(p_online, false), p_rate_eur_cents, v_durations, v_twitch, case when p_online then v_now end, v_now)
  on conflict (user_id) do update set
    stream_online = excluded.stream_online, rate_eur_cents = excluded.rate_eur_cents, durations = excluded.durations,
    twitch = excluded.twitch, updated_at = v_now,
    online_since = case when excluded.stream_online then coalesce(public.streamer_settings.online_since, v_now) end;
  return pg_catalog.jsonb_build_object('streaming', public.streamer_desk_dto(v_actor));
end $$;

-- ---- customers -------------------------------------------------------------------------------

-- Public list of streamers bookable right now. No ids: checkout uses the handle.
create function public.home_streamers() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(pg_catalog.jsonb_agg(q.item order by q.reviews desc, q.since), '[]'::jsonb) from (
    select s.online_since as since,
      (select pg_catalog.count(*)::integer from public.order_reviews as v where v.teammate_id = s.user_id) as reviews,
      pg_catalog.jsonb_build_object(
        'handle', s.handle,
        'name', public.streamer_first_name(s.user_id),
        'image', pr.image,
        'games', pg_catalog.to_jsonb(public.streamer_games(a)),
        'rateEurCents', s.rate_eur_cents,
        'durations', pg_catalog.to_jsonb(s.durations),
        'twitch', s.twitch,
        'rating', (select pg_catalog.round(pg_catalog.avg(v.rating)::numeric, 1) from public.order_reviews as v where v.teammate_id = s.user_id),
        'reviews', (select pg_catalog.count(*)::integer from public.order_reviews as v where v.teammate_id = s.user_id)) as item
      from public.streamer_settings as s
      join public.teammate_order_access as a on a.user_id = s.user_id
      join public.profiles as pr on pr.id = s.user_id
     where s.stream_online and public.streamer_live(s.user_id) and public.streamer_first_name(s.user_id) is not null
     limit 50) as q;
$$;

-- Server only (checkout): the live streamer behind a handle, for this game and length.
create function public.streamer_checkout_quote(p_handle uuid, p_game text, p_hours integer) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare s public.streamer_settings; a public.teammate_order_access;
begin
  select * into s from public.streamer_settings where handle = p_handle;
  if s.user_id is null or not public.streamer_live(s.user_id) then
    return public.order_error(409, 'That streamer just went offline.');
  end if;
  select * into a from public.teammate_order_access where user_id = s.user_id;
  if not (p_game = any(public.streamer_games(a))) then return public.order_error(400, 'That streamer doesn’t stream this game.'); end if;
  if not (p_hours = any(s.durations)) then return public.order_error(400, 'That streamer doesn’t offer this length.'); end if;
  return pg_catalog.jsonb_build_object('streamerId', s.user_id, 'name', public.streamer_first_name(s.user_id),
    'rateEurCents', s.rate_eur_cents);
end $$;

-- ---- grants ----------------------------------------------------------------------------------

revoke all on function public.streamer_games(public.teammate_order_access), public.streamer_first_name(uuid),
  public.streamer_live(uuid), public.order_streamer(uuid), public.checkout_intent_streamer_booking(),
  public.streamer_desk_dto(uuid), public.admin_set_stream_access(uuid,text[]), public.streamer_desk(),
  public.streamer_desk_save(boolean,integer,integer[],text), public.home_streamers(),
  public.streamer_checkout_quote(uuid,text,integer)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_set_stream_access(uuid,text[]), public.streamer_desk(),
  public.streamer_desk_save(boolean,integer,integer[],text) to authenticated;
grant execute on function public.home_streamers() to anon, authenticated;
grant execute on function public.streamer_checkout_quote(uuid,text,integer) to service_role;

commit;
