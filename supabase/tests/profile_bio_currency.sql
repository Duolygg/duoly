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

-- Rollback-only checks for 20261024190000_profile_bio_currency.sql.
begin;
insert into auth.users (id,aud,role,email,raw_user_meta_data,raw_app_meta_data) values
 ('5b000000-0000-4000-8000-000000000001','authenticated','authenticated','profile-teammate@example.invalid','{}','{}'),
 ('5b000000-0000-4000-8000-000000000002','authenticated','authenticated','profile-customer@example.invalid','{}','{}');
update public.account_roles set role='teammate' where user_id='5b000000-0000-4000-8000-000000000001';
update public.profiles set name='Profile Mate' where id='5b000000-0000-4000-8000-000000000001';

do $$ begin
 if exists(select 1 from public.profiles where id in ('5b000000-0000-4000-8000-000000000001','5b000000-0000-4000-8000-000000000002')
   and (bio <> '' or languages <> '{}' or currency is not null)) then raise exception 'new profile defaults wrong'; end if;
end $$;

set local role authenticated;
-- Customer: currency yes, bio and languages no.
select pg_catalog.set_config('request.jwt.claims','{"role":"authenticated","sub":"5b000000-0000-4000-8000-000000000002"}',true);
select pg_catalog.set_config('request.jwt.claim.sub','5b000000-0000-4000-8000-000000000002',true);
do $$ declare n int; begin
 update public.profiles set currency='USD' where id='5b000000-0000-4000-8000-000000000002';
 get diagnostics n = row_count;
 if n <> 1 then raise exception 'customer could not save currency'; end if;
 update public.profiles set currency=null where id='5b000000-0000-4000-8000-000000000002';
 begin
   update public.profiles set currency='GBP' where id='5b000000-0000-4000-8000-000000000002';
   raise exception 'GBP accepted';
 exception when check_violation then null; end;
 begin
   update public.profiles set bio='I am a customer' where id='5b000000-0000-4000-8000-000000000002';
   raise exception 'customer set a bio';
 exception when insufficient_privilege then null; end;
 begin
   update public.profiles set languages='{English}' where id='5b000000-0000-4000-8000-000000000002';
   raise exception 'customer set languages';
 exception when insufficient_privilege then null; end;
 -- Unchanged bio and languages in the same update do not trip the guard.
 update public.profiles set name='Profile Customer', bio=bio, languages=languages where id='5b000000-0000-4000-8000-000000000002';
 -- Other accounts stay out of reach.
 update public.profiles set currency='USD' where id='5b000000-0000-4000-8000-000000000001';
 get diagnostics n = row_count;
 if n <> 0 then raise exception 'customer changed another profile'; end if;
 begin
   update public.profiles set created_at=now() where id='5b000000-0000-4000-8000-000000000002';
   raise exception 'created_at writable';
 exception when insufficient_privilege then null; end;
end $$;

-- Teammate: bio and languages within the original limits.
select pg_catalog.set_config('request.jwt.claims','{"role":"authenticated","sub":"5b000000-0000-4000-8000-000000000001"}',true);
select pg_catalog.set_config('request.jwt.claim.sub','5b000000-0000-4000-8000-000000000001',true);
do $$ declare bad text; begin
 update public.profiles set bio=E'Diamond jungle main.\nCalm comms.', languages='{English,German}', currency='EUR'
   where id='5b000000-0000-4000-8000-000000000001';
 if not found then raise exception 'teammate could not save'; end if;
 update public.profiles set bio=pg_catalog.repeat('a',160), languages='{English,German,French,Spanish,Dutch,Polish}'
   where id='5b000000-0000-4000-8000-000000000001';
 foreach bad in array array[pg_catalog.repeat('a',161), ' padded', E'tab\there', E'trailing\n'] loop
   begin
     update public.profiles set bio=bad where id='5b000000-0000-4000-8000-000000000001';
     raise exception 'bad bio accepted: %', bad;
   exception when check_violation then null; end;
 end loop;
 begin
   update public.profiles set languages='{English,German,French,Spanish,Dutch,Polish,Swedish}' where id='5b000000-0000-4000-8000-000000000001';
   raise exception '7 languages accepted';
 exception when check_violation then null; end;
 begin
   update public.profiles set languages='{English,English}' where id='5b000000-0000-4000-8000-000000000001';
   raise exception 'duplicate language accepted';
 exception when check_violation then null; end;
 begin
   update public.profiles set languages='{Klingon}' where id='5b000000-0000-4000-8000-000000000001';
   raise exception 'unknown language accepted';
 exception when check_violation then null; end;
 begin
   update public.profiles set languages=array[null]::text[] where id='5b000000-0000-4000-8000-000000000001';
   raise exception 'null language accepted';
 exception when check_violation then null; end;
 update public.profiles set bio='Calm comms, I explain my calls.', languages='{English,German}' where id='5b000000-0000-4000-8000-000000000001';
end $$;
reset role;

-- Trusted server code (no signed-in user) is not limited by the teammate guard.
select pg_catalog.set_config('request.jwt.claims','',true);
select pg_catalog.set_config('request.jwt.claim.sub','',true);
update public.profiles set bio='Set by support' where id='5b000000-0000-4000-8000-000000000002';
update public.profiles set bio='' where id='5b000000-0000-4000-8000-000000000002';

-- Customer order DTO shows the teammate's bio and languages.
do $$ declare d jsonb; begin
 d := public.order_customer_dto(pg_catalog.jsonb_populate_record(null::public.orders,
   pg_catalog.jsonb_build_object('id','5b100000-0000-4000-8000-000000000001','assigned_teammate_id','5b000000-0000-4000-8000-000000000001')));
 if d->'teammate' <> '{"name":"Profile Mate","image":"/assets/avatars/avatar-1.png","country":"","bio":"Calm comms, I explain my calls.","languages":["English","German"]}'::jsonb
   then raise exception 'customer dto teammate wrong: %', d->'teammate'; end if;
 if d->'review' <> 'null'::jsonb or not (d ? 'current_assignment_id') then raise exception 'customer dto shape changed: %', d; end if;
 d := public.order_customer_dto(pg_catalog.jsonb_populate_record(null::public.orders,
   pg_catalog.jsonb_build_object('id','5b100000-0000-4000-8000-000000000002')));
 if d->'teammate' <> 'null'::jsonb then raise exception 'unassigned dto has teammate'; end if;
end $$;

-- Grants: anon gets nothing, authenticated only the listed columns.
do $$ begin
 if has_column_privilege('anon','public.profiles','currency','UPDATE') then raise exception 'anon can write currency'; end if;
 if not has_column_privilege('authenticated','public.profiles','bio','UPDATE')
   or not has_column_privilege('authenticated','public.profiles','languages','UPDATE')
   or not has_column_privilege('authenticated','public.profiles','currency','UPDATE') then raise exception 'column grants missing'; end if;
 if has_function_privilege('authenticated','public.profiles_teammate_fields_guard()','EXECUTE') then raise exception 'guard callable'; end if;
 if has_function_privilege('authenticated','public.order_customer_dto(public.orders)','EXECUTE') then raise exception 'dto callable'; end if;
end $$;

select 'profile_bio_currency: all checks passed' as result;
rollback;
