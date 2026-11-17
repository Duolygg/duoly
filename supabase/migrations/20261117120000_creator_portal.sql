-- Creator portal (25-creator-portal-spec.md): a creator applies on /creators, an admin approves in
-- Admin Creators, and from then on the creator sees everything themselves on /creators/dashboard.
--
-- What this adds: the link between a Duoly account and a creator record, the application queue, an
-- aggregate link click counter with no personal data, creator payout details, and the read model
-- the dashboard uses. Nothing here moves money: commission is still calculated at read time and
-- paid by hand through creator_payouts (20261025250000).
--
-- Additive, with one documented exception. public.checkout_intent_attribute() from
-- 20261025110000_creator_referrals.sql is replaced to add the self-referral guard the spec asks
-- for: an order whose customer is the creator's own account never attributes and never counts.
-- The body is otherwise the latest definition, and existing attribution rows are never rewritten
-- (they stay immutable).
--
-- Reconciliation: every euro on the dashboard comes from the same rules as the admin screen. The
-- month tier is public.creator_tier(), and the month commission is the same expression
-- admin_creator_dto() and creator_month_commission() use, so admin and creator always agree.
-- supabase/tests/creator_portal.sql proves that equality.
--
-- Earned against estimated: everything that reconciles with the admin screen counts completed
-- orders only. An order still being played has earned nothing, so it is reported separately as an
-- estimate at this month's tier (openCents, estimatedCents) and never added to earned. The spec's
-- "pending" is the two together, because a creator wants one number for money not paid yet.
begin;

-- ---- the account behind a creator ------------------------------------------------------------

-- Nullable on purpose: creators an admin added by hand before this migration have no account and
-- keep working exactly as they did. One account can hold at most one creator code.
alter table public.creators
  add column user_id uuid unique references public.profiles(id) on delete restrict;

-- ---- applications ----------------------------------------------------------------------------

create table public.creator_applications (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  requested_code text not null check (requested_code ~ '^[A-Z0-9]{3,20}$'),
  name text not null check (pg_catalog.char_length(name) between 2 and 60),
  email text not null check (pg_catalog.char_length(email) between 5 and 120),
  platform text not null check (platform in ('Twitch','YouTube','TikTok','Kick','Instagram','Other')),
  channel text not null check (pg_catalog.char_length(channel) between 3 and 160),
  audience text not null check (audience in ('Under 1K','1K to 10K','10K to 100K','100K+')),
  game text not null check (game ~ '^[a-z0-9]{2,16}$'),
  country text not null check (pg_catalog.char_length(country) between 2 and 56),
  message text not null default '' check (pg_catalog.char_length(message) <= 1200),
  adult boolean not null check (adult),
  terms_version text not null check (terms_version ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  terms_accepted_at timestamptz not null default pg_catalog.clock_timestamp(),
  status text not null default 'applied' check (status in ('applied','approved','rejected')),
  reason text not null default '' check (pg_catalog.char_length(reason) <= 300),
  creator_id uuid references public.creators(id) on delete restrict,
  decided_by uuid references public.profiles(id) on delete restrict,
  decided_at timestamptz,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  check ((status = 'applied') = (decided_at is null and decided_by is null)),
  check ((status = 'approved') = (creator_id is not null)),
  check (status <> 'rejected' or pg_catalog.char_length(reason) between 1 and 300)
);
-- One open application per account; decided ones stay for the history and the reapply cooldown.
create unique index creator_applications_open on public.creator_applications(user_id) where status = 'applied';
-- One open application per requested code: two accounts that ask for the same code at the same
-- moment cannot both reserve it, whatever the availability check saw.
create unique index creator_applications_code_open on public.creator_applications(requested_code) where status = 'applied';
create index creator_applications_queue on public.creator_applications(status, created_at desc);
alter table public.creator_applications enable row level security;
revoke all on table public.creator_applications from public, anon, authenticated, service_role;

-- ---- aggregate link clicks -------------------------------------------------------------------

-- A counter per code and day. No IP, no cookie, no user id, nothing that identifies a visitor, so
-- it is counted whatever the visitor chose in the cookie banner.
create table public.creator_link_clicks (
  creator_id uuid not null references public.creators(id) on delete restrict,
  day date not null,
  clicks bigint not null default 0 check (clicks >= 0),
  primary key (creator_id, day)
);
alter table public.creator_link_clicks enable row level security;
revoke all on table public.creator_link_clicks from public, anon, authenticated, service_role;

-- ---- payout details ----------------------------------------------------------------------------

-- Mirrors teammate_payout_details (20261025250000) with what a creator invoice needs instead of a
-- date of birth: business or private, an optional VAT ID and the self billing agreement
-- (Gutschrift). The application already carries the 18 or older confirmation.
create table public.creator_payout_details (
  creator_id uuid primary key references public.creators(id) on delete restrict,
  legal_name text not null check (legal_name = pg_catalog.btrim(legal_name) and pg_catalog.char_length(legal_name) between 2 and 120),
  address text not null check (address = pg_catalog.btrim(address) and pg_catalog.char_length(address) between 5 and 300),
  country text not null check (country = pg_catalog.btrim(country) and pg_catalog.char_length(country) between 2 and 56),
  payout_method text not null check (payout_method in ('bank','wise','paypal','payoneer')),
  payout_account text not null check (payout_account = pg_catalog.btrim(payout_account) and pg_catalog.char_length(payout_account) between 3 and 200),
  business boolean not null default false,
  vat_id text not null default '' check (vat_id = pg_catalog.btrim(vat_id) and pg_catalog.char_length(vat_id) <= 20),
  self_billing boolean not null check (self_billing),
  self_billing_at timestamptz not null default pg_catalog.clock_timestamp(),
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp()
);
alter table public.creator_payout_details enable row level security;
revoke all on table public.creator_payout_details from public, anon, authenticated, service_role;
grant select on table public.creator_payout_details to authenticated;

-- The row owner check for the policy below. A policy expression runs with the caller's own
-- privileges, and nobody but the service role may read public.creators, so the lookup lives in a
-- security definer function (the same shape as payout_viewer_is_admin for teammates).
create function public.creator_viewer_owns(p_creator uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.creators as c
                  where c.id = p_creator and c.user_id = (select auth.uid()));
$$;
revoke all on function public.creator_viewer_owns(uuid) from public, anon, authenticated, service_role;
grant execute on function public.creator_viewer_owns(uuid) to authenticated;

create policy creator_payout_details_read on public.creator_payout_details for select to authenticated
  using (public.creator_viewer_owns(creator_id) or (select public.payout_viewer_is_admin()));

-- ---- codes -------------------------------------------------------------------------------------

-- Paths the site itself answers can never be a short link (duoly.gg/CODE only redirects on a 404),
-- so a code that matches one would be a dead link. src/contracts/creator-portal.ts holds the same
-- list and tests/unit/creator-portal-migration.test.ts keeps the two in step.
create function public.creator_reserved_code(p_code text) returns boolean
language sql immutable security invoker set search_path = '' as $$
  select pg_catalog.lower(p_code) = any (array[
    'admin','ai','api','apply','auth','blog','checkout','claim','coaching','compare','contact',
    'creators','dashboard','dev','developers','games','how','imprint','index','login','mcp',
    'press','pricing','privacy','pro','profile','queue','reports','reset','robots','rules',
    'sitemap','teammate','teammates','terms','trust']);
$$;
revoke all on function public.creator_reserved_code(text) from public, anon, authenticated, service_role;

-- One spelling of a code, used by the availability check, the application and the lock key both
-- sides take before they reserve it.
create function public.creator_code_normal(p_code text) returns text
language sql immutable security invoker set search_path = '' as $$
  select pg_catalog.upper(pg_catalog.btrim(coalesce(p_code, '')));
$$;
revoke all on function public.creator_code_normal(text) from public, anon, authenticated, service_role;

create function public.creator_code_state(p_code text, p_exclude_application uuid default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_code text := public.creator_code_normal(p_code);
begin
  if v_code !~ '^[A-Z0-9]{3,20}$' then
    return pg_catalog.jsonb_build_object('code', '', 'available', false,
      'reason', 'Codes are 3 to 20 letters or numbers.');
  end if;
  if public.creator_reserved_code(v_code) then
    return pg_catalog.jsonb_build_object('code', v_code, 'available', false,
      'reason', 'That word belongs to a Duoly page. Pick another code.');
  end if;
  if exists (select 1 from public.creators as c where c.code = v_code)
     or exists (select 1 from public.creator_applications as a
                 where a.requested_code = v_code and a.status = 'applied'
                   and a.id is distinct from p_exclude_application) then
    return pg_catalog.jsonb_build_object('code', v_code, 'available', false,
      'reason', 'That code is taken. Try another one.');
  end if;
  return pg_catalog.jsonb_build_object('code', v_code, 'available', true, 'reason', '');
end $$;
revoke all on function public.creator_code_state(text,uuid) from public, anon, authenticated, service_role;

-- The live check next to the code field. Signed in only, so the code list is not an open directory.
create function public.creator_code_available(p_code text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then return public.order_error(401, 'Authentication required.'); end if;
  return public.creator_code_state(p_code);
end $$;

-- ---- self-referral guard -----------------------------------------------------------------------

-- Replaces the latest definition, from 20261106190000_team_orders.sql (free coaching skipped,
-- team amount, team first-order rule all kept). Only change: an order whose customer is the
-- creator's own account is never attributed and never counted, in both directions (the creator's
-- own first order, and later orders of a customer who became a creator).
create or replace function public.checkout_intent_attribute() returns trigger
language plpgsql security definer set search_path = '' as $$
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
                    where c.id = new.creator_id and c.code = new.ref_code and c.active
                      and (c.user_id is null or c.user_id <> new.customer_id))
       and not exists (select 1 from public.orders as o where o.customer_id = new.customer_id and o.id <> new.order_id
                         and o.team_id is distinct from v_order.team_id) then
      insert into public.customer_referrals(customer_id, creator_id, code, first_order_id)
        values (new.customer_id, new.creator_id, new.ref_code, new.order_id)
        on conflict (customer_id) do nothing;
      select r.* into v_ref from public.customer_referrals as r where r.customer_id = new.customer_id;
    end if;
    if v_ref.customer_id is not null and v_order.created_at < v_ref.attributed_at + interval '12 months'
       and not exists (select 1 from public.creators as c
                        where c.id = v_ref.creator_id and c.user_id = new.customer_id) then
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
$$;
revoke all on function public.checkout_intent_attribute() from public, anon, authenticated, service_role;

-- ---- link clicks ---------------------------------------------------------------------------------

-- Counts one landing on an active creator link. Called by the server with the service role, after
-- the response, so a visitor never waits for it and a failure never reaches the page.
create function public.creator_link_click(p_code text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_code text := public.creator_code_normal(p_code); v_id uuid;
begin
  if v_code !~ '^[A-Z0-9]{3,20}$' then return false; end if;
  select c.id into v_id from public.creators as c where c.code = v_code and c.active;
  if v_id is null then return false; end if;
  insert into public.creator_link_clicks(creator_id, day, clicks)
    values (v_id, (pg_catalog.clock_timestamp() at time zone 'UTC')::date, 1)
  on conflict (creator_id, day) do update set clicks = public.creator_link_clicks.clicks + 1;
  return true;
end $$;
revoke all on function public.creator_link_click(text) from public, anon, authenticated, service_role;
grant execute on function public.creator_link_click(text) to service_role;

-- ---- the creator read model ------------------------------------------------------------------

-- Every attributed order of one creator with what the dashboard needs to say about it. One row per
-- order, the same completed/refunded/voided rule as admin_creator_dto, plus the 30 day hold and the
-- block rule from payout_order_blocked (open report or Stripe dispute).
--
-- amount:   what the customer paid, always, so the orders table never shows a zero next to a real
--           order. refunds is what went back on it.
-- base:     what commission is calculated on once the order counts (amount minus refund credits).
-- estimate: the same figure for an order still being played, which has earned nothing yet.
-- rate:     the month's tier percentage, from the month's count of counted orders. An order with no
--           commission month yet carries this month's tier, as an estimate.
-- lost:     the base that will never earn commission (a refunded or voided order, or the refunded
--           part), whether or not the order ever reached completed.
create function public.creator_portal_orders(p_creator uuid, p_now timestamptz)
returns table (
  order_id uuid, month date, attributed_at timestamptz, completed_at timestamptz, game text,
  title text, status text, amount bigint, refunds bigint, base bigint, estimate bigint, lost bigint,
  rate integer, counts boolean, is_open boolean, ready boolean, paid boolean)
language sql stable security definer set search_path = '' as $$
  with attributed as (
    select r.order_id, r.attributed_at, o.id as oid, o.completed_at, o.game, o.title, o.status,
           r.amount_eur_cents::bigint as amount,
           coalesce(p.state, '') as pay_state,
           coalesce((select pg_catalog.sum(c.amount_eur_cents) from public.refund_credits as c
                      where c.order_id = o.id), 0)::bigint as refunds,
           pg_catalog.date_trunc('month', o.completed_at at time zone 'UTC')::date as month
      from public.order_referrals as r
      join public.orders as o on o.id = r.order_id
      left join public.order_payments as p on p.order_id = o.id
     where r.creator_id = p_creator
  ), classified as (
    select a.*,
           (a.status = 'completed' and a.pay_state not in ('refunded', 'voided')) as counts,
           (a.status in ('queued', 'in_progress') and a.pay_state not in ('refunded', 'voided')) as is_open,
           -- Money that went back to the customer is a reversal whatever the order still says, so
           -- an order refunded or voided before it completed never sits in pending either.
           case when a.pay_state in ('refunded', 'voided') then a.amount
                when a.status <> 'completed' then 0::bigint
                else least(a.amount, a.refunds) end as lost
      from attributed as a
  ), rates as (
    select c.month, (public.creator_tier(pg_catalog.count(*)::integer)->>'commission')::integer as rate
      from classified as c where c.counts and c.month is not null group by c.month
  ), estimated_rate as (
    -- The tier an order that has no commission month yet would earn at today: this month's counted
    -- orders. Always exactly one row, 8% when the month is still empty.
    select (public.creator_tier(pg_catalog.count(*) filter (where c.counts
              and c.month = pg_catalog.date_trunc('month', p_now at time zone 'UTC')::date)::integer
            )->>'commission')::integer as rate
      from classified as c
  )
  select c.order_id, c.month, c.attributed_at, c.completed_at, c.game, c.title, c.status,
         c.amount, c.refunds,
         case when c.counts then greatest(0, c.amount - c.refunds) else 0::bigint end,
         case when c.is_open then greatest(0, c.amount - c.refunds) else 0::bigint end,
         c.lost,
         case when c.month is null then e.rate
              else coalesce(t.rate, (public.creator_tier(0)->>'commission')::integer) end,
         c.counts, c.is_open,
         (c.counts and c.completed_at <= p_now - interval '30 days'
            and not public.payout_order_blocked(c.oid)),
         exists (select 1 from public.creator_payouts as cp
                  where cp.creator_id = p_creator and cp.month = c.month)
    from classified as c
         left join rates as t on t.month = c.month
         cross join estimated_rate as e;
$$;
revoke all on function public.creator_portal_orders(uuid, timestamptz) from public, anon, authenticated, service_role;

-- Money, by commission month, exactly as the admin screen counts it:
--   earned    = the month total admin_creator_dto() shows. Completed orders only, so earned and
--               the admin screen's owed can never drift, whatever an open order looks like.
--   paid      = what creator_payouts recorded for that month,
--   available = the part past the 30 day hold and not blocked, in months not paid yet,
--   held      = the rest of an unpaid month (inside the hold, or blocked),
--   open      = an estimate, not earned: orders still being played, at this month's tier,
--   pending   = held plus open, which is what the spec calls pending ("orders not completed yet or
--               inside the 30 day hold"). Only held is ever paid out as it stands.
--   reversed  = commission lost to refunds, voids and chargebacks, including orders whose money
--               went back before they ever completed and so never had a commission month.
create function public.creator_portal_money(p_creator uuid, p_now timestamptz) returns jsonb
language sql stable security definer set search_path = '' as $$
  with o as (select * from public.creator_portal_orders(p_creator, p_now)),
  months as (
    select x.month, pg_catalog.max(x.rate) as rate,
           coalesce(pg_catalog.sum(x.base), 0)::bigint as base,
           coalesce(pg_catalog.sum(x.base) filter (where x.ready), 0)::bigint as ready_base,
           coalesce(pg_catalog.sum(x.lost), 0)::bigint as lost_base,
           pg_catalog.count(*) filter (where x.counts)::integer as orders,
           pg_catalog.bool_or(x.paid) as paid
      from o as x where x.month is not null group by x.month
  ), figures as (
    select m.*,
      (m.base * m.rate + 50) / 100 as earned,
      (m.ready_base * m.rate + 50) / 100 as available,
      (m.lost_base * m.rate + 50) / 100 as reversed
      from months as m
  ), loose as (
    -- Orders with no commission month: still being played, or sent back before they completed.
    -- One row always, because every aggregate here is over the whole set.
    select coalesce(pg_catalog.sum(x.estimate), 0)::bigint as open_base,
           coalesce(pg_catalog.sum(x.lost), 0)::bigint as lost_base,
           pg_catalog.count(*) filter (where x.is_open)::integer as open_orders,
           coalesce(pg_catalog.max(x.rate), (public.creator_tier(0)->>'commission')::integer) as rate
      from o as x where x.month is null
  ), loose_figures as (
    select l.open_orders,
           (l.open_base * l.rate + 50) / 100 as open_cents,
           (l.lost_base * l.rate + 50) / 100 as reversed_cents
      from loose as l
  ), held as (
    select coalesce(pg_catalog.sum(f.earned - f.available), 0)::bigint as cents
      from figures as f where not f.paid
  )
  select pg_catalog.jsonb_build_object(
    'pendingCents', (select h.cents from held as h) + (select lf.open_cents from loose_figures as lf),
    'heldCents', (select h.cents from held as h),
    'openCents', (select lf.open_cents from loose_figures as lf),
    'openOrders', (select lf.open_orders from loose_figures as lf),
    'availableCents', coalesce((select pg_catalog.sum(f.available) from figures as f where not f.paid), 0),
    'paidCents', coalesce((select pg_catalog.sum(cp.amount_eur_cents) from public.creator_payouts as cp
                            where cp.creator_id = p_creator), 0),
    'reversedCents', coalesce((select pg_catalog.sum(f.reversed) from figures as f), 0)
                     + (select lf.reversed_cents from loose_figures as lf),
    'earnedCents', coalesce((select pg_catalog.sum(f.earned) from figures as f), 0),
    'thresholdCents', 5000,
    'months', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'month', pg_catalog.to_char(f.month, 'YYYY-MM'), 'orders', f.orders, 'baseCents', f.base,
        'commission', f.rate, 'commissionCents', f.earned, 'availableCents', f.available,
        'paid', f.paid) order by f.month desc) from figures as f), '[]'::jsonb));
$$;
revoke all on function public.creator_portal_money(uuid, timestamptz) from public, anon, authenticated, service_role;

-- Clicks, referred customers, orders, revenue and commission over one range. Commission is summed
-- per month with that month's tier, so the all time figure is the same number the admin screen owes.
create function public.creator_portal_stats(p_creator uuid, p_now timestamptz, p_days integer) returns jsonb
language sql stable security definer set search_path = '' as $$
  with rng as (select case when p_days is null then null else p_now - (p_days || ' days')::interval end as from_at),
  o as (select * from public.creator_portal_orders(p_creator, p_now)),
  ranged as (
    select x.month, pg_catalog.max(x.rate) as rate, coalesce(pg_catalog.sum(x.base), 0)::bigint as base
      from o as x, rng as w
     where x.counts and (w.from_at is null or x.completed_at >= w.from_at)
     group by x.month
  )
  select pg_catalog.jsonb_build_object(
    'clicks', coalesce((select pg_catalog.sum(l.clicks) from public.creator_link_clicks as l, rng as w
                         where l.creator_id = p_creator
                           and (w.from_at is null or l.day >= (w.from_at at time zone 'UTC')::date)), 0),
    'customers', (select pg_catalog.count(*) from public.customer_referrals as c, rng as w
                   where c.creator_id = p_creator and (w.from_at is null or c.attributed_at >= w.from_at)),
    'orders', (select pg_catalog.count(*) from o as x, rng as w
                where w.from_at is null or x.attributed_at >= w.from_at),
    'revenueCents', coalesce((select pg_catalog.sum(r.base) from ranged as r), 0),
    'commissionCents', coalesce((select pg_catalog.sum((r.base * r.rate + 50) / 100) from ranged as r), 0));
$$;
revoke all on function public.creator_portal_stats(uuid, timestamptz, integer) from public, anon, authenticated, service_role;

create function public.creator_rules_dto() returns jsonb
language sql immutable security invoker set search_path = '' as $$
  select pg_catalog.jsonb_build_object('months', 12, 'payoutMinCents', 5000, 'holdDays', 30,
    'viewerDiscount', 10,
    'tiers', pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object('id', 'rising', 'name', 'Rising', 'from', 0, 'commission', 8),
      pg_catalog.jsonb_build_object('id', 'partner', 'name', 'Partner', 'from', 25, 'commission', 10),
      pg_catalog.jsonb_build_object('id', 'elite', 'name', 'Elite', 'from', 100, 'commission', 12)));
$$;
revoke all on function public.creator_rules_dto() from public, anon, authenticated, service_role;

-- One application as the creator and the admin queue see it. No customer data of any kind.
create function public.creator_application_dto(p_row public.creator_applications) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select case when p_row.id is null then null else pg_catalog.jsonb_build_object(
    'id', p_row.id, 'code', p_row.requested_code, 'name', p_row.name, 'email', p_row.email,
    'platform', p_row.platform, 'channel', p_row.channel, 'audience', p_row.audience,
    'game', p_row.game, 'country', p_row.country, 'message', p_row.message,
    'termsVersion', p_row.terms_version, 'termsAcceptedAt', public.payout_ms(p_row.terms_accepted_at),
    'status', p_row.status, 'reason', p_row.reason,
    'createdAt', public.payout_ms(p_row.created_at),
    'decidedAt', case when p_row.decided_at is null then null else public.payout_ms(p_row.decided_at) end)
  end;
$$;
revoke all on function public.creator_application_dto(public.creator_applications) from public, anon, authenticated, service_role;

create function public.creator_payout_details_dto(p_creator uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select (select pg_catalog.jsonb_build_object(
      'legalName', d.legal_name, 'address', d.address, 'country', d.country,
      'method', d.payout_method, 'account', d.payout_account, 'business', d.business,
      'vatId', d.vat_id, 'selfBilling', d.self_billing,
      'updatedAt', public.payout_ms(d.updated_at))
    from public.creator_payout_details as d where d.creator_id = p_creator);
$$;
revoke all on function public.creator_payout_details_dto(uuid) from public, anon, authenticated, service_role;

-- ---- the portal ---------------------------------------------------------------------------------

-- Everything the caller's own dashboard shows. auth.uid() only: there is no creator id argument,
-- so one creator can never read another's numbers, and no customer name, email or id is ever
-- included, not even inside the order rows.
create function public.creator_portal() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_creator public.creators;
  v_app public.creator_applications;
  v_month date := pg_catalog.date_trunc('month', v_now at time zone 'UTC')::date;
  v_month_orders integer; v_reapply timestamptz;
begin
  if v_actor is null then return public.order_error(401, 'Authentication required.'); end if;
  select c.* into v_creator from public.creators as c where c.user_id = v_actor;
  select a.* into v_app from public.creator_applications as a
   where a.user_id = v_actor order by a.created_at desc limit 1;
  if v_creator.id is null then
    v_reapply := case when v_app.status = 'rejected' then v_app.decided_at + interval '30 days' end;
    return pg_catalog.jsonb_build_object(
      'now', public.payout_ms(v_now),
      'status', coalesce(v_app.status, 'none'),
      'application', public.creator_application_dto(v_app),
      'canReapplyAt', case when v_reapply is null then null else public.payout_ms(v_reapply) end,
      'canApply', v_app.id is null or (v_app.status = 'rejected' and v_now >= v_reapply),
      'rules', public.creator_rules_dto());
  end if;
  select pg_catalog.count(*)::integer into v_month_orders
    from public.creator_portal_orders(v_creator.id, v_now) as o
   where o.counts and o.month = v_month;
  return pg_catalog.jsonb_build_object(
    'now', public.payout_ms(v_now),
    'status', 'creator',
    'application', public.creator_application_dto(v_app),
    'rules', public.creator_rules_dto(),
    'creator', pg_catalog.jsonb_build_object(
      'code', v_creator.code, 'name', v_creator.name, 'channel', v_creator.channel,
      'active', v_creator.active, 'since', public.payout_ms(v_creator.created_at)),
    'month', pg_catalog.jsonb_build_object(
      'month', pg_catalog.to_char(v_month, 'YYYY-MM'), 'orders', v_month_orders,
      'tier', public.creator_tier(v_month_orders)),
    'stats', pg_catalog.jsonb_build_object(
      '7d', public.creator_portal_stats(v_creator.id, v_now, 7),
      '30d', public.creator_portal_stats(v_creator.id, v_now, 30),
      'all', public.creator_portal_stats(v_creator.id, v_now, null)),
    'money', public.creator_portal_money(v_creator.id, v_now),
    'orders', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'at', public.payout_ms(coalesce(o.completed_at, o.attributed_at)),
        'game', o.game, 'title', o.title,
        -- What the customer paid, always: a row with no commission on it is still a real order.
        'amountCents', o.amount,
        'refundedCents', o.refunds,
        -- Earned, and separately the estimate for an order nobody has finished playing yet.
        'commissionCents', case when o.counts then (o.base * o.rate + 50) / 100 else 0 end,
        'estimatedCents', case when o.is_open then (o.estimate * o.rate + 50) / 100 else 0 end,
        'commission', o.rate,
        'state', case
          when o.lost > 0 and not o.counts then 'reversed'
          when o.status in ('queued', 'in_progress') then 'open'
          when o.status = 'cancelled' then 'cancelled'
          when o.paid then 'paid'
          when o.ready then 'available'
          else 'pending' end)
        order by coalesce(o.completed_at, o.attributed_at) desc)
      from (select * from public.creator_portal_orders(v_creator.id, v_now)
             order by coalesce(completed_at, attributed_at) desc limit 200) as o), '[]'::jsonb),
    'payouts', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'month', pg_catalog.to_char(cp.month, 'YYYY-MM'), 'amountCents', cp.amount_eur_cents,
        'method', cp.paid_method, 'reference', cp.paid_reference,
        'paidAt', public.payout_ms(cp.paid_at)) order by cp.month desc)
      from public.creator_payouts as cp where cp.creator_id = v_creator.id), '[]'::jsonb),
    'details', public.creator_payout_details_dto(v_creator.id));
end $$;

-- ---- applying -------------------------------------------------------------------------------

-- The accepted terms version is checked against the published one ('2026-11-17',
-- src/content/creator-terms.ts), so a direct RPC call cannot record an acceptance of something
-- that was never published. A new terms version therefore needs a follow-up migration that
-- replaces this function with the new version string, next to the content change.
create function public.creator_apply(
  p_code text, p_name text, p_email text, p_platform text, p_channel text, p_audience text,
  p_game text, p_country text, p_message text, p_adult boolean, p_terms text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_state jsonb; v_last public.creator_applications; v_row public.creator_applications;
  v_clean text; v_code text := public.creator_code_normal(p_code);
begin
  if v_actor is null then return public.order_error(401, 'Authentication required.'); end if;
  if exists (select 1 from public.creators as c where c.user_id = v_actor) then
    return public.order_error(409, 'Your account is already a Duoly creator.');
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('duoly.creator.apply.' || v_actor::text, 0));
  select a.* into v_last from public.creator_applications as a
   where a.user_id = v_actor order by a.created_at desc limit 1;
  if v_last.status = 'applied' then
    return public.order_error(409, 'Your application is already with us. We reply within a few days.');
  end if;
  if v_last.status = 'rejected' and v_now < v_last.decided_at + interval '30 days' then
    return public.order_error(409, 'You can apply again 30 days after a decision.');
  end if;
  if p_adult is not true then
    return public.order_error(400, 'Confirm that you are 18 or older.');
  end if;
  if coalesce(p_terms, '') <> '2026-11-17' then
    return public.order_error(400, 'Accept the creator terms to apply.');
  end if;
  -- Hold the code itself, not just this account, so two accounts cannot both read it as free and
  -- both insert. The unique index below is the second line of defence.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('duoly.creator.code.' || v_code, 0));
  v_state := public.creator_code_state(v_code);
  if not (v_state->>'available')::boolean then
    return public.order_error(409, v_state->>'reason');
  end if;
  v_clean := pg_catalog.btrim(pg_catalog.regexp_replace(coalesce(p_name, ''), '[[:cntrl:]]', ' ', 'g'));
  if pg_catalog.char_length(v_clean) not between 2 and 60 then
    return public.order_error(400, 'Add your name.');
  end if;
  begin
    insert into public.creator_applications(
      user_id, requested_code, name, email, platform, channel, audience, game, country, message,
      adult, terms_version)
    values (
      v_actor, v_state->>'code', v_clean, pg_catalog.lower(pg_catalog.btrim(coalesce(p_email, ''))),
      p_platform, pg_catalog.btrim(pg_catalog.regexp_replace(coalesce(p_channel, ''), '[[:cntrl:]]', ' ', 'g')),
      p_audience, pg_catalog.lower(pg_catalog.btrim(coalesce(p_game, ''))),
      pg_catalog.btrim(pg_catalog.regexp_replace(coalesce(p_country, ''), '[[:cntrl:]]', ' ', 'g')),
      pg_catalog.btrim(pg_catalog.regexp_replace(coalesce(p_message, ''), '[[:cntrl:]]', ' ', 'g')),
      true, p_terms)
    returning * into v_row;
  exception
    when unique_violation then
      -- Either this account already has an open application, or another account won the race for
      -- the code. Say which.
      if exists (select 1 from public.creator_applications as a
                  where a.user_id = v_actor and a.status = 'applied') then
        return public.order_error(409, 'Your application is already with us.');
      end if;
      return public.order_error(409, 'That code is taken. Try another one.');
    when check_violation then return public.order_error(400, 'Check your application and try again.');
  end;
  return pg_catalog.jsonb_build_object('application', public.creator_application_dto(v_row));
end $$;

-- ---- payout details --------------------------------------------------------------------------

create function public.creator_save_payout_details(
  p_legal_name text, p_address text, p_country text, p_method text, p_account text,
  p_business boolean, p_vat_id text, p_self_billing boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid()); v_creator public.creators;
  v_name text := pg_catalog.btrim(coalesce(p_legal_name, ''));
  v_address text := pg_catalog.btrim(coalesce(p_address, ''));
  v_country text := pg_catalog.btrim(coalesce(p_country, ''));
  v_account text := pg_catalog.btrim(coalesce(p_account, ''));
  v_vat text := pg_catalog.btrim(coalesce(p_vat_id, ''));
begin
  if v_actor is null then return public.order_error(401, 'Authentication required.'); end if;
  select c.* into v_creator from public.creators as c where c.user_id = v_actor;
  if v_creator.id is null then return public.order_error(403, 'Creator account required.'); end if;
  if pg_catalog.char_length(v_name) not between 2 and 120 then
    return public.order_error(400, 'Add your full legal name.'); end if;
  if pg_catalog.char_length(v_address) not between 5 and 300 then
    return public.order_error(400, 'Add your full address.'); end if;
  if pg_catalog.char_length(v_country) not between 2 and 56 then
    return public.order_error(400, 'Add your country.'); end if;
  if p_method is null or p_method not in ('bank', 'wise', 'paypal', 'payoneer') then
    return public.order_error(400, 'Pick how you want to be paid.'); end if;
  if pg_catalog.char_length(v_account) not between 3 and 200 then
    return public.order_error(400, 'Add the account we should pay to.'); end if;
  if pg_catalog.char_length(v_vat) > 20 then
    return public.order_error(400, 'That VAT ID is too long.'); end if;
  if p_self_billing is not true then
    return public.order_error(400, 'Agree to the monthly self billing document, or send us an invoice instead.'); end if;
  insert into public.creator_payout_details(
    creator_id, legal_name, address, country, payout_method, payout_account, business, vat_id, self_billing)
  values (v_creator.id, v_name, v_address, v_country, p_method, v_account,
          coalesce(p_business, false), v_vat, true)
  on conflict (creator_id) do update set
    legal_name = excluded.legal_name, address = excluded.address, country = excluded.country,
    payout_method = excluded.payout_method, payout_account = excluded.payout_account,
    business = excluded.business, vat_id = excluded.vat_id, self_billing = true,
    self_billing_at = pg_catalog.clock_timestamp(), updated_at = pg_catalog.clock_timestamp();
  perform public.admin_log(v_actor, v_creator.name, 'Updated creator payout details', v_creator.code,
    'Payout method: ' || p_method);
  return pg_catalog.jsonb_build_object('details', public.creator_payout_details_dto(v_creator.id));
end $$;

-- ---- the admin queue ---------------------------------------------------------------------------

create function public.admin_creator_applications() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_actor uuid;
begin
  select id into v_actor from public.admin_caller_for('creators');
  if v_actor is null then return public.order_error(403, 'Admins only.'); end if;
  return pg_catalog.jsonb_build_object(
    'now', public.payout_ms(pg_catalog.clock_timestamp()),
    'applications', coalesce((select pg_catalog.jsonb_agg(x.dto order by x.open desc, x.created_at desc)
      from (select public.creator_application_dto(a) || pg_catalog.jsonb_build_object(
                     'hasCreator', a.creator_id is not null,
                     'decidedBy', case when a.decided_by is null then ''
                                       else public.payout_person(a.decided_by) end) as dto,
                   (a.status = 'applied') as open, a.created_at
              from public.creator_applications as a
             order by (a.status = 'applied') desc, a.created_at desc limit 200) as x), '[]'::jsonb));
end $$;

create function public.admin_decide_creator_application(
  p_id uuid, p_approve boolean, p_code text, p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid; v_actor_name text; v_app public.creator_applications; v_creator public.creators;
  v_state jsonb; v_code text;
  v_reason text := pg_catalog.btrim(pg_catalog.regexp_replace(coalesce(p_reason, ''), '[[:cntrl:]]', ' ', 'g'));
begin
  select id, name into v_actor, v_actor_name from public.admin_caller_for('creators');
  if v_actor is null then return public.order_error(403, 'Admins only.'); end if;
  select a.* into v_app from public.creator_applications as a where a.id = p_id for update;
  if v_app.id is null then return public.order_error(404, 'Application not found.'); end if;
  if v_app.status <> 'applied' then
    return public.order_error(409, 'That application was already decided.');
  end if;
  if p_approve is not true then
    if pg_catalog.char_length(v_reason) not between 1 and 300 then
      return public.order_error(400, 'Add a reason. The creator sees it.');
    end if;
    update public.creator_applications
       set status = 'rejected', reason = v_reason, decided_by = v_actor,
           decided_at = pg_catalog.clock_timestamp()
     where id = p_id returning * into v_app;
    perform public.admin_log(v_actor, v_actor_name, 'Rejected creator application', v_app.name, v_reason);
    return pg_catalog.jsonb_build_object('application', public.creator_application_dto(v_app));
  end if;
  if exists (select 1 from public.creators as c where c.user_id = v_app.user_id) then
    return public.order_error(409, 'That account already has a creator code.');
  end if;
  -- The same lock creator_apply() takes, so an approval and an application can never hand the
  -- same code out twice. The application's own reservation is excluded from the check.
  v_code := public.creator_code_normal(
    coalesce(nullif(pg_catalog.btrim(coalesce(p_code, '')), ''), v_app.requested_code));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('duoly.creator.code.' || v_code, 0));
  v_state := public.creator_code_state(v_code, v_app.id);
  if not (v_state->>'available')::boolean then
    return public.order_error(409, v_state->>'reason');
  end if;
  insert into public.creators(code, name, channel, created_by, user_id)
    values (v_state->>'code', v_app.name, v_app.channel, v_actor_name, v_app.user_id)
    on conflict (code) do nothing returning * into v_creator;
  if v_creator.id is null then return public.order_error(409, 'That code is taken.'); end if;
  update public.creator_applications
     set status = 'approved', reason = '', creator_id = v_creator.id, decided_by = v_actor,
         decided_at = pg_catalog.clock_timestamp()
   where id = p_id returning * into v_app;
  perform public.admin_log(v_actor, v_actor_name, 'Approved creator application', v_app.name, v_creator.code);
  return pg_catalog.jsonb_build_object(
    'application', public.creator_application_dto(v_app),
    'creator', public.admin_creator_dto(v_creator),
    'approved', pg_catalog.jsonb_build_object(
      'email', v_app.email, 'name', v_app.name, 'code', v_creator.code));
end $$;

-- ---- grants ---------------------------------------------------------------------------------

revoke all on function
  public.creator_code_available(text), public.creator_portal(),
  public.creator_apply(text,text,text,text,text,text,text,text,text,boolean,text),
  public.creator_save_payout_details(text,text,text,text,text,boolean,text,boolean),
  public.admin_creator_applications(),
  public.admin_decide_creator_application(uuid,boolean,text,text)
  from public, anon, authenticated, service_role;
grant execute on function
  public.creator_code_available(text), public.creator_portal(),
  public.creator_apply(text,text,text,text,text,text,text,text,text,boolean,text),
  public.creator_save_payout_details(text,text,text,text,text,boolean,text,boolean),
  public.admin_creator_applications(),
  public.admin_decide_creator_application(uuid,boolean,text,text)
  to authenticated;

commit;
