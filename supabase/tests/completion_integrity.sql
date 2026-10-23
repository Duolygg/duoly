-- Payment gate: every stored state and outstanding settlement, including absent.
do $$
declare f jsonb := pg_temp.completion_fixture(); v_state text; v_settle text; before_pay jsonb; v jsonb;
begin
 for v_state,v_settle in select * from (values
  ('authorized','none'),('capture_failed','none'),('voided','none'),('refunded','none'),('release_failed','none'),
  ('captured','capture'),('captured','release')) as p(s,t)
 loop
  begin
   update public.order_payments set state=v_state,settle=v_settle where order_id=(f->>'order')::uuid;
   select to_jsonb(payrow) into before_pay from public.order_payments payrow where order_id=(f->>'order')::uuid;
   set local role authenticated;
   perform pg_temp.completion_login(f->>'teammate');
   v:=public.complete_order((f->>'order')::uuid,(f->>'assignment')::uuid,array[(f->>'proof')::uuid],(f->>'request')::uuid);
   perform pg_temp.completion_assert(v#>>'{error,code}'='409','payment gate '||v_state||'/'||v_settle);
   reset role;
   perform pg_temp.completion_assert((select to_jsonb(payrow)=before_pay from public.order_payments payrow where order_id=(f->>'order')::uuid),'denied completion did not change settlement');
   perform pg_temp.completion_assert(not exists(select 1 from public.teammate_earning_entries where order_id=(f->>'order')::uuid),'payment denial no earning');
   raise no_data_found;
  exception when no_data_found then null; end;
 end loop;
 begin
  delete from public.order_payments where order_id=(f->>'order')::uuid;
  set local role authenticated;
  perform pg_temp.completion_login(f->>'teammate');
  v:=public.complete_order((f->>'order')::uuid,(f->>'assignment')::uuid,array[(f->>'proof')::uuid],(f->>'request')::uuid);
  perform pg_temp.completion_assert(v#>>'{error,code}'='409','absent payment');
  reset role;
  raise no_data_found;
 exception when no_data_found then null; end;
end $$;
-- Forced ledger failure cannot leave lifecycle, chat, evidence, or money effects.
create function pg_temp.completion_fail() returns trigger language plpgsql as $$
begin raise sqlstate 'XX001' using message='injected completion persistence failure'; end $$;
create trigger completion_test_fail before insert on public.teammate_earning_entries for each row execute function pg_temp.completion_fail();
do $$
declare f jsonb := pg_temp.completion_fixture(); before_pay jsonb;
begin
 select to_jsonb(payrow) into before_pay from public.order_payments payrow where order_id=(f->>'order')::uuid;
 set local role authenticated;
 perform pg_temp.completion_login(f->>'teammate');
 begin
  perform public.complete_order((f->>'order')::uuid,(f->>'assignment')::uuid,array[(f->>'proof')::uuid],(f->>'request')::uuid);
  raise exception 'injected ledger failure did not fail';
 exception when sqlstate 'XX001' then null; end;
 reset role;
 perform pg_temp.completion_assert(exists(select 1 from public.orders where id=(f->>'order')::uuid and status='in_progress' and completed_at is null),'ledger failure restores order');
 perform pg_temp.completion_assert(exists(select 1 from public.order_assignments where id=(f->>'assignment')::uuid and ended_at is null),'ledger failure restores assignment');
 perform pg_temp.completion_assert(not exists(select 1 from public.teammate_earning_entries where order_id=(f->>'order')::uuid),'ledger failure no earning');
 perform pg_temp.completion_assert(not exists(select 1 from public.order_completion_proofs where order_id=(f->>'order')::uuid),'ledger failure no proof association');
 perform pg_temp.completion_assert(not exists(select 1 from public.order_chat_messages where assignment_id=(f->>'assignment')::uuid and system_event='completed'),'ledger failure no completion message');
 perform pg_temp.completion_assert((select to_jsonb(payrow)=before_pay from public.order_payments payrow where order_id=(f->>'order')::uuid),'ledger failure untouched payment');
end $$;
drop trigger completion_test_fail on public.teammate_earning_entries;
-- Failure AFTER ledger+assignment+order writes proves the enclosing statement
-- rolls all writes back, including pending abandonment and chat trigger changes.
create trigger completion_test_fail after update on public.orders for each row when(new.status='completed') execute function pg_temp.completion_fail();
do $$
declare f jsonb := pg_temp.completion_fixture(); p uuid := gen_random_uuid();
begin
 insert into public.order_proof_uploads(id,order_id,assignment_id,uploader_id,request_id) values(p,(f->>'order')::uuid,(f->>'assignment')::uuid,(f->>'teammate')::uuid,gen_random_uuid());
 set local role authenticated;
 perform pg_temp.completion_login(f->>'teammate');
 begin
  perform public.complete_order((f->>'order')::uuid,(f->>'assignment')::uuid,array[(f->>'proof')::uuid],(f->>'request')::uuid);
  raise exception 'injected transition failure did not fail';
 exception when sqlstate 'XX001' then null; end;
 reset role;
 perform pg_temp.completion_assert(exists(select 1 from public.orders where id=(f->>'order')::uuid and status='in_progress'),'late failure restores status');
 perform pg_temp.completion_assert(exists(select 1 from public.order_assignments where id=(f->>'assignment')::uuid and ended_at is null),'late failure restores assignment');
 perform pg_temp.completion_assert(exists(select 1 from public.order_proof_uploads where id=p and state='pending'),'late failure restores pending upload');
 perform pg_temp.completion_assert(not exists(select 1 from public.teammate_earning_entries where order_id=(f->>'order')::uuid),'late failure restores ledger');
 perform pg_temp.completion_assert(not exists(select 1 from public.order_completion_proofs where order_id=(f->>'order')::uuid),'late failure restores proof association');
 perform pg_temp.completion_assert(not exists(select 1 from public.order_chat_messages where assignment_id=(f->>'assignment')::uuid and system_event='completed'),'late failure restores chat');
end $$;
drop trigger completion_test_fail on public.orders;
-- Selected set canonicalization, all five accepted, evidence scope and late upload.
do $$
declare f jsonb := pg_temp.completion_fixture(); foreign_f jsonb := pg_temp.completion_fixture(); p uuid; ids uuid[]; v jsonb; w jsonb; n integer; pending uuid; before_pay jsonb;
begin
 ids:=array[(f->>'proof')::uuid];
 for n in 2..5 loop
  p:=gen_random_uuid();
  insert into public.order_proof_uploads(id,order_id,assignment_id,uploader_id,request_id,state,mime,byte_size,sha256,ready_at)
  values(p,(f->>'order')::uuid,(f->>'assignment')::uuid,(f->>'teammate')::uuid,gen_random_uuid(),'ready','image/png',12,repeat('a',64),clock_timestamp());
  ids:=array_append(ids,p);
 end loop;
 pending:=gen_random_uuid();
 -- Owner fixture deliberately seeds a pending row beside five ready ones to
 -- test abandonment; normal reservation RPC cannot create a sixth slot.
 insert into public.order_proof_uploads(id,order_id,assignment_id,uploader_id,request_id)
 values(pending,(f->>'order')::uuid,(f->>'assignment')::uuid,(f->>'teammate')::uuid,gen_random_uuid());
 select to_jsonb(payrow) into before_pay from public.order_payments payrow where order_id=(f->>'order')::uuid;
 set local role authenticated;
 perform pg_temp.completion_login(f->>'teammate');
 v:=public.complete_order((f->>'order')::uuid,(f->>'assignment')::uuid,array[(foreign_f->>'proof')::uuid],(f->>'request')::uuid);
 perform pg_temp.completion_assert(v#>>'{error,code}'='400','another assignment proof denied');
 v:=public.complete_order((f->>'order')::uuid,(f->>'assignment')::uuid,array[pending],(f->>'request')::uuid);
 perform pg_temp.completion_assert(v#>>'{error,code}'='400','nonready proof denied');
 v:=public.complete_order((f->>'order')::uuid,(f->>'assignment')::uuid,ids,(f->>'request')::uuid);
 perform pg_temp.completion_assert(jsonb_array_length(v#>'{completion,proof_ids}')=5,'five ready accepted');
 w:=public.complete_order((f->>'order')::uuid,(f->>'assignment')::uuid,array[ids[5],ids[4],ids[3],ids[2],ids[1]],(f->>'request')::uuid);
 perform pg_temp.completion_assert(v=w,'canonical proof-set replay ignores client ordering');
 reset role;
 perform pg_temp.completion_assert(exists(select 1 from public.order_proof_uploads where id=pending and state='abandoned'),'pending upload abandoned on completion');
 perform pg_temp.completion_assert((select to_jsonb(payrow)=before_pay from public.order_payments payrow where order_id=(f->>'order')::uuid),'success leaves payment unchanged');
 perform pg_temp.completion_assert(not exists(select 1 from public.refund_credits where order_id=(f->>'order')::uuid),'no refund or reward credit');
 set local role service_role;
 begin
  perform public.finalize_order_proof_upload(pending,'image/png',12,repeat('a',64));
  raise exception 'pending proof attached after completion';
 exception when sqlstate 'PT409' then null; end;
 reset role;
 -- The two active-assignment partial indexes no longer block the next order.
 update public.teammate_order_access set priority_base=0 where user_id=(f->>'teammate')::uuid;
 set local role authenticated;
 perform pg_temp.completion_login(foreign_f->>'customer');
 v:=public.reroll_order((foreign_f->>'order')::uuid);
 perform pg_temp.completion_assert(v#>>'{order,status}'='queued','prepare independent next order');
 perform pg_temp.completion_login(f->>'teammate');
 v:=public.accept_order((foreign_f->>'order')::uuid);
 perform pg_temp.completion_assert(v#>>'{order,status}'='in_progress','can accept next order');
 -- Former teammate and replacement cannot access each other's evidence/chat.
 begin perform public.get_order_proof((foreign_f->>'order')::uuid,(foreign_f->>'proof')::uuid); raise exception 'replacement read old proof'; exception when sqlstate 'PT404' then null; end;
 perform pg_temp.completion_login(foreign_f->>'teammate');
 perform pg_temp.completion_assert(public.get_order_chat((foreign_f->>'order')::uuid,(foreign_f->>'assignment')::uuid)#>>'{error,code}'='404','former chat denied');
 reset role;
end $$;
select 'completion integrity, payments, proof isolation and next-accept passed' as result;
