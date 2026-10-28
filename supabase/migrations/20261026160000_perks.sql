-- Customer and teammate perks (ledger #37 and #13; MONEY-RULES section 9, perks decided 2026-10-28).
--
-- 1. Free monthly Play and Learn (customer loyalty Platinum and Diamond): one free coaching
--    order (catalog category training, exactly 1 unit: 1 hour or 1 game for the per-game
--    Play and Learn, no bundle, no Gamer Girl; owner decision 2026-10-28) per
--    calendar month in Europe/Vienna time. The customer pays 0 and there is no Stripe payment and
--    no wallet spend. orders.amount_eur_cents keeps the full list price (orders need >= 0.99 EUR and
--    teammates see a normal order); payout_usd_cents is the normal payout and Duoly pays it.
--    free_coaching_claims records the claim; a cancel (customer, admin, nobody in 5 minutes) or an
--    admin refund returns it, so the perk is available again that month. No rollover. The free
--    order earns no cashback, no creator commission, no refund credit, no PRO or creator discount,
--    and does not count towards the customer's loyalty level (conservative choice). It counts for
--    the teammate's trust level like a paid order (payout_valid_count) and can be completed
--    without a captured Stripe payment.
-- 2. Pick any teammate (customer loyalty Diamond): the customer names a teammate through one of
--    their own completed orders with that teammate (no teammate ids reach the browser). If, when
--    the order is created, the customer is Diamond and the teammate still has access to the game
--    (Gamer Girl access for gg orders), allows it in their queue settings, is not suspended, is
--    online and not busy, order_teammate_picks gives that teammate the order alone for 60 seconds
--    from queued_at, with no priority delay. The window ends early when the teammate passes
--    (teammate_pass_picked_order) or goes offline (presence trigger, or a heartbeat older than 20
--    seconds). Everyone else's priority delay then counts from the moment the order entered the
--    normal queue (order_public_queued_at). Discord public posts count from that moment too and
--    are refused while the window is open. Re-rolled orders re-enter the queue without a window.
-- 3. Veteran "See high-value orders first": orders whose list price (orders.amount_eur_cents plus
--    the PRO and creator discounts stored on the checkout intent, i.e. before wallet and
--    discounts) is at least 20 EUR get +15 seconds for teammates below Veteran (fewer than 250
--    valid completions, payout_valid_count).
-- 4. Elite "Priority matching": Elite and Legend (500+) get 10 seconds off their priority delay,
--    never below 0.
-- Gold and PRO customer orders keep sorting first only (order_has_head_start), unchanged.
-- Teammates never see delay numbers; customers never see priority internals.
--
-- create or replace targets start from their live definitions (pg_get_functiondef, 2026-10-28)
-- and keep their live grants:
--   order_eligible, order_expire_locked, teammate_order_queue, accept_handover,
--   discord_order_posts_due, discord_order_post_claim, create_paid_order, order_post_refund,
--   checkout_intent_attribute, admin_refund_order, complete_order, payout_valid_count,
--   teammate_stats, loyalty_valid_count, loyalty_after_order_completed, order_customer_dto,
--   customer_rewards
-- Deploy order: code first, then this migration. The code accepts the new optional keys
-- (free_perk, picked_for_you, perks) and only sends the new checkout fields when a perk is used;
-- the new RPCs it calls answer 404 until the migration is applied, which the UI treats as "no perk".
begin;

-- ---- tables ----------------------------------------------------------------------------------

alter table public.checkout_intents
  add column free_coaching boolean not null default false,
  add column pick_source_order_id uuid references public.orders(id) on delete restrict,
  add constraint checkout_intents_free_coaching check (
    not free_coaching or (units = 1 and not gg and wallet_eur_cents = 0
      and pro_discount_cents = 0 and first_order_discount_cents = 0 and ref_code is null));

create table public.free_coaching_claims (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete restrict,
  month date not null check (pg_catalog.date_trunc('month', month) = month),
  intent_id uuid not null unique references public.checkout_intents(id) on delete restrict,
  order_id uuid not null unique references public.orders(id) on delete restrict,
  loyalty_level text not null check (loyalty_level in ('platinum','diamond')),
  prior_completed_count bigint not null check (prior_completed_count >= 500),
  list_eur_cents integer not null check (list_eur_cents between 99 and 100000),
  state text not null default 'used' check (state in ('used','returned')),
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  returned_at timestamptz,
  return_reason text check (return_reason in ('cancelled','refunded')),
  check ((state = 'used') = (returned_at is null) and (returned_at is null) = (return_reason is null))
);
create unique index free_coaching_claims_one_per_month on public.free_coaching_claims(customer_id, month) where state = 'used';
alter table public.free_coaching_claims enable row level security;
revoke all on table public.free_coaching_claims from public, anon, authenticated, service_role;
grant select on table public.free_coaching_claims to service_role;

create table public.order_teammate_picks (
  order_id uuid primary key references public.orders(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete restrict,
  teammate_id uuid not null references public.profiles(id) on delete restrict,
  source_order_id uuid not null references public.orders(id) on delete restrict,
  queue_key timestamptz not null,
  window_ends_at timestamptz not null,
  released_at timestamptz,
  release_reason text check (release_reason in ('declined','offline')),
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  check (window_ends_at = queue_key + interval '60 seconds'),
  check ((released_at is null) = (release_reason is null)),
  check (teammate_id <> customer_id)
);
create index order_teammate_picks_open on public.order_teammate_picks(teammate_id) where released_at is null;
alter table public.order_teammate_picks enable row level security;
revoke all on table public.order_teammate_picks from public, anon, authenticated, service_role;

-- ---- perk 1: free monthly Play and Learn -----------------------------------------------------

-- Calendar month in Europe/Vienna (first day as a date).
create function public.free_coaching_month(p_at timestamptz) returns date
language sql stable security invoker set search_path = '' as $$
  select pg_catalog.date_trunc('month', p_at at time zone 'Europe/Vienna')::date;
$$;

-- Catalog services in category training, per hour or per game (src/design-reference/lib/catalog.js,
-- servicesFor). tests/unit/perks.test.ts keeps this list equal to the catalog.
create function public.free_coaching_service(p_game text, p_service text) returns boolean
language sql immutable security invoker set search_path = '' as $$
  select (p_game, p_service) in (('lol','vod'),('lol','champ'),('val','vod'),('val','aim'),('cs2','demo'),('cs2','util'),('fn','learn'),('fn','build'),('cod','learn'),('cod','loadout'),('apex','learn'),('apex','move'),('r6','ops'),('r6','maps'),('mr','hero'),('ow','role'),('rl','mech'),('tft','econ'),('fc','tactics'),('fc','champs'),('arc','pvp'),('mc','pvp'),('mc','bw'),('pu','draft'),
    ('lol','learn'),('val','learn'),('cs2','learn'),('r6','learn'),('mr','learn'),('ow','learn'),('rl','learn'),('pu','learn'));
$$;

create function public.order_is_free_perk(p_order_id uuid) returns boolean
language sql stable security invoker set search_path = '' as $$
  select exists(select 1 from public.free_coaching_claims f where f.order_id = p_order_id);
$$;

-- The customer's perks right now (level from the D4 loyalty count at this moment).
create function public.customer_perks_for(p_customer uuid) returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare v_level jsonb; v_index integer; v_month date; v_used boolean;
begin
  v_level := public.loyalty_level(public.loyalty_valid_count(p_customer));
  v_index := (v_level->>'index')::integer;
  v_month := public.free_coaching_month(pg_catalog.clock_timestamp());
  v_used := exists(select 1 from public.free_coaching_claims f where f.customer_id = p_customer and f.month = v_month and f.state = 'used');
  return pg_catalog.jsonb_build_object(
    'level', v_level->>'id',
    'freeCoaching', pg_catalog.jsonb_build_object('eligible', v_index >= 3, 'used', v_used,
      'available', v_index >= 3 and not v_used, 'month', pg_catalog.to_char(v_month, 'YYYY-MM')),
    'pickTeammate', pg_catalog.jsonb_build_object('eligible', v_index >= 4));
end $$;

-- Signed-in customer: own perks for the booking page.
create function public.customer_perks() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_actor uuid := auth.uid();
begin
  if v_actor is null then return public.order_error(401, 'Authentication required.'); end if;
  if not exists(select 1 from public.account_roles r where r.user_id = v_actor and r.role = 'customer') then
    return public.order_error(403, 'Customer role required.');
  end if;
  return public.customer_perks_for(v_actor);
end $$;

-- A cancel (any reason) or an admin refund gives the month's free order back.
create function public.free_coaching_return() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (new.status = 'cancelled' and old.status <> 'cancelled')
     or (new.admin_refunded_at is not null and old.admin_refunded_at is null) then
    update public.free_coaching_claims set state = 'returned', returned_at = pg_catalog.clock_timestamp(),
        return_reason = case when new.status = 'cancelled' then 'cancelled' else 'refunded' end
      where order_id = new.id and state = 'used';
  end if;
  return null;
end $$;
create trigger orders_free_coaching_return after update of status, admin_refunded_at on public.orders
  for each row execute function public.free_coaching_return();

-- Server only: the free order has no Stripe session and no wallet part.
create function public.create_free_coaching_order(p_intent_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  return public.create_paid_order(p_intent_id, null, 0, 'eur', 'free', 'free');
end $$;

-- ---- perk 2: pick any teammate ---------------------------------------------------------------

-- The teammate behind one of the customer's own completed orders, if they can take an order of
-- this shape right now: game access (Gamer Girl access for gg), queue settings, not suspended,
-- verified Discord, online with a fresh heartbeat, not busy.
create function public.order_pick_candidate(p_customer uuid, p_source uuid, p_game text, p_gg boolean, p_voice boolean, p_now timestamptz)
returns uuid
language sql stable security invoker set search_path = '' as $$
  select s.assigned_teammate_id from public.orders s
    join public.account_roles r on r.user_id = s.assigned_teammate_id and r.role = 'teammate'
    join public.teammate_order_access a on a.user_id = r.user_id
    join public.teammate_presence tp on tp.user_id = r.user_id
   where s.id = p_source and s.customer_id = p_customer and s.status = 'completed' and s.admin_refunded_at is null
     and s.assigned_teammate_id <> p_customer
     and not a.suspended and a.discord_id is not null and a.discord_verified_at is not null
     and ((a.gg_access and p_gg) or (not a.gg_access and not p_gg and p_game = any(a.approved_games)))
     and p_game = any(a.enabled_games) and (a.voice_opt_in or not p_voice)
     and tp.online and tp.last_seen_at > p_now - interval '20 seconds'
     and not exists(select 1 from public.orders b where b.assigned_teammate_id = r.user_id and b.status = 'in_progress');
$$;

-- Called by create_paid_order. Level at booking time; anything invalid means no window.
create function public.order_pick_start(p_order_id uuid, p_source uuid) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare o public.orders; v_teammate uuid;
begin
  select * into o from public.orders where id = p_order_id;
  if o.id is null or o.status <> 'queued' or p_source is null then return false; end if;
  if (public.loyalty_level(public.loyalty_valid_count(o.customer_id))->>'index')::integer < 4 then return false; end if;
  v_teammate := public.order_pick_candidate(o.customer_id, p_source, o.game, o.gg, o.voice, pg_catalog.clock_timestamp());
  if v_teammate is null then return false; end if;
  insert into public.order_teammate_picks(order_id, customer_id, teammate_id, source_order_id, queue_key, window_ends_at)
    values (o.id, o.customer_id, v_teammate, p_source, o.queued_at, o.queued_at + interval '60 seconds')
    on conflict (order_id) do nothing;
  return true;
end $$;

-- When the order enters the normal queue: queued_at, or for a picked order the end of the
-- 60-second window, or earlier when the teammate passed or went offline.
create function public.order_public_queued_at(p_order public.orders) returns timestamptz
language plpgsql stable security invoker set search_path = '' as $$
declare k public.order_teammate_picks; v_at timestamptz; v_online boolean; v_seen timestamptz;
begin
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

-- True while the order is exclusive to this teammate.
create function public.order_picked_for(p_order public.orders, p_user uuid) returns boolean
language sql stable security invoker set search_path = '' as $$
  select exists(select 1 from public.order_teammate_picks k
    where k.order_id = p_order.id and k.queue_key = p_order.queued_at and k.teammate_id = p_user)
    and public.order_public_queued_at(p_order) > pg_catalog.clock_timestamp();
$$;

-- Going offline (or a stale heartbeat seen at the next check-in) ends that teammate's open windows.
create function public.order_pick_presence_release() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_now timestamptz := pg_catalog.clock_timestamp(); v_off timestamptz;
begin
  if old.online and old.last_seen_at is not null
     and (not new.online or old.last_seen_at <= v_now - interval '20 seconds') then
    v_off := least(v_now, old.last_seen_at + interval '20 seconds');
    update public.order_teammate_picks k set released_at = greatest(k.created_at, v_off), release_reason = 'offline'
      from public.orders o
     where k.teammate_id = new.user_id and k.released_at is null and k.window_ends_at > v_off
       and o.id = k.order_id and o.status = 'queued' and o.queued_at = k.queue_key;
  end if;
  return null;
end $$;
create trigger teammate_presence_pick_release after update on public.teammate_presence
  for each row execute function public.order_pick_presence_release();

-- Picked teammate: pass on the order now; it goes to the normal queue at once.
create function public.teammate_pass_picked_order(p_order_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); o public.orders; k public.order_teammate_picks; v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if v_actor is null then return public.order_error(401, 'Authentication required.'); end if;
  if not exists(select 1 from public.account_roles r where r.user_id = v_actor and r.role = 'teammate') then
    return public.order_error(403, 'Teammate role required.');
  end if;
  select * into o from public.orders where id = p_order_id for update;
  select * into k from public.order_teammate_picks where order_id = o.id and queue_key = o.queued_at and teammate_id = v_actor for update;
  if o.id is null or k.order_id is null or o.status <> 'queued' then return public.order_error(404, 'Order not found.'); end if;
  if k.released_at is null and k.window_ends_at > v_now then
    update public.order_teammate_picks set released_at = v_now, release_reason = 'declined' where order_id = k.order_id;
  end if;
  return pg_catalog.jsonb_build_object('passed', true);
end $$;

-- Signed-in Diamond customer: teammates they can pick for this kind of order right now. The
-- handle is the customer's own latest completed order with that teammate, never a user id.
create function public.customer_pickable_teammates(p_game text, p_gg boolean, p_voice boolean) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if v_actor is null then return public.order_error(401, 'Authentication required.'); end if;
  if not exists(select 1 from public.account_roles r where r.user_id = v_actor and r.role = 'customer') then
    return public.order_error(403, 'Customer role required.');
  end if;
  if (public.loyalty_level(public.loyalty_valid_count(v_actor))->>'index')::integer < 4 then
    return pg_catalog.jsonb_build_object('eligible', false, 'teammates', '[]'::jsonb);
  end if;
  return pg_catalog.jsonb_build_object('eligible', true, 'teammates', coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('handle', x.source, 'name', p.name, 'image', p.image,
      'country', p.country, 'orders', x.n) order by x.n desc, p.name, x.source)
    from (select distinct on (s.assigned_teammate_id) s.assigned_teammate_id teammate, s.id source,
            pg_catalog.count(*) over (partition by s.assigned_teammate_id) n
          from public.orders s
         where s.customer_id = v_actor and s.status = 'completed' and s.admin_refunded_at is null
         order by s.assigned_teammate_id, s.completed_at desc, s.id) x
    join public.profiles p on p.id = x.teammate
   where public.order_pick_candidate(v_actor, x.source, p_game, coalesce(p_gg, false), coalesce(p_voice, false), v_now) is not null
  ), '[]'::jsonb));
end $$;

-- ---- perks 3 and 4: teammate priority delay ----------------------------------------------------

-- Order value before wallet and discounts: the server price plus the PRO or creator discount
-- recorded on its checkout intent.
create function public.order_list_eur_cents(p_order public.orders) returns integer
language sql stable security invoker set search_path = '' as $$
  select p_order.amount_eur_cents + coalesce((select i.first_order_discount_cents + i.pro_discount_cents
    from public.checkout_intents i where i.order_id = p_order.id), 0);
$$;

-- Seconds after the order enters the normal queue before this teammate sees it. Starts from the
-- existing 0..100 priority (base, adjustment, misses), then Elite and Legend get 10 seconds off
-- (never below 0) and teammates below Veteran wait 15 seconds more on orders of 20 EUR or more.
create function public.teammate_priority_delay(p_order public.orders, p_access public.teammate_order_access, p_now timestamptz)
returns integer
language plpgsql stable security invoker set search_path = '' as $$
declare v_delay integer; v_count bigint;
begin
  v_delay := greatest(0, least(100, p_access.priority_base
    - case when p_access.priority_adjustment_expires_at is null or p_access.priority_adjustment_expires_at > p_now
      then p_access.priority_adjustment else 0 end
    + public.priority_penalty(p_access.user_id, p_now)));
  v_count := public.payout_valid_count(p_access.user_id);
  if v_count >= 500 then v_delay := greatest(0, v_delay - 10); end if;
  if v_count < 250 and public.order_list_eur_cents(p_order) >= 2000 then v_delay := v_delay + 15; end if;
  return v_delay;
end $$;

-- When this teammate can first see the order.
create function public.order_visible_at(p_order public.orders, p_access public.teammate_order_access, p_now timestamptz)
returns timestamptz
language plpgsql stable security invoker set search_path = '' as $$
begin
  if exists(select 1 from public.order_teammate_picks k where k.order_id = p_order.id and k.queue_key = p_order.queued_at
              and k.teammate_id = p_access.user_id and k.release_reason is distinct from 'declined') then
    return p_order.queued_at;
  end if;
  return public.order_public_queued_at(p_order)
    + pg_catalog.make_interval(secs => public.teammate_priority_delay(p_order, p_access, p_now));
end $$;

revoke all on function public.free_coaching_month(timestamptz), public.free_coaching_service(text,text),
  public.order_is_free_perk(uuid), public.customer_perks_for(uuid), public.customer_perks(),
  public.free_coaching_return(), public.create_free_coaching_order(uuid),
  public.order_pick_candidate(uuid,uuid,text,boolean,boolean,timestamptz), public.order_pick_start(uuid,uuid),
  public.order_public_queued_at(public.orders), public.order_picked_for(public.orders,uuid),
  public.order_pick_presence_release(), public.teammate_pass_picked_order(uuid),
  public.customer_pickable_teammates(text,boolean,boolean), public.order_list_eur_cents(public.orders),
  public.teammate_priority_delay(public.orders,public.teammate_order_access,timestamptz),
  public.order_visible_at(public.orders,public.teammate_order_access,timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.customer_perks(), public.customer_pickable_teammates(text,boolean,boolean),
  public.teammate_pass_picked_order(uuid) to authenticated;
grant execute on function public.create_free_coaching_order(uuid) to service_role;

-- ---- replaced functions (live definitions plus the marked changes) -----------------------------

-- Change: the delay comes from order_visible_at (pick window, Veteran +15, Elite -10).
create or replace function public.order_eligible(p_order public.orders, p_actor uuid)
 returns boolean
 language sql
 set search_path to ''
as $function$
  select exists (select 1 from public.account_roles as r
    join public.teammate_order_access as a on a.user_id = r.user_id
    where r.user_id = p_actor and r.role = 'teammate' and not a.suspended
      and a.discord_id is not null and a.discord_verified_at is not null
      and p_order.customer_id <> p_actor
      and ((a.gg_access and p_order.gg) or (not a.gg_access and not p_order.gg and p_order.game = any(a.approved_games)))
      and public.order_visible_at(p_order, a, pg_catalog.clock_timestamp()) <= pg_catalog.clock_timestamp()
      and not exists (select 1 from public.order_assignments as h where h.order_id = p_order.id and h.teammate_id = p_actor and h.end_reason = 'customer_reroll'));
$function$;

-- Change: shown_at uses the same order_visible_at as the queue.
create or replace function public.order_expire_locked(p_id uuid)
 returns boolean
 language plpgsql
 set search_path to ''
as $function$
declare v public.orders; v_now timestamptz := pg_catalog.clock_timestamp();
begin
  select o.* into v from public.orders as o where o.id = p_id for update;
  if v.status = 'queued' and v.queued_at + interval '5 minutes' <= v_now then
    update public.orders set status = 'cancelled', cancelled_at = v_now, cancel_reason = 'queue_expired' where id = v.id;
    insert into public.order_misses(order_id, teammate_id, seen_sec, missed_at)
      select v.id, c.user_id, pg_catalog.floor(extract(epoch from v_now - c.shown_at))::integer, v_now
      from (
        select a.user_id,
               greatest(public.order_visible_at(v, a, v_now), pr.online_since) as shown_at
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
$function$;

-- Change: picked_for_you on each row; an exclusive order sorts first, then Gold/PRO as before.
create or replace function public.teammate_order_queue()
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_actor uuid := auth.uid(); v_result jsonb;
begin
  if v_actor is null then return public.order_error(401, 'Authentication required.'); end if;
  if not exists (select 1 from public.account_roles as r join public.teammate_order_access as a on a.user_id = r.user_id where r.user_id = v_actor and r.role = 'teammate' and a.discord_id is not null and a.discord_verified_at is not null and not a.suspended) then return public.order_error(403, 'Verified teammate access required.'); end if;
  perform public.order_sweep(100);
  select coalesce(pg_catalog.jsonb_agg(public.order_teammate_dto(q.o) || pg_catalog.jsonb_build_object('picked_for_you', q.picked)
      order by q.picked desc,q.head_start desc,q.queued_at desc,q.id), '[]'::jsonb) into v_result
    from (select o,public.order_picked_for(o,v_actor) picked,public.order_has_head_start(o.id) head_start,o.queued_at,o.id from public.orders o
      where o.status='queued' and o.queued_at+interval '5 minutes'>pg_catalog.clock_timestamp()
        and public.order_eligible(o,v_actor) and public.teammate_queue_personal_eligible(o,v_actor)
        and not exists(select 1 from public.orders busy where busy.assigned_teammate_id=v_actor and busy.status='in_progress')
      order by public.order_picked_for(o,v_actor) desc,public.order_has_head_start(o.id) desc,o.queued_at desc,o.id limit 100) q;
  return pg_catalog.jsonb_build_object('orders',v_result);
end;
$function$;

-- Change: a handover link cannot take an order out of another teammate's pick window.
create or replace function public.accept_handover(p_token_hash text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_h public.order_handovers;
  v_order public.orders;
  v_assignment uuid;
  v_now timestamptz;
begin
  if v_actor is null then return public.order_error(401, 'Please log in.'); end if;
  perform 1 from public.account_roles r where r.user_id = v_actor and r.role = 'teammate' for update;
  if not found then return public.order_error(403, 'Only teammates can use handover links.'); end if;
  perform 1 from public.teammate_order_access a
    where a.user_id = v_actor and not a.suspended
      and a.discord_id is not null and a.discord_verified_at is not null for share;
  if not found then return public.order_error(403, 'Verified teammate access required.'); end if;
  select h.* into v_h from public.order_handovers h where h.token_hash = p_token_hash for update;
  if v_h.id is null then return public.order_error(404, 'This handover link is not valid.'); end if;
  select o.* into v_order from public.orders o where o.id = v_h.order_id for update;
  if v_h.revoked_at is not null then
    if v_order.status = 'cancelled' then return public.order_error(410, 'This order was cancelled.'); end if;
    return public.order_error(409, 'Someone already took this order.');
  end if;
  if v_h.expires_at <= pg_catalog.clock_timestamp() or public.order_expire_locked(v_order.id) then
    return public.order_error(410, 'This handover link has expired.');
  end if;
  select o.* into v_order from public.orders o where o.id = v_order.id for update;
  if v_order.status <> 'queued' then return public.order_error(409, 'Someone already took this order.'); end if;
  if v_order.customer_id = v_actor then return public.order_error(409, 'You cannot take your own order.'); end if;
  if public.order_public_queued_at(v_order) > pg_catalog.clock_timestamp() and not public.order_picked_for(v_order, v_actor) then
    return public.order_error(409, 'This order is reserved for another teammate for a moment. Try again shortly.');
  end if;
  if not exists (
    select 1 from public.account_roles r
    join public.teammate_order_access a on a.user_id = r.user_id
    where r.user_id = v_actor and r.role = 'teammate' and not a.suspended
      and a.discord_id is not null and a.discord_verified_at is not null
      and ((a.gg_access and v_order.gg) or
        (not a.gg_access and not v_order.gg and v_order.game = any(a.approved_games)))) then
    return public.order_error(403, 'This order is outside your approved game access.');
  end if;
  -- the bot's link never gives the order back to a teammate the customer switched away from
  -- (the original: wasRerolled && handover !== 'admin'); an admin's link still can
  if v_h.kind = 'bot' and exists (select 1 from public.order_assignments a
       where a.order_id = v_order.id and a.teammate_id = v_actor and a.end_reason = 'customer_reroll') then
    return public.order_error(403, 'The customer switched away from you on this order, so it goes to another teammate.');
  end if;
  if exists (select 1 from public.orders o where o.assigned_teammate_id = v_actor and o.status = 'in_progress') then
    return public.order_error(409, 'Finish your current order first.');
  end if;
  v_now := pg_catalog.clock_timestamp();
  insert into public.order_assignments(order_id, teammate_id, accepted_at)
    values(v_order.id, v_actor, v_now) returning id into v_assignment;
  update public.orders set status = 'in_progress', assigned_teammate_id = v_actor,
      current_assignment_id = v_assignment, accepted_at = v_now
    where id = v_order.id and status = 'queued'
      and queued_at + interval '5 minutes' > pg_catalog.clock_timestamp()
    returning * into v_order;
  if not found then
    delete from public.order_assignments where id = v_assignment;
    perform public.order_expire_locked(v_h.order_id);
    return public.order_error(410, 'This handover link has expired.');
  end if;
  return pg_catalog.jsonb_build_object('order', public.order_teammate_dto(v_order));
end;
$function$;

-- Change: the post delay counts from order_public_queued_at (never inside a pick window).
create or replace function public.discord_order_posts_due(p_after_seconds integer default 100)
 returns jsonb
 language sql
 stable security definer
 set search_path to ''
as $function$
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id', o.id, 'reference', o.public_reference, 'game', o.game, 'title', o.title,
    'units', o.units, 'unit', o.unit, 'rank', o.rank, 'region', o.region, 'voice', o.voice,
    'gg', o.gg, 'payoutUsdCents', o.payout_usd_cents,
    'queuedAt', o.queued_at, 'cancelsAt', o.queued_at + interval '5 minutes'
  ) order by o.queued_at), '[]'::jsonb)
  from public.orders o
  where o.status = 'queued'
    and public.order_public_queued_at(o) <= pg_catalog.clock_timestamp() - pg_catalog.make_interval(secs => greatest(p_after_seconds, 0))
    -- leave 20 seconds so nobody gets pinged for a link that is about to die
    and o.queued_at + interval '5 minutes' > pg_catalog.clock_timestamp() + interval '20 seconds'
    and not exists (
      select 1 from public.discord_order_posts d
       where d.order_id = o.id and d.queue_key = o.queued_at
         and (d.state <> 'posting' or d.created_at > pg_catalog.clock_timestamp() - interval '1 minute')
    );
$function$;

-- Change: refuses to post while the order is still exclusive to a picked teammate.
create or replace function public.discord_order_post_claim(p_order_id uuid, p_queue_key timestamp with time zone, p_channel_id text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_order public.orders; v_post uuid; v_token text; v_hash text;
begin
  if p_channel_id is null or p_channel_id !~ '^[0-9]{17,20}$' then return null; end if;
  select o.* into v_order from public.orders o where o.id = p_order_id for update;
  if v_order.id is null or v_order.status <> 'queued' or v_order.queued_at is distinct from p_queue_key
     or v_order.queued_at + interval '5 minutes' <= pg_catalog.clock_timestamp() + interval '20 seconds'
     or public.order_public_queued_at(v_order) > pg_catalog.clock_timestamp() then
    return null;
  end if;
  -- a reservation whose Discord call died more than a minute ago may be retried
  delete from public.discord_order_posts
   where order_id = p_order_id and queue_key = p_queue_key and state = 'posting'
     and created_at <= pg_catalog.clock_timestamp() - interval '1 minute';
  insert into public.discord_order_posts(order_id, queue_key, channel_id)
    values (p_order_id, p_queue_key, p_channel_id)
    on conflict (order_id, queue_key) do nothing
    returning id into v_post;
  if v_post is null then return null; end if;
  update public.order_handovers set revoked_at = pg_catalog.clock_timestamp(), revoke_reason = 'replaced'
    where order_id = p_order_id and kind = 'bot' and revoked_at is null;
  v_token := pg_catalog.rtrim(pg_catalog.translate(pg_catalog.encode(extensions.gen_random_bytes(18), 'base64'), '+/', '-_'), '=');
  v_hash := pg_catalog.encode(extensions.digest(v_token, 'sha256'), 'hex');
  insert into public.order_handovers(order_id, token_hash, kind, created_by, created_by_name, expires_at)
    values (p_order_id, v_hash, 'bot', null, 'Duoly bot', v_order.queued_at + interval '5 minutes');
  return pg_catalog.jsonb_build_object('post', v_post, 'token', v_token);
end;
$function$;

-- Changes: payment state 'free' for a free coaching intent (no payment row, a claim instead),
-- and the pick window starts when the intent names a teammate.
create or replace function public.create_paid_order(p_intent_id uuid, p_payment_intent text, p_amount_minor integer, p_currency text, p_method text, p_state text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare i public.checkout_intents; p public.profiles; v_order uuid; v_held bigint; h public.wallet_entries;
  v_free jsonb; v_count bigint;
begin
  if p_state not in ('authorized','captured','wallet','free') then raise exception 'invalid payment state'; end if;
  select * into i from public.checkout_intents where id = p_intent_id for update;
  if i.id is null then return pg_catalog.jsonb_build_object('error', 'unknown_intent'); end if;
  if i.order_id is not null then
    return pg_catalog.jsonb_build_object('order_id', i.order_id, 'created', false);
  end if;
  if i.status = 'conflict' then return pg_catalog.jsonb_build_object('conflict', true); end if;
  -- A card payment needs a card part; a wallet-only order needs the wallet to cover everything.
  -- A free coaching order has neither and only comes from a free coaching intent.
  if (p_state = 'wallet') <> (i.wallet_eur_cents = i.amount_eur_cents)
     or (p_state in ('wallet','free')) <> (p_payment_intent is null)
     or (p_state = 'free') <> i.free_coaching
     or (p_state in ('wallet','free') and (p_amount_minor <> 0 or pg_catalog.lower(p_currency) <> 'eur'))
     or (p_state not in ('wallet','free') and pg_catalog.lower(p_currency) = 'eur'
       and p_amount_minor <> i.amount_eur_cents - i.wallet_eur_cents) then
    return pg_catalog.jsonb_build_object('error', 'payment_mismatch');
  end if;
  -- Serialize per customer, then enforce one open order.
  perform 1 from public.profiles where id = i.customer_id for update;
  perform public.order_sweep(100);
  select coalesce(-pg_catalog.sum(h2.amount_eur_cents),0) into v_held from public.checkout_open_holds(i.id) as h2;
  if exists (select 1 from public.orders where customer_id = i.customer_id and status in ('queued','in_progress'))
     or v_held <> i.wallet_eur_cents then
    perform public.checkout_release_wallet(i.id, 'conflict');
    update public.checkout_intents set status = 'conflict', stripe_payment_intent_id = p_payment_intent,
      updated_at = pg_catalog.clock_timestamp() where id = i.id;
    return pg_catalog.jsonb_build_object('conflict', true);
  end if;
  -- Free monthly coaching: Platinum or Diamond at booking time, one used claim per Vienna month,
  -- a training service of exactly one unit (1 hour, or 1 game for Play and Learn).
  if p_state = 'free' then
    v_free := public.customer_perks_for(i.customer_id);
    if not public.free_coaching_service(i.game, i.service) or i.units <> 1 or i.gg
       or not coalesce((v_free->'freeCoaching'->>'available')::boolean, false) then
      update public.checkout_intents set status = 'failed', updated_at = pg_catalog.clock_timestamp() where id = i.id and status = 'open';
      return pg_catalog.jsonb_build_object('error', 'free_perk_unavailable',
        'reason', case when not coalesce((v_free->'freeCoaching'->>'eligible')::boolean, false) then 'level'
                       when coalesce((v_free->'freeCoaching'->>'used')::boolean, false) then 'used' else 'service' end);
    end if;
    v_count := public.loyalty_valid_count(i.customer_id);
  end if;
  select * into p from public.profiles where id = i.customer_id;
  insert into public.orders(customer_id, game, service, title, units, unit, gg, rank, region, ign, note, voice,
      customer_name, customer_image, customer_country, amount_eur_cents, booking_fx, payout_usd_cents, wallet_eur_cents)
    values (i.customer_id, i.game, i.service, i.title, i.units, i.unit, i.gg, i.rank, i.region, i.ign, i.note, i.voice,
      pg_catalog.left(coalesce(nullif(pg_catalog.btrim(p.name), ''), 'Player'), 40),
      case when p.image ~ '^/assets/avatars/avatar-([1-9]|10)\.png$' then p.image else '' end,
      case when pg_catalog.lower(p.country) ~ '^[a-z]{2}$' then pg_catalog.lower(p.country) else '' end,
      i.amount_eur_cents, i.booking_fx, i.payout_usd_cents, i.wallet_eur_cents)
    returning id into v_order;
  if p_state not in ('wallet','free') then
    insert into public.order_payments(order_id, intent_id, stripe_payment_intent_id, amount_minor, currency,
        amount_eur_cents, payment_method_type, state)
      values (v_order, i.id, p_payment_intent, p_amount_minor, pg_catalog.lower(p_currency),
        i.amount_eur_cents - i.wallet_eur_cents, pg_catalog.left(coalesce(p_method, ''), 40), p_state);
  end if;
  if p_state = 'free' then
    insert into public.free_coaching_claims(customer_id, month, intent_id, order_id, loyalty_level, prior_completed_count, list_eur_cents)
      values (i.customer_id, public.free_coaching_month(pg_catalog.clock_timestamp()), i.id, v_order,
        v_free->>'level', v_count, i.amount_eur_cents);
  end if;
  for h in select * from public.checkout_open_holds(i.id) loop
    insert into public.wallet_entries(customer_id, amount_eur_cents, kind, cashable, order_id, checkout_intent_id, reverses_id, reason)
      values (h.customer_id, -h.amount_eur_cents, 'checkout_release', h.cashable, v_order, i.id, h.id, 'Hold used for order');
    insert into public.wallet_entries(customer_id, amount_eur_cents, kind, cashable, order_id, checkout_intent_id, reason)
      values (h.customer_id, h.amount_eur_cents, 'checkout_spend', h.cashable, v_order, i.id, 'Paid for order');
  end loop;
  if i.pick_source_order_id is not null then
    perform public.order_pick_start(v_order, i.pick_source_order_id);
  end if;
  update public.checkout_intents set status = 'paid', order_id = v_order, stripe_payment_intent_id = p_payment_intent,
    updated_at = pg_catalog.clock_timestamp() where id = i.id;
  return pg_catalog.jsonb_build_object('order_id', v_order, 'created', true);
end $function$;

-- Change: a cancelled free coaching order was never paid, so it creates no refund credit.
create or replace function public.order_post_refund()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
begin
  if new.status = 'cancelled' and new.wallet_eur_cents = 0
     and not exists (select 1 from public.order_payments as p where p.order_id = new.id)
     and not exists (select 1 from public.free_coaching_claims as f where f.order_id = new.id) then
    insert into public.refund_credits(order_id, customer_id, kind, amount_eur_cents)
      values(new.id, new.customer_id, 'queued_refund', new.amount_eur_cents)
      on conflict (order_id, kind) do nothing;
  end if;
  return new;
end;
$function$;

-- Change: a free coaching order never counts for a creator.
create or replace function public.checkout_intent_attribute()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_ref public.customer_referrals; v_order public.orders;
begin
  if new.status <> 'paid' or old.status = 'paid' or new.order_id is null then return null; end if;
  if new.free_coaching then return null; end if;
  begin
    select o.* into v_order from public.orders as o where o.id = new.order_id;
    select r.* into v_ref from public.customer_referrals as r where r.customer_id = new.customer_id;
    if v_ref.customer_id is null and new.creator_id is not null
       and exists (select 1 from public.creators as c
                    where c.id = new.creator_id and c.code = new.ref_code and c.active)
       and not exists (select 1 from public.orders as o where o.customer_id = new.customer_id and o.id <> new.order_id) then
      insert into public.customer_referrals(customer_id, creator_id, code, first_order_id)
        values (new.customer_id, new.creator_id, new.ref_code, new.order_id)
        on conflict (customer_id) do nothing;
      select r.* into v_ref from public.customer_referrals as r where r.customer_id = new.customer_id;
    end if;
    if v_ref.customer_id is not null and v_order.created_at < v_ref.attributed_at + interval '12 months' then
      insert into public.order_referrals(order_id, creator_id, customer_id, amount_eur_cents)
        values (new.order_id, v_ref.creator_id, new.customer_id, v_order.amount_eur_cents)
        on conflict (order_id) do nothing;
    end if;
  exception when others then
    -- A referral problem must never undo a paid order.
    raise warning 'creator attribution skipped for order %: %', new.order_id, sqlerrm;
  end;
  return null;
end;
$function$;

-- Change: an admin refund of a free coaching order moves no money and gives the perk back.
create or replace function public.admin_refund_order(p_order_id uuid, p_reason text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_actor uuid; v_actor_name text; v_order public.orders; v_payment public.order_payments; v_reason text := pg_catalog.btrim(coalesce(p_reason,''));
begin
  select id,name into v_actor,v_actor_name from public.admin_caller();
  if v_actor is null then return public.order_error(403, 'Admins only.'); end if;
  if pg_catalog.char_length(v_reason) not between 3 and 200 then return public.order_error(400, 'Add a reason. It goes into the audit log.'); end if;
  select o.* into v_order from public.orders o where o.id = p_order_id for update;
  if v_order.id is null then return public.order_error(404, 'Order not found.'); end if;
  if v_order.status not in ('in_progress','completed') then return public.order_error(409, 'Only accepted or completed orders can be refunded.'); end if;
  select p.* into v_payment from public.order_payments p where p.order_id = v_order.id for update;
  if v_payment.order_id is null then
    if v_order.wallet_eur_cents = 0 and not public.order_is_free_perk(v_order.id) then return public.order_error(409, 'This order has no Stripe payment to refund.'); end if;
    if v_order.admin_refunded_at is not null then return pg_catalog.jsonb_build_object('orderId',v_order.id,'paymentState','refunded'); end if;
    update public.orders set admin_refunded_at=pg_catalog.clock_timestamp(),admin_refund_reason=v_reason where id=v_order.id;
    perform public.admin_log(v_actor, v_actor_name, 'Refunded order', v_order.public_reference,
      case when v_order.wallet_eur_cents = 0 then pg_catalog.concat('Free monthly coaching given back · ', v_reason)
      else pg_catalog.concat('€', pg_catalog.to_char(v_order.amount_eur_cents / 100.0, 'FM999999990.00'), ' to Duoly balance · ', v_reason) end);
    return pg_catalog.jsonb_build_object('orderId',v_order.id,'paymentState','refunded');
  end if;
  if v_payment.state = 'refunded' then return pg_catalog.jsonb_build_object('orderId',v_order.id,'paymentState','refunded'); end if;
  if v_payment.state not in ('authorized','captured','capture_failed') then return public.order_error(409, 'This payment cannot be refunded right now.'); end if;
  update public.orders set admin_refunded_at=pg_catalog.clock_timestamp(),admin_refund_reason=v_reason where id=v_order.id;
  update public.order_payments set settle='refund',refund_reason=v_reason,updated_at=pg_catalog.clock_timestamp() where order_id=v_order.id;
  perform public.admin_log(v_actor, v_actor_name, 'Refunded order', v_order.public_reference,
    pg_catalog.concat('€', pg_catalog.to_char(v_order.amount_eur_cents / 100.0, 'FM999999990.00'), ' · ', v_reason));
  return pg_catalog.jsonb_build_object('orderId',v_order.id,'paymentState','refund_pending');
end;
$function$;

-- Changes: a free coaching order completes without a Stripe payment (Duoly pays the normal
-- payout), and the trust count is payout_valid_count (same rule, plus free coaching orders).
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

-- Change: free coaching orders count like paid ones unless an admin refunded them.
create or replace function public.payout_valid_count(p_teammate uuid)
 returns bigint
 language sql
 stable security definer
 set search_path to ''
as $function$
  select pg_catalog.count(*) from public.teammate_earning_entries e left join public.order_payments p on p.order_id=e.order_id
   where e.teammate_id=p_teammate
     and ((p.order_id is not null and p.state<>'refunded')
       or (p.order_id is null and exists(select 1 from public.free_coaching_claims f where f.order_id=e.order_id)
           and not exists(select 1 from public.orders o where o.id=e.order_id and o.admin_refunded_at is not null)))
     and not exists(select 1 from public.stripe_disputes d where d.order_id=e.order_id);
$function$;

-- Change: the trust count is payout_valid_count (identical for paid orders).
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

-- Change: free coaching orders do not count towards the customer's loyalty level.
create or replace function public.loyalty_valid_count(p_customer uuid, p_before_at timestamp with time zone default null::timestamp with time zone, p_before_id uuid default null::uuid)
 returns bigint
 language sql
 stable security definer
 set search_path to ''
as $function$
  select pg_catalog.count(*) from public.orders o
   where o.customer_id=p_customer and o.status='completed'
     and (p_before_at is null or (o.completed_at,o.id)<(p_before_at,p_before_id))
     and not public.loyalty_order_refunded(o.id)
     and not exists(select 1 from public.free_coaching_claims f where f.order_id=o.id)
$function$;

-- Change: a free coaching order gets no cashback row.
create or replace function public.loyalty_after_order_completed()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_prior bigint; v_level jsonb;
begin
  if public.order_is_free_perk(new.id) then return new; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.customer_id::text,714));
  v_prior:=public.loyalty_valid_count(new.customer_id,new.completed_at,new.id);
  v_level:=public.loyalty_level(v_prior);
  insert into public.loyalty_cashbacks(order_id,customer_id,completed_at,prior_completed_count,level,cashback_percent,credit_at,reason)
    values(new.id,new.customer_id,new.completed_at,v_prior,v_level->>'id',(v_level->>'cashback')::integer,
      new.completed_at+interval '14 days','Credited 14 days after completion')
    on conflict (order_id) do nothing;
  perform public.loyalty_grant_gifts(new.customer_id,new.id);
  return new;
end $function$;

-- Change: free_perk tells the customer screens this order was free.
create or replace function public.order_customer_dto(p_order public.orders)
 returns jsonb
 language sql
 stable
 set search_path to ''
as $function$
  select pg_catalog.jsonb_build_object(
    'id',p_order.id,'public_reference',p_order.public_reference,'status',p_order.status,
    'game',p_order.game,'service',p_order.service,'title',p_order.title,'units',p_order.units,'unit',p_order.unit,'gg',p_order.gg,
    'rank',p_order.rank,'region',p_order.region,'ign',p_order.ign,'note',p_order.note,'voice',p_order.voice,
    'amount_eur_cents',p_order.amount_eur_cents,'created_at',p_order.created_at,'queued_at',p_order.queued_at,
    'accepted_at',p_order.accepted_at,'completed_at',p_order.completed_at,'cancelled_at',p_order.cancelled_at,
    'cancel_reason',p_order.cancel_reason,'rerolls',p_order.rerolls,'current_assignment_id',p_order.current_assignment_id,
    'teammate',(select pg_catalog.jsonb_build_object('name',p.name,'image',p.image,'country',p.country,'bio',p.bio,
      'languages',pg_catalog.to_jsonb(p.languages),'trust_badge',public.teammate_trust_badge(p.id)) from public.profiles p where p.id=p_order.assigned_teammate_id),
    'review',(select public.order_review_dto(r) from public.order_reviews r where r.order_id=p_order.id),
    'tip',(select public.tip_dto(t) from public.order_tips t where t.order_id=p_order.id),
    'reports',coalesce((select pg_catalog.jsonb_agg(public.order_report_customer_dto(r) order by r.created_at) from public.order_reports r where r.order_id=p_order.id and r.customer_id=p_order.customer_id),'[]'::jsonb),
    'free_perk',public.order_is_free_perk(p_order.id));
$function$;

-- Change: perks (free coaching this month, pick a teammate) for the Rewards card.
create or replace function public.customer_rewards()
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
declare v_actor uuid:=auth.uid(); v_month timestamptz;
begin
  if v_actor is null then return public.order_error(401,'Authentication required.'); end if;
  if not exists(select 1 from public.account_roles r where r.user_id=v_actor and r.role='customer') then return public.order_error(403,'Customer role required.'); end if;
  v_month:=pg_catalog.date_trunc('month',pg_catalog.clock_timestamp() at time zone 'Europe/Vienna') at time zone 'Europe/Vienna';
  return public.loyalty_summary(v_actor)||pg_catalog.jsonb_build_object(
    'cashback',pg_catalog.jsonb_build_object(
      'earnedEurCents',coalesce((select pg_catalog.sum(e.amount_eur_cents) from public.wallet_entries e where e.customer_id=v_actor and e.kind in ('cashback','cashback_reversal')),0),
      'monthEurCents',coalesce((select pg_catalog.sum(e.amount_eur_cents) from public.wallet_entries e where e.customer_id=v_actor and e.kind in ('cashback','cashback_reversal') and e.created_at>=v_month),0),
      'pendingEurCents',coalesce((select pg_catalog.sum((public.loyalty_card_paid_cents(c.order_id)*c.cashback_percent+50)/100) from public.loyalty_cashbacks c where c.customer_id=v_actor and c.state in ('pending','blocked')),0),
      'pendingOrders',(select pg_catalog.count(*) from public.loyalty_cashbacks c where c.customer_id=v_actor and c.state in ('pending','blocked'))),
    'gifts',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('level',g.level,'amountEurCents',g.amount_eur_cents,'grantedAt',g.granted_at) order by g.granted_at,g.level)
      from public.loyalty_level_gifts g where g.customer_id=v_actor),'[]'::jsonb),
    'cashbackOrders',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('orderId',q.order_id,'state',q.state,'percent',q.cashback_percent,
        'amountEurCents',case when q.state in ('pending','blocked') then (public.loyalty_card_paid_cents(q.order_id)*q.cashback_percent+50)/100 else coalesce(q.amount_eur_cents,0) end,
        'creditAt',q.credit_at) order by q.completed_at desc)
      from (select c.* from public.loyalty_cashbacks c where c.customer_id=v_actor order by c.completed_at desc limit 100) q),'[]'::jsonb),
    'perks',public.customer_perks_for(v_actor));
end $function$;

-- Grants exactly as live (CREATE OR REPLACE keeps them; restated so a fresh database matches).
revoke all on function public.order_eligible(public.orders,uuid), public.order_expire_locked(uuid),
  public.teammate_order_queue(), public.accept_handover(text), public.discord_order_posts_due(integer),
  public.discord_order_post_claim(uuid,timestamptz,text), public.create_paid_order(uuid,text,integer,text,text,text),
  public.order_post_refund(), public.checkout_intent_attribute(), public.admin_refund_order(uuid,text),
  public.complete_order(uuid,uuid,uuid[],uuid), public.payout_valid_count(uuid), public.teammate_stats(),
  public.loyalty_valid_count(uuid,timestamptz,uuid), public.loyalty_after_order_completed(),
  public.order_customer_dto(public.orders), public.customer_rewards()
  from public, anon, authenticated, service_role;
grant execute on function public.teammate_order_queue(), public.accept_handover(text), public.admin_refund_order(uuid,text),
  public.complete_order(uuid,uuid,uuid[],uuid), public.teammate_stats(), public.customer_rewards() to authenticated;
grant execute on function public.discord_order_posts_due(integer), public.discord_order_post_claim(uuid,timestamptz,text),
  public.create_paid_order(uuid,text,integer,text,text,text) to service_role;

commit;
