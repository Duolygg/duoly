-- Approved applicants who had no Duoly account yet become teammates the moment they have one
-- with a verified email (the original only told the admin to do it by hand later).
begin;

create function public.claim_approved_application(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_email text; v public.teammate_applications; v_role text;
begin
  select pg_catalog.lower(email) into v_email from auth.users where id = p_user and email_confirmed_at is not null;
  if v_email is null then return; end if;
  select * into v from public.teammate_applications
   where email = v_email and status = 'approved' and account_id is null
   order by decided_at desc limit 1 for update;
  if v.id is null then return; end if;
  select role into v_role from public.account_roles where user_id = p_user for update;
  if v_role is null then return; end if;
  if v_role = 'customer' then
    update public.account_roles set role = 'teammate', role_set_by = v.decided_by, role_set_at = pg_catalog.clock_timestamp()
     where user_id = p_user;
  end if;
  if v_role in ('customer', 'teammate') then
    insert into public.teammate_order_access(user_id, approved_games) values (p_user, array[v.game])
      on conflict (user_id) do update set approved_games = case
        when v.game = any(public.teammate_order_access.approved_games) then public.teammate_order_access.approved_games
        else public.teammate_order_access.approved_games || v.game end;
  end if;
  update public.teammate_applications set account_id = p_user where id = v.id;
  perform public.admin_log(null, 'Duoly', 'Applicant joined', v.reference,
    v.name || ' signed up and ' || case when v_role = 'customer' then 'is now a teammate' else 'kept their ' || v_role || ' role' end);
end;
$$;
revoke all on function public.claim_approved_application(uuid) from public, anon, authenticated, service_role;

create function public.on_auth_user_email_confirmed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.email_confirmed_at is not null and (tg_op = 'INSERT' or old.email_confirmed_at is null or old.email is distinct from new.email) then
    perform public.claim_approved_application(new.id);
  end if;
  return new;
end;
$$;
revoke all on function public.on_auth_user_email_confirmed() from public, anon, authenticated, service_role;

-- Runs after on_auth_user_created_account (alphabetical order), so the role row exists.
create trigger on_auth_user_z_claim_application
  after insert or update of email_confirmed_at, email on auth.users
  for each row execute function public.on_auth_user_email_confirmed();

commit;
