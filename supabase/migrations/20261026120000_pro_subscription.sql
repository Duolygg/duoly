-- Duoly PRO with Stripe Billing (ledger #39, MONEY-RULES section 7, R1 to R6; money step M8).
-- Owner approved all defaults on 2026-10-27: 4.99 EUR a month, 10% off orders, 7-day trial,
-- Duoly covers the discount (teammate payout stays on the full price).
--
--   pro_billing_customers   one Stripe customer per Duoly account
--   pro_subscriptions       mirror of Stripe subscriptions, written only by the verified webhook
--   pro_trial_cards         card fingerprints that already had a free trial (R4, per card)
--   pro_invoices            invoice.paid / invoice.payment_failed audit (no wallet or loyalty, R5)
--   is_pro(user)            the ONLY source for the PRO discount and PRO re-rolls
--   pro_my_status()         the signed-in customer's own PRO state for the UI
--
-- R6: a failed renewal keeps PRO for 3 days after the subscription first went past_due.
-- As a stale-data guard, trialing and active rows also stop counting 3 days after their
-- current period ended without a newer webhook.
--
-- Discount rules (docs/product/pro.md): the PRO discount is 10% of the server price after
-- bundle discounts and before the wallet split. It never stacks with the creator first-order
-- discount: only one of them applies (checkout_intents_one_discount). The checkout guard
-- below refuses a PRO discount for anyone is_pro() does not accept.
--
-- R2: PRO customers have no limit of 2 re-rolls, still only within 5 minutes of accept.
--
-- R1 priority matching: PRO orders get the M7 Gold head start. order_priority_boosts gains the
-- reason 'pro' (taken before 'loyalty_gold' when both apply); teammate_order_queue is unchanged
-- because it already sorts every boosted order first.
--
-- R3: payout_usd_cents is never touched by the discount. R5: the PRO fee is recorded only in
-- pro_invoices; it never creates wallet_entries, cashback or an order, so it cannot count for loyalty.
--
-- create or replace targets start from their latest definitions on origin/main (96d26c0):
--   reroll_order                   20261022093000_order_foundation.sql
--   order_priority_boost_snapshot  20261026110000_gold_priority_badges.sql
--
-- Deploy order: apply this migration first, then deploy the code. The code calls the new RPCs;
-- the current code keeps working against this schema (new column defaults to 0, reroll_order and
-- the trigger keep their signatures).
begin;

create table public.pro_billing_customers (
  user_id uuid primary key references public.profiles(id) on delete restrict,
  stripe_customer_id text not null unique check (stripe_customer_id ~ '^cus_[A-Za-z0-9]+$'),
  created_at timestamptz not null default pg_catalog.clock_timestamp()
);

create table public.pro_subscriptions (
  stripe_subscription_id text primary key check (stripe_subscription_id ~ '^sub_[A-Za-z0-9]+$'),
  user_id uuid not null references public.profiles(id) on delete restrict,
  stripe_customer_id text not null references public.pro_billing_customers(stripe_customer_id) on delete restrict,
  status text not null check (status in ('incomplete','incomplete_expired','trialing','active',
    'past_due','canceled','unpaid','paused')),
  trial_start timestamptz,
  trial_end timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  ended_at timestamptz,
  past_due_since timestamptz,
  trial_card_checked boolean not null default false,
  last_event_at timestamptz not null,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  check (trial_end is null or trial_start is null or trial_end >= trial_start),
  check ((status = 'past_due') = (past_due_since is not null) or status not in ('active','trialing','past_due'))
);
create index pro_subscriptions_user on public.pro_subscriptions(user_id, updated_at desc);

create table public.pro_trial_cards (
  fingerprint text primary key check (fingerprint ~ '^[A-Za-z0-9]{8,64}$'),
  user_id uuid not null references public.profiles(id) on delete restrict,
  stripe_subscription_id text not null references public.pro_subscriptions(stripe_subscription_id) on delete restrict,
  claimed_at timestamptz not null default pg_catalog.clock_timestamp()
);

create table public.pro_invoices (
  stripe_invoice_id text primary key check (stripe_invoice_id ~ '^in_[A-Za-z0-9]+$'),
  stripe_subscription_id text not null references public.pro_subscriptions(stripe_subscription_id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  state text not null check (state in ('paid','failed')),
  amount_minor integer not null check (amount_minor >= 0),
  currency text not null check (currency ~ '^[a-z]{3}$'),
  last_event_at timestamptz not null,
  updated_at timestamptz not null default pg_catalog.clock_timestamp()
);

alter table public.pro_billing_customers enable row level security;
alter table public.pro_subscriptions enable row level security;
alter table public.pro_trial_cards enable row level security;
alter table public.pro_invoices enable row level security;
revoke all on table public.pro_billing_customers, public.pro_subscriptions, public.pro_trial_cards,
  public.pro_invoices from public, anon, authenticated, service_role;

-- The one rule for PRO perks. Read by checkout pricing (service role), the checkout guard and
-- reroll_order.
create function public.is_pro(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_user is not null and exists (
    select 1 from public.pro_subscriptions as s
    where s.user_id = p_user
      and (
        (s.status in ('trialing','active')
          and (s.current_period_end is null
               or s.current_period_end > pg_catalog.clock_timestamp() - interval '3 days'))
        or (s.status = 'past_due'
          and s.past_due_since > pg_catalog.clock_timestamp() - interval '3 days')));
$$;

-- R4, per customer: one free trial per account. Any earlier subscription (trial or paid) ends it.
create function public.pro_trial_eligible(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_user is not null
    and not exists (select 1 from public.pro_subscriptions as s where s.user_id = p_user);
$$;

create function public.pro_status_dto(p_user uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select pg_catalog.jsonb_build_object(
    'member', public.is_pro(p_user),
    'trial_eligible', public.pro_trial_eligible(p_user),
    'has_customer', exists (select 1 from public.pro_billing_customers as c where c.user_id = p_user),
    'subscription', (
      select pg_catalog.jsonb_build_object(
        'status', s.status,
        'trial_end', s.trial_end,
        'current_period_end', s.current_period_end,
        'cancel_at_period_end', s.cancel_at_period_end,
        'grace_until', case when s.status = 'past_due' then s.past_due_since + interval '3 days' end)
      from public.pro_subscriptions as s
      where s.user_id = p_user
      order by (s.status in ('trialing','active','past_due')) desc, s.updated_at desc
      limit 1));
$$;

-- The signed-in customer's own state. No argument, so nobody can read someone else's.
create function public.pro_my_status() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_actor uuid := auth.uid();
begin
  if v_actor is null then return pg_catalog.jsonb_build_object('error', 'Authentication required.'); end if;
  return public.pro_status_dto(v_actor);
end $$;

create function public.pro_billing_customer(p_user uuid) returns text
language sql stable security definer set search_path = '' as $$
  select c.stripe_customer_id from public.pro_billing_customers as c where c.user_id = p_user;
$$;

-- Links a Stripe customer once; a race keeps the first one and returns it.
create function public.pro_link_customer(p_user uuid, p_customer text) returns text
language plpgsql security definer set search_path = '' as $$
declare v text;
begin
  if p_user is null or not exists (
    select 1 from public.account_roles as r where r.user_id = p_user and r.role = 'customer') then
    raise sqlstate 'PT403' using message = 'Only customers can subscribe to PRO.';
  end if;
  insert into public.pro_billing_customers(user_id, stripe_customer_id) values (p_user, p_customer)
    on conflict (user_id) do nothing;
  select c.stripe_customer_id into v from public.pro_billing_customers as c where c.user_id = p_user;
  return v;
end $$;

-- Mirrors one subscription as Stripe reports it. Idempotent; an older event never overwrites
-- a newer one. Returns {ignored} for unknown customers so Stripe does not retry forever, and
-- {duplicate: true} when the account already has another live subscription (the webhook then
-- cancels the new one).
create function public.pro_apply_subscription(
  p_event_created timestamptz,
  p_subscription text,
  p_customer text,
  p_status text,
  p_trial_start timestamptz,
  p_trial_end timestamptz,
  p_current_period_end timestamptz,
  p_cancel_at_period_end boolean,
  p_canceled_at timestamptz,
  p_ended_at timestamptz,
  p_metadata_user uuid default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid;
  v_old public.pro_subscriptions;
  v_new public.pro_subscriptions;
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_duplicate boolean;
begin
  if p_event_created is null or p_subscription is null or p_status is null then
    raise sqlstate 'PT400' using message = 'Subscription facts are incomplete.';
  end if;
  select c.user_id into v_user from public.pro_billing_customers as c where c.stripe_customer_id = p_customer;
  if v_user is null then return pg_catalog.jsonb_build_object('ignored', 'unknown_customer'); end if;
  if p_metadata_user is not null and p_metadata_user <> v_user then
    return pg_catalog.jsonb_build_object('ignored', 'user_mismatch');
  end if;
  select * into v_old from public.pro_subscriptions where stripe_subscription_id = p_subscription for update;
  if v_old.stripe_subscription_id is not null and v_old.user_id <> v_user then
    return pg_catalog.jsonb_build_object('ignored', 'user_mismatch');
  end if;
  if v_old.stripe_subscription_id is not null and p_event_created < v_old.last_event_at then
    return pg_catalog.jsonb_build_object('ignored', 'stale_event', 'member', public.is_pro(v_user));
  end if;
  v_duplicate := p_status in ('trialing','active','past_due') and exists (
    select 1 from public.pro_subscriptions as s
    where s.user_id = v_user and s.stripe_subscription_id <> p_subscription
      and s.status in ('trialing','active','past_due'));
  insert into public.pro_subscriptions as s (
    stripe_subscription_id, user_id, stripe_customer_id, status, trial_start, trial_end,
    current_period_end, cancel_at_period_end, canceled_at, ended_at, past_due_since, last_event_at)
  values (
    p_subscription, v_user, p_customer, p_status, p_trial_start, p_trial_end,
    p_current_period_end, coalesce(p_cancel_at_period_end, false), p_canceled_at, p_ended_at,
    case when p_status = 'past_due' then p_event_created end, p_event_created)
  on conflict (stripe_subscription_id) do update set
    status = excluded.status,
    trial_start = excluded.trial_start,
    trial_end = excluded.trial_end,
    current_period_end = excluded.current_period_end,
    cancel_at_period_end = excluded.cancel_at_period_end,
    canceled_at = excluded.canceled_at,
    ended_at = excluded.ended_at,
    past_due_since = case
      when excluded.status = 'past_due' then coalesce(s.past_due_since, excluded.last_event_at)
      when excluded.status in ('trialing','active') then null
      else s.past_due_since end,
    last_event_at = excluded.last_event_at,
    updated_at = v_now
  returning * into v_new;
  return pg_catalog.jsonb_build_object(
    'user_id', v_user,
    'status', v_new.status,
    'created', v_old.stripe_subscription_id is null,
    'member', public.is_pro(v_user),
    'duplicate', v_duplicate,
    'trial_check_needed', v_new.status = 'trialing' and not v_new.trial_card_checked);
end $$;

-- R4, per card: the first account to trial with a card fingerprint keeps it. Returns false when
-- the card already had a trial on another account; the webhook then ends this trial at once.
create function public.pro_claim_trial_card(p_subscription text, p_fingerprint text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v public.pro_subscriptions; v_owner uuid;
begin
  select * into v from public.pro_subscriptions where stripe_subscription_id = p_subscription for update;
  if v.stripe_subscription_id is null then raise sqlstate 'PT404' using message = 'Subscription not found.'; end if;
  -- No card yet: stay unchecked so a later webhook (with the card attached) runs the check.
  if p_fingerprint is null then return true; end if;
  insert into public.pro_trial_cards(fingerprint, user_id, stripe_subscription_id)
    values (p_fingerprint, v.user_id, v.stripe_subscription_id)
    on conflict (fingerprint) do nothing;
  select c.user_id into v_owner from public.pro_trial_cards as c where c.fingerprint = p_fingerprint;
  update public.pro_subscriptions set trial_card_checked = true, updated_at = pg_catalog.clock_timestamp()
    where stripe_subscription_id = v.stripe_subscription_id;
  return v_owner is null or v_owner = v.user_id;
end $$;

-- invoice.paid / invoice.payment_failed. Audit only: the subscription row (synced from Stripe
-- in the same webhook) decides membership. PRO fees never touch the wallet or loyalty (R5).
create function public.pro_record_invoice(
  p_event_created timestamptz,
  p_invoice text,
  p_subscription text,
  p_state text,
  p_amount_minor integer,
  p_currency text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v public.pro_subscriptions;
begin
  select * into v from public.pro_subscriptions where stripe_subscription_id = p_subscription;
  if v.stripe_subscription_id is null then return pg_catalog.jsonb_build_object('ignored', 'unknown_subscription'); end if;
  insert into public.pro_invoices as i (stripe_invoice_id, stripe_subscription_id, user_id, state,
      amount_minor, currency, last_event_at)
    values (p_invoice, v.stripe_subscription_id, v.user_id, p_state, p_amount_minor, p_currency, p_event_created)
  on conflict (stripe_invoice_id) do update set
    state = excluded.state, amount_minor = excluded.amount_minor, currency = excluded.currency,
    last_event_at = excluded.last_event_at, updated_at = pg_catalog.clock_timestamp()
    where i.last_event_at <= excluded.last_event_at;
  return pg_catalog.jsonb_build_object('recorded', true, 'state', p_state);
end $$;

revoke all on function public.is_pro(uuid), public.pro_trial_eligible(uuid), public.pro_status_dto(uuid),
  public.pro_my_status(), public.pro_billing_customer(uuid), public.pro_link_customer(uuid, text),
  public.pro_apply_subscription(timestamptz, text, text, text, timestamptz, timestamptz, timestamptz, boolean, timestamptz, timestamptz, uuid),
  public.pro_claim_trial_card(text, text),
  public.pro_record_invoice(timestamptz, text, text, text, integer, text)
  from public, anon, authenticated, service_role;
grant execute on function public.pro_my_status() to authenticated;
grant execute on function public.is_pro(uuid), public.pro_trial_eligible(uuid), public.pro_status_dto(uuid),
  public.pro_billing_customer(uuid), public.pro_link_customer(uuid, text),
  public.pro_apply_subscription(timestamptz, text, text, text, timestamptz, timestamptz, timestamptz, boolean, timestamptz, timestamptz, uuid),
  public.pro_claim_trial_card(text, text),
  public.pro_record_invoice(timestamptz, text, text, text, integer, text)
  to service_role;

-- Checkout: PRO discount column, one discount only, and only for current PRO members.
alter table public.checkout_intents
  add column pro_discount_cents integer not null default 0
    check (pro_discount_cents >= 0 and pro_discount_cents <= 10000),
  add constraint checkout_intents_one_discount
    check (pro_discount_cents = 0 or first_order_discount_cents = 0);

create function public.checkout_pro_discount_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.pro_discount_cents > 0 and not public.is_pro(new.customer_id) then
    raise sqlstate 'PT409' using message = 'The PRO discount needs an active Duoly PRO membership.';
  end if;
  return new;
end $$;
revoke all on function public.checkout_pro_discount_guard() from public, anon, authenticated, service_role;
create trigger checkout_intents_pro_discount_guard
  before insert or update of pro_discount_cents on public.checkout_intents
  for each row execute function public.checkout_pro_discount_guard();

-- R2: PRO re-rolls. Latest definition: 20261022093000_order_foundation.sql (unchanged since).
-- Only the limit check differs: the limit of 2 applies to customers who are not PRO.
alter table public.orders
  drop constraint orders_rerolls_check,
  add constraint orders_rerolls_check check (rerolls >= 0);

create or replace function public.reroll_order(p_order_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v public.orders; v_now timestamptz;
begin
  if v_actor is null then return public.order_error(401, 'Authentication required.'); end if;
  if not exists (select 1 from public.account_roles as r where r.user_id = v_actor and r.role = 'customer') then return public.order_error(403, 'Customer role required.'); end if;
  select o.* into v from public.orders as o where o.id = p_order_id and o.customer_id = v_actor for update;
  if v.id is null then return public.order_error(404, 'Order not found.'); end if;
  if public.order_expire_locked(v.id) or v.status = 'cancelled' then return public.order_error(410, 'Order expired or cancelled.'); end if;
  perform public.order_sweep(100);
  v_now := pg_catalog.clock_timestamp();
  if v.status <> 'in_progress' or (v.rerolls >= 2 and not public.is_pro(v_actor)) or v.accepted_at + interval '5 minutes' < v_now then return public.order_error(409, 'Reroll unavailable.'); end if;
  update public.order_assignments set ended_at = v_now, end_reason = 'customer_reroll' where id = v.current_assignment_id;
  update public.orders set status = 'queued', queued_at = v_now, accepted_at = null, assigned_teammate_id = null, current_assignment_id = null, rerolls = rerolls + 1 where id = v.id returning * into v;
  return pg_catalog.jsonb_build_object('order', public.order_customer_dto(v));
end;
$$;
revoke all on function public.reroll_order(uuid) from public, anon, authenticated, service_role;
grant execute on function public.reroll_order(uuid) to authenticated;

-- R1 priority matching: PRO orders get the same head start as Gold+ (M7).
alter table public.order_priority_boosts
  drop constraint order_priority_boosts_reason_check,
  drop constraint order_priority_boosts_customer_level_check,
  drop constraint order_priority_boosts_prior_completed_count_check,
  add constraint order_priority_boosts_reason_check check (reason in ('loyalty_gold','pro')),
  add constraint order_priority_boosts_level_check check (
    (reason = 'loyalty_gold' and customer_level in ('gold','platinum','diamond') and prior_completed_count >= 250)
    or (reason = 'pro' and customer_level in ('bronze','silver','gold','platinum','diamond') and prior_completed_count >= 0));

-- Latest definition from 20261026110000_gold_priority_badges.sql. Only the PRO branch is added.
create or replace function public.order_priority_boost_snapshot() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_count bigint; v_level jsonb; v_reason text;
begin
  if new.status <> 'queued' then return new; end if;
  v_count := public.loyalty_valid_count(new.customer_id);
  v_level := public.loyalty_level(v_count);
  v_reason := case when public.is_pro(new.customer_id) then 'pro'
                   when (v_level->>'index')::integer >= 2 then 'loyalty_gold' end;
  if v_reason is not null then
    insert into public.order_priority_boosts(order_id,customer_id,reason,customer_level,prior_completed_count,queued_at)
      values(new.id,new.customer_id,v_reason,v_level->>'id',v_count,new.queued_at)
      on conflict(order_id) do update set customer_id=excluded.customer_id,reason=excluded.reason,
        customer_level=excluded.customer_level,prior_completed_count=excluded.prior_completed_count,
        queued_at=excluded.queued_at,created_at=pg_catalog.clock_timestamp();
  else
    delete from public.order_priority_boosts where order_id=new.id;
  end if;
  return new;
end;
$$;
revoke all on function public.order_priority_boost_snapshot() from public, anon, authenticated, service_role;

commit;
