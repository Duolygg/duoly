-- Admin Orders (read-only): every order with customer, teammate and its Stripe payment trail.
-- Port of the read side of the original app/api/admin/stats (orders) for components/admin/Orders.jsx.
begin;

create function public.admin_orders(p_limit integer default 500) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.admin_caller()) then return public.order_error(403, 'Admins only.'); end if;
  return pg_catalog.jsonb_build_object('orders', coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id', o.public_reference, 'orderId', o.id, 'status', o.status,
      'game', o.game, 'service', o.title, 'units', o.units, 'unit', o.unit, 'gg', o.gg,
      'rank', o.rank, 'region', o.region, 'voice', o.voice,
      'amountCents', o.amount_eur_cents, 'payoutUsdCents', o.payout_usd_cents, 'fx', o.booking_fx,
      'createdAt', o.created_at, 'queuedAt', o.queued_at, 'acceptedAt', o.accepted_at,
      'completedAt', o.completed_at, 'cancelledAt', o.cancelled_at, 'cancelReason', o.cancel_reason,
      'rerolls', o.rerolls,
      'customerId', o.customer_id, 'customer', o.customer_name, 'customerAv', o.customer_image,
      'teammateId', o.assigned_teammate_id, 'teammate', tp.name, 'teammateAv', tp.image,
      'payment', case when pay.order_id is null then null else pg_catalog.jsonb_build_object(
        'method', pay.payment_method_type, 'state', pay.state, 'settle', pay.settle,
        'currency', pay.currency, 'amountMinor', pay.amount_minor, 'error', pay.last_error,
        'stripeId', pay.stripe_payment_intent_id) end,
      'refundCents', (select pg_catalog.sum(c.amount_eur_cents) from public.refund_credits as c where c.order_id = o.id))
      order by o.created_at desc)
    from (select * from public.orders order by created_at desc limit greatest(1, least(coalesce(p_limit, 500), 2000))) as o
    left join public.profiles as tp on tp.id = o.assigned_teammate_id
    left join public.order_payments as pay on pay.order_id = o.id), '[]'::jsonb));
end;
$$;
revoke all on function public.admin_orders(integer) from public, anon, authenticated, service_role;
grant execute on function public.admin_orders(integer) to authenticated;

commit;
