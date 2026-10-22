-- Stripe payments: checkout intents, payment state per order, webhook dedupe.
-- Orders are created only by create_paid_order(), called by the server after a
-- verified Stripe webhook (service role). Browsers never create orders or set prices.
--
-- Money model (owner decision 2026-10-22): cards, wallets, PayPal, Klarna, Amazon Pay
-- and Revolut Pay are authorized at checkout and captured when a teammate accepts;
-- if the order is cancelled first the authorization is released (no refund).
-- Methods that cannot be authorized are captured at checkout and refunded only when
-- the order is cancelled (the exception). Stripe-paid orders get no wallet credit.
begin;

create table public.checkout_intents (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'open'
    check (status in ('open','processing','paid','expired','failed','conflict')),
  game text not null check (game in ('lol','val','cs2','fn','cod','apex','r6','mr','ow','rl','tft','fc','arc','mc','pu')),
  service text not null check (pg_catalog.char_length(service) between 1 and 64),
  title text not null check (pg_catalog.char_length(title) between 1 and 80),
  units integer not null check (units between 1 and 10),
  unit text not null check (unit in ('game','hour')),
  gg boolean not null default false,
  rank text not null default '' check (pg_catalog.char_length(rank) <= 40),
  region text not null check (pg_catalog.char_length(region) between 2 and 80),
  ign text not null check (pg_catalog.char_length(ign) between 2 and 40),
  note text not null default '' check (pg_catalog.char_length(note) <= 200),
  voice boolean not null default false,
  amount_eur_cents integer not null check (amount_eur_cents between 99 and 100000),
  payout_usd_cents integer not null check (payout_usd_cents between 99 and 10000000),
  booking_fx numeric(12,6) not null check (booking_fx between 0.01 and 100),
  stripe_session_id text unique check (stripe_session_id ~ '^cs_(test|live)_[A-Za-z0-9]+$'),
  stripe_client_secret text,
  stripe_payment_intent_id text unique check (stripe_payment_intent_id ~ '^pi_[A-Za-z0-9]+$'),
  order_id uuid unique references public.orders(id) on delete restrict,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  expires_at timestamptz not null,
  check ((status = 'paid') = (order_id is not null))
);
create index checkout_intents_customer on public.checkout_intents(customer_id, created_at desc);

create table public.order_payments (
  order_id uuid primary key references public.orders(id) on delete restrict,
  intent_id uuid not null unique references public.checkout_intents(id) on delete restrict,
  stripe_payment_intent_id text not null unique check (stripe_payment_intent_id ~ '^pi_[A-Za-z0-9]+$'),
  amount_minor integer not null check (amount_minor > 0),
  currency text not null check (currency ~ '^[a-z]{3}$'),
  amount_eur_cents integer not null check (amount_eur_cents between 99 and 100000),
  payment_method_type text not null default '' check (pg_catalog.char_length(payment_method_type) <= 40),
  state text not null check (state in ('authorized','captured','voided','refunded','capture_failed','release_failed')),
  -- Pending money action derived from the order's state machine.
  settle text not null default 'none' check (settle in ('none','capture','release')),
  attempts integer not null default 0 check (attempts >= 0),
  last_error text check (pg_catalog.char_length(last_error) <= 300),
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp()
);
create index order_payments_pending on public.order_payments(updated_at) where settle <> 'none';

create table public.stripe_events (
  id text primary key check (id ~ '^evt_[A-Za-z0-9]+$'),
  type text not null check (pg_catalog.char_length(type) <= 80),
  received_at timestamptz not null default pg_catalog.clock_timestamp()
);

alter table public.checkout_intents enable row level security;
alter table public.order_payments enable row level security;
alter table public.stripe_events enable row level security;
revoke all on table public.checkout_intents, public.order_payments, public.stripe_events
  from public, anon, authenticated, service_role;
grant select, insert, update on table public.checkout_intents, public.order_payments to service_role;
grant select, insert on table public.stripe_events to service_role;

-- Order state drives money: accept captures, cancel releases.
create function public.order_payment_settle() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'in_progress' and old.status = 'queued' then
    update public.order_payments set settle = 'capture', updated_at = pg_catalog.clock_timestamp()
     where order_id = new.id and state = 'authorized' and settle = 'none';
  elsif new.status = 'cancelled' and old.status <> 'cancelled' then
    update public.order_payments set settle = 'release', updated_at = pg_catalog.clock_timestamp()
     where order_id = new.id and state in ('authorized','captured','capture_failed');
  end if;
  return new;
end $$;
revoke all on function public.order_payment_settle() from public, anon, authenticated, service_role;
create trigger orders_payment_settle after update of status on public.orders
  for each row execute function public.order_payment_settle();

-- Stripe-paid orders are released through Stripe, never as wallet credit.
create or replace function public.order_post_refund() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.status = 'cancelled'
     and not exists (select 1 from public.order_payments as p where p.order_id = new.id) then
    insert into public.refund_credits(order_id, customer_id, kind, amount_eur_cents)
      values(new.id, new.customer_id, 'queued_refund', new.amount_eur_cents)
      on conflict (order_id, kind) do nothing;
  end if;
  return new;
end;
$$;

-- Called by the server after a verified webhook. Idempotent per intent.
create function public.create_paid_order(
  p_intent_id uuid, p_payment_intent text, p_amount_minor integer, p_currency text,
  p_method text, p_state text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare i public.checkout_intents; p public.profiles; v_order uuid;
begin
  if p_state not in ('authorized','captured') then raise exception 'invalid payment state'; end if;
  select * into i from public.checkout_intents where id = p_intent_id for update;
  if i.id is null then return pg_catalog.jsonb_build_object('error', 'unknown_intent'); end if;
  if i.order_id is not null then
    return pg_catalog.jsonb_build_object('order_id', i.order_id, 'created', false);
  end if;
  if i.status = 'conflict' then return pg_catalog.jsonb_build_object('conflict', true); end if;
  -- Serialize per customer, then enforce one open order.
  perform 1 from public.profiles where id = i.customer_id for update;
  perform public.order_sweep(100);
  if exists (select 1 from public.orders where customer_id = i.customer_id and status in ('queued','in_progress')) then
    update public.checkout_intents set status = 'conflict', stripe_payment_intent_id = p_payment_intent,
      updated_at = pg_catalog.clock_timestamp() where id = i.id;
    return pg_catalog.jsonb_build_object('conflict', true);
  end if;
  select * into p from public.profiles where id = i.customer_id;
  insert into public.orders(customer_id, game, service, title, units, unit, gg, rank, region, ign, note, voice,
      customer_name, customer_image, customer_country, amount_eur_cents, booking_fx, payout_usd_cents)
    values (i.customer_id, i.game, i.service, i.title, i.units, i.unit, i.gg, i.rank, i.region, i.ign, i.note, i.voice,
      pg_catalog.left(coalesce(nullif(pg_catalog.btrim(p.name), ''), 'Player'), 40),
      case when p.image ~ '^/assets/avatars/avatar-([1-9]|10)\.png$' then p.image else '' end,
      case when pg_catalog.lower(p.country) ~ '^[a-z]{2}$' then pg_catalog.lower(p.country) else '' end,
      i.amount_eur_cents, i.booking_fx, i.payout_usd_cents)
    returning id into v_order;
  insert into public.order_payments(order_id, intent_id, stripe_payment_intent_id, amount_minor, currency,
      amount_eur_cents, payment_method_type, state)
    values (v_order, i.id, p_payment_intent, p_amount_minor, pg_catalog.lower(p_currency), i.amount_eur_cents,
      pg_catalog.left(coalesce(p_method, ''), 40), p_state);
  update public.checkout_intents set status = 'paid', order_id = v_order, stripe_payment_intent_id = p_payment_intent,
    updated_at = pg_catalog.clock_timestamp() where id = i.id;
  return pg_catalog.jsonb_build_object('order_id', v_order, 'created', true);
end $$;

-- Claim pending capture/release work (server only); rows stay pending until done.
create function public.claim_payment_settlements(p_limit integer default 20) returns setof public.order_payments
language sql security definer set search_path = '' as $$
  update public.order_payments as p set attempts = p.attempts + 1, updated_at = pg_catalog.clock_timestamp()
   where p.order_id in (select q.order_id from public.order_payments as q
     where q.settle <> 'none' and q.attempts < 20
     order by q.updated_at limit greatest(1, least(p_limit, 100)) for update skip locked)
  returning p.*;
$$;

create function public.finish_payment_settlement(p_order_id uuid, p_state text, p_error text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_state not in ('captured','voided','refunded','capture_failed','release_failed','retry') then
    raise exception 'invalid settlement state';
  end if;
  if p_state = 'retry' then
    update public.order_payments set last_error = pg_catalog.left(p_error, 300) where order_id = p_order_id;
  else
    update public.order_payments set state = p_state,
      settle = case when p_state = 'capture_failed' and settle = 'release' then settle else 'none' end,
      last_error = pg_catalog.left(p_error, 300), updated_at = pg_catalog.clock_timestamp()
     where order_id = p_order_id;
  end if;
end $$;

-- Customer polling on the return page: own intent only.
create function public.customer_checkout_status(p_intent_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce((select pg_catalog.jsonb_build_object('status', i.status, 'order_id', i.order_id)
    from public.checkout_intents as i where i.id = p_intent_id and i.customer_id = (select auth.uid())),
    pg_catalog.jsonb_build_object('error', 'not_found'));
$$;

revoke all on function public.create_paid_order(uuid,text,integer,text,text,text),
  public.claim_payment_settlements(integer), public.finish_payment_settlement(uuid,text,text),
  public.customer_checkout_status(uuid) from public, anon, authenticated, service_role;
grant execute on function public.create_paid_order(uuid,text,integer,text,text,text),
  public.claim_payment_settlements(integer), public.finish_payment_settlement(uuid,text,text),
  public.sweep_expired_orders(integer) to service_role;
grant execute on function public.customer_checkout_status(uuid) to authenticated;

commit;
