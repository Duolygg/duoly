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

do $$
declare f jsonb := current_setting('completion.fixture')::jsonb;
begin
 begin
   update public.teammate_earning_entries set net_usd_cents=net_usd_cents where order_id=(f->>'order')::uuid;
   raise exception 'completion earning update was allowed';
 exception when sqlstate 'PT409' then null; end;
 begin
   delete from public.teammate_earning_entries where order_id=(f->>'order')::uuid;
   raise exception 'completion earning delete was allowed';
 exception when sqlstate 'PT409' then null; end;
 begin
   delete from public.order_proof_uploads where id=(f->>'proof')::uuid;
   raise exception 'completion selected evidence delete was allowed';
 exception when foreign_key_violation or sqlstate '23001' then null; end;
 perform pg_temp.completion_assert((select count(*)=1 from public.order_completion_proofs where order_id=(f->>'order')::uuid),'proof set frozen');
 begin
   delete from public.order_completion_proofs where order_id=(f->>'order')::uuid;
   raise exception 'completion proof association delete was allowed';
 exception when sqlstate 'PT409' then null; end;
end $$;
select 'completion immutable audit passed' as result;
