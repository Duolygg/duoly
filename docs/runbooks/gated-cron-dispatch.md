# Gated cron dispatch (Step A)

This migration preserves the existing endpoints and state machines. It is not the proposed timer service. Only `20261112090000_gated_cron_dispatch.sql` is new; historical migrations and application handlers are unchanged.

## Gates and fallback

| Kind      | Previous schedule             | Read-only gate                                                                                                                                                                          | Source mirrored                                                                                                                                                                        | Unconditional fallback                       |
| --------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Orders    | 10 seconds                    | Due public queue order, including lowest team seat and absence of another team post; **any** open post; stale posting claim                                                             | `src/server/discord/order-post-tick.ts:349-385`; `order-posts.ts:11`; `20261106190000_team_orders.sql:1076-1089`; `20261105100000_twitch_streaming.sql:136-153`                        | 10 minutes                                   |
| Payments  | 20 seconds (hand-created job) | Expired queued order; queued/in-progress seat of a cancelled team; stale unpaid intent with an unreversed wallet hold; pending settlement with attempts below 20                        | `src/server/payments/webhook.ts:531-546`; `20261106190000_team_orders.sql:640-648`; `20261025260000_wallet_checkout.sql:116-122,290-297`; `20261023120000_stripe_payments.sql:149-152` | 10 minutes                                   |
| Analytics | Every minute                  | Unsent, unparked outbox row with free/expired lease, **including exhausted attempts requiring parking**                                                                                 | `src/server/analytics/drain.ts:122-193`; `20261106110000_analytics_outbox.sql:391-408`                                                                                                 | 10 minutes                                   |
| Roles     | 30 seconds                    | Derived teammate/online/session/admin/identity differs from applied state; missing or obsolete identity; member refresh overdue at 10 minutes or nonmember refresh overdue at 2 minutes | `src/server/discord/role-sync.ts:103-129,170-179,455-620`; `20261025100000_discord_role_sync.sql:35-51`                                                                                | 10 minutes, including external Discord drift |

`order_public_queued_at` and `checkout_stale_wallet_holds` (including its `checkout_open_holds` dependency) are STABLE and read-only. The dispatcher does not call claim/sweep helpers. Picks can move public availability without changing the order; streaming bookings return infinity for public posting but still expire through payments. All open posts deliberately cause a false positive until closed. Nonmembers may also cause false positives when desired roles differ from their absent Discord roles. These cost extra calls, not missed work.

Before evaluating work or fallback, the dispatcher enforces minimum elapsed time since successful enqueue: orders 10 seconds, payments 20 seconds, roles 30 seconds and analytics 60 seconds. Repeated calls inside this window neither evaluate predicates nor enqueue, including predicate fail-open. At the boundary, normal work/fallback decisions resume. One predicate failure outside the cadence window logs a warning and calls that kind anyway. One enqueue/configuration failure logs a warning and leaves its timestamp unchanged, without preventing subsequent kinds. The tiny state table is written only after enqueue; it records attempted delivery, **not handler success**. Missing state forces an immediate call. With valid configuration, ordinary due work is checked on 10-second dispatcher ticks, respecting the per-kind cadence since last enqueue (so tick alignment can add up to one tick). A predicate defect can delay a call up to the 10-minute safety interval. A failed delivery/handler is retried while work remains, or at the next unconditional fallback; this is not exactly-once delivery.

All bodies remain `{}` with JSON content type and Bearer authentication. Orders/roles retain `discord_roles_tick_secret` and timeouts 9000/25000 ms; analytics retains `analytics_drain_secret` and 25000 ms. Payments retains `payments_tick_secret`; its paused source command supplies a literal `timeout_milliseconds` value. An omitted timeout omits the argument, retaining the installed pg_net default rather than guessing an extension version; unfamiliar timeout expressions abort migration before pause. No credentials are created or removed. Keep the Discord secret: performance recalc still uses it.

## Estimated load, not measurements

Nominal old polls: 17,280 cron runs/day. New dispatcher: 8,640 runs/day, plus 24 global prune runs/day. Truly idle with valid secrets and settled role facts: 576 HTTP calls/day at the four 10-minute safety intervals, rather than 17,280. Work, role refreshes, missing membership and fail-open warnings can increase that count. Other jobs are excluded from these comparisons.

Using the supplied rough nine-write cost per HTTP poll, old polls cost about 155,520 logical row operations/day. A rough split of three cron-log operations/run, six pg_net operations/request and one dispatch-state operation/request gives about 30,024/day for dispatcher plus pruner in the ideal idle case, **excluding retention deletes, indexes, WAL, extension cleanup and work-generated operations**. This is an estimate, not an IO or disk-size guarantee. Cron run count is halved, not eliminated. Deletes free reusable space; the relation's physical file need not shrink.

## Owner rollout (not performed by this PR)

1. Review draft PR and green disposable `sql-tests` evidence. Never run fixtures on the hosted database. The suite begins with a local-marker plus dynamically branched production-secret guard and owns its BEGIN/ROLLBACK; pg_net cannot deliver its fixture requests before commit.
2. Read the four current `cron.job` commands as owner; compare destinations, owners, body, headers and payment timeout to the migration. Verify Vault names/counts/lengths without displaying values. Check effective queue ACLs (`has_table_privilege`) and API exposure. Existing narrow reusable Bearer credentials remain in pg_net; do not assume prior revokes secured managed extension tables. Resolve unsafe ACLs before applying.
3. Owner applies the new migration only after approval. Scheduling and pausing commit atomically: `duoly-dispatch` becomes active, the four old poll rows remain present and inactive (missing payments locally is harmless). The two old nightly cron-only prunes are paused. The proof log-prune row is rescheduled to delete **only** outcome rows older than seven days.
4. Confirm all unrelated job definitions are unchanged: trust-deposit-release, payout-week-freeze, loyalty-cashback-credit, duoly-performance-recalc, duoly-analytics-reconcile, duoly-analytics-cleanup, and synchronous private-proof-cleanup at 15 minutes.
5. Watch for at least 24 hours: endpoint failures, dispatcher warnings, stale post claims, due-age/backlogs, role mismatches and manual drift. Compare normal order/payment/Discord latency, not just HTTP 200. Retention deletes at most 50,000 ended runs older than 24 hours per hour across all jobs. The existing backlog intentionally drains over multiple hours. No migration-time deletion or VACUUM FULL.

## Rollback

As owner, atomically stop the dispatcher and reactivate the retained original commands:

```sql
begin;
select cron.unschedule('duoly-dispatch');
select cron.alter_job(job_id := jobid, active := true)
from cron.job
where jobname in ('duoly-discord-orders-tick','duoly-payments-tick',
  'duoly-discord-roles-tick','duoly-analytics-drain')
  and username = current_user;
commit;
```

Keep global bounded retention and proof outcomes retention enabled. No need to revive redundant nightly cron prunes. In-flight HTTP requests may finish after rollback. A missing local payments row is not recreated, and on production its actual hand-created command is preserved. Do not remove the shared Discord secret or change the independent money/performance/analytics/proof jobs.

## Read-only verification after owner applies

Do not paste credentials or entire command bodies into public PR comments. The following are operator checks, **not executed here**:

```sql
-- Definitions, activation and owners (avoid returning commands containing credentials).
select jobid, jobname, schedule, active, username from cron.job order by jobname;

-- Runs/hour/job, including failures. Group by the original jobid for old history.
select date_trunc('hour', d.start_time) as hour, d.jobid, j.jobname,
  count(*) as runs, count(*) filter (where d.status = 'failed') as failures
from cron.job_run_details d left join cron.job j using (jobid)
where d.start_time >= now() - interval '24 hours'
group by 1,2,3 order by 1,2;

-- Pending HTTP requests per URL only; this queue is NOT a historical request log.
select url, count(*) as queued from net.http_request_queue group by url order by url;
select kind, last_called_at, now() - last_called_at as since_last_call
from public.duoly_dispatch_state order by kind;

-- Run-log trend: repeat hourly and record externally. Physical size need not fall.
select count(*) as rows, min(end_time) as oldest_ended,
  count(*) filter (where end_time < now() - interval '24 hours') as expired,
  pg_total_relation_size('cron.job_run_details') as allocated_bytes
from cron.job_run_details;

-- Orders/payments predicates; NOT mutating helpers such as order_sweep or claims.
select count(*) as expired_queue, min(queued_at) as oldest
from public.orders where status = 'queued' and queued_at + interval '5 minutes' <= now();
select count(*) as cancelled_team_stragglers
from public.orders o join public.order_teams t on t.id = o.team_id
where t.status = 'cancelled' and o.status in ('queued','in_progress');
select public.checkout_stale_wallet_holds(100) as stale_holds;
select settle, count(*) as pending,
  count(*) filter (where attempts >= 20) as exhausted, min(updated_at) as oldest
from public.order_payments where settle <> 'none' group by settle;
select count(*) as stale_posting from public.discord_order_posts
where state = 'posting' and created_at <= now() - interval '1 minute';
select public.duoly_dispatch_has_work('orders') as order_work,
  public.duoly_dispatch_has_work('roles') as role_work;

-- Analytics categories, not a total that confuses sent rows with backlog.
select count(*) filter (where sent_at is null and failed_at is null) as pending,
  count(*) filter (where sent_at is null and failed_at is null
    and (claimed_until is null or claimed_until <= now())) as eligible_now,
  count(*) filter (where sent_at is null and failed_at is null and claimed_until > now()) as leased,
  count(*) filter (where failed_at is not null) as parked,
  count(*) filter (where sent_at is not null) as retained_sent,
  min(occurred_at) filter (where sent_at is null and failed_at is null) as oldest_pending
from public.analytics_outbox;

-- Queue ACLs: report booleans only, never request headers.
select r, has_table_privilege(r,'net.http_request_queue','SELECT') as queue_read,
  has_table_privilege(r,'net._http_response','SELECT') as response_read
from unnest(array['anon','authenticated']) r;
```

**HTTP requests/hour/URL:** use the existing hosting request logs filtered to the four exact paths in the table, over an explicit UTC hour, grouped by path and status. Compare the previous hour/day on the same basis. PostgreSQL's pg_net queue is transient and responses do not retain the originating URL, so an honest historical per-URL SQL count is not available after the queue drains. Do not label queue depth or four last-call timestamps as hourly traffic. This PR intentionally adds no per-dispatch history writes. Record the provider-log counts externally alongside the run-log/backlog samples. Confirm membership/manual-role reconciliation in Discord separately; SQL facts cannot establish external role correctness.
