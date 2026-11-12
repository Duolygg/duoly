# Background work: events, timers and one fixer

Why this exists: production runs on Supabase Free (nano). Four pg_cron HTTP polls (orders 10 s,
payments 20 s, roles 30 s, analytics 60 s) wrote `cron.job_run_details` about 17,400 times a day plus
updates, which is the top write source on an idle database and the reason REST went down for an hour
on 11 Nov 2026. `20261112090000_gated_cron_dispatch.sql` already replaced the four polls with one
gated dispatcher (`duoly-dispatch`, every 10 s, HTTP only when a cheap `exists()` says there is work).
This build removes the idle runs themselves: act on the event, set an exact timer per deadline, and
keep one scheduled fixer as the backstop.

Goal: idle database writes from background work near zero, with no change a customer or a teammate
can notice. Every latency that does change is named in [Latency changes](#latency-changes-named).

Sources: `~/.hermes/cache/scratch/supa-io/implementation-plan.md` (plan), `event-design.md`
(background), `oai-review.md` (independent review; answered in
[Answers to the review](#answers-to-the-review)).

## The pieces

| Piece                                                    | Where                                                          | What it does                                                                                                                                         |
| -------------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Timers` Durable Object                                  | `workers/discord-gateway` (class `Timers`, migration tag `v2`) | Stores one row per timer in SQLite, keeps one alarm at the earliest due time, fires a signed POST at the app, backs off, drops after the last retry. |
| `POST /api/internal/timer`                               | app                                                            | Verifies the signature, re-reads the current state, acts (or logs in shadow), answers with a disposition.                                            |
| `POST /api/internal/reconcile`                           | app                                                            | Runs the existing tick handlers. Called by the fixer, never by a timer.                                                                              |
| `public.background_switches`                             | database                                                       | One row per kind: `legacy`, `shadow` or `live`. The only thing that decides who does the work.                                                       |
| orders trigger                                           | database                                                       | After a commit that queues an order, registers its two timers through `net.http_post`.                                                               |
| `public.background_overdue()`                            | database                                                       | Read-only `exists()` per kind, reusing `duoly_dispatch_has_work`; returns one jsonb boolean per kind.                                                |
| `public.background_fix()`                                | database                                                       | Posts to `/api/internal/reconcile` only when `background_overdue()` found something.                                                                 |
| `public.background_finalize()` / `background_rollback()` | database                                                       | Pause the 10 s dispatcher and schedule the fixer, or the reverse. Called by hand.                                                                    |
| `src/contracts/background.ts`                            | shared                                                         | Schemas, kinds, timings, the HMAC sign and verify helper. Imported by the app, the worker and the tests.                                             |

A timer is a wake-up, never a decision. The handler re-reads the current deadline and state at fire
time and answers `done`, `stale`, `disabled`, `retry` or `pending`. Only that answer decides whether
the worker forgets the timer or re-arms it, because a 2xx proves transport and nothing else.

## The switches

```sql
create table public.background_switches (
  kind text primary key check (kind in ('orders','payments','analytics','roles')),
  mode text not null default 'shadow' check (mode in ('legacy','shadow','live')),
  updated_at timestamptz not null default now()
);
```

| Mode     | Timers registered | Timer handler                                                 | `duoly_dispatch` |
| -------- | ----------------- | ------------------------------------------------------------- | ---------------- |
| `legacy` | no                | answers `disabled`, does nothing                              | does the work    |
| `shadow` | yes               | logs `[timer-shadow] <kind> <ref> would=...`, touches nothing | does the work    |
| `live`   | yes               | does the work                                                 | skips this kind  |

Rules that make the switch safe:

- The migration inserts all four kinds as `shadow`. Flipping a kind is one UPDATE, never a deploy.
- A missing row, a missing table, an unknown kind or an unreadable switch all mean `legacy`. The app
  endpoints therefore do nothing useful before the migration is applied, which is what we want
  during the deploy window. The same fail-safe runs in SQL (`public.background_mode`), so an
  unreadable switch leaves `duoly_dispatch` doing the work rather than leaving it to nobody.
- `service_role` may only `select` the table; nothing but the table owner may write it. Flipping a
  kind is an owner UPDATE in the SQL editor, which is deliberately not a capability any API key has.
  RLS is on with no policy, so a browser token sees nothing even if a grant ever slips in.
- Shadow never claims a ledger row, never increments settlement attempts, never marks an analytics
  row, never posts to Discord and never calls Stripe (review F12, plan correction phase 2.5).
- Each timer kind is gated by the switch of the dispatcher that owns the same work today, so no work
  ever has two owners:

| Timer kind        | Switch      | Legacy owner                                   |
| ----------------- | ----------- | ---------------------------------------------- |
| `order-post`      | `orders`    | `/api/discord/orders/tick` (`runOrderPosts`)   |
| `order-expire`    | `payments`  | `/api/payments/tick` (`order_sweep`)           |
| `settle-retry`    | `payments`  | `/api/payments/tick` (`settlePending`)         |
| `analytics-retry` | `analytics` | `/api/internal/analytics/drain` (`drainOnce`)  |
| `presence-check`  | `roles`     | `/api/discord/roles/tick` (`syncDiscordRoles`) |

Flip a kind:

```sql
update public.background_switches set mode = 'live', updated_at = now() where kind = 'analytics';
```

Roll a kind back:

```sql
update public.background_switches set mode = 'shadow', updated_at = now() where kind = 'analytics';
```

`shadow` is the right rollback target while the dispatcher still runs: the dispatcher takes the work
back immediately and the timers keep arriving, so the next flip needs no backfill. Use `legacy` when
a timer handler itself misbehaves, because `legacy` also stops the registrations.

## Data flow per kind

### Orders (`order-post`)

1. Any commit that puts an order into the queue fires one AFTER INSERT OR UPDATE trigger on
   `public.orders` (status becomes `queued`, or `queued_at` changes). The trigger is the registration
   boundary because orders enter the queue through SQL (`create_paid_order`, the team loop, wallet and
   free wrappers, play again, reroll, handover), not only through app code, and `pg_net` sends after
   commit, so a rolled back transaction never registers anything.
2. It registers `order-post` at `queued_at + 100 s` and `order-expire` at `queued_at + 5 min`, both
   with `epoch = queued_at` in milliseconds. Each of the two is gated by its own switch, so with
   `orders` in `legacy` and `payments` in `shadow` only the expiry timer is registered.
3. At fire time the handler re-reads `order_public_queued_at(o)`:
   - order gone, not `queued` any more, or a different `queued_at`: `stale`.
   - a streaming booking (the function returns `infinity`): `stale`. No date ever carries infinity.
   - the effective post time is later than now (a priority pick holds the queue): `retry` at that
     time. `order_public_queued_at` returns `greatest(queued_at, ...)`, so the public post time can
     only move later than `queued_at + 100 s`, never earlier. That is why one timer at the earliest
     possible instant is enough (review F1).
   - an earlier team seat owns the team post, or a `posting` claim is younger than a minute:
     `pending` at the earlier of now plus 60 s and the order's expiry. "Not eligible yet" is never
     treated as terminal.
   - otherwise it runs the existing `runOrderPosts` path for that order (same claim per queue epoch,
     same ledger, same close of old posts) and answers `done`.
4. Closing a post stays event driven: accept, customer cancel, admin cancel and expiry close the
   post in `waitUntil`, and after closing a team seat's post the hook registers the next eligible
   seat's `order-post` at now. Registration keeps the earliest due time, so that pulls the sibling's
   pending timer forward instead of creating a second one.

### Payments (`order-expire`, `settle-retry`)

- `order-expire` fires at `queued_at + 5 min` and calls the existing SQL expiry state machine
  (`sweep_expired_orders` / `order_expire_locked`), which keeps credits and wallet reversals, perk
  return, handover revocation, team and chat changes, analytics and `order_misses` exactly as they
  are. The handler never writes its own refund or cancellation logic. Accepting an expired order
  already fails in SQL (`team_orders.sql:725-732`), so a late timer delays side effects only.
- `settle-retry` is registered when a settle attempt fails, at +30 s, +2 min and +10 min
  (`SETTLE_RETRY_DELAYS_MS`), with `ref` the order id and `epoch` the settle state's timestamp. The
  handler calls the existing `settlePending` claim path, which keeps provider idempotency keys and the
  attempt cap.
- Wallet holds: `src/server/payments/checkout.ts` already releases the hold when session creation or
  persistence fails (`:621-648`), and that file is protected, so nothing in it changes. Leftovers are
  the fixer's job through the unchanged `checkout_stale_wallet_holds` predicate.
- Cancelled team stragglers and both `order_sweep` loops stay covered, because the fixer calls the
  real tick handler rather than a new predicate of its own.

### Analytics (`analytics-retry`)

- `analytics_enqueue` is SQL, so inserts also happen without any app request (the `auth.users`
  signup trigger, the nightly reconcile, hourly cashback and deposit jobs). App origin facts are
  drained in `waitUntil` right after the insert; a failed or incomplete drain registers
  `analytics-retry` at +30 s, +2 min, +10 min; everything else waits for the fixer.
- The nightly `duoly-analytics-reconcile` and `duoly-analytics-cleanup` jobs are untouched, and a
  drain that still has eligible work after its bounded batches registers a continuation timer.

### Roles (`presence-check`)

- Role syncs already run right after the events that change wanted roles (`syncRolesAfter`).
- The gap is a browser that dies: nothing tells us the teammate went offline. The desk keeps one
  leader tab (BroadcastChannel), and when the last tab goes away it sends a beacon that registers a
  `presence-check` timer. The beacon never writes `desk_set_online(false)`: a `pagehide` also fires on
  ordinary navigation and on closing one of several tabs, so a persistent offline write would be a
  visible regression (review F5). The 20 s heartbeat staleness rule stays the only thing that decides.
- `presence-check` is a singleton (`presence-check:desk:0`). While anyone is online it answers `retry`
  at now plus 20 s; when nobody is online it answers `done` and the next online event registers it
  again. It reads presence and syncs roles; it never writes presence.
- External Discord drift (someone edits roles by hand, a nonmember joins) is not visible to any SQL
  predicate. That is why the fixer schedule matters for this kind: see
  [Latency changes](#latency-changes-named).

## Timer API

Base URL is the worker (`https://duoly-discord-gateway.duoly.workers.dev`). All times are integer
epoch milliseconds, UTC. Bodies are at most 2048 bytes. Schemas live in
`src/contracts/background.ts`; both sides parse with them, nothing is hand parsed.

### Register: `POST /timers`

```http
POST /timers
content-type: application/json
x-duoly-timestamp: 1793005200000
x-duoly-signature: v1=<64 hex characters>

{"at": 1793005300000, "ref": "b1a77e3c-0f2a-4a6e-9c21-9e4f0a1d3b55", "kind": "order-post", "epoch": 1793005200000}
```

- `kind`: one of `order-post`, `order-expire`, `settle-retry`, `analytics-retry`, `presence-check`.
- `ref`: 1 to 64 characters of letters, digits, hyphen or underscore. An order id, or a slug for a
  singleton. No colon, because the key uses it as the separator.
- `epoch`: milliseconds of the committed state that asked for the timer. `0` means a recurring
  singleton.
- `at`: when to fire. Refused outside 7 days back to 90 days ahead.
- `key` (optional): must equal `` `<kind>:<ref>:<epoch>` `` when sent. The SQL trigger leaves it out.

Idempotency key: `` `<kind>:<ref>:<epoch>` ``, for example
`order-post:b1a77e3c-0f2a-4a6e-9c21-9e4f0a1d3b55:1793005200000`. Registering a key that exists keeps
the **earliest** `at`, so a dependency event can only pull a wake-up forward. A handler that wants a
later wake-up answers `retry` or `pending` instead of registering.

Answers `200 {"key":"...","at":...,"stored":"stored"|"kept"|"refused"}`, `401` on a bad signature,
`400` on a body the schema rejects. The signature is checked in the worker itself, so an unsigned
call never wakes the Durable Object.

The DO keeps a version per row that changes whenever the row's due time changes, and the alarm's
delete or re-arm only applies while the version still matches the one it claimed. A registration
that pulls a wake-up forward while the callback is in flight therefore survives that callback
(review F11). A registration for a _later_ time on a key that is firing answers `kept` and the
disposition then applies as usual, which is correct because the same key is the same kind, ref and
epoch, so it is the same piece of work: a handler that wants a later wake-up answers `retry` or
`pending` instead of registering.

### Fire: `POST https://duoly.gg/api/internal/timer`

```http
POST /api/internal/timer
content-type: application/json
x-duoly-timestamp: 1793005300040
x-duoly-signature: v1=<64 hex characters>

{"key":"order-post:b1a77e3c-0f2a-4a6e-9c21-9e4f0a1d3b55:1793005200000","kind":"order-post","ref":"b1a77e3c-0f2a-4a6e-9c21-9e4f0a1d3b55","epoch":1793005200000,"at":1793005300000,"attempt":1,"firedAt":1793005300040}
```

`at` is the due time this fire is for, `firedAt` is now, `attempt` counts from 1 and never exceeds 4.

The answer is one of:

| Disposition                                       | Meaning                                | Worker           |
| ------------------------------------------------- | -------------------------------------- | ---------------- |
| `{"status":"done"}`                               | the work finished                      | forget the timer |
| `{"status":"stale"}`                              | the key no longer describes reality    | forget the timer |
| `{"status":"disabled","mode":"legacy"\|"shadow"}` | switch is off; nothing was done        | forget the timer |
| `{"status":"retry","at":...}`                     | run the same work again at `at`        | re-arm           |
| `{"status":"pending","at":...}`                   | waiting on other work; recheck at `at` | re-arm           |

Every disposition may carry a `note` of up to 200 characters, which the worker logs. Anything else,
any non-2xx and any timeout counts as a failed delivery.

The handler finishes its bounded work before it answers, and never acknowledges in `waitUntil`: a 2xx
sent before the work finished would permanently acknowledge work that then fails (review F18).

### Health: `GET /timers/health`

`Authorization: Bearer <BACKGROUND_HEALTH_SECRET>`. Returns counts per kind, how many are due, the
oldest due time, the last fire, the last error, how many timers were dropped and the last Supabase
keep-alive read. No secrets, no customer data.

### Signatures

Both directions use the same scheme, so one helper covers the worker, the app and the database:

```
signature = "v1=" + hex(HMAC_SHA256(secret, timestamp + "." + body))
```

- `timestamp` is the decimal millisecond value of the `x-duoly-timestamp` header.
- `body` is the exact request text, verified before any JSON parsing. Never re-serialize and then
  verify.
- Accepted while `abs(now - timestamp) <= 5 min`, which covers clock skew in both directions and
  bounds replay. The receiver refuses a secret shorter than 32 characters, so a half configured
  deployment does nothing instead of running unauthenticated.
- Known answer vector, shared by `openssl dgst -sha256 -hmac`, `extensions.hmac(...,'sha256')` and
  Web Crypto: secret `duoly-background-test-secret-0123456789`, timestamp `1767225600000`, body
  `{"ok":true}` gives
  `v1=bf92eb9d79efdbab3e9ee0e2cf0f78376423e844585117b0f990ed22679defd4`.

Why HMAC and not a bearer for registration: `pg_net` keeps request headers in a queue table whose
PUBLIC grants cannot be revoked on managed Supabase, so a bearer there is readable by database login
roles while it is queued, and a leaked registration bearer lets anyone schedule arbitrary load
(review F9). A signature over the body leaves the secret in Vault, binds the request to its body and
expires in 5 minutes. In SQL, sign the canonical text of the same `jsonb` value that is sent:

```sql
v_ts   := (pg_catalog.extract(epoch from pg_catalog.clock_timestamp()) * 1000)::bigint;
v_body := v_json::text;  -- exactly what pg_net sends for body := v_json
v_sig  := 'v1=' || pg_catalog.encode(extensions.hmac(v_ts::text || '.' || v_body, v_secret, 'sha256'), 'hex');
```

`jsonb::text` is deterministic (keys sorted by length then bytes, `", "` and `": "` separators), so
the signed text and the sent bytes are the same string. Shadow mode proves this end to end before
anything depends on it: a serialization mismatch would show up at once as 401s on `/timers` and as
missing timers in `/timers/health`.

`/api/internal/reconcile` keeps a plain bearer (`BACKGROUND_RECONCILE_SECRET`), like today's ticks.
That credential grants only "run the existing reconcile handlers", which is the same narrow
capability the live dispatcher already enqueues, and the call comes from SQL where signing a fixed
empty body would add nothing.

## Retries, dropping and the fixer

Delivery failures (no response, 5xx, unparsable answer) are retried by the worker at +30 s, +2 min
and +10 min with 10% jitter, then dropped with a log line and counted in `/timers/health`. The alarm
handler catches its own errors instead of throwing, so Cloudflare's six built in retries never
interleave with this schedule. One poison timer cannot block later deadlines: due timers are handled
in bounded batches and a failing one only re-arms itself.

The numbers the worker uses: at most 8 due timers per alarm (the alarm re-arms at once, so a backlog
drains in waves), a 10 s timeout per fire request, and no re-arm sooner than 1 s from now, so a
`retry` cannot spin the alarm. While `BACKGROUND_FIRE_SECRET` is missing or shorter than 32
characters nothing is sent at all: the timers stay, the error lands in `/timers/health` and the
object looks again in 5 minutes, so a half configured deployment cannot burn a timer's attempts.

A dropped or never registered timer is not lost work. `public.background_overdue()` returns one
boolean per kind from `duoly_dispatch_has_work`, which is read only and already covers queued orders
past their deadline, open Discord posts to close, cancelled team seats, stale wallet holds, claimable
settlements, unsent analytics and drifted roles. A predicate that errors reads as overdue, so a
broken query makes the fixer call the real handler rather than believe nothing is wrong.

`public.background_fix()` calls `/api/internal/reconcile` only when something is overdue, with
`{"reason":"overdue","kinds":["payments",...]}` as the body. Finding work means a timer was missed,
so the call is also the alert: the endpoint raises it in the admin Discord channel with the existing
helpers, and `background_fix()` leaves the same evidence as a Postgres warning. The database does not
talk to Discord itself, which keeps the alert path in one place and adds no third Vault secret.
`background_fix()` never raises: a cron job that throws writes a failed run row and nothing else, so
it returns `{"overdue":...,"called":false,"error":"<sqlstate>"}` instead.

The fixer ships and runs before any poll is paused (review F20): `duoly-dispatch` is still scheduled
when the migration lands, and `background_fix()` can be called by hand at any time.

## Finalize and rollback

When all four kinds are `live` and a day of watching is clean:

```sql
select public.background_finalize();                  -- hourly fixer
select public.background_finalize('*/10 * * * *');    -- every 10 minutes (recommended while roles is live)
```

`background_finalize(p_schedule text default '0 * * * *')` schedules `duoly-background-fix` with the
given schedule and then pauses `duoly-dispatch` with `cron.alter_job(active := false)`, never
`unschedule`. In that order, so a schedule the owner mistyped fails before anything is paused. It
refuses outright while any kind is not yet `live`, because pausing the dispatcher then would leave
that kind with nobody doing the work, and it only accepts a five field cron expression: a sub-minute
schedule here would put back the writes this whole build exists to remove.

`public.background_rollback()` does the reverse: it pauses the fixer and sets `duoly-dispatch` active
again. Both are idempotent, both are revoked from `anon`, `authenticated` and `service_role` so they
are owner-only in the SQL editor, and both leave the switches alone, so the order of operations under
pressure is always:

1. `update public.background_switches set mode = 'shadow'` for the kinds you distrust.
2. `select public.background_rollback();` if the dispatcher is currently paused.

Doing it in that order means the dispatcher is back before the timers stop acting, so no window has
nobody doing the work. The migration itself does not pause `duoly-dispatch`.

## Deploy order

1. **Merge.** The app endpoints exist; no switch rows exist yet, so every kind reads as `legacy` and
   every fire answers `disabled`. Nothing changes in production.
2. **App environment.** In Vercel set `BACKGROUND_FIRE_SECRET`, `BACKGROUND_RECONCILE_SECRET`,
   `BACKGROUND_TIMERS_URL`, `BACKGROUND_REGISTER_SECRET` and redeploy.
3. **Worker.** `cd workers/discord-gateway && wrangler deploy`, then
   `wrangler secret put BACKGROUND_REGISTER_SECRET`, `BACKGROUND_FIRE_SECRET`,
   `BACKGROUND_HEALTH_SECRET`, `SUPABASE_KEEPALIVE_URL`, `SUPABASE_KEEPALIVE_KEY`. The `v2` migration
   adds the `Timers` class; `DiscordGateway` and its `v1` tag stay untouched, and the gateway keeps
   its own alarm.
4. **Check the worker.** `curl -H "Authorization: Bearer <health secret>" .../timers/health` returns
   zeros, and `GET /status` still shows the bot online.
5. **Vault.** Create `background_timers_url`, `background_register_secret` and
   `background_reconcile_secret`. Do this before the migration: the trigger silently skips while they
   are missing, which is also what keeps local CI quiet.
6. **Migration.** Apply it. All four kinds are `shadow` from this moment: timers get registered and
   handlers only log. `duoly-dispatch` keeps doing the work.
7. **Watch 2 to 3 days.** Every queued order got both timers, fire times match the 10 s tick's
   actions, `/timers/health` shows no backlog and no drops, shadow log lines say what the tick did.
8. **Flip one kind a day**, in this order, with 24 h of watching each: `analytics`, `roles`,
   `payments`, `orders`. Lowest customer impact first, money and the Discord post last.
9. **Finalize** when all four are live and clean: `select public.background_finalize('*/10 * * * *');`
10. **Later**, after seven clean days, a separate PR drops the paused jobs and the retired endpoints.
    Never delete `discord_roles_tick_secret`: `duoly-performance-recalc` still uses it (review F16).

## Secrets and Vault entries

Names only. The owner creates every value; nothing in this repo or in any migration contains one.
Use 48 random characters, for example `openssl rand -base64 36`.

| Value               | Vault (database)              | Vercel env (app)              | Worker secret                                      |
| ------------------- | ----------------------------- | ----------------------------- | -------------------------------------------------- |
| register timers     | `background_register_secret`  | `BACKGROUND_REGISTER_SECRET`  | `BACKGROUND_REGISTER_SECRET`                       |
| fire a timer        |                               | `BACKGROUND_FIRE_SECRET`      | `BACKGROUND_FIRE_SECRET`                           |
| read health         |                               |                               | `BACKGROUND_HEALTH_SECRET`                         |
| run the fixer       | `background_reconcile_secret` | `BACKGROUND_RECONCILE_SECRET` |                                                    |
| worker base URL     | `background_timers_url`       | `BACKGROUND_TIMERS_URL`       |                                                    |
| Supabase keep-alive |                               |                               | `SUPABASE_KEEPALIVE_URL`, `SUPABASE_KEEPALIVE_KEY` |

The app base URL (`https://duoly.gg`) is a committed worker var, not a secret. Same name means same
value on both sides. Rotation: set the new value on both sides within 5 minutes, or accept a few
refused registrations that the fixer covers.

`background_timers_url` is the worker's base URL, lowercase, `https://` only and with no trailing
slash, for example `https://duoly-discord-gateway.duoly.workers.dev`. The trigger appends `/timers`
and refuses any other shape, so a typo registers nothing instead of posting a signed body somewhere
unintended. Every one of these reads is a Vault name lookup that requires exactly one row and, for
the secrets, at least 32 characters: a half created entry makes the trigger skip in silence, which
is also what keeps local CI and the SQL suites quiet.

Secret consumer map, so nothing retired breaks a retained job (review F16):

| Secret                      | Still used by                                                         |
| --------------------------- | --------------------------------------------------------------------- |
| `discord_roles_tick_secret` | `duoly-dispatch` (orders, roles), `duoly-performance-recalc` HTTP leg |
| `payments_tick_secret`      | `duoly-dispatch` (payments), the SQL test guard                       |
| `analytics_drain_secret`    | `duoly-dispatch` (analytics)                                          |
| `proof_cleanup_*`           | `private-proof-cleanup` every 15 min, untouched                       |

## Supabase keep-alive

Supabase may pause a Free project that shows low activity over seven days. The worker's existing one
minute cron therefore makes one cheap authenticated REST read a day,
`POST /rest/v1/rpc/presence_public_count` with the publishable key (the same read the homepage does,
anon executable, no writes), and records the time in `/timers/health`. The interval is 23 hours, so
a calendar day never passes without one, and a read that fails is retried in an hour rather than in
a minute. This is monitoring, not a
documented exemption: Supabase does not promise that one request a day prevents a pause (review F21).
If the project does get paused, outstanding timers keep retrying, get dropped after 10 minutes, and
`background_overdue()` finds the work from source state once the database is back.

## What to watch

```sql
-- switches and when they last changed
select kind, mode, updated_at from public.background_switches order by kind;

-- anything overdue right now (all false is the healthy answer once a kind is live)
select public.background_overdue();

-- cron runs and writes per day, the number this whole build exists for
select jobname, count(*) from cron.job_run_details
  where start_time > pg_catalog.now() - interval '1 day' group by 1 order by 2 desc;

-- analytics outbox by state: pending, eligible now, leased, parked, oldest (review F19)
select count(*) filter (where sent_at is null and failed_at is null) as pending,
       count(*) filter (where sent_at is null and failed_at is null
         and (claimed_until is null or claimed_until <= now())) as eligible,
       count(*) filter (where sent_at is null and failed_at is null and claimed_until > now()) as leased,
       count(*) filter (where failed_at is not null) as parked,
       min(created_at) filter (where sent_at is null and failed_at is null) as oldest
  from public.analytics_outbox;

-- settlements the claim path has given up on; the overdue predicate deliberately excludes these
select order_id, settle, attempts from public.order_payments where settle <> 'none' and attempts >= 20;

-- wallet holds with no session, past the grace period
select public.checkout_stale_wallet_holds(20);
```

Worker: `curl -H "Authorization: Bearer <health secret>" https://duoly-discord-gateway.duoly.workers.dev/timers/health`.
Healthy looks like `due` at 0 or 1, `oldestDueAt` within a few seconds of now, `dropped` 0, `lastError`
null and `keepAliveAt` inside the last 24 h.

Cloudflare dashboard, Durable Objects: requests a day (free limit 100,000), duration in GB-s (13,000),
rows read (5 m) and rows written (100,000). The gateway alone is roughly 4,300 requests and about
11,000 GB-s a day because its WebSocket keeps one object resident, so duration is the tight budget,
not requests (review F17). `Timers` hibernates in between and wakes for three things: a
registration, its own alarm, and the existing one minute cron, which asks it whether the daily
keep-alive read is due and puts the alarm back if it ever went missing. That is 1,440 short wakes a
day (about 4 GB-s, no row writes on a quiet minute) plus roughly 2 requests and 4 row writes per
order and one row write per `setAlarm`.

Vercel: errors on `/api/internal/timer` and `/api/internal/reconcile`, and the shadow log lines
`[timer-shadow] <kind> <ref> would=...` compared with what the tick actually did.

Alert thresholds worth acting on: anything `due` for more than 60 s, any `dropped`, `background_fix()`
finding work twice in a row, or a parked analytics fact.

## Writes per day, idle

Nominal, from schedules, not measured: one `cron.job_run_details` insert plus about four updates per
run, and about four unlogged `net` rows per HTTP call.

|                                  | Before 20261112090000 | Today (gated dispatcher) | After finalize, hourly              | After finalize, 10 min |
| -------------------------------- | --------------------- | ------------------------ | ----------------------------------- | ---------------------- |
| cron runs a day, idle            | ~17,400               | ~8,900                   | ~200                                | ~320                   |
| run log writes a day, idle       | ~87,000               | ~44,500                  | ~1,000                              | ~1,600                 |
| database to app HTTP calls, idle | ~17,000               | ~0                       | ~0                                  | ~0                     |
| per queued order                 | 10 s polling          | 10 s polling             | 2 timers, about 8 unlogged net rows | same                   |

"Today" is 8,640 dispatcher runs plus the hourly prune plus the money and proof jobs. "After
finalize" replaces the 8,640 with 24 or 144 fixer runs. The 96 `private-proof-cleanup` runs a day are
then the largest remaining poll; moving it to hourly is a one line `cron.alter_job` the owner can do
separately, and it is not part of this build.

## Latency changes named

Nothing a customer or teammate sees changes while the switches are `shadow`. Once a kind is `live`:

| Work                                                                                    | Today                                          | Live                                                 | Owner decision                    |
| --------------------------------------------------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------- | --------------------------------- |
| Discord public post                                                                     | 100 to 110 s                                   | exactly 100 s                                        | accepted                          |
| Order expiry                                                                            | within 20 s of 5 min                           | exactly 5 min                                        | accepted                          |
| Settlement after accept                                                                 | within 20 s, retried every 20 s                | at once, then +30 s, +2 min, +10 min, then the fixer | accepted                          |
| Orphan wallet hold with no session                                                      | within 20 s after a 10 min grace               | failure path at once; leftovers at the fixer         | accepted                          |
| Role recovery after a browser dies                                                      | within 30 s                                    | within 20 s of the beacon, or the fixer              | accepted                          |
| External Discord role drift (hand edits, a nonmember joining)                           | every 30 s sweep, 2 and 10 min refresh windows | only when the fixer runs                             | run the fixer every 10 minutes    |
| Analytics facts with no app request (signup trigger, nightly reconcile, SQL money jobs) | within 60 s                                    | only when the fixer runs                             | accepted, reporting only          |
| Proof cleanup                                                                           | every 15 min                                   | unchanged in this build                              | owner may move it to hourly later |

The roles row is the one that makes `*/10 * * * *` the recommended fixer schedule: no SQL `exists()`
can see a role someone edited by hand in Discord, so the only thing that preserves the current
10 minute membership refresh is running the reconcile that often (review F4). 144 runs a day is still
1.7% of today's 8,640.

## For Fabi

Short version: background work stops polling the database every 10 seconds and starts reacting to
events, with one exact timer per deadline. Your order and payment flows keep the same code paths.

- Timings you signed off stay: a public order posts to Discord at 100 seconds, an order expires at
  5 minutes, accepting after 5 minutes was already impossible and still is.
- Expiry, settlement, refunds to balance and wallet releases all run the existing SQL and TypeScript.
  Nothing new computes money. `src/server/payments/checkout.ts` is not touched at all.
- Everything merges switched off. A new table `public.background_switches` decides who does the work,
  and it starts in `shadow`: timers fire and only write a log line, while today's dispatcher keeps
  doing everything. Flipping a kind on is one UPDATE and so is flipping it back.
- The one thing that does get slower: an orphaned wallet hold (a checkout that died after the hold
  but before Stripe) is released by the hourly fixer instead of the 20 second sweep, in the rare case
  the failure path itself failed. Customer visible only as balance that comes back later.
- If anything looks wrong, you can roll back without a deploy and without me:
  `update public.background_switches set mode = 'shadow', updated_at = now();`

## Answers to the review

`oai-review.md`, finding by finding. "Accepted" means we do what the review asks; "answered" means we
deliberately do something else and say why.

- **F1 timer invalidation (blocker)**: accepted. The trigger is a committed wake-up; the final
  deadline is computed at fire time. A deadline can only move later, because
  `order_public_queued_at` returns `greatest(queued_at, ...)`, so a timer at `queued_at + 100 s` is
  never too late. Picks and presence need no extra registration for that reason. Team progression is
  explicit: closing a seat's post registers the next eligible seat at now, and the earliest due time
  wins. "Not eligible yet" answers `pending`, never `done`. Streaming bookings get `stale`, and no
  date ever carries infinity.
- **F2 queue transition inventory (high)**: accepted. The counts are dropped. The trigger covers
  INSERT plus UPDATE of `status` and `queued_at`, which is where queue epochs are created, and the
  acceptance list is the live producer matrix: `create_paid_order`, team seats, wallet and free
  wrappers, play again, reroll, handover, admin cancel, expiry on read. Chunk 3's SQL tests assert
  the trigger conditions; the e2e suites cover queue, accept, cancel and auto cancel.
- **F3 database origin analytics (blocker)**: answered. `waitUntil` is an optimization here, not the
  registration boundary. App origin facts drain at once, failures get retry timers, and facts with no
  app request (signup trigger, nightly reconcile, hourly money jobs) wait for the fixer. That is a
  reporting delay of up to one fixer interval, named in [Latency changes](#latency-changes-named) and
  accepted by the owner. The clean fix, a coalesced statement level wake-up from
  `analytics_outbox`, is a follow-up, and until then `analytics` can simply stay in `shadow`. Existing
  backlog is drained by the first fixer run, and `duoly_dispatch_has_work('analytics')` already counts
  expired leases and unsent rows, so activation needs no separate bootstrap.
- **F4 Discord drift and suspension (high)**: accepted, with a schedule rather than new code. No
  `exists()` can see a hand edited Discord role, so we keep an unconditional periodic reconcile:
  `background_finalize('*/10 * * * *')` preserves today's 10 minute member refresh and 2 minute
  nonmember refresh windows at 144 runs a day. `presence-check` only covers presence expiry. Deferred
  and failed hook work stays visible to the roles predicate, which compares derived state rather than
  heartbeats.
- **F5 pagehide offline (high)**: accepted. The beacon never writes persistent offline state. It only
  registers a `presence-check` timer, and the existing 20 s staleness rule decides. One leader tab per
  browser (BroadcastChannel) means a second tab closing does not look like a departure, and
  navigation and bfcache keep working. CSRF and Origin requirements on the presence endpoints stay.
- **F6 durable settlement producer (high)**: answered. Retry timers come from the failure path, and
  the durable producer is the fixer predicate
  (`order_payments.settle <> 'none' and attempts < 20`), which sees transitions the app never
  reported, including a crash before the failure was known. Handlers call the existing claim path, so
  leases, attempt counts and provider keys are unchanged. Exhausted rows (`attempts >= 20`) are
  deliberately outside the predicate, exactly as the claim is, and are a monitoring query in
  [What to watch](#what-to-watch) instead of silent retries.
- **F7 wallet holds and protected checkout (high)**: accepted. No edit to
  `src/server/payments/checkout.ts`; its release paths are verified as already present. No new
  PaymentIntent cancellation. `checkout_stale_wallet_holds` keeps its exact predicate and its paid
  intent exclusion. The increased worst case for orphan holds is documented as a latency change, not
  as "no behaviour change".
- **F8 expiry and team stragglers (high)**: accepted. The fixer calls the existing tick handler, so
  both `order_sweep` loops run, including queued and in progress seats of cancelled teams, with
  `SKIP LOCKED` retried on the next run. `order-expire` calls the same SQL, so `order_misses` and the
  shown time still use execution time presence. Concurrent team cancel and accept stay covered by the
  e2e suites.
- **F9 credentials in pg_net (blocker)**: accepted. No reusable bearer is enqueued for registration:
  the trigger sends a 5 minute HMAC over the body and the secret stays in Vault. The fire direction
  uses a different secret, a fixed destination and no caller chosen URL. Registration is bounded by
  kind, ref shape, body size and a 7 day to 90 day window, so even a forged signature cannot park
  work or exhaust the quota. Service role credentials are never enqueued. `/api/internal/reconcile`
  keeps the existing narrow bearer pattern, called out above.
- **F10 trigger ownership and loss recovery (high)**: accepted. The trigger is `security definer`
  with `set search_path = ''`, schema qualified, execution revoked from `public`, `anon`,
  `authenticated` and `service_role`, with a fixed destination and a bounded body. Missing Vault
  entries or any exception are caught and logged as a warning, so a registration failure can never
  fail a customer's checkout or accept. A request id is not an acknowledgement: reconciliation reads
  source state, never `net._http_response`. The doc says plainly that events still cost queue and
  response rows, and that the saving is the idle cron runs.
- **F11 delete on 2xx (high)**: accepted. Transport success is not completion: the five dispositions
  above are the only thing that deletes or re-arms, the delete is applied against the version the
  alarm claimed, so a registration during the callback survives, and a newer epoch is a different key
  entirely. Fire requests use a finite timeout, per timer jittered backoff and bounded due batches, so
  one poison timer cannot block later deadlines. A `disabled` answer is never counted as completion.
- **F12 Discord posting is not exactly once (high)**: accepted, and we do not claim otherwise. The
  timer only changes when the existing posting path runs. Claims per queue epoch, the ledger and the
  one minute stale `posting` recovery stay as they are, team posting stays serialized by the
  team wide predicate, and closing a known message with PATCH stays the safe repeated operation.
  Shadow never claims, posts or revokes.
- **F13 and F14 test runner and guard (high)**: already done in #222, before this build. The CI job
  starts a disposable local Supabase, applies migrations in order and runs
  `supabase/tests/ci-manifest.txt` with `psql -X -v ON_ERROR_STOP=1`; unknown files fail closed. Every
  suite carries the canonical guard, which requires a local `duoly_test_marker` schema and refuses a
  database that has `payments_tick_secret`, checked before any statement. This build adds its suites
  to that manifest and nothing else.
- **F15 pruning and retention (medium)**: already done in `20261112090000`: one bounded hourly prune
  of at most 50,000 terminal rows across all jobs, 24 h retention, and proof outcome retention kept as
  its own daily delete. No `VACUUM FULL`, no migration time bulk delete and no physical size promise.
- **F16 shared secret still in use (high)**: accepted. The consumer map above is part of this doc, and
  the retirement PR may not delete `discord_roles_tick_secret` while `duoly-performance-recalc` uses
  it. Payout freeze, performance recalc and both nightly analytics jobs are named as retained.
- **F17 Cloudflare budget (medium)**: accepted. `Timers` is a new class on the existing worker with an
  appended `v2` migration and `new_sqlite_classes`, `DiscordGateway` and `v1` untouched, each class
  with its own alarm. The budget section counts duration and rows, not only requests, and names the
  gateway's resident ~11,000 GB-s as the tight limit. No SLA is claimed: the acceptance thresholds are
  percentile fire delay plus an absolute overdue alert.
- **F18 waitUntil is not a scheduler (medium)**: accepted. Existing server only `@vercel/functions`
  usage, no new `node:` or dynamic imports in browser safe modules, bounded work awaited before the
  2xx, and durable retries registered before acknowledging. `vercel.json` is untouched, so the
  function deadline stays whatever the deployment says; the open question is listed below.
- **F19 outbox states (medium)**: accepted. The watch query above counts pending, eligible, leased,
  parked and oldest separately, parked facts alert on their own, the stable UUID and the delivery time
  consent and catalog behaviour are unchanged, and a bounded drain with work left over registers a
  continuation timer.
- **F20 sequencing and idle totals (medium)**: accepted. The fixer exists before any pause, rollback
  is "switches first, then `background_rollback()`", so the dispatcher is never stopped while timers
  still act. Alerts fire only when the fixer actually found work, and `/timers/health` is an
  independent heartbeat that does not depend on Discord. The corrected nominal totals are in the
  writes table, and each function has its own latency acceptance rather than one claim of no change.
- **F21 Free inactivity pause (low)**: accepted as an open operational risk. The daily read is
  described as monitoring, with no claim that it prevents a pause, and the pause behaviour is
  documented above.

## Answers to the open questions

1. **Who owns `duoly-payments-tick` and why is it not in a migration?** Unknown and still open. It
   was created by hand. `20261112090000` deliberately keeps its command as the source of truth,
   reads its timeout out of `cron.job` instead of guessing, and pauses rather than drops it. This
   build adds nothing that depends on it, and the retirement PR needs an owner authorized read only
   inventory first.
2. **Do `net` ACLs let login roles read queued headers?** Assume yes. The registration direction
   therefore enqueues no reusable credential at all (F9), which makes the answer irrelevant for this
   build. The owner should still check before the retirement PR, because `duoly-dispatch` and the
   proof cleanup job do enqueue narrow bearers.
3. **Maximum accepted delays?** Decided by the owner and listed in
   [Latency changes](#latency-changes-named): settlement +30 s, +2 min, +10 min then the fixer;
   orphan holds on the failure path with fixer leftovers; Discord post at exactly 100 s; expiry at
   exactly 5 min; role recovery within 20 s of the beacon; external role drift at the fixer interval,
   which is why 10 minutes is recommended; analytics with no app request at the fixer interval.
4. **Actual Cloudflare duration and row budgets?** Estimated, not measured: the gateway's resident
   object is about 11,000 of the 13,000 GB-s a day, which leaves little duration headroom. `Timers`
   is therefore event driven and hibernating, with no resident presence scheduler, and
   `presence-check` only re-arms while someone is online. Read the real numbers off the Cloudflare
   Durable Objects dashboard during shadow, before flipping `orders` live.
5. **Can the SQL suites run against latest schema?** Answered by #222: `ci-manifest.txt` lists which
   suites run, which are skipped and why, with fixture groups ordered and historical builders
   excluded. New suites in this build are latest schema only.
6. **Vercel plan, Fluid setting and function deadline?** Still open, owner only. Nothing here depends
   on a long deadline: timer handlers do bounded work and answer `retry` or `pending` rather than
   running long. The commercial use question on Hobby is unchanged by this build.
7. **Are the 125 outbox rows pending, leased, parked or sent?** Run the outbox query in
   [What to watch](#what-to-watch); the counts answer it. Retained sent rows are not backlog, and
   zero pending can still hide parked facts, which is why the query splits all five states.
8. **Does the owner accept the Free inactivity pause risk?** Yes, with the daily keep-alive read as
   best effort monitoring. Documented as a risk rather than as a guarantee.

## Build log

- Chunk 1: this document plus `src/contracts/background.ts` (kinds, switch modes, timer and fire
  schemas, dispositions, retry schedule, Web Crypto HMAC sign and verify, bearer check) and
  `tests/unit/background-contract.test.ts` with 31 unit tests. No runtime behaviour yet: nothing
  imports the contract so far.
- Chunk 2: the `Timers` Durable Object. `workers/discord-gateway/src/timers.ts` holds the whole
  protocol as functions over a `TimerStore` port (register with earliest-wins idempotency, the
  alarm with bounded batches and version-checked delete or re-arm, backoff and dropping, health,
  the daily Supabase keep-alive read and the one minute cron tick).
  `workers/discord-gateway/src/index.ts` adds the SQLite store, the `Timers` class and the two
  routes, and checks the signature and the bearer at the edge so an unsigned call never wakes the
  object; the one minute cron now also wakes `Timers`. `wrangler.jsonc` gains the `TIMERS` binding,
  migration tag `v2` with `new_sqlite_classes: ["Timers"]` and the committed `APP_BASE_URL` var;
  `v1` and `DiscordGateway` are untouched. `tests/unit/background-timers.test.ts` has 47 unit tests
  against an in-memory store and stub namespaces. `wrangler deploy --dry-run` passes (809 KiB,
  131 KiB gzipped). Nothing is deployed and no secret is set. The app endpoints do not exist yet,
  so a fire would answer 404 and the timer would be retried and then dropped.
- Chunk 3: the database half, in one new migration
  `supabase/migrations/20261112140000_background_switches_timers.sql`: `background_switches` with all
  four kinds in `shadow`, `background_mode` (fail-safe to `legacy`), `background_register_timer` (the
  signed `pg_net` post, Vault names only, silent skip while half configured),
  `background_order_timers` plus the two triggers on `public.orders`, a `create or replace` of
  `duoly_dispatch` whose only change is skipping `live` kinds, `background_overdue`,
  `background_fix`, and `background_finalize` / `background_rollback`. The migration leaves
  `duoly-dispatch` active and the fixer unscheduled, contains no secret value and edits no existing
  file. `supabase/tests/background_switches.sql` has 90 assertion statements across migration state, grants,
  the pgcrypto known-answer vector, body and signature bytes, the trigger conditions, per kind switch
  gating, a half configured Vault, the dispatcher's live skip, the overdue map, the fixer's call and
  bearer, and finalize and rollback idempotency; it is in `ci-manifest.txt` behind the canonical
  production guard. `tests/unit/background-migration.test.ts` adds 10 static guards for the
  invariants a laptop can check without Docker (appended file, no secret values, no drops, the
  dispatcher body byte-identical apart from the skip, no `cron` call outside finalize and rollback,
  timings taken from `src/contracts/background.ts`). Nothing is applied: the owner applies the
  migration and flips the switches.
