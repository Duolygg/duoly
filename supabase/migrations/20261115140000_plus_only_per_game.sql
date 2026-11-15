-- Plus only, per game (docs/product/duo-tiers.md). Before, "Plus only" was one level per teammate
-- (teammate_order_access.duo_level, 20261030140000) and held in every game they were approved for.
-- A teammate hired with a lower rank in one game can be top rank in another, so the admin now picks
-- the games: plus_only_games. In those games they take Duo Plus only (never Pro, Apex or any other
-- non Gamer Girl service); in their other approved games they are Standard.
--
-- Everyone who was Plus only stays Plus only in every game they are approved for today, so nothing
-- changes for them until an admin edits their access. duo_level is dropped: the list is the one
-- source of truth. admin_set_duo_level is replaced by admin_set_plus_only_games.
begin;

alter table public.teammate_order_access
  add column plus_only_games text[] not null default '{}'::text[]
  constraint teammate_order_access_plus_only_games_check
  check (plus_only_games <@ array['lol','val','cs2','fn','cod','apex','r6','mr','ow','dota','rl','wow','pubg','tft','fc','arc','wr','mc','dl','pu']::text[]
    and pg_catalog.array_position(plus_only_games, null::text) is null);

update public.teammate_order_access set plus_only_games = approved_games where duo_level = 'plus_only';

-- From 20261106150000_customer_favorites.sql; changed: Plus only is checked for the order's game.
create or replace function public.order_tier_open_at(p_order public.orders, p_access public.teammate_order_access)
returns timestamptz
language plpgsql stable security invoker set search_path = '' as $$
declare v_tier text := public.duo_tier(p_order.service); v_streamer uuid := public.order_streamer(p_order.id);
begin
  if v_streamer is not null then
    return case when v_streamer = p_access.user_id then p_order.queued_at end;
  end if;
  if p_order.gg then return p_order.queued_at; end if;
  if p_order.game = any(p_access.plus_only_games) then
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

-- ---- admin ----------------------------------------------------------------------------------------

drop function public.admin_set_duo_level(uuid, text);
drop function public.admin_duo_levels();

-- { plusOnly: { <teammate id>: [games] } } for every teammate, games in canonical order.
create function public.admin_duo_levels() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.admin_caller_for('users')) then return public.order_error(403, 'Admins only.'); end if;
  return pg_catalog.jsonb_build_object('plusOnly', coalesce((
    select pg_catalog.jsonb_object_agg(a.user_id, pg_catalog.to_jsonb(a.plus_only_games))
      from public.teammate_order_access a
      join public.account_roles r on r.user_id = a.user_id and r.role = 'teammate'), '{}'::jsonb));
end;
$$;

-- Canonical order, unknown ids dropped, and only games they are approved for (like streaming).
create function public.admin_set_plus_only_games(p_user uuid, p_games text[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid; v_name text; a public.teammate_order_access; v_games text[]; v_label text;
begin
  select id, name into v_actor, v_name from public.admin_caller_for('users');
  if v_actor is null then return public.order_error(403, 'Admins only.'); end if;
  if not exists (select 1 from public.account_roles where user_id = p_user and role = 'teammate') then
    return public.order_error(409, 'Only teammates have a level. Make them a teammate first.');
  end if;
  select * into a from public.teammate_order_access where user_id = p_user for update;
  if a.user_id is null then return public.order_error(409, 'Give them game access first.'); end if;
  select coalesce(pg_catalog.array_agg(x.g order by x.i), '{}'::text[]) into v_games
    from pg_catalog.unnest(array['lol','val','cs2','fn','cod','apex','r6','mr','ow','dota','rl','wow','pubg','tft','fc','arc','wr','mc','dl','pu']::text[])
      with ordinality as x(g, i)
   where x.g = any(coalesce(p_games, '{}'::text[])) and x.g = any(a.approved_games);
  update public.teammate_order_access set plus_only_games = v_games where user_id = p_user;
  if v_games is distinct from a.plus_only_games then
    select coalesce(nullif(p.name, 'Player'), u.email, '') into v_label
      from auth.users as u left join public.profiles as p on p.id = u.id where u.id = p_user;
    perform public.admin_log(v_actor, v_name, 'Changed teammate level', v_label,
      case when pg_catalog.cardinality(v_games) = 0 then 'Standard in every game'
           else 'Plus only in ' || pg_catalog.array_to_string(v_games, ', ') end);
  end if;
  return pg_catalog.jsonb_build_object('userId', p_user, 'plusOnly', pg_catalog.to_jsonb(v_games));
end;
$$;

alter table public.teammate_order_access drop column duo_level;

revoke all on function public.admin_duo_levels(), public.admin_set_plus_only_games(uuid, text[])
  from public, anon, authenticated, service_role;
grant execute on function public.admin_duo_levels(), public.admin_set_plus_only_games(uuid, text[]) to authenticated;

commit;
