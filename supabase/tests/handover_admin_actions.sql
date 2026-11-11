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

-- Rollback-only checks for 20261024170000_handover_admin_actions.sql.
-- Run with the migration body prepended in one transaction; everything is rolled back.
begin;
insert into auth.users (id,aud,role,email,raw_user_meta_data,raw_app_meta_data)
select ('a1700000-0000-4000-8000-' || pg_catalog.lpad(n::text,12,'0'))::uuid,'authenticated','authenticated',
  'handover-' || n || '@example.invalid','{}','{}'
from pg_catalog.generate_series(1,8) as n;
-- 1 admin, 2 and 3 customers, 4 regular val teammate, 5 Gamer Girl, 6 rerolled away and slow priority,
-- 7 suspended teammate, 8 teammate without Discord.
update public.profiles set name = 'Handover ' || pg_catalog.right(id::text, 1) where id::text like 'a1700000-0000-4000-8000-%';
update public.account_roles set role = case when user_id = 'a1700000-0000-4000-8000-000000000001' then 'admin'
  when user_id in ('a1700000-0000-4000-8000-000000000002','a1700000-0000-4000-8000-000000000003') then 'customer'
  else 'teammate' end
where user_id::text like 'a1700000-0000-4000-8000-%';
insert into public.teammate_order_access(user_id,approved_games,gg_access,discord_id,discord_verified_at,suspended,priority_base)
select ('a1700000-0000-4000-8000-' || pg_catalog.lpad(n::text,12,'0'))::uuid,
  case when n = 5 then array[]::text[] else array['val']::text[] end, n = 5,
  case when n = 8 then null else '99170000000000' || pg_catalog.lpad(n::text,3,'0') end,
  case when n = 8 then null else pg_catalog.clock_timestamp() end, n = 7, case when n = 6 then 100 else 0 end
from pg_catalog.generate_series(4,8) as n;

insert into public.orders(id,public_reference,customer_id,game,service,title,units,unit,region,ign,customer_name,amount_eur_cents,booking_fx,payout_usd_cents)
values
 ('a1710000-0000-4000-8000-000000000001','DL-9917001','a1700000-0000-4000-8000-000000000002','val','duo','Fixture duo',1,'game','EU','Cust#EU','Cust Two',1999,1.08,1500),
 ('a1710000-0000-4000-8000-000000000002','DL-9917002','a1700000-0000-4000-8000-000000000003','val','duo','Fixture duo',1,'game','EU','Cust#EU','Cust Three',2499,1.08,1800);
insert into public.checkout_intents(id,customer_id,status,game,service,title,units,unit,region,ign,amount_eur_cents,payout_usd_cents,booking_fx,order_id,expires_at)
values
 ('a1720000-0000-4000-8000-000000000001','a1700000-0000-4000-8000-000000000002','paid','val','duo','Fixture duo',1,'game','EU','Cust#EU',1999,1500,1.08,'a1710000-0000-4000-8000-000000000001',pg_catalog.clock_timestamp() + interval '1 hour'),
 ('a1720000-0000-4000-8000-000000000002','a1700000-0000-4000-8000-000000000003','paid','val','duo','Fixture duo',1,'game','EU','Cust#EU',2499,1800,1.08,'a1710000-0000-4000-8000-000000000002',pg_catalog.clock_timestamp() + interval '1 hour');
insert into public.order_payments(order_id,intent_id,stripe_payment_intent_id,amount_minor,currency,amount_eur_cents,payment_method_type,state)
values
 ('a1710000-0000-4000-8000-000000000001','a1720000-0000-4000-8000-000000000001','pi_handoverfixture1',1999,'eur',1999,'card','authorized'),
 ('a1710000-0000-4000-8000-000000000002','a1720000-0000-4000-8000-000000000002','pi_handoverfixture2',2499,'eur',2499,'card','authorized');
-- Teammate 6 was re-rolled away from order 1 before.
insert into public.order_assignments(order_id,teammate_id,accepted_at,ended_at,end_reason)
values ('a1710000-0000-4000-8000-000000000001','a1700000-0000-4000-8000-000000000006',
  pg_catalog.clock_timestamp() - interval '2 minutes',pg_catalog.clock_timestamp() - interval '1 minute','customer_reroll');

create temporary table handover_fixture(order_no int primary key, token text not null) on commit drop;
grant all on handover_fixture to authenticated;

set local role authenticated;
-- Customers cannot run admin commands.
select pg_catalog.set_config('request.jwt.claims','{"role":"authenticated","sub":"a1700000-0000-4000-8000-000000000002"}',true);
select pg_catalog.set_config('request.jwt.claim.sub','a1700000-0000-4000-8000-000000000002',true);
do $$ begin
 if (public.admin_create_handover('a1710000-0000-4000-8000-000000000001')->'error'->>'code')::int <> 403 then raise exception 'customer created handover'; end if;
 if (public.admin_cancel_order('a1710000-0000-4000-8000-000000000001','Customer asked')->'error'->>'code')::int <> 403 then raise exception 'customer cancelled as admin'; end if;
 if (public.admin_refund_order('a1710000-0000-4000-8000-000000000001','Customer asked')->'error'->>'code')::int <> 403 then raise exception 'customer refunded as admin'; end if;
 if (public.handover_info(pg_catalog.repeat('a',64))->'error'->>'code')::int <> 403 then raise exception 'customer read handover'; end if;
end $$;

-- Admin creates links; a second link replaces the first.
select pg_catalog.set_config('request.jwt.claims','{"role":"authenticated","sub":"a1700000-0000-4000-8000-000000000001"}',true);
select pg_catalog.set_config('request.jwt.claim.sub','a1700000-0000-4000-8000-000000000001',true);
do $$ declare r jsonb; r2 jsonb; begin
 r := public.admin_create_handover('a1710000-0000-4000-8000-000000000001');
 if r ? 'error' or r->>'token' !~ '^[A-Za-z0-9_-]{24}$' then raise exception 'handover create failed: %', r; end if;
 r2 := public.admin_create_handover('a1710000-0000-4000-8000-000000000001');
 if r2->>'token' = r->>'token' then raise exception 'replacement reused token'; end if;
 insert into handover_fixture values (0, r->>'token'), (1, r2->>'token');
 r := public.admin_create_handover('a1710000-0000-4000-8000-000000000002');
 insert into handover_fixture values (2, r->>'token');
 if (public.handover_info(pg_catalog.repeat('a',64))->'error'->>'code')::int <> 403 then raise exception 'admin used a handover link'; end if;
 if (public.accept_handover(pg_catalog.encode(extensions.digest(r2->>'token','sha256'),'hex'))->'error'->>'code')::int <> 403 then raise exception 'admin accepted an order'; end if;
 if (public.admin_refund_order('a1710000-0000-4000-8000-000000000001','Too early')->'error'->>'code')::int <> 409 then raise exception 'queued order refunded'; end if;
end $$;
reset role;
do $$ declare t1 text := (select token from handover_fixture where order_no = 1); begin
 if (select pg_catalog.count(*) from public.order_handovers where order_id='a1710000-0000-4000-8000-000000000001' and revoked_at is null) <> 1 then raise exception 'more than one active link'; end if;
 if not exists (select 1 from public.order_handovers where order_id='a1710000-0000-4000-8000-000000000001' and revoke_reason='replaced') then raise exception 'old link not revoked'; end if;
 if exists (select 1 from public.order_handovers where token_hash = t1) then raise exception 'raw token stored'; end if;
 if not exists (select 1 from public.order_handovers h join public.orders o on o.id=h.order_id
   where h.token_hash = pg_catalog.encode(extensions.digest(t1,'sha256'),'hex') and h.revoked_at is null and h.expires_at = o.queued_at + interval '5 minutes') then raise exception 'hash or expiry wrong'; end if;
 if (select pg_catalog.count(*) from public.admin_audit_log where action='Created handover link' and target in ('DL-9917001','DL-9917002')) <> 3 then raise exception 'handover creation not audited'; end if;
end $$;

-- Eligibility on the link: access rules, Discord and suspension still apply.
set local role authenticated;
do $$ declare h text := pg_catalog.encode(extensions.digest((select token from handover_fixture where order_no = 1),'sha256'),'hex'); r jsonb; begin
 perform pg_catalog.set_config('request.jwt.claim.sub','a1700000-0000-4000-8000-000000000005',true);
 r := public.handover_info(h);
 if r->>'state' <> 'blocked' then raise exception 'Gamer Girl saw a regular order: %', r; end if;
 if (public.accept_handover(h)->'error'->>'code')::int <> 403 then raise exception 'Gamer Girl took a regular order'; end if;
 perform pg_catalog.set_config('request.jwt.claim.sub','a1700000-0000-4000-8000-000000000007',true);
 if (public.accept_handover(h)->'error'->>'code')::int <> 403 then raise exception 'suspended teammate accepted'; end if;
 perform pg_catalog.set_config('request.jwt.claim.sub','a1700000-0000-4000-8000-000000000008',true);
 if (public.accept_handover(h)->'error'->>'code')::int <> 403 then raise exception 'teammate without Discord accepted'; end if;
 perform pg_catalog.set_config('request.jwt.claim.sub','a1700000-0000-4000-8000-000000000004',true);
 if public.handover_info(pg_catalog.encode(extensions.digest((select token from handover_fixture where order_no = 0),'sha256'),'hex'))->>'state' <> 'invalid' then raise exception 'replaced link still open'; end if;
 if public.handover_info(pg_catalog.repeat('b',64))->>'state' <> 'invalid' then raise exception 'unknown link not invalid'; end if;
 if public.handover_info(h)->>'state' <> 'open' then raise exception 'eligible teammate did not see open link'; end if;
 -- Teammate 6: re-rolled away and priority 100 seconds, so the queue hides the order, but the admin link works.
 perform pg_catalog.set_config('request.jwt.claim.sub','a1700000-0000-4000-8000-000000000006',true);
 if pg_catalog.jsonb_array_length(public.teammate_order_queue()->'orders') <> 0 then raise exception 'rerolled teammate sees order in queue'; end if;
 if (public.accept_order('a1710000-0000-4000-8000-000000000001')->'error'->>'code')::int <> 404 then raise exception 'rerolled teammate accepted from queue'; end if;
 r := public.accept_handover(h);
 if r ? 'error' or r->'order'->>'status' <> 'in_progress' then raise exception 'admin link did not bypass priority and reroll: %', r; end if;
 perform pg_catalog.set_config('request.jwt.claim.sub','a1700000-0000-4000-8000-000000000004',true);
 if public.handover_info(h)->>'state' <> 'taken' then raise exception 'accepted link not taken'; end if;
 if (public.accept_handover(h)->'error'->>'code')::int <> 409 then raise exception 'second accept allowed'; end if;
end $$;
reset role;
do $$ begin
 if not exists (select 1 from public.order_handovers where order_id='a1710000-0000-4000-8000-000000000001' and revoke_reason='accepted') then raise exception 'accept did not revoke link'; end if;
 if (select settle from public.order_payments where order_id='a1710000-0000-4000-8000-000000000001') <> 'capture' then raise exception 'accept did not request capture'; end if;
end $$;
set local role service_role;
select public.finish_payment_settlement('a1710000-0000-4000-8000-000000000001','captured',null);
reset role;

-- Admin cancel of a queued order releases the authorization and revokes its link.
set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub','a1700000-0000-4000-8000-000000000001',true);
do $$ declare r jsonb; begin
 if (public.admin_cancel_order('a1710000-0000-4000-8000-000000000002',' ')->'error'->>'code')::int <> 400 then raise exception 'cancel without reason'; end if;
 if (public.admin_cancel_order('a1710000-0000-4000-8000-000000000001','Playing order')->'error'->>'code')::int <> 409 then raise exception 'in progress order cancelled'; end if;
 r := public.admin_cancel_order('a1710000-0000-4000-8000-000000000002','Customer asked support');
 if r->'order'->>'status' <> 'cancelled' or r->'order'->>'cancel_reason' <> 'admin_cancelled' then raise exception 'admin cancel failed: %', r; end if;
 r := public.admin_cancel_order('a1710000-0000-4000-8000-000000000002','Customer asked support');
 if r ? 'error' then raise exception 'repeat cancel not idempotent'; end if;
 if (public.admin_create_handover('a1710000-0000-4000-8000-000000000002')->'error'->>'code')::int <> 409 then raise exception 'handover created for cancelled order'; end if;
 -- Refund needs a reason, then queues a full Stripe refund once.
 if (public.admin_refund_order('a1710000-0000-4000-8000-000000000001','')->'error'->>'code')::int <> 400 then raise exception 'refund without reason'; end if;
 r := public.admin_refund_order('a1710000-0000-4000-8000-000000000001','Teammate left mid-game');
 if r->>'paymentState' <> 'refund_pending' then raise exception 'refund not queued: %', r; end if;
 if (public.admin_refund_order('a1710000-0000-4000-8000-000000000002','Cancelled order')->'error'->>'code')::int <> 409 then raise exception 'cancelled order refunded'; end if;
end $$;
select pg_catalog.set_config('request.jwt.claim.sub','a1700000-0000-4000-8000-000000000004',true);
do $$ begin
 if public.handover_info(pg_catalog.encode(extensions.digest((select token from handover_fixture where order_no = 2),'sha256'),'hex'))->>'state' <> 'cancelled' then raise exception 'cancelled order link not cancelled'; end if;
end $$;
reset role;
do $$ begin
 if (select settle from public.order_payments where order_id='a1710000-0000-4000-8000-000000000002') <> 'release' then raise exception 'admin cancel did not release'; end if;
 if (select admin_cancel_note from public.orders where id='a1710000-0000-4000-8000-000000000002') <> 'Customer asked support' then raise exception 'cancel reason not stored'; end if;
 if exists (select 1 from public.refund_credits where order_id='a1710000-0000-4000-8000-000000000002') then raise exception 'Stripe order got wallet credit'; end if;
 if not exists (select 1 from public.order_handovers where order_id='a1710000-0000-4000-8000-000000000002' and revoke_reason='cancelled') then raise exception 'cancel did not revoke link'; end if;
 if (select settle from public.order_payments where order_id='a1710000-0000-4000-8000-000000000001') <> 'refund' then raise exception 'refund not pending'; end if;
 if (select pg_catalog.count(*) from public.admin_audit_log where action='Cancelled order' and target='DL-9917002') <> 1 then raise exception 'cancel audit wrong'; end if;
 if (select pg_catalog.count(*) from public.admin_audit_log where action='Refunded order' and target='DL-9917001') <> 1 then raise exception 'refund audit wrong'; end if;
end $$;

-- Worker or webhook completes the refund; replays stay idempotent.
set local role service_role;
select public.finish_payment_settlement('a1710000-0000-4000-8000-000000000001','refunded',null);
do $$ begin
 if (public.record_payment_refund('pi_handoverfixture1','Refund received from Stripe')->>'updated')::boolean is not true then raise exception 'webhook refund not recorded'; end if;
 if (public.record_payment_refund('pi_unknownfixture','x')->>'updated')::boolean then raise exception 'unknown refund recorded'; end if;
end $$;
reset role;
set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub','a1700000-0000-4000-8000-000000000001',true);
do $$ declare r jsonb; o jsonb; begin
 r := public.admin_refund_order('a1710000-0000-4000-8000-000000000001','Teammate left mid-game');
 if r->>'paymentState' <> 'refunded' then raise exception 'repeat refund not idempotent: %', r; end if;
 select x into o from pg_catalog.jsonb_array_elements(public.admin_orders(50)->'orders') x where x->>'id' = 'DL-9917001';
 if o->>'adminRefundReason' <> 'Teammate left mid-game' or o->'payment'->>'state' <> 'refunded' or o->'payment'->>'refundedAt' is null then raise exception 'admin orders lacks refund: %', o; end if;
end $$;
reset role;
do $$ begin
 if (select pg_catalog.count(*) from public.admin_audit_log where action='Refunded order' and target='DL-9917001') <> 1 then raise exception 'idempotent refund re-audited'; end if;
end $$;

select 'handover_admin_actions: all checks passed' as result;
rollback;
