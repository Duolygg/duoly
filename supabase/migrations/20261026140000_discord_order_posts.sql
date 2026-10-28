-- Ledger #41: Discord order posts (port of lib/discordQueue.js and the bot handover in lib/orders.js).
-- After an order has waited 100 seconds without a teammate, the bot posts it in that game's
-- #general channel with its own handover link. When the order is taken, cancelled, expires or is
-- re-rolled, the post is edited so nobody clicks a dead link. The original ran every second in an
-- always-on process; here pg_cron calls /api/discord/orders/tick every 10 seconds.
begin;

-- 1. Bot handover links. The original kept the bot's link apart from the admin's link
-- (o.botHandover next to o.handover), so an admin creating a link never kills the posted one.
alter table public.order_handovers
  add column kind text not null default 'admin' check (kind in ('admin', 'bot')),
  alter column created_by drop not null,
  add constraint order_handovers_creator check (kind = 'bot' or created_by is not null);
drop index public.order_handovers_one_active;
create unique index order_handovers_one_active on public.order_handovers(order_id, kind) where revoked_at is null;

-- Same as 20261024170000 except that it only replaces the previous ADMIN link.
create or replace function public.admin_create_handover(p_order_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid; v_actor_name text; v_order public.orders; v_token text; v_hash text; v_expires timestamptz;
begin
  select id,name into v_actor,v_actor_name from public.admin_caller();
  if v_actor is null then return public.order_error(403, 'Admins only.'); end if;
  select o.* into v_order from public.orders o where o.id = p_order_id for update;
  if v_order.id is null then return public.order_error(404, 'Order not found.'); end if;
  perform public.order_expire_locked(v_order.id);
  select o.* into v_order from public.orders o where o.id = p_order_id;
  if v_order.status <> 'queued' then return public.order_error(409, 'Only orders still waiting can be handed over.'); end if;
  update public.order_handovers set revoked_at = pg_catalog.clock_timestamp(), revoke_reason = 'replaced'
    where order_id = v_order.id and kind = 'admin' and revoked_at is null;
  v_token := pg_catalog.rtrim(pg_catalog.translate(pg_catalog.encode(extensions.gen_random_bytes(18), 'base64'), '+/', '-_'), '=');
  v_hash := pg_catalog.encode(extensions.digest(v_token, 'sha256'), 'hex');
  insert into public.order_handovers(order_id,token_hash,created_by,created_by_name,expires_at)
    values(v_order.id,v_hash,v_actor,v_actor_name,v_order.queued_at + interval '5 minutes')
    returning expires_at into v_expires;
  perform public.admin_log(v_actor, v_actor_name, 'Created handover link', v_order.public_reference,
    v_order.title || ' · valid until queue expiry');
  return pg_catalog.jsonb_build_object('token', v_token, 'expiresAt', v_expires);
end;
$$;

-- Same as 20261024170000 plus the re-roll rule for bot links.
create or replace function public.accept_handover(p_token_hash text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_h public.order_handovers;
  v_order public.orders;
  v_assignment uuid;
  v_now timestamptz;
begin
  if v_actor is null then return public.order_error(401, 'Please log in.'); end if;
  perform 1 from public.account_roles r where r.user_id = v_actor and r.role = 'teammate' for update;
  if not found then return public.order_error(403, 'Only teammates can use handover links.'); end if;
  perform 1 from public.teammate_order_access a
    where a.user_id = v_actor and not a.suspended
      and a.discord_id is not null and a.discord_verified_at is not null for share;
  if not found then return public.order_error(403, 'Verified teammate access required.'); end if;
  select h.* into v_h from public.order_handovers h where h.token_hash = p_token_hash for update;
  if v_h.id is null then return public.order_error(404, 'This handover link is not valid.'); end if;
  select o.* into v_order from public.orders o where o.id = v_h.order_id for update;
  if v_h.revoked_at is not null then
    if v_order.status = 'cancelled' then return public.order_error(410, 'This order was cancelled.'); end if;
    return public.order_error(409, 'Someone already took this order.');
  end if;
  if v_h.expires_at <= pg_catalog.clock_timestamp() or public.order_expire_locked(v_order.id) then
    return public.order_error(410, 'This handover link has expired.');
  end if;
  select o.* into v_order from public.orders o where o.id = v_order.id for update;
  if v_order.status <> 'queued' then return public.order_error(409, 'Someone already took this order.'); end if;
  if v_order.customer_id = v_actor then return public.order_error(409, 'You cannot take your own order.'); end if;
  if not exists (
    select 1 from public.account_roles r
    join public.teammate_order_access a on a.user_id = r.user_id
    where r.user_id = v_actor and r.role = 'teammate' and not a.suspended
      and a.discord_id is not null and a.discord_verified_at is not null
      and ((a.gg_access and v_order.gg) or
        (not a.gg_access and not v_order.gg and v_order.game = any(a.approved_games)))) then
    return public.order_error(403, 'This order is outside your approved game access.');
  end if;
  -- the bot's link never gives the order back to a teammate the customer switched away from
  -- (the original: wasRerolled && handover !== 'admin'); an admin's link still can
  if v_h.kind = 'bot' and exists (select 1 from public.order_assignments a
       where a.order_id = v_order.id and a.teammate_id = v_actor and a.end_reason = 'customer_reroll') then
    return public.order_error(403, 'The customer switched away from you on this order, so it goes to another teammate.');
  end if;
  if exists (select 1 from public.orders o where o.assigned_teammate_id = v_actor and o.status = 'in_progress') then
    return public.order_error(409, 'Finish your current order first.');
  end if;
  v_now := pg_catalog.clock_timestamp();
  insert into public.order_assignments(order_id, teammate_id, accepted_at)
    values(v_order.id, v_actor, v_now) returning id into v_assignment;
  update public.orders set status = 'in_progress', assigned_teammate_id = v_actor,
      current_assignment_id = v_assignment, accepted_at = v_now
    where id = v_order.id and status = 'queued'
      and queued_at + interval '5 minutes' > pg_catalog.clock_timestamp()
    returning * into v_order;
  if not found then
    delete from public.order_assignments where id = v_assignment;
    perform public.order_expire_locked(v_h.order_id);
    return public.order_error(410, 'This handover link has expired.');
  end if;
  return pg_catalog.jsonb_build_object('order', public.order_teammate_dto(v_order));
end;
$$;

-- 2. One post per order and queue round (the original's discordPosts[postKey]). queue_key is the
-- order's queued_at when it was posted: a re-roll puts the order back with a new queued_at, so
-- the old post closes as re-rolled and a new round can get a new post.
create table public.discord_order_posts (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  queue_key timestamptz not null,
  channel_id text not null check (channel_id ~ '^[0-9]{17,20}$'),
  message_id text check (message_id ~ '^[0-9]{17,20}$'),
  state text not null default 'posting' check (state in ('posting', 'open', 'closed')),
  outcome text check (outcome in ('taken', 'cancelled_customer', 'cancelled', 'expired', 'rerolled', 'gone')),
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  closed_at timestamptz,
  unique (order_id, queue_key),
  check ((state = 'open') <= (message_id is not null)),
  check ((state = 'closed') = (closed_at is not null and outcome is not null))
);
create index discord_order_posts_open on public.discord_order_posts(state) where state <> 'closed';
alter table public.discord_order_posts enable row level security;
revoke all on table public.discord_order_posts from public, anon, authenticated, service_role;
grant select on table public.discord_order_posts to service_role;

-- Orders that have waited p_after_seconds, are still inside the 5 minute queue window and have no
-- post for this queue round. Only teammate-facing facts: no customer name, IGN, country or note.
create function public.discord_order_posts_due(p_after_seconds integer default 100) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id', o.id, 'reference', o.public_reference, 'game', o.game, 'title', o.title,
    'units', o.units, 'unit', o.unit, 'rank', o.rank, 'region', o.region, 'voice', o.voice,
    'gg', o.gg, 'payoutUsdCents', o.payout_usd_cents,
    'queuedAt', o.queued_at, 'cancelsAt', o.queued_at + interval '5 minutes'
  ) order by o.queued_at), '[]'::jsonb)
  from public.orders o
  where o.status = 'queued'
    and o.queued_at <= pg_catalog.clock_timestamp() - pg_catalog.make_interval(secs => greatest(p_after_seconds, 0))
    -- leave 20 seconds so nobody gets pinged for a link that is about to die
    and o.queued_at + interval '5 minutes' > pg_catalog.clock_timestamp() + interval '20 seconds'
    and not exists (
      select 1 from public.discord_order_posts d
       where d.order_id = o.id and d.queue_key = o.queued_at
         and (d.state <> 'posting' or d.created_at > pg_catalog.clock_timestamp() - interval '1 minute')
    );
$$;

-- Reserves the post for this round and issues the bot's handover link (only its hash is stored).
-- Null when the order moved on, or another tick already reserved it.
create function public.discord_order_post_claim(p_order_id uuid, p_queue_key timestamptz, p_channel_id text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders; v_post uuid; v_token text; v_hash text;
begin
  if p_channel_id is null or p_channel_id !~ '^[0-9]{17,20}$' then return null; end if;
  select o.* into v_order from public.orders o where o.id = p_order_id for update;
  if v_order.id is null or v_order.status <> 'queued' or v_order.queued_at is distinct from p_queue_key
     or v_order.queued_at + interval '5 minutes' <= pg_catalog.clock_timestamp() + interval '20 seconds' then
    return null;
  end if;
  -- a reservation whose Discord call died more than a minute ago may be retried
  delete from public.discord_order_posts
   where order_id = p_order_id and queue_key = p_queue_key and state = 'posting'
     and created_at <= pg_catalog.clock_timestamp() - interval '1 minute';
  insert into public.discord_order_posts(order_id, queue_key, channel_id)
    values (p_order_id, p_queue_key, p_channel_id)
    on conflict (order_id, queue_key) do nothing
    returning id into v_post;
  if v_post is null then return null; end if;
  update public.order_handovers set revoked_at = pg_catalog.clock_timestamp(), revoke_reason = 'replaced'
    where order_id = p_order_id and kind = 'bot' and revoked_at is null;
  v_token := pg_catalog.rtrim(pg_catalog.translate(pg_catalog.encode(extensions.gen_random_bytes(18), 'base64'), '+/', '-_'), '=');
  v_hash := pg_catalog.encode(extensions.digest(v_token, 'sha256'), 'hex');
  insert into public.order_handovers(order_id, token_hash, kind, created_by, created_by_name, expires_at)
    values (p_order_id, v_hash, 'bot', null, 'Duoly bot', v_order.queued_at + interval '5 minutes');
  return pg_catalog.jsonb_build_object('post', v_post, 'token', v_token);
end;
$$;

-- Discord accepted the post: remember the message so it can be edited later.
create function public.discord_order_post_saved(p_post_id uuid, p_message_id text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if p_message_id is null or p_message_id !~ '^[0-9]{17,20}$' then return false; end if;
  update public.discord_order_posts set message_id = p_message_id, state = 'open'
   where id = p_post_id and state = 'posting';
  return found;
end;
$$;

-- Discord refused the post: drop the reservation and its link so the next tick can try again.
create function public.discord_order_post_failed(p_post_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_order uuid;
begin
  delete from public.discord_order_posts where id = p_post_id and state = 'posting' returning order_id into v_order;
  if v_order is null then return false; end if;
  update public.order_handovers set revoked_at = pg_catalog.clock_timestamp(), revoke_reason = 'replaced'
    where order_id = v_order and kind = 'bot' and revoked_at is null;
  return true;
end;
$$;

-- Open posts whose order moved on, with what the closed post shows. The teammate is shown by first
-- name only, the same public name customers see on teammate cards.
create function public.discord_order_posts_to_close() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(pg_catalog.jsonb_agg(x.j order by x.created_at), '[]'::jsonb) from (
    select d.created_at, pg_catalog.jsonb_build_object(
      'post', d.id, 'channelId', d.channel_id, 'messageId', d.message_id,
      'outcome', case
        when o.queued_at is distinct from d.queue_key then 'rerolled'
        when o.status in ('in_progress', 'completed') then 'taken'
        when o.status = 'cancelled' and o.cancel_reason = 'customer_cancelled' then 'cancelled_customer'
        when o.status = 'cancelled' and o.cancel_reason = 'queue_expired' then 'expired'
        when o.status = 'cancelled' then 'cancelled'
        else 'expired'
      end,
      'reference', o.public_reference, 'game', o.game, 'title', o.title, 'units', o.units, 'unit', o.unit,
      'at', coalesce(case when o.queued_at = d.queue_key then coalesce(o.accepted_at, o.cancelled_at) end,
                     pg_catalog.clock_timestamp()),
      'teammate', case when o.queued_at = d.queue_key and o.status in ('in_progress', 'completed') then
        (select pg_catalog.split_part(pg_catalog.btrim(p.name), ' ', 1) from public.profiles p where p.id = o.assigned_teammate_id) end,
      'waitedMs', case when o.queued_at = d.queue_key and o.accepted_at is not null then
        (extract(epoch from (o.accepted_at - d.queue_key)) * 1000)::bigint end
    ) j
    from public.discord_order_posts d
    join public.orders o on o.id = d.order_id
    where d.state = 'open'
      and (o.queued_at is distinct from d.queue_key
        or o.status <> 'queued'
        or o.queued_at + interval '5 minutes' <= pg_catalog.clock_timestamp())
  ) x;
$$;

-- The post was edited (or a moderator deleted it: 'gone').
create function public.discord_order_post_closed(p_post_id uuid, p_outcome text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if p_outcome is null or p_outcome not in ('taken', 'cancelled_customer', 'cancelled', 'expired', 'rerolled', 'gone') then
    return false;
  end if;
  update public.discord_order_posts set state = 'closed', outcome = p_outcome, closed_at = pg_catalog.clock_timestamp()
   where id = p_post_id and state = 'open';
  return found;
end;
$$;

revoke all on function public.discord_order_posts_due(integer) from public, anon, authenticated, service_role;
revoke all on function public.discord_order_post_claim(uuid, timestamptz, text) from public, anon, authenticated, service_role;
revoke all on function public.discord_order_post_saved(uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.discord_order_post_failed(uuid) from public, anon, authenticated, service_role;
revoke all on function public.discord_order_posts_to_close() from public, anon, authenticated, service_role;
revoke all on function public.discord_order_post_closed(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.discord_order_posts_due(integer) to service_role;
grant execute on function public.discord_order_post_claim(uuid, timestamptz, text) to service_role;
grant execute on function public.discord_order_post_saved(uuid, text) to service_role;
grant execute on function public.discord_order_post_failed(uuid) to service_role;
grant execute on function public.discord_order_posts_to_close() to service_role;
grant execute on function public.discord_order_post_closed(uuid, text) to service_role;

-- 3. The tick: every 10 seconds, same Vault secret as the role sweep. Without DISCORD_ORDER_POSTS_ENABLED
-- on Vercel the endpoint does nothing.
select cron.schedule(
  'duoly-discord-orders-tick', '10 seconds',
  $job$
    select net.http_post(
      url := 'https://duoly.gg/api/discord/orders/tick',
      headers := pg_catalog.jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          select decrypted_secret from vault.decrypted_secrets
          where name = 'discord_roles_tick_secret'
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 9000
    )
    where (
      select count(*) = 1 and bool_and(pg_catalog.length(decrypted_secret) >= 32)
      from vault.decrypted_secrets
      where name = 'discord_roles_tick_secret'
    );
  $job$
);
select cron.alter_job(jobid, active := true) from cron.job
  where jobname = 'duoly-discord-orders-tick' and username = current_user;
-- 8,640 run rows a day: the existing nightly prune also covers this job.
select cron.schedule(
  'duoly-discord-roles-log-prune', '35 3 * * *',
  $prune$
    delete from cron.job_run_details
    where jobid in (
      select jobid from cron.job
      where jobname in ('duoly-discord-roles-tick', 'duoly-discord-orders-tick', 'duoly-discord-roles-log-prune')
        and username = current_user
    ) and end_time < pg_catalog.clock_timestamp() - interval '7 days';
  $prune$
);

commit;
