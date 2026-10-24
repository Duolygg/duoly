-- Priority admin screen (ledger #16): hand-set base priority, buff/nerf adjustments with
-- reason and expiry, automatic missed-order penalties and forgiveness (original lib/priority.js,
-- lib/penalty.js, lib/prioTiers.js and the noteIgnored part of lib/orders.js).
-- Teammates never see any of it; only teammates appear on the admin screen.
-- The delay itself was scaffolded in 20261022093000_order_foundation.sql (order_eligible reads
-- priority_base and priority_adjustment). create or replace below starts from those exact
-- definitions on origin/main and adds the missed-order penalty.
begin;

alter table public.teammate_order_access
  add column priority_base_set_at timestamptz,
  add column priority_base_set_by text not null default '' check (pg_catalog.char_length(priority_base_set_by) <= 120),
  add column priority_adjustment_reason text not null default '' check (pg_catalog.char_length(priority_adjustment_reason) <= 140),
  add column priority_adjustment_set_by text not null default '' check (pg_catalog.char_length(priority_adjustment_set_by) <= 120),
  add column priority_adjustment_set_at timestamptz,
  add column priority_forgiven_at timestamptz;

-- One row per order a teammate let time out while it sat in their queue for 60+ seconds.
create table public.order_misses (
  order_id uuid not null references public.orders(id) on delete cascade,
  teammate_id uuid not null references auth.users(id) on delete cascade,
  seen_sec integer not null check (seen_sec >= 60),
  missed_at timestamptz not null default pg_catalog.clock_timestamp(),
  primary key (order_id, teammate_id)
);
create index order_misses_teammate_window on public.order_misses(teammate_id, missed_at desc);
alter table public.order_misses enable row level security;
revoke all on table public.order_misses from public, anon, authenticated, service_role;

-- 10 seconds per missed order, capped at 50, counting the last 7 days after the last forgiveness.
create function public.priority_penalty(p_user uuid, p_now timestamptz) returns integer
language sql stable security invoker set search_path = '' as $$
  select least(50, 10 * count(*)::integer)
    from public.order_misses as m
    join public.teammate_order_access as a on a.user_id = m.teammate_id
   where m.teammate_id = p_user
     and m.missed_at > greatest(p_now - interval '7 days', coalesce(a.priority_forgiven_at, '-infinity'::timestamptz));
$$;
revoke all on function public.priority_penalty(uuid,timestamptz) from public, anon, authenticated, service_role;

-- Effective priority = clamp(0..100, base - active adjustment + missed-order penalty).
create or replace function public.order_eligible(p_order public.orders, p_actor uuid) returns boolean
language sql volatile security invoker set search_path = '' as $$
  select exists (select 1 from public.account_roles as r
    join public.teammate_order_access as a on a.user_id = r.user_id
    where r.user_id = p_actor and r.role = 'teammate' and not a.suspended
      and a.discord_id is not null and a.discord_verified_at is not null
      and p_order.customer_id <> p_actor
      and ((a.gg_access and p_order.gg) or (not a.gg_access and not p_order.gg and p_order.game = any(a.approved_games)))
      and p_order.queued_at + pg_catalog.make_interval(secs => greatest(0, least(100,
        a.priority_base - case when a.priority_adjustment_expires_at is null or a.priority_adjustment_expires_at > pg_catalog.clock_timestamp()
          then a.priority_adjustment else 0 end
        + public.priority_penalty(p_actor, pg_catalog.clock_timestamp())))) <= pg_catalog.clock_timestamp()
      and not exists (select 1 from public.order_assignments as h where h.order_id = p_order.id and h.teammate_id = p_actor and h.end_reason = 'customer_reroll'));
$$;
revoke all on function public.order_eligible(public.orders,uuid) from public, anon, authenticated, service_role;

-- When an order times out, everyone who was online and could have taken it gets a miss, if it
-- sat in their queue for at least 60 seconds (original noteIgnored): not counted are teammates
-- busy in another order, re-rolled off this one, offline, or online only at the very end.
create or replace function public.order_expire_locked(p_id uuid) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare v public.orders; v_now timestamptz := pg_catalog.clock_timestamp();
begin
  select o.* into v from public.orders as o where o.id = p_id for update;
  if v.status = 'queued' and v.queued_at + interval '5 minutes' <= v_now then
    update public.orders set status = 'cancelled', cancelled_at = v_now, cancel_reason = 'queue_expired' where id = v.id;
    insert into public.order_misses(order_id, teammate_id, seen_sec, missed_at)
      select v.id, c.user_id, pg_catalog.floor(extract(epoch from v_now - c.shown_at))::integer, v_now
      from (
        select a.user_id,
               greatest(
                 v.queued_at + pg_catalog.make_interval(secs => greatest(0, least(100,
                   a.priority_base
                   - case when a.priority_adjustment_expires_at is null or a.priority_adjustment_expires_at > v_now
                     then a.priority_adjustment else 0 end
                   + public.priority_penalty(a.user_id, v_now)))),
                 pr.online_since) as shown_at
          from public.account_roles as r
          join public.teammate_order_access as a on a.user_id = r.user_id
          join public.teammate_presence as pr on pr.user_id = r.user_id
         where r.role = 'teammate' and not a.suspended
           and a.discord_id is not null and a.discord_verified_at is not null
           and v.customer_id <> r.user_id
           and ((a.gg_access and v.gg) or (not a.gg_access and not v.gg and v.game = any(a.approved_games)))
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
$$;
revoke all on function public.order_expire_locked(uuid) from public, anon, authenticated, service_role;

-- ---- admin screen ----------------------------------------------------------------------------

-- One account row for the Priority screen. Tier id comes from the points (they are unique).
create function public.admin_priority_dto(p_user uuid, p_now timestamptz) returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare
  v_a public.teammate_order_access;
  v_name text; v_email text; v_image text;
  v_adj jsonb; v_penalty integer; v_missed integer; v_misses jsonb; v_effective integer; v_online boolean;
begin
  select a.* into v_a from public.teammate_order_access as a where a.user_id = p_user;
  select coalesce(nullif(p.name, 'Player'), ''), coalesce(p.image, ''), coalesce(u.email, '')
    into v_name, v_image, v_email
    from auth.users as u left join public.profiles as p on p.id = u.id where u.id = p_user;
  v_penalty := public.priority_penalty(p_user, p_now);
  v_effective := greatest(0, least(100, v_a.priority_base
    - case when v_a.priority_adjustment_expires_at is null or v_a.priority_adjustment_expires_at > p_now
      then v_a.priority_adjustment else 0 end
    + v_penalty));
  if v_a.priority_adjustment <> 0 and (v_a.priority_adjustment_expires_at is null or v_a.priority_adjustment_expires_at > p_now) then
    v_adj := pg_catalog.jsonb_build_object('points', v_a.priority_adjustment, 'reason', v_a.priority_adjustment_reason,
      'by', v_a.priority_adjustment_set_by, 'at', v_a.priority_adjustment_set_at, 'until', v_a.priority_adjustment_expires_at);
  end if;
  select count(*) into v_missed from public.order_misses as m
   where m.teammate_id = p_user
     and m.missed_at > greatest(p_now - interval '7 days', coalesce(v_a.priority_forgiven_at, '-infinity'::timestamptz));
  select coalesce(pg_catalog.jsonb_agg(x.ref), '[]'::jsonb) into v_misses from (
    select pg_catalog.jsonb_build_object('id', o.public_reference, 'at', m.missed_at) as ref
      from public.order_misses as m join public.orders as o on o.id = m.order_id
     where m.teammate_id = p_user
       and m.missed_at > greatest(p_now - interval '7 days', coalesce(v_a.priority_forgiven_at, '-infinity'::timestamptz))
     order by m.missed_at desc limit 10) as x;
  select coalesce(pr.online and pr.last_seen_at > p_now - interval '20 seconds', false) into v_online
    from public.teammate_presence as pr where pr.user_id = p_user;
  return pg_catalog.jsonb_build_object(
    'id', p_user, 'name', v_name, 'email', v_email, 'image', v_image, 'online', coalesce(v_online, false),
    'prio', v_a.priority_base, 'custom', v_a.priority_base_set_at is not null,
    'changedBy', case when v_a.priority_base_set_at is not null then v_a.priority_base_set_by else '' end,
    'changedAt', v_a.priority_base_set_at,
    'adj', v_adj, 'penalty', v_penalty, 'misses', v_misses, 'missed', v_missed, 'effective', v_effective);
end;
$$;
revoke all on function public.admin_priority_dto(uuid,timestamptz) from public, anon, authenticated, service_role;

-- Teammates only, never admins; each with the full breakdown (original GET /api/admin/priority).
create function public.admin_priority() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if not exists(select 1 from public.admin_caller()) then return public.order_error(403,'Admins only.'); end if;
  return pg_catalog.jsonb_build_object(
    'now', v_now, 'default', 50,
    'rules', pg_catalog.jsonb_build_object('perMiss', 10, 'cap', 50, 'days', 7),
    'accounts', coalesce((
      select pg_catalog.jsonb_agg(public.admin_priority_dto(r.user_id, v_now))
        from public.account_roles as r
        join public.teammate_order_access as a on a.user_id = r.user_id
       where r.role = 'teammate'), '[]'::jsonb));
end;
$$;

-- Every command answers { account: <the new breakdown> } like the original POST.
create function public.admin_priority_target(p_user uuid) returns text
language plpgsql stable security invoker set search_path = '' as $$
declare v_target text;
begin
  select coalesce(nullif(p.name, 'Player'), u.email, 'Teammate') into v_target
    from public.account_roles as r
    join public.teammate_order_access as a on a.user_id = r.user_id
    join auth.users as u on u.id = r.user_id
    left join public.profiles as p on p.id = r.user_id
   where r.user_id = p_user and r.role = 'teammate';
  return v_target;
end;
$$;
revoke all on function public.admin_priority_target(uuid) from public, anon, authenticated, service_role;

create function public.admin_set_priority(p_user uuid, p_base integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid; v_name text; v_target text; v_old integer; v_now timestamptz := pg_catalog.clock_timestamp();
begin
  select id, name into v_actor, v_name from public.admin_caller();
  if v_actor is null then return public.order_error(403, 'Admins only.'); end if;
  if p_base is null or p_base < 0 or p_base > 100 then return public.order_error(400, 'Priority must be a number from 0 to 100.'); end if;
  v_target := public.admin_priority_target(p_user);
  if v_target is null then return public.order_error(404, 'Account not found.'); end if;
  select priority_base into v_old from public.teammate_order_access where user_id = p_user;
  update public.teammate_order_access
     set priority_base = p_base, priority_base_set_at = v_now, priority_base_set_by = v_name
   where user_id = p_user;
  perform public.admin_log(v_actor, v_name, 'Changed base priority', v_target, v_old || ' s → ' || p_base || ' s');
  return pg_catalog.jsonb_build_object('account', public.admin_priority_dto(p_user, v_now));
end;
$$;

create function public.admin_reset_priority(p_user uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid; v_name text; v_target text; v_old integer; v_now timestamptz := pg_catalog.clock_timestamp();
begin
  select id, name into v_actor, v_name from public.admin_caller();
  if v_actor is null then return public.order_error(403, 'Admins only.'); end if;
  v_target := public.admin_priority_target(p_user);
  if v_target is null then return public.order_error(404, 'Account not found.'); end if;
  select priority_base into v_old from public.teammate_order_access where user_id = p_user;
  update public.teammate_order_access
     set priority_base = 50, priority_base_set_at = null, priority_base_set_by = ''
   where user_id = p_user;
  perform public.admin_log(v_actor, v_name, 'Reset base priority', v_target, v_old || ' s → 50 s');
  return pg_catalog.jsonb_build_object('account', public.admin_priority_dto(p_user, v_now));
end;
$$;

-- Buff/nerf tier on top of the base. p_duration: 1d (24 hours), 7d or perm (until removed).
create function public.admin_adjust_priority(p_user uuid, p_points integer, p_duration text, p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid; v_name text; v_target text; v_now timestamptz := pg_catalog.clock_timestamp();
  v_until timestamptz; v_reason text; v_tier text; v_dur text;
begin
  select id, name into v_actor, v_name from public.admin_caller();
  if v_actor is null then return public.order_error(403, 'Admins only.'); end if;
  if p_points is null or p_points not in (10, 20, 35, -10, -20, -35)
     or p_duration is null or p_duration not in ('1d', '7d', 'perm') then
    return public.order_error(400, 'Pick a tier and how long it lasts.');
  end if;
  v_target := public.admin_priority_target(p_user);
  if v_target is null then return public.order_error(404, 'Account not found.'); end if;
  v_until := case p_duration when '1d' then v_now + interval '24 hours' when '7d' then v_now + interval '7 days' else null end;
  v_reason := pg_catalog.left(pg_catalog.btrim(pg_catalog.regexp_replace(coalesce(p_reason, ''), '[[:cntrl:]]', ' ', 'g')), 140);
  v_tier := case p_points when 10 then 'Small adjustment' when 20 then 'Buff' when 35 then 'Big buff'
            when -10 then 'Prio nerf' when -20 then 'Big nerf' else 'Heavy nerf' end;
  v_dur := case p_duration when '1d' then '24 hours' when '7d' then '7 days' else 'Until removed' end;
  update public.teammate_order_access
     set priority_adjustment = p_points, priority_adjustment_expires_at = v_until,
         priority_adjustment_reason = v_reason, priority_adjustment_set_by = v_name, priority_adjustment_set_at = v_now
   where user_id = p_user;
  perform public.admin_log(v_actor, v_name, case when p_points > 0 then 'Buffed priority' else 'Nerfed priority' end,
    v_target, (case when p_points > 0 then '+' else '−' end) || abs(p_points) || ' ' || v_tier || ' · ' || v_dur || case when v_reason <> '' then ' · ' || v_reason else '' end);
  return pg_catalog.jsonb_build_object('account', public.admin_priority_dto(p_user, v_now));
end;
$$;

create function public.admin_clear_adjustment(p_user uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid; v_name text; v_target text; v_now timestamptz := pg_catalog.clock_timestamp();
  v_points integer; v_tier text;
begin
  select id, name into v_actor, v_name from public.admin_caller();
  if v_actor is null then return public.order_error(403, 'Admins only.'); end if;
  v_target := public.admin_priority_target(p_user);
  if v_target is null then return public.order_error(404, 'Account not found.'); end if;
  select priority_adjustment into v_points from public.teammate_order_access where user_id = p_user;
  update public.teammate_order_access
     set priority_adjustment = 0, priority_adjustment_expires_at = null,
         priority_adjustment_reason = '', priority_adjustment_set_by = '', priority_adjustment_set_at = null
   where user_id = p_user;
  if coalesce(v_points, 0) <> 0 then
    v_tier := case v_points when 10 then 'Small adjustment' when 20 then 'Buff' when 35 then 'Big buff'
              when -10 then 'Prio nerf' when -20 then 'Big nerf' else 'Heavy nerf' end;
    perform public.admin_log(v_actor, v_name, 'Removed buff/nerf', v_target,
      (case when v_points > 0 then '+' else '−' end) || abs(v_points) || ' ' || v_tier);
  end if;
  return pg_catalog.jsonb_build_object('account', public.admin_priority_dto(p_user, v_now));
end;
$$;

-- Clear a teammate's missed orders: only misses after this moment count again.
create function public.admin_forgive_misses(p_user uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid; v_name text; v_target text; v_now timestamptz := pg_catalog.clock_timestamp();
  v_missed integer; v_penalty integer;
begin
  select id, name into v_actor, v_name from public.admin_caller();
  if v_actor is null then return public.order_error(403, 'Admins only.'); end if;
  v_target := public.admin_priority_target(p_user);
  if v_target is null then return public.order_error(404, 'Account not found.'); end if;
  v_penalty := public.priority_penalty(p_user, v_now);
  select count(*) into v_missed from public.order_misses as m
    join public.teammate_order_access as a on a.user_id = m.teammate_id
   where m.teammate_id = p_user
     and m.missed_at > greatest(v_now - interval '7 days', coalesce(a.priority_forgiven_at, '-infinity'::timestamptz));
  update public.teammate_order_access set priority_forgiven_at = v_now where user_id = p_user;
  perform public.admin_log(v_actor, v_name, 'Forgave missed orders', v_target, v_missed || ' missed · ' || v_penalty || ' s');
  return pg_catalog.jsonb_build_object('account', public.admin_priority_dto(p_user, v_now));
end;
$$;

revoke all on function public.admin_priority(), public.admin_set_priority(uuid,integer),
  public.admin_reset_priority(uuid), public.admin_adjust_priority(uuid,integer,text,text),
  public.admin_clear_adjustment(uuid), public.admin_forgive_misses(uuid) from public, anon, authenticated, service_role;
grant execute on function public.admin_priority(), public.admin_set_priority(uuid,integer),
  public.admin_reset_priority(uuid), public.admin_adjust_priority(uuid,integer,text,text),
  public.admin_clear_adjustment(uuid), public.admin_forgive_misses(uuid) to authenticated;

commit;
