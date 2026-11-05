-- Transactional business facts, not a delivery-time consent decision. No provider calls.
begin;

create table public.analytics_outbox (
  id bigserial primary key,
  event text not null,
  dedup_key text not null unique,
  occurred_at timestamptz not null default pg_catalog.now(),
  user_id uuid,
  properties jsonb not null default '{}'::jsonb,
  uuid uuid not null default pg_catalog.gen_random_uuid(),
  claimed_until timestamptz,
  attempts integer not null default 0,
  sent_at timestamptz,
  failed_at timestamptz,
  last_error text
);
create index analytics_outbox_pending on public.analytics_outbox (occurred_at, id)
  where sent_at is null and failed_at is null;
create index analytics_outbox_sent on public.analytics_outbox (sent_at)
  where sent_at is not null;
alter table public.analytics_outbox enable row level security;
revoke all on table public.analytics_outbox from public, anon, authenticated;
revoke all on sequence public.analytics_outbox_id_seq from public, anon, authenticated;
grant select, insert, update, delete on table public.analytics_outbox to service_role;
grant usage, select on sequence public.analytics_outbox_id_seq to service_role;

create function public.analytics_enqueue(
  p_event text, p_dedup_key text, p_user_id uuid,
  p_properties jsonb, p_occurred_at timestamptz
) returns void language sql security definer set search_path = '' as $$
  insert into public.analytics_outbox(event, dedup_key, user_id, properties, occurred_at)
  values (p_event, p_dedup_key, p_user_id, p_properties, coalesce(p_occurred_at, pg_catalog.now()))
  on conflict (dedup_key) do nothing;
$$;
revoke all on function public.analytics_enqueue(text, text, uuid, jsonb, timestamptz) from public, anon, authenticated;
grant execute on function public.analytics_enqueue(text, text, uuid, jsonb, timestamptz) to service_role;

create function public.analytics_service_slug(p_service text) returns text
language sql security definer set search_path = '' as $$
  select case when p_service in ('aim','aram','arcade','arena','box','build','bw','casual','champ','champs','chat','clash','clubs','cup','demo','dm','draft','dragon','duo1','duo2','duo3','duos','econ','escort','extra','faceit5','five','flex','friendly','gg1','gg2','hard','hero','karaoke','kickoff','learn','loadout','manhunt','maps','mech','mini','mix','move','mp4','norm','ops','party','premier','pubs','pvp','qp','quads','quick','ranked5','rebirth','reload','retake','role','six','skirm','sleep','smp','squad','stack','stadium','stream','surv','swift','tactics','teamup','three','trio','unrated','util','vod','watch','wing','zb','zombies') then p_service else 'unknown' end;
$$;
create function public.analytics_signup_method(p_metadata jsonb) returns text
language sql security definer set search_path = '' as $$
  select case p_metadata->>'provider'
    when 'email' then 'email' when 'google' then 'google'
    when 'discord' then 'discord' when 'apple' then 'apple'
    else 'other' end;
$$;
create function public.analytics_funded_properties(i public.checkout_intents) returns jsonb
language sql security definer set search_path = '' as $$
  select pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
    'funding', case when i.free_coaching then 'free'
      when i.wallet_eur_cents = i.amount_eur_cents then 'wallet'
      when i.wallet_eur_cents > 0 then 'mixed' else 'card' end,
    'list_eur_cents', i.amount_eur_cents + i.first_order_discount_cents + i.pro_discount_cents,
    'funded_eur_cents', case when i.free_coaching then 0 else i.amount_eur_cents end,
    'card_eur_cents', case when i.free_coaching then 0 else i.amount_eur_cents - i.wallet_eur_cents end,
    'wallet_eur_cents', case when i.free_coaching then 0 else i.wallet_eur_cents end,
    'discount_eur_cents', i.first_order_discount_cents + i.pro_discount_cents,
    'free_perk', i.free_coaching,
    'game', i.game, 'service', public.analytics_service_slug(i.service), 'units', i.units,
    'stream', i.streamer_id is not null,
    'payment_state', case when i.free_coaching or i.wallet_eur_cents = i.amount_eur_cents then 'n_a'
      else (select case when p.state in ('authorized','captured') then p.state end
        from public.order_payments p where p.order_id = i.order_id) end));
$$;
create function public.analytics_completed_properties(o public.orders) returns jsonb
language sql security definer set search_path = '' as $$
  select pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
    'duration_seconds', greatest(0, extract(epoch from (o.completed_at - o.accepted_at))::bigint),
    'games', (select pg_catalog.jsonb_array_length(r.games) from public.order_match_reports r where r.assignment_id = o.current_assignment_id),
    'wins', (select r.wins from public.order_match_reports r where r.assignment_id = o.current_assignment_id),
    'losses', (select r.losses from public.order_match_reports r where r.assignment_id = o.current_assignment_id)));
$$;
create function public.analytics_on_checkout_intents() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.order_id is null and new.order_id is not null and new.status = 'paid' then
    perform public.analytics_enqueue('order_funded', 'funded:' || new.order_id, new.customer_id,
      public.analytics_funded_properties(new), new.updated_at);
  end if;
  if new.status is distinct from old.status and new.status in ('expired','failed','conflict') then
    perform public.analytics_enqueue(case when new.status = 'expired' then 'checkout_expired' else 'checkout_failed_server' end,
      new.id || ':' || new.status, new.customer_id,
      pg_catalog.jsonb_build_object('game', new.game, 'service', public.analytics_service_slug(new.service), 'status', new.status), new.updated_at);
  end if;
  return new;
exception when others then
  raise warning 'analytics checkout_intents enqueue failed [%]', SQLSTATE;
  return new;
end;
$$;
create trigger analytics_on_checkout_intents after update on public.checkout_intents
  for each row execute function public.analytics_on_checkout_intents();

create function public.analytics_on_order_payments() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_user uuid;
begin
  if TG_OP = 'UPDATE' then
    if new.state is not distinct from old.state then return new; end if;
  end if;
  select o.customer_id into v_user from public.orders o where o.id = new.order_id;
  if new.state = 'captured' then
    perform public.analytics_enqueue('payment_captured', 'captured:' || new.order_id, v_user,
      pg_catalog.jsonb_build_object('card_eur_cents', new.amount_eur_cents, 'charge_minor', new.amount_minor, 'charge_currency', new.currency), new.updated_at);
  elsif TG_OP = 'UPDATE' and new.state in ('voided','refunded') then
    -- No refund delta exists here: this is the full card portion, NOT exact refunded revenue.
    perform public.analytics_enqueue(case when new.state = 'voided' then 'authorization_voided' else 'order_refunded' end,
      new.state || ':' || new.order_id, v_user,
      pg_catalog.jsonb_build_object('card_eur_cents', new.amount_eur_cents), coalesce(new.refunded_at, new.updated_at));
  end if;
  return new;
exception when others then
  raise warning 'analytics order_payments enqueue failed [%]', SQLSTATE;
  return new;
end;
$$;
create trigger analytics_on_order_payments after insert or update on public.order_payments
  for each row execute function public.analytics_on_order_payments();

create function public.analytics_on_orders() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.status = 'queued' and new.status = 'in_progress' then
    perform public.analytics_enqueue('order_matched', 'matched:' || new.id || ':' || new.current_assignment_id, new.customer_id,
      pg_catalog.jsonb_build_object('wait_seconds', greatest(0, extract(epoch from (new.accepted_at - new.queued_at))::bigint),
        'game', new.game, 'service', public.analytics_service_slug(new.service), 'reroll_n', new.rerolls), new.accepted_at);
  end if;
  if new.status is distinct from old.status and new.status = 'cancelled' then
    if new.cancel_reason = 'queue_expired' then
      perform public.analytics_enqueue('order_expired', 'expired:' || new.id, new.customer_id,
        pg_catalog.jsonb_build_object('wait_seconds', greatest(0, extract(epoch from (new.cancelled_at - new.queued_at))::bigint),
          'game', new.game, 'service', public.analytics_service_slug(new.service)), new.cancelled_at);
    elsif new.cancel_reason in ('customer_cancelled','admin_cancelled') then
      perform public.analytics_enqueue('order_cancelled', 'cancelled:' || new.id, new.customer_id,
        pg_catalog.jsonb_build_object('by', case when new.cancel_reason = 'customer_cancelled' then 'customer' else 'admin' end,
          'stage', old.status), new.cancelled_at);
    end if;
  end if;
  if new.rerolls > old.rerolls then
    perform public.analytics_enqueue('order_rerolled', 'reroll:' || new.id || ':' || new.rerolls, new.customer_id,
      pg_catalog.jsonb_build_object('reroll_n', new.rerolls), new.queued_at);
  end if;
  if new.status is distinct from old.status and new.status = 'completed' then
    perform public.analytics_enqueue('order_completed', 'completed:' || new.id, new.customer_id,
      public.analytics_completed_properties(new), new.completed_at);
  end if;
  return new;
exception when others then
  raise warning 'analytics orders enqueue failed [%]', SQLSTATE;
  return new;
end;
$$;
create trigger analytics_on_orders after update on public.orders
  for each row execute function public.analytics_on_orders();

create function public.analytics_on_order_handovers() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_user uuid;
begin
  if old.revoked_at is null and new.revoked_at is not null and new.revoke_reason = 'accepted' then
    select o.customer_id into v_user from public.orders o where o.id = new.order_id;
    perform public.analytics_enqueue('handover_accepted', 'handover:' || new.id, v_user, '{}'::jsonb, new.revoked_at);
  end if;
  return new;
exception when others then
  raise warning 'analytics order_handovers enqueue failed [%]', SQLSTATE;
  return new;
end;
$$;
create trigger analytics_on_order_handovers after update on public.order_handovers
  for each row execute function public.analytics_on_order_handovers();

create function public.analytics_on_order_match_reports() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_user uuid;
begin
  if new.edited_at is not null and new.edited_at is distinct from old.edited_at and new.edited_by is not null then
    select o.customer_id into v_user from public.orders o where o.id = new.order_id;
    perform public.analytics_enqueue('order_results_corrected', 'corrected:' || new.assignment_id || ':' || new.edited_at,
      v_user, '{}'::jsonb, new.edited_at);
  end if;
  return new;
exception when others then
  raise warning 'analytics order_match_reports enqueue failed [%]', SQLSTATE;
  return new;
end;
$$;
create trigger analytics_on_order_match_reports after update on public.order_match_reports
  for each row execute function public.analytics_on_order_match_reports();

create function public.analytics_on_order_tips() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.paid_at is null and new.paid_at is not null then
    perform public.analytics_enqueue('tip_paid', 'tip:' || new.id, new.customer_id,
      pg_catalog.jsonb_build_object('amount_eur_cents', new.amount_cents), new.paid_at);
  end if;
  return new;
exception when others then
  raise warning 'analytics order_tips enqueue failed [%]', SQLSTATE;
  return new;
end;
$$;
create trigger analytics_on_order_tips after update on public.order_tips
  for each row execute function public.analytics_on_order_tips();

create function public.analytics_on_pro_subscriptions() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_prior text; v_event text; v_cape_changed boolean;
begin
  if TG_OP = 'UPDATE' then v_prior := old.status; end if;
  if new.status is distinct from v_prior then
    v_event := case
      when new.status = 'trialing' then 'pro_trial_started'
      when new.status = 'active' and v_prior = 'paused' then 'pro_resumed'
      when new.status = 'active' and (v_prior is null or v_prior in ('incomplete','trialing')) then 'pro_activated'
      when new.status = 'paused' then 'pro_paused'
      when new.status in ('canceled','incomplete_expired','unpaid') then 'pro_ended'
      else null end;
    -- past_due -> active is payment recovery, not a fresh acquisition.
    if v_event is not null then
      perform public.analytics_enqueue(v_event, new.stripe_subscription_id || ':' || new.status || ':' || new.last_event_at,
        new.user_id, pg_catalog.jsonb_build_object('prior_state', coalesce(v_prior, 'none'), 'state', new.status), new.last_event_at);
    end if;
  end if;
  if TG_OP = 'INSERT' then v_cape_changed := new.cancel_at_period_end;
  else v_cape_changed := new.cancel_at_period_end is distinct from old.cancel_at_period_end; end if;
  if v_cape_changed then
    perform public.analytics_enqueue(case when new.cancel_at_period_end then 'pro_cancel_scheduled' else 'pro_cancel_undone' end,
      new.stripe_subscription_id || ':cape:' || new.cancel_at_period_end || ':' || new.last_event_at,
      new.user_id, '{}'::jsonb, new.last_event_at);
  end if;
  return new;
exception when others then
  raise warning 'analytics pro_subscriptions enqueue failed [%]', SQLSTATE;
  return new;
end;
$$;
create trigger analytics_on_pro_subscriptions after insert or update on public.pro_subscriptions
  for each row execute function public.analytics_on_pro_subscriptions();

create function public.analytics_on_pro_invoices() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if TG_OP = 'UPDATE' then
    if new.state is not distinct from old.state then return new; end if;
  end if;
  if new.state = 'paid' and new.amount_minor = 0 then return new; end if;
  perform public.analytics_enqueue(case when new.state = 'paid' then 'pro_invoice_paid' else 'pro_invoice_failed' end,
    new.stripe_invoice_id || ':' || new.state, new.user_id,
    pg_catalog.jsonb_build_object('amount_minor', new.amount_minor, 'currency', new.currency), new.last_event_at);
  return new;
exception when others then
  raise warning 'analytics pro_invoices enqueue failed [%]', SQLSTATE;
  return new;
end;
$$;
create trigger analytics_on_pro_invoices after insert or update on public.pro_invoices
  for each row execute function public.analytics_on_pro_invoices();

create function public.analytics_on_teammate_applications() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.status = 'pending' and new.status = 'approved' then
    perform public.analytics_enqueue('teammate_approved', new.id || ':approved', new.account_id,
      pg_catalog.jsonb_build_object('game', new.game, 'services_count', pg_catalog.cardinality(new.services)), new.decided_at);
  end if;
  return new;
exception when others then
  raise warning 'analytics teammate_applications enqueue failed [%]', SQLSTATE;
  return new;
end;
$$;
create trigger analytics_on_teammate_applications after update on public.teammate_applications
  for each row execute function public.analytics_on_teammate_applications();

create function public.analytics_on_payout_transfers() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.state is distinct from old.state and new.state = 'paid' then
    perform public.analytics_enqueue('payout_sent', 'stripe:' || new.id, new.teammate_id,
      pg_catalog.jsonb_build_object('amount_minor', new.amount_minor, 'currency', new.currency, 'rail', 'stripe'), new.updated_at);
  end if;
  return new;
exception when others then
  raise warning 'analytics payout_transfers enqueue failed [%]', SQLSTATE;
  return new;
end;
$$;
create trigger analytics_on_payout_transfers after update on public.payout_transfers
  for each row execute function public.analytics_on_payout_transfers();

create function public.analytics_on_payout_lines() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status is distinct from old.status and new.status = 'paid' and new.paid_method in ('bank','wise','paypal','other') then
    perform public.analytics_enqueue('payout_sent', 'manual:' || new.id, new.teammate_id,
      pg_catalog.jsonb_build_object('amount_minor', new.paid_usd_cents, 'currency', 'usd', 'rail', 'manual'), new.paid_at);
  end if;
  return new;
exception when others then
  raise warning 'analytics payout_lines enqueue failed [%]', SQLSTATE;
  return new;
end;
$$;
create trigger analytics_on_payout_lines after update on public.payout_lines
  for each row execute function public.analytics_on_payout_lines();

create function public.analytics_on_creator_payouts() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- creators has no account/user FK. Never pretend creator_id is an auth identity.
  perform public.analytics_enqueue('payout_sent', 'creator:' || new.id, null,
    pg_catalog.jsonb_build_object('amount_minor', new.amount_eur_cents, 'currency', 'eur', 'rail', 'creator'), new.paid_at);
  return new;
exception when others then
  raise warning 'analytics creator_payouts enqueue failed [%]', SQLSTATE;
  return new;
end;
$$;
create trigger analytics_on_creator_payouts after insert on public.creator_payouts
  for each row execute function public.analytics_on_creator_payouts();

create function public.analytics_on_payout_transfer_reversals() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_currency text;
begin
  select t.currency into v_currency from public.payout_transfers t where t.id = new.transfer_id;
  perform public.analytics_enqueue('payout_reversed', 'reversal:' || new.id, new.teammate_id,
    pg_catalog.jsonb_build_object('amount_minor', new.amount_minor, 'currency', v_currency), new.created_at);
  return new;
exception when others then
  raise warning 'analytics payout_transfer_reversals enqueue failed [%]', SQLSTATE;
  return new;
end;
$$;
create trigger analytics_on_payout_transfer_reversals after insert on public.payout_transfer_reversals
  for each row execute function public.analytics_on_payout_transfer_reversals();

create function public.analytics_on_users() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.analytics_enqueue('user_signed_up', 'signup:' || new.id, new.id,
    pg_catalog.jsonb_build_object('method', public.analytics_signup_method(new.raw_app_meta_data)), new.created_at);
  return new;
exception when others then
  raise warning 'analytics users enqueue failed [%]', SQLSTATE;
  return new;
end;
$$;
create trigger analytics_on_users after insert on auth.users
  for each row execute function public.analytics_on_users();

revoke all on function public.analytics_service_slug(text) from public, anon, authenticated;
grant execute on function public.analytics_service_slug(text) to service_role;
revoke all on function public.analytics_signup_method(jsonb) from public, anon, authenticated;
grant execute on function public.analytics_signup_method(jsonb) to service_role;
revoke all on function public.analytics_funded_properties(public.checkout_intents) from public, anon, authenticated;
grant execute on function public.analytics_funded_properties(public.checkout_intents) to service_role;
revoke all on function public.analytics_completed_properties(public.orders) from public, anon, authenticated;
grant execute on function public.analytics_completed_properties(public.orders) to service_role;
revoke all on function public.analytics_on_checkout_intents() from public, anon, authenticated;
revoke all on function public.analytics_on_order_payments() from public, anon, authenticated;
revoke all on function public.analytics_on_orders() from public, anon, authenticated;
revoke all on function public.analytics_on_order_handovers() from public, anon, authenticated;
revoke all on function public.analytics_on_order_match_reports() from public, anon, authenticated;
revoke all on function public.analytics_on_order_tips() from public, anon, authenticated;
revoke all on function public.analytics_on_pro_subscriptions() from public, anon, authenticated;
revoke all on function public.analytics_on_pro_invoices() from public, anon, authenticated;
revoke all on function public.analytics_on_teammate_applications() from public, anon, authenticated;
revoke all on function public.analytics_on_payout_transfers() from public, anon, authenticated;
revoke all on function public.analytics_on_payout_lines() from public, anon, authenticated;
revoke all on function public.analytics_on_creator_payouts() from public, anon, authenticated;
revoke all on function public.analytics_on_payout_transfer_reversals() from public, anon, authenticated;
revoke all on function public.analytics_on_users() from public, anon, authenticated;

commit;
