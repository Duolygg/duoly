-- Teammates can take back a screenshot they uploaded by mistake (owner 2026-11-12).
--
-- teammate_remove_order_proof hides one of the teammate's own ready screenshots on their open
-- assignment, the same way admin_set_order_proof_removed does (20261105140000): a row in
-- order_proof_removals. The file stays in storage and admins still see it with who removed it,
-- so nothing a customer or a dispute needs is ever destroyed. Customers and the teammate no longer
-- see it (list_order_proofs already skips removed screenshots, get_order_proof opens them for
-- admins only), and complete_order refuses it (20261112144155_complete_wallet_orders.sql).
--
-- begin_order_proof_upload is its live definition (20261022140000_order_proofs.sql) with the slot
-- count changed: removed screenshots no longer take one of the five, so a mistake can be
-- replaced. A hard cap of ten uploads per assignment, removed ones included, keeps storage bounded.
begin;

create function public.teammate_remove_order_proof(p_order_id uuid, p_assignment_id uuid, p_proof_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_order public.orders; v_name text;
begin
  if v_actor is null then raise sqlstate 'PT401' using message = 'Authentication required.'; end if;
  if not exists (select 1 from public.account_roles where user_id = v_actor and role = 'teammate') then
    raise sqlstate 'PT403' using message = 'Teammate role required.';
  end if;
  if p_order_id is null or p_assignment_id is null or p_proof_id is null then
    raise sqlstate 'PT400' using message = 'Invalid proof request.';
  end if;
  select o.* into v_order from public.orders as o where o.id = p_order_id for update;
  if v_order.id is null or not coalesce(public.order_proof_player(v_order, v_actor), false) then
    raise sqlstate 'PT404' using message = 'Order not found.';
  end if;
  if v_order.status <> 'in_progress' or v_order.current_assignment_id <> p_assignment_id
    or not exists (select 1 from public.order_assignments where id = p_assignment_id and ended_at is null) then
    raise sqlstate 'PT409' using message = 'Assignment unavailable.';
  end if;
  if not exists (select 1 from public.order_proof_uploads p
                 where p.id = p_proof_id and p.order_id = p_order_id and p.assignment_id = p_assignment_id
                   and p.uploader_id = v_actor and p.state = 'ready') then
    raise sqlstate 'PT404' using message = 'Proof not found.';
  end if;
  -- the order is locked above, and completion locks it too: a screenshot already sent with a
  -- completion stays (the order is no longer in progress by then)
  select pg_catalog.left(coalesce(nullif(pg_catalog.btrim(p.name), ''), 'Teammate'), 120) into v_name
    from public.profiles p where p.id = v_actor;
  insert into public.order_proof_removals(proof_id, order_id, removed_by, removed_by_name, reason)
    values (p_proof_id, p_order_id, v_actor, coalesce(v_name, 'Teammate'), 'Removed by the teammate before finishing.')
    on conflict (proof_id) do nothing;
  return pg_catalog.jsonb_build_object('removed', true, 'proof_id', p_proof_id);
end;
$$;
revoke all on function public.teammate_remove_order_proof(uuid, uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function public.teammate_remove_order_proof(uuid, uuid, uuid) to authenticated;

create or replace function public.begin_order_proof_upload(p_order_id uuid, p_assignment_id uuid, p_request_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_order public.orders; v public.order_proof_uploads;
begin
  if v_actor is null then raise sqlstate 'PT401' using message = 'Authentication required.'; end if;
  if not exists (select 1 from public.account_roles where user_id = v_actor and role = 'teammate') then
    raise sqlstate 'PT403' using message = 'Teammate role required.';
  end if;
  if p_order_id is null or p_assignment_id is null or p_request_id is null then
    raise sqlstate 'PT400' using message = 'Invalid proof request.';
  end if;
  select o.* into v_order from public.orders as o where o.id = p_order_id for update;
  if v_order.id is null or not coalesce(public.order_proof_player(v_order, v_actor), false) then
    raise sqlstate 'PT404' using message = 'Order not found.';
  end if;
  if v_order.status <> 'in_progress' or v_order.current_assignment_id <> p_assignment_id
    or not exists (select 1 from public.order_assignments where id = p_assignment_id and ended_at is null) then
    raise sqlstate 'PT409' using message = 'Assignment unavailable.';
  end if;
  select p.* into v from public.order_proof_uploads as p
    where p.assignment_id = p_assignment_id and p.request_id = p_request_id for update;
  if v.id is not null then
    if v.state = 'abandoned' then raise sqlstate 'PT409' using message = 'Upload abandoned.'; end if;
  else
    -- (this migration) removed screenshots free their slot; ten uploads at most in all
    if (select count(*) from public.order_proof_uploads p where p.assignment_id = p_assignment_id
          and p.state in ('pending','ready')
          and not exists (select 1 from public.order_proof_removals x where x.proof_id = p.id)) >= 5 then
      raise sqlstate 'PT409' using message = 'Five proof slots already reserved.';
    end if;
    if (select count(*) from public.order_proof_uploads where assignment_id = p_assignment_id
          and state in ('pending','ready')) >= 10 then
      raise sqlstate 'PT409' using message = 'Upload limit reached for this order.';
    end if;
    insert into public.order_proof_uploads(order_id,assignment_id,uploader_id,request_id)
      values(p_order_id,p_assignment_id,v_actor,p_request_id) returning * into v;
  end if;
  return pg_catalog.jsonb_build_object('id',v.id,'order_id',v.order_id,'assignment_id',v.assignment_id,'state',v.state);
end;
$$;
revoke all on function public.begin_order_proof_upload(uuid,uuid,uuid) from public, anon, authenticated, service_role;
grant execute on function public.begin_order_proof_upload(uuid,uuid,uuid) to authenticated;

commit;
