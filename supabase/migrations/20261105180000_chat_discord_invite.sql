-- The order chat invites customers to the Duoly Discord for voice comms (owner request 2026-11-05).
--
-- When a teammate accepts, the chat gets one more system message after "… accepted the order": the
-- invite link. It is sent once per customer account, ever: re-rolls, handovers and later orders
-- don't send it again. The marker is its own table (not a chat row, which the 200-message cap can
-- prune, and not a profiles column, which a profile update could reset).
--
-- The text must match DISCORD_INVITE_MESSAGE in src/site/nav.ts: the chat shows a message with that
-- link as a Discord card (a unit test compares them).
--
-- order_chat_system_events is the 20261024110000_order_chat.sql version; changed: the invite after
-- the accepted message. Customers who already had orders get the invite on their next accepted order.
begin;

alter table public.order_chat_messages
  drop constraint order_chat_messages_system_event_check,
  add constraint order_chat_messages_system_event_check
    check (system_event in ('accepted','completed','reviewed','handed_over','discord_invite'));

create table public.order_chat_discord_invites (
  customer_id uuid primary key references public.profiles(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete restrict,
  sent_at timestamptz not null default pg_catalog.clock_timestamp()
);
alter table public.order_chat_discord_invites enable row level security;
revoke all on table public.order_chat_discord_invites from public, anon, authenticated, service_role;

create or replace function public.order_chat_system_events(p_order public.orders) returns void
language plpgsql security invoker set search_path = '' as $$
declare v_room public.order_chat_rooms; v_name text; v_invited uuid;
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
    -- once per customer: the insert only wins the first time, under the primary key
    if p_order.status = 'in_progress' then
      insert into public.order_chat_discord_invites(customer_id,order_id)
        values(p_order.customer_id,p_order.id) on conflict (customer_id) do nothing
        returning customer_id into v_invited;
      if v_invited is not null then
        perform public.order_chat_append(p_order.current_assignment_id,'system','Duoly','',
          'Join our Discord for voice comms with your teammate: https://discord.gg/KuVyByUyV4',null,'discord_invite');
      end if;
    end if;
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
revoke all on function public.order_chat_system_events(public.orders) from public, anon, authenticated, service_role;

commit;
