-- Apply after the four PR110 migrations, before deploying code that requires snapshot fields.
-- Identity reservations precede HTTP, so interrupted and stale Discord writes stay reconcilable.
-- Canonical role IDs live in PERFORMANCE_ROLE_IDS, never in runtime role provisioning.
begin;

create table public.performance_role_identities (
  teammate_id uuid not null references public.performance_discord(teammate_id) on delete cascade,
  discord_id text not null check (discord_id ~ '^[0-9]{17,20}$'),
  token uuid not null default pg_catalog.gen_random_uuid(),
  cleaned_at timestamptz,
  primary key (teammate_id, discord_id)
);
alter table public.performance_role_identities enable row level security;
revoke all on table public.performance_role_identities from public, anon, authenticated, service_role;

-- Preserve both sides of unlink and relink, even if an HTTP call is still in flight.
-- Renew tokens on identity transitions: a cleanup from an earlier A/B/A cycle cannot erase A.
create function public.performance_identity_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
declare u uuid;
begin
  u := case when tg_op = 'DELETE' then old.user_id else new.user_id end;
  if tg_op = 'UPDATE' and new.discord_id is not distinct from old.discord_id then return new; end if;
  perform 1 from public.performance_discord where teammate_id=u for update;
  if found then
    if tg_op <> 'INSERT' then
      insert into public.performance_role_identities(teammate_id,discord_id) values(u,old.discord_id)
      on conflict (teammate_id,discord_id) do update set token=pg_catalog.gen_random_uuid(),cleaned_at=null;
    end if;
    if tg_op <> 'DELETE' then
      insert into public.performance_role_identities(teammate_id,discord_id) values(u,new.discord_id)
      on conflict (teammate_id,discord_id) do update set token=pg_catalog.gen_random_uuid(),cleaned_at=null;
    end if;
    update public.performance_discord set status='pending', detail='', updated_at=pg_catalog.clock_timestamp() where teammate_id=u;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
revoke all on function public.performance_identity_changed() from public, anon, authenticated, service_role;
create trigger performance_identity_changed after insert or update or delete on public.discord_accounts
for each row execute function public.performance_identity_changed();

-- Existing linked identities may already have roles from the previous implementation.
insert into public.performance_role_identities(teammate_id,discord_id)
select d.teammate_id,a.discord_id from public.performance_discord d join public.discord_accounts a on a.user_id=d.teammate_id;

create or replace function public.performance_role_targets() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  -- Reserve potential assignments before any network call. This also covers first-time rankings.
  insert into public.performance_role_identities(teammate_id,discord_id)
  select d.teammate_id,a.discord_id from public.performance_discord d join public.discord_accounts a on a.user_id=d.teammate_id
  on conflict (teammate_id,discord_id) do nothing;
  return (
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'userId',d.teammate_id,'discordId',a.discord_id,'bracket',d.bracket,'status',d.status,
      'version',d.updated_at,
      'cleanup',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('discordId',i.discord_id,'token',i.token) order by i.discord_id)
        from public.performance_role_identities i where i.teammate_id=d.teammate_id and i.discord_id is distinct from a.discord_id),'[]'::jsonb)
    ) order by d.teammate_id),'[]'::jsonb)
    from public.performance_discord d left join public.discord_accounts a on a.user_id=d.teammate_id
  );
end $$;

create or replace function public.performance_set_sync(p_rows jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare r jsonb; d public.performance_discord; current_id text;
begin
  for r in select x from pg_catalog.jsonb_array_elements(coalesce(p_rows,'[]'::jsonb)) x loop
    select * into d from public.performance_discord where teammate_id=(r->>'userId')::uuid for update;
    if not found then continue; end if;
    select discord_id into current_id from public.discord_accounts where user_id=d.teammate_id;
    -- Keep retired identities for subsequent idempotent audits. A stale PUT may finish after
    -- cleanup and crash before acknowledgement, so deleting the last reservation is unsafe.
    -- Mark only the specific former generation cleaned, never a relinked current identity.
    update public.performance_role_identities i set cleaned_at=pg_catalog.clock_timestamp()
    from pg_catalog.jsonb_to_recordset(coalesce(r->'cleaned','[]'::jsonb)) c("discordId" text, token uuid)
    where i.teammate_id=d.teammate_id and i.discord_id=c."discordId" and i.token=c.token
      and i.discord_id is distinct from current_id;
    -- A late successful PUT may arrive after another worker cleaned its reservation.
    -- Retain it for another cleanup rather than losing the applied identity.
    if coalesce((r->>'applied')::boolean,false) and r->>'discordId' is not null then
      insert into public.performance_role_identities(teammate_id,discord_id) values(d.teammate_id,r->>'discordId')
      on conflict (teammate_id,discord_id) do update set cleaned_at=null;
    end if;
    -- Only a matching snapshot can report the current desired state as synced.
    update public.performance_discord set status=r->>'status',detail=pg_catalog.left(coalesce(r->>'detail',''),200),
      synced_at=case when r->>'status'='synced' then pg_catalog.clock_timestamp() else synced_at end,
      updated_at=pg_catalog.clock_timestamp()
    where teammate_id=d.teammate_id and updated_at=(r->>'version')::timestamptz
      and bracket is not distinct from (r->>'bracket')::smallint
      and current_id is not distinct from r->>'discordId'
      and r->>'status' in ('pending','synced','no_discord','not_member','error','off');
  end loop;
end $$;
revoke all on function public.performance_role_targets(),public.performance_set_sync(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.performance_role_targets(),public.performance_set_sync(jsonb) to service_role;
commit;
