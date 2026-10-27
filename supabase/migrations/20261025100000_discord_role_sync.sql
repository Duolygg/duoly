-- Ledger #40: Discord role sync for Teammate, Online and In Session (port of lib/discordRoles.js).
-- The original kept the applied roles in memory and recomputed the wanted roles every 5 seconds
-- in an always-on process. On Vercel the server syncs right after the actions that change the
-- wanted roles and a pg_cron sweep reconciles everyone every 30 seconds.
begin;

-- What the bot last applied in the Discord server, per Discord account (the original's
-- G.applied map). Rows for unlinked accounts stay until their roles are taken away again.
create table public.discord_role_sync (
  discord_id text primary key check (discord_id ~ '^[0-9]{17,20}$'),
  user_id uuid references auth.users(id) on delete set null,
  teammate boolean not null default false,
  online boolean not null default false,
  session boolean not null default false,
  -- Seen as an admin: the bot never touches an admin's Teammate role.
  admin boolean not null default false,
  -- Discord said this account is not in the server; rechecked every 2 minutes.
  not_member boolean not null default false,
  checked_at timestamptz not null default pg_catalog.clock_timestamp()
);
create index discord_role_sync_user on public.discord_role_sync(user_id);
alter table public.discord_role_sync enable row level security;
revoke all on table public.discord_role_sync from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.discord_role_sync to service_role;

-- Facts the wanted roles are computed from (src/server/discord/role-sync.ts wantedRoles):
-- every teammate or admin with a linked Discord account. Scoped to some users, to everyone
-- who played an order (current teammate plus re-rolled ones), or to everyone when both are null.
create function public.discord_role_facts(p_users uuid[] default null, p_order uuid default null)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select pg_catalog.jsonb_build_object(
    'now', (extract(epoch from pg_catalog.clock_timestamp()) * 1000)::bigint,
    'people', coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'user_id', r.user_id,
      'discord_id', d.discord_id,
      'role', r.role,
      'suspended', coalesce(a.suspended, false),
      'desk_online', coalesce(p.online, false),
      'last_seen', (extract(epoch from p.last_seen_at) * 1000)::bigint,
      'busy', exists (
        select 1 from public.orders o
        where o.assigned_teammate_id = r.user_id and o.status = 'in_progress'
      )
    ) order by r.user_id), '[]'::jsonb)
  )
  from public.account_roles r
  join public.discord_accounts d on d.user_id = r.user_id
  left join public.teammate_order_access a on a.user_id = r.user_id
  left join public.teammate_presence p on p.user_id = r.user_id
  where r.role in ('teammate', 'admin')
    and (
      (p_users is null and p_order is null)
      or r.user_id = any(coalesce(p_users, '{}'::uuid[]))
      or (p_order is not null and r.user_id in (
        select o.assigned_teammate_id from public.orders o
         where o.id = p_order and o.assigned_teammate_id is not null
        union
        select h.teammate_id from public.order_assignments h where h.order_id = p_order
      ))
    );
$$;
revoke all on function public.discord_role_facts(uuid[], uuid) from public, anon, authenticated, service_role;
grant execute on function public.discord_role_facts(uuid[], uuid) to service_role;

-- Reconcile sweep (replaces the original 5-second setInterval from instrumentation.js).
-- Same mechanism as duoly-payments-tick: pg_net posts to the site with a shared secret from
-- Vault. The secret only lets the caller start a sweep. Without the Vault secret no request is
-- queued; without the Vercel env (DISCORD_ROLE_SYNC_ENABLED, bot token, guild id, tick secret)
-- the endpoint does nothing.
select cron.schedule(
  'duoly-discord-roles-tick', '30 seconds',
  $job$
    select net.http_post(
      url := 'https://duoly.gg/api/discord/roles/tick',
      headers := pg_catalog.jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          select decrypted_secret from vault.decrypted_secrets
          where name = 'discord_roles_tick_secret'
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 25000
    )
    where (
      select count(*) = 1 and bool_and(pg_catalog.length(decrypted_secret) >= 32)
      from vault.decrypted_secrets
      where name = 'discord_roles_tick_secret'
    );
  $job$
);
-- cron.schedule can keep a previously disabled row; make activation explicit.
select cron.alter_job(jobid, active := true) from cron.job
  where jobname = 'duoly-discord-roles-tick' and username = current_user;
-- A 30-second job writes 2,880 run rows a day: keep a week of this job's own log only.
select cron.schedule(
  'duoly-discord-roles-log-prune', '35 3 * * *',
  $prune$
    delete from cron.job_run_details
    where jobid in (
      select jobid from cron.job
      where jobname in ('duoly-discord-roles-tick', 'duoly-discord-roles-log-prune')
        and username = current_user
    ) and end_time < pg_catalog.clock_timestamp() - interval '7 days';
  $prune$
);

commit;
