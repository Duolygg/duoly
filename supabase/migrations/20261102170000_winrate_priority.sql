-- Winrate in the performance ranking (owner request 2026-11-02).
--
-- The match-report winrate (20261102160000) becomes a fourth factor in the performance score, and
-- the biggest one: winrate 40%, retention 25%, satisfaction 20%, completed orders 15% (editable in
-- Admin, Performance). The score decides the bracket, and TOP 1% and TOP 5% open Duo Apex orders
-- first (order_tier_open_at), so a better winrate means better orders sooner.
--
--  · Winrate score = games won out of games reported (0 to 100), from match reports on orders the
--    teammate completed in the ranking window.
--  · It counts from 20 reported games (min_wl_games), so a lucky 3-0 doesn't read as 100%.
--  · Below that, or with no win/loss orders at all (Gamer Girl, Social, coaching), the winrate is left
--    out and the other three weights scale up to 100%.
--
-- performance_recalculate, teammate_performance and admin_performance are the
-- 20261030120000_performance_ranking.sql versions with the winrate added; admin_set_performance_settings
-- takes the fourth weight and the minimum (its old signature is dropped). Deploy the code first: the
-- performance contracts accept the new keys being there or missing. Needs 20261102160000_win_loss.sql.
begin;

alter table public.performance_settings
  drop constraint performance_weights_total,
  add column w_winrate smallint not null default 0 check (w_winrate between 0 and 100),
  add column min_wl_games smallint not null default 20 check (min_wl_games between 1 and 1000);
update public.performance_settings
   set w_retention = 25, w_satisfaction = 20, w_orders = 15, w_winrate = 40,
       updated_at = pg_catalog.clock_timestamp(), updated_by = 'Winrate update'
 where id;
alter table public.performance_settings
  add constraint performance_weights_total check (w_retention + w_satisfaction + w_orders + w_winrate = 100);

alter table public.performance_scores
  add column wl_wins integer not null default 0,
  add column wl_losses integer not null default 0,
  add column winrate_score numeric(5,2);

create or replace function public.performance_recalculate(p_trigger text, p_actor_name text default '')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_set public.performance_settings;
  v_run bigint;
  v_since timestamptz;
  v_total integer;
  v_eligible integer;
begin
  if p_trigger is null or p_trigger not in ('cron','manual') then
    return public.order_error(400, 'Unknown trigger.');
  end if;
  -- One recalculation at a time; a second caller waits and then runs on fresh data.
  perform pg_catalog.pg_advisory_xact_lock(7240531);
  select * into v_set from public.performance_settings where id;
  v_since := pg_catalog.clock_timestamp() - pg_catalog.make_interval(days => v_set.window_days);
  insert into public.performance_runs(trigger, actor_name, settings)
    values (p_trigger, pg_catalog.left(coalesce(p_actor_name, ''), 60),
      pg_catalog.to_jsonb(v_set) - 'id' - 'updated_at' - 'updated_by')
    returning id into v_run;

  with mates as (
    select r.user_id as t
      from public.account_roles as r
      join public.teammate_order_access as a on a.user_id = r.user_id
     where r.role = 'teammate' and not a.suspended
  ),
  done as (
    select o.assigned_teammate_id as t, o.customer_id as c
      from public.orders as o
     where o.status = 'completed' and o.completed_at >= v_since
       and o.assigned_teammate_id in (select t from mates)
  ),
  per_customer as (
    select d.t, d.c, pg_catalog.count(*) as n from done as d group by d.t, d.c
  ),
  agg as (
    select m.t,
      (select pg_catalog.count(*) from done as d where d.t = m.t)::integer as orders,
      (select pg_catalog.count(*) from per_customer as p where p.t = m.t)::integer as customers,
      (select pg_catalog.count(*) from per_customer as p where p.t = m.t and p.n >= 2)::integer as returning,
      (select pg_catalog.count(*) from public.order_reviews as v
        where v.teammate_id = m.t and v.created_at >= v_since)::integer as reviews,
      (select pg_catalog.avg(v.rating) from public.order_reviews as v
        where v.teammate_id = m.t and v.created_at >= v_since) as avg_rating,
      -- games from match reports on win/loss orders they completed in the window (20261102160000)
      (select coalesce(pg_catalog.sum(r.wins), 0) from public.order_match_reports as r
         join public.order_assignments as x on x.id = r.assignment_id and x.end_reason = 'completed'
        where r.teammate_id = m.t and x.ended_at >= v_since)::integer as wl_wins,
      (select coalesce(pg_catalog.sum(r.losses), 0) from public.order_match_reports as r
         join public.order_assignments as x on x.id = r.assignment_id and x.end_reason = 'completed'
        where r.teammate_id = m.t and x.ended_at >= v_since)::integer as wl_losses
    from mates as m
  ),
  judged as (
    select a.*,
      case when a.customers > 0 then a.returning::numeric / a.customers else 0 end as retention,
      case
        when a.orders < v_set.min_orders then 'Needs ' || v_set.min_orders || ' completed orders'
        when a.reviews < v_set.min_reviews then 'Needs ' || v_set.min_reviews || ' reviews'
        when a.customers < v_set.min_customers then 'Needs ' || v_set.min_customers || ' different customers'
        else '' end as reason
    from agg as a
  ),
  ok as (
    select j.*,
      pg_catalog.count(*) filter (where j.reason = '') over () as n_ok,
      pg_catalog.percent_rank() over (partition by (j.reason = '') order by j.orders) as orders_rank
    from judged as j
  ),
  scored as (
    select o.*,
      case when o.reason = '' then pg_catalog.round(o.retention * 100, 2) end as s_ret,
      case when o.reason = '' then pg_catalog.round(coalesce((o.avg_rating - 1) / 4 * 100, 0), 2) end as s_sat,
      case when o.reason = '' then pg_catalog.round(
        (case when o.n_ok > 1 then o.orders_rank else 1 end)::numeric * 100, 2) end as s_ord,
      -- winrate counts from min_wl_games reported games; until then (or with no win/loss orders) null
      case when o.reason = '' and o.wl_wins + o.wl_losses >= v_set.min_wl_games and o.wl_wins + o.wl_losses > 0
        then pg_catalog.round(o.wl_wins * 100.0 / (o.wl_wins + o.wl_losses), 2) end as s_win
    from ok as o
  ),
  totals as (
    select s.*,
      -- without a winrate the other three weights scale up to 100%
      case when s.reason <> '' then null
           when s.s_win is not null then pg_catalog.round(
             (s.s_ret * v_set.w_retention + s.s_sat * v_set.w_satisfaction + s.s_ord * v_set.w_orders
              + s.s_win * v_set.w_winrate) / 100, 2)
           when v_set.w_retention + v_set.w_satisfaction + v_set.w_orders = 0 then 0
           else pg_catalog.round(
             (s.s_ret * v_set.w_retention + s.s_sat * v_set.w_satisfaction + s.s_ord * v_set.w_orders)
             / (v_set.w_retention + v_set.w_satisfaction + v_set.w_orders), 2) end as score
    from scored as s
  ),
  positioned as (
    select x.*,
      case when x.reason = '' then pg_catalog.rank() over (
        partition by (x.reason = '') order by x.score desc, x.orders desc) end as rnk
    from totals as x
  )
  insert into public.performance_scores(run_id, teammate_id, eligible, reason, completed_orders, reviews,
    avg_rating, customers, returning_customers, retention_rate, retention_score, satisfaction_score,
    orders_score, score, rank, percentile, bracket, wl_wins, wl_losses, winrate_score)
  select v_run, p.t, p.reason = '', p.reason, p.orders, p.reviews, pg_catalog.round(p.avg_rating, 2),
    p.customers, p.returning, pg_catalog.round(p.retention, 4), p.s_ret, p.s_sat, p.s_ord, p.score, p.rnk,
    case when p.rnk is not null then pg_catalog.round(p.rnk * 100.0 / p.n_ok, 2) end,
    case
      when p.rnk is null then null
      when p.rnk * 100.0 / p.n_ok <= 1 then 1
      when p.rnk * 100.0 / p.n_ok <= 5 then 5
      when p.rnk * 100.0 / p.n_ok <= 10 then 10
      when p.rnk * 100.0 / p.n_ok <= 25 then 25
      when p.rnk * 100.0 / p.n_ok <= 50 then 50
    end,
    p.wl_wins, p.wl_losses, p.s_win
  from positioned as p;

  select pg_catalog.count(*), pg_catalog.count(*) filter (where eligible)
    into v_total, v_eligible from public.performance_scores where run_id = v_run;
  update public.performance_runs set teammates = v_total, eligible = v_eligible where id = v_run;

  -- Wanted Discord role per teammate; anyone dropped from the run loses their role.
  insert into public.performance_discord as d (teammate_id, bracket, status, updated_at)
    select s.teammate_id, s.bracket, 'pending', pg_catalog.clock_timestamp()
      from public.performance_scores as s where s.run_id = v_run
  on conflict (teammate_id) do update
    set bracket = excluded.bracket,
        status = case when d.bracket is not distinct from excluded.bracket and d.status = 'synced'
                      then 'synced' else 'pending' end,
        updated_at = excluded.updated_at;
  update public.performance_discord as d
     set bracket = null, status = 'pending', updated_at = pg_catalog.clock_timestamp()
   where d.bracket is not null
     and not exists (select 1 from public.performance_scores as s
                      where s.run_id = v_run and s.teammate_id = d.teammate_id);

  -- A year of history is plenty (two runs a day).
  delete from public.performance_runs where started_at < pg_catalog.clock_timestamp() - interval '365 days';

  return pg_catalog.jsonb_build_object('run', v_run, 'teammates', v_total, 'eligible', v_eligible);
end;
$$;

create or replace function public.teammate_performance() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_run public.performance_runs;
  v_me public.performance_scores;
  v_next smallint;
  v_target_rank integer;
  v_target_score numeric;
begin
  if v_actor is null then return public.order_error(401, 'Authentication required.'); end if;
  if not exists (select 1 from public.account_roles where user_id = v_actor and role = 'teammate') then
    return public.order_error(403, 'Teammates only.');
  end if;
  select * into v_run from public.performance_runs order by id desc limit 1;
  if v_run.id is null then return pg_catalog.jsonb_build_object('ranked', false, 'run', null); end if;
  select * into v_me from public.performance_scores where run_id = v_run.id and teammate_id = v_actor;
  if v_me.run_id is not null and v_me.eligible then
    v_next := case v_me.bracket when 50 then 25 when 25 then 10 when 10 then 5 when 5 then 1
                                when 1 then null else 50 end;
    if v_next is not null then
      v_target_rank := pg_catalog.floor(v_run.eligible * v_next / 100.0)::integer;
      if v_target_rank >= 1 then
        select pg_catalog.min(s.score) into v_target_score from public.performance_scores as s
         where s.run_id = v_run.id and s.eligible and s.rank <= v_target_rank;
      end if;
    end if;
  end if;
  return pg_catalog.jsonb_build_object(
    'ranked', coalesce(v_me.eligible, false),
    'run', pg_catalog.jsonb_build_object('at', v_run.started_at, 'eligible', v_run.eligible,
      'windowDays', (v_run.settings ->> 'window_days')::integer,
      'weights', pg_catalog.jsonb_build_object(
        'retention', (v_run.settings ->> 'w_retention')::integer,
        'satisfaction', (v_run.settings ->> 'w_satisfaction')::integer,
        'orders', (v_run.settings ->> 'w_orders')::integer,
        'winrate', coalesce((v_run.settings ->> 'w_winrate')::integer, 0)),
      'minWinLossGames', coalesce((v_run.settings ->> 'min_wl_games')::integer, 0)),
    'requirements', pg_catalog.jsonb_build_object(
      'orders', (v_run.settings ->> 'min_orders')::integer,
      'reviews', (v_run.settings ->> 'min_reviews')::integer,
      'customers', (v_run.settings ->> 'min_customers')::integer),
    'me', case when v_me.run_id is null then null else pg_catalog.jsonb_build_object(
      'reason', v_me.reason,
      'completedOrders', v_me.completed_orders,
      'reviews', v_me.reviews,
      'avgRating', v_me.avg_rating,
      'customers', v_me.customers,
      'returningCustomers', v_me.returning_customers,
      'retentionRate', v_me.retention_rate,
      'retentionScore', v_me.retention_score,
      'satisfactionScore', v_me.satisfaction_score,
      'ordersScore', v_me.orders_score,
      'winLossWins', v_me.wl_wins,
      'winLossLosses', v_me.wl_losses,
      'winrateScore', v_me.winrate_score,
      'score', v_me.score,
      'rank', v_me.rank,
      'percentile', v_me.percentile,
      'bracket', v_me.bracket) end,
    'next', case when v_next is null then null else pg_catalog.jsonb_build_object(
      'bracket', v_next,
      'score', v_target_score,
      'reachable', v_target_score is not null) end);
end;
$$;

create or replace function public.admin_performance() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_run public.performance_runs; v_prev bigint;
begin
  if not exists (select 1 from public.admin_caller()) then return public.order_error(403, 'Admins only.'); end if;
  select * into v_run from public.performance_runs order by id desc limit 1;
  select id into v_prev from public.performance_runs where id < coalesce(v_run.id, 0) order by id desc limit 1;
  return pg_catalog.jsonb_build_object(
    'settings', (select pg_catalog.to_jsonb(s) - 'id' from public.performance_settings as s where s.id),
    'run', case when v_run.id is null then null else pg_catalog.jsonb_build_object(
      'id', v_run.id, 'at', v_run.started_at, 'trigger', v_run.trigger, 'by', v_run.actor_name,
      'teammates', v_run.teammates, 'eligible', v_run.eligible) end,
    'contractors', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'userId', s.teammate_id,
          'name', coalesce(nullif(p.name, 'Player'), u.email, ''),
          'eligible', s.eligible, 'reason', s.reason,
          'completedOrders', s.completed_orders, 'reviews', s.reviews, 'avgRating', s.avg_rating,
          'customers', s.customers, 'returningCustomers', s.returning_customers,
          'retentionRate', s.retention_rate, 'retentionScore', s.retention_score,
          'satisfactionScore', s.satisfaction_score, 'ordersScore', s.orders_score,
          'winLossWins', s.wl_wins, 'winLossLosses', s.wl_losses, 'winrateScore', s.winrate_score,
          'score', s.score, 'rank', s.rank, 'percentile', s.percentile, 'bracket', s.bracket,
          'previousRank', ps.rank, 'previousBracket', ps.bracket,
          'discord', pg_catalog.jsonb_build_object(
            'username', da.username, 'status', coalesce(d.status, 'pending'),
            'detail', coalesce(d.detail, ''), 'syncedAt', d.synced_at))
          order by s.rank nulls last, s.completed_orders desc, s.teammate_id)
        from public.performance_scores as s
        left join public.performance_scores as ps on ps.run_id = v_prev and ps.teammate_id = s.teammate_id
        left join public.profiles as p on p.id = s.teammate_id
        left join auth.users as u on u.id = s.teammate_id
        left join public.performance_discord as d on d.teammate_id = s.teammate_id
        left join public.discord_accounts as da on da.user_id = s.teammate_id
       where s.run_id = v_run.id), '[]'::jsonb));
end;
$$;

drop function public.admin_set_performance_settings(integer, integer, integer, integer, integer, integer, integer);
create function public.admin_set_performance_settings(
  p_w_retention integer, p_w_satisfaction integer, p_w_orders integer, p_w_winrate integer,
  p_window_days integer, p_min_orders integer, p_min_reviews integer, p_min_customers integer,
  p_min_wl_games integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid; v_name text;
begin
  select id, name into v_actor, v_name from public.admin_caller();
  if v_actor is null then return public.order_error(403, 'Admins only.'); end if;
  if p_w_retention is null or p_w_satisfaction is null or p_w_orders is null or p_w_winrate is null
     or least(p_w_retention, p_w_satisfaction, p_w_orders, p_w_winrate) < 0
     or p_w_retention + p_w_satisfaction + p_w_orders + p_w_winrate <> 100 then
    return public.order_error(400, 'The four weights must add up to 100%.');
  end if;
  if p_window_days is null or p_window_days not between 7 and 365 then
    return public.order_error(400, 'The window is 7 to 365 days.');
  end if;
  if p_min_orders is null or p_min_orders not between 1 and 1000
     or p_min_reviews is null or p_min_reviews not between 0 and 1000
     or p_min_customers is null or p_min_customers not between 1 and 1000
     or p_min_wl_games is null or p_min_wl_games not between 1 and 1000 then
    return public.order_error(400, 'Check the eligibility minimums.');
  end if;
  update public.performance_settings
     set w_retention = p_w_retention, w_satisfaction = p_w_satisfaction, w_orders = p_w_orders,
         w_winrate = p_w_winrate, window_days = p_window_days, min_orders = p_min_orders,
         min_reviews = p_min_reviews, min_customers = p_min_customers, min_wl_games = p_min_wl_games,
         updated_at = pg_catalog.clock_timestamp(), updated_by = v_name
   where id;
  perform public.admin_log(v_actor, v_name, 'Changed performance settings', '',
    'weights ' || p_w_retention || '/' || p_w_satisfaction || '/' || p_w_orders || '/' || p_w_winrate
    || ', ' || p_window_days || ' days, min ' || p_min_orders || ' orders, ' || p_min_reviews
    || ' reviews, ' || p_min_customers || ' customers, ' || p_min_wl_games || ' reported games');
  return public.admin_performance();
end;
$$;

revoke all on function public.admin_set_performance_settings(integer, integer, integer, integer, integer, integer, integer, integer, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_set_performance_settings(integer, integer, integer, integer, integer, integer, integer, integer, integer)
  to authenticated;

-- Rank everyone under the new weights now instead of at the next 12-hour run.
select public.performance_recalculate('manual', 'Winrate update');

commit;
