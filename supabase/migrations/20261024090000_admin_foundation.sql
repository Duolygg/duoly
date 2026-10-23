-- Admin foundation: owners, role and game-access changes, teammate applications and the audit log.
-- Port of the original lib/roles.js (setRole/setAccess/allAccounts), lib/applications.js,
-- lib/audit.js and app/api/admin/{users,applications,audit}. JSON files become tables; every
-- admin command is one security-definer RPC that re-checks the caller is an admin and writes
-- its own audit row, so the log cannot be skipped or forged from the browser.
begin;

-- Owners come from the ADMIN_EMAILS server setting. The server mirrors that list here (service
-- role only) so the database itself refuses to demote an owner.
alter table public.account_roles
  add column owner boolean not null default false,
  add column role_set_by uuid references auth.users(id) on delete set null,
  add column role_set_at timestamptz,
  add constraint account_roles_owner_is_admin check (not owner or role = 'admin');

create table public.admin_audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default pg_catalog.clock_timestamp(),
  actor_id uuid references auth.users(id) on delete set null,
  actor_name text not null check (pg_catalog.char_length(actor_name) between 1 and 120),
  action text not null check (pg_catalog.char_length(action) between 1 and 60),
  target text not null default '' check (pg_catalog.char_length(target) <= 160),
  detail text not null default '' check (pg_catalog.char_length(detail) <= 400)
);
create index admin_audit_log_recent on public.admin_audit_log(id desc);

create sequence public.teammate_application_seq start with 541;
create table public.teammate_applications (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  reference text not null unique default ('A-' || pg_catalog.nextval('public.teammate_application_seq'::pg_catalog.regclass)::text),
  name text not null check (pg_catalog.char_length(name) between 2 and 60),
  email text not null check (pg_catalog.char_length(email) <= 120 and email = pg_catalog.lower(email) and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  discord text not null check (pg_catalog.char_length(discord) between 2 and 40),
  country text not null default '' check (pg_catalog.char_length(country) <= 40),
  game text not null check (game in ('lol','val','cs2','fn','cod','apex','r6','mr','ow','rl','tft','fc','arc','mc','pu')),
  rank text not null check (pg_catalog.char_length(rank) between 1 and 60),
  region text not null check (pg_catalog.char_length(region) between 1 and 40),
  role text not null default '' check (pg_catalog.char_length(role) <= 60),
  link text not null default '' check (pg_catalog.char_length(link) <= 200),
  hours text not null check (hours in ('5–10','10–20','20–30','30+')),
  why text not null default '' check (pg_catalog.char_length(why) <= 600),
  services text[] not null check (pg_catalog.cardinality(services) between 1 and 4
    and services <@ array['Duo','Coaching','Social','Gamer Girl']::text[]
    and pg_catalog.array_position(services, null) is null),
  submitted_at timestamptz not null default pg_catalog.clock_timestamp(),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reason text not null default '' check (pg_catalog.char_length(reason) <= 120),
  decided_by uuid references auth.users(id) on delete set null,
  decided_by_name text not null default '',
  decided_at timestamptz,
  account_id uuid references auth.users(id) on delete set null,
  check ((status = 'pending') = (decided_at is null))
);
alter sequence public.teammate_application_seq owned by public.teammate_applications.reference;
create unique index teammate_applications_one_pending on public.teammate_applications(email) where status = 'pending';
create index teammate_applications_recent on public.teammate_applications(submitted_at desc);

alter table public.admin_audit_log enable row level security;
alter table public.teammate_applications enable row level security;
revoke all on table public.admin_audit_log from public, anon, authenticated, service_role;
revoke all on table public.teammate_applications from public, anon, authenticated, service_role;
revoke all on sequence public.teammate_application_seq from public, anon, authenticated, service_role;
grant select on table public.admin_audit_log, public.teammate_applications to service_role;

-- ---- private helpers ------------------------------------------------------------------------

-- The calling admin (id + display name), or null.
create function public.admin_caller() returns table (id uuid, name text)
language sql stable security invoker set search_path = '' as $$
  select r.user_id, coalesce(nullif(p.name, 'Player'), u.email, 'Admin')::text
    from public.account_roles as r
    join auth.users as u on u.id = r.user_id
    left join public.profiles as p on p.id = r.user_id
   where r.user_id = (select auth.uid()) and r.role = 'admin';
$$;

create function public.admin_log(p_actor uuid, p_actor_name text, p_action text, p_target text, p_detail text)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  insert into public.admin_audit_log(actor_id, actor_name, action, target, detail)
    values (p_actor, pg_catalog.left(p_actor_name, 120), p_action,
            pg_catalog.left(coalesce(p_target, ''), 160), pg_catalog.left(coalesce(p_detail, ''), 400));
  -- Keep the newest 2000 entries (spec).
  delete from public.admin_audit_log where id <= (select pg_catalog.max(id) - 2000 from public.admin_audit_log);
end;
$$;

-- One account as the admin Users screen shows it.
create function public.admin_account_dto(p_user uuid, p_viewer uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select pg_catalog.jsonb_build_object(
    'id', u.id,
    'name', coalesce(p.name, ''),
    'email', coalesce(u.email, ''),
    'image', coalesce(p.image, ''),
    'country', coalesce(p.country, ''),
    'provider', coalesce(u.raw_app_meta_data ->> 'provider', 'email'),
    'role', r.role,
    'owner', r.owner,
    'you', u.id = p_viewer,
    'roleBy', coalesce((select coalesce(nullif(bp.name, 'Player'), bu.email) from auth.users as bu
                        left join public.profiles as bp on bp.id = bu.id where bu.id = r.role_set_by), ''),
    'roleAt', r.role_set_at,
    'firstSeen', u.created_at,
    'lastSeen', u.last_sign_in_at,
    'discord', (select d.username from public.discord_accounts as d where d.user_id = u.id),
    'access', case when a.user_id is null then pg_catalog.jsonb_build_object('games', '[]'::jsonb, 'gg', false, 'suspended', false)
      else pg_catalog.jsonb_build_object('games', pg_catalog.to_jsonb(a.approved_games), 'gg', a.gg_access, 'suspended', a.suspended) end,
    'busy', exists (select 1 from public.orders as o where o.assigned_teammate_id = u.id and o.status = 'in_progress'))
  from auth.users as u
  join public.account_roles as r on r.user_id = u.id
  left join public.profiles as p on p.id = u.id
  left join public.teammate_order_access as a on a.user_id = u.id
  where u.id = p_user;
$$;

create function public.admin_application_dto(p public.teammate_applications) returns jsonb
language sql immutable security invoker set search_path = '' as $$
  select pg_catalog.jsonb_build_object(
    'id', p.id, 'reference', p.reference, 'name', p.name, 'email', p.email, 'discord', p.discord,
    'country', p.country, 'game', p.game, 'rank', p.rank, 'region', p.region, 'role', p.role,
    'link', p.link, 'hours', p.hours, 'why', p.why, 'services', pg_catalog.to_jsonb(p.services),
    'submittedAt', p.submitted_at, 'status', p.status, 'reason', p.reason,
    'decidedBy', p.decided_by_name, 'decidedAt', p.decided_at, 'accountId', p.account_id);
$$;

-- Role change shared by the Users screen and application approval. Caller already verified admin.
create function public.admin_apply_role(p_actor uuid, p_actor_name text, p_target uuid, p_role text) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare v public.account_roles; v_label text;
begin
  if p_role not in ('customer', 'teammate', 'admin') then return public.order_error(400, 'Unknown role.'); end if;
  -- Same row lock accept_order takes, so a role change can't race an order being accepted.
  select * into v from public.account_roles where user_id = p_target for update;
  if v.user_id is null then return public.order_error(404, 'Account not found.'); end if;
  if v.owner then return public.order_error(403, 'Owners are set in ADMIN_EMAILS and can’t be changed here.'); end if;
  if p_target = p_actor then return public.order_error(403, 'You can’t change your own role.'); end if;
  if v.role = p_role then return pg_catalog.jsonb_build_object('account', public.admin_account_dto(p_target, p_actor)); end if;
  if p_role <> 'teammate' and exists (select 1 from public.orders where assigned_teammate_id = p_target and status = 'in_progress') then
    return public.order_error(409, 'They’re playing an order right now. Change their role once it’s finished.');
  end if;
  if p_role <> 'customer' and exists (select 1 from public.orders where customer_id = p_target and status in ('queued', 'in_progress')) then
    return public.order_error(409, 'They have an order open as a customer. Change their role once it’s finished.');
  end if;
  update public.account_roles set role = p_role, role_set_by = p_actor, role_set_at = pg_catalog.clock_timestamp()
   where user_id = p_target;
  -- New teammates start with no games and the default priority (they get no orders until unlocked).
  if p_role = 'teammate' then
    insert into public.teammate_order_access(user_id) values (p_target) on conflict (user_id) do nothing;
  end if;
  select coalesce(nullif(p.name, 'Player'), u.email, '') into v_label
    from auth.users as u left join public.profiles as p on p.id = u.id where u.id = p_target;
  perform public.admin_log(p_actor, p_actor_name, 'Changed role', v_label,
    pg_catalog.initcap(v.role) || ' → ' || pg_catalog.initcap(p_role));
  return pg_catalog.jsonb_build_object('account', public.admin_account_dto(p_target, p_actor));
end;
$$;

-- ---- admin RPCs (authenticated; each re-checks the admin role) --------------------------------

create function public.admin_accounts() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_actor uuid;
begin
  select id into v_actor from public.admin_caller();
  if v_actor is null then return public.order_error(403, 'Admins only.'); end if;
  return pg_catalog.jsonb_build_object('accounts', coalesce((
    select pg_catalog.jsonb_agg(public.admin_account_dto(r.user_id, v_actor) order by u.created_at)
      from public.account_roles as r join auth.users as u on u.id = r.user_id), '[]'::jsonb));
end;
$$;

create function public.admin_set_role(p_user_id uuid, p_role text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid; v_name text;
begin
  select id, name into v_actor, v_name from public.admin_caller();
  if v_actor is null then return public.order_error(403, 'Admins only.'); end if;
  return public.admin_apply_role(v_actor, v_name, p_user_id, p_role);
end;
$$;

create function public.admin_set_access(p_user_id uuid, p_games text[], p_gg boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid; v_name text; v_role text; v_games text[]; v_label text;
begin
  select id, name into v_actor, v_name from public.admin_caller();
  if v_actor is null then return public.order_error(403, 'Admins only.'); end if;
  select role into v_role from public.account_roles where user_id = p_user_id for update;
  if v_role is null then return public.order_error(404, 'Account not found.'); end if;
  if v_role <> 'teammate' then return public.order_error(409, 'Only teammates get order access. Make them a teammate first.'); end if;
  -- Canonical order, unknown ids dropped (lib/access.js).
  select coalesce(pg_catalog.array_agg(g order by i), '{}') into v_games
    from pg_catalog.unnest(array['lol','val','cs2','fn','cod','apex','r6','mr','ow','rl','tft','fc','arc','mc','pu']::text[]) with ordinality as t(g, i)
   where g = any(coalesce(p_games, '{}'));
  insert into public.teammate_order_access(user_id, approved_games, gg_access) values (p_user_id, v_games, coalesce(p_gg, false))
    on conflict (user_id) do update set approved_games = excluded.approved_games, gg_access = excluded.gg_access;
  select coalesce(nullif(p.name, 'Player'), u.email, '') into v_label
    from auth.users as u left join public.profiles as p on p.id = u.id where u.id = p_user_id;
  perform public.admin_log(v_actor, v_name, 'Changed order access', v_label,
    case when coalesce(p_gg, false) then 'Gamer Girl (Gamer Girl orders, all games)'
         when pg_catalog.cardinality(v_games) = 0 then 'no games'
         else pg_catalog.array_to_string(v_games, ', ') end);
  return pg_catalog.jsonb_build_object('access', pg_catalog.jsonb_build_object('games', pg_catalog.to_jsonb(v_games), 'gg', coalesce(p_gg, false)));
end;
$$;

create function public.admin_applications() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.admin_caller()) then return public.order_error(403, 'Admins only.'); end if;
  return pg_catalog.jsonb_build_object('applications', coalesce((
    select pg_catalog.jsonb_agg(public.admin_application_dto(a) order by a.submitted_at desc)
      from (select * from public.teammate_applications order by submitted_at desc limit 500) as a), '[]'::jsonb));
end;
$$;

-- Approving makes the account with the applicant's email a teammate for that game (original
-- app/api/admin/applications). Result: teammate | customer | admin | no-account.
create function public.admin_decide_application(p_application_id uuid, p_decision text, p_reason text default '') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid; v_name text; v public.teammate_applications; v_account uuid; v_role text; v_result text; r jsonb;
begin
  select id, name into v_actor, v_name from public.admin_caller();
  if v_actor is null then return public.order_error(403, 'Admins only.'); end if;
  if p_decision not in ('approve', 'reject') then return public.order_error(400, 'Unknown decision.'); end if;
  select * into v from public.teammate_applications where id = p_application_id for update;
  if v.id is null then return public.order_error(404, 'Application not found.'); end if;
  if v.status <> 'pending' then return public.order_error(409, 'This application was already ' || v.status || '.'); end if;
  if p_decision = 'reject' then
    update public.teammate_applications set status = 'rejected', reason = pg_catalog.left(coalesce(p_reason, ''), 120),
      decided_by = v_actor, decided_by_name = v_name, decided_at = pg_catalog.clock_timestamp()
     where id = v.id returning * into v;
    perform public.admin_log(v_actor, v_name, 'Rejected application', v.reference, v.name || ' · ' || v.reason);
    return pg_catalog.jsonb_build_object('application', public.admin_application_dto(v));
  end if;
  select u.id, r.role into v_account, v_role from auth.users as u join public.account_roles as r on r.user_id = u.id
   where pg_catalog.lower(u.email) = v.email order by u.created_at limit 1;
  if v_account is null then v_result := 'no-account';
  elsif v_role = 'customer' then
    r := public.admin_apply_role(v_actor, v_name, v_account, 'teammate');
    if r ? 'error' then return r; end if;
    update public.teammate_order_access
       set approved_games = case when v.game = any(approved_games) then approved_games else approved_games || v.game end
     where user_id = v_account;
    v_result := 'teammate';
  else v_result := v_role;
  end if;
  update public.teammate_applications set status = 'approved', decided_by = v_actor, decided_by_name = v_name,
    decided_at = pg_catalog.clock_timestamp(), account_id = v_account
   where id = v.id returning * into v;
  perform public.admin_log(v_actor, v_name, 'Approved application', v.reference,
    v.name || ' · ' || v.game || case v_result when 'teammate' then ' · now a teammate' when 'no-account' then ' · no account yet' else ' · already ' || v_result end);
  return pg_catalog.jsonb_build_object('application', public.admin_application_dto(v), 'result', v_result);
end;
$$;

create function public.admin_audit(p_limit integer default 300) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.admin_caller()) then return public.order_error(403, 'Admins only.'); end if;
  return pg_catalog.jsonb_build_object('audit', coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id', l.id, 'at', l.at, 'who', l.actor_name,
             'action', l.action, 'target', l.target, 'detail', l.detail) order by l.id desc)
      from (select * from public.admin_audit_log order by id desc limit greatest(1, least(coalesce(p_limit, 300), 2000))) as l), '[]'::jsonb));
end;
$$;

-- ---- public: teammate application from /apply (no account needed) ---------------------------

create function public.submit_teammate_application(
  p_name text, p_email text, p_discord text, p_country text, p_game text, p_rank text, p_region text,
  p_role text, p_link text, p_hours text, p_why text, p_services text[]
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_email text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_email, ''))); v public.teammate_applications;
begin
  -- Site-wide flood limit (spec: max 30 per hour). Serialized so concurrent submits can't overshoot.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('duoly.teammate_applications'));
  if exists (select 1 from public.teammate_applications where email = v_email and status = 'pending') then
    return public.order_error(409, 'You already have an application waiting. We’ll get back to you on Discord.');
  end if;
  if (select pg_catalog.count(*) from public.teammate_applications where submitted_at > pg_catalog.clock_timestamp() - interval '1 hour') >= 30 then
    return public.order_error(429, 'Too many applications right now. Try again in a bit.');
  end if;
  begin
    insert into public.teammate_applications(name, email, discord, country, game, rank, region, role, link, hours, why, services)
      values (p_name, v_email, p_discord, coalesce(p_country, ''), p_game, p_rank, p_region, coalesce(p_role, ''),
              coalesce(p_link, ''), p_hours, coalesce(p_why, ''), p_services)
      returning * into v;
  exception when check_violation or not_null_violation then
    return public.order_error(400, 'Please check the form and try again.');
  end;
  return pg_catalog.jsonb_build_object('application', pg_catalog.jsonb_build_object('id', v.id, 'reference', v.reference));
end;
$$;

-- ---- trusted: owner sync from ADMIN_EMAILS (service role only) --------------------------------

create function public.sync_account_owner(p_user_id uuid, p_owner boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v public.account_roles;
begin
  select * into v from public.account_roles where user_id = p_user_id for update;
  if v.user_id is null then return; end if;
  if p_owner and not (v.owner and v.role = 'admin') then
    update public.account_roles set role = 'admin', owner = true, role_set_at = pg_catalog.clock_timestamp(), role_set_by = null
     where user_id = p_user_id;
    perform public.admin_log(null, 'ADMIN_EMAILS', 'Owner added', (select email from auth.users where id = p_user_id), pg_catalog.initcap(v.role) || ' → Admin (owner)');
  elsif not p_owner and v.owner then
    update public.account_roles set owner = false where user_id = p_user_id;
    perform public.admin_log(null, 'ADMIN_EMAILS', 'Owner removed', (select email from auth.users where id = p_user_id), 'Still an admin; can now be changed in Users');
  end if;
end;
$$;

revoke all on function public.admin_caller(), public.admin_log(uuid,text,text,text,text),
  public.admin_account_dto(uuid,uuid), public.admin_application_dto(public.teammate_applications),
  public.admin_apply_role(uuid,text,uuid,text) from public, anon, authenticated, service_role;
revoke all on function public.admin_accounts(), public.admin_set_role(uuid,text), public.admin_set_access(uuid,text[],boolean),
  public.admin_applications(), public.admin_decide_application(uuid,text,text), public.admin_audit(integer),
  public.submit_teammate_application(text,text,text,text,text,text,text,text,text,text,text,text[]),
  public.sync_account_owner(uuid,boolean) from public, anon, authenticated, service_role;
grant execute on function public.admin_accounts(), public.admin_set_role(uuid,text), public.admin_set_access(uuid,text[],boolean),
  public.admin_applications(), public.admin_decide_application(uuid,text,text), public.admin_audit(integer) to authenticated;
grant execute on function public.submit_teammate_application(text,text,text,text,text,text,text,text,text,text,text,text[]) to anon, authenticated;
grant execute on function public.sync_account_owner(uuid,boolean) to service_role;

commit;
