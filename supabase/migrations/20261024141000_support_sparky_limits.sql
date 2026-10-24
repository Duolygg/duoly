-- Per-identity AI daily limit and close-cleanup for support conversations.
begin;

-- Track AI calls per user or guest per day so one person cannot burn the global cap.
create table public.support_ai_identity_usage (
  day date not null,
  identity_key text not null,
  calls integer not null default 0 check (calls >= 0),
  primary key (day, identity_key)
);
alter table public.support_ai_identity_usage enable row level security;
revoke all on table public.support_ai_identity_usage from public, anon, authenticated, service_role;
grant select, insert, update on table public.support_ai_identity_usage to service_role;

-- Replace the global-only limiter with one that also caps each user or guest.
drop function public.support_take_ai_slot(integer);

-- Take a per-identity slot: checks both the global cap and the identity cap,
-- then increments both. Returns true when the AI call may proceed.
create or replace function public.support_take_ai_slot(p_limit integer, p_identity_key text, p_identity_limit integer) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_global integer; v_identity integer;
begin
  if p_limit < 1 or p_limit > 10000 then return false; end if;
  if p_identity_limit < 1 or p_identity_limit > 1000 then return false; end if;
  if p_identity_key is null or p_identity_key = '' then return false; end if;
  -- Check global cap without incrementing yet.
  select calls into v_global from public.support_ai_daily_usage where day = current_date;
  if coalesce(v_global, 0) >= p_limit then return false; end if;
  -- Check identity cap.
  select calls into v_identity from public.support_ai_identity_usage where day = current_date and identity_key = p_identity_key;
  if coalesce(v_identity, 0) >= p_identity_limit then return false; end if;
  -- Both caps allow it: consume.
  insert into public.support_ai_daily_usage(day, calls) values (current_date, 1)
    on conflict (day) do update set calls = public.support_ai_daily_usage.calls + 1;
  insert into public.support_ai_identity_usage(day, identity_key, calls) values (current_date, p_identity_key, 1)
    on conflict (day, identity_key) do update set calls = public.support_ai_identity_usage.calls + 1;
  return true;
end;
$$;

revoke all on function public.support_take_ai_slot(integer,text,integer) from public, anon, authenticated, service_role;
grant execute on function public.support_take_ai_slot(integer,text,integer) to service_role;

-- Close: clear claimed_by and waiting_since so a reopened chat starts clean.
create or replace function public.admin_support_command(p_conversation_id uuid, p_action text, p_text text default '') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid; v_name text; v_image text; v_status text; v_text text := pg_catalog.btrim(coalesce(p_text,'')); v_ref text;
begin
  select a.id, a.name, coalesce(p.image,'') into v_actor, v_name, v_image from public.admin_caller() a left join public.profiles p on p.id=a.id;
  if v_actor is null then return public.order_error(403, 'Admins only.'); end if;
  select status, reference into v_status, v_ref from public.support_conversations where id=p_conversation_id for update;
  if v_status is null then return public.order_error(404, 'Chat not found.'); end if;
  if p_action = 'reply' then
    if pg_catalog.char_length(v_text) < 1 or pg_catalog.char_length(v_text) > 2000 then return public.order_error(400, 'Write a reply up to 2000 characters.'); end if;
    if v_status = 'closed' then insert into public.support_messages(conversation_id,sender,body) values (p_conversation_id,'system',v_name || ' reopened the chat.'); end if;
    insert into public.support_messages(conversation_id,sender,body,admin_id,admin_name,admin_image) values (p_conversation_id,'admin',v_text,v_actor,v_name,v_image);
    update public.support_conversations set status='human',claimed_by=coalesce(claimed_by,v_actor),admin_seen_at=pg_catalog.clock_timestamp(),updated_at=pg_catalog.clock_timestamp() where id=p_conversation_id;
    perform public.admin_log(v_actor,v_name,'Replied in support chat',v_ref,pg_catalog.left(v_text,80));
  elsif p_action = 'claim' then
    insert into public.support_messages(conversation_id,sender,body) values (p_conversation_id,'system',v_name || ' joined the chat.');
    update public.support_conversations set status='human',claimed_by=v_actor,admin_seen_at=pg_catalog.clock_timestamp(),updated_at=pg_catalog.clock_timestamp() where id=p_conversation_id;
    perform public.admin_log(v_actor,v_name,'Claimed support chat',v_ref,'');
  elsif p_action = 'bot' then
    insert into public.support_messages(conversation_id,sender,body) values (p_conversation_id,'system',v_name || ' handed the chat back to Sparky.');
    update public.support_conversations set status='bot',claimed_by=null,updated_at=pg_catalog.clock_timestamp() where id=p_conversation_id;
    perform public.admin_log(v_actor,v_name,'Handed support chat to Sparky',v_ref,'');
  elsif p_action = 'close' then
    insert into public.support_messages(conversation_id,sender,body) values (p_conversation_id,'system',v_name || ' closed the chat. Write again anytime.');
    update public.support_conversations set status='closed',claimed_by=null,waiting_since=null,updated_at=pg_catalog.clock_timestamp() where id=p_conversation_id;
    perform public.admin_log(v_actor,v_name,'Closed support chat',v_ref,'');
  elsif p_action = 'seen' then
    update public.support_conversations set admin_seen_at=pg_catalog.clock_timestamp() where id=p_conversation_id;
  else return public.order_error(400, 'Unknown support action.');
  end if;
  return public.admin_support_inbox(p_conversation_id);
end;
$$;

-- Rename context key 'games' to 'units' for the order context in admin inbox.
create or replace function public.admin_support_inbox(p_conversation_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_open jsonb;
begin
  if not exists (select 1 from public.admin_caller()) then return public.order_error(403, 'Admins only.'); end if;
  if p_conversation_id is not null then
    select pg_catalog.jsonb_build_object(
      'id', c.id, 'reference', c.reference, 'role', c.role, 'name', c.name, 'email', c.email, 'image', c.image,
      'status', c.status, 'agent', case when c.claimed_by is null then null else pg_catalog.jsonb_build_object('id', c.claimed_by, 'name', coalesce(nullif(p.name, 'Player'), u.email, 'Admin'), 'image', coalesce(p.image, '')) end,
      'updatedAt', c.updated_at, 'waitingSince', c.waiting_since,
      'unread', case when c.status in ('waiting','human') then (select pg_catalog.count(*) from public.support_messages m where m.conversation_id = c.id and m.sender = 'user' and m.created_at > coalesce(c.admin_seen_at, '-infinity')) else 0 end,
      'messages', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id', m.id, 'from', m.sender, 'text', m.body, 'at', m.created_at,
        'by', case when m.sender = 'admin' then pg_catalog.jsonb_build_object('name', m.admin_name, 'image', m.admin_image) end) order by m.created_at, m.id)
        from public.support_messages m where m.conversation_id = c.id), '[]'::jsonb),
      'context', case when c.role = 'customer' then pg_catalog.jsonb_build_object('kind','customer','orders',(select pg_catalog.count(*) from public.orders o where o.customer_id = c.user_id),
        'order',(select pg_catalog.jsonb_build_object('id',o.public_reference,'status',o.status,'title',o.title,'units',o.units,'game',o.game) from public.orders o where o.customer_id=c.user_id and o.status in ('queued','in_progress') order by o.created_at desc limit 1))
        when c.role = 'teammate' then pg_catalog.jsonb_build_object('kind','teammate','games',pg_catalog.to_jsonb(coalesce(a.approved_games,'{}')),'gg',coalesce(a.gg_access,false),'suspended',coalesce(a.suspended,false),'discord',d.user_id is not null,
          'lifetime',(select pg_catalog.count(*) from public.orders o where o.assigned_teammate_id=c.user_id and o.status='completed'),
          'owed',coalesce((select pg_catalog.sum(o.payout_usd_cents) from public.orders o where o.assigned_teammate_id=c.user_id and o.status='completed'),0)::numeric / 100)
        end)
      into v_open
      from public.support_conversations c
      left join auth.users u on u.id = c.claimed_by
      left join public.profiles p on p.id = c.claimed_by
      left join public.teammate_order_access a on a.user_id = c.user_id
      left join public.discord_accounts d on d.user_id = c.user_id
      where c.id = p_conversation_id;
  end if;
  return pg_catalog.jsonb_build_object('conversations', coalesce((select pg_catalog.jsonb_agg(x order by (x->>'updatedAt') desc) from (
    select pg_catalog.jsonb_build_object('id',c.id,'reference',c.reference,'role',c.role,'name',c.name,'email',c.email,'image',c.image,'status',c.status,
      'updatedAt',c.updated_at,'waitingSince',case when c.status='waiting' then c.waiting_since end,
      'preview',coalesce((select (case when m.sender='admin' then coalesce(nullif(m.admin_name,''),'Admin') || ': ' when m.sender='bot' then 'Sparky: ' else '' end) || pg_catalog.left(m.body,90) from public.support_messages m where m.conversation_id=c.id order by m.created_at desc,m.id desc limit 1),''),
      'unread',case when c.status in ('waiting','human') then (select pg_catalog.count(*) from public.support_messages m where m.conversation_id=c.id and m.sender='user' and m.created_at>coalesce(c.admin_seen_at,'-infinity')) else 0 end) x
      from public.support_conversations c order by c.updated_at desc limit 200) q), '[]'::jsonb), 'open', v_open);
end;
$$;

revoke all on function public.admin_support_inbox(uuid), public.admin_support_command(uuid,text,text) from public, anon, authenticated, service_role;
grant execute on function public.admin_support_inbox(uuid), public.admin_support_command(uuid,text,text) to authenticated;

commit;
