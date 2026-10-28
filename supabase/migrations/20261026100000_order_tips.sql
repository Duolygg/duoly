-- Tips (#10, MONEY-RULES section 1, T1 to T7, owner approved all defaults 2026-10-27).
-- T1 a tip is its own Stripe PaymentIntent, confirmed by the customer right after the rating is saved.
-- T2/T3 1.00 to 100.00 EUR (the order's currency). T4 the teammate keeps 100%: the tip is converted to
-- USD at the ECB mid rate fixed when the PaymentIntent is created, no fee is deducted (Duoly pays it).
-- T5 one tip per order, only together with the rating: the tip can be started within 30 minutes of the
-- rating and never after a tip was paid. T6 never paid from the wallet (Stripe only; nothing here
-- touches wallet_entries) and never earns loyalty cashback (cashback reads order_payments only).
-- T7 a refund or dispute of a tip that was already counted in a payout line is taken back from the
-- teammate's next payout week as a negative tip movement; a won dispute gives it back the same way.
-- Payout timing: a tip counts in the payout week in which it was paid (paid_at), not the order's week.
--
-- Deploy order: apply this migration first, then deploy the code. The migration is additive (new tables
-- and functions) and replaces payout read models with the same signatures, so the old code keeps
-- working (tipsTotal stays 0 until the new code takes the first tip). The new code needs the RPCs below.
--
-- Latest definitions replaced here (all from 20261025250000_weekly_payouts.sql, rules unchanged apart
-- from adding tips): payout_freeze_week(timestamptz), payout_freeze_due_at(timestamptz),
-- payout_pending(uuid,timestamptz), payout_line_dto(uuid), admin_payouts(), teammate_stats().
begin;

-- ---- tables -----------------------------------------------------------------------------------

create table public.order_tips (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  order_id uuid not null unique references public.teammate_earning_entries(order_id) on delete restrict,
  customer_id uuid not null references public.profiles(id) on delete restrict,
  teammate_id uuid not null references public.profiles(id) on delete restrict,
  amount_cents integer not null check (amount_cents between 100 and 10000),
  currency text not null default 'eur' check (currency = 'eur'),
  fx_eur_usd numeric(12,6) check (fx_eur_usd is null or fx_eur_usd between 0.5 and 2),
  amount_usd_cents integer check (amount_usd_cents is null or amount_usd_cents > 0),
  stripe_payment_intent_id text unique check (stripe_payment_intent_id is null or stripe_payment_intent_id ~ '^pi_[A-Za-z0-9]+$'),
  attempt integer not null default 0 check (attempt between 0 and 50),
  state text not null default 'pending' check (state in ('pending','paid','refunded','disputed','canceled')),
  refunded_cents integer not null default 0 check (refunded_cents >= 0 and refunded_cents <= amount_cents),
  dispute_id text check (dispute_id is null or dispute_id ~ '^dp_[A-Za-z0-9]+$'),
  dispute_status text check (dispute_status is null or dispute_status in
    ('warning_needs_response','warning_under_review','warning_closed','needs_response','under_review','won','lost')),
  last_error text check (last_error is null or pg_catalog.char_length(last_error) <= 300),
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  paid_at timestamptz,
  check ((state in ('paid','refunded','disputed')) = (paid_at is not null)),
  check (paid_at is null or (amount_usd_cents is not null and fx_eur_usd is not null and stripe_payment_intent_id is not null))
);
create index order_tips_teammate on public.order_tips(teammate_id,paid_at desc);
alter table public.order_tips enable row level security;
revoke all on table public.order_tips from public,anon,authenticated,service_role;

-- Changes to a tip after it was counted in a payout line (T7): negative on refund or dispute, positive
-- when a dispute is won. Counted in the payout week they are made in, like admin adjustments.
create table public.order_tip_movements (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  tip_id uuid not null references public.order_tips(id) on delete restrict,
  teammate_id uuid not null references public.profiles(id) on delete restrict,
  amount_usd_cents integer not null check (amount_usd_cents <> 0),
  reason text not null check (pg_catalog.char_length(reason) between 1 and 200),
  created_at timestamptz not null default pg_catalog.clock_timestamp()
);
create index order_tip_movements_tip on public.order_tip_movements(tip_id,created_at);
create index order_tip_movements_teammate on public.order_tip_movements(teammate_id,created_at);
alter table public.order_tip_movements enable row level security;
revoke all on table public.order_tip_movements from public,anon,authenticated,service_role;
create trigger order_tip_movements_immutable before update or delete on public.order_tip_movements
  for each row execute function public.payout_immutable_guard();

-- Payout line items gain 'tip_adjust' (a tip movement, either sign). Same constraint names as created
-- by 20261025250000_weekly_payouts.sql.
alter table public.payout_line_items drop constraint payout_line_items_kind_check;
alter table public.payout_line_items add constraint payout_line_items_kind_check
  check (kind in ('earning','tip','tip_adjust','deposit_release','adjustment','order_hold','hold_release','carry_in'));
alter table public.payout_line_items drop constraint payout_line_items_check;
alter table public.payout_line_items add constraint payout_line_items_check
  check ((kind in ('earning','tip','deposit_release','hold_release') and amount_usd_cents >= 0)
    or (kind='order_hold' and amount_usd_cents < 0) or (kind='tip_adjust' and amount_usd_cents <> 0)
    or kind in ('adjustment','carry_in'));

-- ---- helpers ----------------------------------------------------------------------------------

-- What the teammate keeps of one tip in USD cents: the converted amount while paid, minus any partial
-- refund; nothing once it is fully refunded or disputed.
create function public.tip_payable_usd(p_tip public.order_tips) returns bigint
language sql immutable security invoker set search_path='' as $$
  select case when p_tip.state='paid' and p_tip.amount_usd_cents is not null
    then pg_catalog.round(p_tip.amount_usd_cents::numeric*(p_tip.amount_cents-p_tip.refunded_cents)/p_tip.amount_cents)::bigint
    else 0 end;
$$;

-- Brings a counted tip in line with what the teammate keeps (T7). Before a tip is counted in a payout
-- line nothing is needed: the freeze only counts what is payable at that time.
create function public.tip_sync_payout(p_tip_id uuid,p_reason text) returns bigint
language plpgsql security definer set search_path='' as $$
declare v public.order_tips; v_counted bigint; v_diff bigint;
begin
  select t.* into v from public.order_tips t where t.id=p_tip_id;
  if v.id is null then return 0; end if;
  if not exists(select 1 from public.payout_line_items i where i.kind='tip' and i.source_id=v.id) then return 0; end if;
  select (select i.amount_usd_cents from public.payout_line_items i where i.kind='tip' and i.source_id=v.id)
       + coalesce((select pg_catalog.sum(m.amount_usd_cents) from public.order_tip_movements m where m.tip_id=v.id),0)
    into v_counted;
  v_diff:=public.tip_payable_usd(v)-v_counted;
  if v_diff<>0 then
    insert into public.order_tip_movements(tip_id,teammate_id,amount_usd_cents,reason)
      values(v.id,v.teammate_id,v_diff,pg_catalog.left(p_reason,200));
  end if;
  return v_diff;
end $$;

create function public.tip_dto(p_tip public.order_tips) returns jsonb
language sql stable security invoker set search_path='' as $$
  select case when p_tip.id is null then null else pg_catalog.jsonb_build_object(
    'amount',p_tip.amount_cents/100.0,'currency','EUR','state',p_tip.state,
    'refunded',p_tip.refunded_cents/100.0,
    'paidAt',case when p_tip.paid_at is null then null else public.payout_ms(p_tip.paid_at) end) end;
$$;

-- ---- customer RPCs ----------------------------------------------------------------------------

-- Starts (or re-opens) the customer's tip for one order. Records the amount only; the server then
-- creates or updates the Stripe PaymentIntent and attaches it with order_tip_attach().
create function public.order_tip_prepare(p_order_id uuid,p_amount_cents integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v public.orders; e public.teammate_earning_entries; r public.order_reviews; t public.order_tips;
begin
  if v_actor is null then return public.order_error(401,'Authentication required.'); end if;
  perform 1 from public.account_roles where user_id=v_actor and role='customer';
  if not found then return public.order_error(403,'Customer role required.'); end if;
  select o.* into v from public.orders o where o.id=p_order_id and o.customer_id=v_actor for update;
  if v.id is null then return public.order_error(404,'Order not found.'); end if;
  select x.* into e from public.teammate_earning_entries x where x.order_id=v.id;
  if v.status<>'completed' or e.order_id is null then return public.order_error(409,'You can tip your teammate once the order is done.'); end if;
  select x.* into r from public.order_reviews x where x.order_id=v.id;
  if r.order_id is null then return public.order_error(409,'Rate your teammate first, then add your tip.'); end if;
  if p_amount_cents is null or p_amount_cents not between 100 and 10000 then
    return public.order_error(400,'Tips can be from €1 to €100.'); end if;
  select x.* into t from public.order_tips x where x.order_id=v.id for update;
  if t.state in ('paid','refunded','disputed') then return public.order_error(409,'You already tipped for this order. Thank you!'); end if;
  if r.created_at<pg_catalog.clock_timestamp()-interval '30 minutes' then
    return public.order_error(409,'Tips can only be added together with your rating.'); end if;
  if t.id is null then
    insert into public.order_tips(order_id,customer_id,teammate_id,amount_cents)
      values(v.id,v_actor,e.teammate_id,p_amount_cents) returning * into t;
  elsif t.state='canceled' then
    if t.attempt>=50 then return public.order_error(409,'Tips can only be added together with your rating.'); end if;
    update public.order_tips set state='pending',amount_cents=p_amount_cents,stripe_payment_intent_id=null,fx_eur_usd=null,
      attempt=attempt+1,last_error=null,updated_at=pg_catalog.clock_timestamp() where id=t.id returning * into t;
  else
    update public.order_tips set amount_cents=p_amount_cents,updated_at=pg_catalog.clock_timestamp() where id=t.id returning * into t;
  end if;
  return pg_catalog.jsonb_build_object('tipId',t.id,'amountCents',t.amount_cents,'attempt',t.attempt,
    'paymentIntentId',t.stripe_payment_intent_id,'reference',v.public_reference,
    'teammate',coalesce((select nullif(p.name,'Player') from public.profiles p where p.id=t.teammate_id),'your teammate'),
    'tip',public.tip_dto(t));
end $$;

-- What the order room shows: the tip, and whether a tip can still be started (T5).
create function public.order_tip_status(p_order_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v public.orders; r public.order_reviews; t public.order_tips;
begin
  if v_actor is null then return public.order_error(401,'Authentication required.'); end if;
  perform 1 from public.account_roles where user_id=v_actor and role='customer';
  if not found then return public.order_error(403,'Customer role required.'); end if;
  select o.* into v from public.orders o where o.id=p_order_id and o.customer_id=v_actor;
  if v.id is null then return public.order_error(404,'Order not found.'); end if;
  select x.* into r from public.order_reviews x where x.order_id=v.id;
  select x.* into t from public.order_tips x where x.order_id=v.id;
  return pg_catalog.jsonb_build_object('tip',public.tip_dto(t),
    'canTip',v.status='completed' and exists(select 1 from public.teammate_earning_entries x where x.order_id=v.id)
      and coalesce(t.state,'pending') in ('pending','canceled')
      and (r.order_id is null or r.created_at>=pg_catalog.clock_timestamp()-interval '30 minutes'),
    'tipUntil',case when r.order_id is null then null else public.payout_ms(r.created_at+interval '30 minutes') end);
end $$;

-- ---- server (service role) RPCs ---------------------------------------------------------------

-- Attaches the PaymentIntent the server created or updated for a pending tip, with the mid rate.
create function public.order_tip_attach(p_tip_id uuid,p_payment_intent text,p_amount_cents integer,p_fx numeric) returns jsonb
language plpgsql security definer set search_path='' as $$
declare t public.order_tips;
begin
  if p_payment_intent is null or p_payment_intent!~'^pi_[A-Za-z0-9]+$' or p_amount_cents is null or p_amount_cents not between 100 and 10000
    or p_fx is null or p_fx not between 0.5 and 2 then raise exception 'invalid tip intent'; end if;
  select x.* into t from public.order_tips x where x.id=p_tip_id for update;
  if t.id is null then return pg_catalog.jsonb_build_object('attached',false,'reason','not_found'); end if;
  if t.state<>'pending' then return pg_catalog.jsonb_build_object('attached',false,'reason',t.state); end if;
  if t.stripe_payment_intent_id is not null and t.stripe_payment_intent_id<>p_payment_intent then
    return pg_catalog.jsonb_build_object('attached',false,'reason','other_intent'); end if;
  update public.order_tips set stripe_payment_intent_id=p_payment_intent,amount_cents=p_amount_cents,fx_eur_usd=p_fx,
    updated_at=pg_catalog.clock_timestamp() where id=t.id;
  return pg_catalog.jsonb_build_object('attached',true);
end $$;

-- Which tip a PaymentIntent belongs to (null when it is an order payment).
create function public.order_tip_for_intent(p_payment_intent text) returns uuid
language sql stable security definer set search_path='' as $$
  select t.id from public.order_tips t where t.stripe_payment_intent_id=p_payment_intent;
$$;

-- A succeeded tip PaymentIntent: marks the tip paid once (idempotent). The amount is what Stripe
-- collected, which only the server can set; it must still be inside the T2/T3 bounds and in EUR.
create function public.order_tip_record_payment(p_payment_intent text,p_tip_id uuid,p_amount_cents integer,p_currency text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare t public.order_tips;
begin
  select x.* into t from public.order_tips x where x.stripe_payment_intent_id=p_payment_intent for update;
  if t.id is null or t.id is distinct from p_tip_id then return pg_catalog.jsonb_build_object('recorded',false,'reason','unknown_tip'); end if;
  if t.state<>'pending' then return pg_catalog.jsonb_build_object('recorded',false,'reason','already_'||t.state,'state',t.state); end if;
  if p_currency is distinct from 'eur' or p_amount_cents is null or p_amount_cents not between 100 and 10000 then
    update public.order_tips set last_error='Amount or currency outside the tip rules',updated_at=pg_catalog.clock_timestamp() where id=t.id;
    return pg_catalog.jsonb_build_object('recorded',false,'reason','amount_mismatch');
  end if;
  update public.order_tips set state='paid',amount_cents=p_amount_cents,
    amount_usd_cents=greatest(1,pg_catalog.round(p_amount_cents*t.fx_eur_usd)::integer),paid_at=pg_catalog.clock_timestamp(),
    last_error=null,updated_at=pg_catalog.clock_timestamp() where id=t.id;
  return pg_catalog.jsonb_build_object('recorded',true,'state','paid','tipId',t.id);
end $$;

-- A canceled tip PaymentIntent closes the pending tip (it can be started again inside the window);
-- a failed attempt only records the reason, the customer can retry on the same PaymentIntent.
create function public.order_tip_record_failure(p_payment_intent text,p_status text,p_error text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare t public.order_tips;
begin
  if p_status not in ('canceled','failed') then raise exception 'invalid tip failure'; end if;
  select x.* into t from public.order_tips x where x.stripe_payment_intent_id=p_payment_intent for update;
  if t.id is null then return pg_catalog.jsonb_build_object('updated',false); end if;
  if t.state<>'pending' then return pg_catalog.jsonb_build_object('updated',false,'state',t.state); end if;
  update public.order_tips set state=case when p_status='canceled' then 'canceled' else state end,
    last_error=pg_catalog.left(coalesce(nullif(pg_catalog.btrim(p_error),''),p_status),300),updated_at=pg_catalog.clock_timestamp()
    where id=t.id;
  return pg_catalog.jsonb_build_object('updated',true,'state',case when p_status='canceled' then 'canceled' else 'pending' end);
end $$;

-- A refund of a tip (from the Stripe dashboard or API). p_refunded_cents is the charge's total refunded
-- amount, so replays and out-of-order events converge. T7: a counted tip is taken back next week.
create function public.order_tip_record_refund(p_payment_intent text,p_refunded_cents integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare t public.order_tips; v_refunded integer; v_diff bigint;
begin
  if p_refunded_cents is null or p_refunded_cents<0 then raise exception 'invalid tip refund'; end if;
  select x.* into t from public.order_tips x where x.stripe_payment_intent_id=p_payment_intent for update;
  if t.id is null then return pg_catalog.jsonb_build_object('updated',false); end if;
  if t.paid_at is null then return pg_catalog.jsonb_build_object('updated',false,'state',t.state); end if;
  v_refunded:=least(t.amount_cents,greatest(t.refunded_cents,p_refunded_cents));
  if v_refunded=t.refunded_cents then return pg_catalog.jsonb_build_object('updated',false,'state',t.state,'tipId',t.id); end if;
  update public.order_tips set refunded_cents=v_refunded,
    state=case when v_refunded>=amount_cents and state='paid' then 'refunded' else state end,
    updated_at=pg_catalog.clock_timestamp() where id=t.id returning * into t;
  v_diff:=public.tip_sync_payout(t.id,'Tip refunded to the customer');
  perform public.admin_log(null,'Duoly','Tip refunded',public.payout_person(t.teammate_id),
    '€'||pg_catalog.to_char(v_refunded/100.0,'FM999999990.00')||' of €'||pg_catalog.to_char(t.amount_cents/100.0,'FM999999990.00')
    ||case when v_diff<>0 then ' · '||public.payout_money(v_diff)||' in the next payout week' else '' end);
  return pg_catalog.jsonb_build_object('updated',true,'state',t.state,'tipId',t.id,'movement',v_diff);
end $$;

-- A dispute on a tip charge. Open: the tip is disputed and not paid out (taken back if it was counted).
-- Won or warning closed: the tip is the teammate's again. Lost: it stays taken back (T7).
create function public.order_tip_record_dispute(p_dispute_id text,p_payment_intent text,p_status text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare t public.order_tips; v_diff bigint;
begin
  if p_dispute_id is null or p_dispute_id!~'^dp_[A-Za-z0-9]+$'
    or p_status not in ('warning_needs_response','warning_under_review','warning_closed','needs_response','under_review','won','lost') then
    raise exception 'invalid tip dispute'; end if;
  select x.* into t from public.order_tips x where x.stripe_payment_intent_id=p_payment_intent for update;
  if t.id is null then return pg_catalog.jsonb_build_object('updated',false); end if;
  if t.paid_at is null then return pg_catalog.jsonb_build_object('updated',false,'state',t.state); end if;
  update public.order_tips set dispute_id=p_dispute_id,dispute_status=p_status,
    state=case
      when p_status in ('won','warning_closed') and state='disputed' then case when refunded_cents>=amount_cents then 'refunded' else 'paid' end
      when p_status not in ('won','warning_closed','lost') and state='paid' then 'disputed'
      when p_status='lost' and state='paid' then 'disputed'
      else state end,
    updated_at=pg_catalog.clock_timestamp() where id=t.id returning * into t;
  v_diff:=public.tip_sync_payout(t.id,case when t.state='disputed' then 'Tip disputed by the customer' else 'Tip dispute closed in your favour' end);
  if v_diff<>0 then
    perform public.admin_log(null,'Duoly',case when v_diff<0 then 'Tip taken back after dispute' else 'Tip restored after dispute' end,
      public.payout_person(t.teammate_id),public.payout_money(v_diff)||' in the next payout week · '||p_status);
  end if;
  return pg_catalog.jsonb_build_object('updated',true,'state',t.state,'tipId',t.id,'movement',v_diff);
end $$;

-- ---- payouts: create or replace from 20261025250000_weekly_payouts.sql, adding tips --------------

create or replace function public.payout_freeze_week(p_start timestamptz) returns integer
language plpgsql security definer set search_path='' as $$
declare v_end timestamptz:=public.payout_week_end(p_start); v_tm uuid; v_line uuid; v_lines integer:=0; v_total bigint; v_e record; v_hold uuid;
begin
  if p_start is distinct from public.payout_week_start(p_start) then raise exception 'invalid payout week'; end if;
  insert into public.payout_weeks(week_start,week_end) values(p_start,v_end);
  for v_tm in
    select t.teammate_id from (
      select e.teammate_id from public.teammate_earning_entries e
       where e.completed_at<v_end and not exists(select 1 from public.payout_line_items i where i.kind='earning' and i.source_id=e.order_id)
      union select r.teammate_id from public.deposit_releases r
       where r.state='released' and r.released_at<v_end and not exists(select 1 from public.payout_line_items i where i.kind='deposit_release' and i.source_id=r.earning_id)
      union select a.teammate_id from public.teammate_adjustments a
       where a.created_at<v_end and not exists(select 1 from public.payout_line_items i where i.kind='adjustment' and i.source_id=a.id)
      union select h.teammate_id from public.payout_order_holds h
       where h.released_at<v_end and not exists(select 1 from public.payout_line_items i where i.kind='hold_release' and i.source_id=h.id)
      union select l.teammate_id from public.payout_lines l where l.status='carried' and l.carried_to is null and l.week_start<p_start
      union select tp.teammate_id from public.order_tips tp
       where tp.paid_at<v_end and public.tip_payable_usd(tp)>0 and not exists(select 1 from public.payout_line_items i where i.kind='tip' and i.source_id=tp.id)
      union select m.teammate_id from public.order_tip_movements m
       where m.created_at<v_end and not exists(select 1 from public.payout_line_items i where i.kind='tip_adjust' and i.source_id=m.id)
    ) t order by t.teammate_id
  loop
    insert into public.payout_lines(teammate_id,week_start,week_end,status) values(v_tm,p_start,v_end,'scheduled') returning id into v_line;
    insert into public.payout_line_items(line_id,kind,source_id,amount_usd_cents,gross_usd_cents,held_usd_cents)
      select v_line,'earning',e.order_id,e.net_usd_cents,e.payout_usd_cents,e.held_usd_cents from public.teammate_earning_entries e
       where e.teammate_id=v_tm and e.completed_at<v_end and not exists(select 1 from public.payout_line_items i where i.kind='earning' and i.source_id=e.order_id);
    insert into public.payout_line_items(line_id,kind,source_id,amount_usd_cents)
      select v_line,'tip',tp.id,public.tip_payable_usd(tp) from public.order_tips tp
       where tp.teammate_id=v_tm and tp.paid_at<v_end and public.tip_payable_usd(tp)>0
         and not exists(select 1 from public.payout_line_items i where i.kind='tip' and i.source_id=tp.id);
    insert into public.payout_line_items(line_id,kind,source_id,amount_usd_cents)
      select v_line,'tip_adjust',m.id,m.amount_usd_cents from public.order_tip_movements m
       where m.teammate_id=v_tm and m.created_at<v_end and not exists(select 1 from public.payout_line_items i where i.kind='tip_adjust' and i.source_id=m.id);
    insert into public.payout_line_items(line_id,kind,source_id,amount_usd_cents)
      select v_line,'deposit_release',r.earning_id,e.held_usd_cents from public.deposit_releases r join public.teammate_earning_entries e on e.order_id=r.earning_id
       where r.teammate_id=v_tm and r.state='released' and r.released_at<v_end and e.held_usd_cents>0
         and not exists(select 1 from public.payout_line_items i where i.kind='deposit_release' and i.source_id=r.earning_id);
    insert into public.payout_line_items(line_id,kind,source_id,amount_usd_cents)
      select v_line,'adjustment',a.id,a.amount_usd_cents from public.teammate_adjustments a
       where a.teammate_id=v_tm and a.created_at<v_end and not exists(select 1 from public.payout_line_items i where i.kind='adjustment' and i.source_id=a.id);
    insert into public.payout_line_items(line_id,kind,source_id,amount_usd_cents)
      select v_line,'hold_release',h.id,h.amount_usd_cents from public.payout_order_holds h
       where h.teammate_id=v_tm and h.released_at<v_end and not exists(select 1 from public.payout_line_items i where i.kind='hold_release' and i.source_id=h.id);
    insert into public.payout_line_items(line_id,kind,source_id,amount_usd_cents)
      select v_line,'carry_in',l.id,public.payout_line_total(l.id) from public.payout_lines l
       where l.teammate_id=v_tm and l.status='carried' and l.carried_to is null and l.week_start<p_start;
    update public.payout_lines set carried_to=v_line,updated_at=pg_catalog.clock_timestamp()
     where teammate_id=v_tm and status='carried' and carried_to is null and week_start<p_start;
    for v_e in select i.source_id as order_id,i.amount_usd_cents from public.payout_line_items i
                where i.line_id=v_line and i.kind='earning' and i.amount_usd_cents>0 and public.payout_order_blocked(i.source_id) loop
      insert into public.payout_order_holds(order_id,teammate_id,line_id,amount_usd_cents,reason)
        values(v_e.order_id,v_tm,v_line,v_e.amount_usd_cents,'Open report or Stripe dispute on this order') returning id into v_hold;
      insert into public.payout_line_items(line_id,kind,source_id,amount_usd_cents) values(v_line,'order_hold',v_hold,-v_e.amount_usd_cents);
    end loop;
    v_total:=public.payout_line_total(v_line);
    if v_total<1000 then update public.payout_lines set status='carried' where id=v_line; end if;
    v_lines:=v_lines+1;
  end loop;
  return v_lines;
end $$;

create or replace function public.payout_freeze_due_at(p_now timestamptz) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_next timestamptz; v_first timestamptz; v_weeks integer:=0; v_lines integer:=0;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('duoly.payout_freeze',0));
  select pg_catalog.max(w.week_end) into v_next from public.payout_weeks w;
  if v_next is null then
    select pg_catalog.min(t.at) into v_first from (
      select pg_catalog.min(e.completed_at) at from public.teammate_earning_entries e
      union all select pg_catalog.min(a.created_at) from public.teammate_adjustments a
      union all select pg_catalog.min(r.released_at) from public.deposit_releases r where r.state='released'
      union all select pg_catalog.min(tp.paid_at) from public.order_tips tp) t;
    v_next:=public.payout_week_start(coalesce(v_first,p_now));
  end if;
  while public.payout_week_end(v_next)<=p_now and v_weeks<1000 loop
    v_lines:=v_lines+public.payout_freeze_week(v_next);
    v_weeks:=v_weeks+1;
    v_next:=public.payout_week_end(v_next);
  end loop;
  return pg_catalog.jsonb_build_object('weeks',v_weeks,'lines',v_lines);
end $$;

create or replace function public.payout_pending(p_teammate uuid,p_now timestamptz) returns jsonb
language sql stable security definer set search_path='' as $$
  with e as (select * from public.teammate_earning_entries e where e.teammate_id=p_teammate and e.completed_at<p_now
              and not exists(select 1 from public.payout_line_items i where i.kind='earning' and i.source_id=e.order_id)),
  r as (select x.held_usd_cents from public.deposit_releases d join public.teammate_earning_entries x on x.order_id=d.earning_id
         where d.teammate_id=p_teammate and d.state='released' and d.released_at<p_now
           and not exists(select 1 from public.payout_line_items i where i.kind='deposit_release' and i.source_id=d.earning_id)),
  a as (select * from public.teammate_adjustments a where a.teammate_id=p_teammate and a.created_at<p_now
         and not exists(select 1 from public.payout_line_items i where i.kind='adjustment' and i.source_id=a.id)),
  h as (select * from public.payout_order_holds h where h.teammate_id=p_teammate and h.released_at<p_now
         and not exists(select 1 from public.payout_line_items i where i.kind='hold_release' and i.source_id=h.id)),
  c as (select public.payout_line_total(l.id) total from public.payout_lines l where l.teammate_id=p_teammate and l.status='carried' and l.carried_to is null),
  tp as (select public.tip_payable_usd(x) usd from public.order_tips x where x.teammate_id=p_teammate and x.paid_at<p_now and public.tip_payable_usd(x)>0
         and not exists(select 1 from public.payout_line_items i where i.kind='tip' and i.source_id=x.id)),
  tm as (select m.amount_usd_cents usd from public.order_tip_movements m where m.teammate_id=p_teammate and m.created_at<p_now
         and not exists(select 1 from public.payout_line_items i where i.kind='tip_adjust' and i.source_id=m.id))
  select pg_catalog.jsonb_build_object(
    'orders',(select pg_catalog.count(*) from e),
    'gross',coalesce((select pg_catalog.sum(payout_usd_cents) from e),0),
    'held',coalesce((select pg_catalog.sum(held_usd_cents) from e),0),
    'net',coalesce((select pg_catalog.sum(net_usd_cents) from e),0),
    'tips',coalesce((select pg_catalog.sum(usd) from tp),0)+coalesce((select pg_catalog.sum(usd) from tm),0),
    'released',coalesce((select pg_catalog.sum(held_usd_cents) from r),0),
    'adjust',coalesce((select pg_catalog.sum(amount_usd_cents) from a),0),
    'holdReleased',coalesce((select pg_catalog.sum(amount_usd_cents) from h),0),
    'carried',coalesce((select pg_catalog.sum(total) from c),0),
    'autoHeld',coalesce((select pg_catalog.sum(net_usd_cents) from e where public.payout_order_blocked(e.order_id)),0),
    'adjustments',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('amount',a.amount_usd_cents/100.0,'reason',a.reason,
       'by',public.payout_person(a.created_by),'at',public.payout_ms(a.created_at)) order by a.created_at) from a),'[]'::jsonb),
    'active',exists(select 1 from e) or exists(select 1 from r) or exists(select 1 from a) or exists(select 1 from h) or exists(select 1 from c)
      or exists(select 1 from tp) or exists(select 1 from tm));
$$;

create or replace function public.payout_line_dto(p_line_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
  with l as (select * from public.payout_lines where id=p_line_id),
  s as (select
    pg_catalog.count(*) filter(where i.kind='earning') orders,
    coalesce(pg_catalog.sum(i.gross_usd_cents) filter(where i.kind='earning'),0) gross,
    coalesce(pg_catalog.sum(i.held_usd_cents) filter(where i.kind='earning'),0) held,
    coalesce(pg_catalog.sum(i.amount_usd_cents) filter(where i.kind='earning'),0) net,
    coalesce(pg_catalog.sum(i.amount_usd_cents) filter(where i.kind in ('tip','tip_adjust')),0) tips,
    coalesce(pg_catalog.sum(i.amount_usd_cents) filter(where i.kind='deposit_release'),0) released,
    coalesce(pg_catalog.sum(i.amount_usd_cents) filter(where i.kind='adjustment'),0) adjust,
    coalesce(pg_catalog.sum(i.amount_usd_cents) filter(where i.kind='carry_in'),0) carried,
    coalesce(-pg_catalog.sum(i.amount_usd_cents) filter(where i.kind='order_hold'),0) auto_held,
    coalesce(pg_catalog.sum(i.amount_usd_cents) filter(where i.kind='hold_release'),0) hold_released,
    coalesce(pg_catalog.sum(i.amount_usd_cents),0) total
    from public.payout_line_items i where i.line_id=p_line_id)
  select pg_catalog.jsonb_build_object(
    'id',l.id,'week',pg_catalog.to_char(l.week_start at time zone 'Europe/Vienna','YYYY-MM-DD'),
    'start',public.payout_ms(l.week_start),'end',public.payout_ms(l.week_end),'dueAt',public.payout_ms(l.week_end),
    'teammateId',l.teammate_id,'orders',s.orders,
    'gross',(s.gross+s.tips)/100.0,'tips',s.tips/100.0,'held',s.held/100.0,'net',(s.net+s.tips)/100.0,
    'releasing',s.released/100.0,'adjust',s.adjust/100.0,'carried',s.carried/100.0,
    'autoHeld',(s.auto_held-s.hold_released)/100.0,'total',s.total/100.0,
    'adjustments',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('amount',a.amount_usd_cents/100.0,'reason',a.reason,
       'by',public.payout_person(a.created_by),'at',public.payout_ms(a.created_at)) order by a.created_at)
       from public.payout_line_items i join public.teammate_adjustments a on a.id=i.source_id where i.line_id=l.id and i.kind='adjustment'),'[]'::jsonb),
    'status',case l.status when 'scheduled' then 'Scheduled' when 'on_hold' then 'On hold' when 'paid' then 'Paid' else 'Carried' end,
    'reason',coalesce(l.hold_reason,''),'paidAt',case when l.paid_at is null then null else public.payout_ms(l.paid_at) end,
    'method',l.paid_method,'reference',l.paid_reference)
  from l,s;
$$;

create or replace function public.admin_payouts() returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_actor uuid; v_now timestamptz; v_start timestamptz; v_rows jsonb:='[]'::jsonb; v record; v_p jsonb; v_t jsonb;
begin
  select id into v_actor from public.admin_caller();
  if v_actor is null then return public.order_error(403,'Admins only.'); end if;
  perform public.payout_freeze_due();
  v_now:=pg_catalog.clock_timestamp(); v_start:=public.payout_week_start(v_now);
  select coalesce(pg_catalog.jsonb_agg(public.payout_line_dto(l.id)||public.payout_teammate_dto(l.teammate_id) order by l.week_start desc,l.id),'[]'::jsonb)
    into v_rows from public.payout_lines l where l.status<>'carried';
  -- the running week (not frozen yet) per teammate with anything pending
  for v in select distinct t.id from (
      select e.teammate_id id from public.teammate_earning_entries e where not exists(select 1 from public.payout_line_items i where i.kind='earning' and i.source_id=e.order_id)
      union select a.teammate_id from public.teammate_adjustments a where not exists(select 1 from public.payout_line_items i where i.kind='adjustment' and i.source_id=a.id)
      union select r.teammate_id from public.deposit_releases r where r.state='released' and not exists(select 1 from public.payout_line_items i where i.kind='deposit_release' and i.source_id=r.earning_id)
      union select h.teammate_id from public.payout_order_holds h where h.released_at is not null and not exists(select 1 from public.payout_line_items i where i.kind='hold_release' and i.source_id=h.id)
      union select l.teammate_id from public.payout_lines l where l.status='carried' and l.carried_to is null
      union select tp.teammate_id from public.order_tips tp where tp.paid_at is not null and not exists(select 1 from public.payout_line_items i where i.kind='tip' and i.source_id=tp.id)
      union select m.teammate_id from public.order_tip_movements m where not exists(select 1 from public.payout_line_items i where i.kind='tip_adjust' and i.source_id=m.id)) t loop
    v_p:=public.payout_pending(v.id,v_now);
    if not (v_p->>'active')::boolean then continue; end if;
    v_t:=public.payout_teammate_dto(v.id);
    v_rows:=v_rows||pg_catalog.jsonb_build_array(v_t||pg_catalog.jsonb_build_object(
      'id','accruing:'||v.id,'week',pg_catalog.to_char(v_start at time zone 'Europe/Vienna','YYYY-MM-DD'),
      'start',public.payout_ms(v_start),'end',public.payout_ms(public.payout_week_end(v_start)),'dueAt',public.payout_ms(public.payout_week_end(v_start)),
      'teammateId',v.id,'orders',(v_p->>'orders')::integer,
      'gross',((v_p->>'gross')::bigint+(v_p->>'tips')::bigint)/100.0,'tips',(v_p->>'tips')::bigint/100.0,'held',(v_p->>'held')::bigint/100.0,
      'net',((v_p->>'net')::bigint+(v_p->>'tips')::bigint)/100.0,'releasing',(v_p->>'released')::bigint/100.0,'adjust',(v_p->>'adjust')::bigint/100.0,
      'carried',(v_p->>'carried')::bigint/100.0,'autoHeld',((v_p->>'autoHeld')::bigint)/100.0,
      'total',((v_p->>'net')::bigint+(v_p->>'tips')::bigint+(v_p->>'released')::bigint+(v_p->>'adjust')::bigint+(v_p->>'holdReleased')::bigint+(v_p->>'carried')::bigint-(v_p->>'autoHeld')::bigint)/100.0,
      'adjustments',v_p->'adjustments','status','Accruing','reason','','paidAt',null,'method',null,'reference',null));
  end loop;
  return pg_catalog.jsonb_build_object('now',public.payout_ms(v_now),'weekStart',public.payout_ms(v_start),'minimum',10,
    'payouts',v_rows,
    'teammates',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id',r.user_id,'name',coalesce(nullif(p.name,'Player'),u.email,'Teammate'),'email',coalesce(u.email,''))
      order by pg_catalog.lower(coalesce(nullif(p.name,'Player'),u.email,''))) from public.account_roles r join auth.users u on u.id=r.user_id left join public.profiles p on p.id=r.user_id where r.role='teammate'),'[]'::jsonb));
end $$;

-- Latest definition is 20261025250000_weekly_payouts.sql. Only tipsTotal and the per-order tip in the
-- recent list change: the teammate sees what they keep of each tip (USD, after refunds and disputes).
create or replace function public.teammate_stats() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v_count bigint; v_trust jsonb; v_result jsonb; v_next integer; v_floor integer;
begin
 if v_actor is null then return public.order_error(401,'Authentication required.'); end if;
 perform 1 from public.account_roles where user_id=v_actor and role='teammate';
 if not found then return public.order_error(403,'Teammate role required.'); end if;
 select pg_catalog.count(*) into v_count from public.teammate_earning_entries e join public.order_payments p on p.order_id=e.order_id
   where e.teammate_id=v_actor and p.state<>'refunded' and not exists(select 1 from public.stripe_disputes d where d.order_id=e.order_id);
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
end $$;

-- ---- grants -----------------------------------------------------------------------------------

revoke all on function
  public.tip_payable_usd(public.order_tips),public.tip_sync_payout(uuid,text),public.tip_dto(public.order_tips),
  public.order_tip_prepare(uuid,integer),public.order_tip_status(uuid),
  public.order_tip_attach(uuid,text,integer,numeric),public.order_tip_for_intent(text),
  public.order_tip_record_payment(text,uuid,integer,text),public.order_tip_record_failure(text,text,text),
  public.order_tip_record_refund(text,integer),public.order_tip_record_dispute(text,text,text)
  from public,anon,authenticated,service_role;
grant execute on function public.order_tip_prepare(uuid,integer),public.order_tip_status(uuid) to authenticated;
grant execute on function
  public.order_tip_attach(uuid,text,integer,numeric),public.order_tip_for_intent(text),
  public.order_tip_record_payment(text,uuid,integer,text),public.order_tip_record_failure(text,text,text),
  public.order_tip_record_refund(text,integer),public.order_tip_record_dispute(text,text,text)
  to service_role;
-- create or replace keeps existing grants; restate the payout ones so this file reads complete.
revoke all on function public.payout_freeze_week(timestamptz),public.payout_freeze_due_at(timestamptz),
  public.payout_pending(uuid,timestamptz),public.payout_line_dto(uuid) from public,anon,authenticated,service_role;
revoke all on function public.admin_payouts(),public.teammate_stats() from public,anon,authenticated,service_role;
grant execute on function public.admin_payouts(),public.teammate_stats() to authenticated;

commit;
