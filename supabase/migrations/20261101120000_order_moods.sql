-- Order moods (owner request 2026-11-01). At checkout the customer can pick how the session should
-- feel: chill, tryhard, teach (explain as you play) or fun. Optional; null means no preference.
-- The mood rides on the checkout intent, is copied onto the order when it is created, and teammates
-- see it through order_teammate_dto (queue, accepted order, handovers) and the Discord order posts
-- (discord_order_posts_due). Customers never see another customer's mood; the column is not added
-- to any customer or public projection.
begin;

alter table public.checkout_intents add column mood text
  constraint checkout_intents_mood_check check (mood in ('chill','tryhard','teach','fun'));
alter table public.orders add column mood text
  constraint orders_mood_check check (mood in ('chill','tryhard','teach','fun'));

-- Same as 20261026160000_perks.sql; the only change: mood is copied from the intent onto the order.
create or replace function public.create_paid_order(p_intent_id uuid, p_payment_intent text, p_amount_minor integer, p_currency text, p_method text, p_state text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare i public.checkout_intents; p public.profiles; v_order uuid; v_held bigint; h public.wallet_entries;
  v_free jsonb; v_count bigint;
begin
  if p_state not in ('authorized','captured','wallet','free') then raise exception 'invalid payment state'; end if;
  select * into i from public.checkout_intents where id = p_intent_id for update;
  if i.id is null then return pg_catalog.jsonb_build_object('error', 'unknown_intent'); end if;
  if i.order_id is not null then
    return pg_catalog.jsonb_build_object('order_id', i.order_id, 'created', false);
  end if;
  if i.status = 'conflict' then return pg_catalog.jsonb_build_object('conflict', true); end if;
  -- A card payment needs a card part; a wallet-only order needs the wallet to cover everything.
  -- A free coaching order has neither and only comes from a free coaching intent.
  if (p_state = 'wallet') <> (i.wallet_eur_cents = i.amount_eur_cents)
     or (p_state in ('wallet','free')) <> (p_payment_intent is null)
     or (p_state = 'free') <> i.free_coaching
     or (p_state in ('wallet','free') and (p_amount_minor <> 0 or pg_catalog.lower(p_currency) <> 'eur'))
     or (p_state not in ('wallet','free') and pg_catalog.lower(p_currency) = 'eur'
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
  -- Free monthly coaching: Platinum or Diamond at booking time, one used claim per Vienna month,
  -- a training service of exactly one unit (1 hour, or 1 game for Play and Learn).
  if p_state = 'free' then
    v_free := public.customer_perks_for(i.customer_id);
    if not public.free_coaching_service(i.game, i.service) or i.units <> 1 or i.gg
       or not coalesce((v_free->'freeCoaching'->>'available')::boolean, false) then
      update public.checkout_intents set status = 'failed', updated_at = pg_catalog.clock_timestamp() where id = i.id and status = 'open';
      return pg_catalog.jsonb_build_object('error', 'free_perk_unavailable',
        'reason', case when not coalesce((v_free->'freeCoaching'->>'eligible')::boolean, false) then 'level'
                       when coalesce((v_free->'freeCoaching'->>'used')::boolean, false) then 'used' else 'service' end);
    end if;
    v_count := public.loyalty_valid_count(i.customer_id);
  end if;
  select * into p from public.profiles where id = i.customer_id;
  insert into public.orders(customer_id, game, service, title, units, unit, gg, rank, region, ign, note, voice, mood,
      customer_name, customer_image, customer_country, amount_eur_cents, booking_fx, payout_usd_cents, wallet_eur_cents)
    values (i.customer_id, i.game, i.service, i.title, i.units, i.unit, i.gg, i.rank, i.region, i.ign, i.note, i.voice, i.mood,
      pg_catalog.left(coalesce(nullif(pg_catalog.btrim(p.name), ''), 'Player'), 40),
      case when p.image ~ '^/assets/avatars/avatar-([1-9]|10)\.png$' then p.image else '' end,
      case when pg_catalog.lower(p.country) ~ '^[a-z]{2}$' then pg_catalog.lower(p.country) else '' end,
      i.amount_eur_cents, i.booking_fx, i.payout_usd_cents, i.wallet_eur_cents)
    returning id into v_order;
  if p_state not in ('wallet','free') then
    insert into public.order_payments(order_id, intent_id, stripe_payment_intent_id, amount_minor, currency,
        amount_eur_cents, payment_method_type, state)
      values (v_order, i.id, p_payment_intent, p_amount_minor, pg_catalog.lower(p_currency),
        i.amount_eur_cents - i.wallet_eur_cents, pg_catalog.left(coalesce(p_method, ''), 40), p_state);
  end if;
  if p_state = 'free' then
    insert into public.free_coaching_claims(customer_id, month, intent_id, order_id, loyalty_level, prior_completed_count, list_eur_cents)
      values (i.customer_id, public.free_coaching_month(pg_catalog.clock_timestamp()), i.id, v_order,
        v_free->>'level', v_count, i.amount_eur_cents);
  end if;
  for h in select * from public.checkout_open_holds(i.id) loop
    insert into public.wallet_entries(customer_id, amount_eur_cents, kind, cashable, order_id, checkout_intent_id, reverses_id, reason)
      values (h.customer_id, -h.amount_eur_cents, 'checkout_release', h.cashable, v_order, i.id, h.id, 'Hold used for order');
    insert into public.wallet_entries(customer_id, amount_eur_cents, kind, cashable, order_id, checkout_intent_id, reason)
      values (h.customer_id, h.amount_eur_cents, 'checkout_spend', h.cashable, v_order, i.id, 'Paid for order');
  end loop;
  if i.pick_source_order_id is not null then
    perform public.order_pick_start(v_order, i.pick_source_order_id);
  end if;
  update public.checkout_intents set status = 'paid', order_id = v_order, stripe_payment_intent_id = p_payment_intent,
    updated_at = pg_catalog.clock_timestamp() where id = i.id;
  return pg_catalog.jsonb_build_object('order_id', v_order, 'created', true);
end $function$;

-- Same as 20261022093000_order_foundation.sql; the only change: 'mood'.
create or replace function public.order_teammate_dto(p_order public.orders) returns jsonb
language sql immutable security invoker set search_path = '' as $$
  select pg_catalog.jsonb_build_object(
    'id', p_order.id, 'public_reference', p_order.public_reference, 'status', p_order.status,
    'game', p_order.game, 'service', p_order.service, 'title', p_order.title,
    'units', p_order.units, 'unit', p_order.unit, 'gg', p_order.gg, 'rank', p_order.rank,
    'region', p_order.region, 'ign', p_order.ign, 'note', p_order.note, 'voice', p_order.voice,
    'mood', p_order.mood,
    'customer_name', p_order.customer_name, 'customer_image', p_order.customer_image,
    'customer_country', p_order.customer_country, 'payout_usd_cents', p_order.payout_usd_cents,
    'current_assignment_id', p_order.current_assignment_id);
$$;

-- Same as 20261026160000_perks.sql; the only change: 'mood', so the Discord post can show it.
create or replace function public.discord_order_posts_due(p_after_seconds integer default 100)
 returns jsonb
 language sql
 stable security definer
 set search_path to ''
as $function$
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id', o.id, 'reference', o.public_reference, 'game', o.game, 'title', o.title,
    'units', o.units, 'unit', o.unit, 'rank', o.rank, 'region', o.region, 'voice', o.voice, 'mood', o.mood,
    'gg', o.gg, 'payoutUsdCents', o.payout_usd_cents,
    'queuedAt', o.queued_at, 'cancelsAt', o.queued_at + interval '5 minutes'
  ) order by o.queued_at), '[]'::jsonb)
  from public.orders o
  where o.status = 'queued'
    and public.order_public_queued_at(o) <= pg_catalog.clock_timestamp() - pg_catalog.make_interval(secs => greatest(p_after_seconds, 0))
    -- leave 20 seconds so nobody gets pinged for a link that is about to die
    and o.queued_at + interval '5 minutes' > pg_catalog.clock_timestamp() + interval '20 seconds'
    and not exists (
      select 1 from public.discord_order_posts d
       where d.order_id = o.id and d.queue_key = o.queued_at
         and (d.state <> 'posting' or d.created_at > pg_catalog.clock_timestamp() - interval '1 minute')
    );
$function$;

commit;
