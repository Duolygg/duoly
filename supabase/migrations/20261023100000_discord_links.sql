-- Discord account links (port of the original lib/roles.js discordOf/linkDiscord/unlinkDiscord).
-- Source of truth is Supabase Auth: a Discord identity exists either because the person signs in
-- with Discord or because they connected it from the profile (Supabase manual identity linking).
-- Supabase verifies the OAuth exchange, so the Discord id here can never be typed in by a client.
begin;

create table public.discord_accounts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  discord_id text not null unique check (discord_id ~ '^[0-9]{17,20}$'),
  username text not null default '' check (pg_catalog.char_length(username) <= 64),
  linked_at timestamptz not null default pg_catalog.clock_timestamp()
);
alter table public.discord_accounts enable row level security;
revoke all on table public.discord_accounts from public, anon, authenticated, service_role;
grant select on table public.discord_accounts to authenticated;
create policy discord_accounts_read_own on public.discord_accounts
  for select to authenticated using (user_id = (select auth.uid()));

-- Recompute one account's link from its verified Discord identity, and mirror it into teammate
-- queue access (which requires a verified Discord before a teammate can accept orders).
create function public.refresh_discord_link(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_id text; v_name text;
begin
  if p_user is null or not exists (select 1 from public.profiles where id = p_user) then return; end if;
  select i.provider_id,
         pg_catalog.left(coalesce(i.identity_data -> 'custom_claims' ->> 'global_name',
                                  i.identity_data ->> 'full_name', i.identity_data ->> 'name', ''), 64)
    into v_id, v_name
    from auth.identities as i
   where i.user_id = p_user and i.provider = 'discord'
   order by i.created_at desc
   limit 1;
  if v_id is null or v_id !~ '^[0-9]{17,20}$' then
    delete from public.discord_accounts where user_id = p_user;
    update public.teammate_order_access set discord_id = null, discord_verified_at = null
     where user_id = p_user and discord_id is not null;
    return;
  end if;
  insert into public.discord_accounts as d (user_id, discord_id, username)
  values (p_user, v_id, v_name)
  on conflict (user_id) do update
    set username = excluded.username,
        linked_at = case when d.discord_id = excluded.discord_id then d.linked_at else excluded.linked_at end,
        discord_id = excluded.discord_id;
  update public.teammate_order_access
     set discord_id = v_id, discord_verified_at = pg_catalog.clock_timestamp()
   where user_id = p_user and discord_id is distinct from v_id;
end $$;
revoke all on function public.refresh_discord_link(uuid) from public, anon, authenticated, service_role;

create function public.on_auth_identity_discord() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if old.provider = 'discord' then perform public.refresh_discord_link(old.user_id); end if;
  elsif new.provider = 'discord' then
    perform public.refresh_discord_link(new.user_id);
    if tg_op = 'UPDATE' and old.user_id is distinct from new.user_id then
      perform public.refresh_discord_link(old.user_id);
    end if;
  end if;
  return null;
end $$;
revoke all on function public.on_auth_identity_discord() from public, anon, authenticated, service_role;
create trigger auth_identity_discord_link
  after insert or update or delete on auth.identities
  for each row execute function public.on_auth_identity_discord();

-- A teammate approved later picks up the Discord they already connected.
create function public.teammate_access_discord_default() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.discord_id is null then
    select d.discord_id into new.discord_id from public.discord_accounts as d where d.user_id = new.user_id;
    if new.discord_id is not null then new.discord_verified_at := pg_catalog.clock_timestamp(); end if;
  end if;
  return new;
end $$;
revoke all on function public.teammate_access_discord_default() from public, anon, authenticated, service_role;
create trigger teammate_access_discord_default
  before insert on public.teammate_order_access
  for each row execute function public.teammate_access_discord_default();

-- Existing Discord sign-ins.
select public.refresh_discord_link(i.user_id)
  from (select distinct user_id from auth.identities where provider = 'discord') as i;

commit;
