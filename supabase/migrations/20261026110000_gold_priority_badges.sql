-- Gold priority matching and teammate trust badges (M7; ledger #37 and #13; MONEY-RULES P2 and D5).
--
-- P2: snapshot the customer's loyalty level each time an order enters the queue. Gold, Platinum and
-- Diamond orders sort before lower-level orders in the existing teammate queue. The existing teammate
-- priority delay still decides when each teammate can see each order. No order is permanently hidden,
-- and price and teammate pay calculations are unchanged.
--
-- D5: expose only the customer-safe Trusted badge (100 to 999 valid completions) or Legend badge
-- (1000+) on the teammate object already returned to that order's customer. The count is the same D4
-- count used by teammate_stats(): refunded and disputed completed orders do not count.
--
-- create or replace targets start from their latest definitions on origin/main (3df96b2):
--   teammate_order_queue  20261024210000_queue_settings.sql
--   order_customer_dto    20261026100000_order_tips.sql
-- Deploy order: code first, then this migration. The code accepts the new optional DTO key; deploying
-- the migration first would make the old strict response schema reject customer order responses.
begin;

create table public.order_priority_boosts (
  order_id uuid primary key references public.orders(id) on delete cascade,
  customer_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (reason = 'loyalty_gold'),
  customer_level text not null check (customer_level in ('gold','platinum','diamond')),
  prior_completed_count bigint not null check (prior_completed_count >= 250),
  queued_at timestamptz not null,
  created_at timestamptz not null default pg_catalog.clock_timestamp()
);
alter table public.order_priority_boosts enable row level security;
revoke all on table public.order_priority_boosts from public, anon, authenticated, service_role;

-- Snapshot the level before this queued order. The order itself is not completed, so loyalty_valid_count
-- is the customer's valid completed count immediately before the order enters the queue.
create function public.order_priority_boost_snapshot() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_count bigint; v_level jsonb;
begin
  if new.status <> 'queued' then return new; end if;
  v_count := public.loyalty_valid_count(new.customer_id);
  v_level := public.loyalty_level(v_count);
  if (v_level->>'index')::integer >= 2 then
    insert into public.order_priority_boosts(order_id,customer_id,reason,customer_level,prior_completed_count,queued_at)
      values(new.id,new.customer_id,'loyalty_gold',v_level->>'id',v_count,new.queued_at)
      on conflict(order_id) do update set customer_id=excluded.customer_id,
        customer_level=excluded.customer_level,prior_completed_count=excluded.prior_completed_count,
        queued_at=excluded.queued_at,created_at=pg_catalog.clock_timestamp();
  else
    delete from public.order_priority_boosts where order_id=new.id;
  end if;
  return new;
end;
$$;
revoke all on function public.order_priority_boost_snapshot() from public, anon, authenticated, service_role;

create trigger orders_priority_boost_insert after insert on public.orders
  for each row when (new.status='queued') execute function public.order_priority_boost_snapshot();
create trigger orders_priority_boost_requeue after update of status,queued_at on public.orders
  for each row when (new.status='queued' and (new.status is distinct from old.status or new.queued_at is distinct from old.queued_at))
  execute function public.order_priority_boost_snapshot();

create function public.order_has_head_start(p_order_id uuid) returns boolean
language sql stable security invoker set search_path = '' as $$
  select exists(select 1 from public.order_priority_boosts b where b.order_id=p_order_id);
$$;
revoke all on function public.order_has_head_start(uuid) from public, anon, authenticated, service_role;

-- Latest definition from 20261024210000_queue_settings.sql. Only ordering changes: eligible Gold+
-- snapshots come first, then the previous newest-first order. Eligibility and its priority delay stay live.
create or replace function public.teammate_order_queue() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_result jsonb;
begin
  if v_actor is null then return public.order_error(401, 'Authentication required.'); end if;
  if not exists (select 1 from public.account_roles as r join public.teammate_order_access as a on a.user_id = r.user_id where r.user_id = v_actor and r.role = 'teammate' and a.discord_id is not null and a.discord_verified_at is not null and not a.suspended) then return public.order_error(403, 'Verified teammate access required.'); end if;
  perform public.order_sweep(100);
  select coalesce(pg_catalog.jsonb_agg(public.order_teammate_dto(q.o) order by q.head_start desc,q.queued_at desc,q.id), '[]'::jsonb) into v_result
    from (select o,public.order_has_head_start(o.id) head_start,o.queued_at,o.id from public.orders o
      where o.status='queued' and o.queued_at+interval '5 minutes'>pg_catalog.clock_timestamp()
        and public.order_eligible(o,v_actor) and public.teammate_queue_personal_eligible(o,v_actor)
        and not exists(select 1 from public.orders busy where busy.assigned_teammate_id=v_actor and busy.status='in_progress')
      order by public.order_has_head_start(o.id) desc,o.queued_at desc,o.id limit 100) q;
  return pg_catalog.jsonb_build_object('orders',v_result);
end;
$$;

-- Customer-safe badge only. Veteran and Elite keep the Trusted badge because their matching perks are
-- still coming soon; Legend replaces it at 1000 valid completions.
create function public.teammate_trust_badge(p_user uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when n>=1000 then pg_catalog.jsonb_build_object('id','legend','name','Legend')
              when n>=100 then pg_catalog.jsonb_build_object('id','trusted','name','Trusted')
              else null end
  from (select public.payout_valid_count(p_user) n) x;
$$;
revoke all on function public.teammate_trust_badge(uuid) from public, anon, authenticated, service_role;

-- Latest definition from 20261026100000_order_tips.sql. Only teammate.trust_badge is added; the tip,
-- review, reports, bio and languages fields from later migrations are preserved.
create or replace function public.order_customer_dto(p_order public.orders) returns jsonb
language sql stable security invoker set search_path='' as $$
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
    'reports',coalesce((select pg_catalog.jsonb_agg(public.order_report_customer_dto(r) order by r.created_at) from public.order_reports r where r.order_id=p_order.id and r.customer_id=p_order.customer_id),'[]'::jsonb));
$$;

commit;
