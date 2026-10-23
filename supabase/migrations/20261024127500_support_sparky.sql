-- Sparky support conversations, messages, AI quota and audited admin inbox.
begin;

create table public.support_conversations (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  reference text not null unique default ('S-' || pg_catalog.upper(pg_catalog.substr(pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''), 1, 10))),
  user_id uuid references auth.users(id) on delete set null,
  guest_token_hash text,
  role text not null check (role in ('guest', 'customer', 'teammate')),
  name text not null default 'Guest' check (pg_catalog.char_length(name) between 1 and 120),
  email text not null default '' check (pg_catalog.char_length(email) <= 320),
  image text not null default '' check (pg_catalog.char_length(image) <= 1000),
  status text not null default 'bot' check (status in ('bot', 'waiting', 'human', 'closed')),
  claimed_by uuid references auth.users(id) on delete set null,
  waiting_since timestamptz,
  admin_seen_at timestamptz,
  user_seen_at timestamptz not null default pg_catalog.clock_timestamp(),
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  check ((user_id is not null and guest_token_hash is null and role <> 'guest') or
         (user_id is null and guest_token_hash ~ '^[a-f0-9]{64}$' and role = 'guest'))
);
create unique index support_one_open_user on public.support_conversations(user_id) where user_id is not null and status <> 'closed';
create unique index support_one_open_guest on public.support_conversations(guest_token_hash) where guest_token_hash is not null and status <> 'closed';
create index support_inbox_updated on public.support_conversations(updated_at desc, id);

create table public.support_messages (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  conversation_id uuid not null references public.support_conversations(id) on delete cascade,
  sender text not null check (sender in ('user', 'bot', 'admin', 'system')),
  body text not null check (pg_catalog.char_length(body) between 1 and 2000),
  admin_id uuid references auth.users(id) on delete set null,
  admin_name text not null default '' check (pg_catalog.char_length(admin_name) <= 120),
  admin_image text not null default '' check (pg_catalog.char_length(admin_image) <= 1000),
  metadata jsonb not null default '{}'::jsonb check (pg_catalog.jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  check ((sender = 'admin' and admin_id is not null) or sender <> 'admin')
);
create index support_messages_conversation on public.support_messages(conversation_id, created_at, id);

create table public.support_ai_daily_usage (
  day date primary key,
  calls integer not null default 0 check (calls >= 0)
);

alter table public.support_conversations enable row level security;
alter table public.support_messages enable row level security;
alter table public.support_ai_daily_usage enable row level security;
revoke all on table public.support_conversations, public.support_messages, public.support_ai_daily_usage from public, anon, authenticated, service_role;
grant select, insert, update on table public.support_conversations, public.support_messages to service_role;
grant select, insert, update on table public.support_ai_daily_usage to service_role;

create function public.support_take_ai_slot(p_limit integer) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_calls integer;
begin
  if p_limit < 1 or p_limit > 10000 then return false; end if;
  insert into public.support_ai_daily_usage(day, calls) values (pg_catalog.current_date, 1)
    on conflict (day) do update set calls = public.support_ai_daily_usage.calls + 1
      where public.support_ai_daily_usage.calls < p_limit
    returning calls into v_calls;
  return v_calls is not null and v_calls <= p_limit;
end;
$$;

create function public.support_add_user_message(p_conversation_id uuid, p_body text, p_limit integer default 12) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_text text := pg_catalog.btrim(coalesce(p_body, '')); v_status text; v_message public.support_messages;
begin
  if pg_catalog.char_length(v_text) < 1 or pg_catalog.char_length(v_text) > 500 then return public.order_error(400, 'Messages can be up to 500 characters.'); end if;
  if p_limit < 1 or p_limit > 60 then return public.order_error(400, 'Invalid message limit.'); end if;
  select status into v_status from public.support_conversations where id = p_conversation_id for update;
  if v_status is null then return public.order_error(404, 'Chat not found.'); end if;
  if (select pg_catalog.count(*) from public.support_messages where conversation_id = p_conversation_id and sender = 'user' and created_at > pg_catalog.clock_timestamp() - interval '1 minute') >= p_limit then
    return public.order_error(429, 'Slow down a little, then try again.');
  end if;
  insert into public.support_messages(conversation_id, sender, body) values (p_conversation_id, 'user', v_text) returning * into v_message;
  update public.support_conversations set updated_at = v_message.created_at,
    status = case when status = 'closed' then 'waiting' else status end,
    waiting_since = case when status = 'closed' then v_message.created_at else waiting_since end
    where id = p_conversation_id;
  return pg_catalog.jsonb_build_object('message', pg_catalog.to_jsonb(v_message));
end;
$$;

create function public.admin_support_inbox(p_conversation_id uuid default null) returns jsonb
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
        'order',(select pg_catalog.jsonb_build_object('id',o.public_reference,'status',o.status,'title',o.title,'games',o.units,'game',o.game) from public.orders o where o.customer_id=c.user_id and o.status in ('queued','in_progress') order by o.created_at desc limit 1))
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

create function public.admin_support_command(p_conversation_id uuid, p_action text, p_text text default '') returns jsonb
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
    update public.support_conversations set status='closed',updated_at=pg_catalog.clock_timestamp() where id=p_conversation_id;
    perform public.admin_log(v_actor,v_name,'Closed support chat',v_ref,'');
  elsif p_action = 'seen' then
    update public.support_conversations set admin_seen_at=pg_catalog.clock_timestamp() where id=p_conversation_id;
  else return public.order_error(400, 'Unknown support action.');
  end if;
  return public.admin_support_inbox(p_conversation_id);
end;
$$;

revoke all on function public.support_take_ai_slot(integer), public.support_add_user_message(uuid,text,integer) from public, anon, authenticated, service_role;
grant execute on function public.support_take_ai_slot(integer), public.support_add_user_message(uuid,text,integer) to service_role;
revoke all on function public.admin_support_inbox(uuid), public.admin_support_command(uuid,text,text) from public, anon, authenticated, service_role;
grant execute on function public.admin_support_inbox(uuid), public.admin_support_command(uuid,text,text) to authenticated;

commit;
