-- New fixture untouched by the successful happy/replay tests.
select set_config('completion.security',pg_temp.completion_fixture()::text,true);
create function pg_temp.completion_call(f jsonb) returns jsonb language sql as $$
 select public.complete_order((f->>'order')::uuid,(f->>'assignment')::uuid,array[(f->>'proof')::uuid],(f->>'request')::uuid)
$$;
set local role authenticated;
do $$
declare f jsonb := current_setting('completion.security')::jsonb; v jsonb; ids uuid[];
begin
 perform pg_temp.completion_login(f->>'teammate');
 -- PostgreSQL multidimensional arrays must be a business error, not a raw throw.
 v:=public.complete_order((f->>'order')::uuid,(f->>'assignment')::uuid,array[[(f->>'proof')::uuid]],(f->>'request')::uuid);
 perform pg_temp.completion_assert(v#>>'{error,code}'='400','multidimensional proof input');
 foreach ids slice 1 in array array[array[null::uuid],array[gen_random_uuid()]] loop
  v:=public.complete_order((f->>'order')::uuid,(f->>'assignment')::uuid,ids,(f->>'request')::uuid);
  perform pg_temp.completion_assert(v#>>'{error,code}'='400','null or foreign proof');
 end loop;
 v:=public.complete_order((f->>'order')::uuid,(f->>'assignment')::uuid,'{}'::uuid[],(f->>'request')::uuid);
 perform pg_temp.completion_assert(v#>>'{error,code}'='400','zero proof');
 v:=public.complete_order((f->>'order')::uuid,(f->>'assignment')::uuid,array_fill((f->>'proof')::uuid,array[6]),(f->>'request')::uuid);
 perform pg_temp.completion_assert(v#>>'{error,code}'='400','six proof');
 v:=public.complete_order((f->>'order')::uuid,(f->>'assignment')::uuid,array_fill((f->>'proof')::uuid,array[2]),(f->>'request')::uuid);
 perform pg_temp.completion_assert(v#>>'{error,code}'='400','duplicate proof');
 v:=public.complete_order((f->>'order')::uuid,gen_random_uuid(),array[(f->>'proof')::uuid],(f->>'request')::uuid);
 perform pg_temp.completion_assert(v#>>'{error,code}'='409','wrong assignment');
 v:=public.complete_order(null,null,null,null);
 perform pg_temp.completion_assert(v#>>'{error,code}'='400','null inputs');
 perform pg_temp.completion_login(f->>'customer');
 perform pg_temp.completion_assert(pg_temp.completion_call(f)#>>'{error,code}'='403','customer completion forbidden');
 perform pg_temp.completion_assert(public.teammate_earnings()#>>'{error,code}'='403','customer earnings forbidden');
 perform pg_temp.completion_login(null);
 perform pg_temp.completion_assert(pg_temp.completion_call(f)#>>'{error,code}'='401','no subject forbidden');
end $$;
reset role;
do $$
declare f jsonb := current_setting('completion.security')::jsonb; stranger jsonb := pg_temp.completion_fixture(); mode integer; v jsonb;
begin
 set local role authenticated;
 perform pg_temp.completion_login(stranger->>'teammate');
 perform pg_temp.completion_assert(pg_temp.completion_call(f)#>>'{error,code}'='404','wrong teammate forbidden');
 perform pg_temp.completion_assert(public.teammate_earnings()='{"earnings":[]}'::jsonb,'own history only');
 reset role;
 for mode in 1..6 loop
  begin
   if mode<=2 then
    update public.account_roles set role=case when mode=1 then 'admin' else 'customer' end where user_id=(f->>'teammate')::uuid;
   else
    update public.teammate_order_access set suspended=mode=3,
      discord_id=case when mode=4 then null else discord_id end,
      discord_verified_at=case when mode=4 then null else discord_verified_at end,
      approved_games=case when mode=5 then '{}'::text[] else approved_games end,gg_access=mode=6 where user_id=(f->>'teammate')::uuid;
   end if;
   set local role authenticated;
   perform pg_temp.completion_login(f->>'teammate');
   -- Deliberately stale teammate metadata cannot override fresh DB authorization.
   perform set_config('request.jwt.claims',jsonb_build_object('sub',f->>'teammate','user_metadata',jsonb_build_object('role','teammate'))::text,true);
   v:=pg_temp.completion_call(f);
   perform pg_temp.completion_assert(v#>>'{error,code}'=case when mode<=2 then '403' else '404' end,'fresh role/access mode ' || mode);
   if mode=1 then perform pg_temp.completion_assert(public.teammate_earnings()#>>'{error,code}'='403','admin history forbidden'); end if;
   reset role;
   raise no_data_found;
  exception when no_data_found then null; end;
 end loop;
 perform pg_temp.completion_assert(not exists(select 1 from public.teammate_earning_entries where order_id=(f->>'order')::uuid),'denials post no earning');
end $$;
-- Actual denied SQL, not just inspection of GRANT statements.
set local role anon;
do $$ begin
 begin perform public.complete_order(null,null,null,null); raise exception 'anon RPC exposed'; exception when insufficient_privilege then null; end;
 begin perform public.teammate_earnings(); raise exception 'anon earnings exposed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ declare r text; t text; f text; begin
 foreach r in array array['anon','authenticated','service_role'] loop
  foreach t in array array['teammate_earning_entries','order_completion_proofs'] loop
   perform pg_temp.completion_assert((select relrowsecurity from pg_class where oid=('public.'||t)::regclass),'RLS '||t);
   execute format('set local role %I',r);
   begin execute format('select * from public.%I',t); raise exception 'raw read exposed'; exception when insufficient_privilege then null; end;
   begin execute format('delete from public.%I',t); raise exception 'raw delete exposed'; exception when insufficient_privilege then null; end;
   begin execute format('update public.%I set order_id=order_id',t); raise exception 'raw update exposed'; exception when insufficient_privilege then null; end;
   begin execute format('insert into public.%I(order_id) values(null)',t); raise exception 'raw insert exposed'; exception when insufficient_privilege then null; end;
   reset role;
  end loop;
  foreach f in array array['completion_trust(bigint)','completion_immutable_guard()','order_chat_viewer(public.orders,uuid)'] loop
   perform pg_temp.completion_assert(not has_function_privilege(r,'public.'||f,'EXECUTE'),'private helper '||r||f);
  end loop;
 end loop;
end $$;
select 'completion authorization and input validation passed' as result;
