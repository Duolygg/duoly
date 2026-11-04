-- Admins correct win/loss reports and proof screenshots (docs/product/admin-corrections.md).
--
-- A teammate can lie on a win/loss report or upload the wrong screenshots. Admins with the Teammates
-- section (Match reports) or Orders section can now:
--   * correct a match report: wins, losses and the per-game IGNs and links, with a reason. The report
--     shows "Corrected by <admin>" and the winrate (summed from the reports) follows at once.
--   * remove a screenshot, with a reason. Nobody sees it anymore (customer, teammate); the file stays
--     stored privately for disputes and admins can still open it, marked Removed, or restore it.
--   * upload the correct screenshots for the order (up to 5 visible). They go through the same
--     pipeline as a teammate's (size, type and digest checks, private storage) and are marked Added by
--     admin. They are stored on the order's last assignment, so the files sit with the teammate's.
-- The completion record itself (order_completion_proofs, teammate_earning_entries) stays immutable:
-- it records what the teammate submitted; what the customer sees is the corrected set.
-- Every action is in the audit log.
--
-- From 20261022140000_order_proofs.sql: list_order_proofs and get_order_proof (changed: removed
-- screenshots are hidden; admins can still open one). From 20261102160000_win_loss.sql:
-- admin_match_reports (changed: assignmentId and the correction; the caller check is the
-- admin_caller_for('teammates') from 20261105130000_admin_permissions.sql).
begin;

-- ---- data -------------------------------------------------------------------------------------

alter table public.order_match_reports
  add column edited_by uuid references auth.users(id) on delete set null,
  add column edited_by_name text check (pg_catalog.char_length(edited_by_name) <= 120),
  add column edited_at timestamptz,
  add column edit_reason text check (pg_catalog.char_length(edit_reason) <= 200);

create table public.order_proof_removals (
  proof_id uuid primary key references public.order_proof_uploads(id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete restrict,
  removed_by uuid references auth.users(id) on delete set null,
  removed_by_name text not null check (pg_catalog.char_length(removed_by_name) between 1 and 120),
  reason text not null check (pg_catalog.char_length(reason) between 3 and 200),
  removed_at timestamptz not null default pg_catalog.clock_timestamp()
);
create index order_proof_removals_order on public.order_proof_removals(order_id);

create table public.order_proof_admin_uploads (
  proof_id uuid primary key references public.order_proof_uploads(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete restrict,
  admin_id uuid references auth.users(id) on delete set null,
  admin_name text not null check (pg_catalog.char_length(admin_name) between 1 and 120),
  created_at timestamptz not null default pg_catalog.clock_timestamp()
);
create index order_proof_admin_uploads_order on public.order_proof_admin_uploads(order_id);

alter table public.order_proof_removals enable row level security;
alter table public.order_proof_admin_uploads enable row level security;
revoke all on table public.order_proof_removals, public.order_proof_admin_uploads from public, anon, authenticated, service_role;
grant select on table public.order_proof_removals, public.order_proof_admin_uploads to service_role;

-- ---- match reports ----------------------------------------------------------------------------

-- Correct a report. Same rules as the teammate's own (teammate_save_match_report), same number of
-- games as reported; a reason is required.
create function public.admin_edit_match_report(p_assignment_id uuid, p_games jsonb, p_wins integer, p_losses integer, p_reason text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid; v_name text; r public.order_match_reports; v_ref text; v_games jsonb; v_bad boolean;
  v_reason text := pg_catalog.btrim(coalesce(p_reason, '')); v_count integer;
begin
  select id, name into v_actor, v_name from public.admin_caller_for('teammates', 'orders');
  if v_actor is null then return public.order_error(403, 'Admins only.'); end if;
  select m.* into r from public.order_match_reports m where m.assignment_id = p_assignment_id for update;
  if r.assignment_id is null then return public.order_error(404, 'Report not found.'); end if;
  if pg_catalog.char_length(v_reason) < 3 then return public.order_error(400, 'Add a reason. It goes into the audit log.'); end if;
  v_count := pg_catalog.jsonb_array_length(r.games);
  if p_games is null or pg_catalog.jsonb_typeof(p_games) <> 'array' or pg_catalog.jsonb_array_length(p_games) <> v_count then
    return public.order_error(400, 'Keep all ' || v_count::text || ' games.');
  end if;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'teammateIgn', pg_catalog.btrim(g->>'teammateIgn'),
      'customerIgn', pg_catalog.btrim(g->>'customerIgn'),
      'link', pg_catalog.btrim(g->>'link')) order by n), '[]'::jsonb),
    pg_catalog.bool_or(pg_catalog.jsonb_typeof(g) <> 'object'
      or pg_catalog.char_length(coalesce(pg_catalog.btrim(g->>'teammateIgn'), '')) not between 1 and 64
      or pg_catalog.char_length(coalesce(pg_catalog.btrim(g->>'customerIgn'), '')) not between 1 and 64
      or coalesce(pg_catalog.btrim(g->>'link'), '') !~ '^https://[^[:space:]]{4,}$'
      or pg_catalog.char_length(pg_catalog.btrim(g->>'link')) > 300)
    into v_games, v_bad
    from pg_catalog.jsonb_array_elements(p_games) with ordinality x(g, n);
  if v_bad then
    return public.order_error(400, 'Every game needs both IGNs and a match link starting with https://.');
  end if;
  if p_wins is null or p_losses is null or p_wins < 0 or p_losses < 0 or p_wins + p_losses <> v_count then
    return public.order_error(400, 'Wins and losses need to add up to ' || v_count::text || ' games.');
  end if;
  update public.order_match_reports set games = v_games, wins = p_wins, losses = p_losses,
    edited_by = v_actor, edited_by_name = pg_catalog.left(v_name, 120), edited_at = pg_catalog.clock_timestamp(),
    edit_reason = pg_catalog.left(v_reason, 200), updated_at = pg_catalog.clock_timestamp()
   where assignment_id = r.assignment_id;
  select o.public_reference into v_ref from public.orders o where o.id = r.order_id;
  perform public.admin_log(v_actor, v_name, 'Corrected match report', v_ref,
    r.wins || 'W ' || r.losses || 'L → ' || p_wins || 'W ' || p_losses || 'L: ' || v_reason);
  return pg_catalog.jsonb_build_object('report', pg_catalog.jsonb_build_object('assignmentId', r.assignment_id,
    'games', v_games, 'wins', p_wins, 'losses', p_losses,
    'edited', pg_catalog.jsonb_build_object('by', v_name, 'at', pg_catalog.clock_timestamp(), 'reason', v_reason)));
end $$;

-- From 20261102160000_win_loss.sql; changed: assignmentId and the admin correction.
create or replace function public.admin_match_reports(p_limit integer default 200, p_offset integer default 0)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.admin_caller_for('teammates')) then return public.order_error(403, 'Admins only.'); end if;
  return pg_catalog.jsonb_build_object('reports', coalesce((select pg_catalog.jsonb_agg(q.item order by q.at desc) from (
    select m.updated_at at, pg_catalog.jsonb_build_object(
      'orderId', o.id, 'assignmentId', m.assignment_id, 'reference', o.public_reference, 'game', o.game,
      'service', o.service, 'title', o.title, 'units', o.units, 'orderIgn', o.ign, 'customer', o.customer_name,
      'teammate', pg_catalog.jsonb_build_object('id', m.teammate_id,
        'name', coalesce(nullif(p.name, 'Player'), u.email, ''), 'image', coalesce(p.image, '')),
      -- completed: counts in the winrate; open: still playing; handed_over / customer_reroll: doesn't count
      'state', coalesce(a.end_reason, 'open'),
      'games', m.games, 'wins', m.wins, 'losses', m.losses,
      'edited', case when m.edited_at is null then null else pg_catalog.jsonb_build_object(
        'by', coalesce(m.edited_by_name, ''), 'at', m.edited_at, 'reason', coalesce(m.edit_reason, '')) end,
      'createdAt', m.created_at, 'updatedAt', m.updated_at) item
      from public.order_match_reports m
      join public.orders o on o.id = m.order_id
      join public.order_assignments a on a.id = m.assignment_id
      left join public.profiles p on p.id = m.teammate_id
      left join auth.users u on u.id = m.teammate_id
     order by m.updated_at desc
     limit greatest(1, least(coalesce(p_limit, 200), 500)) offset greatest(0, coalesce(p_offset, 0))) q), '[]'::jsonb));
end;
$$;

-- ---- screenshots ------------------------------------------------------------------------------

-- Every finished screenshot of an order for admins: removed ones too, and who added them.
create function public.admin_order_proofs(p_order_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.admin_caller_for('teammates', 'orders')) then
    return public.order_error(403, 'Admins only.');
  end if;
  if not exists (select 1 from public.orders where id = p_order_id) then return public.order_error(404, 'Order not found.'); end if;
  return pg_catalog.jsonb_build_object('proofs', coalesce((select pg_catalog.jsonb_agg(
      public.order_proof_dto(p) || pg_catalog.jsonb_build_object(
        'removed', case when x.proof_id is null then null else pg_catalog.jsonb_build_object(
          'by', x.removed_by_name, 'at', x.removed_at, 'reason', x.reason) end,
        'addedBy', a.admin_name)
      order by p.created_at, p.id)
    from public.order_proof_uploads p
    left join public.order_proof_removals x on x.proof_id = p.id
    left join public.order_proof_admin_uploads a on a.proof_id = p.id
   where p.order_id = p_order_id and p.state = 'ready'), '[]'::jsonb));
end $$;

-- Hide a screenshot from everyone but admins (the file stays for disputes), or show it again.
create function public.admin_set_order_proof_removed(p_order_id uuid, p_proof_id uuid, p_removed boolean, p_reason text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid; v_name text; v_ref text; v_reason text := pg_catalog.btrim(coalesce(p_reason, ''));
begin
  select id, name into v_actor, v_name from public.admin_caller_for('teammates', 'orders');
  if v_actor is null then return public.order_error(403, 'Admins only.'); end if;
  select o.public_reference into v_ref from public.orders o where o.id = p_order_id for update;
  if v_ref is null or not exists (select 1 from public.order_proof_uploads
                                    where id = p_proof_id and order_id = p_order_id and state = 'ready') then
    return public.order_error(404, 'Screenshot not found.');
  end if;
  if coalesce(p_removed, true) then
    if pg_catalog.char_length(v_reason) < 3 then return public.order_error(400, 'Add a reason. It goes into the audit log.'); end if;
    insert into public.order_proof_removals(proof_id, order_id, removed_by, removed_by_name, reason)
      values (p_proof_id, p_order_id, v_actor, pg_catalog.left(v_name, 120), pg_catalog.left(v_reason, 200))
      on conflict (proof_id) do nothing;
    perform public.admin_log(v_actor, v_name, 'Removed a screenshot', v_ref, v_reason);
  else
    delete from public.order_proof_removals where proof_id = p_proof_id;
    perform public.admin_log(v_actor, v_name, 'Restored a screenshot', v_ref, v_reason);
  end if;
  return public.admin_order_proofs(p_order_id);
end $$;

-- Admin upload, step 1: reserve a slot on the order's last assignment (PT errors like the
-- teammate's begin_order_proof_upload; the HTTP handler maps them).
create function public.admin_begin_order_proof_upload(p_order_id uuid, p_request_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid; v_name text; v_order public.orders; v_teammate uuid; v public.order_proof_uploads;
begin
  select id, name into v_actor, v_name from public.admin_caller_for('teammates', 'orders');
  if v_actor is null then raise sqlstate 'PT403' using message = 'Admins only.'; end if;
  if p_order_id is null or p_request_id is null then raise sqlstate 'PT400' using message = 'Invalid proof request.'; end if;
  select o.* into v_order from public.orders o where o.id = p_order_id for update;
  if v_order.id is null then raise sqlstate 'PT404' using message = 'Order not found.'; end if;
  select a.teammate_id into v_teammate from public.order_assignments a
   where a.id = v_order.current_assignment_id and a.order_id = v_order.id;
  if v_teammate is null or v_order.status not in ('in_progress', 'completed') then
    raise sqlstate 'PT409' using message = 'Only orders that were played can get screenshots.';
  end if;
  select p.* into v from public.order_proof_uploads p
   where p.assignment_id = v_order.current_assignment_id and p.request_id = p_request_id for update;
  if v.id is not null then
    if v.state = 'abandoned' then raise sqlstate 'PT409' using message = 'Upload abandoned.'; end if;
    if not exists (select 1 from public.order_proof_admin_uploads where proof_id = v.id) then
      raise sqlstate 'PT409' using message = 'Upload unavailable.';
    end if;
  else
    if (select pg_catalog.count(*) from public.order_proof_uploads p
         where p.order_id = v_order.id and p.state in ('pending', 'ready')
           and not exists (select 1 from public.order_proof_removals x where x.proof_id = p.id)
           and (p.state = 'ready' or exists (select 1 from public.order_proof_admin_uploads a where a.proof_id = p.id))) >= 5 then
      raise sqlstate 'PT409' using message = 'Five screenshots already. Remove one first.';
    end if;
    insert into public.order_proof_uploads(order_id, assignment_id, uploader_id, request_id)
      values (v_order.id, v_order.current_assignment_id, v_teammate, p_request_id) returning * into v;
    insert into public.order_proof_admin_uploads(proof_id, order_id, admin_id, admin_name)
      values (v.id, v_order.id, v_actor, pg_catalog.left(v_name, 120));
  end if;
  return pg_catalog.jsonb_build_object('id', v.id, 'order_id', v.order_id, 'assignment_id', v.assignment_id, 'state', v.state);
end $$;

-- Admin upload, step 2 (server only, after the bytes are stored and checked): mark it ready.
create function public.admin_finalize_order_proof_upload(p_proof_id uuid, p_mime text, p_byte_size integer, p_sha256 text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v public.order_proof_uploads; v_order_id uuid; v_object storage.objects; a public.order_proof_admin_uploads;
begin
  if p_mime is null or p_mime not in ('image/png','image/jpeg','image/webp')
    or p_byte_size is null or p_byte_size not between 1 and 1572864
    or p_sha256 is null or p_sha256 !~ '^[0-9a-f]{64}$' then
    raise sqlstate 'PT400' using message = 'Invalid validated image metadata.';
  end if;
  select p.order_id into v_order_id from public.order_proof_uploads p where p.id = p_proof_id;
  perform 1 from public.orders where id = v_order_id for update;
  select p.* into v from public.order_proof_uploads p where p.id = p_proof_id for update;
  select * into a from public.order_proof_admin_uploads where proof_id = p_proof_id;
  if v.id is null or a.proof_id is null then raise sqlstate 'PT404' using message = 'Proof not found.'; end if;
  if v.state = 'abandoned' then raise sqlstate 'PT409' using message = 'Upload abandoned.'; end if;
  if v.state = 'ready' and (v.mime <> p_mime or v.byte_size <> p_byte_size or v.sha256 <> p_sha256) then
    raise sqlstate 'PT409' using message = 'Proof already finalized with different data.';
  end if;
  select o.* into v_object from storage.objects o where o.bucket_id = 'order-proof' and o.name = v.storage_key for share;
  if v_object.id is null or (v_object.metadata ->> 'size') is distinct from p_byte_size::text
    or (v_object.metadata ->> 'mimetype') is distinct from p_mime then
    raise sqlstate 'PT409' using message = 'Stored image metadata mismatch or missing object.';
  end if;
  if v.state = 'pending' then
    update public.order_proof_uploads set state = 'ready', mime = p_mime, byte_size = p_byte_size,
      sha256 = p_sha256, ready_at = pg_catalog.clock_timestamp() where id = v.id returning * into v;
    perform public.admin_log(a.admin_id, a.admin_name, 'Added a screenshot',
      (select public_reference from public.orders where id = v.order_id), '');
  end if;
  return pg_catalog.jsonb_build_object('proof', public.order_proof_dto(v));
end $$;

-- From 20261022140000_order_proofs.sql; changed: removed screenshots are not listed.
create or replace function public.list_order_proofs(p_order_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_order public.orders; v_actor uuid := auth.uid(); v_all boolean; v_proofs jsonb;
begin
  select o.* into v_order from public.orders as o where o.id = p_order_id for share;
  v_all := public.order_proof_observer(v_order,v_actor);
  if v_order.id is null or not (coalesce(v_all,false) or
    (v_order.status in ('in_progress','completed') and coalesce(public.order_proof_player(v_order,v_actor),false))) then
    raise sqlstate 'PT404' using message = 'Order not found.';
  end if;
  select coalesce(pg_catalog.jsonb_agg(public.order_proof_dto(p) order by p.created_at,p.id),'[]'::jsonb) into v_proofs
    from public.order_proof_uploads as p where p.order_id = p_order_id and p.state = 'ready'
      and not exists (select 1 from public.order_proof_removals x where x.proof_id = p.id)
      and (v_all or (p.assignment_id = v_order.current_assignment_id and p.uploader_id = v_actor));
  return pg_catalog.jsonb_build_object('proofs',v_proofs);
end;
$$;

-- From 20261022140000_order_proofs.sql; changed: a removed screenshot opens for admins only.
create or replace function public.get_order_proof(p_order_id uuid, p_proof_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_order public.orders; v public.order_proof_uploads; v_actor uuid := auth.uid(); v_all boolean;
begin
  select o.* into v_order from public.orders as o where o.id = p_order_id for share;
  v_all := public.order_proof_observer(v_order,v_actor);
  if v_order.id is null or not (coalesce(v_all,false) or
    (v_order.status in ('in_progress','completed') and coalesce(public.order_proof_player(v_order,v_actor),false))) then
    raise sqlstate 'PT404' using message = 'Proof not found.';
  end if;
  select p.* into v from public.order_proof_uploads as p
    where p.order_id = p_order_id and p.id = p_proof_id and p.state = 'ready'
      and (v_all or (p.assignment_id = v_order.current_assignment_id and p.uploader_id = v_actor))
      and (not exists (select 1 from public.order_proof_removals x where x.proof_id = p.id)
           or exists (select 1 from public.account_roles r where r.user_id = v_actor and r.role = 'admin'));
  if v.id is null then raise sqlstate 'PT404' using message = 'Proof not found.'; end if;
  return pg_catalog.jsonb_build_object('proof',public.order_proof_dto(v));
end;
$$;

-- ---- grants -----------------------------------------------------------------------------------

revoke all on function public.admin_edit_match_report(uuid, jsonb, integer, integer, text),
  public.admin_order_proofs(uuid), public.admin_set_order_proof_removed(uuid, uuid, boolean, text),
  public.admin_begin_order_proof_upload(uuid, uuid), public.admin_finalize_order_proof_upload(uuid, text, integer, text)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_edit_match_report(uuid, jsonb, integer, integer, text),
  public.admin_order_proofs(uuid), public.admin_set_order_proof_removed(uuid, uuid, boolean, text),
  public.admin_begin_order_proof_upload(uuid, uuid) to authenticated;
grant execute on function public.admin_finalize_order_proof_upload(uuid, text, integer, text) to service_role;

commit;
