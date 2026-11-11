-- Teammates see only a masked customer name ("C*****r") on queued orders, until they accept.
-- The full name still comes back from accept_order and teammate_current_assignment, which use
-- order_teammate_dto unchanged. Only teammate_order_queue changes, and only its customer_name.
--
-- Like 20261104120000, the live teammate_order_queue (last defined in 20261106190000_team_orders) is
-- rewritten in place rather than copied, and the migration aborts if the expected token is missing.
begin;

create or replace function public.order_masked_name(p_name text)
 returns text
 language sql
 immutable
 set search_path to ''
as $function$
  select case
    when p_name is null or pg_catalog.char_length(p_name) = 0 then '*'
    when pg_catalog.char_length(p_name) <= 2 then pg_catalog.concat(pg_catalog.left(p_name, 1), '*')
    else pg_catalog.concat(pg_catalog.left(p_name, 1),
      pg_catalog.repeat('*', pg_catalog.char_length(p_name) - 2), pg_catalog.right(p_name, 1))
  end;
$function$;

-- Internal helper: only the security definer queue below calls it.
revoke all on function public.order_masked_name(text) from public, anon, authenticated;

do $$
declare
  v_old text := 'public.order_teammate_dto(q.o) || pg_catalog.jsonb_build_object(''picked_for_you'', q.picked)';
  v_new text := 'public.order_teammate_dto(q.o) || pg_catalog.jsonb_build_object(''picked_for_you'', q.picked, ''customer_name'', public.order_masked_name((q.o).customer_name))';
  v_def text := pg_catalog.pg_get_functiondef('public.teammate_order_queue()'::regprocedure);
begin
  if pg_catalog.strpos(v_def, v_old) = 0 then
    raise exception 'teammate_order_queue() does not contain the expected queue row; check the live definition';
  end if;
  execute pg_catalog.replace(v_def, v_old, v_new); -- CREATE OR REPLACE keeps owner and grants
end $$;

commit;
