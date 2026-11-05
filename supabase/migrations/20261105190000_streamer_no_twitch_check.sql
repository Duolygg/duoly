-- Twitch streaming: stop asking Twitch whether the channel is live (docs/product/twitch-streaming.md).
--
-- 20261105150000_streamer_twitch_live.sql listed a streamer only while the server had confirmed with
-- Twitch (Helix, needs a Twitch developer app) that their channel was live in the last 90 seconds.
-- Now a streamer is listed as soon as they go online for streaming; streamers who go online without
-- being live are handled by admins (suspension). The Twitch username stays required to go online and
-- is still shown as a link on their card. The €9.99 minimum rate is unchanged.
-- From 20261105150000_streamer_twitch_live.sql: streamer_ready, streamer_desk_dto, streamer_desk_save.
-- Deploy order: the code first (it no longer calls streamer_twitch_seen), then this migration.
begin;

-- From 20261105150000_streamer_twitch_live.sql; changed: no Twitch live confirmation.
create or replace function public.streamer_ready(p_user uuid) returns boolean
language sql stable security invoker set search_path = '' as $$
  select exists (
    select 1 from public.streamer_settings as s
      join public.account_roles as r on r.user_id = s.user_id and r.role = 'teammate'
      join public.teammate_order_access as a on a.user_id = s.user_id
      join public.teammate_presence as p on p.user_id = s.user_id
     where s.user_id = p_user and s.stream_online and s.rate_eur_cents is not null
       and s.twitch is not null
       and pg_catalog.cardinality(public.streamer_games(a)) > 0
       and not a.suspended and a.discord_id is not null and a.discord_verified_at is not null
       and p.online and p.last_seen_at > pg_catalog.clock_timestamp() - interval '20 seconds');
$$;

-- From 20261105150000_streamer_twitch_live.sql; changed: no twitchLive; busy (streamer_busy), so the
-- panel only says "hidden while you're booked" when that is the reason.
create or replace function public.streamer_desk_dto(p_user uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select pg_catalog.jsonb_build_object(
    'games', pg_catalog.to_jsonb(public.streamer_games(a)),
    'streamOnline', coalesce(s.stream_online, false),
    'live', public.streamer_live(p_user),
    'busy', public.streamer_busy(p_user, null),
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

-- From 20261105150000_streamer_twitch_live.sql; changed: no live confirmation to clear.
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
    online_since = case when excluded.stream_online then coalesce(public.streamer_settings.online_since, v_now) end;
  return pg_catalog.jsonb_build_object('streaming', public.streamer_desk_dto(v_actor));
end $$;

drop function public.streamer_twitch_seen(uuid, text, boolean);
alter table public.streamer_settings drop column twitch_live_at;

commit;
