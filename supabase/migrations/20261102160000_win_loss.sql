-- Winrate for teammates (owner request 2026-11-02).
--
-- On win/loss orders the teammate reports every game (their IGN, the customer's IGN and the match
-- link) and how many they won and lost. The report is required to finish the order, on top of the
-- proof screenshots. Their winrate comes from the reports of the orders they completed, and only
-- teammates (their desk) and admins (Admin, Teammates) see it.
--
-- Win/loss orders: per-game duo and fill services in LoL, Valorant, CS2, R6, Marvel Rivals,
-- Overwatch, Rocket League and Pokemon Unite. Not Gamer Girl or Social, coaching, Play and Learn,
-- fun modes, the hourly games, or placement modes and draws (TFT, LoL Arena, EA FC). The list in
-- order_tracks_wl is the one in src/design-reference/lib/winloss.js (a unit test compares them).
--
-- complete_order, teammate_stats and admin_teammates are their live definitions (20261026160000 and
-- 20261026153000) with the marked additions. Deploy the code first: the stats contracts accept the
-- new winLoss key being there or missing.
begin;

create function public.order_tracks_wl(p_order public.orders) returns boolean
language sql immutable security invoker set search_path = '' as $$
  select not p_order.gg and (p_order.game, p_order.service) in (values ('lol','duo1'),('lol','duo2'),('lol','duo3'),('lol','ranked5'),('lol','flex'),('lol','clash'),('val','duo1'),('val','duo2'),('val','duo3'),('val','skirm'),('val','stack'),('val','premier'),('cs2','duo1'),('cs2','duo2'),('cs2','duo3'),('cs2','wing'),('cs2','five'),('cs2','faceit5'),('r6','duo1'),('r6','duo2'),('r6','duo3'),('r6','stack'),('mr','duo1'),('mr','duo2'),('mr','duo3'),('mr','teamup'),('mr','six'),('ow','duo1'),('ow','duo2'),('ow','duo3'),('ow','stadium'),('ow','five'),('rl','duo1'),('rl','duo2'),('rl','duo3'),('rl','three'),('pu','duo1'),('pu','duo2'),('pu','duo3'),('pu','squad'));
$$;

create table public.order_match_reports (
  assignment_id uuid primary key references public.order_assignments(id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete restrict,
  teammate_id uuid not null references public.profiles(id) on delete restrict,
  -- [{ "teammateIgn": "...", "customerIgn": "...", "link": "https://..." }], one per game
  games jsonb not null check (pg_catalog.jsonb_typeof(games) = 'array' and pg_catalog.jsonb_array_length(games) between 1 and 20),
  wins integer not null check (wins >= 0),
  losses integer not null check (losses >= 0),
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  check (wins + losses = pg_catalog.jsonb_array_length(games))
);
create index order_match_reports_teammate on public.order_match_reports(teammate_id);
alter table public.order_match_reports enable row level security;
revoke all on table public.order_match_reports from public, anon, authenticated, service_role;

-- The teammate playing a win/loss order saves (or corrects) the report before finishing.
create function public.teammate_save_match_report(p_order_id uuid, p_games jsonb, p_wins integer, p_losses integer)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v public.orders; v_games jsonb; v_bad boolean;
begin
  if v_actor is null then return public.order_error(401, 'Authentication required.'); end if;
  perform 1 from public.account_roles where user_id = v_actor and role = 'teammate';
  if not found then return public.order_error(403, 'Teammate role required.'); end if;
  select o.* into v from public.orders o where o.id = p_order_id for update;
  if v.id is null or v.assigned_teammate_id is distinct from v_actor or v.status <> 'in_progress' then
    return public.order_error(404, 'Order not found.');
  end if;
  if not public.order_tracks_wl(v) then return public.order_error(409, 'This order doesn’t need a match report.'); end if;
  if p_games is null or pg_catalog.jsonb_typeof(p_games) <> 'array' or pg_catalog.jsonb_array_length(p_games) <> v.units then
    return public.order_error(400, 'Fill in all ' || v.units::text || ' games.');
  end if;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'teammateIgn', pg_catalog.btrim(g->>'teammateIgn'),
      'customerIgn', pg_catalog.btrim(g->>'customerIgn'),
      'link', pg_catalog.btrim(g->>'link')) order by n), '[]'::jsonb),
    pg_catalog.bool_or(pg_catalog.jsonb_typeof(g) <> 'object'
      or pg_catalog.char_length(coalesce(pg_catalog.btrim(g->>'teammateIgn'), '')) not between 1 and 64
      or pg_catalog.char_length(coalesce(pg_catalog.btrim(g->>'customerIgn'), '')) not between 1 and 64
      or coalesce(pg_catalog.btrim(g->>'link'), '') !~ '^https://[^[:space:]]{4,}$'
      or pg_catalog.char_length(pg_catalog.btrim(g->>'link')) > 300)
    into v_games, v_bad
    from pg_catalog.jsonb_array_elements(p_games) with ordinality x(g, n);
  if v_bad then
    return public.order_error(400, 'Every game needs your IGN, the customer’s IGN and a match link starting with https://.');
  end if;
  if p_wins is null or p_losses is null or p_wins < 0 or p_losses < 0 or p_wins + p_losses <> v.units then
    return public.order_error(400, 'Wins and losses need to add up to ' || v.units::text || ' games.');
  end if;
  insert into public.order_match_reports(assignment_id, order_id, teammate_id, games, wins, losses)
    values (v.current_assignment_id, v.id, v_actor, v_games, p_wins, p_losses)
    on conflict (assignment_id) do update set games = excluded.games, wins = excluded.wins,
      losses = excluded.losses, updated_at = pg_catalog.clock_timestamp();
  return pg_catalog.jsonb_build_object('report', pg_catalog.jsonb_build_object('games', v_games, 'wins', p_wins, 'losses', p_losses));
end;
$$;

-- What the teammate saved for the order they're playing (null until they save).
create function public.teammate_match_report(p_order_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v public.orders; r public.order_match_reports;
begin
  if v_actor is null then return public.order_error(401, 'Authentication required.'); end if;
  select o.* into v from public.orders o where o.id = p_order_id;
  if v.id is null or v.assigned_teammate_id is distinct from v_actor then return public.order_error(404, 'Order not found.'); end if;
  select m.* into r from public.order_match_reports m where m.assignment_id = v.current_assignment_id;
  return pg_catalog.jsonb_build_object('report', case when r.assignment_id is null then null else
    pg_catalog.jsonb_build_object('games', r.games, 'wins', r.wins, 'losses', r.losses) end);
end;
$$;

-- A teammate's wins and losses: the reports of the orders they completed.
create function public.teammate_winloss(p_teammate uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select pg_catalog.jsonb_build_object('wins', coalesce(pg_catalog.sum(m.wins), 0), 'losses', coalesce(pg_catalog.sum(m.losses), 0))
    from public.order_match_reports m
    join public.order_assignments a on a.id = m.assignment_id and a.end_reason = 'completed'
   where m.teammate_id = p_teammate;
$$;

-- From 20261026160000_perks.sql; added: the match report check.
create or replace function public.complete_order(p_order_id uuid, p_assignment_id uuid, p_proof_ids uuid[], p_request_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_actor uuid := auth.uid(); v public.orders; pay public.order_payments;
 v_proofs uuid[]; v_count bigint; v_now timestamptz; v_held integer; v_result jsonb; v_trust jsonb; v_percent integer;
begin
 if v_actor is null then return public.order_error(401,'Authentication required.'); end if;
 perform 1 from public.account_roles where user_id=v_actor and role='teammate' for update;
 if not found then return public.order_error(403,'Teammate role required.'); end if;
 perform 1 from public.teammate_order_access where user_id=v_actor for share;
 if p_order_id is null or p_assignment_id is null or p_request_id is null or p_proof_ids is null
   or pg_catalog.cardinality(p_proof_ids) not between 1 and 5 or coalesce(pg_catalog.array_ndims(p_proof_ids),1)<>1
   or pg_catalog.array_position(p_proof_ids,null) is not null then return public.order_error(400,'Select one to five distinct ready screenshots.'); end if;
 select pg_catalog.array_agg(distinct x order by x) into v_proofs from pg_catalog.unnest(p_proof_ids) x;
 if pg_catalog.cardinality(v_proofs)<>pg_catalog.cardinality(p_proof_ids) then return public.order_error(400,'Select one to five distinct ready screenshots.'); end if;
 select o.* into v from public.orders o where o.id=p_order_id for update;
 if v.id is null or not coalesce(public.order_proof_player(v,v_actor),false) then return public.order_error(404,'Order not found.'); end if;
 if exists(select 1 from public.teammate_earning_entries where order_id=v.id) then
   select e.result into v_result from public.teammate_earning_entries e where e.order_id=v.id and e.teammate_id=v_actor and e.assignment_id=p_assignment_id and e.request_id=p_request_id and e.proof_ids=v_proofs;
   if found then return v_result; end if;
   return public.order_error(409,'Completion already recorded with another request or proof set.');
 end if;
 if exists(select 1 from public.teammate_earning_entries where teammate_id=v_actor and request_id=p_request_id) then return public.order_error(409,'Request UUID already bound to another completion.'); end if;
 if v.status<>'in_progress' or v.current_assignment_id<>p_assignment_id or not exists(select 1 from public.order_assignments where id=p_assignment_id and ended_at is null) then return public.order_error(409,'Assignment unavailable.'); end if;
 -- Win/loss orders (20261102160000): the match report first.
 if public.order_tracks_wl(v) and not exists(select 1 from public.order_match_reports r where r.assignment_id=p_assignment_id) then
   return public.order_error(409,'Fill in the match report first: every game with both IGNs and the match link, plus your wins and losses.');
 end if;
 select p.* into pay from public.order_payments p where p.order_id=v.id for update;
 if not (pay.order_id is null and public.order_is_free_perk(v.id))
    and (pay.order_id is null or pay.state<>'captured' or pay.settle<>'none') then return public.order_error(409,'Captured settled payment required.'); end if;
 perform 1 from public.order_proof_uploads p where p.id=any(v_proofs) order by p.id for share;
 if (select pg_catalog.count(*) from public.order_proof_uploads p where p.id=any(v_proofs) and p.order_id=v.id and p.assignment_id=p_assignment_id and p.uploader_id=v_actor and p.state='ready')<>pg_catalog.cardinality(v_proofs) then return public.order_error(400,'Select ready screenshots from this assignment.'); end if;
 v_count := public.payout_valid_count(v_actor);
 v_now:=pg_catalog.clock_timestamp(); v_trust:=public.completion_trust(v_count); v_percent:=(v_trust->>'deposit_percent')::integer;
 v_held:=(v.payout_usd_cents*v_percent+50)/100;
 v_result:=pg_catalog.jsonb_build_object('completion',pg_catalog.jsonb_build_object('order_id',v.id,'assignment_id',p_assignment_id,'request_id',p_request_id,'proof_ids',v_proofs,'completed_at',v_now,'payout_usd_cents',v.payout_usd_cents,'deposit_percent',v_percent,'held_usd_cents',v_held,'net_usd_cents',v.payout_usd_cents-v_held,'trust_tier',v_trust->>'trust_tier'));
 insert into public.teammate_earning_entries(order_id,assignment_id,teammate_id,request_id,proof_ids,completed_at,prior_completed_count,trust_tier,payout_usd_cents,deposit_percent,held_usd_cents,net_usd_cents,source_snapshot,result)
 values(v.id,p_assignment_id,v_actor,p_request_id,v_proofs,v_now,v_count,v_trust->>'trust_tier',v.payout_usd_cents,v_percent,v_held,v.payout_usd_cents-v_held,pg_catalog.jsonb_build_object('payout_usd_cents',v.payout_usd_cents,'booking_fx',v.booking_fx,'payment_intent_id',pay.intent_id,'payment_state',pay.state,'payment_settle',pay.settle),v_result);
 insert into public.order_completion_proofs(order_id,proof_id) select v.id,x from pg_catalog.unnest(v_proofs) x;
 update public.order_assignments set ended_at=v_now,end_reason='completed' where id=p_assignment_id;
 update public.orders set status='completed',completed_at=v_now where id=v.id;
 return v_result;
end $function$;

-- From 20261026160000_perks.sql; added: 'winLoss'.
create or replace function public.teammate_stats()
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
declare v_actor uuid:=auth.uid(); v_count bigint; v_trust jsonb; v_result jsonb; v_next integer; v_floor integer;
begin
 if v_actor is null then return public.order_error(401,'Authentication required.'); end if;
 perform 1 from public.account_roles where user_id=v_actor and role='teammate';
 if not found then return public.order_error(403,'Teammate role required.'); end if;
 v_count := public.payout_valid_count(v_actor);
 v_trust:=public.completion_trust(v_count);
 v_floor:=case when v_count>=1000 then 1000 when v_count>=500 then 500 when v_count>=250 then 250 when v_count>=100 then 100 else 0 end;
 v_next:=case when v_count<100 then 100 when v_count<250 then 250 when v_count<500 then 500 when v_count<1000 then 1000 end;
 select pg_catalog.jsonb_build_object(
   'now',(pg_catalog.date_part('epoch',pg_catalog.clock_timestamp())*1000)::bigint,'me',v_actor,
   'stats',pg_catalog.jsonb_build_object(
     'completed',v_count,'tier',pg_catalog.jsonb_build_object('name',pg_catalog.initcap(v_trust->>'trust_tier'),'deposit',(v_trust->>'deposit_percent')::integer),
     'held',coalesce((select pg_catalog.sum(e.held_usd_cents) from public.deposit_releases r join public.teammate_earning_entries e on e.order_id=r.earning_id where r.teammate_id=v_actor and r.state in ('waiting','blocked')),0)/100.0,
     'released',coalesce((select pg_catalog.sum(e.held_usd_cents) from public.deposit_releases r join public.teammate_earning_entries e on e.order_id=r.earning_id where r.teammate_id=v_actor and r.state='released'),0)/100.0,
     'forfeited',coalesce((select pg_catalog.sum(e.held_usd_cents) from public.deposit_releases r join public.teammate_earning_entries e on e.order_id=r.earning_id where r.teammate_id=v_actor and r.state='forfeited'),0)/100.0,
     'saved',coalesce((select pg_catalog.sum((10-e.deposit_percent)*e.payout_usd_cents) from public.teammate_earning_entries e where e.teammate_id=v_actor),0)/10000.0,
     'progress',pg_catalog.jsonb_build_object('current',v_count,'next',v_next,'remaining',coalesce(v_next-v_count,0),'percent',case when v_next is null then 100 else pg_catalog.floor(100.0*(v_count-v_floor)/(v_next-v_floor))::integer end),
     'rating',(select pg_catalog.round(pg_catalog.avg(r.rating),2) from public.order_reviews r where r.teammate_id=v_actor),
     'reviews',(select pg_catalog.count(*) from public.order_reviews r where r.teammate_id=v_actor),
     'winLoss',public.teammate_winloss(v_actor),
     'tipsTotal',coalesce((select pg_catalog.sum(public.tip_payable_usd(t)) from public.order_tips t where t.teammate_id=v_actor),0)/100.0,
     'recent',coalesce((select pg_catalog.jsonb_agg(q.item order by q.at desc) from (
        select e.completed_at at,pg_catalog.jsonb_build_object('orderId',e.order_id,'at',(pg_catalog.date_part('epoch',e.completed_at)*1000)::bigint,'net',e.net_usd_cents/100.0,
          'tip',coalesce((select public.tip_payable_usd(t) from public.order_tips t where t.order_id=e.order_id and t.teammate_id=v_actor),0)/100.0,'game',o.game) item
          from public.teammate_earning_entries e join public.orders o on o.id=e.order_id where e.teammate_id=v_actor and e.completed_at>pg_catalog.clock_timestamp()-interval '8 days'
        union all
        select a.created_at,pg_catalog.jsonb_build_object('orderId',null,'at',(pg_catalog.date_part('epoch',a.created_at)*1000)::bigint,'net',a.amount_usd_cents/100.0,'tip',0,'game',null,'adjustment',true)
          from public.teammate_adjustments a where a.teammate_id=v_actor and a.created_at>pg_catalog.clock_timestamp()-interval '8 days') q),'[]'::jsonb),
     'latestReviews',coalesce((select pg_catalog.jsonb_agg(q.item order by q.created_at desc) from (select r.created_at,pg_catalog.jsonb_build_object('rating',r.rating,'text',r.text,'tags',pg_catalog.to_jsonb(r.tags),'customer',o.customer_name,'game',o.game,'at',(pg_catalog.date_part('epoch',r.created_at)*1000)::bigint) item from public.order_reviews r join public.orders o on o.id=r.order_id where r.teammate_id=v_actor and (r.text<>'' or pg_catalog.cardinality(r.tags)>0) order by r.created_at desc,r.order_id limit 5) q),'[]'::jsonb),
     'adjustments',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('amount',a.amount_usd_cents/100.0,'reason',a.reason,'at',(pg_catalog.date_part('epoch',a.created_at)*1000)::bigint) order by a.created_at desc)
        from public.teammate_adjustments a where a.teammate_id=v_actor and a.created_at>pg_catalog.clock_timestamp()-interval '30 days'),'[]'::jsonb),
     'payout',public.teammate_payout_summary(v_actor)),
   'leaderboard',public.teammate_leaderboard(pg_catalog.clock_timestamp())) into v_result;
 return v_result;
end $function$;

-- From 20261026153000_admin_parity.sql; added: 'winLoss'.
create or replace function public.admin_teammates() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.admin_caller()) then return public.order_error(403,'Admins only.'); end if;
  return pg_catalog.jsonb_build_object('teammates',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id',r.user_id,'name',coalesce(nullif(p.name,'Player'),u.email,''),'email',coalesce(u.email,''),'image',coalesce(p.image,''),'country',coalesce(p.country,''),
    'joined',coalesce(r.role_set_at,u.created_at),'lastSeen',u.last_sign_in_at,'games',pg_catalog.to_jsonb(coalesce(a.approved_games,'{}')),'gg',coalesce(a.gg_access,false),'discord',d.username,
    'suspended',case when coalesce(a.suspended,false) then pg_catalog.jsonb_build_object('reason',a.suspended_reason,'at',a.suspended_at,'by',coalesce((select coalesce(nullif(bp.name,'Player'),bu.email) from auth.users bu left join public.profiles bp on bp.id=bu.id where bu.id=a.suspended_by),'')) end,
    'online',exists(select 1 from public.teammate_presence tp where tp.user_id=r.user_id and tp.online and tp.last_seen_at > pg_catalog.clock_timestamp()-interval '20 seconds') or exists(select 1 from public.orders o where o.assigned_teammate_id=r.user_id and o.status='in_progress'),
    'playing',exists(select 1 from public.orders o where o.assigned_teammate_id=r.user_id and o.status='in_progress'),
    'completed',(select pg_catalog.count(*) from public.orders o where o.assigned_teammate_id=r.user_id and o.status='completed'),
    'accepted',(select pg_catalog.count(*) from public.order_assignments h where h.teammate_id=r.user_id),
    'earned30UsdCents',coalesce((select pg_catalog.sum(o.payout_usd_cents) from public.orders o where o.assigned_teammate_id=r.user_id and o.status='completed' and o.completed_at > pg_catalog.clock_timestamp()-interval '30 days'),0),
    'rating',(select pg_catalog.round(pg_catalog.avg(rv.rating),2) from public.order_reviews rv where rv.teammate_id=r.user_id),
    'reviews',(select pg_catalog.count(*) from public.order_reviews rv where rv.teammate_id=r.user_id),
    'winLoss',public.teammate_winloss(r.user_id),
    'warnings',(select pg_catalog.count(*) from public.order_chat_flags f where f.actor_id=r.user_id and f.status='warned'),
    'trust',public.completion_trust(public.payout_valid_count(r.user_id)),
    'depositHeldUsdCents',coalesce((select pg_catalog.sum(e.held_usd_cents) from public.deposit_releases dr join public.teammate_earning_entries e on e.order_id=dr.earning_id where dr.teammate_id=r.user_id and dr.state in ('waiting','blocked')),0),
    'payout',public.teammate_payout_summary(r.user_id)) order by coalesce(r.role_set_at,u.created_at) desc)
    from public.account_roles r join auth.users u on u.id=r.user_id left join public.profiles p on p.id=r.user_id
    left join public.teammate_order_access a on a.user_id=r.user_id left join public.discord_accounts d on d.user_id=r.user_id where r.role='teammate'),'[]'::jsonb));
end;
$$;

-- Admin, Teammates, Match reports: every report with what the customer gave on the order (their
-- IGN), so a made-up report stands out. Newest first.
create function public.admin_match_reports(p_limit integer default 200, p_offset integer default 0)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.admin_caller()) then return public.order_error(403, 'Admins only.'); end if;
  return pg_catalog.jsonb_build_object('reports', coalesce((select pg_catalog.jsonb_agg(q.item order by q.at desc) from (
    select m.updated_at at, pg_catalog.jsonb_build_object(
      'orderId', o.id, 'reference', o.public_reference, 'game', o.game, 'service', o.service, 'title', o.title,
      'units', o.units, 'orderIgn', o.ign, 'customer', o.customer_name,
      'teammate', pg_catalog.jsonb_build_object('id', m.teammate_id,
        'name', coalesce(nullif(p.name, 'Player'), u.email, ''), 'image', coalesce(p.image, '')),
      -- completed: counts in the winrate; open: still playing; handed_over / customer_reroll: doesn't count
      'state', coalesce(a.end_reason, 'open'),
      'games', m.games, 'wins', m.wins, 'losses', m.losses,
      'createdAt', m.created_at, 'updatedAt', m.updated_at) item
      from public.order_match_reports m
      join public.orders o on o.id = m.order_id
      join public.order_assignments a on a.id = m.assignment_id
      left join public.profiles p on p.id = m.teammate_id
      left join auth.users u on u.id = m.teammate_id
     order by m.updated_at desc
     limit greatest(1, least(coalesce(p_limit, 200), 500)) offset greatest(0, coalesce(p_offset, 0))) q), '[]'::jsonb));
end;
$$;

revoke all on function public.order_tracks_wl(public.orders), public.teammate_winloss(uuid),
  public.teammate_save_match_report(uuid, jsonb, integer, integer), public.teammate_match_report(uuid),
  public.admin_match_reports(integer, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.teammate_save_match_report(uuid, jsonb, integer, integer),
  public.teammate_match_report(uuid), public.admin_match_reports(integer, integer) to authenticated;

commit;
