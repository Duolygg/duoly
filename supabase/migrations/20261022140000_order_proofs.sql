-- Private staged screenshots only. No completion or financial transitions.
-- Apply/review in development first; SQL acceptance is intentionally delegated.
begin;

create table public.order_proof_uploads (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  order_id uuid not null,
  assignment_id uuid not null,
  uploader_id uuid not null,
  request_id uuid not null,
  storage_key text generated always as (order_id::text || '/' || assignment_id::text || '/' || id::text) stored,
  state text not null default 'pending' check (state in ('pending','ready','abandoned')),
  mime text check (mime in ('image/png','image/jpeg','image/webp')),
  byte_size integer check (byte_size between 1 and 1572864),
  sha256 text check (sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  ready_at timestamptz,
  abandoned_at timestamptz,
  cleanup_claimed_at timestamptz,
  foreign key (assignment_id, order_id, uploader_id)
    references public.order_assignments(id, order_id, teammate_id) on delete restrict,
  unique (assignment_id, request_id),
  unique (storage_key),
  check (
    (state = 'pending' and mime is null and byte_size is null and sha256 is null and ready_at is null and abandoned_at is null)
    or (state = 'ready' and mime is not null and byte_size is not null and sha256 is not null and ready_at is not null and ready_at >= created_at and abandoned_at is null)
    or (state = 'abandoned' and mime is null and byte_size is null and sha256 is null and ready_at is null and abandoned_at is not null and abandoned_at >= created_at)
  )
);
create index order_proofs_assignment_state on public.order_proof_uploads(assignment_id, state, id);
create index order_proofs_stale on public.order_proof_uploads(created_at, id) include (order_id) where state in ('pending','abandoned');
alter table public.order_proof_uploads enable row level security;
revoke all on table public.order_proof_uploads from public, anon, authenticated, service_role;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('order-proof', 'order-proof', false, 1572864, array['image/png','image/jpeg','image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
-- Restrictive AND, not a permissive policy that another permissive policy bypasses.
create policy order_proof_no_raw_clients on storage.objects
  as restrictive for all to anon, authenticated
  using (bucket_id <> 'order-proof') with check (bucket_id <> 'order-proof');

-- Fresh DB state only. No queue timer/priority reapplication to an accepted order.
create function public.order_proof_player(p_order public.orders, p_actor uuid) returns boolean
language sql volatile security invoker set search_path = '' as $$
  select p_actor is not null and p_order.assigned_teammate_id = p_actor
    and p_order.customer_id <> p_actor
    and exists (select 1 from public.account_roles as r
      join public.teammate_order_access as a on a.user_id = r.user_id
      where r.user_id = p_actor and r.role = 'teammate' and not a.suspended
        and a.discord_id is not null and a.discord_verified_at is not null
        and ((a.gg_access and p_order.gg) or (not a.gg_access and not p_order.gg and p_order.game = any(a.approved_games))))
    and exists (select 1 from public.order_assignments as a
      where a.id = p_order.current_assignment_id and a.order_id = p_order.id
        and a.teammate_id = p_actor and a.end_reason is distinct from 'customer_reroll');
$$;
revoke all on function public.order_proof_player(public.orders,uuid) from public, anon, authenticated, service_role;

-- HTTP preflight only: no sweep-capable assignment RPC and no reservations.
-- SHARE lasts until the caller transaction ends; HTTP calls must be short.
create function public.authorize_order_proof_upload(p_order_id uuid, p_assignment_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_order public.orders;
begin
  if v_actor is null then raise sqlstate 'PT401' using message = 'Authentication required.'; end if;
  if not exists (select 1 from public.account_roles where user_id = v_actor and role = 'teammate') then
    raise sqlstate 'PT403' using message = 'Teammate role required.';
  end if;
  if p_order_id is null or p_assignment_id is null then
    raise sqlstate 'PT400' using message = 'Invalid proof request.';
  end if;
  select o.* into v_order from public.orders as o where o.id = p_order_id for share;
  if v_order.id is null or not coalesce(public.order_proof_player(v_order, v_actor), false) then
    raise sqlstate 'PT404' using message = 'Order not found.';
  end if;
  if v_order.status <> 'in_progress' or v_order.current_assignment_id <> p_assignment_id
    or not exists (select 1 from public.order_assignments where id = p_assignment_id and ended_at is null) then
    raise sqlstate 'PT409' using message = 'Assignment unavailable.';
  end if;
  return pg_catalog.jsonb_build_object('order_id',v_order.id,'assignment_id',v_order.current_assignment_id);
end;
$$;
revoke all on function public.authorize_order_proof_upload(uuid,uuid) from public, anon, authenticated, service_role;
grant execute on function public.authorize_order_proof_upload(uuid,uuid) to authenticated;

create function public.begin_order_proof_upload(p_order_id uuid, p_assignment_id uuid, p_request_id uuid) returns jsonb
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
    if (select count(*) from public.order_proof_uploads where assignment_id = p_assignment_id and state in ('pending','ready')) >= 5 then
      raise sqlstate 'PT409' using message = 'Five proof slots already reserved.';
    end if;
    insert into public.order_proof_uploads(order_id,assignment_id,uploader_id,request_id)
      values(p_order_id,p_assignment_id,v_actor,p_request_id) returning * into v;
  end if;
  return pg_catalog.jsonb_build_object('id',v.id,'order_id',v.order_id,'assignment_id',v.assignment_id,'state',v.state);
end;
$$;
revoke all on function public.begin_order_proof_upload(uuid,uuid,uuid) from public, anon, authenticated, service_role;
grant execute on function public.begin_order_proof_upload(uuid,uuid,uuid) to authenticated;

-- Enforce update immutability, but do not block owner DELETE maintenance.
-- No application role has DELETE; ready retention is an owner-approved operation.
create function public.order_proof_guard() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if old.state = 'ready'
    or (old.state = 'abandoned' and
      (pg_catalog.to_jsonb(new) - 'cleanup_claimed_at' - 'storage_key') is distinct from (pg_catalog.to_jsonb(old) - 'cleanup_claimed_at' - 'storage_key'))
    or new.id is distinct from old.id or new.order_id is distinct from old.order_id
    or new.assignment_id is distinct from old.assignment_id or new.uploader_id is distinct from old.uploader_id
    or new.request_id is distinct from old.request_id or new.created_at is distinct from old.created_at then
    raise sqlstate 'PT409' using message = 'Proof metadata is immutable.';
  end if;
  return new;
end;
$$;
create trigger order_proof_guard before update on public.order_proof_uploads
  for each row execute function public.order_proof_guard();
revoke all on function public.order_proof_guard() from public, anon, authenticated, service_role;

create function public.order_proof_dto(p public.order_proof_uploads) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select pg_catalog.jsonb_build_object('id',p.id,'order_id',p.order_id,'assignment_id',p.assignment_id,
    'mime',p.mime,'byte_size',p.byte_size,'created_at',p.created_at);
$$;
revoke all on function public.order_proof_dto(public.order_proof_uploads) from public, anon, authenticated, service_role;

create function public.finalize_order_proof_upload(p_proof_id uuid, p_mime text, p_byte_size integer, p_sha256 text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v public.order_proof_uploads; v_order public.orders; v_order_id uuid; v_object storage.objects;
begin
  if p_mime is null or p_mime not in ('image/png','image/jpeg','image/webp')
    or p_byte_size is null or p_byte_size not between 1 and 1572864
    or p_sha256 is null or p_sha256 !~ '^[0-9a-f]{64}$' then
    raise sqlstate 'PT400' using message = 'Invalid validated image metadata.';
  end if;
  -- Locator lookup is deliberately unlocked. Identity is immutable; lock ORDER first.
  select p.order_id into v_order_id from public.order_proof_uploads as p where p.id = p_proof_id;
  select o.* into v_order from public.orders as o where o.id = v_order_id for update;
  select p.* into v from public.order_proof_uploads as p where p.id = p_proof_id for update;
  if v.id is null or v_order.id is null then raise sqlstate 'PT404' using message = 'Proof not found.'; end if;
  if v_order.status <> 'in_progress' or v_order.current_assignment_id is distinct from v.assignment_id
    or not coalesce(public.order_proof_player(v_order, v.uploader_id), false)
    or not exists (select 1 from public.order_assignments where id = v.assignment_id and ended_at is null)
    or v.state = 'abandoned' then
    raise sqlstate 'PT409' using message = 'Upload assignment unavailable.';
  end if;
  if v.state = 'ready' and (v.mime <> p_mime or v.byte_size <> p_byte_size or v.sha256 <> p_sha256) then
    raise sqlstate 'PT409' using message = 'Proof already finalized with different data.';
  end if;
  -- Provider-generated metadata, NOT user_metadata. SQL cannot inspect object bytes:
  -- trusted HTTP validates magic + actual bytes/digest before calling this RPC.
  select o.* into v_object from storage.objects as o
    where o.bucket_id = 'order-proof' and o.name = v.storage_key for share;
  if v_object.id is null or (v_object.metadata ->> 'size') is distinct from p_byte_size::text
    or (v_object.metadata ->> 'mimetype') is distinct from p_mime then
    raise sqlstate 'PT409' using message = 'Stored image metadata mismatch or missing object.';
  end if;
  if v.state = 'pending' then
    update public.order_proof_uploads set state = 'ready', mime = p_mime, byte_size = p_byte_size,
      sha256 = p_sha256, ready_at = pg_catalog.clock_timestamp() where id = v.id returning * into v;
  end if;
  return pg_catalog.jsonb_build_object('proof',public.order_proof_dto(v));
end;
$$;
revoke all on function public.finalize_order_proof_upload(uuid,text,integer,text) from public, anon, authenticated, service_role;
grant execute on function public.finalize_order_proof_upload(uuid,text,integer,text) to service_role;

create function public.order_proof_observer(p_order public.orders, p_actor uuid) returns boolean
language sql volatile security invoker set search_path = '' as $$
  select p_actor is not null and exists (select 1 from public.account_roles as r
    where r.user_id = p_actor and (r.role = 'admin' or (r.role = 'customer' and p_order.customer_id = p_actor)));
$$;
revoke all on function public.order_proof_observer(public.orders,uuid) from public, anon, authenticated, service_role;

create function public.list_order_proofs(p_order_id uuid) returns jsonb
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
      and (v_all or (p.assignment_id = v_order.current_assignment_id and p.uploader_id = v_actor));
  return pg_catalog.jsonb_build_object('proofs',v_proofs);
end;
$$;
create function public.get_order_proof(p_order_id uuid, p_proof_id uuid) returns jsonb
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
      and (v_all or (p.assignment_id = v_order.current_assignment_id and p.uploader_id = v_actor));
  if v.id is null then raise sqlstate 'PT404' using message = 'Proof not found.'; end if;
  return pg_catalog.jsonb_build_object('proof',public.order_proof_dto(v));
end;
$$;
revoke all on function public.list_order_proofs(uuid), public.get_order_proof(uuid,uuid) from public, anon, authenticated, service_role;
grant execute on function public.list_order_proofs(uuid), public.get_order_proof(uuid,uuid) to authenticated;

create function public.abandon_order_proof_upload(p_proof_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v public.order_proof_uploads; v_order_id uuid;
begin
  select p.order_id into v_order_id from public.order_proof_uploads as p where p.id = p_proof_id;
  perform 1 from public.orders where id = v_order_id for update;
  select p.* into v from public.order_proof_uploads as p where p.id = p_proof_id for update;
  if v.id is null then return pg_catalog.jsonb_build_object('abandoned',false); end if;
  if v.state = 'ready' then
    return pg_catalog.jsonb_build_object('abandoned',false);
  end if;
  if v.state = 'pending' then
    update public.order_proof_uploads set state = 'abandoned', abandoned_at = pg_catalog.clock_timestamp() where id = v.id;
  end if;
  return pg_catalog.jsonb_build_object('abandoned',true);
end;
$$;

-- Existing reroll already owns the order lock. Explicitly take it here as well so
-- maintenance callers follow the same order -> proof sequence. Maintenance must
-- lock the order BEFORE editing assignments (as the existing reroll RPC does).
create function public.order_proof_assignment_ended() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform 1 from public.orders where id = new.order_id for update;
  for v_id in select id from public.order_proof_uploads
    where assignment_id = new.id and state = 'pending' order by id for update
  loop
    update public.order_proof_uploads set state = 'abandoned', abandoned_at = pg_catalog.clock_timestamp() where id = v_id;
  end loop;
  return new;
end;
$$;
create trigger order_proof_assignment_ended after update of ended_at on public.order_assignments
  for each row when (old.ended_at is null and new.ended_at is not null)
  execute function public.order_proof_assignment_ended();
revoke all on function public.order_proof_assignment_ended() from public, anon, authenticated, service_role;

-- Private maintenance position, not a reservation, lease, or financial state.
-- Advance past SKIPPED work too: an arbitrarily long locked frontier must not
-- pin every future call to the same bounded discovery window.
create table public.order_proof_cleanup_cursor (
  singleton boolean primary key default true check (singleton),
  cycle_cutoff timestamptz not null default (pg_catalog.clock_timestamp() - interval '1 hour'),
  last_created_at timestamptz,
  last_id uuid,
  check ((last_created_at is null) = (last_id is null))
);
insert into public.order_proof_cleanup_cursor(singleton) values (true);
alter table public.order_proof_cleanup_cursor enable row level security;
revoke all on table public.order_proof_cleanup_cursor from public, anon, authenticated, service_role;

create function public.claim_stale_order_proof_uploads(p_limit integer default 100) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_order_id uuid; v public.order_proof_uploads; v_locked public.order_proof_uploads; v_candidates uuid[];
  v_lockable_orders uuid[] := array[]::uuid[];
  v_cursor public.order_proof_cleanup_cursor;
  v_scan_limit integer;
  v_cutoff timestamptz;
  v_claimed jsonb := '[]'::jsonb;
begin
  if p_limit is null or p_limit not between 1 and 500 then
    raise sqlstate 'PT400' using message = 'Claim limit must be 1..500.';
  end if;
  v_scan_limit := least(5000, greatest(100, p_limit * 10));
  -- Serialize claimers only. Every call must commit its traversal progress.
  select c.* into v_cursor from public.order_proof_cleanup_cursor as c
    where c.singleton for update skip locked;
  if v_cursor.singleton is null then
    return pg_catalog.jsonb_build_object('proofs',v_claimed);
  end if;
  -- Fixed epoch and immutable ordering prevent newly retried rows from moving
  -- ahead of the cursor. New arrivals enter at the next wrap, not this epoch.
  v_cutoff := v_cursor.cycle_cutoff;
  select pg_catalog.array_agg(c.id order by c.created_at, c.id) into v_candidates from (
    select p.id, p.created_at from public.order_proof_uploads as p
      where p.state in ('pending','abandoned') and p.created_at < v_cutoff
        and (v_cursor.last_id is null or
          (p.created_at, p.id) > (v_cursor.last_created_at, v_cursor.last_id))
      order by p.created_at, p.id limit v_scan_limit
  ) as c;
  if v_candidates is null then
    v_cutoff := pg_catalog.clock_timestamp() - interval '1 hour';
    update public.order_proof_cleanup_cursor set cycle_cutoff = v_cutoff,
      last_created_at = null, last_id = null where singleton;
    select pg_catalog.array_agg(c.id order by c.created_at, c.id) into v_candidates from (
      select p.id, p.created_at from public.order_proof_uploads as p
        where p.state in ('pending','abandoned') and p.created_at < v_cutoff
        order by p.created_at, p.id limit v_scan_limit
    ) as c;
  end if;
  -- Lock bounded selected orders in UUID order before any proof lock.
  for v_order_id in select o.id from public.orders as o
    where exists (select 1 from public.order_proof_uploads as p where p.order_id = o.id and p.id = any(v_candidates))
    order by o.id for update skip locked
  loop
    v_lockable_orders := pg_catalog.array_append(v_lockable_orders,v_order_id);
  end loop;
  for v in select p.* from public.order_proof_uploads as p
    where p.id = any(v_candidates) order by p.created_at, p.id
  loop
    -- Advance only through VISITED candidates, including skipped locked work.
    -- Never advance past unvisited rows when the returned-work limit is met.
    update public.order_proof_cleanup_cursor set last_created_at = v.created_at,
      last_id = v.id where singleton;
    if not (v.order_id = any(v_lockable_orders)) then continue; end if;
    select p.* into v_locked from public.order_proof_uploads as p where p.id = v.id for update skip locked;
    if not found then continue; end if;
    if v_locked.state not in ('pending','abandoned') or v_locked.created_at >= v_cutoff then continue; end if;
    update public.order_proof_uploads set state = 'abandoned',
      abandoned_at = coalesce(abandoned_at,pg_catalog.clock_timestamp()),
      cleanup_claimed_at = pg_catalog.clock_timestamp() where id = v_locked.id;
    v_claimed := v_claimed || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'id',v_locked.id,'order_id',v_locked.order_id,'assignment_id',v_locked.assignment_id));
    exit when pg_catalog.jsonb_array_length(v_claimed) >= p_limit;
  end loop;
  return pg_catalog.jsonb_build_object('proofs',v_claimed);
end;
$$;
revoke all on function public.abandon_order_proof_upload(uuid), public.claim_stale_order_proof_uploads(integer) from public, anon, authenticated, service_role;
grant execute on function public.abandon_order_proof_upload(uuid), public.claim_stale_order_proof_uploads(integer) to service_role;

commit;
