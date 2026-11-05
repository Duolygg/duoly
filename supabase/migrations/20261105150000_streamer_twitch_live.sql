-- Twitch streaming: the Twitch username is required and proves the streamer is live
-- (docs/product/twitch-streaming.md).
--
-- A streamer could go online for streaming without a Twitch username, and nothing checked that they
-- were actually streaming. Now:
--   * going online needs a Twitch username (streamer_desk_save, and a table check)
--   * the server asks Twitch (Helix "Get Streams") whether that channel is live and records the answer
--     with streamer_twitch_seen (server only). streamer_ready needs a confirmation from the last
--     90 seconds, so a streamer who ends their Twitch stream drops off the list and checkout on their own.
--   * changing the username clears the confirmation; the new channel has to be checked again.
--   * the hourly rate is at least €9.99 (was €5). Saved rates below it are cleared and those
--     streamers switched off; they set a new rate. Past bookings and intents keep their own bounds.
-- Streaming stays switched on while their Twitch stream is off; they are listed again once it is live.
-- From 20261105100000_twitch_streaming.sql: streamer_desk_dto, streamer_desk_save.
-- From 20261105110000_streamer_one_booking.sql: streamer_ready.
-- Deploy order: this migration first, then the code (the code calls streamer_twitch_seen).
begin;

alter table public.streamer_settings add column twitch_live_at timestamptz;

-- Hourly rate: €9.99 to €100.
update public.streamer_settings set rate_eur_cents = null, stream_online = false, online_since = null,
       updated_at = pg_catalog.clock_timestamp()
 where rate_eur_cents < 999;
alter table public.streamer_settings drop constraint streamer_settings_rate_eur_cents_check,
  add constraint streamer_settings_rate_eur_cents_check check (rate_eur_cents between 999 and 10000);

-- Nobody is online without a Twitch username.
update public.streamer_settings set stream_online = false, online_since = null, updated_at = pg_catalog.clock_timestamp()
 where stream_online and twitch is null;
alter table public.streamer_settings
  add constraint streamer_settings_online_twitch check (not stream_online or twitch is not null);

-- From 20261105110000_streamer_one_booking.sql; changed: Twitch confirmed the channel is live (90 s).
create or replace function public.streamer_ready(p_user uuid) returns boolean
language sql stable security invoker set search_path = '' as $$
  select exists (
    select 1 from public.streamer_settings as s
      join public.account_roles as r on r.user_id = s.user_id and r.role = 'teammate'
      join public.teammate_order_access as a on a.user_id = s.user_id
      join public.teammate_presence as p on p.user_id = s.user_id
     where s.user_id = p_user and s.stream_online and s.rate_eur_cents is not null
       and s.twitch is not null and s.twitch_live_at > pg_catalog.clock_timestamp() - interval '90 seconds'
       and pg_catalog.cardinality(public.streamer_games(a)) > 0
       and not a.suspended and a.discord_id is not null and a.discord_verified_at is not null
       and p.online and p.last_seen_at > pg_catalog.clock_timestamp() - interval '20 seconds');
$$;

-- Server only: what Twitch said about this streamer's channel. Ignored when the username changed since.
create function public.streamer_twitch_seen(p_user uuid, p_twitch text, p_live boolean) returns void
language sql security definer set search_path = '' as $$
  update public.streamer_settings
     set twitch_live_at = case when p_live then pg_catalog.clock_timestamp() end
   where user_id = p_user and pg_catalog.lower(twitch) = pg_catalog.lower(p_twitch);
$$;

-- From 20261105100000_twitch_streaming.sql; changed: twitchLive.
create or replace function public.streamer_desk_dto(p_user uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select pg_catalog.jsonb_build_object(
    'games', pg_catalog.to_jsonb(public.streamer_games(a)),
    'streamOnline', coalesce(s.stream_online, false),
    'live', public.streamer_live(p_user),
    'deskOnline', coalesce(p.online and p.last_seen_at > pg_catalog.clock_timestamp() - interval '20 seconds', false),
    'twitchLive', coalesce(s.twitch_live_at > pg_catalog.clock_timestamp() - interval '90 seconds', false),
    'rateEurCents', s.rate_eur_cents,
    'durations', pg_catalog.to_jsonb(coalesce(s.durations, '{1,2}'::integer[])),
    'twitch', s.twitch,
    'name', public.streamer_first_name(p_user))
  from public.teammate_order_access as a
  left join public.streamer_settings as s on s.user_id = a.user_id
  left join public.teammate_presence as p on p.user_id = a.user_id
  where a.user_id = p_user;
$$;

-- From 20261105100000_twitch_streaming.sql; changed: going online needs a Twitch username, and a new
-- username clears the live confirmation, and the rate starts at €9.99.
create or replace function public.streamer_desk_save(p_online boolean, p_rate_eur_cents integer, p_durations integer[], p_twitch text)
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
  if p_rate_eur_cents is null or p_rate_eur_cents not between 999 and 10000 then
    return public.order_error(400, 'Set an hourly rate between €9.99 and €100.');
  end if;
  select coalesce(pg_catalog.array_agg(distinct d order by d), '{}'::integer[]) into v_durations
    from pg_catalog.unnest(coalesce(p_durations, '{}'::integer[])) as d where d between 1 and 10;
  if pg_catalog.cardinality(v_durations) = 0 then return public.order_error(400, 'Pick at least one duration.'); end if;
  if v_twitch is not null and v_twitch !~ '^[A-Za-z0-9_]{4,25}$' then
    return public.order_error(400, 'That doesn’t look like a Twitch username.');
  end if;
  if coalesce(p_online, false) and v_twitch is null then
    return public.order_error(400, 'Add your Twitch username to go online.');
  end if;
  if coalesce(p_online, false) and (a.suspended or a.discord_id is null or a.discord_verified_at is null) then
    return public.order_error(409, 'Link Discord first to go online.');
  end if;
  insert into public.streamer_settings(user_id, stream_online, rate_eur_cents, durations, twitch, online_since, updated_at)
    values (v_actor, coalesce(p_online, false), p_rate_eur_cents, v_durations, v_twitch, case when p_online then v_now end, v_now)
  on conflict (user_id) do update set
    stream_online = excluded.stream_online, rate_eur_cents = excluded.rate_eur_cents, durations = excluded.durations,
    twitch = excluded.twitch, updated_at = v_now,
    twitch_live_at = case when pg_catalog.lower(public.streamer_settings.twitch) = pg_catalog.lower(excluded.twitch)
                          then public.streamer_settings.twitch_live_at end,
    online_since = case when excluded.stream_online then coalesce(public.streamer_settings.online_since, v_now) end;
  return pg_catalog.jsonb_build_object('streaming', public.streamer_desk_dto(v_actor));
end $$;

revoke all on function public.streamer_twitch_seen(uuid, text, boolean) from public, anon, authenticated, service_role;
grant execute on function public.streamer_twitch_seen(uuid, text, boolean) to service_role;

commit;
