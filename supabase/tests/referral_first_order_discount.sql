do $duoly_test_guard$
declare production_secret boolean := false;
begin
  if not exists (select 1 from pg_catalog.pg_namespace where nspname = 'duoly_test_marker') then
    raise exception 'refusing to run tests on production';
  end if;
  if pg_catalog.to_regclass('vault.secrets') is not null then
    execute 'select exists (select 1 from vault.secrets where name = ''payments_tick_secret'')' into production_secret;
  end if;
  if production_secret then
    raise exception 'refusing to run tests on production';
  end if;
end;
$duoly_test_guard$;

-- Rollback-only test for 20261025240000_referral_first_order_discount.sql (after the migration body).
begin;
do $$
declare
  v_new uuid := gen_random_uuid();
  v_old uuid;
  v_code text := 'TSTDISC' || pg_catalog.floor(pg_catalog.random() * 1000)::text;
  v_off text := 'TSTOFF' || pg_catalog.floor(pg_catalog.random() * 1000)::text;
begin
  insert into auth.users(id, email) values (v_new, v_new::text || '@test.invalid');
  insert into public.profiles(id, name) values (v_new, 'Discount test')
    on conflict (id) do nothing;
  insert into public.creators(code, name, active) values (v_code, 'Test creator', true);
  insert into public.creators(code, name, active) values (v_off, 'Paused creator', false);

  if not public.referral_first_order_discount_eligible(v_new, v_code) then
    raise exception 'new customer with an active code should be eligible';
  end if;
  if public.referral_first_order_discount_eligible(v_new, v_off) then
    raise exception 'inactive creator must not give a discount';
  end if;
  if public.referral_first_order_discount_eligible(v_new, 'NOSUCHCODE') then
    raise exception 'unknown code must not give a discount';
  end if;
  if public.referral_first_order_discount_eligible(null, v_code) then
    raise exception 'null customer must not be eligible';
  end if;

  select o.customer_id into v_old from public.orders o limit 1;
  if v_old is not null and public.referral_first_order_discount_eligible(v_old, v_code) then
    raise exception 'customer with an order must not be eligible';
  end if;

  -- An open discounted checkout blocks a second discounted one.
  insert into public.checkout_intents(customer_id, game, service, title, units, unit, gg, rank,
      region, ign, note, voice, amount_eur_cents, payout_usd_cents, booking_fx, expires_at,
      first_order_discount_cents)
    values (v_new, 'lol', 'duo', 'Test', 1, 'game', false, '', 'EUW', 'Tester#1', '', false,
      540, 360, 1.08, pg_catalog.clock_timestamp() + interval '30 minutes', 60);
  if public.referral_first_order_discount_eligible(v_new, v_code) then
    raise exception 'open discounted checkout should block a second discount';
  end if;
  begin
    update public.checkout_intents set first_order_discount_cents = -1 where customer_id = v_new;
    raise exception 'negative discount accepted';
  exception when check_violation then null;
  end;
end $$;

do $$ begin
  if pg_catalog.has_function_privilege('anon', 'public.referral_first_order_discount_eligible(uuid, text)', 'execute')
     or pg_catalog.has_function_privilege('authenticated', 'public.referral_first_order_discount_eligible(uuid, text)', 'execute') then
    raise exception 'eligibility must be service role only';
  end if;
end $$;
select 'referral_first_order_discount: all checks passed' as result;
rollback;
