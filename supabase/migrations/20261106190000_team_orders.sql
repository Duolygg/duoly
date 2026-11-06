-- Team orders: one checkout, several teammates (owner decisions 2026-10-30 and 2026-11-06,
-- docs/product/team-orders.md).
--
-- A team is a group of linked seat orders. One checkout for N seats (2 to 5) creates one
-- order_teams row and N normal orders that share its team_id, seat 1 being the lead. Each seat
-- keeps everything that already works per order: assignment, completion, earnings, payout,
-- review, tip and reports. The team layer adds:
--
--   * Taking a seat. Any eligible teammate takes the next free seat (the desk shows one card per
--     team). A teammate holds at most one open assignment anywhere, so never two seats of a team.
--   * All or nothing. The team is 'waiting' until every seat is taken. When the last seat is
--     taken it 'started': the one card payment (on the lead seat) is captured. If any seat is
--     cancelled while the team waits (5-minute expiry, customer or admin cancel), every other
--     seat is cancelled too ('team_incomplete'), teammates who took a seat are released without
--     earnings, the payment is released and the balance part goes back to the wallet.
--   * Money stays on the lead. order_payments and the wallet entries belong to the lead seat;
--     order_teams carries the team totals. Each seat carries its share of the price (rounding on
--     the lead) and the usual 60% payout of a seat. Other seats never create refund credits of
--     their own while the team waits; after the start a seat that ends cancelled (a switched
--     teammate nobody replaced) gives its share back as a Duoly balance credit.
--   * Re-roll replaces one seat, only after the team started.
--   * One group chat: every message in a seat's chat is copied into the other seats' chats. A
--     teammate sees other teammates as sender 'mate', so their own bubbles stay their own.
--   * Priority picks, Play again, free coaching and streamer bookings are single orders only.
begin;

-- ─── Schema ──────────────────────────────────────────────────────────────────────────────────

create table public.order_teams (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete restrict,
  intent_id uuid not null unique references public.checkout_intents(id) on delete restrict,
  lead_order_id uuid unique,
  seats smallint not null check (seats between 2 and 5),
  amount_eur_cents integer not null check (amount_eur_cents between 198 and 100000),
  wallet_eur_cents integer not null default 0,
  status text not null default 'waiting' check (status in ('waiting','started','cancelled','done')),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  ended_at timestamptz,
  refunded_at timestamptz,
  check (wallet_eur_cents between 0 and amount_eur_cents),
  check (case status
    when 'waiting' then started_at is null and ended_at is null
    when 'started' then started_at is not null and ended_at is null
    when 'done' then started_at is not null and ended_at is not null
    else ended_at is not null end)
);
alter table public.order_teams enable row level security;
revoke all on public.order_teams from anon, authenticated;
create unique index order_teams_one_open_customer on public.order_teams (customer_id)
  where status in ('waiting','started');

alter table public.orders
  add column team_id uuid references public.order_teams(id) on delete restrict,
  add column seat smallint,
  add constraint orders_team_seat check ((team_id is null) = (seat is null) and (seat is null or seat between 1 and 5));
create unique index orders_team_seat_key on public.orders (team_id, seat) where team_id is not null;
alter table public.order_teams
  add constraint order_teams_lead_order_id_fkey foreign key (lead_order_id) references public.orders(id) on delete restrict;

-- One open booking per customer: a single order, or one team (order_teams_one_open_customer).
drop index public.orders_one_open_customer;
create unique index orders_one_open_customer on public.orders (customer_id)
  where status in ('queued','in_progress') and team_id is null;

alter table public.orders drop constraint orders_cancel_reason_check;
alter table public.orders add constraint orders_cancel_reason_check
  check (cancel_reason in ('queue_expired','customer_cancelled','admin_cancelled','team_incomplete'));
alter table public.order_assignments drop constraint order_assignments_end_reason_check;
alter table public.order_assignments add constraint order_assignments_end_reason_check
  check (end_reason in ('customer_reroll','completed','handed_over','team_incomplete'));
alter table public.order_chat_messages drop constraint order_chat_messages_sender_check;
alter table public.order_chat_messages add constraint order_chat_messages_sender_check
  check (sender in ('customer','teammate','mate','system'));
alter table public.order_chat_messages drop constraint order_chat_messages_system_event_check;
alter table public.order_chat_messages add constraint order_chat_messages_system_event_check
  check (system_event in ('accepted','completed','reviewed','handed_over','discord_invite','team_joined','team_started'));

-- Charge at queue (owner decision 2026-11-06): the card is charged at checkout, not held until a
-- teammate accepts, and a cancelled order (expired, cancelled by the customer or an admin, a team
-- that didn't fill) gives the card part back as Duoly balance (a withdrawable 'refund' wallet entry),
-- never to the card. The balance part comes back as before. A 'paid_refund' credit can be smaller
-- than the order (the card part only) and, for a team, sits on the lead seat for the whole team's
-- card part, so the credit is no longer tied to the order amount.
alter table public.refund_credits drop constraint refund_credits_order_id_customer_id_amount_eur_cents_fkey;
alter table public.orders add constraint orders_id_customer_id_key unique (id, customer_id);
alter table public.refund_credits add constraint refund_credits_order_customer_fkey
  foreign key (order_id, customer_id) references public.orders(id, customer_id) on delete restrict;
alter table public.refund_credits drop constraint refund_credits_amount_eur_cents_check;
alter table public.refund_credits add constraint refund_credits_amount_eur_cents_check
  check (amount_eur_cents between 1 and 100000);
alter table public.refund_credits drop constraint refund_credits_kind_check;
alter table public.refund_credits add constraint refund_credits_kind_check
  check (kind in ('queued_refund','paid_refund'));

-- The customer's role and the character they want coaching on (owner decisions 2026-11-06,
-- src/contracts/roles.ts). Optional: null means no preference. The server checks them against
-- the game's list; the database only bounds them.
alter table public.orders
  add column role text check (role is null or pg_catalog.char_length(role) between 1 and 24),
  add column character_name text check (character_name is null or pg_catalog.char_length(character_name) between 1 and 40);
alter table public.checkout_intents
  add column role text check (role is null or pg_catalog.char_length(role) between 1 and 24),
  add column character_name text check (character_name is null or pg_catalog.char_length(character_name) between 1 and 40);

alter table public.checkout_intents
  add column seats smallint not null default 1 check (seats between 1 and 5),
  add constraint checkout_intents_team check (seats = 1 or
    (not free_coaching and streamer_id is null and pick_source_order_id is null));

-- ─── Team helpers ────────────────────────────────────────────────────────────────────────────

-- Locks the open seat chats of a team in seat order (see order_team_sync for the lock order).
create function public.order_team_lock_rooms(p_team uuid) returns void
language plpgsql set search_path = '' as $$
begin
  perform 1 from public.orders o join public.order_chat_rooms c on c.assignment_id = o.current_assignment_id
   where o.team_id = p_team and o.status = 'in_progress' order by o.seat for update of c;
end $$;

-- Appends one system line to every open seat chat of the team.
create function public.order_team_chat_system(p_team uuid, p_event text, p_body text) returns void
language plpgsql set search_path = '' as $$
declare v_room uuid;
begin
  for v_room in select o.current_assignment_id from public.orders o
      join public.order_chat_rooms c on c.assignment_id = o.current_assignment_id
     where o.team_id = p_team and o.status = 'in_progress' order by o.seat loop
    perform public.order_chat_append(v_room, 'system', 'Duoly', '', p_body, null, p_event);
    perform public.order_chat_invalidate(v_room);
  end loop;
end $$;

-- Copies a sent message into the other open seat chats of the team.
create function public.order_team_chat_mirror(p_order public.orders, p_sender text, p_name text,
  p_image text, p_body text, p_request uuid) returns void
language plpgsql set search_path = '' as $$
declare v_room uuid;
begin
  for v_room in select o.current_assignment_id from public.orders o
      join public.order_chat_rooms c on c.assignment_id = o.current_assignment_id
     where o.team_id = p_order.team_id and o.id <> p_order.id and o.status = 'in_progress' order by o.seat loop
    perform public.order_chat_append(v_room, case when p_sender = 'customer' then 'customer' else 'mate' end,
      p_name, p_image, p_body, p_request);
    perform public.order_chat_invalidate(v_room);
  end loop;
end $$;

-- A teammate took a seat: copy the conversation so far into their chat and tell everyone.
create function public.order_team_chat_join(p_order public.orders, p_filled integer, p_seats integer) returns void
language plpgsql set search_path = '' as $$
declare v_source uuid; m public.order_chat_messages; v_name text;
begin
  if p_order.current_assignment_id is null
     or not exists (select 1 from public.order_chat_rooms c where c.assignment_id = p_order.current_assignment_id) then
    return;
  end if;
  perform public.order_team_lock_rooms(p_order.team_id);
  select o.current_assignment_id into v_source from public.orders o
    join public.order_chat_rooms c on c.assignment_id = o.current_assignment_id
   where o.team_id = p_order.team_id and o.id <> p_order.id and o.status = 'in_progress'
   order by c.next_sequence desc, o.seat limit 1;
  if v_source is not null then
    for m in select * from (select x.* from public.order_chat_messages x
        where x.assignment_id = v_source and x.kind = 'user' order by x.sequence desc limit 50) q order by q.sequence loop
      perform public.order_chat_append(p_order.current_assignment_id,
        case when m.sender = 'customer' then 'customer' else 'mate' end, m.name, m.image, m.body, m.request_id);
    end loop;
  end if;
  select p.name into v_name from public.profiles p where p.id = p_order.assigned_teammate_id;
  perform public.order_team_chat_system(p_order.team_id, 'team_joined',
    pg_catalog.split_part(coalesce(v_name, 'A teammate'), ' ', 1) || ' joined the team · '
      || p_filled::text || ' of ' || p_seats::text || ' seats taken');
end $$;

-- Gives the team's balance part back (the wallet entries live on the lead seat).
create function public.order_team_wallet_return(p_team uuid, p_reason text) returns void
language plpgsql set search_path = '' as $$
declare t public.order_teams; s public.wallet_entries;
begin
  select * into t from public.order_teams where id = p_team;
  if t.id is null or t.wallet_eur_cents = 0 or t.lead_order_id is null then return; end if;
  for s in select e.* from public.wallet_entries e
      where e.order_id = t.lead_order_id and e.kind = 'checkout_spend'
        and not exists (select 1 from public.wallet_entries x where x.reverses_id = e.id)
      order by e.cashable, e.id loop
    insert into public.wallet_entries(customer_id, amount_eur_cents, kind, cashable, order_id, checkout_intent_id, reverses_id, reason)
      values (s.customer_id, -s.amount_eur_cents, 'checkout_release', s.cashable, t.lead_order_id,
        s.checkout_intent_id, s.id, p_reason);
  end loop;
end $$;

-- Ends a seat because its team did not fill. Never waits on a seat another transaction holds
-- (that would deadlock with a teammate taking it right now): order_sweep picks those up.
create function public.order_team_end_seat(p_order uuid) returns boolean
language plpgsql set search_path = '' as $$
declare s public.orders; v_now timestamptz := pg_catalog.clock_timestamp();
begin
  select o.* into s from public.orders o where o.id = p_order and o.status in ('queued','in_progress')
    for update skip locked;
  if s.id is null then return false; end if;
  if s.current_assignment_id is not null then
    update public.order_assignments set ended_at = v_now, end_reason = 'team_incomplete'
     where id = s.current_assignment_id and ended_at is null;
  end if;
  update public.orders set status = 'cancelled', cancelled_at = v_now, cancel_reason = 'team_incomplete',
      assigned_teammate_id = null, current_assignment_id = null, accepted_at = null
   where id = s.id;
  return true;
end $$;

-- After every status change of a seat: start the team, cancel it, or close it.
--
-- Lock order, so team transactions never deadlock: seat order row -> team row -> chat rooms in
-- seat order. Only taking a seat and cancelling one lock the team row; a completion only runs the
-- final 'done' update, which locks nothing while other seats are open. Team chat writers
-- (send_order_chat_message, order_team_chat_join) lock the rooms in seat order up front.
create function public.order_team_sync() returns trigger
language plpgsql security definer set search_path = '' as $$
declare t public.order_teams; v_filled integer; v_id uuid; v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if new.team_id is null or new.status is not distinct from old.status then return null; end if;
  if (new.status = 'in_progress' and old.status = 'queued') or new.status = 'cancelled' then
    select * into t from public.order_teams where id = new.team_id for update;
  else
    select * into t from public.order_teams where id = new.team_id;
  end if;
  if new.status = 'in_progress' and old.status = 'queued' then
    if t.status = 'cancelled' then
      raise sqlstate 'PT410' using message = 'This team order was cancelled.';
    end if;
    select pg_catalog.count(*) into v_filled from public.orders
     where team_id = t.id and status in ('in_progress','completed');
    perform public.order_team_chat_join(new, v_filled::integer, t.seats);
    if t.status = 'waiting' and v_filled = t.seats then
      update public.order_teams set status = 'started', started_at = v_now where id = t.id;
      update public.order_payments set settle = 'capture', updated_at = v_now
       where order_id = t.lead_order_id and state = 'authorized' and settle = 'none';
      perform public.order_team_chat_system(t.id, 'team_started',
        'Everyone is here · your team of ' || t.seats::text || ' is complete. GL HF!');
      -- the one-time Discord invite (20261105180000), in every seat's chat once the team is in
      -- (order_chat_system_events leaves it out for team seats, so no single seat swallows it)
      insert into public.order_chat_discord_invites(customer_id, order_id)
        values (t.customer_id, t.lead_order_id) on conflict (customer_id) do nothing;
      if found then
        perform public.order_team_chat_system(t.id, 'discord_invite',
          'Join our Discord for voice comms with your team: https://discord.gg/KuVyByUyV4');
      end if;
    end if;
  elsif new.status = 'cancelled' and t.status = 'waiting' then
    update public.order_teams set status = 'cancelled', ended_at = v_now where id = t.id;
    for v_id in select o.id from public.orders o
        where o.team_id = t.id and o.id <> new.id and o.status in ('queued','in_progress') order by o.seat loop
      perform public.order_team_end_seat(v_id);
    end loop;
    -- a hold from before charge-at-queue is released; a charged team gets its card part back as balance
    update public.order_payments set settle = 'release', updated_at = v_now
     where order_id = t.lead_order_id and state in ('authorized','capture_failed');
    insert into public.refund_credits(order_id, customer_id, kind, amount_eur_cents)
      select t.lead_order_id, t.customer_id, 'paid_refund', p.amount_eur_cents
        from public.order_payments p
       where p.order_id = t.lead_order_id and p.state = 'captured' and p.settle = 'none'
      on conflict (order_id, kind) do nothing;
    perform public.order_team_wallet_return(t.id, 'Order cancelled');
  end if;
  update public.order_teams set status = 'done', ended_at = v_now
   where id = t.id and status = 'started'
     and not exists (select 1 from public.orders o where o.team_id = t.id and o.status in ('queued','in_progress'));
  return null;
end $$;
create trigger orders_team_sync after update of status on public.orders
  for each row execute function public.order_team_sync();

-- What the customer sees about their team (on every seat's order).
create function public.order_team_customer_dto(p_team uuid) returns jsonb
language sql stable set search_path = '' as $$
  select pg_catalog.jsonb_build_object('id', t.id, 'seats', t.seats, 'status', t.status,
    'lead_order_id', t.lead_order_id, 'amount_eur_cents', t.amount_eur_cents,
    'wallet_eur_cents', t.wallet_eur_cents, 'started_at', t.started_at,
    'filled', (select pg_catalog.count(*) from public.orders o where o.team_id = t.id and o.status in ('in_progress','completed')),
    'members', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'order_id', o.id, 'seat', o.seat, 'status', o.status, 'public_reference', o.public_reference,
        'amount_eur_cents', o.amount_eur_cents, 'reviewed', exists (select 1 from public.order_reviews r where r.order_id = o.id),
        -- the room offers "Switch" per teammate: same 5-minute window and limit as reroll_order
        'accepted_at', o.accepted_at, 'rerolls', o.rerolls,
        'teammate', (select pg_catalog.jsonb_build_object('name', p.name, 'image', p.image, 'country', p.country)
                       from public.profiles p where p.id = o.assigned_teammate_id)) order by o.seat)
      from public.orders o where o.team_id = t.id), '[]'::jsonb))
  from public.order_teams t where t.id = p_team;
$$;

-- What a teammate sees about the team on a seat: how full it is and who else is in.
create function public.order_team_teammate_dto(p_team uuid) returns jsonb
language sql stable set search_path = '' as $$
  select pg_catalog.jsonb_build_object('seats', t.seats, 'status', t.status, 'started_at', t.started_at,
    'filled', (select pg_catalog.count(*) from public.orders o where o.team_id = t.id and o.status in ('in_progress','completed')),
    'members', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'name', pg_catalog.split_part(pg_catalog.btrim(p.name), ' ', 1), 'image', p.image) order by o.seat)
      from public.orders o join public.profiles p on p.id = o.assigned_teammate_id
      where o.team_id = t.id and o.status in ('in_progress','completed')), '[]'::jsonb))
  from public.order_teams t where t.id = p_team;
$$;

revoke all on function public.order_team_lock_rooms(uuid) from public, anon, authenticated;
revoke all on function public.order_team_chat_system(uuid, text, text) from public, anon, authenticated;
revoke all on function public.order_team_chat_mirror(public.orders, text, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.order_team_chat_join(public.orders, integer, integer) from public, anon, authenticated;
revoke all on function public.order_team_wallet_return(uuid, text) from public, anon, authenticated;
revoke all on function public.order_team_end_seat(uuid) from public, anon, authenticated;
revoke all on function public.order_team_sync() from public, anon, authenticated;
revoke all on function public.order_team_customer_dto(uuid) from public, anon, authenticated;
revoke all on function public.order_team_teammate_dto(uuid) from public, anon, authenticated;

-- ─── Creating the order ──────────────────────────────────────────────────────────────────────

create or replace function public.create_paid_order(p_intent_id uuid, p_payment_intent text, p_amount_minor integer, p_currency text, p_method text, p_state text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare i public.checkout_intents; p public.profiles; v_order uuid; v_held bigint; h public.wallet_entries;
  v_free jsonb; v_count bigint; v_team uuid; v_share integer; v_seat integer; v_id uuid;
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
  -- Team orders: every seat costs at least the order minimum.
  if i.seats > 1 and i.amount_eur_cents / i.seats < 99 then
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
  if i.seats > 1 then
    -- One order per seat; seat 1 (the lead) carries the rounding, the payment and the wallet part.
    insert into public.order_teams(customer_id, intent_id, seats, amount_eur_cents, wallet_eur_cents)
      values (i.customer_id, i.id, i.seats, i.amount_eur_cents, i.wallet_eur_cents) returning id into v_team;
    v_share := i.amount_eur_cents / i.seats;
    for v_seat in 1..i.seats loop
      insert into public.orders(customer_id, game, service, title, units, unit, gg, rank, region, ign, note, voice, mood,
          customer_name, customer_image, customer_country, amount_eur_cents, booking_fx, payout_usd_cents, wallet_eur_cents,
          team_id, seat, role, character_name)
        values (i.customer_id, i.game, i.service, i.title, i.units, i.unit, i.gg, i.rank, i.region, i.ign, i.note, i.voice, i.mood,
          pg_catalog.left(coalesce(nullif(pg_catalog.btrim(p.name), ''), 'Player'), 40),
          case when p.image ~ '^/assets/avatars/avatar-([1-9]|10)\.png$' then p.image else '' end,
          case when pg_catalog.lower(p.country) ~ '^[a-z]{2}$' then pg_catalog.lower(p.country) else '' end,
          v_share + case when v_seat = 1 then i.amount_eur_cents - v_share * i.seats else 0 end,
          i.booking_fx, i.payout_usd_cents, 0, v_team, v_seat, i.role, i.character_name)
        returning id into v_id;
      if v_seat = 1 then v_order := v_id; end if;
    end loop;
    update public.order_teams set lead_order_id = v_order where id = v_team;
  else
    insert into public.orders(customer_id, game, service, title, units, unit, gg, rank, region, ign, note, voice, mood,
        customer_name, customer_image, customer_country, amount_eur_cents, booking_fx, payout_usd_cents, wallet_eur_cents,
        role, character_name)
      values (i.customer_id, i.game, i.service, i.title, i.units, i.unit, i.gg, i.rank, i.region, i.ign, i.note, i.voice, i.mood,
        pg_catalog.left(coalesce(nullif(pg_catalog.btrim(p.name), ''), 'Player'), 40),
        case when p.image ~ '^/assets/avatars/avatar-([1-9]|10)\.png$' then p.image else '' end,
        case when pg_catalog.lower(p.country) ~ '^[a-z]{2}$' then pg_catalog.lower(p.country) else '' end,
        i.amount_eur_cents, i.booking_fx, i.payout_usd_cents, i.wallet_eur_cents, i.role, i.character_name)
      returning id into v_order;
  end if;
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

-- ─── Money triggers ──────────────────────────────────────────────────────────────────────────

-- Team payments follow the team (order_team_sync), never a single seat.
create or replace function public.order_payment_settle()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  if new.team_id is not null then return new; end if;
  if new.status = 'in_progress' and old.status = 'queued' then
    update public.order_payments set settle = 'capture', updated_at = pg_catalog.clock_timestamp()
     where order_id = new.id and state = 'authorized' and settle = 'none';
  elsif new.status = 'cancelled' and old.status <> 'cancelled' then
    -- a hold from before charge-at-queue is released to the card
    update public.order_payments set settle = 'release', updated_at = pg_catalog.clock_timestamp()
     where order_id = new.id and state in ('authorized','capture_failed');
    -- charge at queue: what the card paid comes back as Duoly balance, never to the card
    insert into public.refund_credits(order_id, customer_id, kind, amount_eur_cents)
      select new.id, new.customer_id, 'paid_refund', p.amount_eur_cents
        from public.order_payments p
       where p.order_id = new.id and p.state = 'captured' and p.settle = 'none'
      on conflict (order_id, kind) do nothing;
  end if;
  return new;
end $function$;

-- A seat cancelled while its team waits is paid back by the team release. After the start, a
-- seat that ends cancelled gives its share back as balance credit.
create or replace function public.order_post_refund()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
begin
  if new.team_id is not null then
    if new.status = 'cancelled'
       and exists (select 1 from public.order_teams t where t.id = new.team_id and t.started_at is not null) then
      insert into public.refund_credits(order_id, customer_id, kind, amount_eur_cents)
        values(new.id, new.customer_id, 'queued_refund', new.amount_eur_cents)
        on conflict (order_id, kind) do nothing;
    end if;
    return new;
  end if;
  if new.status = 'cancelled' and new.wallet_eur_cents = 0
     and not exists (select 1 from public.order_payments as p where p.order_id = new.id)
     and not exists (select 1 from public.free_coaching_claims as f where f.order_id = new.id) then
    insert into public.refund_credits(order_id, customer_id, kind, amount_eur_cents)
      values(new.id, new.customer_id, 'queued_refund', new.amount_eur_cents)
      on conflict (order_id, kind) do nothing;
  end if;
  return new;
end;
$function$;

-- Cashback on a team is worked out on the lead from the team total, less seats already given
-- back as balance credit (a switched teammate nobody replaced).
create or replace function public.loyalty_card_paid_cents(p_order_id uuid)
 returns integer
 language sql
 stable security definer
 set search_path to ''
as $function$
  select coalesce((select greatest(0,least(p.amount_eur_cents,
      coalesce(t.amount_eur_cents - coalesce((select pg_catalog.sum(c.amount_eur_cents) from public.refund_credits c
                                                join public.orders s on s.id=c.order_id where s.team_id=t.id),0),
               o.amount_eur_cents)
      -coalesce((select -pg_catalog.sum(e.amount_eur_cents) from public.wallet_entries e
                                   where e.order_id=o.id and e.kind='checkout_spend'),0)))::integer
    from public.orders o join public.order_payments p on p.order_id=o.id
    left join public.order_teams t on t.lead_order_id=o.id
    where o.id=p_order_id),0)
$function$;

-- Creator attribution: a team is one order (its total, and other seats don't count as earlier orders).
create or replace function public.checkout_intent_attribute()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_ref public.customer_referrals; v_order public.orders; v_amount integer;
begin
  if new.status <> 'paid' or old.status = 'paid' or new.order_id is null then return null; end if;
  if new.free_coaching then return null; end if;
  begin
    select o.* into v_order from public.orders as o where o.id = new.order_id;
    v_amount := coalesce((select t.amount_eur_cents from public.order_teams t where t.id = v_order.team_id), v_order.amount_eur_cents);
    select r.* into v_ref from public.customer_referrals as r where r.customer_id = new.customer_id;
    if v_ref.customer_id is null and new.creator_id is not null
       and exists (select 1 from public.creators as c
                    where c.id = new.creator_id and c.code = new.ref_code and c.active)
       and not exists (select 1 from public.orders as o where o.customer_id = new.customer_id and o.id <> new.order_id
                         and o.team_id is distinct from v_order.team_id) then
      insert into public.customer_referrals(customer_id, creator_id, code, first_order_id)
        values (new.customer_id, new.creator_id, new.ref_code, new.order_id)
        on conflict (customer_id) do nothing;
      select r.* into v_ref from public.customer_referrals as r where r.customer_id = new.customer_id;
    end if;
    if v_ref.customer_id is not null and v_order.created_at < v_ref.attributed_at + interval '12 months' then
      insert into public.order_referrals(order_id, creator_id, customer_id, amount_eur_cents)
        values (new.order_id, v_ref.creator_id, new.customer_id, v_amount)
        on conflict (order_id) do nothing;
    end if;
  exception when others then
    -- A referral problem must never undo a paid order.
    raise warning 'creator attribution skipped for order %: %', new.order_id, sqlerrm;
  end;
  return null;
end;
$function$;

-- A Stripe refund on a team payment refunds the whole team.
create or replace function public.record_payment_refund(p_payment_intent text, p_reason text DEFAULT 'Refund received from Stripe'::text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_order uuid; v_team uuid;
begin
  update public.order_payments set state='refunded',settle='none',refunded_at=coalesce(refunded_at,pg_catalog.clock_timestamp()),
      refund_reason=coalesce(refund_reason,pg_catalog.left(coalesce(nullif(pg_catalog.btrim(p_reason),''),'Refund received from Stripe'),200)),
      last_error=null,updated_at=pg_catalog.clock_timestamp()
    where stripe_payment_intent_id=p_payment_intent returning order_id into v_order;
  if v_order is null then return pg_catalog.jsonb_build_object('updated',false); end if;
  select o.team_id into v_team from public.orders o where o.id = v_order;
  update public.orders set admin_refunded_at=coalesce(admin_refunded_at,pg_catalog.clock_timestamp()),
      admin_refund_reason=coalesce(admin_refund_reason,'Refund received from Stripe')
    where (id=v_order or (v_team is not null and team_id=v_team)) and status in ('in_progress','completed');
  if v_team is not null then
    update public.order_teams set refunded_at = coalesce(refunded_at, pg_catalog.clock_timestamp()) where id = v_team;
  end if;
  return pg_catalog.jsonb_build_object('updated',true,'orderId',v_order);
end;
$function$;

-- Admins refund a team as a whole, from any of its seats.
create or replace function public.admin_refund_order(p_order_id uuid, p_reason text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_actor uuid; v_actor_name text; v_order public.orders; v_payment public.order_payments; v_reason text := pg_catalog.btrim(coalesce(p_reason,''));
  t public.order_teams; v_credited bigint;
begin
  select id,name into v_actor,v_actor_name from public.admin_caller_for('orders');
  if v_actor is null then return public.order_error(403, 'Admins only.'); end if;
  if pg_catalog.char_length(v_reason) not between 3 and 200 then return public.order_error(400, 'Add a reason. It goes into the audit log.'); end if;
  select o.* into v_order from public.orders o where o.id = p_order_id;
  if v_order.id is null then return public.order_error(404, 'Order not found.'); end if;
  if v_order.team_id is not null then
    select * into t from public.order_teams where id = v_order.team_id for update;
    if t.refunded_at is not null then return pg_catalog.jsonb_build_object('orderId',t.lead_order_id,'paymentState','refunded'); end if;
    if t.started_at is null then return public.order_error(409, 'Only started teams can be refunded. A waiting team is released when it is cancelled.'); end if;
    select p.* into v_payment from public.order_payments p where p.order_id = t.lead_order_id for update;
    if v_payment.order_id is not null and v_payment.state = 'refunded' then
      return pg_catalog.jsonb_build_object('orderId',t.lead_order_id,'paymentState','refunded');
    end if;
    if v_payment.order_id is not null and v_payment.state not in ('authorized','captured','capture_failed') then
      return public.order_error(409, 'This payment cannot be refunded right now.');
    end if;
    update public.order_teams set refunded_at = pg_catalog.clock_timestamp() where id = t.id;
    update public.orders set admin_refunded_at=pg_catalog.clock_timestamp(),admin_refund_reason=v_reason
     where team_id = t.id and status in ('in_progress','completed') and admin_refunded_at is null;
    if v_payment.order_id is not null then
      update public.order_payments set settle='refund',refund_reason=v_reason,updated_at=pg_catalog.clock_timestamp()
       where order_id=t.lead_order_id;
    end if;
    perform public.order_team_wallet_return(t.id, 'Order refunded');
    select coalesce(pg_catalog.sum(c.amount_eur_cents),0) into v_credited from public.refund_credits c
      join public.orders o on o.id = c.order_id where o.team_id = t.id;
    perform public.admin_log(v_actor, v_actor_name, 'Refunded team order', v_order.public_reference,
      pg_catalog.concat('€', pg_catalog.to_char(t.amount_eur_cents / 100.0, 'FM999999990.00'), ' for ', t.seats, ' seats',
        case when v_credited > 0 then pg_catalog.concat(' (€', pg_catalog.to_char(v_credited / 100.0, 'FM999999990.00'),
          ' was already credited for unfilled seats)') else '' end, ' · ', v_reason));
    return pg_catalog.jsonb_build_object('orderId',t.lead_order_id,
      'paymentState', case when v_payment.order_id is null then 'refunded' else 'refund_pending' end);
  end if;
  select o.* into v_order from public.orders o where o.id = p_order_id for update;
  if v_order.status not in ('in_progress','completed') then return public.order_error(409, 'Only accepted or completed orders can be refunded.'); end if;
  select p.* into v_payment from public.order_payments p where p.order_id = v_order.id for update;
  if v_payment.order_id is null then
    if v_order.wallet_eur_cents = 0 and not public.order_is_free_perk(v_order.id) then return public.order_error(409, 'This order has no Stripe payment to refund.'); end if;
    if v_order.admin_refunded_at is not null then return pg_catalog.jsonb_build_object('orderId',v_order.id,'paymentState','refunded'); end if;
    update public.orders set admin_refunded_at=pg_catalog.clock_timestamp(),admin_refund_reason=v_reason where id=v_order.id;
    perform public.admin_log(v_actor, v_actor_name, 'Refunded order', v_order.public_reference,
      case when v_order.wallet_eur_cents = 0 then pg_catalog.concat('Free monthly coaching given back · ', v_reason)
      else pg_catalog.concat('€', pg_catalog.to_char(v_order.amount_eur_cents / 100.0, 'FM999999990.00'), ' to Duoly balance · ', v_reason) end);
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
$function$;

-- ─── Queue, taking a seat, re-roll, completion ───────────────────────────────────────────────

-- Also ends seats a team cancel had to skip because they were busy at that moment.
create or replace function public.order_sweep(p_limit integer)
 returns integer
 language plpgsql
 set search_path to ''
as $function$
declare v_id uuid; v_count integer := 0;
begin
  for v_id in select o.id from public.orders as o where o.status = 'queued'
    and o.queued_at + interval '5 minutes' <= pg_catalog.clock_timestamp()
    order by o.queued_at, o.id limit p_limit for update skip locked
  loop
    if public.order_expire_locked(v_id) then v_count := v_count + 1; end if;
  end loop;
  for v_id in select o.id from public.orders as o join public.order_teams as t on t.id = o.team_id
    where t.status = 'cancelled' and o.status in ('queued','in_progress')
    order by o.id limit p_limit
  loop
    if public.order_team_end_seat(v_id) then v_count := v_count + 1; end if;
  end loop;
  return v_count;
end;
$function$;

create or replace function public.order_teammate_dto(p_order orders)
 returns jsonb
 language sql
 stable
 set search_path to ''
as $function$
  select pg_catalog.jsonb_build_object(
    'id', p_order.id, 'public_reference', p_order.public_reference, 'status', p_order.status,
    'game', p_order.game, 'service', p_order.service, 'title', p_order.title,
    'units', p_order.units, 'unit', p_order.unit, 'gg', p_order.gg, 'rank', p_order.rank,
    'region', p_order.region, 'ign', p_order.ign, 'note', p_order.note, 'voice', p_order.voice,
    'mood', p_order.mood,
    'customer_name', p_order.customer_name, 'customer_image', p_order.customer_image,
    'customer_country', p_order.customer_country, 'payout_usd_cents', p_order.payout_usd_cents,
    'current_assignment_id', p_order.current_assignment_id,
    'team', case when p_order.team_id is not null then public.order_team_teammate_dto(p_order.team_id) end,
    'role', p_order.role, 'character', p_order.character_name);
$function$;

-- One card per team: the lowest free seat this teammate may take.
create or replace function public.teammate_order_queue()
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_actor uuid := auth.uid(); v_result jsonb;
begin
  if v_actor is null then return public.order_error(401, 'Authentication required.'); end if;
  if not exists (select 1 from public.account_roles as r join public.teammate_order_access as a on a.user_id = r.user_id where r.user_id = v_actor and r.role = 'teammate' and a.discord_id is not null and a.discord_verified_at is not null and not a.suspended) then return public.order_error(403, 'Verified teammate access required.'); end if;
  perform public.order_sweep(100);
  select coalesce(pg_catalog.jsonb_agg(public.order_teammate_dto(q.o) || pg_catalog.jsonb_build_object('picked_for_you', q.picked)
      order by q.picked desc,q.head_start desc,q.queued_at desc,q.id), '[]'::jsonb) into v_result
    from (select o,public.order_picked_for(o,v_actor) picked,public.order_has_head_start(o.id) head_start,o.queued_at,o.id from public.orders o
      where o.status='queued' and o.queued_at+interval '5 minutes'>pg_catalog.clock_timestamp()
        and public.order_eligible(o,v_actor) and public.teammate_queue_personal_eligible(o,v_actor)
        and not exists(select 1 from public.orders busy where busy.assigned_teammate_id=v_actor and busy.status='in_progress')
        and (o.team_id is null or (
          exists(select 1 from public.order_teams t where t.id=o.team_id and t.status in ('waiting','started'))
          and not exists(select 1 from public.orders s where s.team_id=o.team_id and s.status='queued' and s.seat<o.seat
            and s.queued_at+interval '5 minutes'>pg_catalog.clock_timestamp() and public.order_eligible(s,v_actor))))
      order by public.order_picked_for(o,v_actor) desc,public.order_has_head_start(o.id) desc,o.queued_at desc,o.id limit 100) q;
  return pg_catalog.jsonb_build_object('orders',v_result);
end;
$function$;

create or replace function public.accept_order(p_order_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_actor uuid := auth.uid(); v public.orders; v_assignment uuid; v_now timestamptz;
begin
  if v_actor is null then return public.order_error(401, 'Authentication required.'); end if;
  perform 1 from public.account_roles as r where r.user_id = v_actor and r.role = 'teammate' for update;
  if not found then return public.order_error(403, 'Teammate role required.'); end if;
  perform 1 from public.teammate_order_access as a where a.user_id = v_actor and a.discord_id is not null and a.discord_verified_at is not null and not a.suspended for share;
  if not found then return public.order_error(403, 'Verified teammate access required.'); end if;
  select o.* into v from public.orders as o where o.id = p_order_id for update;
  if v.id is null or not public.order_eligible(v, v_actor) or not public.teammate_queue_personal_eligible(v,v_actor) then return public.order_error(404, 'Order not found.'); end if;
  if public.order_expire_locked(v.id) or v.status = 'cancelled' then return public.order_error(410, 'Order expired or cancelled.'); end if;
  if v.team_id is not null and exists (select 1 from public.order_teams t where t.id = v.team_id and t.status = 'cancelled') then
    return public.order_error(410, 'Order expired or cancelled.');
  end if;
  perform public.order_sweep(100);
  if v.status <> 'queued' then return public.order_error(409, 'Order already taken.'); end if;
  if exists (select 1 from public.orders as o where o.assigned_teammate_id = v_actor and o.status = 'in_progress') then return public.order_error(409, 'Teammate already busy.'); end if;
  v_now := pg_catalog.clock_timestamp();
  insert into public.order_assignments(order_id, teammate_id, accepted_at) values(v.id, v_actor, v_now) returning id into v_assignment;
  update public.orders set status = 'in_progress', assigned_teammate_id = v_actor, current_assignment_id = v_assignment, accepted_at = v_now
    where id = v.id and status = 'queued'
      and queued_at + interval '5 minutes' > pg_catalog.clock_timestamp() returning * into v;
  if not found then
    delete from public.order_assignments where id = v_assignment;
    perform public.order_expire_locked(p_order_id);
    return public.order_error(410, 'Order expired or cancelled.');
  end if;
  return pg_catalog.jsonb_build_object('order', public.order_teammate_dto(v));
end;
$function$;

create or replace function public.reroll_order(p_order_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_actor uuid := auth.uid(); v public.orders; v_now timestamptz; v_limit integer; v_from timestamptz;
begin
  if v_actor is null then return public.order_error(401, 'Authentication required.'); end if;
  if not exists (select 1 from public.account_roles as r where r.user_id = v_actor and r.role = 'customer') then return public.order_error(403, 'Customer role required.'); end if;
  select o.* into v from public.orders as o where o.id = p_order_id and o.customer_id = v_actor for update;
  if v.id is null then return public.order_error(404, 'Order not found.'); end if;
  if public.order_expire_locked(v.id) or v.status = 'cancelled' then return public.order_error(410, 'Order expired or cancelled.'); end if;
  if public.order_streamer(v.id) is not null then return public.order_error(409, 'You booked this streamer, so this order can’t be rerolled.'); end if;
  if v.team_id is not null and not exists (select 1 from public.order_teams t where t.id = v.team_id and t.status = 'started') then
    return public.order_error(409, 'You can switch a teammate once your whole team is in.');
  end if;
  perform public.order_sweep(100);
  v_now := pg_catalog.clock_timestamp();
  v_limit := public.customer_reroll_limit_for(v_actor);
  -- A team seat's 5 minutes start when the whole team is in (nobody plays before), not when the
  -- seat was taken: a teammate who joined first is as switchable as the last one.
  v_from := greatest(v.accepted_at, (select t.started_at from public.order_teams t where t.id = v.team_id));
  if v.status <> 'in_progress' or (v_limit is not null and v.rerolls >= v_limit) or v_from + interval '5 minutes' < v_now then return public.order_error(409, 'Reroll unavailable.'); end if;
  update public.order_assignments set ended_at = v_now, end_reason = 'customer_reroll' where id = v.current_assignment_id;
  update public.orders set status = 'queued', queued_at = v_now, accepted_at = null, assigned_teammate_id = null, current_assignment_id = null, rerolls = rerolls + 1 where id = v.id returning * into v;
  return pg_catalog.jsonb_build_object('order', public.order_customer_dto(v));
end;
$function$;

-- Seats of a team are paid by the lead's payment, and only once the team started.
create or replace function public.complete_order(p_order_id uuid, p_assignment_id uuid, p_proof_ids uuid[], p_request_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_actor uuid := auth.uid(); v public.orders; pay public.order_payments;
 v_proofs uuid[]; v_count bigint; v_now timestamptz; v_held integer; v_result jsonb; v_trust jsonb; v_percent integer;
 v_pay_order uuid;
begin
 if v_actor is null then return public.order_error(401,'Authentication required.'); end if;
 perform 1 from public.account_roles where user_id=v_actor and role='teammate' for update;
 if not found then return public.order_error(403,'Teammate role required.'); end if;
 perform 1 from public.teammate_order_access where user_id=v_actor for share;
 if p_order_id is null or p_assignment_id is null or p_request_id is null or p_proof_ids is null
   or pg_catalog.cardinality(p_proof_ids) not between 1 and 5 or coalesce(pg_catalog.array_ndims(p_proof_ids),1)<>1
   or pg_catalog.array_position(p_proof_ids,null) is not null then return public.order_error(400,'Select one to five distinct ready screenshots.'); end if;
 select pg_catalog.array_agg(distinct x order by x) into v_proofs from pg_catalog.unnest(p_proof_ids) x;
 if pg_catalog.cardinality(v_proofs)<>pg_catalog.cardinality(p_proof_ids) then return public.order_error(400,'Select one to five distinct ready screenshots.'); end if;
 select o.* into v from public.orders o where o.id=p_order_id for update;
 if v.id is null or not coalesce(public.order_proof_player(v,v_actor),false) then return public.order_error(404,'Order not found.'); end if;
 if exists(select 1 from public.teammate_earning_entries where order_id=v.id) then
   select e.result into v_result from public.teammate_earning_entries e where e.order_id=v.id and e.teammate_id=v_actor and e.assignment_id=p_assignment_id and e.request_id=p_request_id and e.proof_ids=v_proofs;
   if found then return v_result; end if;
   return public.order_error(409,'Completion already recorded with another request or proof set.');
 end if;
 if exists(select 1 from public.teammate_earning_entries where teammate_id=v_actor and request_id=p_request_id) then return public.order_error(409,'Request UUID already bound to another completion.'); end if;
 if v.status<>'in_progress' or v.current_assignment_id<>p_assignment_id or not exists(select 1 from public.order_assignments where id=p_assignment_id and ended_at is null) then return public.order_error(409,'Assignment unavailable.'); end if;
 if v.team_id is not null and not exists(select 1 from public.order_teams t where t.id=v.team_id and t.started_at is not null) then
   return public.order_error(409,'Your team starts once every seat is taken.');
 end if;
 -- Win/loss orders (20261102160000): the match report first.
 if public.order_tracks_wl(v) and not exists(select 1 from public.order_match_reports r where r.assignment_id=p_assignment_id) then
   return public.order_error(409,'Fill in the match report first: every game with both IGNs and the match link, plus your wins and losses.');
 end if;
 v_pay_order := coalesce((select t.lead_order_id from public.order_teams t where t.id=v.team_id), v.id);
 select p.* into pay from public.order_payments p where p.order_id=v_pay_order for update;
 if not (pay.order_id is null and public.order_is_free_perk(v.id))
    and (pay.order_id is null or pay.state<>'captured' or pay.settle<>'none') then return public.order_error(409,'Captured settled payment required.'); end if;
 perform 1 from public.order_proof_uploads p where p.id=any(v_proofs) order by p.id for share;
 if (select pg_catalog.count(*) from public.order_proof_uploads p where p.id=any(v_proofs) and p.order_id=v.id and p.assignment_id=p_assignment_id and p.uploader_id=v_actor and p.state='ready')<>pg_catalog.cardinality(v_proofs) then return public.order_error(400,'Select ready screenshots from this assignment.'); end if;
 v_count := public.payout_valid_count(v_actor);
 v_now:=pg_catalog.clock_timestamp(); v_trust:=public.completion_trust(v_count); v_percent:=(v_trust->>'deposit_percent')::integer;
 v_held:=(v.payout_usd_cents*v_percent+50)/100;
 v_result:=pg_catalog.jsonb_build_object('completion',pg_catalog.jsonb_build_object('order_id',v.id,'assignment_id',p_assignment_id,'request_id',p_request_id,'proof_ids',v_proofs,'completed_at',v_now,'payout_usd_cents',v.payout_usd_cents,'deposit_percent',v_percent,'held_usd_cents',v_held,'net_usd_cents',v.payout_usd_cents-v_held,'trust_tier',v_trust->>'trust_tier'));
 insert into public.teammate_earning_entries(order_id,assignment_id,teammate_id,request_id,proof_ids,completed_at,prior_completed_count,trust_tier,payout_usd_cents,deposit_percent,held_usd_cents,net_usd_cents,source_snapshot,result)
 values(v.id,p_assignment_id,v_actor,p_request_id,v_proofs,v_now,v_count,v_trust->>'trust_tier',v.payout_usd_cents,v_percent,v_held,v.payout_usd_cents-v_held,pg_catalog.jsonb_build_object('payout_usd_cents',v.payout_usd_cents,'booking_fx',v.booking_fx,'payment_intent_id',pay.intent_id,'payment_state',pay.state,'payment_settle',pay.settle),v_result);
 insert into public.order_completion_proofs(order_id,proof_id) select v.id,x from pg_catalog.unnest(v_proofs) x;
 update public.order_assignments set ended_at=v_now,end_reason='completed' where id=p_assignment_id;
 update public.orders set status='completed',completed_at=v_now where id=v.id;
 return v_result;
end $function$;

-- ─── Customer views ──────────────────────────────────────────────────────────────────────────

create or replace function public.order_customer_dto(p_order orders)
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
        'method',op.payment_method_type,'wallet_eur_cents',coalesce(tm.wallet_eur_cents,p_order.wallet_eur_cents))
      from (select 1) one
      left join public.order_teams tm on tm.id=p_order.team_id
      left join public.order_payments op on op.order_id=coalesce(tm.lead_order_id,p_order.id)),
    'seat',p_order.seat,
    'team',case when p_order.team_id is not null then public.order_team_customer_dto(p_order.team_id) end,
    'role',p_order.role,'character',p_order.character_name);
$function$;

-- The open booking: for a team, the lowest open seat (the lead while it is open).
create or replace function public.customer_active_order()
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_actor uuid := auth.uid(); v public.orders;
begin
  if v_actor is null then return public.order_error(401, 'Authentication required.'); end if;
  if not exists (select 1 from public.account_roles as r where r.user_id = v_actor and r.role = 'customer') then return public.order_error(403, 'Customer role required.'); end if;
  select o.* into v from public.orders as o where o.customer_id = v_actor and o.status in ('queued','in_progress')
    order by coalesce(o.seat, 0), o.id limit 1 for update;
  if v.id is not null and public.order_expire_locked(v.id) then v := null; end if;
  perform public.order_sweep(100);
  -- A target can cross its deadline inside our own sweep despite the held lock.
  if v.id is not null then
    select o.* into v from public.orders as o
      where o.id = v.id and o.customer_id = v_actor and o.status in ('queued','in_progress');
  end if;
  if v.id is null then
    select o.* into v from public.orders as o where o.customer_id = v_actor and o.status in ('queued','in_progress')
      order by coalesce(o.seat, 0), o.id limit 1;
  end if;
  return pg_catalog.jsonb_build_object('order', case when v.id is not null then public.order_customer_dto(v) else null end);
end;
$function$;

-- History lists a team once, on its lead seat (the team block lists every seat).
create or replace function public.customer_order_history(p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_actor uuid := auth.uid(); v_result jsonb; v_id uuid;
begin
  if v_actor is null then return public.order_error(401, 'Authentication required.'); end if;
  if not exists (select 1 from public.account_roles as r where r.user_id = v_actor and r.role = 'customer') then return public.order_error(403, 'Customer role required.'); end if;
  if p_limit is null or p_limit not between 1 and 100 or p_offset is null or p_offset not between 0 and 100000 then return public.order_error(400, 'Invalid pagination.'); end if;
  for v_id in select o.id from public.orders as o where o.customer_id = v_actor and o.status = 'queued' loop perform public.order_expire_locked(v_id); end loop;
  perform public.order_sweep(100);
  select coalesce(pg_catalog.jsonb_agg(public.order_customer_dto(q) order by q.created_at desc, q.id), '[]'::jsonb) into v_result
    from (select o.* from public.orders as o where o.customer_id = v_actor and coalesce(o.seat, 1) = 1
      order by o.created_at desc, o.id limit p_limit offset p_offset) as q;
  return pg_catalog.jsonb_build_object('orders', v_result);
end;
$function$;

-- Play again rebooks one teammate; a team is booked again from the homepage.
create or replace function public.customer_play_again(p_order uuid)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
declare v_actor uuid := auth.uid(); o public.orders; v_now timestamptz := pg_catalog.clock_timestamp();
  v_online boolean; v_reason text;
begin
  if v_actor is null then return public.order_error(401, 'Authentication required.'); end if;
  if not exists(select 1 from public.account_roles r where r.user_id = v_actor and r.role = 'customer') then
    return public.order_error(403, 'Customer role required.');
  end if;
  select * into o from public.orders where id = p_order and customer_id = v_actor;
  if o.id is null then return public.order_error(404, 'Order not found.'); end if;
  v_online := coalesce((select t.online and t.last_seen_at > v_now - interval '20 seconds'
    from public.teammate_presence t where t.user_id = o.assigned_teammate_id), false);
  v_reason := case
    when o.status <> 'completed' or o.admin_refunded_at is not null then 'not_done'
    when o.team_id is not null then 'team'
    when public.order_streamer(o.id) is not null then 'streamer'
    when exists(select 1 from public.free_coaching_claims c where c.order_id = o.id) then 'free_coaching'
    when exists(select 1 from public.orders b where b.customer_id = v_actor and b.status in ('queued','in_progress')) then 'open_order'
    when exists(select 1 from public.orders b where b.assigned_teammate_id = o.assigned_teammate_id and b.status = 'in_progress') then 'teammate_busy'
    when not v_online then 'teammate_away'
    when public.order_pick_candidate(v_actor, o.id, o.game, o.gg, o.voice, v_now) is null
      or (select public.order_tier_open_at(o, a) from public.teammate_order_access a
           where a.user_id = o.assigned_teammate_id) is null then 'teammate_unavailable'
  end;
  return pg_catalog.jsonb_build_object('available', v_reason is null, 'reason', v_reason);
end $function$;

-- ─── Group chat ──────────────────────────────────────────────────────────────────────────────

create or replace function public.send_order_chat_message(p_order_id uuid, p_assignment_id uuid, p_request_id uuid, p_body text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_actor uuid := auth.uid(); v public.orders; v_viewer text; v_prior public.order_chat_attempts;
  v_digest bytea; v_body text; v_rule text; v_result jsonb; v_message jsonb; v_name text; v_image text;
begin
  if v_actor is null then return public.order_error(401,'Authentication required.'); end if;
  -- Preliminary authorization before creating actor state or inspecting/reflection of body.
  if not exists (select 1 from public.orders as o where o.id = p_order_id
    and public.order_chat_viewer(o,p_assignment_id) in ('customer','teammate')) then
    return public.order_error(403,'Chat write forbidden.');
  end if;
  -- Global per-account mutex -> fresh role/access locks -> order -> (team chat) -> room.
  insert into public.order_chat_rate_accounts(actor_id) values(v_actor) on conflict (actor_id) do nothing;
  perform 1 from public.order_chat_rate_accounts as s where s.actor_id = v_actor for update;
  perform 1 from public.account_roles as r where r.user_id = v_actor for share;
  perform 1 from public.teammate_order_access as x where x.user_id = v_actor for share;
  select o.* into v from public.orders as o where o.id = p_order_id for update;
  v_viewer := public.order_chat_viewer(v,p_assignment_id);
  if v_viewer is null or v_viewer = 'admin' then return public.order_error(403,'Chat write forbidden.'); end if;
  if p_assignment_id is null or not exists (select 1 from public.order_chat_rooms as c
    where c.assignment_id = p_assignment_id and c.order_id = p_order_id) then return public.order_error(409,'Assignment changed.'); end if;
  if v.team_id is not null then
    perform public.order_team_lock_rooms(v.team_id);
  end if;
  perform 1 from public.order_chat_rooms as c where c.assignment_id = p_assignment_id for update;
  if p_request_id is null or p_body is null then return public.order_error(400,'Request UUID and body required.'); end if;
  v_digest := pg_catalog.sha256(pg_catalog.convert_to(p_body,'UTF8'));
  select a.* into v_prior from public.order_chat_attempts as a
    where a.actor_id = v_actor and a.assignment_id = p_assignment_id and a.request_id = p_request_id;
  if found then
    if v_prior.body_digest <> v_digest then return public.order_error(409,'Request UUID already bound to another body.'); end if;
    -- Authorized participant can reconcile a committed send after completion or reroll.
    -- A former teammate fails fresh authorization above; no archive leak via retry.
    return v_prior.result;
  end if;
  if v.status <> 'in_progress' or v.current_assignment_id is distinct from p_assignment_id then return public.order_error(409,'Chat is read-only or assignment changed.'); end if;
  if pg_catalog.char_length(p_body) > 500 then return public.order_error(400,'Messages must be at most 500 code points.'); end if;
  -- Match ECMAScript trim (HTTP input contract), preserving internal newlines/emoji.
  -- Reject rather than silently rewriting controls so send-result body binding holds.
  if p_body ~ E'[\\x01-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F]' then
    return public.order_error(400,'Unsupported control characters.');
  end if;
  v_body := pg_catalog.btrim(p_body,E' \n\r\t' || U&'\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF');
  if pg_catalog.char_length(v_body) = 0 then return public.order_error(400,'Type a message first.'); end if;
  if (select pg_catalog.count(*) from public.order_chat_attempts as a where a.actor_id = v_actor
      and a.created_at > pg_catalog.clock_timestamp() - interval '1 minute') >= 20 then
    return public.order_error(429,'Slow down a little, then try again.');
  end if;
  select p.name,p.image into v_name,v_image from public.profiles as p where p.id = v_actor;
  v_rule := public.order_chat_block_rule(v_body);
  if v_rule is not null then
    -- Match original duplicate-flag protection, even across fresh request UUIDs.
    -- Account lock also serializes this check. Blocked text exists only here.
    if not exists (select 1 from public.order_chat_flags as f where f.actor_id = v_actor and f.body = v_body
      and f.created_at > pg_catalog.clock_timestamp() - interval '1 minute') then
      insert into public.order_chat_flags(order_id,assignment_id,actor_id,sender_name,body,rule)
        values(v.id,p_assignment_id,v_actor,v_name,v_body,v_rule);
    end if;
    v_result := pg_catalog.jsonb_build_object('order_id',v.id,'assignment_id',p_assignment_id,'request_id',p_request_id,
      'outcome','blocked','message',null,'note','Not sent: keep payments and account details on Duoly. Never ask for logins or outside payments.');
  else
    v_message := public.order_chat_append(p_assignment_id,v_viewer,v_name,v_image,v_body,p_request_id);
    v_result := pg_catalog.jsonb_build_object('order_id',v.id,'assignment_id',p_assignment_id,'request_id',p_request_id,
      'outcome','sent','message',v_message,'note',null);
    update public.order_chat_typing set expires_at = pg_catalog.clock_timestamp()
      where assignment_id = p_assignment_id and actor_id = v_actor;
    perform public.order_chat_invalidate(p_assignment_id);
    if v.team_id is not null then
      perform public.order_team_chat_mirror(v, v_viewer, v_name, v_image, v_body, p_request_id);
    end if;
  end if;
  insert into public.order_chat_attempts(actor_id,assignment_id,request_id,body_digest,result)
    values(v_actor,p_assignment_id,p_request_id,v_digest,v_result);
  return v_result;
end;
$function$;

-- The 20261105180000_chat_discord_invite.sql version; changed: a team seat doesn't send the
-- one-time Discord invite when it's taken (the customer reads another seat's chat, and system lines
-- aren't copied between seats). order_team_sync sends it to every seat once the team is complete.
create or replace function public.order_chat_system_events(p_order orders)
 returns void
 language plpgsql
 set search_path to ''
as $function$
declare v_room public.order_chat_rooms; v_name text; v_invited uuid;
begin
  if p_order.current_assignment_id is null or p_order.status not in ('in_progress','completed') then return; end if;
  insert into public.order_chat_rooms(assignment_id,order_id)
    values(p_order.current_assignment_id,p_order.id) on conflict (assignment_id) do nothing;
  select c.* into v_room from public.order_chat_rooms as c where c.assignment_id = p_order.current_assignment_id for update;
  if not v_room.accepted_emitted then
    select p.name into v_name from public.profiles as p where p.id = p_order.assigned_teammate_id;
    perform public.order_chat_append(p_order.current_assignment_id,'system','Duoly','',
      pg_catalog.split_part(v_name,' ',1) || ' accepted the order · ' || p_order.title || ' ×' || p_order.units::text,null,'accepted');
    update public.order_chat_rooms set accepted_emitted = true where assignment_id = p_order.current_assignment_id;
    -- once per customer: the insert only wins the first time, under the primary key
    if p_order.status = 'in_progress' and p_order.team_id is null then
      insert into public.order_chat_discord_invites(customer_id,order_id)
        values(p_order.customer_id,p_order.id) on conflict (customer_id) do nothing
        returning customer_id into v_invited;
      if v_invited is not null then
        perform public.order_chat_append(p_order.current_assignment_id,'system','Duoly','',
          'Join our Discord for voice comms with your teammate: https://discord.gg/KuVyByUyV4',null,'discord_invite');
      end if;
    end if;
    perform public.order_chat_invalidate(p_order.current_assignment_id);
  end if;
  if p_order.status = 'completed' and not v_room.completed_emitted then
    -- Review/tipping is not active. Do not advertise an unimplemented money flow.
    perform public.order_chat_append(p_order.current_assignment_id,'system','Duoly','','Order complete · GG!',null,'completed');
    update public.order_chat_rooms set completed_emitted = true where assignment_id = p_order.current_assignment_id;
    perform public.order_chat_invalidate(p_order.current_assignment_id);
  end if;
end;
$function$;

-- ─── Discord posts: one open post per team, for its lowest free seat ─────────────────────────

create or replace function public.discord_order_posts_due(p_after_seconds integer DEFAULT 100)
 returns jsonb
 language sql
 stable security definer
 set search_path to ''
as $function$
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id', o.id, 'reference', o.public_reference, 'game', o.game, 'title', o.title,
    'units', o.units, 'unit', o.unit, 'rank', o.rank, 'region', o.region, 'voice', o.voice, 'mood', o.mood,
    'gg', o.gg, 'payoutUsdCents', o.payout_usd_cents,
    'queuedAt', o.queued_at, 'cancelsAt', o.queued_at + interval '5 minutes',
    'role', o.role, 'character', o.character_name,
    'seats', t.seats,
    'seatsTaken', case when t.id is not null then (select pg_catalog.count(*) from public.orders s
      where s.team_id = t.id and s.status in ('in_progress','completed')) end
  ) order by o.queued_at), '[]'::jsonb)
  from public.orders o
  left join public.order_teams t on t.id = o.team_id
  where o.status = 'queued'
    and public.order_public_queued_at(o) <= pg_catalog.clock_timestamp() - pg_catalog.make_interval(secs => greatest(p_after_seconds, 0))
    -- leave 20 seconds so nobody gets pinged for a link that is about to die
    and o.queued_at + interval '5 minutes' > pg_catalog.clock_timestamp() + interval '20 seconds'
    and (t.id is null or (t.status in ('waiting','started')
      and not exists (select 1 from public.orders s where s.team_id = t.id and s.status = 'queued' and s.seat < o.seat)
      and not exists (select 1 from public.discord_order_posts d join public.orders s on s.id = d.order_id
        where s.team_id = t.id and d.state in ('posting','open'))))
    and not exists (
      select 1 from public.discord_order_posts d
       where d.order_id = o.id and d.queue_key = o.queued_at
         and (d.state <> 'posting' or d.created_at > pg_catalog.clock_timestamp() - interval '1 minute')
    );
$function$;

commit;
