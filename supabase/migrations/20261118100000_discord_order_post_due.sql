-- One-order version of discord_order_posts_due(): the per-order Discord timer asked for every
-- due order and then kept one. Same columns, filters and order as the full sweep, which stays
-- unchanged for the background fixer.
CREATE FUNCTION public.discord_order_post_due(p_order_id uuid, p_after_seconds integer DEFAULT 100)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id', o.id, 'reference', o.public_reference, 'game', o.game, 'title', o.title,
    'units', o.units, 'unit', o.unit, 'rank', o.rank, 'region', o.region, 'voice', o.voice, 'mood', o.mood,
    'gg', o.gg, 'payoutUsdCents', o.payout_usd_cents,
    'queuedAt', o.queued_at, 'cancelsAt', o.queued_at + interval '5 minutes',
    'role', o.role, 'character', o.character_name,
    'seats', t.seats,
    'seatsTaken', case when t.id is not null then (select pg_catalog.count(*) from public.orders s
      where s.team_id = t.id and s.status in ('in_progress','completed')) end
  ) order by o.queued_at), '[]'::jsonb)
  from public.orders o
  left join public.order_teams t on t.id = o.team_id
  where o.id = p_order_id and o.status = 'queued'
    and public.order_public_queued_at(o) <= pg_catalog.clock_timestamp() - pg_catalog.make_interval(secs => greatest(p_after_seconds, 0))
    -- leave 20 seconds so nobody gets pinged for a link that is about to die
    and o.queued_at + interval '5 minutes' > pg_catalog.clock_timestamp() + interval '20 seconds'
    and (t.id is null or (t.status in ('waiting','started')
      and not exists (select 1 from public.orders s where s.team_id = t.id and s.status = 'queued' and s.seat < o.seat)
      and not exists (select 1 from public.discord_order_posts d join public.orders s on s.id = d.order_id
        where s.team_id = t.id and d.state in ('posting','open'))))
    and not exists (
      select 1 from public.discord_order_posts d
       where d.order_id = o.id and d.queue_key = o.queued_at
         and (d.state <> 'posting' or d.created_at > pg_catalog.clock_timestamp() - interval '1 minute')
    );
$function$
;
REVOKE ALL ON FUNCTION public.discord_order_post_due(uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.discord_order_post_due(uuid,integer) TO service_role;
