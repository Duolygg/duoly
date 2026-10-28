-- Weekly teammate payouts (#14, MONEY-RULES section 6, E1 to E10): admin adjustments, payout weeks
-- Friday 00:00 to Friday 00:00 Europe/Vienna, one payout line per teammate and week, automatic holds on
-- orders with an open report or Stripe dispute, 10 USD minimum with carry forward, manual payout rail
-- (mark paid with method and reference) and teammate payout details for DAC7.
-- Deploy order: code first (the stats contract accepts the old and the new payload and the admin screen
-- reports an unavailable service until this migration exists), then apply this migration.
-- Latest definitions replaced here: teammate_stats() from 20261025130000_trust_deposits.sql and
-- admin_creator_dto(creators) from 20261025110000_creator_referrals.sql (adds paid vs owed per month).
-- Creator commission months are marked paid on the same manual rail (creator_payouts).
begin;

create extension if not exists pg_cron with schema pg_catalog;

-- ---- weeks ------------------------------------------------------------------------------------

-- Start of the payout week that p_at falls in: the latest Friday 00:00 Europe/Vienna at or before it.
create function public.payout_week_start(p_at timestamptz) returns timestamptz
language sql stable security invoker set search_path='' as $$
  select ((l::date - ((pg_catalog.date_part('isodow',l)::integer - 5 + 7) % 7))::timestamp) at time zone 'Europe/Vienna'
  from (select p_at at time zone 'Europe/Vienna' as l) x;
$$;
-- The Friday 00:00 Europe/Vienna seven calendar days later (167 or 169 hours across a DST change).
create function public.payout_week_end(p_start timestamptz) returns timestamptz
language sql stable security invoker set search_path='' as $$
  select (((public.payout_week_start(p_start) at time zone 'Europe/Vienna')::date + 7)::timestamp) at time zone 'Europe/Vienna';
$$;
revoke all on function public.payout_week_start(timestamptz),public.payout_week_end(timestamptz) from public,anon,authenticated,service_role;

create function public.payout_immutable_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  raise sqlstate 'PT409' using message='Payout records are immutable.';
end $$;
revoke all on function public.payout_immutable_guard() from public,anon,authenticated,service_role;

-- ---- tables -----------------------------------------------------------------------------------

-- Manual plus or minus amounts by admins (original lib/adjustments.js): max 1000 USD, never 0,
-- reason required and shown to the teammate, counted in the payout week they are made in.
create table public.teammate_adjustments (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  teammate_id uuid not null references public.profiles(id) on delete restrict,
  amount_usd_cents integer not null check (amount_usd_cents <> 0 and pg_catalog.abs(amount_usd_cents) <= 100000),
  reason text not null check (reason = pg_catalog.btrim(reason) and pg_catalog.char_length(reason) between 1 and 200),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default pg_catalog.clock_timestamp()
);
create index teammate_adjustments_teammate on public.teammate_adjustments(teammate_id,created_at desc);
alter table public.teammate_adjustments enable row level security;
revoke all on table public.teammate_adjustments from public,anon,authenticated,service_role;
create trigger teammate_adjustments_immutable before update or delete on public.teammate_adjustments
  for each row execute function public.payout_immutable_guard();

-- Weeks that ended and were frozen into payout lines.
create table public.payout_weeks (
  week_start timestamptz primary key,
  week_end timestamptz not null,
  frozen_at timestamptz not null default pg_catalog.clock_timestamp(),
  check (week_end > week_start)
);
alter table public.payout_weeks enable row level security;
revoke all on table public.payout_weeks from public,anon,authenticated,service_role;

-- One line per teammate and ended week. Amounts live in payout_line_items (each source counted once).
-- scheduled: payable; on_hold: manual hold with reason; carried: below the 10 USD minimum or negative,
-- moved into the teammate's next line; paid: recorded as paid by an admin (manual rail).
create table public.payout_lines (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  teammate_id uuid not null references public.profiles(id) on delete restrict,
  week_start timestamptz not null references public.payout_weeks(week_start) on delete restrict,
  week_end timestamptz not null,
  status text not null check (status in ('scheduled','on_hold','carried','paid')),
  hold_reason text check (hold_reason is null or (hold_reason = pg_catalog.btrim(hold_reason) and pg_catalog.char_length(hold_reason) between 1 and 200)),
  held_by uuid references public.profiles(id) on delete restrict,
  held_at timestamptz,
  carried_to uuid references public.payout_lines(id) on delete restrict,
  paid_at timestamptz,
  paid_by uuid references public.profiles(id) on delete restrict,
  paid_method text check (paid_method is null or paid_method in ('bank','wise','paypal','other')),
  paid_reference text check (paid_reference is null or (paid_reference = pg_catalog.btrim(paid_reference) and pg_catalog.char_length(paid_reference) between 1 and 120)),
  paid_usd_cents bigint check (paid_usd_cents is null or paid_usd_cents >= 1000),
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  unique (teammate_id,week_start),
  check (week_end > week_start),
  check ((status='on_hold') = (hold_reason is not null and held_by is not null and held_at is not null)),
  check ((status='paid') = (paid_at is not null and paid_by is not null and paid_method is not null and paid_reference is not null and paid_usd_cents is not null)),
  check (carried_to is null or status='carried')
);
create index payout_lines_status on public.payout_lines(status,week_start desc);
create index payout_lines_teammate on public.payout_lines(teammate_id,week_start desc);
alter table public.payout_lines enable row level security;
revoke all on table public.payout_lines from public,anon,authenticated,service_role;

-- Automatic hold of one order's amount while a report or Stripe dispute on it is open (E9).
create table public.payout_order_holds (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  order_id uuid not null references public.teammate_earning_entries(order_id) on delete restrict,
  teammate_id uuid not null references public.profiles(id) on delete restrict,
  line_id uuid not null references public.payout_lines(id) on delete restrict,
  amount_usd_cents bigint not null check (amount_usd_cents > 0),
  reason text not null check (pg_catalog.char_length(reason) between 1 and 200),
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  released_at timestamptz,
  release_reason text check (release_reason is null or pg_catalog.char_length(release_reason) between 1 and 200),
  check ((released_at is null) = (release_reason is null))
);
create unique index payout_order_holds_open on public.payout_order_holds(order_id) where released_at is null;
alter table public.payout_order_holds enable row level security;
revoke all on table public.payout_order_holds from public,anon,authenticated,service_role;

-- What makes up each line. unique(kind,source_id) means an earning, deposit release, adjustment,
-- hold, hold release or carried line can never be counted twice.
create table public.payout_line_items (
  id bigint generated always as identity primary key,
  line_id uuid not null references public.payout_lines(id) on delete restrict,
  kind text not null check (kind in ('earning','tip','deposit_release','adjustment','order_hold','hold_release','carry_in')),
  source_id uuid not null,
  amount_usd_cents bigint not null,
  gross_usd_cents bigint not null default 0,
  held_usd_cents bigint not null default 0,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  unique (kind,source_id),
  check ((kind in ('earning','tip','deposit_release','hold_release') and amount_usd_cents >= 0)
    or (kind='order_hold' and amount_usd_cents < 0) or kind in ('adjustment','carry_in')),
  check (kind='earning' or (gross_usd_cents=0 and held_usd_cents=0))
);
create index payout_line_items_line on public.payout_line_items(line_id,kind);
alter table public.payout_line_items enable row level security;
revoke all on table public.payout_line_items from public,anon,authenticated,service_role;
create trigger payout_line_items_immutable before update or delete on public.payout_line_items
  for each row execute function public.payout_immutable_guard();

-- Identity and payout details needed before the first payout (E10, DAC7). Only the teammate and
-- admins can read the row (RLS); writes go through teammate_save_payout_details().
create table public.teammate_payout_details (
  teammate_id uuid primary key references public.profiles(id) on delete restrict,
  legal_name text not null check (legal_name = pg_catalog.btrim(legal_name) and pg_catalog.char_length(legal_name) between 2 and 120),
  address text not null check (address = pg_catalog.btrim(address) and pg_catalog.char_length(address) between 5 and 300),
  country text not null check (country = pg_catalog.btrim(country) and pg_catalog.char_length(country) between 2 and 56),
  date_of_birth date not null check (date_of_birth >= date '1900-01-01'),
  tax_number text not null check (tax_number = pg_catalog.btrim(tax_number) and pg_catalog.char_length(tax_number) between 2 and 40),
  payout_method text not null check (payout_method in ('bank','wise','paypal')),
  payout_account text not null check (payout_account = pg_catalog.btrim(payout_account) and pg_catalog.char_length(payout_account) between 3 and 200),
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp()
);
alter table public.teammate_payout_details enable row level security;
revoke all on table public.teammate_payout_details from public,anon,authenticated,service_role;

create function public.payout_viewer_is_admin() returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.account_roles r where r.user_id=(select auth.uid()) and r.role='admin');
$$;
revoke all on function public.payout_viewer_is_admin() from public,anon,authenticated,service_role;
grant execute on function public.payout_viewer_is_admin() to authenticated;

grant select on table public.teammate_payout_details to authenticated;
create policy teammate_payout_details_read on public.teammate_payout_details for select to authenticated
  using (teammate_id=(select auth.uid()) or (select public.payout_viewer_is_admin()));

-- Creator commission uses the same manual rail. One immutable record marks one creator month paid.
create table public.creator_payouts (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete restrict,
  month date not null check (month=pg_catalog.date_trunc('month',month)::date),
  amount_eur_cents bigint not null check (amount_eur_cents>0),
  paid_at timestamptz not null default pg_catalog.clock_timestamp(),
  paid_by uuid not null references public.profiles(id) on delete restrict,
  paid_method text not null check (paid_method in ('bank','wise','paypal','other')),
  paid_reference text not null check (paid_reference=pg_catalog.btrim(paid_reference) and pg_catalog.char_length(paid_reference) between 1 and 120),
  unique (creator_id,month)
);
create index creator_payouts_paid_at on public.creator_payouts(paid_at desc);
alter table public.creator_payouts enable row level security;
revoke all on table public.creator_payouts from public,anon,authenticated,service_role;
create trigger creator_payouts_immutable before update or delete on public.creator_payouts
  for each row execute function public.payout_immutable_guard();

-- ---- helpers ----------------------------------------------------------------------------------

create function public.payout_order_blocked(p_order_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.order_reports r where r.order_id=p_order_id and r.status='open')
      or exists(select 1 from public.stripe_disputes d where d.order_id=p_order_id
                and d.status in ('warning_needs_response','warning_under_review','needs_response','under_review'));
$$;

create function public.payout_line_total(p_line_id uuid) returns bigint
language sql stable security definer set search_path='' as $$
  select coalesce(pg_catalog.sum(i.amount_usd_cents),0)::bigint from public.payout_line_items i where i.line_id=p_line_id;
$$;

create function public.payout_details_complete(p_teammate uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.teammate_payout_details d where d.teammate_id=p_teammate);
$$;

create function public.payout_ms(p_at timestamptz) returns bigint
language sql immutable security invoker set search_path='' as $$
  select (pg_catalog.date_part('epoch',p_at)*1000)::bigint;
$$;

create function public.payout_money(p_cents bigint) returns text
language sql immutable security invoker set search_path='' as $$
  select case when p_cents<0 then '-' else '' end||'$'||pg_catalog.to_char(pg_catalog.abs(p_cents)/100.0,'FM999999990.00');
$$;

create function public.payout_person(p_user uuid) returns text
language sql stable security definer set search_path='' as $$
  select coalesce(nullif(p.name,'Player'),u.email,'Teammate') from auth.users u left join public.profiles p on p.id=u.id where u.id=p_user;
$$;

create function public.payout_valid_count(p_teammate uuid) returns bigint
language sql stable security definer set search_path='' as $$
  select pg_catalog.count(*) from public.teammate_earning_entries e join public.order_payments p on p.order_id=e.order_id
   where e.teammate_id=p_teammate and p.state<>'refunded' and not exists(select 1 from public.stripe_disputes d where d.order_id=e.order_id);
$$;

-- ---- freezing ended weeks ---------------------------------------------------------------------

-- Freezes one ended week: every source not counted yet with a time before the week's end goes into
-- the teammate's line for that week, open reports or disputes hold that order's amount, the previous
-- carried balance comes in, and the line is scheduled if it reaches 10 USD, else carried forward.
create function public.payout_freeze_week(p_start timestamptz) returns integer
language plpgsql security definer set search_path='' as $$
declare v_end timestamptz:=public.payout_week_end(p_start); v_tm uuid; v_line uuid; v_lines integer:=0; v_total bigint; v_e record; v_hold uuid;
begin
  if p_start is distinct from public.payout_week_start(p_start) then raise exception 'invalid payout week'; end if;
  insert into public.payout_weeks(week_start,week_end) values(p_start,v_end);
  for v_tm in
    select t.teammate_id from (
      select e.teammate_id from public.teammate_earning_entries e
       where e.completed_at<v_end and not exists(select 1 from public.payout_line_items i where i.kind='earning' and i.source_id=e.order_id)
      union select r.teammate_id from public.deposit_releases r
       where r.state='released' and r.released_at<v_end and not exists(select 1 from public.payout_line_items i where i.kind='deposit_release' and i.source_id=r.earning_id)
      union select a.teammate_id from public.teammate_adjustments a
       where a.created_at<v_end and not exists(select 1 from public.payout_line_items i where i.kind='adjustment' and i.source_id=a.id)
      union select h.teammate_id from public.payout_order_holds h
       where h.released_at<v_end and not exists(select 1 from public.payout_line_items i where i.kind='hold_release' and i.source_id=h.id)
      union select l.teammate_id from public.payout_lines l where l.status='carried' and l.carried_to is null and l.week_start<p_start
    ) t order by t.teammate_id
  loop
    insert into public.payout_lines(teammate_id,week_start,week_end,status) values(v_tm,p_start,v_end,'scheduled') returning id into v_line;
    insert into public.payout_line_items(line_id,kind,source_id,amount_usd_cents,gross_usd_cents,held_usd_cents)
      select v_line,'earning',e.order_id,e.net_usd_cents,e.payout_usd_cents,e.held_usd_cents from public.teammate_earning_entries e
       where e.teammate_id=v_tm and e.completed_at<v_end and not exists(select 1 from public.payout_line_items i where i.kind='earning' and i.source_id=e.order_id);
    insert into public.payout_line_items(line_id,kind,source_id,amount_usd_cents)
      select v_line,'deposit_release',r.earning_id,e.held_usd_cents from public.deposit_releases r join public.teammate_earning_entries e on e.order_id=r.earning_id
       where r.teammate_id=v_tm and r.state='released' and r.released_at<v_end and e.held_usd_cents>0
         and not exists(select 1 from public.payout_line_items i where i.kind='deposit_release' and i.source_id=r.earning_id);
    insert into public.payout_line_items(line_id,kind,source_id,amount_usd_cents)
      select v_line,'adjustment',a.id,a.amount_usd_cents from public.teammate_adjustments a
       where a.teammate_id=v_tm and a.created_at<v_end and not exists(select 1 from public.payout_line_items i where i.kind='adjustment' and i.source_id=a.id);
    insert into public.payout_line_items(line_id,kind,source_id,amount_usd_cents)
      select v_line,'hold_release',h.id,h.amount_usd_cents from public.payout_order_holds h
       where h.teammate_id=v_tm and h.released_at<v_end and not exists(select 1 from public.payout_line_items i where i.kind='hold_release' and i.source_id=h.id);
    insert into public.payout_line_items(line_id,kind,source_id,amount_usd_cents)
      select v_line,'carry_in',l.id,public.payout_line_total(l.id) from public.payout_lines l
       where l.teammate_id=v_tm and l.status='carried' and l.carried_to is null and l.week_start<p_start;
    update public.payout_lines set carried_to=v_line,updated_at=pg_catalog.clock_timestamp()
     where teammate_id=v_tm and status='carried' and carried_to is null and week_start<p_start;
    for v_e in select i.source_id as order_id,i.amount_usd_cents from public.payout_line_items i
                where i.line_id=v_line and i.kind='earning' and i.amount_usd_cents>0 and public.payout_order_blocked(i.source_id) loop
      insert into public.payout_order_holds(order_id,teammate_id,line_id,amount_usd_cents,reason)
        values(v_e.order_id,v_tm,v_line,v_e.amount_usd_cents,'Open report or Stripe dispute on this order') returning id into v_hold;
      insert into public.payout_line_items(line_id,kind,source_id,amount_usd_cents) values(v_line,'order_hold',v_hold,-v_e.amount_usd_cents);
    end loop;
    v_total:=public.payout_line_total(v_line);
    if v_total<1000 then update public.payout_lines set status='carried' where id=v_line; end if;
    v_lines:=v_lines+1;
  end loop;
  return v_lines;
end $$;

-- Freezes every ended week not frozen yet, oldest first (idempotent; the cron and the admin screen call it).
create function public.payout_freeze_due_at(p_now timestamptz) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_next timestamptz; v_first timestamptz; v_weeks integer:=0; v_lines integer:=0;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('duoly.payout_freeze',0));
  select pg_catalog.max(w.week_end) into v_next from public.payout_weeks w;
  if v_next is null then
    select pg_catalog.min(t.at) into v_first from (
      select pg_catalog.min(e.completed_at) at from public.teammate_earning_entries e
      union all select pg_catalog.min(a.created_at) from public.teammate_adjustments a
      union all select pg_catalog.min(r.released_at) from public.deposit_releases r where r.state='released') t;
    v_next:=public.payout_week_start(coalesce(v_first,p_now));
  end if;
  while public.payout_week_end(v_next)<=p_now and v_weeks<1000 loop
    v_lines:=v_lines+public.payout_freeze_week(v_next);
    v_weeks:=v_weeks+1;
    v_next:=public.payout_week_end(v_next);
  end loop;
  return pg_catalog.jsonb_build_object('weeks',v_weeks,'lines',v_lines);
end $$;

create function public.payout_freeze_due() returns jsonb
language sql security definer set search_path='' as $$
  select public.payout_freeze_due_at(pg_catalog.clock_timestamp());
$$;

-- ---- automatic holds (E9) ---------------------------------------------------------------------

-- Re-checks one order: an open report or dispute holds its amount on an unpaid line; once nothing is
-- open the amount is released (back into the same line if it is not paid or carried yet, else into the
-- teammate's next week). A teammate keeps their pay after the review (E7); deposits follow D3 (M1).
create function public.payout_refresh_order_hold(p_order_id uuid) returns text
language plpgsql security definer set search_path='' as $$
declare v_line public.payout_lines; v_item public.payout_line_items; v_hold public.payout_order_holds; v_id uuid; v_ref text;
begin
  select o.public_reference into v_ref from public.orders o where o.id=p_order_id;
  if public.payout_order_blocked(p_order_id) then
    if exists(select 1 from public.payout_order_holds h where h.order_id=p_order_id and h.released_at is null) then return 'held'; end if;
    select i.* into v_item from public.payout_line_items i where i.kind='earning' and i.source_id=p_order_id;
    if v_item.id is null or v_item.amount_usd_cents<=0 then return 'accruing'; end if;
    select l.* into v_line from public.payout_lines l where l.id=v_item.line_id for update;
    -- Follow carry-forward links so a newly opened report or dispute withholds the affected
    -- order from the currently payable balance, rather than from an already-carried shell.
    while v_line.status='carried' and v_line.carried_to is not null loop
      select l.* into v_line from public.payout_lines l where l.id=v_line.carried_to for update;
    end loop;
    if v_line.status not in ('scheduled','on_hold','carried') then return v_line.status; end if;
    insert into public.payout_order_holds(order_id,teammate_id,line_id,amount_usd_cents,reason)
      values(p_order_id,v_line.teammate_id,v_line.id,v_item.amount_usd_cents,'Open report or Stripe dispute on this order') returning id into v_id;
    insert into public.payout_line_items(line_id,kind,source_id,amount_usd_cents) values(v_line.id,'order_hold',v_id,-v_item.amount_usd_cents);
    update public.payout_lines set status=case when status='scheduled' and public.payout_line_total(id)<1000 then 'carried' else status end,
      updated_at=pg_catalog.clock_timestamp() where id=v_line.id;
    perform public.admin_log(null,'Duoly','Auto-held payout amount',public.payout_person(v_line.teammate_id),
      coalesce(v_ref,'Order')||' · '||public.payout_money(v_item.amount_usd_cents)||' while a report or Stripe dispute is open');
    return 'held';
  end if;
  select h.* into v_hold from public.payout_order_holds h where h.order_id=p_order_id and h.released_at is null for update;
  if v_hold.id is null then return 'none'; end if;
  select l.* into v_line from public.payout_lines l where l.id=v_hold.line_id for update;
  update public.payout_order_holds set released_at=pg_catalog.clock_timestamp(),release_reason='Report or Stripe dispute closed' where id=v_hold.id;
  if v_line.status in ('scheduled','on_hold') then
    insert into public.payout_line_items(line_id,kind,source_id,amount_usd_cents) values(v_line.id,'hold_release',v_hold.id,v_hold.amount_usd_cents);
    update public.payout_lines set updated_at=pg_catalog.clock_timestamp() where id=v_line.id;
  end if;
  perform public.admin_log(null,'Duoly','Released auto-held amount',public.payout_person(v_hold.teammate_id),
    coalesce(v_ref,'Order')||' · '||public.payout_money(v_hold.amount_usd_cents)||case when v_line.status in ('scheduled','on_hold') then ' back into the same payout' else ' into the next payout week' end);
  return 'released';
end $$;

create function public.payout_hold_after_change() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  perform public.payout_refresh_order_hold(new.order_id);
  return new;
end $$;
create trigger order_reports_payout_hold after insert or update of status on public.order_reports
  for each row execute function public.payout_hold_after_change();
create trigger stripe_disputes_payout_hold after insert or update of status on public.stripe_disputes
  for each row execute function public.payout_hold_after_change();

-- ---- read models ------------------------------------------------------------------------------

-- What a teammate has not been counted in any line yet (the running week, shown as Accruing), plus
-- their carried balance. Amounts in USD cents.
create function public.payout_pending(p_teammate uuid,p_now timestamptz) returns jsonb
language sql stable security definer set search_path='' as $$
  with e as (select * from public.teammate_earning_entries e where e.teammate_id=p_teammate and e.completed_at<p_now
              and not exists(select 1 from public.payout_line_items i where i.kind='earning' and i.source_id=e.order_id)),
  r as (select x.held_usd_cents from public.deposit_releases d join public.teammate_earning_entries x on x.order_id=d.earning_id
         where d.teammate_id=p_teammate and d.state='released' and d.released_at<p_now
           and not exists(select 1 from public.payout_line_items i where i.kind='deposit_release' and i.source_id=d.earning_id)),
  a as (select * from public.teammate_adjustments a where a.teammate_id=p_teammate and a.created_at<p_now
         and not exists(select 1 from public.payout_line_items i where i.kind='adjustment' and i.source_id=a.id)),
  h as (select * from public.payout_order_holds h where h.teammate_id=p_teammate and h.released_at<p_now
         and not exists(select 1 from public.payout_line_items i where i.kind='hold_release' and i.source_id=h.id)),
  c as (select public.payout_line_total(l.id) total from public.payout_lines l where l.teammate_id=p_teammate and l.status='carried' and l.carried_to is null)
  select pg_catalog.jsonb_build_object(
    'orders',(select pg_catalog.count(*) from e),
    'gross',coalesce((select pg_catalog.sum(payout_usd_cents) from e),0),
    'held',coalesce((select pg_catalog.sum(held_usd_cents) from e),0),
    'net',coalesce((select pg_catalog.sum(net_usd_cents) from e),0),
    'tips',0,
    'released',coalesce((select pg_catalog.sum(held_usd_cents) from r),0),
    'adjust',coalesce((select pg_catalog.sum(amount_usd_cents) from a),0),
    'holdReleased',coalesce((select pg_catalog.sum(amount_usd_cents) from h),0),
    'carried',coalesce((select pg_catalog.sum(total) from c),0),
    'autoHeld',coalesce((select pg_catalog.sum(net_usd_cents) from e where public.payout_order_blocked(e.order_id)),0),
    'adjustments',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('amount',a.amount_usd_cents/100.0,'reason',a.reason,
       'by',public.payout_person(a.created_by),'at',public.payout_ms(a.created_at)) order by a.created_at) from a),'[]'::jsonb),
    'active',exists(select 1 from e) or exists(select 1 from r) or exists(select 1 from a) or exists(select 1 from h) or exists(select 1 from c));
$$;

-- One frozen line as the original Payouts screen expects it (money in USD, times in ms).
create function public.payout_line_dto(p_line_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
  with l as (select * from public.payout_lines where id=p_line_id),
  s as (select
    pg_catalog.count(*) filter(where i.kind='earning') orders,
    coalesce(pg_catalog.sum(i.gross_usd_cents) filter(where i.kind='earning'),0) gross,
    coalesce(pg_catalog.sum(i.held_usd_cents) filter(where i.kind='earning'),0) held,
    coalesce(pg_catalog.sum(i.amount_usd_cents) filter(where i.kind='earning'),0) net,
    coalesce(pg_catalog.sum(i.amount_usd_cents) filter(where i.kind='tip'),0) tips,
    coalesce(pg_catalog.sum(i.amount_usd_cents) filter(where i.kind='deposit_release'),0) released,
    coalesce(pg_catalog.sum(i.amount_usd_cents) filter(where i.kind='adjustment'),0) adjust,
    coalesce(pg_catalog.sum(i.amount_usd_cents) filter(where i.kind='carry_in'),0) carried,
    coalesce(-pg_catalog.sum(i.amount_usd_cents) filter(where i.kind='order_hold'),0) auto_held,
    coalesce(pg_catalog.sum(i.amount_usd_cents) filter(where i.kind='hold_release'),0) hold_released,
    coalesce(pg_catalog.sum(i.amount_usd_cents),0) total
    from public.payout_line_items i where i.line_id=p_line_id)
  select pg_catalog.jsonb_build_object(
    'id',l.id,'week',pg_catalog.to_char(l.week_start at time zone 'Europe/Vienna','YYYY-MM-DD'),
    'start',public.payout_ms(l.week_start),'end',public.payout_ms(l.week_end),'dueAt',public.payout_ms(l.week_end),
    'teammateId',l.teammate_id,'orders',s.orders,
    'gross',(s.gross+s.tips)/100.0,'tips',s.tips/100.0,'held',s.held/100.0,'net',(s.net+s.tips)/100.0,
    'releasing',s.released/100.0,'adjust',s.adjust/100.0,'carried',s.carried/100.0,
    'autoHeld',(s.auto_held-s.hold_released)/100.0,'total',s.total/100.0,
    'adjustments',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('amount',a.amount_usd_cents/100.0,'reason',a.reason,
       'by',public.payout_person(a.created_by),'at',public.payout_ms(a.created_at)) order by a.created_at)
       from public.payout_line_items i join public.teammate_adjustments a on a.id=i.source_id where i.line_id=l.id and i.kind='adjustment'),'[]'::jsonb),
    'status',case l.status when 'scheduled' then 'Scheduled' when 'on_hold' then 'On hold' when 'paid' then 'Paid' else 'Carried' end,
    'reason',coalesce(l.hold_reason,''),'paidAt',case when l.paid_at is null then null else public.payout_ms(l.paid_at) end,
    'method',l.paid_method,'reference',l.paid_reference)
  from l,s;
$$;

create function public.payout_teammate_dto(p_teammate uuid) returns jsonb
language sql stable security definer set search_path='' as $$
  select pg_catalog.jsonb_build_object(
    'teammate',coalesce(nullif(p.name,'Player'),u.email,'Teammate'),'av',coalesce(nullif(p.image,''),'/assets/avatars/avatar-1.png'),
    'email',coalesce(u.email,''),'country',coalesce(d.country,p.country,''),'legalName',coalesce(d.legal_name,''),
    'payoutMethod',coalesce(d.payout_method,''),'details',d.teammate_id is not null,
    'tier',pg_catalog.initcap(public.completion_trust(public.payout_valid_count(p_teammate))->>'trust_tier'),
    'deposit',(public.completion_trust(public.payout_valid_count(p_teammate))->>'deposit_percent')::integer)
  from auth.users u left join public.profiles p on p.id=u.id left join public.teammate_payout_details d on d.teammate_id=u.id
  where u.id=p_teammate;
$$;

-- ---- admin RPCs -------------------------------------------------------------------------------

create function public.admin_payouts() returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_actor uuid; v_now timestamptz; v_start timestamptz; v_rows jsonb:='[]'::jsonb; v record; v_p jsonb; v_t jsonb;
begin
  select id into v_actor from public.admin_caller();
  if v_actor is null then return public.order_error(403,'Admins only.'); end if;
  perform public.payout_freeze_due();
  v_now:=pg_catalog.clock_timestamp(); v_start:=public.payout_week_start(v_now);
  select coalesce(pg_catalog.jsonb_agg(public.payout_line_dto(l.id)||public.payout_teammate_dto(l.teammate_id) order by l.week_start desc,l.id),'[]'::jsonb)
    into v_rows from public.payout_lines l where l.status<>'carried';
  -- the running week (not frozen yet) per teammate with anything pending
  for v in select distinct t.id from (
      select e.teammate_id id from public.teammate_earning_entries e where not exists(select 1 from public.payout_line_items i where i.kind='earning' and i.source_id=e.order_id)
      union select a.teammate_id from public.teammate_adjustments a where not exists(select 1 from public.payout_line_items i where i.kind='adjustment' and i.source_id=a.id)
      union select r.teammate_id from public.deposit_releases r where r.state='released' and not exists(select 1 from public.payout_line_items i where i.kind='deposit_release' and i.source_id=r.earning_id)
      union select h.teammate_id from public.payout_order_holds h where h.released_at is not null and not exists(select 1 from public.payout_line_items i where i.kind='hold_release' and i.source_id=h.id)
      union select l.teammate_id from public.payout_lines l where l.status='carried' and l.carried_to is null) t loop
    v_p:=public.payout_pending(v.id,v_now);
    if not (v_p->>'active')::boolean then continue; end if;
    v_t:=public.payout_teammate_dto(v.id);
    v_rows:=v_rows||pg_catalog.jsonb_build_array(v_t||pg_catalog.jsonb_build_object(
      'id','accruing:'||v.id,'week',pg_catalog.to_char(v_start at time zone 'Europe/Vienna','YYYY-MM-DD'),
      'start',public.payout_ms(v_start),'end',public.payout_ms(public.payout_week_end(v_start)),'dueAt',public.payout_ms(public.payout_week_end(v_start)),
      'teammateId',v.id,'orders',(v_p->>'orders')::integer,
      'gross',((v_p->>'gross')::bigint+(v_p->>'tips')::bigint)/100.0,'tips',(v_p->>'tips')::bigint/100.0,'held',(v_p->>'held')::bigint/100.0,
      'net',((v_p->>'net')::bigint+(v_p->>'tips')::bigint)/100.0,'releasing',(v_p->>'released')::bigint/100.0,'adjust',(v_p->>'adjust')::bigint/100.0,
      'carried',(v_p->>'carried')::bigint/100.0,'autoHeld',((v_p->>'autoHeld')::bigint)/100.0,
      'total',((v_p->>'net')::bigint+(v_p->>'tips')::bigint+(v_p->>'released')::bigint+(v_p->>'adjust')::bigint+(v_p->>'holdReleased')::bigint+(v_p->>'carried')::bigint-(v_p->>'autoHeld')::bigint)/100.0,
      'adjustments',v_p->'adjustments','status','Accruing','reason','','paidAt',null,'method',null,'reference',null));
  end loop;
  return pg_catalog.jsonb_build_object('now',public.payout_ms(v_now),'weekStart',public.payout_ms(v_start),'minimum',10,
    'payouts',v_rows,
    'teammates',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id',r.user_id,'name',coalesce(nullif(p.name,'Player'),u.email,'Teammate'),'email',coalesce(u.email,''))
      order by pg_catalog.lower(coalesce(nullif(p.name,'Player'),u.email,''))) from public.account_roles r join auth.users u on u.id=r.user_id left join public.profiles p on p.id=r.user_id where r.role='teammate'),'[]'::jsonb));
end $$;

create function public.admin_teammate_adjust(p_teammate_id uuid,p_amount_usd_cents integer,p_reason text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_actor uuid; v_name text; v_reason text; v_id uuid;
begin
  select id,name into v_actor,v_name from public.admin_caller();
  if v_actor is null then return public.order_error(403,'Admins only.'); end if;
  if p_amount_usd_cents is null or p_amount_usd_cents=0 or pg_catalog.abs(p_amount_usd_cents)>100000 then
    return public.order_error(400,'Enter an amount between -$1000 and +$1000 (not 0).'); end if;
  v_reason:=pg_catalog.btrim(pg_catalog.regexp_replace(coalesce(p_reason,''),'[[:cntrl:]]',' ','g'));
  if pg_catalog.char_length(v_reason) not between 1 and 200 then return public.order_error(400,'Add a reason. The teammate sees it on their dashboard.'); end if;
  if not exists(select 1 from public.account_roles where user_id=p_teammate_id and role='teammate') then return public.order_error(404,'Teammate not found.'); end if;
  insert into public.teammate_adjustments(teammate_id,amount_usd_cents,reason,created_by) values(p_teammate_id,p_amount_usd_cents,v_reason,v_actor) returning id into v_id;
  perform public.admin_log(v_actor,v_name,'Adjusted teammate balance',public.payout_person(p_teammate_id),
    case when p_amount_usd_cents>0 then '+' else '' end||public.payout_money(p_amount_usd_cents)||' · '||v_reason);
  return pg_catalog.jsonb_build_object('ok',true,'adjustment',pg_catalog.jsonb_build_object('id',v_id,'teammateId',p_teammate_id,
    'amount',p_amount_usd_cents/100.0,'reason',v_reason));
end $$;

-- Internal: marks one locked scheduled line paid. Returns an error envelope or null.
create function public.payout_pay_locked(v_line public.payout_lines,p_actor uuid,p_method text,p_reference text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_total bigint;
begin
  if v_line.status='paid' then return public.order_error(409,'This payout was already paid.'); end if;
  if v_line.status='on_hold' then return public.order_error(409,'Release the hold first.'); end if;
  if v_line.status='carried' then return public.order_error(409,'This week was below the $10 minimum and moved to the next week.'); end if;
  v_total:=public.payout_line_total(v_line.id);
  if v_total<1000 then return public.order_error(409,'Below the $10 minimum. It stays owed until it reaches $10.'); end if;
  if not public.payout_details_complete(v_line.teammate_id) then
    return public.order_error(409,public.payout_person(v_line.teammate_id)||' has not added their payout details yet. The money stays owed.'); end if;
  update public.payout_lines set status='paid',paid_at=pg_catalog.clock_timestamp(),paid_by=p_actor,paid_method=p_method,
    paid_reference=p_reference,paid_usd_cents=v_total,updated_at=pg_catalog.clock_timestamp() where id=v_line.id;
  return null;
end $$;

create function public.admin_payout_pay(p_line_id uuid,p_method text,p_reference text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_actor uuid; v_name text; v_line public.payout_lines; v_ref text:=pg_catalog.btrim(coalesce(p_reference,'')); v_err jsonb;
begin
  select id,name into v_actor,v_name from public.admin_caller();
  if v_actor is null then return public.order_error(403,'Admins only.'); end if;
  if p_method is null or p_method not in ('bank','wise','paypal','other') then return public.order_error(400,'Pick how you paid.'); end if;
  if pg_catalog.char_length(v_ref) not between 1 and 120 then return public.order_error(400,'Add the transfer reference (up to 120 characters).'); end if;
  select l.* into v_line from public.payout_lines l where l.id=p_line_id for update;
  if v_line.id is null then return public.order_error(404,'Payout not found.'); end if;
  v_err:=public.payout_pay_locked(v_line,v_actor,p_method,v_ref);
  if v_err is not null then return v_err; end if;
  perform public.admin_log(v_actor,v_name,'Marked payout paid',public.payout_person(v_line.teammate_id),
    public.payout_money(public.payout_line_total(v_line.id))||' · week of '||pg_catalog.to_char(v_line.week_start at time zone 'Europe/Vienna','YYYY-MM-DD')||' · '||p_method||' · '||v_ref);
  return pg_catalog.jsonb_build_object('ok',true,'payout',public.payout_line_dto(v_line.id)||public.payout_teammate_dto(v_line.teammate_id));
end $$;

create function public.admin_payout_pay_all(p_method text,p_reference text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_actor uuid; v_name text; v_line public.payout_lines; v_ref text:=pg_catalog.btrim(coalesce(p_reference,'')); v_paid integer:=0; v_skipped integer:=0; v_sum bigint:=0; v_err jsonb; v_total bigint;
begin
  select id,name into v_actor,v_name from public.admin_caller();
  if v_actor is null then return public.order_error(403,'Admins only.'); end if;
  if p_method is null or p_method not in ('bank','wise','paypal','other') then return public.order_error(400,'Pick how you paid.'); end if;
  if pg_catalog.char_length(v_ref) not between 1 and 120 then return public.order_error(400,'Add the transfer reference (up to 120 characters).'); end if;
  perform public.payout_freeze_due();
  for v_line in select l.* from public.payout_lines l where l.status='scheduled' order by l.week_start,l.id for update loop
    v_total:=public.payout_line_total(v_line.id);
    v_err:=public.payout_pay_locked(v_line,v_actor,p_method,v_ref);
    if v_err is null then
      v_paid:=v_paid+1; v_sum:=v_sum+v_total;
      perform public.admin_log(v_actor,v_name,'Marked payout paid',public.payout_person(v_line.teammate_id),
        public.payout_money(v_total)||' · week of '||pg_catalog.to_char(v_line.week_start at time zone 'Europe/Vienna','YYYY-MM-DD')||' · '||p_method||' · '||v_ref||' · pay all');
    else v_skipped:=v_skipped+1; end if;
  end loop;
  perform public.admin_log(v_actor,v_name,'Paid all scheduled payouts',v_paid||' payouts',public.payout_money(v_sum)||' · '||v_skipped||' skipped · '||p_method||' · '||v_ref);
  return pg_catalog.jsonb_build_object('ok',true,'paid',v_paid,'skipped',v_skipped,'total',v_sum/100.0);
end $$;

create function public.admin_payout_hold(p_line_id uuid,p_reason text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_actor uuid; v_name text; v_line public.payout_lines; v_reason text:=pg_catalog.btrim(pg_catalog.regexp_replace(coalesce(p_reason,''),'[[:cntrl:]]',' ','g'));
begin
  select id,name into v_actor,v_name from public.admin_caller();
  if v_actor is null then return public.order_error(403,'Admins only.'); end if;
  if pg_catalog.char_length(v_reason) not between 1 and 200 then return public.order_error(400,'Add a reason for the hold (up to 200 characters).'); end if;
  select l.* into v_line from public.payout_lines l where l.id=p_line_id for update;
  if v_line.id is null then return public.order_error(404,'Payout not found.'); end if;
  if v_line.status='paid' then return public.order_error(409,'This payout was already paid.'); end if;
  if v_line.status='on_hold' then return public.order_error(409,'This payout is already on hold.'); end if;
  if v_line.status<>'scheduled' then return public.order_error(409,'Only scheduled payouts can be held.'); end if;
  update public.payout_lines set status='on_hold',hold_reason=v_reason,held_by=v_actor,held_at=pg_catalog.clock_timestamp(),updated_at=pg_catalog.clock_timestamp() where id=v_line.id;
  perform public.admin_log(v_actor,v_name,'Held payout',public.payout_person(v_line.teammate_id),
    public.payout_money(public.payout_line_total(v_line.id))||' · week of '||pg_catalog.to_char(v_line.week_start at time zone 'Europe/Vienna','YYYY-MM-DD')||' · '||v_reason);
  return pg_catalog.jsonb_build_object('ok',true,'payout',public.payout_line_dto(v_line.id)||public.payout_teammate_dto(v_line.teammate_id));
end $$;

create function public.admin_payout_release(p_line_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_actor uuid; v_name text; v_line public.payout_lines;
begin
  select id,name into v_actor,v_name from public.admin_caller();
  if v_actor is null then return public.order_error(403,'Admins only.'); end if;
  select l.* into v_line from public.payout_lines l where l.id=p_line_id for update;
  if v_line.id is null then return public.order_error(404,'Payout not found.'); end if;
  if v_line.status='paid' then return public.order_error(409,'This payout was already paid.'); end if;
  if v_line.status<>'on_hold' then return public.order_error(409,'This payout isn’t on hold.'); end if;
  update public.payout_lines set status='scheduled',hold_reason=null,held_by=null,held_at=null,updated_at=pg_catalog.clock_timestamp() where id=v_line.id;
  perform public.admin_log(v_actor,v_name,'Released payout hold',public.payout_person(v_line.teammate_id),
    public.payout_money(public.payout_line_total(v_line.id))||' · week of '||pg_catalog.to_char(v_line.week_start at time zone 'Europe/Vienna','YYYY-MM-DD')||' · was held for: '||v_line.hold_reason);
  return pg_catalog.jsonb_build_object('ok',true,'payout',public.payout_line_dto(v_line.id)||public.payout_teammate_dto(v_line.teammate_id));
end $$;

-- ---- teammate RPCs ----------------------------------------------------------------------------

create function public.teammate_payout_details() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v public.teammate_payout_details;
begin
  if v_actor is null then return public.order_error(401,'Authentication required.'); end if;
  if not exists(select 1 from public.account_roles where user_id=v_actor and role='teammate') then return public.order_error(403,'Teammate role required.'); end if;
  select d.* into v from public.teammate_payout_details d where d.teammate_id=v_actor;
  return pg_catalog.jsonb_build_object('details',case when v.teammate_id is null then null else pg_catalog.jsonb_build_object(
    'legalName',v.legal_name,'address',v.address,'country',v.country,'dateOfBirth',pg_catalog.to_char(v.date_of_birth,'YYYY-MM-DD'),
    'taxNumber',v.tax_number,'method',v.payout_method,'account',v.payout_account,'updatedAt',public.payout_ms(v.updated_at)) end);
end $$;

create function public.teammate_save_payout_details(p_legal_name text,p_address text,p_country text,p_date_of_birth date,p_tax_number text,p_method text,p_account text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_name text:=pg_catalog.btrim(coalesce(p_legal_name,'')); v_address text:=pg_catalog.btrim(coalesce(p_address,''));
  v_country text:=pg_catalog.btrim(coalesce(p_country,'')); v_tax text:=pg_catalog.btrim(coalesce(p_tax_number,'')); v_account text:=pg_catalog.btrim(coalesce(p_account,''));
begin
  if v_actor is null then return public.order_error(401,'Authentication required.'); end if;
  if not exists(select 1 from public.account_roles where user_id=v_actor and role='teammate') then return public.order_error(403,'Teammate role required.'); end if;
  if pg_catalog.char_length(v_name) not between 2 and 120 then return public.order_error(400,'Add your full legal name.'); end if;
  if pg_catalog.char_length(v_address) not between 5 and 300 then return public.order_error(400,'Add your full address.'); end if;
  if pg_catalog.char_length(v_country) not between 2 and 56 then return public.order_error(400,'Add your country.'); end if;
  if p_date_of_birth is null or p_date_of_birth<date '1900-01-01' or p_date_of_birth>(current_date-interval '18 years')::date then
    return public.order_error(400,'Add your date of birth. You need to be 18 or older to be paid.'); end if;
  if pg_catalog.char_length(v_tax) not between 2 and 40 then return public.order_error(400,'Add your tax number.'); end if;
  if p_method is null or p_method not in ('bank','wise','paypal') then return public.order_error(400,'Pick how you want to be paid.'); end if;
  if pg_catalog.char_length(v_account) not between 3 and 200 then return public.order_error(400,'Add the account we should pay to.'); end if;
  insert into public.teammate_payout_details(teammate_id,legal_name,address,country,date_of_birth,tax_number,payout_method,payout_account)
    values(v_actor,v_name,v_address,v_country,p_date_of_birth,v_tax,p_method,v_account)
  on conflict(teammate_id) do update set legal_name=excluded.legal_name,address=excluded.address,country=excluded.country,
    date_of_birth=excluded.date_of_birth,tax_number=excluded.tax_number,payout_method=excluded.payout_method,
    payout_account=excluded.payout_account,updated_at=pg_catalog.clock_timestamp();
  perform public.admin_log(v_actor,public.payout_person(v_actor),'Updated payout details',public.payout_person(v_actor),'Payout method: '||p_method);
  return public.teammate_payout_details();
end $$;

-- What the teammate dashboard shows about payouts: this week so far (Accruing), the 10 USD minimum,
-- whether details are on file and the last frozen weeks.
create function public.teammate_payout_summary(p_teammate uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_now timestamptz:=pg_catalog.clock_timestamp(); v_start timestamptz:=public.payout_week_start(pg_catalog.clock_timestamp()); v_p jsonb; v_due bigint;
begin
  v_p:=public.payout_pending(p_teammate,v_now);
  v_due:=(v_p->>'net')::bigint+(v_p->>'tips')::bigint+(v_p->>'released')::bigint+(v_p->>'adjust')::bigint+(v_p->>'holdReleased')::bigint+(v_p->>'carried')::bigint-(v_p->>'autoHeld')::bigint;
  return pg_catalog.jsonb_build_object(
    'weekStart',public.payout_ms(v_start),'weekEnd',public.payout_ms(public.payout_week_end(v_start)),
    'due',v_due/100.0,'carried',(v_p->>'carried')::bigint/100.0,'held',(v_p->>'autoHeld')::bigint/100.0,'minimum',10,
    'details',public.payout_details_complete(p_teammate),
    'owed',coalesce((select pg_catalog.sum(public.payout_line_total(l.id)) from public.payout_lines l where l.teammate_id=p_teammate and l.status in ('scheduled','on_hold')),0)/100.0,
    'history',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('start',public.payout_ms(q.week_start),'end',public.payout_ms(q.week_end),
      'total',public.payout_line_total(q.id)/100.0,'status',case q.status when 'scheduled' then 'Scheduled' when 'on_hold' then 'On hold' when 'paid' then 'Paid' else 'Carried' end,
      'paidAt',case when q.paid_at is null then null else public.payout_ms(q.paid_at) end) order by q.week_start desc)
      from (select l.* from public.payout_lines l where l.teammate_id=p_teammate order by l.week_start desc limit 8) q),'[]'::jsonb));
end $$;

-- Latest definition is 20261025130000_trust_deposits.sql. Adds adjustments (in recent and the 30-day
-- list, like the original app/api/teammate/stats) and the payout summary.
create or replace function public.teammate_stats() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v_count bigint; v_trust jsonb; v_result jsonb; v_next integer; v_floor integer;
begin
 if v_actor is null then return public.order_error(401,'Authentication required.'); end if;
 perform 1 from public.account_roles where user_id=v_actor and role='teammate';
 if not found then return public.order_error(403,'Teammate role required.'); end if;
 select pg_catalog.count(*) into v_count from public.teammate_earning_entries e join public.order_payments p on p.order_id=e.order_id
   where e.teammate_id=v_actor and p.state<>'refunded' and not exists(select 1 from public.stripe_disputes d where d.order_id=e.order_id);
 v_trust:=public.completion_trust(v_count);
 v_floor:=case when v_count>=1000 then 1000 when v_count>=500 then 500 when v_count>=250 then 250 when v_count>=100 then 100 else 0 end;
 v_next:=case when v_count<100 then 100 when v_count<250 then 250 when v_count<500 then 500 when v_count<1000 then 1000 end;
 select pg_catalog.jsonb_build_object(
   'now',(pg_catalog.date_part('epoch',pg_catalog.clock_timestamp())*1000)::bigint,'me',v_actor,
   'stats',pg_catalog.jsonb_build_object(
     'completed',v_count,'tier',pg_catalog.jsonb_build_object('name',pg_catalog.initcap(v_trust->>'trust_tier'),'deposit',(v_trust->>'deposit_percent')::integer),
     'held',coalesce((select pg_catalog.sum(e.held_usd_cents) from public.deposit_releases r join public.teammate_earning_entries e on e.order_id=r.earning_id where r.teammate_id=v_actor and r.state in ('waiting','blocked')),0)/100.0,
     'released',coalesce((select pg_catalog.sum(e.held_usd_cents) from public.deposit_releases r join public.teammate_earning_entries e on e.order_id=r.earning_id where r.teammate_id=v_actor and r.state='released'),0)/100.0,
     'forfeited',coalesce((select pg_catalog.sum(e.held_usd_cents) from public.deposit_releases r join public.teammate_earning_entries e on e.order_id=r.earning_id where r.teammate_id=v_actor and r.state='forfeited'),0)/100.0,
     'saved',coalesce((select pg_catalog.sum((10-e.deposit_percent)*e.payout_usd_cents) from public.teammate_earning_entries e where e.teammate_id=v_actor),0)/10000.0,
     'progress',pg_catalog.jsonb_build_object('current',v_count,'next',v_next,'remaining',coalesce(v_next-v_count,0),'percent',case when v_next is null then 100 else pg_catalog.floor(100.0*(v_count-v_floor)/(v_next-v_floor))::integer end),
     'rating',(select pg_catalog.round(pg_catalog.avg(r.rating),2) from public.order_reviews r where r.teammate_id=v_actor),
     'reviews',(select pg_catalog.count(*) from public.order_reviews r where r.teammate_id=v_actor),'tipsTotal',0,
     'recent',coalesce((select pg_catalog.jsonb_agg(q.item order by q.at desc) from (
        select e.completed_at at,pg_catalog.jsonb_build_object('orderId',e.order_id,'at',(pg_catalog.date_part('epoch',e.completed_at)*1000)::bigint,'net',e.net_usd_cents/100.0,'tip',0,'game',o.game) item
          from public.teammate_earning_entries e join public.orders o on o.id=e.order_id where e.teammate_id=v_actor and e.completed_at>pg_catalog.clock_timestamp()-interval '8 days'
        union all
        select a.created_at,pg_catalog.jsonb_build_object('orderId',null,'at',(pg_catalog.date_part('epoch',a.created_at)*1000)::bigint,'net',a.amount_usd_cents/100.0,'tip',0,'game',null,'adjustment',true)
          from public.teammate_adjustments a where a.teammate_id=v_actor and a.created_at>pg_catalog.clock_timestamp()-interval '8 days') q),'[]'::jsonb),
     'latestReviews',coalesce((select pg_catalog.jsonb_agg(q.item order by q.created_at desc) from (select r.created_at,pg_catalog.jsonb_build_object('rating',r.rating,'text',r.text,'tags',pg_catalog.to_jsonb(r.tags),'customer',o.customer_name,'game',o.game,'at',(pg_catalog.date_part('epoch',r.created_at)*1000)::bigint) item from public.order_reviews r join public.orders o on o.id=r.order_id where r.teammate_id=v_actor and (r.text<>'' or pg_catalog.cardinality(r.tags)>0) order by r.created_at desc,r.order_id limit 5) q),'[]'::jsonb),
     'adjustments',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('amount',a.amount_usd_cents/100.0,'reason',a.reason,'at',(pg_catalog.date_part('epoch',a.created_at)*1000)::bigint) order by a.created_at desc)
        from public.teammate_adjustments a where a.teammate_id=v_actor and a.created_at>pg_catalog.clock_timestamp()-interval '30 days'),'[]'::jsonb),
     'payout',public.teammate_payout_summary(v_actor)),
   'leaderboard',public.teammate_leaderboard(pg_catalog.clock_timestamp())) into v_result;
 return v_result;
end $$;

-- ---- creator payout marking -------------------------------------------------------------------

create function public.creator_month_commission(p_creator uuid,p_month date) returns bigint
language sql stable security definer set search_path='' as $$
  with counted as (
    select greatest(0,r.amount_eur_cents-coalesce((select pg_catalog.sum(c.amount_eur_cents)
      from public.refund_credits c where c.order_id=o.id),0))::bigint base
    from public.order_referrals r join public.orders o on o.id=r.order_id
    left join public.order_payments p on p.order_id=o.id
    where r.creator_id=p_creator and o.status='completed'
      and pg_catalog.date_trunc('month',o.completed_at at time zone 'UTC')::date=p_month
      and coalesce(p.state,'') not in ('refunded','voided')
  ), totals as (select pg_catalog.count(*)::integer n,coalesce(pg_catalog.sum(base),0)::bigint base from counted)
  select (base*(public.creator_tier(n)->>'commission')::integer+50)/100 from totals;
$$;

-- Replace the latest definition from 20261025110000_creator_referrals.sql. Commission is still
-- calculated from the same completed-order CTE; paid months are annotated and excluded from owed.
create or replace function public.admin_creator_dto(p_creator public.creators) returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare v_months jsonb; v_owed bigint; v_earned bigint; v_customers integer; v_orders integer; v_pending integer;
begin
  with counted as (
    select pg_catalog.to_char(pg_catalog.date_trunc('month',o.completed_at at time zone 'UTC'),'YYYY-MM') as month,
      greatest(0,r.amount_eur_cents-coalesce((select pg_catalog.sum(c.amount_eur_cents) from public.refund_credits c where c.order_id=o.id),0))::bigint base
    from public.order_referrals r join public.orders o on o.id=r.order_id
    left join public.order_payments p on p.order_id=o.id
    where r.creator_id=p_creator.id and o.status='completed' and coalesce(p.state,'') not in ('refunded','voided')
  ), months as (
    select m.month,m.n,m.base,public.creator_tier(m.n) tier,
      (m.base*(public.creator_tier(m.n)->>'commission')::integer+50)/100 commission_cents
    from (select month,pg_catalog.count(*)::integer n,pg_catalog.sum(base)::bigint base from counted group by month) m
  ), decorated as (
    select m.*,cp.id payout_id,cp.paid_at,cp.paid_method,cp.paid_reference
    from months m left join public.creator_payouts cp on cp.creator_id=p_creator.id
      and cp.month=pg_catalog.to_date(m.month||'-01','YYYY-MM-DD')
  )
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'month',x.month,'orders',x.n,'baseCents',x.base,'tier',x.tier->>'id',
      'commission',(x.tier->>'commission')::integer,'commissionCents',x.commission_cents,
      'paid',x.payout_id is not null,'paidAt',x.paid_at,'method',x.paid_method,'reference',x.paid_reference)
      order by x.month desc),'[]'::jsonb),
    coalesce(pg_catalog.sum(x.commission_cents) filter(where x.payout_id is null),0)::bigint,
    coalesce(pg_catalog.sum(x.commission_cents),0)::bigint
    into v_months,v_owed,v_earned from decorated x;
  select pg_catalog.count(*) into v_customers from public.customer_referrals where creator_id=p_creator.id;
  select pg_catalog.count(*) into v_orders from public.order_referrals where creator_id=p_creator.id;
  select pg_catalog.count(*) into v_pending from public.order_referrals r join public.orders o on o.id=r.order_id
    where r.creator_id=p_creator.id and o.status in ('queued','in_progress');
  return pg_catalog.jsonb_build_object(
    'id',p_creator.id,'code',p_creator.code,'name',p_creator.name,'channel',p_creator.channel,
    'active',p_creator.active,'createdAt',p_creator.created_at,'createdBy',p_creator.created_by,
    'customers',v_customers,'orders',v_orders,'openOrders',v_pending,
    'months',v_months,'owedCents',v_owed,'earnedCents',v_earned);
end;
$$;

create function public.admin_creator_payout_pay(p_creator_id uuid,p_month text,p_method text,p_reference text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_actor uuid; v_actor_name text; v_creator public.creators; v_month date; v_amount bigint; v_owed bigint; v_ref text:=pg_catalog.btrim(coalesce(p_reference,''));
begin
  select id,name into v_actor,v_actor_name from public.admin_caller();
  if v_actor is null then return public.order_error(403,'Admins only.'); end if;
  if p_month is null or p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then return public.order_error(400,'Pick a valid commission month.'); end if;
  v_month:=pg_catalog.to_date(p_month||'-01','YYYY-MM-DD');
  if v_month>=pg_catalog.date_trunc('month',pg_catalog.clock_timestamp() at time zone 'UTC')::date then
    return public.order_error(409,'Only finished commission months can be marked paid.'); end if;
  if p_method is null or p_method not in ('bank','wise','paypal','other') then return public.order_error(400,'Pick how you paid.'); end if;
  if pg_catalog.char_length(v_ref) not between 1 and 120 then return public.order_error(400,'Add the transfer reference (up to 120 characters).'); end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('duoly.creator.payout.'||p_creator_id::text,0));
  select c.* into v_creator from public.creators c where c.id=p_creator_id;
  if v_creator.id is null then return public.order_error(404,'Creator not found.'); end if;
  if exists(select 1 from public.creator_payouts where creator_id=p_creator_id and month=v_month) then
    return public.order_error(409,'That creator month was already marked paid.'); end if;
  v_amount:=public.creator_month_commission(p_creator_id,v_month);
  if v_amount<=0 then return public.order_error(409,'There is no commission to pay for that month.'); end if;
  select coalesce(pg_catalog.sum(public.creator_month_commission(p_creator_id,m.month)),0)::bigint into v_owed
    from (select distinct pg_catalog.date_trunc('month',o.completed_at at time zone 'UTC')::date as month
      from public.order_referrals r join public.orders o on o.id=r.order_id
      where r.creator_id=p_creator_id and o.status='completed') m
    where not exists(select 1 from public.creator_payouts cp where cp.creator_id=p_creator_id and cp.month=m.month);
  if v_owed<5000 then return public.order_error(409,'Creator commission stays owed until the unpaid total reaches €50.'); end if;
  insert into public.creator_payouts(creator_id,month,amount_eur_cents,paid_by,paid_method,paid_reference)
    values(p_creator_id,v_month,v_amount,v_actor,p_method,v_ref);
  perform public.admin_log(v_actor,v_actor_name,'Marked creator commission paid',v_creator.name,
    '€'||pg_catalog.to_char(v_amount/100.0,'FM999999990.00')||' · '||p_month||' · '||p_method||' · '||v_ref);
  return pg_catalog.jsonb_build_object('ok',true,'creator',public.admin_creator_dto(v_creator));
end $$;

-- ---- grants and schedule ----------------------------------------------------------------------

revoke all on function
  public.payout_order_blocked(uuid),public.payout_line_total(uuid),public.payout_details_complete(uuid),public.payout_ms(timestamptz),
  public.payout_money(bigint),public.payout_person(uuid),public.payout_valid_count(uuid),public.payout_freeze_week(timestamptz),
  public.payout_freeze_due_at(timestamptz),public.payout_freeze_due(),public.payout_refresh_order_hold(uuid),public.payout_hold_after_change(),
  public.payout_pending(uuid,timestamptz),public.payout_line_dto(uuid),public.payout_teammate_dto(uuid),
  public.payout_pay_locked(public.payout_lines,uuid,text,text),public.teammate_payout_summary(uuid),
  public.creator_month_commission(uuid,date)
  from public,anon,authenticated,service_role;
revoke all on function
  public.admin_payouts(),public.admin_teammate_adjust(uuid,integer,text),public.admin_payout_pay(uuid,text,text),
  public.admin_payout_pay_all(text,text),public.admin_payout_hold(uuid,text),public.admin_payout_release(uuid),
  public.admin_creator_payout_pay(uuid,text,text,text),
  public.teammate_payout_details(),public.teammate_save_payout_details(text,text,text,date,text,text,text),public.teammate_stats()
  from public,anon,authenticated,service_role;
grant execute on function
  public.admin_payouts(),public.admin_teammate_adjust(uuid,integer,text),public.admin_payout_pay(uuid,text,text),
  public.admin_payout_pay_all(text,text),public.admin_payout_hold(uuid,text),public.admin_payout_release(uuid),
  public.admin_creator_payout_pay(uuid,text,text,text),
  public.teammate_payout_details(),public.teammate_save_payout_details(text,text,text,date,text,text,text),public.teammate_stats()
  to authenticated;

-- Friday 00:00 Europe/Vienna is Thursday 23:00 UTC in winter and 22:00 UTC in summer: run at both,
-- the second run finds nothing to freeze.
select cron.schedule('payout-week-freeze','5 22,23 * * 4','select public.payout_freeze_due();');
select cron.alter_job(jobid,active:=true) from cron.job where jobname='payout-week-freeze' and username=current_user;

commit;
