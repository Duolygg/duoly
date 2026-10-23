set local role authenticated;
do $$
declare f jsonb := current_setting('completion.fixture')::jsonb; v jsonb;
begin
 perform pg_temp.completion_login(f->>'teammate');
 v := public.complete_order((f->>'order')::uuid,(f->>'assignment')::uuid,array[(f->>'proof')::uuid],(f->>'request')::uuid);
 perform pg_temp.completion_assert(v = current_setting('completion.result')::jsonb,'same-request exact replay after completion');
 v := public.complete_order((f->>'order')::uuid,(f->>'assignment')::uuid,array[(f->>'proof')::uuid],gen_random_uuid());
 perform pg_temp.completion_assert(v #>> '{error,code}' = '409','different request conflicts');
 v := public.complete_order((f->>'order')::uuid,(f->>'assignment')::uuid,array[gen_random_uuid()],(f->>'request')::uuid);
 perform pg_temp.completion_assert(v #>> '{error,code}' = '409','different proof payload conflicts');
end $$;
reset role;
do $$ declare f jsonb := current_setting('completion.fixture')::jsonb; begin
 perform pg_temp.completion_assert((select count(*)=1 from public.teammate_earning_entries where order_id=(f->>'order')::uuid),'exactly one earning');
 perform pg_temp.completion_assert((select count(*)=1 from public.order_chat_messages where assignment_id=(f->>'assignment')::uuid and system_event='completed'),'one completion system event');
end $$;
select 'completion replay passed' as result;
