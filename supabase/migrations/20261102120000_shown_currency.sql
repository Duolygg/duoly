-- Show customers what they actually paid, in the currency they paid in (owner request 2026-11-02).
--
-- 1. order_customer_dto gains 'payment': what Stripe charged for the card part (amount in minor
--    units, currency, payment method type; null for an order paid fully from the wallet or free)
--    and the part paid from the Duoly wallet. With Adaptive
--    Pricing a US customer is charged in USD although the order is priced in EUR; the order room
--    now shows that amount instead of the EUR price. Otherwise identical to the
--    20261026160000_perks.sql version.
-- 2. order_tips gains shown_currency / shown_amount_cents: the amount the customer picked in their
--    own currency ($5). The tip is still charged in EUR (amount_cents, converted at the customer
--    rate by the server); these columns are only what the order room repeats back to them.
--    order_tip_set_shown (service role) records them right after order_review_tip.
-- 3. tip_dto gains 'shown' (null when the tip was picked in EUR).
--
-- Deploy the code first: the customer contracts accept the new keys being there or missing, but
-- the code that is live today rejects keys it doesn't know.
begin;

alter table public.order_tips
  add column shown_currency text check (shown_currency is null or shown_currency = 'USD'),
  add column shown_amount_cents integer check (shown_amount_cents is null or shown_amount_cents between 100 and 10000),
  add constraint order_tips_shown_pair check ((shown_currency is null) = (shown_amount_cents is null));

create or replace function public.tip_dto(p_tip public.order_tips) returns jsonb
language sql stable security invoker set search_path='' as $$
  select case when p_tip.id is null then null else pg_catalog.jsonb_build_object(
    'amount',p_tip.amount_cents/100.0,'currency','EUR','state',p_tip.state,
    'refunded',p_tip.refunded_cents/100.0,
    'paidAt',case when p_tip.paid_at is null then null else public.payout_ms(p_tip.paid_at) end,
    'shown',case when p_tip.shown_currency is null then null else pg_catalog.jsonb_build_object(
      'currency',p_tip.shown_currency,'amount',p_tip.shown_amount_cents/100.0) end) end;
$$;

-- Records the customer's own-currency amount on a tip that hasn't been paid yet. Service role only:
-- the server converts and calls it right after order_review_tip created the tip.
create function public.order_tip_set_shown(p_tip_id uuid, p_currency text, p_amount_cents integer) returns boolean
language plpgsql security definer set search_path='' as $$
begin
  if p_currency is distinct from 'USD' or p_amount_cents is null or p_amount_cents not between 100 and 10000 then
    raise exception 'invalid shown tip';
  end if;
  update public.order_tips set shown_currency=p_currency, shown_amount_cents=p_amount_cents,
    updated_at=pg_catalog.clock_timestamp()
  where id=p_tip_id and state='pending' and stripe_payment_intent_id is null;
  return found;
end $$;

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
    'free_perk',public.order_is_free_perk(p_order.id),
    'payment',(select pg_catalog.jsonb_build_object('amount_minor',op.amount_minor,'currency',pg_catalog.upper(op.currency),
        'method',op.payment_method_type,'wallet_eur_cents',p_order.wallet_eur_cents)
      from (select 1) one left join public.order_payments op on op.order_id=p_order.id));
$function$;

-- Grants exactly as before (CREATE OR REPLACE keeps them; restated so a fresh database matches).
revoke all on function public.order_customer_dto(public.orders), public.tip_dto(public.order_tips),
  public.order_tip_set_shown(uuid,text,integer) from public, anon, authenticated, service_role;
grant execute on function public.order_tip_set_shown(uuid,text,integer) to service_role;

commit;
