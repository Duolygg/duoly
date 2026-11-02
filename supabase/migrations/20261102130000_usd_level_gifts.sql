-- Level-up gifts in dollars for customers who use USD (owner request 2026-11-02).
--
-- The gifts are fixed amounts: Silver 5, Gold 15, Platinum 40, Diamond 100. A EUR customer gets
-- €5; a USD customer now gets exactly $5. The wallet stays in EUR, so a USD gift is credited as
-- the EUR amount worth $5 at the customer rate of the order that reached the level (its booking
-- rate + 1%, the rate checkout shows USD prices at), and the wallet then shows $5.00.
--
-- loyalty_level_gifts gains currency ('EUR' or 'USD'); the fixed amount check applies to EUR gifts
-- only, a USD gift is the converted amount. loyalty_grant_gifts is otherwise identical to the
-- 20261025270000_loyalty_cashback.sql version. No gifts had been granted when this was written.
begin;

alter table public.loyalty_level_gifts
  add column currency text not null default 'EUR' check (currency in ('EUR','USD')),
  drop constraint loyalty_level_gifts_check,
  add constraint loyalty_level_gifts_check check (
    (currency = 'EUR' and (level,amount_eur_cents) in (('silver',500),('gold',1500),('platinum',4000),('diamond',10000)))
    or (currency = 'USD' and amount_eur_cents between 1 and 20000));

create or replace function public.loyalty_grant_gifts(p_customer uuid,p_order_id uuid default null) returns integer
language plpgsql security definer set search_path='' as $$
declare v_count bigint; v_level record; v_entry uuid; v_granted integer:=0; v_rate numeric; v_amount integer; v_currency text:='EUR';
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_customer::text,714));
  v_count:=public.loyalty_valid_count(p_customer);
  -- A USD customer's gift is that many dollars: the customer rate of the order that reached the
  -- level (or their latest order when granted outside an order).
  if (select p.currency from public.profiles p where p.id=p_customer)='USD' then
    select pg_catalog.round(o.booking_fx*1.01,4) into v_rate from public.orders o
      where o.customer_id=p_customer and (p_order_id is null or o.id=p_order_id)
      order by o.created_at desc limit 1;
    if v_rate between 0.5 and 2 then v_currency:='USD'; end if;
  end if;
  for v_level in select l.id,l.name,l.gift_eur_cents from public.loyalty_levels() l
    where l.gift_eur_cents>0 and l.from_count<=v_count order by l.from_count loop
    v_amount:=case when v_currency='USD' then pg_catalog.round(v_level.gift_eur_cents/v_rate)::integer else v_level.gift_eur_cents end;
    v_entry:=pg_catalog.gen_random_uuid();
    insert into public.loyalty_level_gifts(customer_id,level,amount_eur_cents,currency,order_id,wallet_entry_id)
      values(p_customer,v_level.id,v_amount,v_currency,p_order_id,v_entry)
      on conflict (customer_id,level) do nothing;
    if found then
      insert into public.wallet_entries(id,customer_id,amount_eur_cents,kind,cashable,order_id,reason)
        values(v_entry,p_customer,v_amount,'level_gift',false,p_order_id,v_level.name||' level-up gift');
      v_granted:=v_granted+1;
    end if;
  end loop;
  return v_granted;
end $$;

-- Grants as before (CREATE OR REPLACE keeps them; restated so a fresh database matches).
revoke all on function public.loyalty_grant_gifts(uuid,uuid) from public,anon,authenticated,service_role;

commit;
