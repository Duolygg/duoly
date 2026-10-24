-- Requires 20261024160000_order_reviews.sql (order_review_dto) to be applied first.
-- Handover links and audited admin order actions.
-- Raw handover tokens are returned once and only their SHA-256 hashes are stored.
begin;

alter table public.orders
  drop constraint orders_cancel_reason_check,
  add constraint orders_cancel_reason_check check (cancel_reason in ('queue_expired','customer_cancelled','admin_cancelled')),
  add column admin_cancel_note text check (admin_cancel_note is null or pg_catalog.char_length(admin_cancel_note) between 3 and 200),
  add column admin_refunded_at timestamptz,
  add column admin_refund_reason text check (admin_refund_reason is null or pg_catalog.char_length(admin_refund_reason) between 3 and 200),
  add constraint orders_admin_refund_check check ((admin_refunded_at is null) = (admin_refund_reason is null));

-- An admin handover can give an order back to a teammate the customer re-rolled away from,
-- which needs a fresh assignment row; keep at most one open assignment per teammate and order.
alter table public.order_assignments drop constraint order_assignments_order_id_teammate_id_key;
create unique index order_assignments_one_open_per_teammate
  on public.order_assignments(order_id, teammate_id) where ended_at is null;

alter table public.order_payments
  drop constraint order_payments_settle_check,
  add constraint order_payments_settle_check check (settle in ('none','capture','release','refund')),
  add column refund_reason text check (refund_reason is null or pg_catalog.char_length(refund_reason) between 3 and 200),
  add column refunded_at timestamptz;

create table public.order_handovers (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_by_name text not null check (pg_catalog.char_length(created_by_name) between 1 and 120),
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revoke_reason text check (revoke_reason in ('replaced','accepted','cancelled','rerolled')),
  check ((revoked_at is null) = (revoke_reason is null)),
  check (expires_at > created_at)
);
create unique index order_handovers_one_active on public.order_handovers(order_id) where revoked_at is null;
create index order_handovers_order_history on public.order_handovers(order_id, created_at desc);
alter table public.order_handovers enable row level security;
revoke all on table public.order_handovers from public, anon, authenticated, service_role;
grant select on table public.order_handovers to service_role;

create function public.revoke_order_handover() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.status = 'queued' and (new.status <> 'queued' or new.queued_at is distinct from old.queued_at) then
    update public.order_handovers
       set revoked_at = pg_catalog.clock_timestamp(),
           revoke_reason = case
             when new.status = 'in_progress' then 'accepted'
             when new.status = 'cancelled' then 'cancelled'
             else 'rerolled'
           end
     where order_id = new.id and revoked_at is null;
  end if;
  return new;
end;
$$;
revoke all on function public.revoke_order_handover() from public, anon, authenticated, service_role;
create trigger orders_revoke_handover after update of status, queued_at on public.orders
  for each row execute function public.revoke_order_handover();

create function public.handover_info(p_token_hash text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_h public.order_handovers;
  v_order public.orders;
  v_access public.teammate_order_access;
begin
  if v_actor is null then return public.order_error(401, 'Please log in.'); end if;
  if not exists (select 1 from public.account_roles r where r.user_id = v_actor and r.role = 'teammate') then
    return public.order_error(403, 'Only teammates can use handover links.');
  end if;
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then
    return pg_catalog.jsonb_build_object('state', 'invalid');
  end if;
  perform public.order_sweep(100);
  select h.* into v_h from public.order_handovers h where h.token_hash = p_token_hash;
  if v_h.id is null then return pg_catalog.jsonb_build_object('state', 'invalid'); end if;
  select o.* into v_order from public.orders o where o.id = v_h.order_id;
  if v_order.status = 'cancelled' then
    return pg_catalog.jsonb_build_object('state', 'cancelled', 'order', public.order_teammate_dto(v_order));
  end if;
  if v_h.revoked_at is not null then
    return pg_catalog.jsonb_build_object('state', case when v_h.revoke_reason = 'accepted' then 'taken' else 'invalid' end,
      'order', public.order_teammate_dto(v_order));
  end if;
  if v_h.expires_at <= pg_catalog.clock_timestamp() then
    return pg_catalog.jsonb_build_object('state', 'expired', 'order', public.order_teammate_dto(v_order));
  end if;
  if v_order.status <> 'queued' then
    return pg_catalog.jsonb_build_object('state', 'taken', 'order', public.order_teammate_dto(v_order));
  end if;
  select a.* into v_access from public.teammate_order_access a where a.user_id = v_actor;
  if v_access.user_id is null or v_access.suspended or v_access.discord_id is null or v_access.discord_verified_at is null then
    return pg_catalog.jsonb_build_object('state', 'blocked', 'reason', 'Connect Discord and make sure your teammate account is active.',
      'order', public.order_teammate_dto(v_order), 'by', v_h.created_by_name, 'expiresAt', v_h.expires_at);
  end if;
  if not ((v_access.gg_access and v_order.gg) or
      (not v_access.gg_access and not v_order.gg and v_order.game = any(v_access.approved_games))) then
    return pg_catalog.jsonb_build_object('state', 'blocked', 'reason', 'This order is outside your approved game access.',
      'order', public.order_teammate_dto(v_order), 'by', v_h.created_by_name, 'expiresAt', v_h.expires_at);
  end if;
  return pg_catalog.jsonb_build_object('state', 'open', 'order', public.order_teammate_dto(v_order),
    'by', v_h.created_by_name, 'expiresAt', v_h.expires_at);
end;
$$;

create function public.accept_handover(p_token_hash text) returns jsonb
language plpgsql security definer set search_path = '' as $$
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
  if not exists (
    select 1 from public.account_roles r
    join public.teammate_order_access a on a.user_id = r.user_id
    where r.user_id = v_actor and r.role = 'teammate' and not a.suspended
      and a.discord_id is not null and a.discord_verified_at is not null
      and ((a.gg_access and v_order.gg) or
        (not a.gg_access and not v_order.gg and v_order.game = any(a.approved_games)))) then
    return public.order_error(403, 'This order is outside your approved game access.');
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
$$;

create function public.admin_create_handover(p_order_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid; v_actor_name text; v_order public.orders; v_token text; v_hash text; v_expires timestamptz;
begin
  select id,name into v_actor,v_actor_name from public.admin_caller();
  if v_actor is null then return public.order_error(403, 'Admins only.'); end if;
  select o.* into v_order from public.orders o where o.id = p_order_id for update;
  if v_order.id is null then return public.order_error(404, 'Order not found.'); end if;
  perform public.order_expire_locked(v_order.id);
  select o.* into v_order from public.orders o where o.id = p_order_id;
  if v_order.status <> 'queued' then return public.order_error(409, 'Only orders still waiting can be handed over.'); end if;
  update public.order_handovers set revoked_at = pg_catalog.clock_timestamp(), revoke_reason = 'replaced'
    where order_id = v_order.id and revoked_at is null;
  v_token := pg_catalog.rtrim(pg_catalog.translate(pg_catalog.encode(extensions.gen_random_bytes(18), 'base64'), '+/', '-_'), '=');
  v_hash := pg_catalog.encode(extensions.digest(v_token, 'sha256'), 'hex');
  insert into public.order_handovers(order_id,token_hash,created_by,created_by_name,expires_at)
    values(v_order.id,v_hash,v_actor,v_actor_name,v_order.queued_at + interval '5 minutes')
    returning expires_at into v_expires;
  perform public.admin_log(v_actor, v_actor_name, 'Created handover link', v_order.public_reference,
    v_order.title || ' · valid until queue expiry');
  return pg_catalog.jsonb_build_object('token', v_token, 'expiresAt', v_expires);
end;
$$;

create function public.admin_cancel_order(p_order_id uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid; v_actor_name text; v_order public.orders; v_reason text := pg_catalog.btrim(coalesce(p_reason,''));
begin
  select id,name into v_actor,v_actor_name from public.admin_caller();
  if v_actor is null then return public.order_error(403, 'Admins only.'); end if;
  if pg_catalog.char_length(v_reason) not between 3 and 200 then return public.order_error(400, 'Add a reason. It goes into the audit log.'); end if;
  select o.* into v_order from public.orders o where o.id = p_order_id for update;
  if v_order.id is null then return public.order_error(404, 'Order not found.'); end if;
  perform public.order_expire_locked(v_order.id);
  select o.* into v_order from public.orders o where o.id = p_order_id;
  if v_order.status = 'cancelled' and v_order.cancel_reason = 'admin_cancelled' then
    return pg_catalog.jsonb_build_object('order', public.order_customer_dto(v_order));
  end if;
  if v_order.status <> 'queued' then return public.order_error(409, 'Only queued orders can be cancelled.'); end if;
  update public.orders set status='cancelled',cancelled_at=pg_catalog.clock_timestamp(),cancel_reason='admin_cancelled',admin_cancel_note=v_reason
    where id=v_order.id returning * into v_order;
  perform public.admin_log(v_actor, v_actor_name, 'Cancelled order', v_order.public_reference, v_reason);
  return pg_catalog.jsonb_build_object('order', public.order_customer_dto(v_order));
end;
$$;

create function public.admin_refund_order(p_order_id uuid, p_reason text) returns jsonb
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
  if v_payment.order_id is null then return public.order_error(409, 'This order has no Stripe payment to refund.'); end if;
  if v_payment.state = 'refunded' then return pg_catalog.jsonb_build_object('orderId',v_order.id,'paymentState','refunded'); end if;
  if v_payment.state not in ('authorized','captured','capture_failed') then return public.order_error(409, 'This payment cannot be refunded right now.'); end if;
  update public.orders set admin_refunded_at=pg_catalog.clock_timestamp(),admin_refund_reason=v_reason where id=v_order.id;
  update public.order_payments set settle='refund',refund_reason=v_reason,updated_at=pg_catalog.clock_timestamp() where order_id=v_order.id;
  perform public.admin_log(v_actor, v_actor_name, 'Refunded order', v_order.public_reference,
    pg_catalog.concat('€', pg_catalog.to_char(v_order.amount_eur_cents / 100.0, 'FM999999990.00'), ' · ', v_reason));
  return pg_catalog.jsonb_build_object('orderId',v_order.id,'paymentState','refund_pending');
end;
$$;

create function public.record_payment_refund(p_payment_intent text, p_reason text default 'Refund received from Stripe') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_order uuid;
begin
  update public.order_payments set state='refunded',settle='none',refunded_at=coalesce(refunded_at,pg_catalog.clock_timestamp()),
      refund_reason=coalesce(refund_reason,pg_catalog.left(coalesce(nullif(pg_catalog.btrim(p_reason),''),'Refund received from Stripe'),200)),
      last_error=null,updated_at=pg_catalog.clock_timestamp()
    where stripe_payment_intent_id=p_payment_intent returning order_id into v_order;
  if v_order is null then return pg_catalog.jsonb_build_object('updated',false); end if;
  update public.orders set admin_refunded_at=coalesce(admin_refunded_at,pg_catalog.clock_timestamp()),
      admin_refund_reason=coalesce(admin_refund_reason,'Refund received from Stripe')
    where id=v_order and status in ('in_progress','completed');
  return pg_catalog.jsonb_build_object('updated',true,'orderId',v_order);
end;
$$;

-- Minimal diff: refunds finished by the settlement worker also record when they happened.
create or replace function public.finish_payment_settlement(p_order_id uuid, p_state text, p_error text default null)
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
      refunded_at = case when p_state = 'refunded' then coalesce(refunded_at, pg_catalog.clock_timestamp()) else refunded_at end,
      last_error = pg_catalog.left(p_error, 300), updated_at = pg_catalog.clock_timestamp()
     where order_id = p_order_id;
  end if;
end $$;

create or replace function public.admin_orders(p_limit integer default 500) returns jsonb
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
      'adminCancelNote', o.admin_cancel_note, 'adminRefundedAt', o.admin_refunded_at, 'adminRefundReason', o.admin_refund_reason,
      'rerolls', o.rerolls, 'customerId', o.customer_id, 'customer', o.customer_name, 'customerAv', o.customer_image,
      'teammateId', o.assigned_teammate_id, 'teammate', tp.name, 'teammateAv', tp.image,
      'review', (select public.order_review_dto(r) from public.order_reviews as r where r.order_id = o.id),
      'payment', case when pay.order_id is null then null else pg_catalog.jsonb_build_object(
        'method', pay.payment_method_type, 'state', pay.state, 'settle', pay.settle,
        'currency', pay.currency, 'amountMinor', pay.amount_minor, 'error', pay.last_error,
        'stripeId', pay.stripe_payment_intent_id, 'refundReason', pay.refund_reason, 'refundedAt', pay.refunded_at) end,
      'refundCents', (select pg_catalog.sum(c.amount_eur_cents) from public.refund_credits c where c.order_id=o.id))
      order by o.created_at desc)
    from (select * from public.orders order by created_at desc limit greatest(1,least(coalesce(p_limit,500),2000))) o
    left join public.profiles tp on tp.id=o.assigned_teammate_id
    left join public.order_payments pay on pay.order_id=o.id), '[]'::jsonb));
end;
$$;

revoke all on function public.handover_info(text), public.accept_handover(text), public.admin_create_handover(uuid),
  public.admin_cancel_order(uuid,text), public.admin_refund_order(uuid,text), public.record_payment_refund(text,text)
  from public, anon, authenticated, service_role;
grant execute on function public.handover_info(text), public.accept_handover(text), public.admin_create_handover(uuid),
  public.admin_cancel_order(uuid,text), public.admin_refund_order(uuid,text) to authenticated;
grant execute on function public.record_payment_refund(text,text) to service_role;

commit;
