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

-- Rollback-only checks for 20261024141000_support_sparky_limits.sql.
begin;
insert into auth.users (id,aud,role,email,raw_user_meta_data,raw_app_meta_data) values
 ('5a000000-0000-4000-8000-000000000001','authenticated','authenticated','support-admin@example.invalid','{}','{}'),
 ('5a000000-0000-4000-8000-000000000002','authenticated','authenticated','support-customer@example.invalid','{}','{}');
update public.profiles set name='Support Admin' where id='5a000000-0000-4000-8000-000000000001';
update public.account_roles set role='admin' where user_id='5a000000-0000-4000-8000-000000000001';

insert into public.support_conversations(id,user_id,role,name,email,status)
 values ('5a100000-0000-4000-8000-000000000001','5a000000-0000-4000-8000-000000000002','customer','Customer','support-customer@example.invalid','bot');
insert into public.support_messages(conversation_id,sender,body) values
 ('5a100000-0000-4000-8000-000000000001','bot','Hello'),
 ('5a100000-0000-4000-8000-000000000001','user','I need a human');
update public.support_conversations set status='waiting',waiting_since=pg_catalog.clock_timestamp() where id='5a100000-0000-4000-8000-000000000001';

set local role authenticated;
select pg_catalog.set_config('request.jwt.claims','{"role":"authenticated","sub":"5a000000-0000-4000-8000-000000000002"}',true);
select pg_catalog.set_config('request.jwt.claim.sub','5a000000-0000-4000-8000-000000000002',true);
do $$ begin
 if (public.admin_support_inbox(null)->'error'->>'code')::int <> 403 then raise exception 'customer read support'; end if;
 if (public.admin_support_command('5a100000-0000-4000-8000-000000000001','claim','')->'error'->>'code')::int <> 403 then raise exception 'customer claimed support'; end if;
end $$;

select pg_catalog.set_config('request.jwt.claims','{"role":"authenticated","sub":"5a000000-0000-4000-8000-000000000001"}',true);
select pg_catalog.set_config('request.jwt.claim.sub','5a000000-0000-4000-8000-000000000001',true);
do $$ declare r jsonb; begin
 r := public.admin_support_inbox('5a100000-0000-4000-8000-000000000001');
 if pg_catalog.jsonb_array_length(r->'conversations') <> 1 or r->'open'->>'name' <> 'Customer' then raise exception 'support inbox wrong: %',r; end if;
 r := public.admin_support_command('5a100000-0000-4000-8000-000000000001','claim','');
 if r->'open'->>'status' <> 'human' then raise exception 'claim failed: %',r; end if;
 r := public.admin_support_command('5a100000-0000-4000-8000-000000000001','reply','We can help.');
 if r->'open'->'messages'->-1->>'text' <> 'We can help.' then raise exception 'reply failed: %',r; end if;
 r := public.admin_support_command('5a100000-0000-4000-8000-000000000001','bot','');
 if r->'open'->>'status' <> 'bot' then raise exception 'bot handback failed'; end if;
 r := public.admin_support_command('5a100000-0000-4000-8000-000000000001','close','');
 if r->'open'->>'status' <> 'closed' then raise exception 'close failed'; end if;
 -- claimed_by and waiting_since must be cleared on close
 if (public.admin_audit(4)->'audit'->0->>'action') <> 'Closed support chat' then raise exception 'support commands not audited'; end if;
end $$;
reset role;
do $$ begin
 if (select claimed_by from public.support_conversations where id='5a100000-0000-4000-8000-000000000001') is not null then raise exception 'close did not clear claimed_by'; end if;
 if (select waiting_since from public.support_conversations where id='5a100000-0000-4000-8000-000000000001') is not null then raise exception 'close did not clear waiting_since'; end if;
end $$;

-- AI slots: the global cap and the per-person cap both apply, and only allowed calls are counted.
delete from public.support_ai_daily_usage where day = current_date;
set local role service_role;
do $$ begin
 if not public.support_take_ai_slot(3, 'user-a', 2) then raise exception 'user-a call 1 refused'; end if;
 if not public.support_take_ai_slot(3, 'user-a', 2) then raise exception 'user-a call 2 refused'; end if;
 if public.support_take_ai_slot(3, 'user-a', 2) then raise exception 'user-a passed own daily cap'; end if;
 if not public.support_take_ai_slot(3, 'user-b', 2) then raise exception 'user-b blocked by user-a'; end if;
 if public.support_take_ai_slot(3, 'user-c', 2) then raise exception 'global cap not enforced'; end if;
 if public.support_take_ai_slot(3, '', 2) then raise exception 'empty identity accepted'; end if;
end $$;
reset role;
do $$ begin if (select calls from public.support_ai_daily_usage where day = current_date) <> 3 then raise exception 'refused calls were counted'; end if; end $$;

-- Close reopens with Sparky and clears claimed_by/waiting_since (verified above).
-- Writing into a closed chat reopens it with Sparky.
do $$ declare r jsonb; begin
 r := public.support_add_user_message('5a100000-0000-4000-8000-000000000001','back again',12);
 if r ? 'error' or (select status from public.support_conversations where id='5a100000-0000-4000-8000-000000000001') <> 'bot'
   or (select claimed_by from public.support_conversations where id='5a100000-0000-4000-8000-000000000001') is not null then raise exception 'closed chat did not reopen with Sparky: %', r; end if;
 delete from public.support_messages where id = (r->'message'->>'id')::uuid;
end $$;

select 'support_sparky_limits: all checks passed' as result;
rollback;
