-- Payoneer as a manual payout method, next to bank, Wise and PayPal.
--
-- A teammate can pick Payoneer in their payout details, and an admin can mark a payout line (or a
-- creator month) paid with Payoneer. Only the allowed-method lists change; every payout rule stays.
--
-- Method lists. The lists ('bank','wise','paypal') and ('bank','wise','paypal','other') are literals
-- inside several live functions (admin_payout_pay, admin_payout_pay_all, admin_payout_pay_all_manual,
-- admin_creator_payout_pay, teammate_save_payout_details, analytics_on_payout_lines,
-- analytics_outbox_reconcile, and any later redefinition). Like 20261104120000, this rewrites the
-- live definitions in place instead of copying their bodies, and aborts if fewer than the expected
-- functions are found or an old list is left behind.
--
-- Constraints. The method checks on payout_lines.paid_method, teammate_payout_details.payout_method
-- and creator_payouts.paid_method get 'payoneer' added; the constraint names stay the same.
begin;

do $$
declare
  v_fn record;
  v_def text;
  v_new text;
  v_count integer := 0;
begin
  for v_fn in
    select p.oid::regprocedure as sig
    from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
      and (pg_catalog.strpos(p.prosrc, '(''bank'',''wise'',''paypal'')') > 0
        or pg_catalog.strpos(p.prosrc, '(''bank'',''wise'',''paypal'',''other'')') > 0)
  loop
    v_def := pg_catalog.pg_get_functiondef(v_fn.sig);
    v_new := pg_catalog.replace(v_def, '(''bank'',''wise'',''paypal'',''other'')', '(''bank'',''wise'',''paypal'',''payoneer'',''other'')');
    v_new := pg_catalog.replace(v_new, '(''bank'',''wise'',''paypal'')', '(''bank'',''wise'',''paypal'',''payoneer'')');
    if pg_catalog.strpos(v_new, '''paypal'',''other'')') > 0 or pg_catalog.strpos(v_new, '''paypal'')') > 0 then
      raise exception '% still has a method list without payoneer after the rewrite', v_fn.sig;
    end if;
    execute v_new; -- pg_get_functiondef returns CREATE OR REPLACE, so owner and grants are kept
    v_count := v_count + 1;
  end loop;
  if v_count < 7 then
    raise exception 'Expected at least 7 functions with a payout method list, found %; check the live definitions', v_count;
  end if;
end $$;

do $$
declare
  v_con record;
  v_def text;
  v_count integer := 0;
begin
  for v_con in
    select c.conname, c.conrelid::regclass as tbl, pg_catalog.pg_get_constraintdef(c.oid) as def
    from pg_catalog.pg_constraint c
    where c.contype = 'c'
      and c.conrelid in ('public.payout_lines'::regclass, 'public.teammate_payout_details'::regclass, 'public.creator_payouts'::regclass)
      and pg_catalog.strpos(pg_catalog.pg_get_constraintdef(c.oid), '''paypal''::text') > 0
  loop
    v_def := pg_catalog.replace(v_con.def, '''paypal''::text', '''paypal''::text, ''payoneer''::text');
    execute pg_catalog.format('alter table %s drop constraint %I', v_con.tbl, v_con.conname);
    execute pg_catalog.format('alter table %s add constraint %I %s', v_con.tbl, v_con.conname, v_def);
    v_count := v_count + 1;
  end loop;
  if v_count <> 3 then
    raise exception 'Expected 3 payout method constraints, found %', v_count;
  end if;
end $$;

commit;
