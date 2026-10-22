-- Rollback-only checks for 20261023100000_discord_links.sql.
-- Run: supabase db query --linked --file supabase/tests/discord_links.sql (statements end in ROLLBACK).
begin;

do $$
begin
  if exists (select 1 from auth.users where id in (
    'd1500000-0000-4000-8000-000000000001', 'd1500000-0000-4000-8000-000000000002'))
  then raise exception 'Fixture collision: aborting'; end if;
end $$;

insert into auth.users (id, aud, role, email, raw_user_meta_data, raw_app_meta_data) values
  ('d1500000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'duoly-dc-a@example.invalid', '{}', '{}'),
  ('d1500000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'duoly-dc-b@example.invalid', '{}', '{}');

-- B is an approved teammate before connecting Discord.
update public.account_roles set role = 'teammate' where user_id = 'd1500000-0000-4000-8000-000000000002';
insert into public.teammate_order_access (user_id, approved_games) values ('d1500000-0000-4000-8000-000000000002', array['lol']);

-- A connects Discord (identity inserted by Supabase Auth after a verified OAuth exchange).
insert into auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
values ('123456789012345671', 'd1500000-0000-4000-8000-000000000001',
        '{"sub":"123456789012345671","full_name":"alpha","custom_claims":{"global_name":"Alpha"}}', 'discord', now(), now());

do $$
begin
  if (select username from public.discord_accounts where user_id = 'd1500000-0000-4000-8000-000000000001'
      and discord_id = '123456789012345671') is distinct from 'Alpha' then
    raise exception 'Linking must create the discord_accounts row with the global name';
  end if;
end $$;

-- A teammate approved after linking inherits the verified Discord.
update public.account_roles set role = 'teammate' where user_id = 'd1500000-0000-4000-8000-000000000001';
insert into public.teammate_order_access (user_id, approved_games) values ('d1500000-0000-4000-8000-000000000001', array['val']);
do $$
begin
  if not exists (select 1 from public.teammate_order_access where user_id = 'd1500000-0000-4000-8000-000000000001'
      and discord_id = '123456789012345671' and discord_verified_at is not null) then
    raise exception 'New teammate access must default to the linked Discord';
  end if;
end $$;

-- B links after approval: queue access is updated.
insert into auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
values ('223456789012345672', 'd1500000-0000-4000-8000-000000000002', '{"name":"beta"}', 'discord', now(), now());
do $$
begin
  if not exists (select 1 from public.teammate_order_access where user_id = 'd1500000-0000-4000-8000-000000000002'
      and discord_id = '223456789012345672' and discord_verified_at is not null) then
    raise exception 'Linking must verify Discord for existing teammate access';
  end if;
end $$;

-- Owner-only reads, no client writes.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d1500000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$
begin
  if (select count(*) from public.discord_accounts) <> 1 then raise exception 'RLS must expose only the own link'; end if;
  begin
    insert into public.discord_accounts (user_id, discord_id) values ('d1500000-0000-4000-8000-000000000001', '323456789012345673');
    raise exception 'Clients must not write links';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.refresh_discord_link('d1500000-0000-4000-8000-000000000002');
    raise exception 'Clients must not call refresh_discord_link';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- Unlinking removes the link and queue verification.
delete from auth.identities where user_id = 'd1500000-0000-4000-8000-000000000002' and provider = 'discord';
do $$
begin
  if exists (select 1 from public.discord_accounts where user_id = 'd1500000-0000-4000-8000-000000000002') then
    raise exception 'Unlink must delete the link';
  end if;
  if exists (select 1 from public.teammate_order_access where user_id = 'd1500000-0000-4000-8000-000000000002'
      and (discord_id is not null or discord_verified_at is not null)) then
    raise exception 'Unlink must revoke queue verification';
  end if;
end $$;

select 'discord_links: all checks passed' as result;
rollback;
