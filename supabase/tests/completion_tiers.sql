do $$
declare n bigint; expected text; pct integer; v jsonb;
begin
 for n,expected,pct in select * from (values
  (0::bigint,'rookie',10),(99,'rookie',10),(100,'trusted',8),(249,'trusted',8),
  (250,'veteran',5),(499,'veteran',5),(500,'elite',3),(999,'elite',3),(1000,'legend',0),(1001,'legend',0)) as b(n,t,p)
 loop
  v := public.completion_trust(n);
  perform pg_temp.completion_assert(v->>'trust_tier'=expected and (v->>'deposit_percent')::integer=pct,'trust boundary ' || n);
 end loop;
end $$;
select 'completion trust boundaries passed' as result;
