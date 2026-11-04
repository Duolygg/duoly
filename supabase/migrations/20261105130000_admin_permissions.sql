-- Admin permissions per dashboard section (docs/product/admin-permissions.md).
--
-- Owners (account_roles.owner, from ADMIN_EMAILS) always have every section and are the only ones who
-- can make someone admin, change an admin's role or change what an admin may see. Every other admin
-- has a list of sections (admin_permissions.sections); without a row they get the defaults:
--   overview, live, priority, performance, teammates (with Applications and Match reports), users,
--   support, safety, audit, settings
-- Off unless an owner switches them on: orders, customers, creators, payouts.
--
-- Enforcement is in the database, so the API can't be used to get around it. Every admin function
-- looked its caller up with public.admin_caller(); this rewrites each live definition in place to
-- use public.admin_caller_for(<sections>) instead, which returns nobody unless the admin has one of
-- those sections (the function then answers 403 like for a non-admin). The rewrite checks that the
-- old call is there exactly once, so a definition that changed since is caught instead of skipped.
-- A few reads are shared: the Live desk reads orders, presence and priority; the Overview reads
-- presence and chat flags. Refunding to the card needs Orders; Live desk can hand over and cancel.
-- Adjusting a teammate's balance needs Payouts.
-- Normal admins in Users and roles: customers and teammates only, never make or change an admin.
-- admin_presence_check_in (the panel's own heartbeat) stays open to every admin.
--
-- From: admin_set_role (20261024090000_admin_foundation.sql), admin_account_dto
-- (20261105100000_twitch_streaming.sql), list_order_chat_flags and resolve_order_chat_flag
-- (20261024120000_chat_flag_audit.sql, rewritten in place), payout_stripe_prepare (rewritten in place).
begin;

-- ---- data -------------------------------------------------------------------------------------

create function public.admin_section_ids() returns text[]
language sql immutable set search_path = '' as $$
  select array['overview','live','priority','performance','orders','payouts','customers','teammates',
               'creators','support','users','safety','audit','settings']::text[];
$$;

create function public.admin_default_sections() returns text[]
language sql immutable set search_path = '' as $$
  select array['overview','live','priority','performance','teammates','users','support','safety','audit','settings']::text[];
$$;

create table public.admin_permissions (
  user_id uuid primary key references public.account_roles(user_id) on delete cascade,
  sections text[] not null check (sections <@ public.admin_section_ids() and pg_catalog.array_position(sections, null) is null),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default pg_catalog.clock_timestamp()
);
alter table public.admin_permissions enable row level security;
revoke all on table public.admin_permissions from public, anon, authenticated, service_role;
grant select on table public.admin_permissions to service_role;

-- ---- helpers ----------------------------------------------------------------------------------

-- The sections an admin may use (all for owners, the defaults without a row); empty for non-admins.
create function public.admin_sections_of(p_user uuid) returns text[]
language sql stable security invoker set search_path = '' as $$
  select case when r.user_id is null or r.role <> 'admin' then '{}'::text[]
              when r.owner then public.admin_section_ids()
              else coalesce((select p.sections from public.admin_permissions p where p.user_id = r.user_id),
                            public.admin_default_sections()) end
    from (select 1) as one
    left join public.account_roles as r on r.user_id = p_user;
$$;

-- admin_caller(), but only when the caller has at least one of these sections.
create function public.admin_caller_for(variadic p_sections text[]) returns table (id uuid, name text)
language sql stable security invoker set search_path = '' as $$
  select c.id, c.name from public.admin_caller() as c
   where public.admin_sections_of(c.id) && p_sections;
$$;

-- What the dashboard needs about the caller: owner or not, and the sections.
create function public.admin_me() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_actor uuid;
begin
  select id into v_actor from public.admin_caller();
  if v_actor is null then return public.order_error(403, 'Admins only.'); end if;
  return pg_catalog.jsonb_build_object(
    'owner', (select r.owner from public.account_roles r where r.user_id = v_actor),
    'sections', pg_catalog.to_jsonb(public.admin_sections_of(v_actor)));
end $$;

-- Owners only: what another admin may see.
create function public.admin_set_permissions(p_user_id uuid, p_sections text[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid; v_name text; r public.account_roles; v_sections text[]; v_before text[]; v_label text;
begin
  select c.id, c.name into v_actor, v_name from public.admin_caller() as c;
  if v_actor is null or not exists (select 1 from public.account_roles where user_id = v_actor and owner) then
    return public.order_error(403, 'Only owners can change what admins can see.');
  end if;
  select * into r from public.account_roles where user_id = p_user_id for update;
  if r.user_id is null then return public.order_error(404, 'Account not found.'); end if;
  if r.role <> 'admin' then return public.order_error(409, 'Only admins have dashboard permissions.'); end if;
  if r.owner then return public.order_error(409, 'Owners always see everything.'); end if;
  select coalesce(pg_catalog.array_agg(x.s order by x.i), '{}'::text[]) into v_sections
    from pg_catalog.unnest(public.admin_section_ids()) with ordinality as x(s, i)
   where x.s = any(coalesce(p_sections, '{}'::text[]));
  v_before := public.admin_sections_of(p_user_id);
  insert into public.admin_permissions(user_id, sections, updated_by)
    values (p_user_id, v_sections, v_actor)
  on conflict (user_id) do update set sections = excluded.sections, updated_by = excluded.updated_by,
    updated_at = pg_catalog.clock_timestamp();
  if v_sections is distinct from v_before then
    select coalesce(nullif(p.name, 'Player'), u.email, '') into v_label
      from auth.users u left join public.profiles p on p.id = u.id where u.id = p_user_id;
    perform public.admin_log(v_actor, v_name, 'Changed admin permissions', v_label,
      case when pg_catalog.cardinality(v_sections) = 0 then 'None' else pg_catalog.array_to_string(v_sections, ', ') end);
  end if;
  return pg_catalog.jsonb_build_object('permissions', pg_catalog.to_jsonb(v_sections));
end $$;

-- ---- replaced functions -----------------------------------------------------------------------

-- From 20261024090000_admin_foundation.sql; changed: Users and roles section, owners only for
-- anything about admins, and a promoted admin starts with the default sections.
create or replace function public.admin_set_role(p_user_id uuid, p_role text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid; v_name text; v_owner boolean; v_target text; v_result jsonb;
begin
  select id, name into v_actor, v_name from public.admin_caller_for('users');
  if v_actor is null then return public.order_error(403, 'Admins only.'); end if;
  select owner into v_owner from public.account_roles where user_id = v_actor;
  select role into v_target from public.account_roles where user_id = p_user_id;
  if not coalesce(v_owner, false) and (p_role = 'admin' or v_target = 'admin') then
    return public.order_error(403, 'Only owners can make someone admin or change an admin.');
  end if;
  v_result := public.admin_apply_role(v_actor, v_name, p_user_id, p_role);
  -- a new admin starts with the default sections (also after being admin before)
  if p_role = 'admin' and v_target is distinct from 'admin' and v_result ? 'account' then
    insert into public.admin_permissions(user_id, sections, updated_by)
      values (p_user_id, public.admin_default_sections(), v_actor)
    on conflict (user_id) do update set sections = excluded.sections, updated_by = excluded.updated_by,
      updated_at = pg_catalog.clock_timestamp();
    v_result := pg_catalog.jsonb_build_object('account', public.admin_account_dto(p_user_id, v_actor));
  end if;
  return v_result;
end;
$$;

-- From 20261105100000_twitch_streaming.sql; changed: 'permissions' for admins (what they may see).
create or replace function public.admin_account_dto(p_user uuid, p_viewer uuid) returns jsonb
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
    'access', case when a.user_id is null then pg_catalog.jsonb_build_object('games', '[]'::jsonb, 'gg', false, 'suspended', false, 'stream', '[]'::jsonb)
      else pg_catalog.jsonb_build_object('games', pg_catalog.to_jsonb(a.approved_games), 'gg', a.gg_access, 'suspended', a.suspended,
        'stream', pg_catalog.to_jsonb(public.streamer_games(a))) end,
    'permissions', case when r.role = 'admin' then pg_catalog.to_jsonb(public.admin_sections_of(u.id)) end,
    'busy', exists (select 1 from public.orders as o where o.assigned_teammate_id = u.id and o.status = 'in_progress'))
  from auth.users as u
  join public.account_roles as r on r.user_id = u.id
  left join public.profiles as p on p.id = u.id
  left join public.teammate_order_access as a on a.user_id = u.id
  where u.id = p_user;
$$;

-- ---- every admin function: admin_caller() -> admin_caller_for(<sections>) -----------------------

do $$
declare
  v_map jsonb := pg_catalog.jsonb_build_object(
    'admin_overview()', '{overview}',
    'admin_presence()', '{live,overview}',
    'admin_set_teammate_offline', '{live}',
    'admin_create_handover', '{live,orders}',
    'admin_cancel_order', '{live,orders}',
    'admin_orders', '{live,orders}',
    'admin_orders_page', '{live,orders}',
    'admin_refund_order', '{orders}',
    'admin_priority', '{priority,live}',
    'admin_set_priority', '{priority}',
    'admin_reset_priority', '{priority}',
    'admin_adjust_priority', '{priority}',
    'admin_clear_adjustment', '{priority}',
    'admin_forgive_misses', '{priority}',
    'admin_performance', '{performance}',
    'admin_performance_history', '{performance}',
    'admin_performance_recalculate', '{performance}',
    'admin_set_performance_settings', '{performance}',
    'admin_accounts', '{users}',
    'admin_set_access', '{users}',
    'admin_set_stream_access', '{users}',
    'admin_duo_levels', '{users}',
    'admin_set_duo_level', '{users}',
    'admin_teammates', '{teammates}',
    'admin_set_suspended', '{teammates}',
    'admin_applications', '{teammates}',
    'admin_applications_page', '{teammates}',
    'admin_decide_application', '{teammates}',
    'admin_match_reports', '{teammates}',
    'admin_teammate_adjust', '{payouts}',
    'admin_payouts', '{payouts}',
    'admin_payout_hold', '{payouts}',
    'admin_payout_pay', '{payouts}',
    'admin_payout_pay_all', '{payouts}',
    'admin_payout_pay_all_manual', '{payouts}',
    'admin_payout_release', '{payouts}',
    'admin_customers', '{customers}',
    'admin_set_blocked', '{customers}',
    'admin_wallet_adjust', '{customers}',
    'admin_creators', '{creators}',
    'admin_create_creator', '{creators}',
    'admin_set_creator_active', '{creators}',
    'admin_creator_payout_pay', '{creators}',
    'admin_support_inbox', '{support}',
    'admin_support_command', '{support}',
    'admin_order_reports', '{safety}',
    'admin_order_report_decide', '{safety}',
    'admin_audit', '{audit}');
  v_key text; v_name text; v_fn regprocedure; v_def text; v_count int; v_args text; v_done int := 0;
begin
  for v_key in select pg_catalog.jsonb_object_keys(v_map) loop
    v_name := pg_catalog.split_part(v_key, '(', 1);
    for v_fn in select p.oid::regprocedure from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'public' and p.proname = v_name loop
      v_def := pg_catalog.pg_get_functiondef(v_fn);
      v_count := (pg_catalog.length(v_def) - pg_catalog.length(pg_catalog.replace(v_def, 'public.admin_caller()', '')))
                 / pg_catalog.length('public.admin_caller()');
      if v_count <> 1 then
        raise exception '% calls public.admin_caller() % times (expected 1); check the live definition', v_fn, v_count;
      end if;
      select pg_catalog.string_agg(pg_catalog.quote_literal(s), ', ') into v_args
        from pg_catalog.jsonb_array_elements_text(pg_catalog.to_jsonb((v_map->>v_key)::text[])) as s;
      execute pg_catalog.replace(v_def, 'public.admin_caller()', 'public.admin_caller_for(' || v_args || ')');
      v_done := v_done + 1;
    end loop;
  end loop;
  if v_done <> 48 then raise exception 'rewrote % admin functions, expected 48', v_done; end if;
end $$;

-- Chat moderation (Reports and safety; the Overview shows the open flags) and Stripe payouts check
-- the admin role directly. Same rewrite, on their exact role checks.
do $$
declare
  v_rules jsonb := pg_catalog.jsonb_build_object(
    'public.list_order_chat_flags',
      pg_catalog.jsonb_build_array('r.user_id = auth.uid() and r.role = ''admin''',
        'r.user_id = auth.uid() and r.role = ''admin'' and public.admin_sections_of(r.user_id) && array[''safety'',''overview'']'),
    'public.resolve_order_chat_flag',
      pg_catalog.jsonb_build_array('r.user_id = auth.uid() and r.role = ''admin''',
        'r.user_id = auth.uid() and r.role = ''admin'' and public.admin_sections_of(r.user_id) && array[''safety'']'),
    'public.payout_stripe_prepare',
      pg_catalog.jsonb_build_array('where user_id=p_actor and role=''admin''',
        'where user_id=p_actor and role=''admin'' and public.admin_sections_of(p_actor) && array[''payouts'']'));
  v_key text; v_fn regprocedure; v_def text; v_from text; v_to text;
begin
  for v_key in select pg_catalog.jsonb_object_keys(v_rules) loop
    v_from := v_rules->v_key->>0; v_to := v_rules->v_key->>1;
    for v_fn in select p.oid::regprocedure from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'public' and p.proname = pg_catalog.split_part(v_key, '.', 2) loop
      v_def := pg_catalog.pg_get_functiondef(v_fn);
      if pg_catalog.strpos(v_def, v_from) = 0 then
        raise exception '% does not contain "%"; check the live definition', v_fn, v_from;
      end if;
      execute pg_catalog.replace(v_def, v_from, v_to);
    end loop;
  end loop;
end $$;

revoke all on function public.admin_section_ids(), public.admin_default_sections(), public.admin_sections_of(uuid),
  public.admin_caller_for(text[]), public.admin_me(), public.admin_set_permissions(uuid, text[])
  from public, anon, authenticated, service_role;
grant execute on function public.admin_me(), public.admin_set_permissions(uuid, text[]) to authenticated;

commit;
