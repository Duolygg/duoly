-- Chat moderation decisions go into the admin audit log like every other admin action (spec:
-- "every admin action: who, action, target, detail"). A trigger, so resolve_order_chat_flag and
-- any future path are covered without changing the chat RPCs.
begin;

create function public.order_chat_flag_audit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_name text;
begin
  if old.status = 'open' and new.status in ('warned', 'dismissed') then
    select coalesce(nullif(p.name, 'Player'), u.email, 'Admin') into v_name
      from auth.users as u left join public.profiles as p on p.id = u.id where u.id = new.reviewed_by;
    perform public.admin_log(new.reviewed_by, coalesce(v_name, 'Admin'),
      case new.status when 'warned' then 'Warned user' else 'Dismissed chat flag' end,
      new.sender_name,
      new.rule || ' · “' || pg_catalog.left(new.body, 60) || case when pg_catalog.char_length(new.body) > 60 then '…' else '' end || '”');
  end if;
  return new;
end;
$$;
revoke all on function public.order_chat_flag_audit() from public, anon, authenticated, service_role;

create trigger order_chat_flags_audit
  after update of status on public.order_chat_flags
  for each row execute function public.order_chat_flag_audit();

commit;
