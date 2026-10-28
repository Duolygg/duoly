-- Loyalty levels, cashback and level-up gifts (#12, MONEY-RULES L1 to L5, P1).
-- Fabian's levels (lib/rewards.js): Bronze 0, Silver 100, Gold 250, Platinum 500, Diamond 1000
-- completed orders; cashback 1/2/3/5/7 percent; one-off gifts 0/5/15/40/100 EUR. All promo.
-- L1 level for an order's cashback = level from the customer's valid completed orders BEFORE it.
-- L2 cashback only on the card-paid part: Stripe amount minus any wallet checkout_spend on the order.
-- L3 refund or lost dispute after crediting writes one cashback_reversal (promo floored at 0, shortfall
--    recorded); level gifts stay.
-- L4 gifts are granted automatically, once per customer and level, when the count reaches the level.
-- L5 cashback is credited 14 days after completion by pg_cron, never while the order is refunded or
--    has an open or lost Stripe dispute.
-- Works through triggers only: complete_order, checkout and cancel or refund functions are untouched.
-- Deploy order: apply this migration first (code reads customer_rewards() and admin_customers().loyalty
-- and degrades to "no rewards data" until it exists), then deploy the code.
begin;

create extension if not exists pg_cron with schema pg_catalog;

create function public.loyalty_levels()
returns table(idx integer, id text, name text, from_count integer, cashback_percent integer, gift_eur_cents integer)
language sql immutable security invoker set search_path='' as $$
  values (0,'bronze','Bronze',0,1,0),(1,'silver','Silver',100,2,500),(2,'gold','Gold',250,3,1500),
         (3,'platinum','Platinum',500,5,4000),(4,'diamond','Diamond',1000,7,10000)
$$;

create function public.loyalty_level(p_count bigint) returns jsonb
language sql immutable security invoker set search_path='' as $$
  select pg_catalog.jsonb_build_object('index',l.idx,'id',l.id,'name',l.name,'from',l.from_count,
    'cashback',l.cashback_percent,'giftEurCents',l.gift_eur_cents)
  from public.loyalty_levels() l where l.from_count<=greatest(coalesce(p_count,0),0) order by l.from_count desc limit 1
$$;

-- An order is refunded for loyalty once an admin refund was requested, Stripe reports the payment
-- refunded, or a wallet refund entry exists for the completed order (future wallet-paid refunds).
create function public.loyalty_order_refunded(p_order_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.orders o where o.id=p_order_id and o.admin_refunded_at is not null)
      or exists(select 1 from public.order_payments p where p.order_id=p_order_id and p.state='refunded')
      or exists(select 1 from public.wallet_entries e join public.orders o on o.id=e.order_id
                 where e.order_id=p_order_id and e.kind='refund' and o.status='completed')
$$;

-- 'lost', 'open' or null. Won and closed warnings do not block.
create function public.loyalty_order_dispute(p_order_id uuid) returns text
language sql stable security definer set search_path='' as $$
  select case
    when exists(select 1 from public.stripe_disputes d where d.order_id=p_order_id and d.status='lost') then 'lost'
    when exists(select 1 from public.stripe_disputes d where d.order_id=p_order_id
                 and d.status in ('warning_needs_response','warning_under_review','needs_response','under_review')) then 'open'
  end
$$;

-- Valid completed orders count towards the level: completed and not refunded.
-- Stripe disputes can delay or cancel cashback, but L1 levels count every unrefunded completion.
-- With p_before set, only orders completed strictly before that (completed_at, id) position count.
create function public.loyalty_valid_count(p_customer uuid,p_before_at timestamptz default null,p_before_id uuid default null)
returns bigint language sql stable security definer set search_path='' as $$
  select pg_catalog.count(*) from public.orders o
   where o.customer_id=p_customer and o.status='completed'
     and (p_before_at is null or (o.completed_at,o.id)<(p_before_at,p_before_id))
     and not public.loyalty_order_refunded(o.id)
$$;

-- L2: card-paid EUR cents. No Stripe payment means nothing was paid by card. Wallet money spent on
-- the order (checkout_spend entries, written by checkout from M4 on) never earns cashback.
create function public.loyalty_card_paid_cents(p_order_id uuid) returns integer
language sql stable security definer set search_path='' as $$
  select coalesce((select greatest(0,least(p.amount_eur_cents,
      o.amount_eur_cents-coalesce((select -pg_catalog.sum(e.amount_eur_cents) from public.wallet_entries e
                                   where e.order_id=o.id and e.kind='checkout_spend'),0)))::integer
    from public.orders o join public.order_payments p on p.order_id=o.id where o.id=p_order_id),0)
$$;

create table public.loyalty_cashbacks (
  order_id uuid primary key references public.orders(id) on delete restrict,
  customer_id uuid not null references public.profiles(id) on delete restrict,
  completed_at timestamptz not null,
  prior_completed_count integer not null check (prior_completed_count>=0),
  level text not null check (level in ('bronze','silver','gold','platinum','diamond')),
  cashback_percent integer not null check (cashback_percent in (1,2,3,5,7)),
  credit_at timestamptz not null,
  state text not null default 'pending' check (state in ('pending','blocked','credited','cancelled','reversed')),
  reason text not null check (pg_catalog.char_length(reason) between 1 and 200),
  card_paid_eur_cents integer check (card_paid_eur_cents>=0),
  amount_eur_cents integer check (amount_eur_cents>=0),
  credit_entry_id uuid unique references public.wallet_entries(id) on delete restrict,
  reversal_entry_id uuid unique references public.wallet_entries(id) on delete restrict,
  reversed_eur_cents integer check (reversed_eur_cents>=0),
  reversal_shortfall_eur_cents integer check (reversal_shortfall_eur_cents>=0),
  credited_at timestamptz,
  cancelled_at timestamptz,
  reversed_at timestamptz,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  check (credit_at=completed_at+interval '14 days'),
  check ((level,cashback_percent) in (('bronze',1),('silver',2),('gold',3),('platinum',5),('diamond',7))),
  check ((state in ('credited','reversed'))=(credited_at is not null and credit_entry_id is not null and amount_eur_cents>0)),
  check ((state='cancelled')=(cancelled_at is not null)),
  check ((state='reversed')=(reversed_at is not null and reversed_eur_cents is not null and reversal_shortfall_eur_cents is not null
    and reversed_eur_cents+reversal_shortfall_eur_cents=amount_eur_cents)),
  check (reversal_entry_id is null or (state='reversed' and reversed_eur_cents>0))
);
create index loyalty_cashbacks_due on public.loyalty_cashbacks(credit_at,order_id) where state in ('pending','blocked');
create index loyalty_cashbacks_customer on public.loyalty_cashbacks(customer_id,completed_at desc);
alter table public.loyalty_cashbacks enable row level security;
revoke all on table public.loyalty_cashbacks from public,anon,authenticated,service_role;

create table public.loyalty_level_gifts (
  customer_id uuid not null references public.profiles(id) on delete restrict,
  level text not null check (level in ('silver','gold','platinum','diamond')),
  amount_eur_cents integer not null check ((level,amount_eur_cents) in (('silver',500),('gold',1500),('platinum',4000),('diamond',10000))),
  order_id uuid references public.orders(id) on delete restrict,
  wallet_entry_id uuid not null unique references public.wallet_entries(id) on delete restrict deferrable initially deferred,
  granted_at timestamptz not null default pg_catalog.clock_timestamp(),
  primary key (customer_id,level)
);
alter table public.loyalty_level_gifts enable row level security;
revoke all on table public.loyalty_level_gifts from public,anon,authenticated,service_role;

-- One cashback and at most one reversal per order in the wallet ledger.
create unique index wallet_entries_cashback_once on public.wallet_entries(order_id) where kind='cashback';
create unique index wallet_entries_cashback_reversal_once on public.wallet_entries(order_id) where kind='cashback_reversal';

create function public.loyalty_immutable_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  raise sqlstate 'PT409' using message='Loyalty records are immutable.';
end $$;
create trigger loyalty_level_gifts_immutable before update or delete on public.loyalty_level_gifts
  for each row execute function public.loyalty_immutable_guard();

-- Snapshot columns never change; states only move forward (pending and blocked may swap).
create function public.loyalty_cashback_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if tg_op='DELETE' then raise sqlstate 'PT409' using message='Loyalty records are immutable.'; end if;
  if (new.order_id,new.customer_id,new.completed_at,new.prior_completed_count,new.level,new.cashback_percent,new.credit_at,new.created_at)
     is distinct from (old.order_id,old.customer_id,old.completed_at,old.prior_completed_count,old.level,old.cashback_percent,old.credit_at,old.created_at)
     or not ((old.state in ('pending','blocked') and new.state in ('pending','blocked','credited','cancelled'))
          or (old.state='credited' and new.state in ('credited','reversed'))
          or (old.state=new.state))
     or (old.state in ('credited','reversed','cancelled') and (new.amount_eur_cents,new.credit_entry_id,new.credited_at)
          is distinct from (old.amount_eur_cents,old.credit_entry_id,old.credited_at))
     or (old.state in ('reversed','cancelled') and new is distinct from old) then
    raise sqlstate 'PT409' using message='Loyalty records are immutable.';
  end if;
  return new;
end $$;
create trigger loyalty_cashbacks_guard before update or delete on public.loyalty_cashbacks
  for each row execute function public.loyalty_cashback_guard();

-- L4: grants every level gift the customer's valid count has reached and not yet received.
create function public.loyalty_grant_gifts(p_customer uuid,p_order_id uuid default null) returns integer
language plpgsql security definer set search_path='' as $$
declare v_count bigint; v_level record; v_entry uuid; v_granted integer:=0;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_customer::text,714));
  v_count:=public.loyalty_valid_count(p_customer);
  for v_level in select l.id,l.name,l.gift_eur_cents from public.loyalty_levels() l
    where l.gift_eur_cents>0 and l.from_count<=v_count order by l.from_count loop
    v_entry:=pg_catalog.gen_random_uuid();
    insert into public.loyalty_level_gifts(customer_id,level,amount_eur_cents,order_id,wallet_entry_id)
      values(p_customer,v_level.id,v_level.gift_eur_cents,p_order_id,v_entry)
      on conflict (customer_id,level) do nothing;
    if found then
      insert into public.wallet_entries(id,customer_id,amount_eur_cents,kind,cashable,order_id,reason)
        values(v_entry,p_customer,v_level.gift_eur_cents,'level_gift',false,p_order_id,v_level.name||' level-up gift');
      v_granted:=v_granted+1;
    end if;
  end loop;
  return v_granted;
end $$;

-- One state machine for every event: completion job, refunds and disputes call it.
create function public.loyalty_settle_cashback(p_order_id uuid) returns text
language plpgsql security definer set search_path='' as $$
declare v public.loyalty_cashbacks; v_ref text; v_dispute text; v_refunded boolean; v_base integer; v_amount integer;
  v_entry uuid; v_promo bigint; v_take integer; v_now timestamptz:=pg_catalog.clock_timestamp();
begin
  select c.* into v from public.loyalty_cashbacks c where c.order_id=p_order_id for update;
  if v.order_id is null then return 'missing'; end if;
  if v.state in ('cancelled','reversed') then return v.state; end if;
  v_refunded:=public.loyalty_order_refunded(p_order_id);
  v_dispute:=public.loyalty_order_dispute(p_order_id);
  select o.public_reference into v_ref from public.orders o where o.id=p_order_id;
  if v.state in ('pending','blocked') then
    if v_refunded or v_dispute='lost' then
      update public.loyalty_cashbacks set state='cancelled',cancelled_at=v_now,updated_at=v_now,
        reason=case when v_refunded then 'Order refunded before the cashback was credited' else 'Stripe dispute lost before the cashback was credited' end
        where order_id=p_order_id;
      return 'cancelled';
    elsif v_dispute='open' then
      if v.state<>'blocked' then
        update public.loyalty_cashbacks set state='blocked',reason='Waiting while a Stripe dispute is open',updated_at=v_now where order_id=p_order_id;
      end if;
      return 'blocked';
    elsif v.credit_at>v_now then
      if v.state<>'pending' then
        update public.loyalty_cashbacks set state='pending',reason='Credited 14 days after completion',updated_at=v_now where order_id=p_order_id;
      end if;
      return 'pending';
    end if;
    v_base:=public.loyalty_card_paid_cents(p_order_id);
    v_amount:=(v_base*v.cashback_percent+50)/100;
    if v_amount<=0 then
      update public.loyalty_cashbacks set state='cancelled',cancelled_at=v_now,updated_at=v_now,card_paid_eur_cents=v_base,amount_eur_cents=0,
        reason='Nothing was paid by card on this order' where order_id=p_order_id;
      return 'cancelled';
    end if;
    v_entry:=pg_catalog.gen_random_uuid();
    insert into public.wallet_entries(id,customer_id,amount_eur_cents,kind,cashable,order_id,reason)
      values(v_entry,v.customer_id,v_amount,'cashback',false,p_order_id,
        'Cashback '||v.cashback_percent||'% for '||coalesce(v_ref,'order'));
    update public.loyalty_cashbacks set state='credited',credited_at=v_now,updated_at=v_now,card_paid_eur_cents=v_base,
      amount_eur_cents=v_amount,credit_entry_id=v_entry,reason='Credited 14 days after completion' where order_id=p_order_id;
    return 'credited';
  end if;
  -- Credited: reverse after a refund or a lost dispute. Promo may go to 0, never below.
  if v_refunded or v_dispute='lost' then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v.customer_id::text,713));
    select coalesce(pg_catalog.sum(e.amount_eur_cents),0) into v_promo from public.wallet_entries e
      where e.customer_id=v.customer_id and not e.cashable;
    v_take:=least(v.amount_eur_cents::bigint,greatest(v_promo,0))::integer;
    v_entry:=null;
    if v_take>0 then
      v_entry:=pg_catalog.gen_random_uuid();
      insert into public.wallet_entries(id,customer_id,amount_eur_cents,kind,cashable,order_id,reason)
        values(v_entry,v.customer_id,-v_take,'cashback_reversal',false,p_order_id,
          'Cashback reversed for '||coalesce(v_ref,'order')||case when v_refunded then ' after a refund' else ' after a lost dispute' end);
    end if;
    update public.loyalty_cashbacks set state='reversed',reversed_at=v_now,updated_at=v_now,reversal_entry_id=v_entry,
      reversed_eur_cents=v_take,reversal_shortfall_eur_cents=v.amount_eur_cents-v_take,
      reason=case when v_refunded then 'Reversed after a refund' else 'Reversed after a lost Stripe dispute' end
      ||case when v.amount_eur_cents>v_take then ', '||(v.amount_eur_cents-v_take)||' cents already spent' else '' end
      where order_id=p_order_id;
    return 'reversed';
  end if;
  return 'credited';
end $$;

-- Completion: snapshot the level before this order, then grant any gift the new count reached.
create function public.loyalty_after_order_completed() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_prior bigint; v_level jsonb;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.customer_id::text,714));
  v_prior:=public.loyalty_valid_count(new.customer_id,new.completed_at,new.id);
  v_level:=public.loyalty_level(v_prior);
  insert into public.loyalty_cashbacks(order_id,customer_id,completed_at,prior_completed_count,level,cashback_percent,credit_at,reason)
    values(new.id,new.customer_id,new.completed_at,v_prior,v_level->>'id',(v_level->>'cashback')::integer,
      new.completed_at+interval '14 days','Credited 14 days after completion')
    on conflict (order_id) do nothing;
  perform public.loyalty_grant_gifts(new.customer_id,new.id);
  return new;
end $$;
create trigger orders_loyalty_completed after update of status on public.orders
  for each row when (new.status='completed' and old.status is distinct from 'completed')
  execute function public.loyalty_after_order_completed();

create function public.loyalty_refresh_order() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.order_id is not null then perform public.loyalty_settle_cashback(new.order_id); end if;
  return new;
end $$;
create function public.loyalty_refresh_order_row() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  perform public.loyalty_settle_cashback(new.id);
  return new;
end $$;
create trigger orders_loyalty_refund after update of admin_refunded_at on public.orders
  for each row when (new.admin_refunded_at is not null and old.admin_refunded_at is null)
  execute function public.loyalty_refresh_order_row();
create trigger order_payments_loyalty_refund after update of state on public.order_payments
  for each row when (new.state='refunded' and old.state is distinct from 'refunded')
  execute function public.loyalty_refresh_order();
create trigger stripe_disputes_loyalty after insert or update of status on public.stripe_disputes
  for each row execute function public.loyalty_refresh_order();
create trigger wallet_entries_loyalty_refund after insert on public.wallet_entries
  for each row when (new.kind='refund' and new.order_id is not null)
  execute function public.loyalty_refresh_order();

-- L5 job: credit due cashback, or cancel or block it.
create function public.credit_due_cashback(p_limit integer default 1000) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v record; v_state text; v_credited integer:=0; v_cancelled integer:=0; v_blocked integer:=0;
begin
  if p_limit is null or p_limit not between 1 and 5000 then raise exception 'invalid cashback limit'; end if;
  for v in select c.order_id from public.loyalty_cashbacks c
    where c.state in ('pending','blocked') and c.credit_at<=pg_catalog.clock_timestamp()
    order by c.credit_at,c.order_id for update skip locked limit p_limit loop
    v_state:=public.loyalty_settle_cashback(v.order_id);
    if v_state='credited' then v_credited:=v_credited+1;
    elsif v_state='cancelled' then v_cancelled:=v_cancelled+1;
    elsif v_state='blocked' then v_blocked:=v_blocked+1; end if;
  end loop;
  return pg_catalog.jsonb_build_object('credited',v_credited,'cancelled',v_cancelled,'blocked',v_blocked);
end $$;

-- Level summary shared by customer_rewards() and admin_customers().
create function public.loyalty_summary(p_customer uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_count bigint; v_level jsonb; v_next jsonb;
begin
  v_count:=public.loyalty_valid_count(p_customer);
  v_level:=public.loyalty_level(v_count);
  select pg_catalog.jsonb_build_object('index',l.idx,'id',l.id,'name',l.name,'from',l.from_count,'cashback',l.cashback_percent,'giftEurCents',l.gift_eur_cents)
    into v_next from public.loyalty_levels() l where l.from_count>v_count order by l.from_count limit 1;
  return pg_catalog.jsonb_build_object('orders',v_count,'level',v_level,'next',v_next,
    'remaining',coalesce((v_next->>'from')::bigint-v_count,0),
    'percent',case when v_next is null then 100 else pg_catalog.floor(100.0*(v_count-(v_level->>'from')::bigint)/((v_next->>'from')::bigint-(v_level->>'from')::bigint))::integer end);
end $$;

create function public.customer_rewards() returns jsonb
language plpgsql stable security definer set search_path='' as $$
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
      from (select c.* from public.loyalty_cashbacks c where c.customer_id=v_actor order by c.completed_at desc limit 100) q),'[]'::jsonb));
end $$;

-- Latest definition is 20261025140000_wallet_ledger.sql. Only the loyalty key is added.
create or replace function public.admin_customers() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not exists(select 1 from public.admin_caller()) then return public.order_error(403,'Admins only.'); end if;
 return pg_catalog.jsonb_build_object('customers',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'id',r.user_id,'name',coalesce(nullif(p.name,'Player'),u.email,''),'email',coalesce(u.email,''),
  'provider',coalesce(u.raw_app_meta_data->>'provider','email'),'image',coalesce(p.image,''),'country',coalesce(p.country,''),'joined',u.created_at,
  'placed',(select pg_catalog.count(*) from public.orders o where o.customer_id=r.user_id),
  'completed',(select pg_catalog.count(*) from public.orders o where o.customer_id=r.user_id and o.status='completed'),
  'spentCents',coalesce((select pg_catalog.sum(o.amount_eur_cents) from public.orders o where o.customer_id=r.user_id and o.status<>'cancelled'),0),
  'walletCents',coalesce(w.total_eur_cents,0),'walletCashableCents',coalesce(w.cashable_eur_cents,0),'walletPromoCents',coalesce(w.promo_eur_cents,0),
  'giftedCents',coalesce(w.admin_eur_cents,0),'adjustments',(select pg_catalog.count(*) from public.wallet_entries e where e.customer_id=r.user_id and e.kind in ('admin_credit','admin_debit')),
  'lastOrderAt',(select pg_catalog.max(o.created_at) from public.orders o where o.customer_id=r.user_id),
  'warnings',(select pg_catalog.count(*) from public.order_chat_flags f where f.actor_id=r.user_id and f.status='warned'),
  'loyalty',public.loyalty_summary(r.user_id),
  'blocked',case when b.user_id is null then null else pg_catalog.jsonb_build_object('reason',b.reason,'at',b.blocked_at,'by',coalesce((select coalesce(nullif(bp.name,'Player'),bu.email) from auth.users bu left join public.profiles bp on bp.id=bu.id where bu.id=b.blocked_by),'')) end)
  order by u.created_at desc) from public.account_roles r join auth.users u on u.id=r.user_id left join public.profiles p on p.id=r.user_id
  left join public.customer_blocks b on b.user_id=r.user_id left join public.wallet_balances w on w.customer_id=r.user_id where r.role='customer'),'[]'::jsonb));
end $$;

-- Backfill: existing completed orders get their cashback row (level before each order, credited by the
-- job once 14 days old) and customers get the gifts their valid count already reached.
insert into public.loyalty_cashbacks(order_id,customer_id,completed_at,prior_completed_count,level,cashback_percent,credit_at,reason)
select o.id,o.customer_id,o.completed_at,x.prior,l->>'id',(l->>'cashback')::integer,o.completed_at+interval '14 days','Credited 14 days after completion'
from public.orders o
cross join lateral (select public.loyalty_valid_count(o.customer_id,o.completed_at,o.id) as prior) x
cross join lateral (select public.loyalty_level(x.prior) as l) y
where o.status='completed'
on conflict (order_id) do nothing;
select public.loyalty_grant_gifts(c.customer_id) from (select distinct o.customer_id from public.orders o where o.status='completed') c;
select public.loyalty_settle_cashback(c.order_id) from public.loyalty_cashbacks c where c.state='pending'
  and (public.loyalty_order_refunded(c.order_id) or public.loyalty_order_dispute(c.order_id) is not null);

select cron.schedule('loyalty-cashback-credit','23 * * * *','select public.credit_due_cashback(1000);');
select cron.alter_job(jobid,active:=true) from cron.job where jobname='loyalty-cashback-credit' and username=current_user;

revoke all on function public.loyalty_levels(),public.loyalty_level(bigint),public.loyalty_order_refunded(uuid),public.loyalty_order_dispute(uuid),
  public.loyalty_valid_count(uuid,timestamptz,uuid),public.loyalty_card_paid_cents(uuid),public.loyalty_immutable_guard(),public.loyalty_cashback_guard(),
  public.loyalty_grant_gifts(uuid,uuid),public.loyalty_settle_cashback(uuid),public.loyalty_after_order_completed(),public.loyalty_refresh_order(),
  public.loyalty_refresh_order_row(),public.credit_due_cashback(integer),public.loyalty_summary(uuid),public.customer_rewards()
  from public,anon,authenticated,service_role;
grant execute on function public.credit_due_cashback(integer) to service_role;
grant execute on function public.customer_rewards() to authenticated;
-- Preserve existing callers and grants after CREATE OR REPLACE.
revoke all on function public.admin_customers() from public,anon,authenticated,service_role;
grant execute on function public.admin_customers() to authenticated;

commit;
