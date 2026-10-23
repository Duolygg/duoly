set local role authenticated;
do $$
declare f jsonb := current_setting('completion.fixture')::jsonb; v jsonb;
begin
 perform pg_temp.completion_login(f->>'teammate');
 v := public.teammate_earnings();
 perform pg_temp.completion_assert(v = jsonb_build_object('earnings',jsonb_build_array(current_setting('completion.result')::jsonb->'completion')),'own immutable completion history');
 perform pg_temp.completion_assert(public.teammate_earnings(1,1)='{"earnings":[]}'::jsonb,'history pagination');
 perform pg_temp.completion_assert(public.teammate_earnings(0,0)#>>'{error,code}'='400','history bounds');
 perform pg_temp.completion_login(f->>'customer');
 perform pg_temp.completion_assert(public.teammate_earnings()#>>'{error,code}'='403','customer history denied');
 perform pg_temp.completion_login(null);
 perform pg_temp.completion_assert(public.teammate_earnings()#>>'{error,code}'='401','no subject history denied');
end $$;
reset role;
select 'completion history passed' as result;
