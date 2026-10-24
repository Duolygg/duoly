-- Creator referral attribution (ledger #28) for the admin Creators and Settings screens (#24).
-- Rules from the original lib/creators.js (duoly-admin/duoly@7f0299f): a creator has a code,
-- a referred viewer's orders earn the creator a commission for 12 months, the commission tier
-- (Rising 8%, Partner 10% from 25 orders a month, Elite 12% from 100) follows the orders the code
-- brings in each month, and payouts are monthly from €50. The original never tracked codes at
-- checkout ("creator codes aren't tracked at checkout yet"); this adds that tracking.
--
-- What this records: which creator a customer came from (once, first paid order, never
-- overwritten) and which of that customer's orders count for the creator. The commission owed is
-- computed when an admin reads it. Nothing here moves money, discounts a price or pays a creator.
--
-- No existing function is replaced. create_paid_order() is untouched: the attribution runs in an
-- after-update trigger on checkout_intents and can never fail a paid order.
begin;

create table public.creators (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9]{3,20}$'),
  name text not null check (pg_catalog.char_length(name) between 2 and 60),
  channel text not null default '' check (pg_catalog.char_length(channel) <= 160),
  active boolean not null default true,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  created_by text not null default '' check (pg_catalog.char_length(created_by) <= 120),
  updated_at timestamptz not null default pg_catalog.clock_timestamp()
);
alter table public.creators enable row level security;
revoke all on table public.creators from public, anon, authenticated, service_role;
grant select on table public.creators to service_role;

-- The code from the visitor's referral cookie, set by the server when it creates the checkout.
-- creator_id is resolved here from active creators only; whatever the caller passes is ignored.
alter table public.checkout_intents
  add column ref_code text check (ref_code is null or ref_code ~ '^[A-Z0-9]{3,20}$'),
  add column creator_id uuid references public.creators(id) on delete restrict;

create function public.checkout_intent_resolve_creator() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if new.ref_code is distinct from old.ref_code or new.creator_id is distinct from old.creator_id then
      raise exception 'Referral on a checkout cannot change.' using errcode = '55000';
    end if;
    return new;
  end if;
  new.creator_id := null;
  if new.ref_code is not null then
    select c.id into new.creator_id from public.creators as c where c.code = new.ref_code and c.active;
  end if;
  return new;
end;
$$;
revoke all on function public.checkout_intent_resolve_creator() from public, anon, authenticated, service_role;
create trigger checkout_intents_resolve_creator
  before insert or update of ref_code, creator_id on public.checkout_intents
  for each row execute function public.checkout_intent_resolve_creator();

-- One row per referred customer: the creator they came from, fixed at their first paid order.
create table public.customer_referrals (
  customer_id uuid primary key references public.profiles(id) on delete restrict,
  creator_id uuid not null references public.creators(id) on delete restrict,
  code text not null check (code ~ '^[A-Z0-9]{3,20}$'),
  first_order_id uuid not null unique references public.orders(id) on delete restrict,
  attributed_at timestamptz not null default pg_catalog.clock_timestamp()
);
create index customer_referrals_creator on public.customer_referrals(creator_id, attributed_at desc);

-- One row per order that counts for a creator (placed within 12 months of the attribution).
-- amount_eur_cents is the order amount when it was paid; refunds are subtracted at read time.
create table public.order_referrals (
  order_id uuid primary key references public.orders(id) on delete restrict,
  creator_id uuid not null references public.creators(id) on delete restrict,
  customer_id uuid not null references public.customer_referrals(customer_id) on delete restrict,
  amount_eur_cents integer not null check (amount_eur_cents > 0),
  attributed_at timestamptz not null default pg_catalog.clock_timestamp()
);
create index order_referrals_creator on public.order_referrals(creator_id, attributed_at desc);

alter table public.customer_referrals enable row level security;
alter table public.order_referrals enable row level security;
revoke all on table public.customer_referrals, public.order_referrals from public, anon, authenticated, service_role;
grant select on table public.customer_referrals, public.order_referrals to service_role;

-- Attribution is permanent: nobody, admins included, can rewrite or remove it.
create function public.referral_immutable() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  raise exception 'Referral attribution is permanent.' using errcode = '55000';
end;
$$;
revoke all on function public.referral_immutable() from public, anon, authenticated, service_role;
create trigger customer_referrals_immutable before update or delete on public.customer_referrals
  for each row execute function public.referral_immutable();
create trigger order_referrals_immutable before update or delete on public.order_referrals
  for each row execute function public.referral_immutable();

-- When a checkout becomes a paid order: attribute a new customer to the checkout's creator, then
-- count the order for the customer's creator while the 12 months last. A customer who already
-- has a creator keeps it, whatever code the new checkout carried. A customer with earlier orders
-- is not a referred viewer and is never attributed later.
create function public.checkout_intent_attribute() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_ref public.customer_referrals; v_order public.orders;
begin
  if new.status <> 'paid' or old.status = 'paid' or new.order_id is null then return null; end if;
  begin
    select o.* into v_order from public.orders as o where o.id = new.order_id;
    select r.* into v_ref from public.customer_referrals as r where r.customer_id = new.customer_id;
    if v_ref.customer_id is null and new.creator_id is not null
       and not exists (select 1 from public.orders as o where o.customer_id = new.customer_id and o.id <> new.order_id) then
      insert into public.customer_referrals(customer_id, creator_id, code, first_order_id)
        values (new.customer_id, new.creator_id, new.ref_code, new.order_id)
        on conflict (customer_id) do nothing;
      select r.* into v_ref from public.customer_referrals as r where r.customer_id = new.customer_id;
    end if;
    if v_ref.customer_id is not null and v_order.created_at < v_ref.attributed_at + interval '12 months' then
      insert into public.order_referrals(order_id, creator_id, customer_id, amount_eur_cents)
        values (new.order_id, v_ref.creator_id, new.customer_id, v_order.amount_eur_cents)
        on conflict (order_id) do nothing;
    end if;
  exception when others then
    -- A referral problem must never undo a paid order.
    raise warning 'creator attribution skipped for order %: %', new.order_id, sqlerrm;
  end;
  return null;
end;
$$;
revoke all on function public.checkout_intent_attribute() from public, anon, authenticated, service_role;
create trigger checkout_intents_attribute after update of status on public.checkout_intents
  for each row execute function public.checkout_intent_attribute();

-- ---- admin screen ----------------------------------------------------------------------------

-- Commission tier for a month's count of counted orders (original CREATOR.tiers, tierFor).
create function public.creator_tier(p_orders integer) returns jsonb
language sql immutable security invoker set search_path = '' as $$
  select case
    when p_orders >= 100 then pg_catalog.jsonb_build_object('id', 'elite', 'name', 'Elite', 'commission', 12)
    when p_orders >= 25 then pg_catalog.jsonb_build_object('id', 'partner', 'name', 'Partner', 'commission', 10)
    else pg_catalog.jsonb_build_object('id', 'rising', 'name', 'Rising', 'commission', 8) end;
$$;
revoke all on function public.creator_tier(integer) from public, anon, authenticated, service_role;

-- One creator as the admin screen shows it. An order counts once it is completed and its payment
-- was not refunded or released; refund credits on it are subtracted. Months are calendar months
-- in UTC by completion time; the month's tier applies to every counted order of that month.
create function public.admin_creator_dto(p_creator public.creators) returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare v_months jsonb; v_owed bigint; v_customers integer; v_orders integer; v_pending integer;
begin
  with counted as (
    select pg_catalog.to_char(pg_catalog.date_trunc('month', o.completed_at at time zone 'UTC'), 'YYYY-MM') as month,
           greatest(0, r.amount_eur_cents - coalesce((select pg_catalog.sum(c.amount_eur_cents) from public.refund_credits as c where c.order_id = o.id), 0))::bigint as base
      from public.order_referrals as r
      join public.orders as o on o.id = r.order_id
      left join public.order_payments as p on p.order_id = o.id
     where r.creator_id = p_creator.id and o.status = 'completed'
       and coalesce(p.state, '') not in ('refunded', 'voided')
  ), months as (
    select m.month, m.n, m.base, public.creator_tier(m.n) as tier
      from (select month, count(*)::integer as n, pg_catalog.sum(base)::bigint as base from counted group by month) as m
  )
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'month', x.month, 'orders', x.n, 'baseCents', x.base, 'tier', x.tier->>'id',
           'commission', (x.tier->>'commission')::integer,
           'commissionCents', (x.base * (x.tier->>'commission')::integer + 50) / 100) order by x.month desc), '[]'::jsonb),
         coalesce(pg_catalog.sum((x.base * (x.tier->>'commission')::integer + 50) / 100), 0)::bigint
    into v_months, v_owed from months as x;
  select count(*) into v_customers from public.customer_referrals where creator_id = p_creator.id;
  select count(*) into v_orders from public.order_referrals where creator_id = p_creator.id;
  select count(*) into v_pending from public.order_referrals as r join public.orders as o on o.id = r.order_id
   where r.creator_id = p_creator.id and o.status in ('queued', 'in_progress');
  return pg_catalog.jsonb_build_object(
    'id', p_creator.id, 'code', p_creator.code, 'name', p_creator.name, 'channel', p_creator.channel,
    'active', p_creator.active, 'createdAt', p_creator.created_at, 'createdBy', p_creator.created_by,
    'customers', v_customers, 'orders', v_orders, 'openOrders', v_pending,
    'months', v_months, 'owedCents', v_owed);
end;
$$;
revoke all on function public.admin_creator_dto(public.creators) from public, anon, authenticated, service_role;

-- GET /api/admin/creators: every creator with what they are owed, plus the latest counted orders.
create function public.admin_creators() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.admin_caller()) then return public.order_error(403, 'Admins only.'); end if;
  return pg_catalog.jsonb_build_object(
    'now', pg_catalog.clock_timestamp(),
    'rules', pg_catalog.jsonb_build_object('months', 12, 'payoutMinCents', 5000,
      'tiers', pg_catalog.jsonb_build_array(
        pg_catalog.jsonb_build_object('id', 'rising', 'name', 'Rising', 'from', 0, 'commission', 8),
        pg_catalog.jsonb_build_object('id', 'partner', 'name', 'Partner', 'from', 25, 'commission', 10),
        pg_catalog.jsonb_build_object('id', 'elite', 'name', 'Elite', 'from', 100, 'commission', 12))),
    'creators', coalesce((select pg_catalog.jsonb_agg(public.admin_creator_dto(c) order by c.created_at desc)
      from public.creators as c), '[]'::jsonb),
    'orders', coalesce((select pg_catalog.jsonb_agg(x.o order by x.at desc) from (
      select r.attributed_at as at, pg_catalog.jsonb_build_object(
          'id', o.public_reference, 'code', c.code, 'customer', o.customer_name, 'game', o.game,
          'title', o.title, 'status', o.status, 'amountCents', r.amount_eur_cents,
          'refundCents', coalesce((select pg_catalog.sum(rc.amount_eur_cents) from public.refund_credits as rc where rc.order_id = o.id), 0),
          'payment', coalesce(p.state, ''), 'at', r.attributed_at, 'completedAt', o.completed_at) as o
        from public.order_referrals as r
        join public.orders as o on o.id = r.order_id
        join public.creators as c on c.id = r.creator_id
        left join public.order_payments as p on p.order_id = o.id
       order by r.attributed_at desc limit 200) as x), '[]'::jsonb));
end;
$$;

create function public.admin_create_creator(p_code text, p_name text, p_channel text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid; v_name text; v_code text; v_label text; v_channel text; v_row public.creators;
begin
  select id, name into v_actor, v_name from public.admin_caller();
  if v_actor is null then return public.order_error(403, 'Admins only.'); end if;
  v_code := pg_catalog.upper(pg_catalog.btrim(coalesce(p_code, '')));
  v_label := pg_catalog.btrim(pg_catalog.regexp_replace(coalesce(p_name, ''), '[[:cntrl:]]', ' ', 'g'));
  v_channel := pg_catalog.btrim(pg_catalog.regexp_replace(coalesce(p_channel, ''), '[[:cntrl:]]', ' ', 'g'));
  if v_code !~ '^[A-Z0-9]{3,20}$' then
    return public.order_error(400, 'Codes are 3 to 20 letters or numbers.');
  end if;
  if pg_catalog.char_length(v_label) not between 2 and 60 then
    return public.order_error(400, 'Add the creator''s name.');
  end if;
  if pg_catalog.char_length(v_channel) > 160 then
    return public.order_error(400, 'That channel link is too long.');
  end if;
  insert into public.creators(code, name, channel, created_by) values (v_code, v_label, v_channel, v_name)
    on conflict (code) do nothing returning * into v_row;
  if v_row.id is null then return public.order_error(409, 'That code is taken.'); end if;
  perform public.admin_log(v_actor, v_name, 'Added creator', v_label, v_code);
  return pg_catalog.jsonb_build_object('creator', public.admin_creator_dto(v_row));
end;
$$;

-- Pausing stops new customers being attributed to the code. Customers already attributed stay
-- with the creator and their orders keep counting for the 12 months.
create function public.admin_set_creator_active(p_id uuid, p_active boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid; v_name text; v_row public.creators;
begin
  select id, name into v_actor, v_name from public.admin_caller();
  if v_actor is null then return public.order_error(403, 'Admins only.'); end if;
  if p_active is null then return public.order_error(400, 'Pick active or paused.'); end if;
  select c.* into v_row from public.creators as c where c.id = p_id for update;
  if v_row.id is null then return public.order_error(404, 'Creator not found.'); end if;
  if v_row.active is distinct from p_active then
    update public.creators set active = p_active, updated_at = pg_catalog.clock_timestamp()
     where id = p_id returning * into v_row;
    perform public.admin_log(v_actor, v_name, case when p_active then 'Reactivated creator' else 'Paused creator' end,
      v_row.name, v_row.code);
  end if;
  return pg_catalog.jsonb_build_object('creator', public.admin_creator_dto(v_row));
end;
$$;

revoke all on function public.admin_creators(), public.admin_create_creator(text,text,text),
  public.admin_set_creator_active(uuid,boolean) from public, anon, authenticated, service_role;
grant execute on function public.admin_creators(), public.admin_create_creator(text,text,text),
  public.admin_set_creator_active(uuid,boolean) to authenticated;

commit;
