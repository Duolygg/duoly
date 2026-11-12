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

-- Rollback-only checks for 20261101120000_order_moods.sql.
-- Run after the migration body in one transaction, with a savepoint before this body.

insert into auth.users(id,aud,role,email,raw_user_meta_data,raw_app_meta_data) values
 ('b7000000-0000-4000-8000-000000000001','authenticated','authenticated','order-moods-tryhard@example.invalid','{}','{}'),
 ('b7000000-0000-4000-8000-000000000002','authenticated','authenticated','order-moods-none@example.invalid','{}','{}');
update public.account_roles set role='customer'
 where user_id in ('b7000000-0000-4000-8000-000000000001','b7000000-0000-4000-8000-000000000002');

-- One intent with a mood, one without (two customers: one open order each).
insert into public.checkout_intents(id,customer_id,game,service,title,units,unit,region,ign,amount_eur_cents,payout_usd_cents,booking_fx,mood,expires_at) values
 ('b7100000-0000-4000-8000-000000000001','b7000000-0000-4000-8000-000000000001','lol','duo2','Duo Pro',3,'game','EUW','Moods#EUW',1617,1048,1.1,'tryhard',now()+interval '30 minutes'),
 ('b7100000-0000-4000-8000-000000000002','b7000000-0000-4000-8000-000000000002','lol','duo2','Duo Pro',3,'game','EUW','NoMood#EUW',1617,1048,1.1,null,now()+interval '30 minutes');

-- Only the four moods fit the column.
do $$ begin
 begin
  update public.checkout_intents set mood='toxic' where id='b7100000-0000-4000-8000-000000000002';
  raise exception 'an unknown mood was accepted on checkout_intents';
 exception when check_violation then null;
 end;
end $$;

do $$ declare r jsonb; oid uuid; dto jsonb; due jsonb; begin
 r:=public.create_paid_order('b7100000-0000-4000-8000-000000000001','pi_order_moods_1',1617,'eur','card','authorized');
 oid:=(r->>'order_id')::uuid;
 if oid is null or not (r->>'created')::boolean then raise exception 'mood order failed: %',r; end if;
 if (select mood is distinct from 'tryhard' from public.orders where id=oid) then raise exception 'mood was not copied onto the order'; end if;
 select public.order_teammate_dto(o) into dto from public.orders o where o.id=oid;
 if dto->>'mood' is distinct from 'tryhard' then raise exception 'teammate dto lacks the mood: %',dto; end if;
 due:=public.discord_order_posts_due(0);
 if not exists(select 1 from pg_catalog.jsonb_array_elements(due) e where e->>'id'=oid::text and e->>'mood'='tryhard') then
  raise exception 'discord due posts lack the mood: %',due;
 end if;
 begin
  update public.orders set mood='angry' where id=oid;
  raise exception 'an unknown mood was accepted on orders';
 exception when check_violation then null;
 end;
end $$;

do $$ declare r jsonb; oid uuid; dto jsonb; begin
 r:=public.create_paid_order('b7100000-0000-4000-8000-000000000002','pi_order_moods_2',1617,'eur','card','authorized');
 oid:=(r->>'order_id')::uuid;
 if oid is null or not (r->>'created')::boolean then raise exception 'no-mood order failed: %',r; end if;
 if (select mood is not null from public.orders where id=oid) then raise exception 'an order without a mood got one'; end if;
 select public.order_teammate_dto(o) into dto from public.orders o where o.id=oid;
 if not (dto ? 'mood') or dto->'mood'<>'null'::jsonb then raise exception 'teammate dto should carry mood null: %',dto; end if;
end $$;

select 'order_moods: all checks passed' as result;
rollback to savepoint s;
