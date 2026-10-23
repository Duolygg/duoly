set local role authenticated;
do $$
declare f jsonb := current_setting('completion.fixture')::jsonb; v jsonb;
begin
 perform pg_temp.completion_login(f->>'teammate');
 v := public.get_order_chat((f->>'order')::uuid,(f->>'assignment')::uuid);
 perform pg_temp.completion_assert(v->>'viewer'='teammate' and v->>'writable'='false','final teammate can read closed chat');
 perform pg_temp.completion_assert(jsonb_array_length(v->'messages')=2,'accepted and completed messages');
 v := public.send_order_chat_message((f->>'order')::uuid,(f->>'assignment')::uuid,gen_random_uuid(),'GG');
 perform pg_temp.completion_assert(v #>> '{error,code}'='409','final teammate cannot send');
 v := public.set_order_chat_typing((f->>'order')::uuid,(f->>'assignment')::uuid);
 perform pg_temp.completion_assert(v #>> '{error,code}'='409','final teammate cannot type');
 perform pg_temp.completion_login(f->>'customer');
 v := public.get_order_chat((f->>'order')::uuid,null);
 perform pg_temp.completion_assert(v->>'viewer'='customer' and v->>'writable'='false','customer reads closed chat');
 v := public.send_order_chat_message((f->>'order')::uuid,(f->>'assignment')::uuid,gen_random_uuid(),'GG');
 perform pg_temp.completion_assert(v #>> '{error,code}'='409','final customer cannot send');
end $$;
reset role;
select 'completion chat passed' as result;
