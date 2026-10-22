-- Durable foundation only. No payment producer, completion, presence or realtime.
begin;

create sequence public.order_reference_seq start with 48301;
create table public.orders (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  public_reference text not null unique default ('DL-' || pg_catalog.nextval('public.order_reference_seq'::pg_catalog.regclass)::text),
  customer_id uuid not null references public.profiles(id) on delete restrict,
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
  customer_name text not null check (pg_catalog.char_length(customer_name) between 1 and 40),
  customer_image text not null default '' check (customer_image = '' or customer_image ~ '^/assets/avatars/avatar-([1-9]|10)\.png$'),
  customer_country text not null default '' check (customer_country = '' or customer_country ~ '^[a-z]{2}$'),
  amount_eur_cents integer not null check (amount_eur_cents between 99 and 100000),
  booking_fx numeric(12,6) not null check (booking_fx between 0.01 and 100),
  payout_usd_cents integer not null check (payout_usd_cents between 99 and 10000000),
  status text not null default 'queued' check (status in ('queued','in_progress','completed','cancelled')),
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  queued_at timestamptz not null default pg_catalog.clock_timestamp(),
  accepted_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  assigned_teammate_id uuid references public.profiles(id) on delete restrict,
  current_assignment_id uuid,
  rerolls integer not null default 0 check (rerolls between 0 and 2),
  cancel_reason text check (cancel_reason in ('queue_expired','customer_cancelled')),
  unique (id, customer_id, amount_eur_cents),
  check (public_reference ~ '^DL-[0-9]+$'),
  check (assigned_teammate_id is null or assigned_teammate_id <> customer_id),
  check (queued_at >= created_at),
  constraint orders_state_check check (
    (status = 'queued' and assigned_teammate_id is null and current_assignment_id is null and accepted_at is null and completed_at is null and cancelled_at is null and cancel_reason is null)
    or (status = 'in_progress' and assigned_teammate_id is not null and current_assignment_id is not null and accepted_at is not null and accepted_at >= queued_at and completed_at is null and cancelled_at is null and cancel_reason is null)
    or (status = 'completed' and assigned_teammate_id is not null and current_assignment_id is not null and accepted_at is not null and accepted_at >= queued_at and completed_at is not null and completed_at >= accepted_at and cancelled_at is null and cancel_reason is null)
    or (status = 'cancelled' and assigned_teammate_id is null and current_assignment_id is null and accepted_at is null and completed_at is null and cancelled_at is not null and cancelled_at >= queued_at and cancel_reason is not null)
  )
);
alter sequence public.order_reference_seq owned by public.orders.public_reference;
create unique index orders_one_open_customer on public.orders(customer_id) where status in ('queued', 'in_progress');
create unique index orders_one_active_teammate on public.orders(assigned_teammate_id) where status = 'in_progress';
create index orders_queue_deadline on public.orders(queued_at, id) where status = 'queued';
create index orders_customer_history on public.orders(customer_id, created_at desc, id);

create table public.order_assignments (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  teammate_id uuid not null references public.profiles(id) on delete restrict,
  accepted_at timestamptz not null,
  ended_at timestamptz,
  end_reason text check (end_reason = 'customer_reroll'),
  unique (id, order_id, teammate_id),
  unique (order_id, teammate_id),
  check ((ended_at is null and end_reason is null) or (ended_at is not null and ended_at >= accepted_at and end_reason is not null))
);
create unique index assignments_one_current_order on public.order_assignments(order_id) where ended_at is null;
create unique index assignments_one_current_teammate on public.order_assignments(teammate_id) where ended_at is null;
alter table public.orders add constraint orders_current_assignment_fk
  foreign key (current_assignment_id, id, assigned_teammate_id)
  references public.order_assignments(id, order_id, teammate_id) on delete restrict;

create table public.teammate_order_access (
  user_id uuid primary key references public.profiles(id) on delete restrict,
  approved_games text[] not null default '{}' check (
    pg_catalog.cardinality(approved_games) <= 15 and approved_games <@ array['lol','val','cs2','fn','cod','apex','r6','mr','ow','rl','tft','fc','arc','mc','pu']::text[]
    and pg_catalog.array_position(approved_games, null) is null),
  gg_access boolean not null default false,
  discord_id text unique check (discord_id ~ '^[0-9]{17,20}$'),
  discord_verified_at timestamptz,
  suspended boolean not null default false,
  priority_base integer not null default 50 check (priority_base between 0 and 100),
  priority_adjustment integer not null default 0 check (priority_adjustment in (0,10,20,35,-10,-20,-35)),
  priority_adjustment_expires_at timestamptz,
  check ((discord_id is null) = (discord_verified_at is null))
);
create table public.refund_credits (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  customer_id uuid not null references public.profiles(id) on delete restrict,
  kind text not null check (kind = 'queued_refund'),
  amount_eur_cents integer not null check (amount_eur_cents between 99 and 100000),
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  unique (order_id, kind),
  foreign key (order_id, customer_id, amount_eur_cents)
    references public.orders(id, customer_id, amount_eur_cents) on delete restrict
);
create index refund_credits_customer on public.refund_credits(customer_id, created_at desc, id);

alter table public.orders enable row level security;
alter table public.order_assignments enable row level security;
alter table public.teammate_order_access enable row level security;
alter table public.refund_credits enable row level security;
-- No client policies or SELECT grants: prevents raw-table realtime disclosure too.
revoke all on table public.orders from public, anon, authenticated, service_role;
revoke all on table public.order_assignments from public, anon, authenticated, service_role;
revoke all on table public.teammate_order_access from public, anon, authenticated, service_role;
revoke all on table public.refund_credits from public, anon, authenticated, service_role;
revoke all on sequence public.order_reference_seq from public, anon, authenticated, service_role;
grant select, insert on table public.orders to service_role;
grant select on table public.order_assignments, public.refund_credits to service_role;
grant select, insert, update, delete on table public.teammate_order_access to service_role;
grant usage on sequence public.order_reference_seq to service_role;

-- Private invoker helpers: only reachable through the explicitly granted RPCs.
create function public.order_error(p_code integer, p_message text) returns jsonb
language sql immutable security invoker set search_path = '' as $$
  select pg_catalog.jsonb_build_object('error', pg_catalog.jsonb_build_object('code', p_code, 'message', p_message));
$$;
create function public.order_customer_dto(p_order public.orders) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select pg_catalog.jsonb_build_object(
    'id', p_order.id, 'public_reference', p_order.public_reference, 'status', p_order.status,
    'game', p_order.game, 'service', p_order.service, 'title', p_order.title,
    'units', p_order.units, 'unit', p_order.unit, 'gg', p_order.gg,
    'rank', p_order.rank, 'region', p_order.region, 'ign', p_order.ign, 'note', p_order.note, 'voice', p_order.voice,
    'amount_eur_cents', p_order.amount_eur_cents, 'created_at', p_order.created_at, 'queued_at', p_order.queued_at,
    'accepted_at', p_order.accepted_at, 'completed_at', p_order.completed_at, 'cancelled_at', p_order.cancelled_at,
    'cancel_reason', p_order.cancel_reason, 'rerolls', p_order.rerolls, 'current_assignment_id', p_order.current_assignment_id,
    'teammate', (select pg_catalog.jsonb_build_object('name', p.name, 'image', p.image, 'country', p.country)
      from public.profiles as p where p.id = p_order.assigned_teammate_id));
$$;
create function public.order_teammate_dto(p_order public.orders) returns jsonb
language sql immutable security invoker set search_path = '' as $$
  select pg_catalog.jsonb_build_object(
    'id', p_order.id, 'public_reference', p_order.public_reference, 'status', p_order.status,
    'game', p_order.game, 'service', p_order.service, 'title', p_order.title,
    'units', p_order.units, 'unit', p_order.unit, 'gg', p_order.gg, 'rank', p_order.rank,
    'region', p_order.region, 'ign', p_order.ign, 'note', p_order.note, 'voice', p_order.voice,
    'customer_name', p_order.customer_name, 'customer_image', p_order.customer_image,
    'customer_country', p_order.customer_country, 'payout_usd_cents', p_order.payout_usd_cents,
    'current_assignment_id', p_order.current_assignment_id);
$$;
create function public.order_eligible(p_order public.orders, p_actor uuid) returns boolean
language sql volatile security invoker set search_path = '' as $$
  select exists (select 1 from public.account_roles as r
    join public.teammate_order_access as a on a.user_id = r.user_id
    where r.user_id = p_actor and r.role = 'teammate' and not a.suspended
      and a.discord_id is not null and a.discord_verified_at is not null
      and p_order.customer_id <> p_actor
      and ((a.gg_access and p_order.gg) or (not a.gg_access and not p_order.gg and p_order.game = any(a.approved_games)))
      and p_order.queued_at + pg_catalog.make_interval(secs => greatest(0, least(100,
        a.priority_base - case when a.priority_adjustment_expires_at is null or a.priority_adjustment_expires_at > pg_catalog.clock_timestamp()
          then a.priority_adjustment else 0 end))) <= pg_catalog.clock_timestamp()
      and not exists (select 1 from public.order_assignments as h where h.order_id = p_order.id and h.teammate_id = p_actor and h.end_reason = 'customer_reroll'));
$$;
-- Atomic full credit, even when a future trusted producer inserts an already cancelled row.
create function public.order_post_refund() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.status = 'cancelled' then
    insert into public.refund_credits(order_id, customer_id, kind, amount_eur_cents)
      values(new.id, new.customer_id, 'queued_refund', new.amount_eur_cents)
      on conflict (order_id, kind) do nothing;
  end if;
  return new;
end;
$$;
create trigger orders_post_refund after insert or update of status on public.orders
  for each row execute function public.order_post_refund();
create function public.order_expire_locked(p_id uuid) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare v public.orders;
begin
  select o.* into v from public.orders as o where o.id = p_id for update;
  if v.status = 'queued' and v.queued_at + interval '5 minutes' <= pg_catalog.clock_timestamp() then
    update public.orders set status = 'cancelled', cancelled_at = pg_catalog.clock_timestamp(), cancel_reason = 'queue_expired' where id = v.id;
    return true;
  end if;
  return false;
end;
$$;
create function public.order_sweep(p_limit integer) returns integer
language plpgsql security invoker set search_path = '' as $$
declare v_id uuid; v_count integer := 0;
begin
  for v_id in select o.id from public.orders as o where o.status = 'queued'
    and o.queued_at + interval '5 minutes' <= pg_catalog.clock_timestamp()
    order by o.queued_at, o.id limit p_limit for update skip locked
  loop
    if public.order_expire_locked(v_id) then v_count := v_count + 1; end if;
  end loop;
  return v_count;
end;
$$;

-- RPC signatures and JSON envelopes (no actor/bypass/time/price inputs):
-- customer_active_order() -> {order: object|null}
-- customer_order(p_order_id uuid) -> {order: object} or {error:{code:number,message:text}}
-- customer_order_history(p_limit integer DEFAULT 50, p_offset integer DEFAULT 0) -> {orders: []}
-- customer_refund_credits(p_limit integer DEFAULT 50, p_offset integer DEFAULT 0) -> {credits: []}
-- teammate_order_queue() -> {orders: []}; teammate_current_assignment() -> {order: object|null}
-- accept_order(p_order_id uuid), cancel_queued_order(p_order_id uuid), reroll_order(p_order_id uuid) -> {order: object} or {error:{code:number,message:text}}
-- sweep_expired_orders(p_limit integer DEFAULT 100) -> {expired_count: number}, service_role only.
create function public.customer_active_order() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v public.orders;
begin
  if v_actor is null then return public.order_error(401, 'Authentication required.'); end if;
  if not exists (select 1 from public.account_roles as r where r.user_id = v_actor and r.role = 'customer') then return public.order_error(403, 'Customer role required.'); end if;
  select o.* into v from public.orders as o where o.customer_id = v_actor and o.status in ('queued','in_progress') for update;
  if v.id is not null and public.order_expire_locked(v.id) then v := null; end if;
  perform public.order_sweep(100);
  -- A target can cross its deadline inside our own sweep despite the held lock.
  if v.id is not null then
    select o.* into v from public.orders as o
      where o.id = v.id and o.customer_id = v_actor and o.status in ('queued','in_progress');
  end if;
  return pg_catalog.jsonb_build_object('order', case when v.id is not null then public.order_customer_dto(v) else null end);
end;
$$;
create function public.customer_order(p_order_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v public.orders;
begin
  if v_actor is null then return public.order_error(401, 'Authentication required.'); end if;
  if not exists (select 1 from public.account_roles as r where r.user_id = v_actor and r.role = 'customer') then return public.order_error(403, 'Customer role required.'); end if;
  select o.* into v from public.orders as o where o.id = p_order_id and o.customer_id = v_actor for update;
  perform public.order_sweep(100);
  if v.id is null then return public.order_error(404, 'Order not found.'); end if;
  perform public.order_expire_locked(v.id);
  select o.* into v from public.orders as o where o.id = v.id;
  return pg_catalog.jsonb_build_object('order', public.order_customer_dto(v));
end;
$$;
create function public.customer_order_history(p_limit integer default 50, p_offset integer default 0) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_result jsonb; v_id uuid;
begin
  if v_actor is null then return public.order_error(401, 'Authentication required.'); end if;
  if not exists (select 1 from public.account_roles as r where r.user_id = v_actor and r.role = 'customer') then return public.order_error(403, 'Customer role required.'); end if;
  if p_limit is null or p_limit not between 1 and 100 or p_offset is null or p_offset not between 0 and 100000 then return public.order_error(400, 'Invalid pagination.'); end if;
  for v_id in select o.id from public.orders as o where o.customer_id = v_actor and o.status = 'queued' loop perform public.order_expire_locked(v_id); end loop;
  perform public.order_sweep(100);
  select coalesce(pg_catalog.jsonb_agg(public.order_customer_dto(q) order by q.created_at desc, q.id), '[]'::jsonb) into v_result
    from (select o.* from public.orders as o where o.customer_id = v_actor order by o.created_at desc, o.id limit p_limit offset p_offset) as q;
  return pg_catalog.jsonb_build_object('orders', v_result);
end;
$$;
create function public.customer_refund_credits(p_limit integer default 50, p_offset integer default 0) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_result jsonb; v_id uuid;
begin
  if v_actor is null then return public.order_error(401, 'Authentication required.'); end if;
  if not exists (select 1 from public.account_roles as r where r.user_id = v_actor and r.role = 'customer') then return public.order_error(403, 'Customer role required.'); end if;
  if p_limit is null or p_limit not between 1 and 100 or p_offset is null or p_offset not between 0 and 100000 then return public.order_error(400, 'Invalid pagination.'); end if;
  for v_id in select o.id from public.orders as o where o.customer_id = v_actor and o.status = 'queued' loop perform public.order_expire_locked(v_id); end loop;
  perform public.order_sweep(100);
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id', q.id, 'order_id', q.order_id,
    'kind', q.kind, 'amount_eur_cents', q.amount_eur_cents, 'created_at', q.created_at) order by q.created_at desc, q.id), '[]'::jsonb)
    into v_result from (select c.* from public.refund_credits as c where c.customer_id = v_actor order by c.created_at desc, c.id limit p_limit offset p_offset) as q;
  return pg_catalog.jsonb_build_object('credits', v_result);
end;
$$;
create function public.teammate_order_queue() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_result jsonb;
begin
  if v_actor is null then return public.order_error(401, 'Authentication required.'); end if;
  if not exists (select 1 from public.account_roles as r join public.teammate_order_access as a on a.user_id = r.user_id where r.user_id = v_actor and r.role = 'teammate' and a.discord_id is not null and a.discord_verified_at is not null and not a.suspended) then return public.order_error(403, 'Verified teammate access required.'); end if;
  perform public.order_sweep(100);
  select coalesce(pg_catalog.jsonb_agg(public.order_teammate_dto(q) order by q.queued_at desc, q.id), '[]'::jsonb) into v_result
    from (select o.* from public.orders as o where o.status = 'queued' and o.queued_at + interval '5 minutes' > pg_catalog.clock_timestamp()
      and public.order_eligible(o, v_actor) and not exists (select 1 from public.orders as busy where busy.assigned_teammate_id = v_actor and busy.status = 'in_progress')
      order by o.queued_at desc, o.id limit 100) as q;
  return pg_catalog.jsonb_build_object('orders', v_result);
end;
$$;
create function public.teammate_current_assignment() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v public.orders;
begin
  if v_actor is null then return public.order_error(401, 'Authentication required.'); end if;
  if not exists (select 1 from public.account_roles as r join public.teammate_order_access as a on a.user_id = r.user_id where r.user_id = v_actor and r.role = 'teammate' and a.discord_id is not null and a.discord_verified_at is not null and not a.suspended) then return public.order_error(403, 'Verified teammate access required.'); end if;
  perform public.order_sweep(100);
  select o.* into v from public.orders as o
    join public.teammate_order_access as a on a.user_id = v_actor
    where o.assigned_teammate_id = v_actor and o.status = 'in_progress'
      and ((a.gg_access and o.gg) or (not a.gg_access and not o.gg and o.game = any(a.approved_games)));
  return pg_catalog.jsonb_build_object('order', case when v.id is not null then public.order_teammate_dto(v) else null end);
end;
$$;
create function public.accept_order(p_order_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v public.orders; v_assignment uuid; v_now timestamptz;
begin
  if v_actor is null then return public.order_error(401, 'Authentication required.'); end if;
  -- Stable per-teammate mutex; also prevents concurrent role/access revocation during acceptance.
  perform 1 from public.account_roles as r where r.user_id = v_actor and r.role = 'teammate' for update;
  if not found then return public.order_error(403, 'Teammate role required.'); end if;
  perform 1 from public.teammate_order_access as a where a.user_id = v_actor and a.discord_id is not null and a.discord_verified_at is not null and not a.suspended for share;
  if not found then return public.order_error(403, 'Verified teammate access required.'); end if;
  select o.* into v from public.orders as o where o.id = p_order_id for update;
  if v.id is null or not public.order_eligible(v, v_actor) then return public.order_error(404, 'Order not found.'); end if;
  -- These mutations MUST survive the business error: no exception/rollback wrapper.
  if public.order_expire_locked(v.id) or v.status = 'cancelled' then return public.order_error(410, 'Order expired or cancelled.'); end if;
  perform public.order_sweep(100);
  if v.status <> 'queued' then return public.order_error(409, 'Order already taken.'); end if;
  if exists (select 1 from public.orders as o where o.assigned_teammate_id = v_actor and o.status = 'in_progress') then return public.order_error(409, 'Teammate already busy.'); end if;
  v_now := pg_catalog.clock_timestamp();
  insert into public.order_assignments(order_id, teammate_id, accepted_at) values(v.id, v_actor, v_now) returning id into v_assignment;
  update public.orders set status = 'in_progress', assigned_teammate_id = v_actor, current_assignment_id = v_assignment, accepted_at = v_now
    where id = v.id and status = 'queued'
      and queued_at + interval '5 minutes' > pg_catalog.clock_timestamp() returning * into v;
  if not found then
    -- Deadline may cross while inserting the provisional history row. Do not
    -- retain that row or throw an exception that would undo the refund.
    delete from public.order_assignments where id = v_assignment;
    perform public.order_expire_locked(p_order_id);
    return public.order_error(410, 'Order expired or cancelled.');
  end if;
  return pg_catalog.jsonb_build_object('order', public.order_teammate_dto(v));
end;
$$;
create function public.cancel_queued_order(p_order_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v public.orders;
begin
  if v_actor is null then return public.order_error(401, 'Authentication required.'); end if;
  if not exists (select 1 from public.account_roles as r where r.user_id = v_actor and r.role = 'customer') then return public.order_error(403, 'Customer role required.'); end if;
  select o.* into v from public.orders as o where o.id = p_order_id and o.customer_id = v_actor for update;
  perform public.order_sweep(100);
  if v.id is null then return public.order_error(404, 'Order not found.'); end if;
  perform public.order_expire_locked(v.id);
  select o.* into v from public.orders as o where o.id = v.id;
  if v.status = 'cancelled' then return pg_catalog.jsonb_build_object('order', public.order_customer_dto(v)); end if;
  if v.status <> 'queued' then return public.order_error(409, 'Only queued orders can be cancelled.'); end if;
  update public.orders set status = 'cancelled', cancelled_at = pg_catalog.clock_timestamp(), cancel_reason = 'customer_cancelled' where id = v.id returning * into v;
  return pg_catalog.jsonb_build_object('order', public.order_customer_dto(v));
end;
$$;
create function public.reroll_order(p_order_id uuid) returns jsonb
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
  if v.status <> 'in_progress' or v.rerolls >= 2 or v.accepted_at + interval '5 minutes' < v_now then return public.order_error(409, 'Reroll unavailable.'); end if;
  update public.order_assignments set ended_at = v_now, end_reason = 'customer_reroll' where id = v.current_assignment_id;
  update public.orders set status = 'queued', queued_at = v_now, accepted_at = null, assigned_teammate_id = null, current_assignment_id = null, rerolls = rerolls + 1 where id = v.id returning * into v;
  return pg_catalog.jsonb_build_object('order', public.order_customer_dto(v));
end;
$$;
create function public.sweep_expired_orders(p_limit integer default 100) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if p_limit is null or p_limit not between 1 and 500 then return public.order_error(400, 'Sweep limit must be 1..500.'); end if;
  return pg_catalog.jsonb_build_object('expired_count', public.order_sweep(p_limit));
end;
$$;

revoke all on function public.order_error(integer,text), public.order_customer_dto(public.orders), public.order_teammate_dto(public.orders), public.order_eligible(public.orders,uuid), public.order_post_refund(), public.order_expire_locked(uuid), public.order_sweep(integer) from public, anon, authenticated, service_role;
revoke all on function public.customer_active_order(), public.customer_order(uuid), public.customer_order_history(integer,integer), public.customer_refund_credits(integer,integer), public.teammate_order_queue(), public.teammate_current_assignment(), public.accept_order(uuid), public.cancel_queued_order(uuid), public.reroll_order(uuid), public.sweep_expired_orders(integer) from public, anon, authenticated, service_role;
grant execute on function public.customer_active_order(), public.customer_order(uuid), public.customer_order_history(integer,integer), public.customer_refund_credits(integer,integer), public.teammate_order_queue(), public.teammate_current_assignment(), public.accept_order(uuid), public.cancel_queued_order(uuid), public.reroll_order(uuid) to authenticated;
grant execute on function public.sweep_expired_orders(integer) to service_role;
commit;
