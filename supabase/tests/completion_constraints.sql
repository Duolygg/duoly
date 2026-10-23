do $$
declare f jsonb := pg_temp.completion_fixture(); mode integer;
begin
 for mode in 1..2 loop
  begin
   insert into public.teammate_earning_entries(order_id,assignment_id,teammate_id,request_id,proof_ids,completed_at,
     prior_completed_count,trust_tier,payout_usd_cents,deposit_percent,held_usd_cents,net_usd_cents,source_snapshot,result)
   values((f->>'order')::uuid,(f->>'assignment')::uuid,(f->>'teammate')::uuid,(f->>'request')::uuid,
     array[(f->>'proof')::uuid],clock_timestamp(),case when mode=2 then 100 else 0 end,'rookie',105,10,
     case when mode=1 then 10 else 11 end,case when mode=1 then 95 else 94 end,'{}','{}');
   raise exception 'completion incoherent immutable money/tier snapshot was allowed';
  exception when check_violation then null; end;
 end loop;
end $$;
select 'completion persisted financial invariants passed' as result;
