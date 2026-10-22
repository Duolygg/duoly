-- Account foundation. Apply only to an owner-approved database.
begin;

-- Serialize auth inserts/deletes with trigger installation and existing-user backfill.
lock table auth.users in share row exclusive mode;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default 'Player',
  country text not null default '',
  image text not null default '/assets/avatars/avatar-1.png',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_name_check check (char_length(name) between 2 and 32),
  -- Exact source: src/design-reference/lib/countries.js (including regional codes).
  constraint profiles_country_check check (country in (
    '', 'af', 'ax', 'al', 'dz', 'as', 'ad', 'ao', 'ai', 'aq', 'ag', 'ar', 'am',
    'aw', 'au', 'at', 'az', 'bs', 'bh', 'bd', 'bb', 'by', 'be', 'bz', 'bj',
    'bm', 'bt', 'bo', 'ba', 'bw', 'bv', 'br', 'io', 'vg', 'bn', 'bg', 'bf',
    'bi', 'kh', 'cm', 'ca', 'ic', 'cv', 'bq', 'ky', 'cf', 'td', 'cl', 'cn',
    'cx', 'cp', 'cc', 'co', 'km', 'cg', 'cd', 'ck', 'cr', 'ci', 'hr', 'cu',
    'cw', 'cy', 'cz', 'dk', 'dg', 'dj', 'dm', 'do', 'ec', 'eg', 'sv', 'gq',
    'er', 'ee', 'sz', 'et', 'fk', 'fo', 'fj', 'fi', 'fr', 'gf', 'pf', 'tf',
    'ga', 'gm', 'ge', 'de', 'gh', 'gi', 'gr', 'gl', 'gd', 'gp', 'gu', 'gt',
    'gg', 'gn', 'gw', 'gy', 'ht', 'hm', 'hn', 'hk', 'hu', 'is', 'in', 'id',
    'ir', 'iq', 'ie', 'im', 'il', 'it', 'jm', 'jp', 'je', 'jo', 'kz', 'ke',
    'ki', 'xk', 'kw', 'kg', 'la', 'lv', 'lb', 'ls', 'lr', 'ly', 'li', 'lt',
    'lu', 'mo', 'mg', 'mw', 'my', 'mv', 'ml', 'mt', 'mh', 'mq', 'mr', 'mu',
    'yt', 'mx', 'fm', 'md', 'mc', 'mn', 'me', 'ms', 'ma', 'mz', 'mm', 'na',
    'nr', 'np', 'nl', 'nc', 'nz', 'ni', 'ne', 'ng', 'nu', 'nf', 'kp', 'mk',
    'mp', 'no', 'om', 'pk', 'pw', 'ps', 'pa', 'pg', 'py', 'pe', 'ph', 'pn',
    'pl', 'pt', 'pr', 'qa', 're', 'ro', 'ru', 'rw', 'ws', 'sm', 'st', 'sa',
    'sn', 'rs', 'sc', 'sl', 'sg', 'sx', 'sk', 'si', 'sb', 'so', 'za', 'gs',
    'kr', 'ss', 'es', 'lk', 'bl', 'sh', 'kn', 'lc', 'mf', 'pm', 'vc', 'sd',
    'sr', 'sj', 'se', 'ch', 'sy', 'tw', 'tj', 'tz', 'th', 'tl', 'tg', 'tk',
    'to', 'tt', 'tn', 'tr', 'tm', 'tc', 'tv', 'um', 'vi', 'ug', 'ua', 'ae',
    'gb', 'us', 'uy', 'uz', 'vu', 'va', 've', 'vn', 'wf', 'eh', 'ye', 'zm', 'zw'
  )),
  constraint profiles_image_check check (
    image = '' or image ~ '^/assets/avatars/avatar-([1-9]|10)\.png$'
  )
);

create table public.account_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'customer',
  constraint account_roles_role_check check (role in ('customer', 'teammate', 'admin'))
);

create function public.handle_new_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Intentionally ignore all user/provider metadata, including claimed roles.
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  insert into public.account_roles (user_id, role)
    values (new.id, 'customer') on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_account() from public, anon, authenticated, service_role;

create trigger on_auth_user_created_account
  after insert on auth.users
  for each row execute function public.handle_new_account();

create function public.touch_profile_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.clock_timestamp();
  return new;
end;
$$;

revoke all on function public.touch_profile_updated_at() from public, anon, authenticated, service_role;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.touch_profile_updated_at();

-- Missing rows only; never rewrite existing role assignments or profile values.
insert into public.profiles (id)
  select id from auth.users where true on conflict (id) do nothing;
insert into public.account_roles (user_id, role)
  select id, 'customer' from auth.users where true on conflict (user_id) do nothing;

alter table public.profiles enable row level security;
alter table public.account_roles enable row level security;

-- Clear Supabase default grants explicitly before granting the narrow client contract.
revoke all on table public.profiles from public, anon, authenticated, service_role;
revoke all on table public.account_roles from public, anon, authenticated, service_role;
grant select on table public.profiles to authenticated;
grant select on table public.account_roles to authenticated;
grant update (name, country, image) on public.profiles to authenticated;

-- Reserved for trusted operations, not normal application sessions.
grant all on table public.profiles to service_role;
grant all on table public.account_roles to service_role;

create policy profiles_select_own on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy profiles_update_own on public.profiles
  for update to authenticated using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);
create policy account_roles_select_own on public.account_roles
  for select to authenticated using ((select auth.uid()) = user_id);

commit;
