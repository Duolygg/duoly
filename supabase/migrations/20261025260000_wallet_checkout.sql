-- Wallet at checkout (ledger #11, MONEY-RULES 2.3, W1 to W7; money step M4).
--
-- The Duoly balance pays first, the card pays the rest. Every amount is computed here from
-- the ledger and the server-priced intent, never taken from the browser.
--
--   checkout_reserve_wallet  holds wallet money for an intent (promo first, then cashable)
--   create_paid_order        converts the holds into spends when the order is created
--   create_wallet_order      same order path with no Stripe payment when the wallet covers it all
--   checkout_release_wallet  gives a hold back when the session expires, fails or is replaced
--   order_wallet_return      cancel or refund of an order returns its wallet part to the same buckets
--
-- Ledger shape (append-only, balance = sum): a hold is a negative checkout_hold row. Paying
-- writes a checkout_release that reverses the hold plus a checkout_spend of the same amount
-- and bucket. Expiry writes only the reversing checkout_release. Cancel or refund writes a
-- checkout_release that reverses the spend. reverses_id is unique, so no hold or spend can be
-- given back twice, and the existing guard keeps each bucket at or above zero.
--
-- Stripe minimum (0.50 EUR): if the wallet covers the total it pays everything; otherwise the
-- hold is reduced so the card part is at least 0.50 EUR. The card is never charged below
-- Stripe's minimum and the customer never pays more than the order price.
--
-- Teammate pay is unchanged: payout_usd_cents still comes from the full order price.
--
-- Deploy order: apply this migration first, then deploy the code. The old code keeps working
-- against it (wallet_eur_cents defaults to 0 and create_paid_order keeps its signature).
begin;

alter table public.checkout_intents
  add column wallet_eur_cents integer not null default 0,
  add constraint checkout_intents_wallet_split check (
    wallet_eur_cents between 0 and amount_eur_cents
    and (wallet_eur_cents = 0 or wallet_eur_cents = amount_eur_cents or amount_eur_cents - wallet_eur_cents >= 50));

alter table public.orders
  add column wallet_eur_cents integer not null default 0,
  add constraint orders_wallet_split check (wallet_eur_cents between 0 and amount_eur_cents);

-- order_payments.amount_eur_cents is the card part; with a wallet share it can be as low as 0.50 EUR.
alter table public.order_payments
  drop constraint order_payments_amount_eur_cents_check,
  add constraint order_payments_amount_eur_cents_check check (amount_eur_cents between 50 and 100000);

alter table public.wallet_entries
  add column checkout_intent_id uuid references public.checkout_intents(id) on delete restrict,
  add column reverses_id uuid references public.wallet_entries(id) on delete restrict,
  add constraint wallet_entries_checkout_links check (
    (kind <> 'checkout_hold' or (checkout_intent_id is not null and reverses_id is null))
    and (kind <> 'checkout_spend' or (checkout_intent_id is not null and order_id is not null and reverses_id is null))
    and (kind <> 'checkout_release' or reverses_id is not null)
    and (reverses_id is null or kind = 'checkout_release'));
create unique index wallet_entries_reverse_once on public.wallet_entries(reverses_id) where reverses_id is not null;
create unique index wallet_entries_hold_once on public.wallet_entries(checkout_intent_id, cashable) where kind = 'checkout_hold';
create unique index wallet_entries_spend_once on public.wallet_entries(checkout_intent_id, cashable) where kind = 'checkout_spend';
create index wallet_entries_order on public.wallet_entries(order_id) where order_id is not null;

-- A release must give back exactly one hold or spend: same customer, same bucket, same amount.
create function public.wallet_entry_link_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare r public.wallet_entries; i public.checkout_intents;
begin
  if new.kind = 'checkout_release' then
    select * into r from public.wallet_entries where id = new.reverses_id;
    if r.id is null or r.kind not in ('checkout_hold','checkout_spend') or r.customer_id <> new.customer_id
       or r.cashable <> new.cashable or r.amount_eur_cents <> -new.amount_eur_cents
       or r.checkout_intent_id is distinct from new.checkout_intent_id then
      raise sqlstate 'PT409' using message = 'A wallet release must reverse one hold or spend exactly.';
    end if;
  end if;
  if new.kind in ('checkout_hold','checkout_spend') then
    select * into i from public.checkout_intents where id = new.checkout_intent_id;
    if i.customer_id is distinct from new.customer_id then
      raise sqlstate 'PT409' using message = 'Wallet checkout rows must belong to the intent''s customer.';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.wallet_entry_link_guard() from public, anon, authenticated, service_role;
create trigger wallet_entries_link_guard before insert on public.wallet_entries
  for each row execute function public.wallet_entry_link_guard();

-- Spent now nets out wallet parts given back by a cancel or refund; held is money reserved by
-- open checkouts (appended column).
create or replace view public.wallet_balances as
select p.id as customer_id,
  coalesce(pg_catalog.sum(e.amount_eur_cents),0)::bigint as total_eur_cents,
  coalesce(pg_catalog.sum(e.amount_eur_cents) filter(where e.cashable),0)::bigint as cashable_eur_cents,
  coalesce(pg_catalog.sum(e.amount_eur_cents) filter(where not e.cashable),0)::bigint as promo_eur_cents,
  coalesce(pg_catalog.sum(e.amount_eur_cents) filter(where e.kind='refund'),0)::bigint as refunds_eur_cents,
  coalesce(pg_catalog.sum(e.amount_eur_cents) filter(where e.kind in ('cashback','cashback_reversal')),0)::bigint as cashback_eur_cents,
  coalesce(pg_catalog.sum(e.amount_eur_cents) filter(where e.kind='level_gift'),0)::bigint as level_gifts_eur_cents,
  coalesce(pg_catalog.sum(e.amount_eur_cents) filter(where e.kind='bounty'),0)::bigint as bounty_eur_cents,
  coalesce(pg_catalog.sum(e.amount_eur_cents) filter(where e.kind in ('admin_credit','admin_debit')),0)::bigint as admin_eur_cents,
  (coalesce(-pg_catalog.sum(e.amount_eur_cents) filter(where e.kind='checkout_spend'),0)
    - coalesce(pg_catalog.sum(e.amount_eur_cents) filter(where e.kind='checkout_release' and r.kind='checkout_spend'),0))::bigint as spent_eur_cents,
  (coalesce(-pg_catalog.sum(e.amount_eur_cents) filter(where e.kind='checkout_hold'),0)
    - coalesce(pg_catalog.sum(e.amount_eur_cents) filter(where e.kind='checkout_release' and r.kind='checkout_hold'),0))::bigint as held_eur_cents
from public.profiles p
left join public.wallet_entries e on e.customer_id=p.id
left join public.wallet_entries r on r.id=e.reverses_id
group by p.id;
revoke all on public.wallet_balances from public,anon,authenticated,service_role;
grant select on public.wallet_balances to service_role;

-- Pure split rule, mirrored in src/server/payments/wallet.ts for display.
create function public.checkout_wallet_split(p_total integer, p_available bigint) returns integer
language sql immutable security invoker set search_path = '' as $$
  select case
    when p_total is null or p_total <= 0 or p_available is null or p_available <= 0 then 0
    when p_available >= p_total then p_total
    when p_total - p_available >= 50 then p_available::integer
    else greatest(0, p_total - 50)
  end;
$$;

-- Unreversed holds of one intent, per bucket.
create function public.checkout_open_holds(p_intent_id uuid) returns setof public.wallet_entries
language sql stable security invoker set search_path = '' as $$
  select h.* from public.wallet_entries h
   where h.checkout_intent_id = p_intent_id and h.kind = 'checkout_hold'
     and not exists (select 1 from public.wallet_entries x where x.reverses_id = h.id)
   order by h.cashable, h.id;
$$;

-- Server only (service role): reserve wallet money for an open intent. Idempotent.
create function public.checkout_reserve_wallet(p_intent_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare i public.checkout_intents; v_promo bigint; v_cashable bigint; v_use integer; v_take integer;
begin
  select * into i from public.checkout_intents where id = p_intent_id for update;
  if i.id is null then return public.order_error(404, 'Checkout not found.'); end if;
  if exists (select 1 from public.wallet_entries where checkout_intent_id = i.id and kind = 'checkout_hold') then
    return pg_catalog.jsonb_build_object('wallet_eur_cents', i.wallet_eur_cents,
      'card_eur_cents', i.amount_eur_cents - i.wallet_eur_cents);
  end if;
  if i.status <> 'open' or i.stripe_session_id is not null or i.order_id is not null then
    return public.order_error(409, 'This checkout already started.');
  end if;
  -- Same per-customer lock as the ledger guard: reservations for one customer run one at a time.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(i.customer_id::text,713));
  select coalesce(b.promo_eur_cents,0), coalesce(b.cashable_eur_cents,0) into v_promo, v_cashable
    from public.wallet_balances b where b.customer_id = i.customer_id;
  v_use := public.checkout_wallet_split(i.amount_eur_cents, greatest(coalesce(v_promo,0),0) + greatest(coalesce(v_cashable,0),0));
  if v_use > 0 then
    v_take := least(v_use, greatest(v_promo,0))::integer;
    if v_take > 0 then
      insert into public.wallet_entries(customer_id, amount_eur_cents, kind, cashable, checkout_intent_id, reason)
        values (i.customer_id, -v_take, 'checkout_hold', false, i.id, 'Held for checkout');
    end if;
    if v_use - v_take > 0 then
      insert into public.wallet_entries(customer_id, amount_eur_cents, kind, cashable, checkout_intent_id, reason)
        values (i.customer_id, -(v_use - v_take), 'checkout_hold', true, i.id, 'Held for checkout');
    end if;
    update public.checkout_intents set wallet_eur_cents = v_use, updated_at = pg_catalog.clock_timestamp() where id = i.id;
  end if;
  return pg_catalog.jsonb_build_object('wallet_eur_cents', v_use, 'card_eur_cents', i.amount_eur_cents - v_use);
end $$;

-- Server only: give back an intent's unreversed holds and close it as expired or failed.
-- Never touches a paid intent (its holds are already spent).
create function public.checkout_release_wallet(p_intent_id uuid, p_status text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare i public.checkout_intents; h public.wallet_entries; v_released integer := 0;
begin
  if p_status not in ('expired','failed','conflict') then raise exception 'invalid checkout status'; end if;
  select * into i from public.checkout_intents where id = p_intent_id for update;
  if i.id is null then return pg_catalog.jsonb_build_object('error', 'unknown_intent'); end if;
  if i.status = 'paid' then return pg_catalog.jsonb_build_object('released', 0, 'status', i.status); end if;
  for h in select * from public.checkout_open_holds(i.id) loop
    insert into public.wallet_entries(customer_id, amount_eur_cents, kind, cashable, checkout_intent_id, reverses_id, reason)
      values (h.customer_id, -h.amount_eur_cents, 'checkout_release', h.cashable, i.id, h.id,
        case p_status when 'expired' then 'Checkout expired' when 'failed' then 'Payment failed' else 'Checkout not completed' end);
    v_released := v_released - h.amount_eur_cents;
  end loop;
  if (p_status = 'expired' and i.status = 'open') or (p_status = 'failed' and i.status in ('open','processing'))
     or (p_status = 'conflict' and i.status in ('open','processing')) then
    update public.checkout_intents set status = p_status, updated_at = pg_catalog.clock_timestamp() where id = i.id
      returning * into i;
  end if;
  return pg_catalog.jsonb_build_object('released', v_released, 'status', i.status);
end $$;

-- Stripe-paid orders are released through Stripe and wallet-paid parts go back to their own
-- buckets (order_wallet_return), so neither creates a refund credit.
create or replace function public.order_post_refund() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.status = 'cancelled' and new.wallet_eur_cents = 0
     and not exists (select 1 from public.order_payments as p where p.order_id = new.id) then
    insert into public.refund_credits(order_id, customer_id, kind, amount_eur_cents)
      values(new.id, new.customer_id, 'queued_refund', new.amount_eur_cents)
      on conflict (order_id, kind) do nothing;
  end if;
  return new;
end;
$$;

-- Cancel (customer, admin, nobody in 5 minutes) or admin/Stripe refund: the wallet part goes
-- back to the buckets it came from, once.
create function public.order_wallet_return() returns trigger
language plpgsql security definer set search_path = '' as $$
declare s public.wallet_entries;
begin
  if new.wallet_eur_cents = 0 then return new; end if;
  if (new.status = 'cancelled' and old.status <> 'cancelled')
     or (new.admin_refunded_at is not null and old.admin_refunded_at is null) then
    for s in select e.* from public.wallet_entries e
      where e.order_id = new.id and e.kind = 'checkout_spend'
        and not exists (select 1 from public.wallet_entries x where x.reverses_id = e.id)
      order by e.cashable, e.id loop
      insert into public.wallet_entries(customer_id, amount_eur_cents, kind, cashable, order_id, checkout_intent_id, reverses_id, reason)
        values (s.customer_id, -s.amount_eur_cents, 'checkout_release', s.cashable, new.id, s.checkout_intent_id, s.id,
          case when new.status = 'cancelled' then 'Order cancelled' else 'Order refunded' end);
    end loop;
  end if;
  return new;
end $$;
revoke all on function public.order_wallet_return() from public, anon, authenticated, service_role;
create trigger orders_wallet_return after update of status, admin_refunded_at on public.orders
  for each row execute function public.order_wallet_return();

-- Called by the server after a verified webhook (card part) or by create_wallet_order (no card
-- part). Idempotent per intent. Wallet holds become spends in the same transaction.
create or replace function public.create_paid_order(
  p_intent_id uuid, p_payment_intent text, p_amount_minor integer, p_currency text,
  p_method text, p_state text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare i public.checkout_intents; p public.profiles; v_order uuid; v_held bigint; h public.wallet_entries;
begin
  if p_state not in ('authorized','captured','wallet') then raise exception 'invalid payment state'; end if;
  select * into i from public.checkout_intents where id = p_intent_id for update;
  if i.id is null then return pg_catalog.jsonb_build_object('error', 'unknown_intent'); end if;
  if i.order_id is not null then
    return pg_catalog.jsonb_build_object('order_id', i.order_id, 'created', false);
  end if;
  if i.status = 'conflict' then return pg_catalog.jsonb_build_object('conflict', true); end if;
  -- A card payment needs a card part; a wallet-only order needs the wallet to cover everything.
  if (p_state = 'wallet') <> (i.wallet_eur_cents = i.amount_eur_cents)
     or (p_state = 'wallet') <> (p_payment_intent is null)
     or (p_state = 'wallet' and (p_amount_minor <> 0 or pg_catalog.lower(p_currency) <> 'eur'))
     or (p_state <> 'wallet' and pg_catalog.lower(p_currency) = 'eur'
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
  select * into p from public.profiles where id = i.customer_id;
  insert into public.orders(customer_id, game, service, title, units, unit, gg, rank, region, ign, note, voice,
      customer_name, customer_image, customer_country, amount_eur_cents, booking_fx, payout_usd_cents, wallet_eur_cents)
    values (i.customer_id, i.game, i.service, i.title, i.units, i.unit, i.gg, i.rank, i.region, i.ign, i.note, i.voice,
      pg_catalog.left(coalesce(nullif(pg_catalog.btrim(p.name), ''), 'Player'), 40),
      case when p.image ~ '^/assets/avatars/avatar-([1-9]|10)\.png$' then p.image else '' end,
      case when pg_catalog.lower(p.country) ~ '^[a-z]{2}$' then pg_catalog.lower(p.country) else '' end,
      i.amount_eur_cents, i.booking_fx, i.payout_usd_cents, i.wallet_eur_cents)
    returning id into v_order;
  if p_state <> 'wallet' then
    insert into public.order_payments(order_id, intent_id, stripe_payment_intent_id, amount_minor, currency,
        amount_eur_cents, payment_method_type, state)
      values (v_order, i.id, p_payment_intent, p_amount_minor, pg_catalog.lower(p_currency),
        i.amount_eur_cents - i.wallet_eur_cents, pg_catalog.left(coalesce(p_method, ''), 40), p_state);
  end if;
  for h in select * from public.checkout_open_holds(i.id) loop
    insert into public.wallet_entries(customer_id, amount_eur_cents, kind, cashable, order_id, checkout_intent_id, reverses_id, reason)
      values (h.customer_id, -h.amount_eur_cents, 'checkout_release', h.cashable, v_order, i.id, h.id, 'Hold used for order');
    insert into public.wallet_entries(customer_id, amount_eur_cents, kind, cashable, order_id, checkout_intent_id, reason)
      values (h.customer_id, h.amount_eur_cents, 'checkout_spend', h.cashable, v_order, i.id, 'Paid for order');
  end loop;
  update public.checkout_intents set status = 'paid', order_id = v_order, stripe_payment_intent_id = p_payment_intent,
    updated_at = pg_catalog.clock_timestamp() where id = i.id;
  return pg_catalog.jsonb_build_object('order_id', v_order, 'created', true);
end $$;

-- Server only: the wallet covers the whole order, so there is no Stripe session at all.
create function public.create_wallet_order(p_intent_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  return public.create_paid_order(p_intent_id, null, 0, 'eur', 'wallet', 'wallet');
end $$;

-- Server backstop (payments tick): intents past their session lifetime that still hold wallet money.
create function public.checkout_stale_wallet_holds(p_limit integer default 20) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id', q.id, 'status', q.status,
    'stripe_session_id', q.stripe_session_id)), '[]'::jsonb)
  from (select i.id, i.status, i.stripe_session_id from public.checkout_intents i
    where i.status <> 'paid' and i.expires_at < pg_catalog.clock_timestamp() - interval '10 minutes'
      and exists (select 1 from public.checkout_open_holds(i.id))
    order by i.expires_at limit greatest(1, least(coalesce(p_limit, 20), 100))) q;
$$;

-- Wallet-paid orders refunded by an admin: the wallet part goes back (order_wallet_return).
-- Card parts still go through Stripe exactly as before.
create or replace function public.admin_refund_order(p_order_id uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
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
    if v_order.wallet_eur_cents = 0 then return public.order_error(409, 'This order has no Stripe payment to refund.'); end if;
    if v_order.admin_refunded_at is not null then return pg_catalog.jsonb_build_object('orderId',v_order.id,'paymentState','refunded'); end if;
    update public.orders set admin_refunded_at=pg_catalog.clock_timestamp(),admin_refund_reason=v_reason where id=v_order.id;
    perform public.admin_log(v_actor, v_actor_name, 'Refunded order', v_order.public_reference,
      pg_catalog.concat('€', pg_catalog.to_char(v_order.amount_eur_cents / 100.0, 'FM999999990.00'), ' to Duoly balance · ', v_reason));
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
$$;

-- Signed-in customer: own spendable balance for the checkout toggle (EUR cents).
create function public.customer_wallet_balance() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); b public.wallet_balances;
begin
  if v_actor is null then return public.order_error(401, 'Authentication required.'); end if;
  if not exists(select 1 from public.account_roles r where r.user_id=v_actor and r.role='customer') then
    return public.order_error(403, 'Customer role required.');
  end if;
  select * into b from public.wallet_balances w where w.customer_id = v_actor;
  return pg_catalog.jsonb_build_object('total_eur_cents', greatest(coalesce(b.total_eur_cents,0),0),
    'promo_eur_cents', greatest(coalesce(b.promo_eur_cents,0),0),
    'cashable_eur_cents', greatest(coalesce(b.cashable_eur_cents,0),0),
    'held_eur_cents', coalesce(b.held_eur_cents,0));
end $$;

revoke all on function public.checkout_wallet_split(integer,bigint), public.checkout_open_holds(uuid),
  public.checkout_reserve_wallet(uuid), public.checkout_release_wallet(uuid,text),
  public.create_wallet_order(uuid), public.checkout_stale_wallet_holds(integer),
  public.customer_wallet_balance() from public, anon, authenticated, service_role;
grant execute on function public.checkout_reserve_wallet(uuid), public.checkout_release_wallet(uuid,text),
  public.create_wallet_order(uuid), public.checkout_stale_wallet_holds(integer) to service_role;
grant execute on function public.customer_wallet_balance() to authenticated;
-- Preserve existing callers and grants after CREATE OR REPLACE.
revoke all on function public.create_paid_order(uuid,text,integer,text,text,text), public.admin_refund_order(uuid,text),
  public.order_post_refund() from public, anon, authenticated, service_role;
grant execute on function public.create_paid_order(uuid,text,integer,text,text,text) to service_role;
grant execute on function public.admin_refund_order(uuid,text) to authenticated;

commit;
