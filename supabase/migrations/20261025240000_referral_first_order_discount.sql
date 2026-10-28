-- Ledger #28 follow-up (owner decisions 2026-10-27): a visitor who arrives through an active
-- creator's link (and accepted the optional referral cookie) gets 10% off their first order.
-- Duoly covers the discount: the teammate payout stays computed on the full price, and the
-- creator commission is calculated on what the customer actually paid (order_referrals copies
-- the order amount). Additive only: one column and one service-role function.
begin;

alter table public.checkout_intents
  add column first_order_discount_cents integer not null default 0
    check (first_order_discount_cents >= 0 and first_order_discount_cents <= 10000);

-- True when p_code is an active creator code and the customer has never had an order and has
-- no other discounted checkout still open. Called by the checkout handler before pricing.
create function public.referral_first_order_discount_eligible(p_customer uuid, p_code text)
returns boolean
language sql stable security definer set search_path = '' as $$
  select p_customer is not null
    and p_code is not null
    and exists (select 1 from public.creators as c where c.code = p_code and c.active)
    and not exists (select 1 from public.orders as o where o.customer_id = p_customer)
    and not exists (
      select 1 from public.checkout_intents as i
      where i.customer_id = p_customer
        and i.first_order_discount_cents > 0
        and i.order_id is null
        and i.expires_at > pg_catalog.clock_timestamp());
$$;
revoke all on function public.referral_first_order_discount_eligible(uuid, text)
  from public, anon, authenticated;
grant execute on function public.referral_first_order_discount_eligible(uuid, text) to service_role;

commit;
