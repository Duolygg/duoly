do $$
declare f jsonb:=pg_temp.completion_fixture(); g jsonb; first_result jsonb; second_result jsonb; v jsonb;
begin
 set local role authenticated;
 perform pg_temp.completion_login(f->>'teammate');
 first_result:=public.complete_order((f->>'order')::uuid,(f->>'assignment')::uuid,array[(f->>'proof')::uuid],(f->>'request')::uuid);
 reset role;
 g:=pg_temp.completion_fixture((f->>'teammate')::uuid);
 set local role authenticated;
 v:=public.complete_order((g->>'order')::uuid,(g->>'assignment')::uuid,array[(g->>'proof')::uuid],(f->>'request')::uuid);
 perform pg_temp.completion_assert(v#>>'{error,code}'='409','request bound across orders');
 second_result:=public.complete_order((g->>'order')::uuid,(g->>'assignment')::uuid,array[(g->>'proof')::uuid],(g->>'request')::uuid);
 v:=public.teammate_earnings(2,0);
 perform pg_temp.completion_assert(v=jsonb_build_object('earnings',jsonb_build_array(second_result->'completion',first_result->'completion')),'newest first exactly immutable DTOs');
 perform pg_temp.completion_assert(public.teammate_earnings(1,1)=jsonb_build_object('earnings',jsonb_build_array(first_result->'completion')),'offset selects older own earning');
 reset role;
 update public.orders set payout_usd_cents=999,booking_fx=2 where id=(f->>'order')::uuid;
 set local role authenticated;
 v:=public.complete_order((f->>'order')::uuid,(f->>'assignment')::uuid,array[(f->>'proof')::uuid],(f->>'request')::uuid);
 perform pg_temp.completion_assert(v=first_result,'later mutable order/FX cannot rewrite earning or retry');
 reset role;
end $$;
select 'completion history order and request binding passed' as result;
