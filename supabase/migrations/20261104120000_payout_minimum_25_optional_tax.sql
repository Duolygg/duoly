-- Teammate payouts: the weekly minimum goes from 10 USD to 25 USD, and the tax number becomes optional.
--
-- Minimum. Every rule stays as it is: a frozen week below the minimum (or negative) is Carried into the
-- next week, and only a Scheduled line at or above the minimum can be paid, manually or with Stripe.
-- The 10 USD literal lives inside six functions. Instead of copying their bodies (and risking drift from
-- what is live), this rewrites the live definitions in place: each one must contain the exact old
-- tokens, or the migration aborts. Weeks that were already Scheduled between 10 and 25 USD stay
-- Scheduled and payable: they were frozen under the old rule.
--   payout_freeze_week(timestamptz)        v_total<1000 -> v_total<2500
--   payout_refresh_order_hold(uuid)        payout_line_total(id)<1000 -> <2500
--   payout_pay_locked(payout_lines,...)    v_total<1000 and the $10 messages
--   payout_stripe_prepare(uuid,...)        v_total<1000 and the $10 messages
--   admin_payouts()                        'minimum',10 -> 'minimum',25
--   teammate_payout_summary(uuid)          'minimum',10 -> 'minimum',25
-- payout_lines.paid_usd_cents and payout_transfers.amount_usd_cents keep their >= 1000 checks; 2500 meets them.
--
-- Tax number. Empty is now allowed and stored as null; when given it must still be 2-40 characters.
-- payout_details_complete() only checks that the row exists, so payouts no longer wait for a tax number.
-- Replaces teammate_save_payout_details and teammate_payout_details from 20261025250000_weekly_payouts.sql.
begin;

do $$
declare
  v_fn regprocedure;
  v_def text;
  v_new text;
  v_rule text[];
  v_rules jsonb := pg_catalog.jsonb_build_object(
    'public.payout_freeze_week(timestamptz)',
      pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_array('v_total<1000','v_total<2500')),
    'public.payout_refresh_order_hold(uuid)',
      pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_array('public.payout_line_total(id)<1000','public.payout_line_total(id)<2500')),
    'public.payout_pay_locked(public.payout_lines,uuid,text,text)',
      pg_catalog.jsonb_build_array(
        pg_catalog.jsonb_build_array('v_total<1000','v_total<2500'),
        pg_catalog.jsonb_build_array('below the $10 minimum','below the $25 minimum'),
        pg_catalog.jsonb_build_array('Below the $10 minimum. It stays owed until it reaches $10.','Below the $25 minimum. It stays owed until it reaches $25.')),
    'public.payout_stripe_prepare(uuid,uuid,text,numeric,text)',
      pg_catalog.jsonb_build_array(
        pg_catalog.jsonb_build_array('v_total<1000','v_total<2500'),
        pg_catalog.jsonb_build_array('below the $10 minimum','below the $25 minimum'),
        pg_catalog.jsonb_build_array('Below the $10 minimum. It stays owed until it reaches $10.','Below the $25 minimum. It stays owed until it reaches $25.')),
    'public.admin_payouts()',
      pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_array('''minimum'',10,','''minimum'',25,')),
    'public.teammate_payout_summary(uuid)',
      pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_array('''minimum'',10,','''minimum'',25,'))
  );
  v_key text;
  v_pair jsonb;
begin
  for v_key in select pg_catalog.jsonb_object_keys(v_rules) loop
    v_fn := v_key::regprocedure;
    v_def := pg_catalog.pg_get_functiondef(v_fn);
    v_new := v_def;
    for v_pair in select pg_catalog.jsonb_array_elements(v_rules->v_key) loop
      v_rule := array[v_pair->>0, v_pair->>1];
      if pg_catalog.strpos(v_new, v_rule[1]) = 0 then
        raise exception '% does not contain "%"; check the live definition before raising the minimum', v_key, v_rule[1];
      end if;
      v_new := pg_catalog.replace(v_new, v_rule[1], v_rule[2]);
    end loop;
    if pg_catalog.strpos(v_new, '<1000') > 0 or pg_catalog.strpos(v_new, '$10 ') > 0 or pg_catalog.strpos(v_new, '''minimum'',10') > 0 then
      raise exception '% still mentions the 10 USD minimum after the rewrite', v_key;
    end if;
    execute v_new; -- pg_get_functiondef returns CREATE OR REPLACE, so owner and grants are kept
  end loop;
end $$;

-- ---- optional tax number ------------------------------------------------------------------------

alter table public.teammate_payout_details alter column tax_number drop not null;
alter table public.teammate_payout_details drop constraint teammate_payout_details_tax_number_check;
alter table public.teammate_payout_details add constraint teammate_payout_details_tax_number_check
  check (tax_number is null or (tax_number = pg_catalog.btrim(tax_number) and pg_catalog.char_length(tax_number) between 2 and 40));

-- Latest definition 20261025250000_weekly_payouts.sql; taxNumber is '' when none is on file.
create or replace function public.teammate_payout_details() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v public.teammate_payout_details;
begin
  if v_actor is null then return public.order_error(401,'Authentication required.'); end if;
  if not exists(select 1 from public.account_roles where user_id=v_actor and role='teammate') then return public.order_error(403,'Teammate role required.'); end if;
  select d.* into v from public.teammate_payout_details d where d.teammate_id=v_actor;
  return pg_catalog.jsonb_build_object('details',case when v.teammate_id is null then null else pg_catalog.jsonb_build_object(
    'legalName',v.legal_name,'address',v.address,'country',v.country,'dateOfBirth',pg_catalog.to_char(v.date_of_birth,'YYYY-MM-DD'),
    'taxNumber',coalesce(v.tax_number,''),'method',v.payout_method,'account',v.payout_account,'updatedAt',public.payout_ms(v.updated_at)) end);
end $$;

-- Latest definition 20261025250000_weekly_payouts.sql; an empty tax number is saved as null.
create or replace function public.teammate_save_payout_details(p_legal_name text,p_address text,p_country text,p_date_of_birth date,p_tax_number text,p_method text,p_account text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_name text:=pg_catalog.btrim(coalesce(p_legal_name,'')); v_address text:=pg_catalog.btrim(coalesce(p_address,''));
  v_country text:=pg_catalog.btrim(coalesce(p_country,'')); v_tax text:=nullif(pg_catalog.btrim(coalesce(p_tax_number,'')),''); v_account text:=pg_catalog.btrim(coalesce(p_account,''));
begin
  if v_actor is null then return public.order_error(401,'Authentication required.'); end if;
  if not exists(select 1 from public.account_roles where user_id=v_actor and role='teammate') then return public.order_error(403,'Teammate role required.'); end if;
  if pg_catalog.char_length(v_name) not between 2 and 120 then return public.order_error(400,'Add your full legal name.'); end if;
  if pg_catalog.char_length(v_address) not between 5 and 300 then return public.order_error(400,'Add your full address.'); end if;
  if pg_catalog.char_length(v_country) not between 2 and 56 then return public.order_error(400,'Add your country.'); end if;
  if p_date_of_birth is null or p_date_of_birth<date '1900-01-01' or p_date_of_birth>(current_date-interval '18 years')::date then
    return public.order_error(400,'Add your date of birth. You need to be 18 or older to be paid.'); end if;
  if v_tax is not null and pg_catalog.char_length(v_tax) not between 2 and 40 then
    return public.order_error(400,'Check your tax number, or leave it empty.'); end if;
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

-- create or replace keeps grants; restate them so this file reads complete.
revoke all on function public.teammate_payout_details(),public.teammate_save_payout_details(text,text,text,date,text,text,text)
  from public,anon,authenticated,service_role;
grant execute on function public.teammate_payout_details(),public.teammate_save_payout_details(text,text,text,date,text,text,text)
  to authenticated;

commit;
