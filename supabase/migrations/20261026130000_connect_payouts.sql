-- Stripe Connect Express payouts, phase 2 of the teammate payout rail (#14, MONEY-RULES 6.3 "Rail,
-- phase 2", E3). Every rule of the weekly lines stays as it is: same lines, 10 USD minimum with carry
-- forward, holds, payout details still required (DAC7), only Scheduled lines can be paid, never a
-- negative amount, every action audited. New: a teammate can link one Stripe Express account; an admin
-- can pay a Scheduled line with a Stripe Transfer from the platform balance when that account is ready.
-- The manual rail (mark paid with method and reference) stays for everyone else.
--
-- Money movement only happens in server code behind CONNECT_PAYOUTS_ENABLED. Every function that
-- writes Connect or transfer state is granted to service_role only, so a signed-in user can never
-- start a transfer by calling the database directly. The one new authenticated RPC
-- (admin_payout_pay_all_manual) only marks lines paid on the manual rail and skips Stripe-ready lines.
--
-- Transfers: one live transfer per line (partial unique index). The idempotency key is
-- duoly-payout-<line id>-<attempt>; the attempt only moves on after Stripe definitely refused the
-- previous one, so a retry after a timeout reuses the same key and the same amount and cannot pay
-- twice. While a transfer is pending the line cannot be marked paid by hand, held, or changed by an
-- automatic hold. Currency and FX: the server passes the transfer currency and, for EUR, the ECB mid
-- rate fixed when the transfer is prepared (open point for the owner, see docs/product/connect-payouts.md).
-- A reversed transfer (transfer.reversed) gives the teammate the reversed share back as owed money in
-- the payout week the reversal happens (new line item kind transfer_reversal), like tip movements.
--
-- Deploy order: apply this migration first (additive; the old code never calls the new functions and
-- the replaced read models only add keys), then deploy the code with CONNECT_PAYOUTS_ENABLED unset.
--
-- Latest definitions replaced here, rules unchanged apart from the Connect guards and keys:
--   from 20261026100000_order_tips.sql: payout_freeze_week(timestamptz), payout_pending(uuid,timestamptz),
--     payout_line_dto(uuid), admin_payouts()
--   from 20261025250000_weekly_payouts.sql: payout_teammate_dto(uuid), payout_pay_locked(payout_lines,uuid,text,text),
--     admin_payout_hold(uuid,text), payout_refresh_order_hold(uuid)
begin;

-- ---- tables -----------------------------------------------------------------------------------

-- One Stripe Express account per teammate. status is derived from Stripe's account object by
-- connect_account_status() and is only written by the server through connect_account_sync().
create table public.teammate_connect_accounts (
  teammate_id uuid primary key references public.profiles(id) on delete restrict,
  stripe_account_id text not null unique check (stripe_account_id ~ '^acct_[A-Za-z0-9]+$'),
  country text not null check (country ~ '^[A-Z]{2}$'),
  status text not null default 'not_started' check (status in ('not_started','pending','ready','restricted')),
  details_submitted boolean not null default false,
  payouts_enabled boolean not null default false,
  transfers_active boolean not null default false,
  disabled_reason text check (disabled_reason is null or pg_catalog.char_length(disabled_reason) <= 120),
  requirements_due integer not null default 0 check (requirements_due between 0 and 500),
  payout_failed_at timestamptz,
  payout_failure text check (payout_failure is null or pg_catalog.char_length(payout_failure) <= 120),
  synced_at timestamptz,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp()
);
alter table public.teammate_connect_accounts enable row level security;
revoke all on table public.teammate_connect_accounts from public,anon,authenticated,service_role;

-- Stripe transfers for payout lines. pending: prepared, Stripe not confirmed yet (the line is locked);
-- paid: Stripe created the transfer and the line is paid; failed: Stripe refused it (the line stays
-- scheduled); reversed: the whole transfer came back (partial reversals keep state paid).
create table public.payout_transfers (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  line_id uuid not null references public.payout_lines(id) on delete restrict,
  teammate_id uuid not null references public.profiles(id) on delete restrict,
  stripe_account_id text not null check (stripe_account_id ~ '^acct_[A-Za-z0-9]+$'),
  attempt integer not null check (attempt between 1 and 50),
  idempotency_key text not null unique check (idempotency_key ~ '^duoly-payout-[0-9a-f-]{36}-[0-9]+$'),
  amount_usd_cents bigint not null check (amount_usd_cents >= 1000),
  currency text not null check (currency in ('eur','usd')),
  amount_minor bigint not null check (amount_minor > 0),
  fx_eur_usd numeric(12,6) check (fx_eur_usd is null or fx_eur_usd between 0.5 and 2),
  fx_source text check (fx_source is null or fx_source in ('ecb')),
  state text not null default 'pending' check (state in ('pending','paid','failed','reversed')),
  stripe_transfer_id text unique check (stripe_transfer_id is null or stripe_transfer_id ~ '^tr_[A-Za-z0-9]+$'),
  amount_reversed_minor bigint not null default 0 check (amount_reversed_minor >= 0 and amount_reversed_minor <= amount_minor),
  error text check (error is null or pg_catalog.char_length(error) <= 300),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  unique (line_id,attempt),
  check ((currency='eur') = (fx_eur_usd is not null and fx_source is not null)),
  check ((state in ('paid','reversed')) = (stripe_transfer_id is not null)),
  check (state<>'failed' or error is not null),
  check (state='reversed' or amount_reversed_minor < amount_minor),
  check (state<>'reversed' or amount_reversed_minor = amount_minor)
);
create unique index payout_transfers_live on public.payout_transfers(line_id) where state in ('pending','paid','reversed');
create index payout_transfers_teammate on public.payout_transfers(teammate_id,created_at desc);
alter table public.payout_transfers enable row level security;
revoke all on table public.payout_transfers from public,anon,authenticated,service_role;

-- Reversed parts of a paid transfer: owed to the teammate again, counted in the payout week they are
-- recorded in (immutable, like tip movements).
create table public.payout_transfer_reversals (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  transfer_id uuid not null references public.payout_transfers(id) on delete restrict,
  teammate_id uuid not null references public.profiles(id) on delete restrict,
  amount_minor bigint not null check (amount_minor > 0),
  amount_usd_cents bigint not null check (amount_usd_cents >= 0),
  created_at timestamptz not null default pg_catalog.clock_timestamp()
);
create index payout_transfer_reversals_teammate on public.payout_transfer_reversals(teammate_id,created_at);
alter table public.payout_transfer_reversals enable row level security;
revoke all on table public.payout_transfer_reversals from public,anon,authenticated,service_role;
create trigger payout_transfer_reversals_immutable before update or delete on public.payout_transfer_reversals
  for each row execute function public.payout_immutable_guard();

-- Lines paid with Stripe record method 'stripe' and the transfer id as reference. Same constraint
-- names as 20261025250000_weekly_payouts.sql and 20261026100000_order_tips.sql (checked live).
alter table public.payout_lines drop constraint payout_lines_paid_method_check;
alter table public.payout_lines add constraint payout_lines_paid_method_check
  check (paid_method is null or paid_method in ('bank','wise','paypal','other','stripe'));
alter table public.payout_line_items drop constraint payout_line_items_kind_check;
alter table public.payout_line_items add constraint payout_line_items_kind_check
  check (kind in ('earning','tip','tip_adjust','deposit_release','adjustment','order_hold','hold_release','carry_in','transfer_reversal'));
alter table public.payout_line_items drop constraint payout_line_items_check;
alter table public.payout_line_items add constraint payout_line_items_check
  check ((kind in ('earning','tip','deposit_release','hold_release','transfer_reversal') and amount_usd_cents >= 0)
    or (kind='order_hold' and amount_usd_cents < 0) or (kind='tip_adjust' and amount_usd_cents <> 0)
    or kind in ('adjustment','carry_in'));

-- ---- helpers ----------------------------------------------------------------------------------

-- Status shown to teammates and admins, from the facts Stripe reports on the account:
-- ready: transfers active and payouts enabled; not_started: onboarding not submitted yet;
-- restricted: Stripe disabled the account or needs more information; pending: submitted, Stripe
-- is still verifying.
create function public.connect_account_status(p_details_submitted boolean,p_payouts_enabled boolean,p_transfers_active boolean,
  p_disabled_reason text,p_requirements_due integer) returns text
language sql immutable security invoker set search_path='' as $$
  select case
    when p_disabled_reason like 'rejected%' then 'restricted'
    when p_transfers_active and p_payouts_enabled then 'ready'
    when not p_details_submitted then 'not_started'
    when coalesce(p_requirements_due,0)>0 or (p_disabled_reason is not null and p_disabled_reason<>'requirements.pending_verification') then 'restricted'
    else 'pending' end;
$$;

create function public.payout_line_transfer_pending(p_line_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.payout_transfers t where t.line_id=p_line_id and t.state='pending');
$$;

create function public.connect_status_dto(p_teammate uuid) returns jsonb
language sql stable security definer set search_path='' as $$
  select case when c.teammate_id is null then pg_catalog.jsonb_build_object('status','not_started','account',false)
    else pg_catalog.jsonb_build_object('status',c.status,'account',true,'country',c.country,
      'detailsSubmitted',c.details_submitted,'payoutsEnabled',c.payouts_enabled,'requirementsDue',c.requirements_due,
      'payoutFailed',c.payout_failed_at is not null,
      'syncedAt',case when c.synced_at is null then null else public.payout_ms(c.synced_at) end) end
  from (select 1) x left join public.teammate_connect_accounts c on c.teammate_id=p_teammate;
$$;

create function public.payout_transfer_dto(p_line_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
  select pg_catalog.jsonb_build_object('id',t.id,'state',t.state,'transferId',t.stripe_transfer_id,'currency',pg_catalog.upper(t.currency),
    'amount',t.amount_minor/100.0,'fx',t.fx_eur_usd,'reversed',t.amount_reversed_minor/100.0,'error',t.error,'attempt',t.attempt,
    'at',public.payout_ms(t.created_at))
  from public.payout_transfers t where t.line_id=p_line_id order by t.attempt desc limit 1;
$$;

-- ---- Connect accounts (service role only) -----------------------------------------------------

-- Server: the teammate's Connect account (null when none yet).
create function public.connect_account_for(p_teammate uuid) returns jsonb
language sql stable security definer set search_path='' as $$
  select case when c.teammate_id is null then null else pg_catalog.jsonb_build_object('accountId',c.stripe_account_id,
    'country',c.country,'status',c.status,'detailsSubmitted',c.details_submitted) end
  from (select 1) x left join public.teammate_connect_accounts c on c.teammate_id=p_teammate;
$$;

-- Server: links the Express account it just created to a teammate. A teammate keeps their first
-- account; a second, different account id is refused.
create function public.connect_account_link(p_teammate uuid,p_account_id text,p_country text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v public.teammate_connect_accounts;
begin
  if p_account_id is null or p_account_id!~'^acct_[A-Za-z0-9]+$' or p_country is null or p_country!~'^[A-Z]{2}$' then
    raise exception 'invalid connect account'; end if;
  if not exists(select 1 from public.account_roles where user_id=p_teammate and role='teammate') then
    return public.order_error(403,'Teammate role required.'); end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('duoly.connect.'||p_teammate::text,0));
  select c.* into v from public.teammate_connect_accounts c where c.teammate_id=p_teammate;
  if v.teammate_id is not null then
    if v.stripe_account_id<>p_account_id then return public.order_error(409,'You already started Stripe payouts setup.'); end if;
    return pg_catalog.jsonb_build_object('linked',false,'connect',public.connect_status_dto(p_teammate));
  end if;
  insert into public.teammate_connect_accounts(teammate_id,stripe_account_id,country) values(p_teammate,p_account_id,p_country);
  perform public.admin_log(p_teammate,public.payout_person(p_teammate),'Started Stripe payouts setup',public.payout_person(p_teammate),
    'Stripe Express account '||p_account_id||' · '||p_country);
  return pg_catalog.jsonb_build_object('linked',true,'connect',public.connect_status_dto(p_teammate));
end $$;

-- Server: stores what Stripe reports for an account (account.updated or a re-read after onboarding).
-- Idempotent; the status is derived here so every caller agrees.
create function public.connect_account_sync(p_account_id text,p_details_submitted boolean,p_payouts_enabled boolean,
  p_transfers_active boolean,p_disabled_reason text,p_requirements_due integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v public.teammate_connect_accounts; v_status text;
begin
  if p_account_id is null or p_account_id!~'^acct_[A-Za-z0-9]+$' or p_details_submitted is null or p_payouts_enabled is null
    or p_transfers_active is null or p_requirements_due is null or p_requirements_due<0 then raise exception 'invalid connect sync'; end if;
  select c.* into v from public.teammate_connect_accounts c where c.stripe_account_id=p_account_id for update;
  if v.teammate_id is null then return pg_catalog.jsonb_build_object('updated',false,'reason','unknown_account'); end if;
  v_status:=public.connect_account_status(p_details_submitted,p_payouts_enabled,p_transfers_active,p_disabled_reason,least(p_requirements_due,500));
  update public.teammate_connect_accounts set status=v_status,details_submitted=p_details_submitted,payouts_enabled=p_payouts_enabled,
    transfers_active=p_transfers_active,disabled_reason=pg_catalog.left(p_disabled_reason,120),requirements_due=least(p_requirements_due,500),
    payout_failed_at=case when p_payouts_enabled and not v.payouts_enabled then null else payout_failed_at end,
    payout_failure=case when p_payouts_enabled and not v.payouts_enabled then null else payout_failure end,
    synced_at=pg_catalog.clock_timestamp(),updated_at=pg_catalog.clock_timestamp() where teammate_id=v.teammate_id;
  if v_status<>v.status then
    perform public.admin_log(null,'Stripe','Stripe payouts status changed',public.payout_person(v.teammate_id),
      p_account_id||' · '||v.status||' to '||v_status||coalesce(' · '||p_disabled_reason,''));
  end if;
  return pg_catalog.jsonb_build_object('updated',true,'status',v_status,'teammateId',v.teammate_id,'changed',v_status<>v.status);
end $$;

-- Server: a payout from the connected account to the teammate's bank failed (Connect webhook
-- payout.failed). The money stays in their Stripe balance; Stripe asks them to fix their bank details.
create function public.connect_payout_failed(p_account_id text,p_payout_id text,p_failure text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v public.teammate_connect_accounts;
begin
  if p_account_id is null or p_account_id!~'^acct_[A-Za-z0-9]+$' or p_payout_id is null or p_payout_id!~'^po_[A-Za-z0-9]+$' then
    raise exception 'invalid connect payout'; end if;
  select c.* into v from public.teammate_connect_accounts c where c.stripe_account_id=p_account_id for update;
  if v.teammate_id is null then return pg_catalog.jsonb_build_object('updated',false,'reason','unknown_account'); end if;
  update public.teammate_connect_accounts set payout_failed_at=pg_catalog.clock_timestamp(),
    payout_failure=pg_catalog.left(coalesce(nullif(pg_catalog.btrim(p_failure),''),'unknown'),120),updated_at=pg_catalog.clock_timestamp()
    where teammate_id=v.teammate_id;
  perform public.admin_log(null,'Stripe','Stripe bank payout failed',public.payout_person(v.teammate_id),
    p_account_id||' · '||p_payout_id||' · '||coalesce(nullif(pg_catalog.btrim(p_failure),''),'unknown'));
  return pg_catalog.jsonb_build_object('updated',true,'teammateId',v.teammate_id);
end $$;

-- Teammate desk: their own Stripe payouts status. Read only; the server adds whether Connect is on.
create function public.teammate_connect_status() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();
begin
  if v_actor is null then return public.order_error(401,'Authentication required.'); end if;
  if not exists(select 1 from public.account_roles where user_id=v_actor and role='teammate') then return public.order_error(403,'Teammate role required.'); end if;
  return pg_catalog.jsonb_build_object('connect',public.connect_status_dto(v_actor),'details',public.payout_details_complete(v_actor));
end $$;

-- ---- Stripe transfers (service role only) -----------------------------------------------------

-- Server, step 1 of "Pay via Stripe": checks every payout rule and locks the line with a pending
-- transfer row holding the exact amount, currency, rate and idempotency key. Pressing the button
-- again while a transfer is pending returns that same row, so the retry cannot pay twice.
create function public.payout_stripe_prepare(p_line_id uuid,p_actor uuid,p_currency text,p_fx numeric,p_fx_source text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_line public.payout_lines; v_t public.payout_transfers; v_c public.teammate_connect_accounts; v_total bigint; v_minor bigint; v_attempt integer;
begin
  if p_actor is null or not exists(select 1 from public.account_roles where user_id=p_actor and role='admin') then
    return public.order_error(403,'Admins only.'); end if;
  if p_currency is null or p_currency not in ('eur','usd') then raise exception 'invalid transfer currency'; end if;
  if p_currency='eur' and (p_fx is null or p_fx not between 0.5 and 2 or p_fx_source is distinct from 'ecb') then raise exception 'invalid transfer rate'; end if;
  select l.* into v_line from public.payout_lines l where l.id=p_line_id for update;
  if v_line.id is null then return public.order_error(404,'Payout not found.'); end if;
  select t.* into v_t from public.payout_transfers t where t.line_id=v_line.id and t.state='pending';
  if v_t.id is not null then
    return pg_catalog.jsonb_build_object('transfer',pg_catalog.jsonb_build_object('id',v_t.id,'lineId',v_t.line_id,'accountId',v_t.stripe_account_id,
      'currency',v_t.currency,'amountMinor',v_t.amount_minor,'amountUsdCents',v_t.amount_usd_cents,'idempotencyKey',v_t.idempotency_key,
      'teammate',public.payout_person(v_t.teammate_id),'week',pg_catalog.to_char(v_line.week_start at time zone 'Europe/Vienna','YYYY-MM-DD'),'resumed',true));
  end if;
  if v_line.status='paid' then return public.order_error(409,'This payout was already paid.'); end if;
  if v_line.status='on_hold' then return public.order_error(409,'Release the hold first.'); end if;
  if v_line.status='carried' then return public.order_error(409,'This week was below the $10 minimum and moved to the next week.'); end if;
  v_total:=public.payout_line_total(v_line.id);
  if v_total<1000 then return public.order_error(409,'Below the $10 minimum. It stays owed until it reaches $10.'); end if;
  if not public.payout_details_complete(v_line.teammate_id) then
    return public.order_error(409,public.payout_person(v_line.teammate_id)||' has not added their payout details yet. The money stays owed.'); end if;
  select c.* into v_c from public.teammate_connect_accounts c where c.teammate_id=v_line.teammate_id;
  if v_c.teammate_id is null or v_c.status<>'ready' then
    return public.order_error(409,public.payout_person(v_line.teammate_id)||' has no ready Stripe account. Pay this one manually.'); end if;
  v_minor:=case when p_currency='usd' then v_total else pg_catalog.round(v_total::numeric/p_fx)::bigint end;
  if v_minor<=0 then return public.order_error(409,'Nothing to transfer.'); end if;
  select coalesce(pg_catalog.max(t.attempt),0)+1 into v_attempt from public.payout_transfers t where t.line_id=v_line.id;
  insert into public.payout_transfers(line_id,teammate_id,stripe_account_id,attempt,idempotency_key,amount_usd_cents,currency,amount_minor,fx_eur_usd,fx_source,created_by)
    values(v_line.id,v_line.teammate_id,v_c.stripe_account_id,v_attempt,'duoly-payout-'||v_line.id::text||'-'||v_attempt::text,v_total,p_currency,v_minor,
      case when p_currency='eur' then p_fx end,case when p_currency='eur' then p_fx_source end,p_actor)
    returning * into v_t;
  perform public.admin_log(p_actor,public.payout_person(p_actor),'Started Stripe payout',public.payout_person(v_line.teammate_id),
    public.payout_money(v_total)||' · week of '||pg_catalog.to_char(v_line.week_start at time zone 'Europe/Vienna','YYYY-MM-DD')||' · '
    ||pg_catalog.upper(p_currency)||' '||pg_catalog.to_char(v_minor/100.0,'FM999999990.00')
    ||case when p_currency='eur' then ' at ECB '||p_fx::text else '' end||' · attempt '||v_attempt);
  return pg_catalog.jsonb_build_object('transfer',pg_catalog.jsonb_build_object('id',v_t.id,'lineId',v_t.line_id,'accountId',v_t.stripe_account_id,
    'currency',v_t.currency,'amountMinor',v_t.amount_minor,'amountUsdCents',v_t.amount_usd_cents,'idempotencyKey',v_t.idempotency_key,
    'teammate',public.payout_person(v_t.teammate_id),'week',pg_catalog.to_char(v_line.week_start at time zone 'Europe/Vienna','YYYY-MM-DD'),'resumed',false));
end $$;

-- Server, step 2: Stripe created the transfer (API answer or transfer.created webhook). Marks the
-- transfer and its line paid once; a replay with the same transfer id is a no-op.
create function public.payout_stripe_record(p_transfer_id uuid,p_stripe_transfer_id text,p_destination text,p_amount_minor bigint,p_currency text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_t public.payout_transfers; v_line public.payout_lines;
begin
  if p_stripe_transfer_id is null or p_stripe_transfer_id!~'^tr_[A-Za-z0-9]+$' then raise exception 'invalid transfer id'; end if;
  select t.* into v_t from public.payout_transfers t where t.id=p_transfer_id for update;
  if v_t.id is null then return pg_catalog.jsonb_build_object('recorded',false,'reason','unknown_transfer'); end if;
  if v_t.state in ('paid','reversed') then
    return pg_catalog.jsonb_build_object('recorded',false,'reason',case when v_t.stripe_transfer_id=p_stripe_transfer_id then 'already_recorded' else 'other_transfer' end,
      'lineId',v_t.line_id);
  end if;
  if p_destination is distinct from v_t.stripe_account_id or p_amount_minor is distinct from v_t.amount_minor or p_currency is distinct from v_t.currency then
    update public.payout_transfers set error='Stripe transfer does not match the prepared amount, currency or account',updated_at=pg_catalog.clock_timestamp() where id=v_t.id;
    perform public.admin_log(null,'Stripe','Stripe payout mismatch',public.payout_person(v_t.teammate_id),p_stripe_transfer_id||' · check it in Stripe');
    return pg_catalog.jsonb_build_object('recorded',false,'reason','mismatch','lineId',v_t.line_id);
  end if;
  -- A failed attempt can still be confirmed late by Stripe (for example after a timeout): it is
  -- then the line's payment, unless another attempt already paid the line.
  if v_t.state='failed' and exists(select 1 from public.payout_transfers t where t.line_id=v_t.line_id and t.id<>v_t.id and t.state in ('pending','paid','reversed')) then
    perform public.admin_log(null,'Stripe','Stripe payout needs review',public.payout_person(v_t.teammate_id),
      p_stripe_transfer_id||' arrived for an attempt that was replaced · reverse one transfer in Stripe');
    return pg_catalog.jsonb_build_object('recorded',false,'reason','superseded','lineId',v_t.line_id);
  end if;
  select l.* into v_line from public.payout_lines l where l.id=v_t.line_id for update;
  update public.payout_transfers set state='paid',stripe_transfer_id=p_stripe_transfer_id,error=null,updated_at=pg_catalog.clock_timestamp() where id=v_t.id;
  if v_line.status not in ('scheduled','on_hold') then
    -- Only reachable for a late confirmation of a failed attempt: the line was paid by hand or
    -- carried meanwhile. The money left once; a person has to reverse one side in Stripe.
    perform public.admin_log(null,'Stripe','Stripe payout needs review',public.payout_person(v_t.teammate_id),
      p_stripe_transfer_id||' arrived for a payout that is already '||v_line.status||' · reverse it in Stripe if it was paid twice');
    return pg_catalog.jsonb_build_object('recorded',true,'lineId',v_line.id,'review',true);
  end if;
  update public.payout_lines set status='paid',hold_reason=null,held_by=null,held_at=null,paid_at=pg_catalog.clock_timestamp(),paid_by=v_t.created_by,
    paid_method='stripe',paid_reference=p_stripe_transfer_id,paid_usd_cents=v_t.amount_usd_cents,updated_at=pg_catalog.clock_timestamp()
    where id=v_line.id;
  perform public.admin_log(v_t.created_by,public.payout_person(v_t.created_by),'Paid payout with Stripe',public.payout_person(v_t.teammate_id),
    public.payout_money(v_t.amount_usd_cents)||' · week of '||pg_catalog.to_char(v_line.week_start at time zone 'Europe/Vienna','YYYY-MM-DD')||' · '
    ||pg_catalog.upper(v_t.currency)||' '||pg_catalog.to_char(v_t.amount_minor/100.0,'FM999999990.00')||' · '||p_stripe_transfer_id);
  return pg_catalog.jsonb_build_object('recorded',true,'lineId',v_line.id);
end $$;

-- Server: Stripe definitely refused the transfer (4xx). The line stays scheduled and can be paid again.
create function public.payout_stripe_fail(p_transfer_id uuid,p_error text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_t public.payout_transfers;
begin
  select t.* into v_t from public.payout_transfers t where t.id=p_transfer_id for update;
  if v_t.id is null then return pg_catalog.jsonb_build_object('updated',false,'reason','unknown_transfer'); end if;
  if v_t.state<>'pending' then return pg_catalog.jsonb_build_object('updated',false,'reason',v_t.state); end if;
  update public.payout_transfers set state='failed',error=pg_catalog.left(coalesce(nullif(pg_catalog.btrim(p_error),''),'Stripe refused the transfer'),300),
    updated_at=pg_catalog.clock_timestamp() where id=v_t.id;
  perform public.admin_log(v_t.created_by,public.payout_person(v_t.created_by),'Stripe payout failed',public.payout_person(v_t.teammate_id),
    public.payout_money(v_t.amount_usd_cents)||' · attempt '||v_t.attempt||' · '||pg_catalog.left(coalesce(nullif(pg_catalog.btrim(p_error),''),'refused'),200));
  return pg_catalog.jsonb_build_object('updated',true,'lineId',v_t.line_id);
end $$;

-- Server: transfer.reversed. p_reversed_minor is Stripe's total amount_reversed, so replays and
-- out-of-order events converge. The reversed share (in the line's USD) is owed again and counted in
-- the payout week it is recorded in. The paid line itself stays as it was (history).
create function public.payout_stripe_reversal(p_stripe_transfer_id text,p_reversed_minor bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_t public.payout_transfers; v_new bigint; v_usd_total bigint; v_usd_before bigint; v_usd bigint;
begin
  if p_stripe_transfer_id is null or p_stripe_transfer_id!~'^tr_[A-Za-z0-9]+$' or p_reversed_minor is null or p_reversed_minor<0 then
    raise exception 'invalid transfer reversal'; end if;
  select t.* into v_t from public.payout_transfers t where t.stripe_transfer_id=p_stripe_transfer_id for update;
  if v_t.id is null then return pg_catalog.jsonb_build_object('updated',false,'reason','unknown_transfer'); end if;
  v_new:=least(v_t.amount_minor,greatest(v_t.amount_reversed_minor,p_reversed_minor));
  if v_new=v_t.amount_reversed_minor then return pg_catalog.jsonb_build_object('updated',false,'reason','unchanged','state',v_t.state); end if;
  v_usd_total:=case when v_new=v_t.amount_minor then v_t.amount_usd_cents else pg_catalog.round(v_t.amount_usd_cents::numeric*v_new/v_t.amount_minor)::bigint end;
  select coalesce(pg_catalog.sum(r.amount_usd_cents),0) into v_usd_before from public.payout_transfer_reversals r where r.transfer_id=v_t.id;
  v_usd:=greatest(0,v_usd_total-v_usd_before);
  insert into public.payout_transfer_reversals(transfer_id,teammate_id,amount_minor,amount_usd_cents)
    values(v_t.id,v_t.teammate_id,v_new-v_t.amount_reversed_minor,v_usd);
  update public.payout_transfers set amount_reversed_minor=v_new,state=case when v_new=amount_minor then 'reversed' else state end,
    updated_at=pg_catalog.clock_timestamp() where id=v_t.id returning * into v_t;
  perform public.admin_log(null,'Stripe','Stripe payout reversed',public.payout_person(v_t.teammate_id),
    p_stripe_transfer_id||' · '||pg_catalog.upper(v_t.currency)||' '||pg_catalog.to_char(v_new/100.0,'FM999999990.00')||' of '
    ||pg_catalog.to_char(v_t.amount_minor/100.0,'FM999999990.00')||' reversed · '||public.payout_money(v_usd)||' owed again in the next payout week');
  return pg_catalog.jsonb_build_object('updated',true,'state',v_t.state,'owedUsdCents',v_usd);
end $$;

-- ---- replaced payout functions ----------------------------------------------------------------

-- Latest definition 20261026100000_order_tips.sql; adds transfer reversals as a source.
create or replace function public.payout_freeze_week(p_start timestamptz) returns integer
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
      union select tp.teammate_id from public.order_tips tp
       where tp.paid_at<v_end and public.tip_payable_usd(tp)>0 and not exists(select 1 from public.payout_line_items i where i.kind='tip' and i.source_id=tp.id)
      union select m.teammate_id from public.order_tip_movements m
       where m.created_at<v_end and not exists(select 1 from public.payout_line_items i where i.kind='tip_adjust' and i.source_id=m.id)
      union select rv.teammate_id from public.payout_transfer_reversals rv
       where rv.created_at<v_end and not exists(select 1 from public.payout_line_items i where i.kind='transfer_reversal' and i.source_id=rv.id)
    ) t order by t.teammate_id
  loop
    insert into public.payout_lines(teammate_id,week_start,week_end,status) values(v_tm,p_start,v_end,'scheduled') returning id into v_line;
    insert into public.payout_line_items(line_id,kind,source_id,amount_usd_cents,gross_usd_cents,held_usd_cents)
      select v_line,'earning',e.order_id,e.net_usd_cents,e.payout_usd_cents,e.held_usd_cents from public.teammate_earning_entries e
       where e.teammate_id=v_tm and e.completed_at<v_end and not exists(select 1 from public.payout_line_items i where i.kind='earning' and i.source_id=e.order_id);
    insert into public.payout_line_items(line_id,kind,source_id,amount_usd_cents)
      select v_line,'tip',tp.id,public.tip_payable_usd(tp) from public.order_tips tp
       where tp.teammate_id=v_tm and tp.paid_at<v_end and public.tip_payable_usd(tp)>0
         and not exists(select 1 from public.payout_line_items i where i.kind='tip' and i.source_id=tp.id);
    insert into public.payout_line_items(line_id,kind,source_id,amount_usd_cents)
      select v_line,'tip_adjust',m.id,m.amount_usd_cents from public.order_tip_movements m
       where m.teammate_id=v_tm and m.created_at<v_end and not exists(select 1 from public.payout_line_items i where i.kind='tip_adjust' and i.source_id=m.id);
    insert into public.payout_line_items(line_id,kind,source_id,amount_usd_cents)
      select v_line,'transfer_reversal',rv.id,rv.amount_usd_cents from public.payout_transfer_reversals rv
       where rv.teammate_id=v_tm and rv.created_at<v_end and not exists(select 1 from public.payout_line_items i where i.kind='transfer_reversal' and i.source_id=rv.id);
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

-- Latest definition 20261026100000_order_tips.sql; reversed transfers count like adjustments
-- (added to 'adjust' so every consumer's total stays correct) and are listed under 'reversals'.
create or replace function public.payout_pending(p_teammate uuid,p_now timestamptz) returns jsonb
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
  c as (select public.payout_line_total(l.id) total from public.payout_lines l where l.teammate_id=p_teammate and l.status='carried' and l.carried_to is null),
  tp as (select public.tip_payable_usd(x) usd from public.order_tips x where x.teammate_id=p_teammate and x.paid_at<p_now and public.tip_payable_usd(x)>0
         and not exists(select 1 from public.payout_line_items i where i.kind='tip' and i.source_id=x.id)),
  tm as (select m.amount_usd_cents usd from public.order_tip_movements m where m.teammate_id=p_teammate and m.created_at<p_now
         and not exists(select 1 from public.payout_line_items i where i.kind='tip_adjust' and i.source_id=m.id)),
  rv as (select x.amount_usd_cents usd,x.created_at from public.payout_transfer_reversals x where x.teammate_id=p_teammate and x.created_at<p_now
         and not exists(select 1 from public.payout_line_items i where i.kind='transfer_reversal' and i.source_id=x.id))
  select pg_catalog.jsonb_build_object(
    'orders',(select pg_catalog.count(*) from e),
    'gross',coalesce((select pg_catalog.sum(payout_usd_cents) from e),0),
    'held',coalesce((select pg_catalog.sum(held_usd_cents) from e),0),
    'net',coalesce((select pg_catalog.sum(net_usd_cents) from e),0),
    'tips',coalesce((select pg_catalog.sum(usd) from tp),0)+coalesce((select pg_catalog.sum(usd) from tm),0),
    'released',coalesce((select pg_catalog.sum(held_usd_cents) from r),0),
    'adjust',coalesce((select pg_catalog.sum(amount_usd_cents) from a),0)+coalesce((select pg_catalog.sum(usd) from rv),0),
    'reversals',coalesce((select pg_catalog.sum(usd) from rv),0),
    'holdReleased',coalesce((select pg_catalog.sum(amount_usd_cents) from h),0),
    'carried',coalesce((select pg_catalog.sum(total) from c),0),
    'autoHeld',coalesce((select pg_catalog.sum(net_usd_cents) from e where public.payout_order_blocked(e.order_id)),0),
    'adjustments',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('amount',a.amount_usd_cents/100.0,'reason',a.reason,
       'by',public.payout_person(a.created_by),'at',public.payout_ms(a.created_at)) order by a.created_at) from a),'[]'::jsonb)
      ||coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('amount',rv.usd/100.0,'reason','Stripe transfer reversed, owed again',
       'by','Stripe','at',public.payout_ms(rv.created_at)) order by rv.created_at) from rv where rv.usd>0),'[]'::jsonb),
    'active',exists(select 1 from e) or exists(select 1 from r) or exists(select 1 from a) or exists(select 1 from h) or exists(select 1 from c)
      or exists(select 1 from tp) or exists(select 1 from tm) or exists(select 1 from rv));
$$;

-- Latest definition 20261026100000_order_tips.sql; reversals are part of 'adjust' and the line
-- carries its latest Stripe transfer ('transfer', null on the manual rail).
create or replace function public.payout_line_dto(p_line_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
  with l as (select * from public.payout_lines where id=p_line_id),
  s as (select
    pg_catalog.count(*) filter(where i.kind='earning') orders,
    coalesce(pg_catalog.sum(i.gross_usd_cents) filter(where i.kind='earning'),0) gross,
    coalesce(pg_catalog.sum(i.held_usd_cents) filter(where i.kind='earning'),0) held,
    coalesce(pg_catalog.sum(i.amount_usd_cents) filter(where i.kind='earning'),0) net,
    coalesce(pg_catalog.sum(i.amount_usd_cents) filter(where i.kind in ('tip','tip_adjust')),0) tips,
    coalesce(pg_catalog.sum(i.amount_usd_cents) filter(where i.kind='deposit_release'),0) released,
    coalesce(pg_catalog.sum(i.amount_usd_cents) filter(where i.kind in ('adjustment','transfer_reversal')),0) adjust,
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
       from public.payout_line_items i join public.teammate_adjustments a on a.id=i.source_id where i.line_id=l.id and i.kind='adjustment'),'[]'::jsonb)
      ||coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('amount',i.amount_usd_cents/100.0,'reason','Stripe transfer reversed, owed again',
       'by','Stripe','at',public.payout_ms(i.created_at)) order by i.created_at)
       from public.payout_line_items i where i.line_id=l.id and i.kind='transfer_reversal' and i.amount_usd_cents>0),'[]'::jsonb),
    'status',case l.status when 'scheduled' then 'Scheduled' when 'on_hold' then 'On hold' when 'paid' then 'Paid' else 'Carried' end,
    'reason',coalesce(l.hold_reason,''),'paidAt',case when l.paid_at is null then null else public.payout_ms(l.paid_at) end,
    'method',l.paid_method,'reference',l.paid_reference,'transfer',public.payout_transfer_dto(l.id))
  from l,s;
$$;

-- Latest definition 20261025250000_weekly_payouts.sql; adds the teammate's Stripe payouts status.
create or replace function public.payout_teammate_dto(p_teammate uuid) returns jsonb
language sql stable security definer set search_path='' as $$
  select pg_catalog.jsonb_build_object(
    'teammate',coalesce(nullif(p.name,'Player'),u.email,'Teammate'),'av',coalesce(nullif(p.image,''),'/assets/avatars/avatar-1.png'),
    'email',coalesce(u.email,''),'country',coalesce(d.country,p.country,''),'legalName',coalesce(d.legal_name,''),
    'payoutMethod',coalesce(d.payout_method,''),'details',d.teammate_id is not null,
    'tier',pg_catalog.initcap(public.completion_trust(public.payout_valid_count(p_teammate))->>'trust_tier'),
    'deposit',(public.completion_trust(public.payout_valid_count(p_teammate))->>'deposit_percent')::integer,
    'connect',coalesce(c.status,'not_started'),'connectCountry',c.country)
  from auth.users u left join public.profiles p on p.id=u.id left join public.teammate_payout_details d on d.teammate_id=u.id
    left join public.teammate_connect_accounts c on c.teammate_id=u.id
  where u.id=p_teammate;
$$;

-- Latest definition 20261026100000_order_tips.sql; adds reversals to the running-week teammate list.
create or replace function public.admin_payouts() returns jsonb
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
      union select l.teammate_id from public.payout_lines l where l.status='carried' and l.carried_to is null
      union select tp.teammate_id from public.order_tips tp where tp.paid_at is not null and not exists(select 1 from public.payout_line_items i where i.kind='tip' and i.source_id=tp.id)
      union select m.teammate_id from public.order_tip_movements m where not exists(select 1 from public.payout_line_items i where i.kind='tip_adjust' and i.source_id=m.id)
      union select rv.teammate_id from public.payout_transfer_reversals rv where not exists(select 1 from public.payout_line_items i where i.kind='transfer_reversal' and i.source_id=rv.id)) t loop
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
      'adjustments',v_p->'adjustments','status','Accruing','reason','','paidAt',null,'method',null,'reference',null,'transfer',null));
  end loop;
  return pg_catalog.jsonb_build_object('now',public.payout_ms(v_now),'weekStart',public.payout_ms(v_start),'minimum',10,
    'payouts',v_rows,
    'teammates',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id',r.user_id,'name',coalesce(nullif(p.name,'Player'),u.email,'Teammate'),'email',coalesce(u.email,''))
      order by pg_catalog.lower(coalesce(nullif(p.name,'Player'),u.email,''))) from public.account_roles r join auth.users u on u.id=r.user_id left join public.profiles p on p.id=r.user_id where r.role='teammate'),'[]'::jsonb));
end $$;

-- Latest definition 20261025250000_weekly_payouts.sql; a line with a pending Stripe transfer cannot
-- be marked paid by hand (pay and pay all).
create or replace function public.payout_pay_locked(v_line public.payout_lines,p_actor uuid,p_method text,p_reference text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_total bigint;
begin
  if v_line.status='paid' then return public.order_error(409,'This payout was already paid.'); end if;
  if v_line.status='on_hold' then return public.order_error(409,'Release the hold first.'); end if;
  if v_line.status='carried' then return public.order_error(409,'This week was below the $10 minimum and moved to the next week.'); end if;
  if public.payout_line_transfer_pending(v_line.id) then
    return public.order_error(409,'A Stripe transfer for this payout is still pending. Retry it with Pay via Stripe.'); end if;
  v_total:=public.payout_line_total(v_line.id);
  if v_total<1000 then return public.order_error(409,'Below the $10 minimum. It stays owed until it reaches $10.'); end if;
  if not public.payout_details_complete(v_line.teammate_id) then
    return public.order_error(409,public.payout_person(v_line.teammate_id)||' has not added their payout details yet. The money stays owed.'); end if;
  update public.payout_lines set status='paid',paid_at=pg_catalog.clock_timestamp(),paid_by=p_actor,paid_method=p_method,
    paid_reference=p_reference,paid_usd_cents=v_total,updated_at=pg_catalog.clock_timestamp() where id=v_line.id;
  return null;
end $$;

-- Latest definition 20261025250000_weekly_payouts.sql; a line with a pending Stripe transfer cannot be held.
create or replace function public.admin_payout_hold(p_line_id uuid,p_reason text) returns jsonb
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
  if public.payout_line_transfer_pending(v_line.id) then return public.order_error(409,'A Stripe transfer for this payout is still pending.'); end if;
  update public.payout_lines set status='on_hold',hold_reason=v_reason,held_by=v_actor,held_at=pg_catalog.clock_timestamp(),updated_at=pg_catalog.clock_timestamp() where id=v_line.id;
  perform public.admin_log(v_actor,v_name,'Held payout',public.payout_person(v_line.teammate_id),
    public.payout_money(public.payout_line_total(v_line.id))||' · week of '||pg_catalog.to_char(v_line.week_start at time zone 'Europe/Vienna','YYYY-MM-DD')||' · '||v_reason);
  return pg_catalog.jsonb_build_object('ok',true,'payout',public.payout_line_dto(v_line.id)||public.payout_teammate_dto(v_line.teammate_id));
end $$;

-- Latest definition 20261025250000_weekly_payouts.sql. A line with a pending Stripe transfer is
-- treated like a paid line: a new report does not change its amount (the transfer amount is fixed),
-- and a released hold goes into the next payout week instead of into that line.
create or replace function public.payout_refresh_order_hold(p_order_id uuid) returns text
language plpgsql security definer set search_path='' as $$
declare v_line public.payout_lines; v_item public.payout_line_items; v_hold public.payout_order_holds; v_id uuid; v_ref text; v_open boolean;
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
    if public.payout_line_transfer_pending(v_line.id) then return 'processing'; end if;
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
  v_open:=v_line.status in ('scheduled','on_hold') and not public.payout_line_transfer_pending(v_line.id);
  update public.payout_order_holds set released_at=pg_catalog.clock_timestamp(),release_reason='Report or Stripe dispute closed' where id=v_hold.id;
  if v_open then
    insert into public.payout_line_items(line_id,kind,source_id,amount_usd_cents) values(v_line.id,'hold_release',v_hold.id,v_hold.amount_usd_cents);
    update public.payout_lines set updated_at=pg_catalog.clock_timestamp() where id=v_line.id;
  end if;
  perform public.admin_log(null,'Duoly','Released auto-held amount',public.payout_person(v_hold.teammate_id),
    coalesce(v_ref,'Order')||' · '||public.payout_money(v_hold.amount_usd_cents)||case when v_open then ' back into the same payout' else ' into the next payout week' end);
  return 'released';
end $$;

-- New: "Pay all scheduled" while Stripe payouts are on. Same rules as admin_payout_pay_all, but lines
-- of teammates with a ready Stripe account (paid with Pay via Stripe) and lines with a pending transfer
-- are skipped, so a manual batch never marks a Stripe payout paid by mistake.
create function public.admin_payout_pay_all_manual(p_method text,p_reference text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_actor uuid; v_name text; v_line public.payout_lines; v_ref text:=pg_catalog.btrim(coalesce(p_reference,'')); v_paid integer:=0; v_skipped integer:=0; v_stripe integer:=0; v_sum bigint:=0; v_err jsonb; v_total bigint;
begin
  select id,name into v_actor,v_name from public.admin_caller();
  if v_actor is null then return public.order_error(403,'Admins only.'); end if;
  if p_method is null or p_method not in ('bank','wise','paypal','other') then return public.order_error(400,'Pick how you paid.'); end if;
  if pg_catalog.char_length(v_ref) not between 1 and 120 then return public.order_error(400,'Add the transfer reference (up to 120 characters).'); end if;
  perform public.payout_freeze_due();
  for v_line in select l.* from public.payout_lines l where l.status='scheduled' order by l.week_start,l.id for update loop
    if exists(select 1 from public.teammate_connect_accounts c where c.teammate_id=v_line.teammate_id and c.status='ready')
      or public.payout_line_transfer_pending(v_line.id) then v_stripe:=v_stripe+1; continue; end if;
    v_total:=public.payout_line_total(v_line.id);
    v_err:=public.payout_pay_locked(v_line,v_actor,p_method,v_ref);
    if v_err is null then
      v_paid:=v_paid+1; v_sum:=v_sum+v_total;
      perform public.admin_log(v_actor,v_name,'Marked payout paid',public.payout_person(v_line.teammate_id),
        public.payout_money(v_total)||' · week of '||pg_catalog.to_char(v_line.week_start at time zone 'Europe/Vienna','YYYY-MM-DD')||' · '||p_method||' · '||v_ref||' · pay all');
    else v_skipped:=v_skipped+1; end if;
  end loop;
  perform public.admin_log(v_actor,v_name,'Paid all scheduled payouts',v_paid||' payouts',public.payout_money(v_sum)||' · '||v_skipped||' skipped · '
    ||v_stripe||' left for Stripe · '||p_method||' · '||v_ref);
  return pg_catalog.jsonb_build_object('ok',true,'paid',v_paid,'skipped',v_skipped,'stripe',v_stripe,'total',v_sum/100.0);
end $$;

-- ---- grants -----------------------------------------------------------------------------------

revoke all on function
  public.connect_account_status(boolean,boolean,boolean,text,integer),public.payout_line_transfer_pending(uuid),
  public.connect_status_dto(uuid),public.payout_transfer_dto(uuid),
  public.connect_account_for(uuid),public.connect_account_link(uuid,text,text),
  public.connect_account_sync(text,boolean,boolean,boolean,text,integer),public.connect_payout_failed(text,text,text),
  public.teammate_connect_status(),public.admin_payout_pay_all_manual(text,text),
  public.payout_stripe_prepare(uuid,uuid,text,numeric,text),public.payout_stripe_record(uuid,text,text,bigint,text),
  public.payout_stripe_fail(uuid,text),public.payout_stripe_reversal(text,bigint)
  from public,anon,authenticated,service_role;
grant execute on function public.teammate_connect_status(),public.admin_payout_pay_all_manual(text,text) to authenticated;
grant execute on function
  public.connect_account_for(uuid),public.connect_account_link(uuid,text,text),
  public.connect_account_sync(text,boolean,boolean,boolean,text,integer),public.connect_payout_failed(text,text,text),
  public.payout_stripe_prepare(uuid,uuid,text,numeric,text),public.payout_stripe_record(uuid,text,text,bigint,text),
  public.payout_stripe_fail(uuid,text),public.payout_stripe_reversal(text,bigint)
  to service_role;
-- create or replace keeps grants; restate the replaced ones so this file reads complete.
revoke all on function public.payout_freeze_week(timestamptz),public.payout_pending(uuid,timestamptz),public.payout_line_dto(uuid),
  public.payout_teammate_dto(uuid),public.payout_pay_locked(public.payout_lines,uuid,text,text),public.payout_refresh_order_hold(uuid)
  from public,anon,authenticated,service_role;
revoke all on function public.admin_payouts(),public.admin_payout_hold(uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.admin_payouts(),public.admin_payout_hold(uuid,text) to authenticated;

commit;
