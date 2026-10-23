-- Rollback-only checks for 20261024127500_support_sparky.sql.
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
 if (public.admin_audit(4)->'audit'->0->>'action') <> 'Closed support chat' then raise exception 'support commands not audited'; end if;
end $$;
reset role;

-- Service-only message limiter and daily AI cap are atomic.
set local role service_role;
do $$ declare r jsonb; begin
 update public.support_conversations set status='bot' where id='5a100000-0000-4000-8000-000000000001';
 for i in 1..12 loop
   r := public.support_add_user_message('5a100000-0000-4000-8000-000000000001','message ' || i,12);
   if r ? 'error' then raise exception 'message % refused early: %',i,r; end if;
 end loop;
 r := public.support_add_user_message('5a100000-0000-4000-8000-000000000001','too many',12);
 if (r->'error'->>'code')::int <> 429 then raise exception 'rate limit missing: %',r; end if;
 if not public.support_take_ai_slot(2) or not public.support_take_ai_slot(2) or public.support_take_ai_slot(2) then raise exception 'daily AI cap wrong'; end if;
end $$;
reset role;
select 'support_sparky: all checks passed' as result;
rollback;
