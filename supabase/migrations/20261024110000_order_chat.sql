-- Native order chat. No lifecycle/money RPCs.
-- ACTIVATION GATE: applying this migration enables direct authenticated chat RPCs
-- independently of any HTTP feature flag. WITHHOLD application until explicitly
-- approved for activation; no production SQL has been applied by this change.
begin;
-- Serialize hook installation/backfill with accept, reroll and future completion.
lock table public.orders in share row exclusive mode;

create table public.order_chat_rooms (
  assignment_id uuid primary key references public.order_assignments(id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete restrict,
  next_sequence bigint not null default 1 check (next_sequence > 0),
  unique (assignment_id, order_id)
);
create table public.order_chat_messages (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  assignment_id uuid not null references public.order_chat_rooms(assignment_id) on delete restrict,
  sequence bigint not null check (sequence > 0),
  kind text not null check (kind in ('user','system')),
  sender text not null check (sender in ('customer','teammate','system')),
  name text not null,
  image text not null default '',
  body text not null check (pg_catalog.char_length(body) between 1 and 500),
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  request_id uuid,
  system_event text check (system_event in ('accepted','completed')),
  unique (assignment_id,sequence),
  check ((kind = 'user' and sender <> 'system' and request_id is not null and system_event is null)
    or (kind = 'system' and sender = 'system' and request_id is null and system_event is not null))
);
-- The durable event marker lives on the room, not a prunable message row.
alter table public.order_chat_rooms add column accepted_emitted boolean not null default false;
alter table public.order_chat_rooms add column completed_emitted boolean not null default false;
create table public.order_chat_rate_accounts (
  actor_id uuid primary key references public.profiles(id) on delete restrict
);
create table public.order_chat_attempts (
  actor_id uuid not null references public.order_chat_rate_accounts(actor_id) on delete restrict,
  assignment_id uuid not null references public.order_chat_rooms(assignment_id) on delete restrict,
  request_id uuid not null,
  body_digest bytea not null,
  result jsonb not null,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  primary key (actor_id,assignment_id,request_id)
);
create index order_chat_attempt_rate on public.order_chat_attempts(actor_id,created_at);
create table public.order_chat_typing (
  assignment_id uuid not null references public.order_chat_rooms(assignment_id) on delete restrict,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  role text not null check (role in ('customer','teammate')),
  expires_at timestamptz not null,
  emitted_at timestamptz not null,
  primary key (assignment_id,actor_id)
);
create table public.order_chat_flags (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  order_id uuid not null,
  assignment_id uuid not null,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  sender_name text not null,
  body text not null check (pg_catalog.char_length(body) between 1 and 500),
  rule text not null check (rule in ('Account access','Moving off Duoly','Off-platform payment')),
  status text not null default 'open' check (status in ('open','warned','dismissed')),
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  reviewed_by uuid references public.profiles(id) on delete restrict,
  reviewed_at timestamptz,
  foreign key (assignment_id,order_id) references public.order_chat_rooms(assignment_id,order_id),
  check ((status = 'open' and reviewed_by is null and reviewed_at is null)
    or (status <> 'open' and reviewed_by is not null and reviewed_at is not null))
);
create index order_chat_flags_actor on public.order_chat_flags(actor_id,created_at);
create index order_chat_flags_recent on public.order_chat_flags(created_at desc,id);

alter table public.order_chat_rooms enable row level security;
alter table public.order_chat_messages enable row level security;
alter table public.order_chat_attempts enable row level security;
alter table public.order_chat_rate_accounts enable row level security;
alter table public.order_chat_typing enable row level security;
alter table public.order_chat_flags enable row level security;
revoke all on table public.order_chat_rooms from public, anon, authenticated, service_role;
revoke all on table public.order_chat_messages from public, anon, authenticated, service_role;
revoke all on table public.order_chat_attempts from public, anon, authenticated, service_role;
revoke all on table public.order_chat_rate_accounts from public, anon, authenticated, service_role;
revoke all on table public.order_chat_typing from public, anon, authenticated, service_role;
revoke all on table public.order_chat_flags from public, anon, authenticated, service_role;

-- Private invoker helpers. Reuse account_roles/profiles and the fresh access
-- predicates from teammate_current_assignment. order_eligible is queue-only
-- (priority and reroll exclusions), so must not gate historical-final reads.
create function public.order_chat_viewer(p_order public.orders, p_assignment_id uuid) returns text
language sql stable security invoker set search_path = '' as $$
  select case
    when r.role = 'admin' then 'admin'
    when r.role = 'customer' and p_order.customer_id = auth.uid() then 'customer'
    when r.role = 'teammate' and exists (
      select 1 from public.order_assignments as a
      join public.teammate_order_access as x on x.user_id = a.teammate_id
      where a.id = p_assignment_id and a.order_id = p_order.id
        and a.teammate_id = auth.uid() and a.end_reason is null and a.ended_at is null
        and p_order.current_assignment_id = a.id and p_order.assigned_teammate_id = a.teammate_id
        and not x.suspended and x.discord_id is not null and x.discord_verified_at is not null
        and ((x.gg_access and p_order.gg) or (not x.gg_access and not p_order.gg and p_order.game = any(x.approved_games)))
    ) then 'teammate' else null end
  from public.account_roles as r where r.user_id = auth.uid();
$$;
create function public.order_chat_block_rule(p_body text) returns text
language sql immutable security invoker set search_path = '' as $$
  -- Original chatRules.js categories; PostgreSQL start/end-of-word, not JS boundaries.
  select case
    when p_body ~* '\m(pass(word|wort)?|login details|account details)\M' then 'Account access'
    when p_body ~* '\m(whatsapp|telegram|snapchat)\M' then 'Moving off Duoly'
    when p_body ~* '\m(paypal|venmo|cash ?app|iban|bank transfer|crypto|pay (me|you) (directly|outside))\M' then 'Off-platform payment'
    else null end;
$$;
create function public.order_chat_message_dto(p_message public.order_chat_messages) returns jsonb
language sql immutable security invoker set search_path = '' as $$
  select pg_catalog.jsonb_build_object('id',p_message.id,'sequence',p_message.sequence,
    'kind',p_message.kind,'sender',p_message.sender,'name',p_message.name,'image',p_message.image,
    'body',p_message.body,'created_at',p_message.created_at,'request_id',p_message.request_id);
$$;
create function public.order_chat_append(p_assignment_id uuid,p_sender text,p_name text,p_image text,p_body text,p_request_id uuid,p_event text default null) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare v_sequence bigint; v_message public.order_chat_messages;
begin
  update public.order_chat_rooms set next_sequence = next_sequence + 1
    where assignment_id = p_assignment_id returning next_sequence - 1 into v_sequence;
  insert into public.order_chat_messages(assignment_id,sequence,kind,sender,name,image,body,request_id,system_event)
    values(p_assignment_id,v_sequence,case when p_sender = 'system' then 'system' else 'user' end,
      p_sender,p_name,p_image,p_body,p_request_id,p_event) returning * into v_message;
  delete from public.order_chat_messages where id in
    (select m.id from public.order_chat_messages as m where m.assignment_id = p_assignment_id order by m.sequence desc offset 200);
  return public.order_chat_message_dto(v_message);
end;
$$;
-- Only fixed invalidations leave private storage. realtime.send may swallow
-- provider errors (e.g. missing daily partition); HTTP catch-up remains authoritative.
-- A committed message confirms DB persistence, not recipient websocket delivery.
create function public.order_chat_invalidate(p_assignment_id uuid) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  perform realtime.send('{"changed":true}'::jsonb, 'chat_changed', 'order-chat:' || p_assignment_id::text, true);
end;
$$;
create function public.order_chat_system_events(p_order public.orders) returns void
language plpgsql security invoker set search_path = '' as $$
declare v_room public.order_chat_rooms; v_name text;
begin
  if p_order.current_assignment_id is null or p_order.status not in ('in_progress','completed') then return; end if;
  insert into public.order_chat_rooms(assignment_id,order_id)
    values(p_order.current_assignment_id,p_order.id) on conflict (assignment_id) do nothing;
  select c.* into v_room from public.order_chat_rooms as c where c.assignment_id = p_order.current_assignment_id for update;
  if not v_room.accepted_emitted then
    select p.name into v_name from public.profiles as p where p.id = p_order.assigned_teammate_id;
    perform public.order_chat_append(p_order.current_assignment_id,'system','Duoly','',
      pg_catalog.split_part(v_name,' ',1) || ' accepted the order · ' || p_order.title || ' ×' || p_order.units::text,null,'accepted');
    update public.order_chat_rooms set accepted_emitted = true where assignment_id = p_order.current_assignment_id;
    perform public.order_chat_invalidate(p_order.current_assignment_id);
  end if;
  if p_order.status = 'completed' and not v_room.completed_emitted then
    -- Review/tipping is not active. Do not advertise an unimplemented money flow.
    perform public.order_chat_append(p_order.current_assignment_id,'system','Duoly','','Order complete · GG!',null,'completed');
    update public.order_chat_rooms set completed_emitted = true where assignment_id = p_order.current_assignment_id;
    perform public.order_chat_invalidate(p_order.current_assignment_id);
  end if;
end;
$$;
create function public.order_chat_transition() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.order_chat_system_events(new);
  -- Old subscribers can receive an invalidation, never replacement text/history.
  if tg_op = 'UPDATE' then
    if old.current_assignment_id is not null and
      (old.current_assignment_id is distinct from new.current_assignment_id or old.status is distinct from new.status) then
      perform public.order_chat_invalidate(old.current_assignment_id);
    end if;
  end if;
  return new;
end;
$$;
create trigger orders_chat_transition after insert or update of status,current_assignment_id on public.orders
  for each row execute function public.order_chat_transition();
-- Backfill every assignment room (archives too), but emit events only for actual
-- current accepted/final orders. No queue sweep or lifecycle/payment mutation.
insert into public.order_chat_rooms(assignment_id,order_id) select a.id,a.order_id from public.order_assignments as a;
do $$
declare v public.orders;
begin
  for v in select o.* from public.orders as o where o.status in ('in_progress','completed') loop
    perform public.order_chat_system_events(v);
  end loop;
end;
$$;

create function public.get_order_chat(p_order_id uuid,p_assignment_id uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v public.orders; v_assignment uuid; v_viewer text; v_messages jsonb; v_typing jsonb; v_archives jsonb; v_participant jsonb;
begin
  if auth.uid() is null then return public.order_error(404,'Chat not found.'); end if;
  -- Same role/access -> order lock order as writers. Revocations serialize with
  -- authorized HTTP reads; Realtime membership is only a fresh connection probe.
  perform 1 from public.account_roles as r where r.user_id = auth.uid() for share;
  perform 1 from public.teammate_order_access as x where x.user_id = auth.uid() for share;
  select o.* into v from public.orders as o where o.id = p_order_id for share;
  if v.id is null then return public.order_error(404,'Chat not found.'); end if;
  v_assignment := coalesce(p_assignment_id,v.current_assignment_id);
  v_viewer := public.order_chat_viewer(v,v_assignment);
  if v_viewer is null or (v_assignment is not null and not exists
    (select 1 from public.order_chat_rooms as c where c.assignment_id = v_assignment and c.order_id = v.id)) then
    return public.order_error(404,'Chat not found.');
  end if;
  select coalesce(pg_catalog.jsonb_agg(public.order_chat_message_dto(q) order by q.sequence),'[]'::jsonb) into v_messages
    from (select m.* from public.order_chat_messages as m where m.assignment_id = v_assignment order by m.sequence desc limit 200) as q;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('role',t.role,'expires_at',t.expires_at) order by t.role),'[]'::jsonb) into v_typing
    from public.order_chat_typing as t where t.assignment_id = v_assignment and t.actor_id <> auth.uid()
      and t.expires_at > pg_catalog.clock_timestamp() and v.status = 'in_progress' and v.current_assignment_id = v_assignment;
  v_archives := '[]'::jsonb;
  if v_viewer in ('customer','admin') then
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('assignment_id',a.id,
      'label','Previous conversation · ' || p.name) order by a.accepted_at,a.id),'[]'::jsonb) into v_archives
      from public.order_assignments as a join public.profiles as p on p.id = a.teammate_id
      where a.order_id = v.id and a.end_reason = 'customer_reroll';
  end if;
  if v_assignment is not null then
    if v_viewer = 'teammate' then
      select pg_catalog.jsonb_build_object('role','customer','name',p.name,'image',p.image) into v_participant
        from public.profiles as p where p.id = v.customer_id;
    else
      select pg_catalog.jsonb_build_object('role','teammate','name',p.name,'image',p.image) into v_participant
        from public.order_assignments as a join public.profiles as p on p.id = a.teammate_id where a.id = v_assignment;
    end if;
  end if;
  return pg_catalog.jsonb_build_object('order_id',v.id,'assignment_id',v_assignment,'viewer',v_viewer,
    'writable',coalesce(v_viewer <> 'admin' and v.status = 'in_progress' and v.current_assignment_id = v_assignment,false),
    'participant',v_participant,'messages',v_messages,'typing',v_typing,'archives',v_archives);
end;
$$;

create function public.send_order_chat_message(p_order_id uuid,p_assignment_id uuid,p_request_id uuid,p_body text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v public.orders; v_viewer text; v_prior public.order_chat_attempts;
  v_digest bytea; v_body text; v_rule text; v_result jsonb; v_message jsonb; v_name text; v_image text;
begin
  if v_actor is null then return public.order_error(401,'Authentication required.'); end if;
  -- Preliminary authorization before creating actor state or inspecting/reflection of body.
  if not exists (select 1 from public.orders as o where o.id = p_order_id
    and public.order_chat_viewer(o,p_assignment_id) in ('customer','teammate')) then
    return public.order_error(403,'Chat write forbidden.');
  end if;
  -- Global per-account mutex -> fresh role/access locks -> order -> room.
  insert into public.order_chat_rate_accounts(actor_id) values(v_actor) on conflict (actor_id) do nothing;
  perform 1 from public.order_chat_rate_accounts as s where s.actor_id = v_actor for update;
  perform 1 from public.account_roles as r where r.user_id = v_actor for share;
  perform 1 from public.teammate_order_access as x where x.user_id = v_actor for share;
  select o.* into v from public.orders as o where o.id = p_order_id for update;
  v_viewer := public.order_chat_viewer(v,p_assignment_id);
  if v_viewer is null or v_viewer = 'admin' then return public.order_error(403,'Chat write forbidden.'); end if;
  if p_assignment_id is null or not exists (select 1 from public.order_chat_rooms as c
    where c.assignment_id = p_assignment_id and c.order_id = p_order_id) then return public.order_error(409,'Assignment changed.'); end if;
  perform 1 from public.order_chat_rooms as c where c.assignment_id = p_assignment_id for update;
  if p_request_id is null or p_body is null then return public.order_error(400,'Request UUID and body required.'); end if;
  v_digest := pg_catalog.sha256(pg_catalog.convert_to(p_body,'UTF8'));
  select a.* into v_prior from public.order_chat_attempts as a
    where a.actor_id = v_actor and a.assignment_id = p_assignment_id and a.request_id = p_request_id;
  if found then
    if v_prior.body_digest <> v_digest then return public.order_error(409,'Request UUID already bound to another body.'); end if;
    -- Authorized participant can reconcile a committed send after completion or reroll.
    -- A former teammate fails fresh authorization above; no archive leak via retry.
    return v_prior.result;
  end if;
  if v.status <> 'in_progress' or v.current_assignment_id is distinct from p_assignment_id then return public.order_error(409,'Chat is read-only or assignment changed.'); end if;
  if pg_catalog.char_length(p_body) > 500 then return public.order_error(400,'Messages must be at most 500 code points.'); end if;
  -- Match ECMAScript trim (HTTP input contract), preserving internal newlines/emoji.
  -- Reject rather than silently rewriting controls so send-result body binding holds.
  if p_body ~ E'[\\x01-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F]' then
    return public.order_error(400,'Unsupported control characters.');
  end if;
  v_body := pg_catalog.btrim(p_body,E' \n\r\t' || U&'\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF');
  if pg_catalog.char_length(v_body) = 0 then return public.order_error(400,'Type a message first.'); end if;
  if (select pg_catalog.count(*) from public.order_chat_attempts as a where a.actor_id = v_actor
      and a.created_at > pg_catalog.clock_timestamp() - interval '1 minute') >= 20 then
    return public.order_error(429,'Slow down a little, then try again.');
  end if;
  select p.name,p.image into v_name,v_image from public.profiles as p where p.id = v_actor;
  v_rule := public.order_chat_block_rule(v_body);
  if v_rule is not null then
    -- Match original duplicate-flag protection, even across fresh request UUIDs.
    -- Account lock also serializes this check. Blocked text exists only here.
    if not exists (select 1 from public.order_chat_flags as f where f.actor_id = v_actor and f.body = v_body
      and f.created_at > pg_catalog.clock_timestamp() - interval '1 minute') then
      insert into public.order_chat_flags(order_id,assignment_id,actor_id,sender_name,body,rule)
        values(v.id,p_assignment_id,v_actor,v_name,v_body,v_rule);
    end if;
    v_result := pg_catalog.jsonb_build_object('order_id',v.id,'assignment_id',p_assignment_id,'request_id',p_request_id,
      'outcome','blocked','message',null,'note','Not sent: keep payments and account details on Duoly. Never ask for logins or outside payments.');
  else
    v_message := public.order_chat_append(p_assignment_id,v_viewer,v_name,v_image,v_body,p_request_id);
    v_result := pg_catalog.jsonb_build_object('order_id',v.id,'assignment_id',p_assignment_id,'request_id',p_request_id,
      'outcome','sent','message',v_message,'note',null);
    update public.order_chat_typing set expires_at = pg_catalog.clock_timestamp()
      where assignment_id = p_assignment_id and actor_id = v_actor;
    perform public.order_chat_invalidate(p_assignment_id);
  end if;
  insert into public.order_chat_attempts(actor_id,assignment_id,request_id,body_digest,result)
    values(v_actor,p_assignment_id,p_request_id,v_digest,v_result);
  return v_result;
end;
$$;

create function public.set_order_chat_typing(p_order_id uuid,p_assignment_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v public.orders; v_viewer text; v_now timestamptz; v_emitted timestamptz;
begin
  if auth.uid() is null then return public.order_error(401,'Authentication required.'); end if;
  perform 1 from public.account_roles as r where r.user_id = auth.uid() for share;
  perform 1 from public.teammate_order_access as x where x.user_id = auth.uid() for share;
  select o.* into v from public.orders as o where o.id = p_order_id for update;
  v_viewer := public.order_chat_viewer(v,p_assignment_id);
  if v_viewer is null or v_viewer = 'admin' then return public.order_error(403,'Chat write forbidden.'); end if;
  if v.status <> 'in_progress' or p_assignment_id is null or v.current_assignment_id is distinct from p_assignment_id then
    return public.order_error(409,'Chat is read-only or assignment changed.'); end if;
  perform 1 from public.order_chat_rooms as c where c.assignment_id = p_assignment_id for update;
  v_now := pg_catalog.clock_timestamp();
  select t.emitted_at into v_emitted from public.order_chat_typing as t where t.assignment_id = p_assignment_id and t.actor_id = auth.uid();
  insert into public.order_chat_typing(assignment_id,actor_id,role,expires_at,emitted_at)
    values(p_assignment_id,auth.uid(),v_viewer,v_now + interval '4 seconds',v_now)
    on conflict (assignment_id,actor_id) do update set expires_at = excluded.expires_at,
      emitted_at = case when order_chat_typing.emitted_at <= v_now - interval '2 seconds' then v_now else order_chat_typing.emitted_at end;
  if v_emitted is null or v_emitted <= v_now - interval '2 seconds' then perform public.order_chat_invalidate(p_assignment_id); end if;
  return pg_catalog.jsonb_build_object('order_id',v.id,'assignment_id',p_assignment_id,'ok',true);
end;
$$;
create function public.order_chat_flag_dto(p_flag public.order_chat_flags) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select pg_catalog.jsonb_build_object('id',p_flag.id,'order_id',p_flag.order_id,'assignment_id',p_flag.assignment_id,
    'sender_name',p_flag.sender_name,'body',p_flag.body,'rule',p_flag.rule,'status',p_flag.status,'created_at',p_flag.created_at,
    'warning_count',(select pg_catalog.count(*) from public.order_chat_flags as f where f.actor_id = p_flag.actor_id and f.status = 'warned'));
$$;
create function public.list_order_chat_flags() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_flags jsonb;
begin
  perform 1 from public.account_roles as r where r.user_id = auth.uid() and r.role = 'admin' for share;
  if not found then return public.order_error(case when auth.uid() is null then 401 else 403 end,'Admin role required.'); end if;
  select coalesce(pg_catalog.jsonb_agg(public.order_chat_flag_dto(q) order by q.created_at desc,q.id),'[]'::jsonb) into v_flags
    from (select f.* from public.order_chat_flags as f order by f.created_at desc,f.id limit 50) as q;
  return pg_catalog.jsonb_build_object('flags',v_flags);
end;
$$;
create function public.resolve_order_chat_flag(p_flag_id uuid,p_status text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_flag public.order_chat_flags;
begin
  perform 1 from public.account_roles as r where r.user_id = auth.uid() and r.role = 'admin' for share;
  if not found then return public.order_error(case when auth.uid() is null then 401 else 403 end,'Admin role required.'); end if;
  if p_status is null or p_status not in ('warned','dismissed') then return public.order_error(400,'Invalid flag resolution.'); end if;
  select f.* into v_flag from public.order_chat_flags as f where f.id = p_flag_id for update;
  if not found then return public.order_error(404,'Flag not found.'); end if;
  if v_flag.status = p_status then return pg_catalog.jsonb_build_object('flag',public.order_chat_flag_dto(v_flag)); end if;
  if v_flag.status <> 'open' then return public.order_error(409,'Flag already resolved.'); end if;
  update public.order_chat_flags set status = p_status,reviewed_by = auth.uid(),reviewed_at = pg_catalog.clock_timestamp()
    where id = p_flag_id returning * into v_flag;
  -- Count unique warned flag rows, never an incrementing retry-sensitive counter.
  return pg_catalog.jsonb_build_object('flag',public.order_chat_flag_dto(v_flag));
end;
$$;

create function public.order_chat_can_receive_topic(p_topic text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare v_assignment uuid;
begin
  if p_topic is null or p_topic !~ '^order-chat:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return false; end if;
  v_assignment := pg_catalog.substr(p_topic,12)::uuid;
  return exists (select 1 from public.order_chat_rooms as c join public.orders as o on o.id = c.order_id
    where c.assignment_id = v_assignment and public.order_chat_viewer(o,v_assignment) is not null);
end;
$$;
-- Supabase read probes supply topic/extension, not private=true. Do not gate
-- policies on the optional probe private column: privacy is the fourth send arg
-- and private channel client config. Only authorized Broadcast receives pass.
-- Restrictive gates apply even if another product installed permissive policies.
-- Non-chat topics retain their existing policy behavior; order-chat never accepts
-- application INSERT, including public-channel impersonation/client broadcasts.
create policy order_chat_receive_guard on realtime.messages as restrictive for select to public
  using (coalesce(realtime.topic(),'') not like 'order-chat:%' or
    (extension = 'broadcast' and public.order_chat_can_receive_topic(realtime.topic())));
create policy order_chat_receive on realtime.messages for select to authenticated
  using (extension = 'broadcast' and public.order_chat_can_receive_topic(realtime.topic()));
create policy order_chat_no_client_insert on realtime.messages as restrictive for insert to public
  with check (coalesce(realtime.topic(),'') not like 'order-chat:%'
    and coalesce(topic,'') not like 'order-chat:%');
-- Guard the row topic as well: policy checks must not trust only a caller GUC.
create policy order_chat_row_receive_guard on realtime.messages as restrictive for select to public
  using (coalesce(topic,'') not like 'order-chat:%' or
    (extension = 'broadcast' and public.order_chat_can_receive_topic(topic)));

revoke all on function public.order_chat_viewer(public.orders,uuid), public.order_chat_block_rule(text),
  public.order_chat_message_dto(public.order_chat_messages), public.order_chat_append(uuid,text,text,text,text,uuid,text),
  public.order_chat_invalidate(uuid), public.order_chat_system_events(public.orders), public.order_chat_transition(),
  public.order_chat_flag_dto(public.order_chat_flags), public.order_chat_can_receive_topic(text)
  from public, anon, authenticated, service_role;
-- This helper reveals membership only; execute is necessary for RLS evaluation.
grant execute on function public.order_chat_can_receive_topic(text) to authenticated;
revoke all on function public.get_order_chat(uuid,uuid), public.send_order_chat_message(uuid,uuid,uuid,text),
  public.set_order_chat_typing(uuid,uuid), public.list_order_chat_flags(), public.resolve_order_chat_flag(uuid,text)
  from public, anon, authenticated, service_role;
grant execute on function public.get_order_chat(uuid,uuid) to authenticated;
grant execute on function public.send_order_chat_message(uuid,uuid,uuid,text) to authenticated;
grant execute on function public.set_order_chat_typing(uuid,uuid) to authenticated;
grant execute on function public.list_order_chat_flags() to authenticated;
grant execute on function public.resolve_order_chat_flag(uuid,text) to authenticated;
commit;
