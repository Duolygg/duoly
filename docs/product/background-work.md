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

| Piece                                                    | Where                                                          | What it does                                                                                                                                           |
| -------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Timers` Durable Object                                  | `workers/discord-gateway` (class `Timers`, migration tag `v2`) | Stores one row per timer in SQLite, keeps one alarm at the earliest due time, fires a signed POST at the app, backs off, drops after the last retry.   |
| `POST /api/internal/timer`                               | app                                                            | Verifies the signature, re-reads the current state, acts (or logs in shadow), answers with a disposition.                                              |
| `POST /api/internal/reconcile`                           | app                                                            | Runs the existing tick handlers. Called by the fixer, never by a timer.                                                                                |
| `public.background_switches`                             | database                                                       | One row per kind: `legacy`, `shadow` or `live`. The only thing that decides who does the work.                                                         |
| orders trigger                                           | database                                                       | After a commit that queues an order, registers its two timers through `net.http_post`.                                                                 |
| `public.background_overdue()`                            | database                                                       | Read-only `exists()` per kind, reusing `duoly_dispatch_has_work`; returns one jsonb boolean per kind.                                                  |
| `public.background_fix()`                                | database                                                       | Posts to `/api/internal/reconcile` only when `background_overdue()` found something.                                                                   |
| `public.background_finalize()` / `background_rollback()` | database                                                       | Pause the 10 s dispatcher and schedule the fixer, or the reverse. Called by hand.                                                                      |
| `src/server/background/hooks.ts`                         | app                                                            | The event hooks: close the post, drain the outbox, register a settle retry, give a wallet hold back, ask for a presence check. All after the response. |
| `src/components/teammate/presence-leader.js`             | browser                                                        | One desk heartbeat per browser instead of one per tab, agreed over a BroadcastChannel, plus the leaving beacon.                                        |
| `src/contracts/background.ts`                            | shared                                                         | Schemas, kinds, timings, the HMAC sign and verify helper. Imported by the app, the worker and the tests.                                               |

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
- The event hooks split the same way, and the split is what makes that true by construction:
  - **Registration hooks** (`settle-retry`, `analytics-retry`, `presence-check`, the next team
    seat's `order-post`) run in `shadow` as well as in `live`. A registration writes nothing anybody
    can see, and shadow exists to prove that the registrations arrive and that their times match
    what the dispatcher did.
  - **Acting hooks** (closing a Discord post, draining the outbox, releasing a wallet hold) run only
    in `live`. In `shadow` they write one `[event-shadow] <kind> <ref> would=<act>` line and touch
    nothing.
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
3. At fire time the handler re-reads the order and asks the tick's own due predicate,
   `public.discord_order_posts_due(100)`:
   - order gone, not `queued` any more, or a different `queued_at`: `stale`.
   - a streaming booking: `stale`. `order_public_queued_at` returns `infinity` for those, and no
     date in this build ever carries infinity.
   - less than 20 s left before expiry: `stale`. The due predicate leaves that gap so nobody is
     pinged for a link that is about to die, so past it the order can never be posted.
   - the predicate does not list the order (a priority pick still holds the queue, an earlier team
     seat owns the team post, a `posting` claim is younger than a minute): `pending` at the earlier
     of now plus 60 s and the order's expiry. "Not eligible yet" is never treated as terminal.
   - otherwise it runs the existing `runOrderPosts` path for that order (same claim per queue epoch,
     same ledger) and answers `done`.

   One authority decides whether an order may be posted, and it is the SQL predicate, which already
   covers the 100 s delay, priority picks through `order_public_queued_at`, team seat order, claims
   and the 20 s guard. The handler re-derives none of it. The price is that "not eligible yet"
   carries no deadline, so a held order is rechecked every 60 s instead of exactly when the pick
   window closes: `order_teammate_picks` has no `service_role` read grant
   (`20261026160000_perks.sql:91`), and a second copy of `order_public_queued_at` in TypeScript
   could disagree with the first. An order lives 5 minutes, so that is at most four extra wake-ups,
   and a pick can only move the post time later (`greatest(queued_at, ...)`), never earlier, which
   is why one timer at `queued_at + 100 s` is never too late (review F1).

4. Closing a post stays event driven: accept, customer cancel, re-roll, admin cancel, admin refund
   and the `order-expire` timer all run the closing half of the existing tick in `waitUntil`
   (`closeOrderPostsAfter`), and after closing a team seat's post the hook registers the next
   eligible seat's `order-post` at now. Registration keeps the earliest due time, so that pulls the
   sibling's pending timer forward instead of creating a second one.

   Three things make that safe to run on every one of those events. The list of posts to close is
   `public.discord_order_posts_to_close()`, so the hook decides nothing: the same SQL that the 10 s
   tick uses picks the posts and their wording. Editing a known message with PATCH is the safe
   repeated operation, so running it twice costs one request that answers 200. And the hook never
   posts, only closes, because posting needs the 100 s delay, the claim and the queue epoch, which
   is the `order-post` timer's job alone.

   The close is gated by `orders` while `order-expire` is gated by `payments`, which is deliberate:
   with `payments` live and `orders` still legacy the timer expires the order and the 10 s
   dispatcher closes its post, exactly as today.

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

  The event that asks for it is accept, customer cancel, admin cancel and admin refund, all of
  which already try to settle at once (`settleSoon`). The hook then reads
  `order_payments(settle, attempts, updated_at)` for that one order and registers only while
  `settle <> 'none'` and `attempts < 20`. `epoch` is `updated_at`, the commit that recorded the
  attempt, so the handler needs no counter of its own, two hooks for the same attempt are the same
  key, and a row the claim path has given up on gets no timer at all (review F6).

- Wallet holds: `src/server/payments/checkout.ts` already releases the hold when session creation or
  persistence fails (`:621-648`), and that file is protected, so nothing in it changes. Its outer
  `catch` does not release, and that gap stays. The same flow that is not protected,
  `src/server/payments/play-again.ts`, reserves holds through the same
  `checkout_reserve_wallet`, and there the unexpected throw now releases the hold through
  `releaseWalletHoldAfter`. `checkout_release_wallet` reverses only holds that are still open and
  refuses a paid intent, so the hook is a no-op whenever the order was in fact created. Leftovers
  from either flow stay the fixer's job through the unchanged `checkout_stale_wallet_holds`
  predicate.
- Cancelled team stragglers and both `order_sweep` loops stay covered, because the fixer calls the
  real tick handler rather than a new predicate of its own.

### Analytics (`analytics-retry`)

- `analytics_enqueue` is SQL, so inserts also happen without any app request (the `auth.users`
  signup trigger, the nightly reconcile, hourly cashback and deposit jobs). App origin facts are
  drained in `waitUntil` right after the insert; a failed or incomplete drain registers
  `analytics-retry` at +30 s, +2 min, +10 min; everything else waits for the fixer.
- The app origin events are the order commands (accept, cancel, re-roll), the admin order commands
  and the Stripe webhook, which is where `order_funded`, `payment_captured`, `order_matched`,
  `order_refunded`, `tip_paid` and `payout_sent` come from. The webhook drains once at the end,
  after its own `stripe_events` insert and for any outcome other than `ignored`, so one hook covers
  every branch instead of one per event type.
- `analytics-retry` is a singleton (`analytics-retry:outbox:<epoch>`) and its `epoch` is `now`
  rounded down to 30 s. The outbox has no per-fact state that asks for the retry, so without that
  rounding a burst of failing requests would each write their own timer; with it they share one key
  and the ladder still measures from an instant at most 30 s old.
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
  again. It reads presence and syncs roles; it never writes presence. Two events register it: going
  online (`action: 'set', online: true`) and the leaving beacon.
- The beacon is a third action on the existing endpoint, `POST /api/teammate/presence`
  `{"csrf":"...","action":"leaving"}`, sent with `navigator.sendBeacon` because that is the only
  thing a browser still runs while a page unloads. It takes the same CSRF token in the body and the
  same Origin check as every other presence call, calls no RPC at all, and answers
  `{"queued":true}`.
- External Discord drift (someone edits roles by hand, a nonmember joins) is not visible to any SQL
  predicate. That is why the fixer schedule matters for this kind: see
  [Latency changes](#latency-changes-named).

### The desk heartbeat: one leader tab

This is the code part of phase 4, and it is about writes, not about timers. A teammate with four
Duoly tabs open writes `desk_check_in` four times every 10 seconds today, and all four writes say
the same thing. `src/components/teammate/presence-leader.js` has the tabs of one browser agree over
a BroadcastChannel (`duoly-desk-presence`, shared by the desk and every other page) so that one of
them posts and the others take its answer over the same channel.

Nothing about the rules changes. The leader still checks in every 10 seconds, the server still
treats a heartbeat older than 20 seconds as offline, and no index or query is touched. Three things
keep the 20 second window safe when the leader disappears:

- The leader is simply the lowest live tab id, so every tab works it out on its own and no handover
  message can be lost.
- A tab that goes away says `bye` on `pagehide`, and whoever leads then checks in at once instead of
  waiting for its own tick.
- A tab that dies without saying anything is caught by a watchdog: while the last check-in is older
  than 15 s, every other tab forgets the quiet tabs, takes the lead and posts. The watchdog looks
  every 4 s, so the worst case is 19 s, inside the window, and 15 s leaves the 10 s cadence 5 s of
  slack for a slow request. It runs on the same worker-driven ticker the desk uses, because a
  background tab's `setTimeout` is throttled to about once a minute.
- A check-in may never be posted faster than the cadence, so a leader whose requests all fail cannot
  turn the watchdog into a write every 5 seconds.

The failure direction is always "two tabs check in", which is exactly today's behaviour, never
"nobody checked in". Without BroadcastChannel (an old browser, a test) every tab is its own leader,
which is today's behaviour too.

The 4 hour AFK rule counts activity on any Duoly page, so a follower tab shares its newest activity
timestamp over the channel (at most once every 4 s: the leader needs the timestamp, not the
pointermove events) and the leader posts the maximum. A click while the "Still there?" warning is up
posts from the tab it happened in, leader or not, so the warning still clears in about a second.

### Two leaders, two jobs

[#227](https://github.com/Duolygg/duoly/pull/227) shipped a one-tab rule of its own while this
branch was being built, and it is live: `takePollLease` in `desk-keeper.js` is a lease in
localStorage, one per watcher name (`admin-orders`, `admin-support`, `teammate-keeper`,
`teammate-tips`), that the holder renews on every tick while the other tabs skip theirs. Merging
main therefore had one design question to answer: can that lease carry the desk heartbeat too, so
that `presence-leader.js` can go and the site has a single leader mechanism?

It cannot, and the reason is that a lease answers one question ("may I?") while a heartbeat needs
three more things:

- **The answer has to reach the follower tabs.** `POST /api/presence` answers `online`,
  `onlineSince`, `afkIn` and `forcedOffline`, and that answer is what the desk renders and what
  tells the off-desk keeper when to stop ticking. A tab that skipped its own check-in and gets
  nothing back would keep showing "online" after the server had already switched the teammate off.
  A BroadcastChannel hands the answer over; a lease in localStorage carries no payload at all.
- **The writer has to send the newest activity of any tab.** The 4 hour AFK rule counts activity on
  every Duoly page (migration 20261105160000), so the one writer posts the maximum `lastActive`
  across the browser. #227 kept check-ins per tab for exactly this reason, and said so in the
  comment in `tick`. A lease cannot collect that number; the roster already has it.
- **The leaving beacon needs to know this is the last tab.** Holding a lease says nothing about
  whether anything else is open. Being alone in the roster is the whole question, and only the
  roster can answer it.

The timing does not work either. A TTL lease hands over only when some other tab ticks _after_ the
TTL has run out, so the handover costs TTL plus one tick of the next tab. The heartbeat's cadence
is 10 s and the desk's presence ticker runs at 10 s, so a 15 s TTL gives 25 s in the worst case,
past the server's 20 s freshness window: the teammate would flicker offline. Shortening the TTL to
10 s does not help, because that is the renewal period itself, and a holder that loses its lease
between its own ticks means two tabs writing. The roster keeps those two numbers apart on purpose:
a beat counts as fresh for 15 s and the watchdog looks every 4 s, so the worst case is 19 s. To get
the same guarantee out of the lease you would have to add a 4 s ticker and a channel for the
answer, which is `presence-leader.js` rebuilt next to it, not deleted. A renewal is also a
localStorage write per tab per tick, and cutting writes is the point.

So the two stay, with a boundary rather than an overlap:

|                          | `takePollLease` (localStorage)                                                      | `createDeskPresence` (BroadcastChannel)                                                |
| ------------------------ | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Decides                  | who **reads**                                                                       | who **writes** the presence heartbeat                                                  |
| Covers                   | teammate queue and Twitch off the desk, tips, admin new orders, admin support inbox | `desk_check_in`, plus the answer fan-out, the activity maximum and the last-tab beacon |
| Cost of getting it wrong | a popup is one tick late                                                            | the teammate shows as offline                                                          |
| Handover                 | TTL expiry, or `pagehide` releases it, or the Live desk forces it                   | lowest live tab id, `bye` on `pagehide`, 19 s watchdog                                 |
| Without its browser API  | every tab polls (#227's fallback)                                                   | every tab checks in (this branch's fallback)                                           |

Each tab runs one election per job, never two for the same job. Nothing reads a poll lease to work
out who heartbeats, and nothing asks the roster who may poll. The desk itself joins the roster and
takes no poll lease, because it needs the queue for its own screen, which is #227's behaviour and
is unchanged. The two fallbacks are independent and both land on the behaviour that was live
before either change, so a browser missing one API still gets the other's saving.

What the merge kept from #227 exactly as it was written: tip notifications and `tip-alerts.js`, the
new-order bell on the admin Live desk and the teammate desk only (`claimOrderBell`, with the popup
alone off the desk and the system's own sound there), the square `/icon-192.png` on every
notification, the polling lease and all of its callers, and `tests/unit/poll-lease.test.ts`,
`tests/unit/tip-alerts.test.ts` and `tests/teammate-browser/desk-keeper.spec.ts` unchanged.

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
so the call is also the alert, and it lands in two places: `background_fix()` raises a Postgres
warning naming the kinds, and the endpoint logs
`[background-fix] reconciling <kinds> (<reason>)` plus one line per kind that failed. It is not a
Discord message: the app has no admin-channel helper today (only the support inbox has one), and
adding a channel would mean a secret that is not on the owner's list. Both lines are in
[What to watch](#what-to-watch). `background_fix()` never raises: a cron job that throws writes a
failed run row and nothing else, so it returns
`{"overdue":...,"called":false,"error":"<sqlstate>"}` instead.

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

Vercel: errors on `/api/internal/timer` and `/api/internal/reconcile`, the shadow log lines
`[timer-shadow] <kind> <ref> would=...` compared with what the tick actually did, and
`[background-fix] reconciling ...` every time the fixer found work. `[timers] ...` lines mean a
registration from app code did not reach the worker.

The event hooks have their own two lines: `[event-shadow] <kind> <ref> would=<act>` is a hook that
did nothing because its switch is `shadow`, and `[background] ...` is a hook that acted and failed
(a post that would not close, a wallet hold that would not release, a hook that threw). The second
one is worth acting on; the fixer covers the work either way.

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

Those are the idle numbers, which is where the Free plan hurts. One busy-hours write also goes down
and it is not in the table because it is not idle: a teammate's desk heartbeat is one
`desk_check_in` every 10 seconds per open tab today, so a teammate with four tabs writes 1,440 times
an hour instead of 360. The leader tab makes that 360 whatever the tab count, with no change to the
cadence or the freshness rule.

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
- The teammate desk looks and behaves the same. The only change is that several tabs of one browser
  now share one heartbeat instead of each sending their own: same 10 second rhythm, same 20 second
  rule for who counts as online, same online dot, same AFK warning. It is a database write we were
  paying for several times over, and this change is not behind a switch because it changes no
  behaviour, only the number of writes.
- If anything looks wrong, you can roll back without a deploy and without me:
  `update public.background_switches set mode = 'shadow', updated_at = now();`

## Answers to the review

`oai-review.md`, finding by finding. "Accepted" means we do what the review asks; "answered" means we
deliberately do something else and say why.

- **F1 timer invalidation (blocker)**: accepted. The trigger is a committed wake-up; eligibility is
  decided at fire time, by the tick's own `discord_order_posts_due` predicate rather than by a
  second copy of the rule. A deadline can only move later, because
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
- **F5 pagehide offline (high)**: accepted. The beacon never writes persistent offline state. It is
  `action: 'leaving'` on the existing presence endpoint, it calls no RPC at all, it only registers a
  `presence-check` timer, and the existing 20 s staleness rule decides. One leader tab per browser
  (BroadcastChannel) means a second tab closing does not look like a departure: only the last tab
  sends the beacon, and navigation and bfcache keep working. CSRF and Origin requirements on the
  presence endpoints stay, because the beacon posts the same token in the same body.
- **F6 durable settlement producer (high)**: answered. Retry timers come from the failure path, and
  the durable producer is the fixer predicate
  (`order_payments.settle <> 'none' and attempts < 20`), which sees transitions the app never
  reported, including a crash before the failure was known. Handlers call the existing claim path, so
  leases, attempt counts and provider keys are unchanged. Exhausted rows (`attempts >= 20`) are
  deliberately outside the predicate, exactly as the claim is, and are a monitoring query in
  [What to watch](#what-to-watch) instead of silent retries.
- **F7 wallet holds and protected checkout (high)**: accepted, and reported rather than worked
  around. No edit to `src/server/payments/checkout.ts`; its two named release paths are verified as
  already present (`:621-648`). Its outer `catch` releases nothing, and because the file is
  protected that gap stays as it is: an orphan hold from it is the fixer's, exactly as today. The
  same gap in `src/server/payments/play-again.ts`, which is not protected and reserves holds through
  the same function, is closed by `releaseWalletHoldAfter`. No new PaymentIntent cancellation.
  `checkout_stale_wallet_holds` keeps its exact predicate and its paid intent exclusion, and
  `checkout_release_wallet` is unchanged, so a hook on an intent that did become an order is a
  no-op. The increased worst case for orphan holds is documented as a latency change, not as "no
  behaviour change".
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
  file. `supabase/tests/background_switches.sql` has 78 assertions across migration state, grants,
  the pgcrypto known-answer vector, body and signature bytes, the trigger conditions, per kind switch
  gating, a half configured Vault, the dispatcher's live skip, the overdue map, the fixer's call and
  bearer, and finalize and rollback idempotency; it is in `ci-manifest.txt` behind the canonical
  production guard. `tests/unit/background-migration.test.ts` adds 10 static guards for the
  invariants a laptop can check without Docker (appended file, no secret values, no drops, the
  dispatcher body byte-identical apart from the skip, no `cron` call outside finalize and rollback,
  timings taken from `src/contracts/background.ts`). Nothing is applied: the owner applies the
  migration and flips the switches. Evidence: the `sql-tests` workflow ran on this branch
  (run 43199980622), started a disposable local Supabase, applied every migration in order and
  passed 38 of 38 suites with 33 skips unchanged, so the signature really does verify over the bytes
  `pg_net` sends, pgcrypto agrees with Web Crypto on the known-answer vector, and `gated_dispatch.sql`
  still passes against the replaced `duoly_dispatch`.
- Chunk 4: the app endpoints. `src/pages/api/internal/timer.ts` and `reconcile.ts` are two-line
  route files over `src/server/background/endpoints.ts`, which verifies the signature over the raw
  request text, parses with the contract, reads the switch and answers a disposition (401 on a bad
  signature or an unset secret, 400 on a body that is not a timer, 503 and never a 2xx when a read
  fails, so the worker keeps the timer). `handlers.ts` holds the five handlers over a `TimerPorts`
  interface: `legacy` reads nothing at all, `shadow` plans and logs
  `[timer-shadow] <kind> <ref> would=...`, `live` plans and then runs the existing code
  (`runOrderPosts` for one order, `sweep_expired_orders`, `settlePending`, `drainOnce`,
  `syncDiscordRoles`). `plan.ts` holds every decision as a pure function, which is what makes
  shadow structurally unable to claim, post, settle or drain. `switches.ts` reads
  `public.background_switches` with no cache and fails safe to `legacy`; `config.ts` reads the two
  secrets and the worker URL, refusing anything under 32 characters; `register.ts` is the signed
  `POST /timers` client chunk 5 uses, which never throws and returns one of
  `stored | kept | refused | skipped | legacy | invalid | failed`. One existing file changed:
  `src/server/payments/webhook.ts` now exposes the tick's body as `runPaymentsSweep()` and
  `paymentsTick` calls it, so the fixer runs the same code rather than a predicate of its own; the
  response body and the authorization check are unchanged, and
  `src/server/payments/checkout.ts` is untouched. Two deviations from the contract above, both
  written into it: a held `order-post` answers `pending` every 60 s instead of `retry` at the exact
  instant the pick window closes, because `order_teammate_picks` has no `service_role` read grant;
  and the fixer's alert is the Postgres warning plus the `[background-fix]` log line, not a Discord
  message, because the app has no admin-channel helper and a new one would need a secret that is
  not on the owner's list. `tests/unit/background-handlers.test.ts` (46), `background-endpoints.test.ts`
  (20) and `background-register.test.ts` (14) add 80 unit tests covering every handler path per
  kind and mode: stale, early fire, not eligible, duplicate claim, exhausted ladder, switched-off
  subsystem, shadow silence, and every answer parsed back through `TimerDispositionSchema`. Gates:
  `pnpm check` 0 errors over 905 files, `pnpm lint` clean, `pnpm format:check` clean,
  `pnpm test:unit` 3851 tests in 215 files, `pnpm build` green. The e2e suites that could see the
  extracted payments sweep also ran: the main config 288 passed with one load flake in
  `booking-link.spec.ts` that passes alone, the analytics config 8 passed, the teammate config 74
  passed. Nothing is wired to an event yet: until chunk 5 the only callers are the worker and the
  fixer.
- Chunk 5: the events. `src/server/background/after.ts` is the "after the response" helper (the
  Vercel request context read through its symbol, like `role-hooks.ts` does, awaited anywhere else,
  never throwing). `src/server/background/hooks.ts` holds the five hooks over a `HookPorts`
  interface (`closeOrderPostsAfter`, `drainAnalyticsAfter`, `settleRetryAfter`,
  `releaseWalletHoldAfter`, `presenceCheckAfter`), the `backgroundEvent` entry point and a
  `withBackground` route wrapper shaped like `withRoleSync`. Registration hooks run in `shadow` and
  in `live`, acting hooks only in `live` and otherwise log
  `[event-shadow] <kind> <ref> would=<act>`; `legacy` reads nothing at all. The wiring, all behind
  the switches and all after the response: `src/server/orders/handlers.ts` (accept, cancel,
  re-roll), `src/server/admin/handlers.ts` (admin cancel and refund, through a third `context`
  argument on the existing `after` hook), `src/server/payments/webhook.ts` (one drain at the end of
  the Stripe webhook, for any outcome other than `ignored`), `src/server/payments/play-again.ts`
  (the unexpected throw gives back the wallet hold it reserved),
  `src/server/presence/handlers.ts` plus `src/contracts/presence.ts` (the new `leaving` action,
  which calls no RPC at all, and a `presence-check` registration when a teammate goes online) and
  `src/server/background/handlers.ts` (the `order-expire` timer closes the post after a successful
  sweep, through a new `closePosts` port). `src/components/teammate/presence-leader.js` is the
  desk's one leader tab per browser, used by `Teammate.jsx` and `desk-keeper.js`: a BroadcastChannel
  roster, the lowest live id leads, `bye` on `pagehide` hands over at once, a worker-driven watchdog
  catches a tab that died silently inside the 20 s window, a per-check-in cap keeps the cadence, and
  activity timestamps are shared so the 4 hour AFK rule still counts every tab. One deviation worth
  naming: `src/server/payments/checkout.ts` is protected, so its outer `catch` still releases no
  wallet hold; the same gap in the unprotected play again flow is closed and the fixer still covers
  both (review F7). Tests: `tests/unit/background-hooks.test.ts` (42) and
  `tests/unit/presence-leader.test.ts` (25) add 67 unit tests, every hook in every mode plus the
  leader's election, takeover, watchdog cap, activity sharing and beacon;
  `tests/teammate-browser/desk-heartbeat.spec.ts` adds 3 browser tests (6 with the mobile project)
  proving that two tabs of one browser keep one writer between them and that only the last tab
  beacons, with no `online: false` write anywhere. Gates: `pnpm check` 0 errors over 913 files,
  `pnpm lint` clean, `pnpm format:check` clean, `pnpm test:unit` 3918 tests in 217 files,
  `pnpm build` green, the main e2e config 289 passed and 5 skipped (queue, accept, cancel and auto
  cancel among them, no flake this time), the teammate config 80 passed, the analytics config 8
  passed. Still nothing switched on: with no `background_switches` rows every hook reads `legacy`
  and does nothing. The desk heartbeat is the one change with no switch, because it changes no
  behaviour, only the number of writes.
- Chunk 6: integration. The whole branch was reviewed against the master brief and every
  `oai-review.md` finding, and the four gaps that review and CI found are fixed:
  - `tests/unit/background-endpoints.test.ts` built its fixture order from the literal date
    `2026-11-12T12:00:00Z` while the real ports it exercises read `Date.now()`. The SQL due
    predicate refuses to post an order with less than 20 s of its 5 minutes left, so that queue
    epoch stopped being postable at 12:03:20Z and the shadow assertion flipped from `would=post`
    to `would=stale` for everybody after it. CI caught it 11 minutes after the first green run.
    The fixture is now relative to the clock, which is what every other suite in this build
    already did (they inject `now` through their ports).
  - the `background_fix` comment in the migration claimed the endpoint alerts an admin Discord
    channel, which this build deliberately does not do: the two log lines are the whole alert.
  - the leader watchdog's worst case is 19 s, not the 18 s its comment said. Still inside the
    20 s window.
  - `backgroundModes` was an unused export whose comment named consumers it never had.

  Chunk 3's entry above also overstated the SQL suite's assertion count; it is the measured 78
  now. Nothing else needed changing: all 21 review findings are handled in code, not only in
  prose, and every path this doc cites exists.

  Gates, all from this worktree on this head: `pnpm check` 0 errors and 0 warnings over 914 files,
  `pnpm lint` clean, `pnpm format:check` clean, `pnpm test:unit` 3918 tests in 217 files (235 of
  them across the eight files this build added), `pnpm build` green,
  `node scripts/seo-verify.mjs` 130 passed, and
  `wrangler deploy --dry-run` green (809 KiB, 131 KiB gzipped, bindings `BOT`, `TIMERS` and
  `APP_BASE_URL`; nothing deployed and no secret set). End to end: the main config 289 passed and
  5 skipped, chat 12, completion 20, teammate 80, analytics 8, profiles 49 passed and 1 skipped.
  Two flakes, both reproduced as flakes and not as regressions: the known chat "anchored on resize"
  test failed once under load and passed alone, and `desk-keeper.spec.ts` "other pages warn too,
  once" failed once on desktop under load and then passed 30 times out of 30 with
  `--repeat-each=3`, plus a clean 80 of 80 for the whole teammate config afterwards.

  CI on PR #228: `sql-tests` started a disposable local Supabase, applied every migration in order
  and ran 38 of 38 manifest suites with 0 failures and the same 33 skips as before,
  `background_switches.sql` among the passes. So the signature really does verify over the bytes
  `pg_net` sends and pgcrypto agrees with Web Crypto on the known-answer vector.
  `gated_dispatch.sql` still passes against the replaced `duoly_dispatch`. Browser smoke, Quality,
  Design guard and all three CodeQL analyses pass too.

  Nothing is deployed, no secret is set, no migration is applied and the production database was
  never touched: the owner does all of that, in the order under [Deploy order](#deploy-order).

- Chunk 7: the merge with main. `922e291` (#227: tip alerts, the bell on the desks only, one
  polling tab) landed in main while this branch was being built and conflicted in
  `Teammate.jsx` and `desk-keeper.js`, because both changes answer the same question for different
  jobs. #227 is kept exactly as it was written and this branch's presence layer sits on top of it;
  [Two leaders, two jobs](#two-leaders-two-jobs) is the design decision and why #227's lease could
  not simply carry the heartbeat. Only three things changed outside the conflict hunks, all of them
  prose: the file comment in `desk-keeper.js` now says one tab posts the check-in for the browser,
  the note above `takePollLease` draws the boundary between the two mechanisms, and the comment in
  `tick` that said "check-ins stay per tab" says what the lease decides instead. #227's own files
  (`tip-alerts.js`, `order-alerts.js`, `AdminApp.jsx`, `LiveDesk.jsx`, `QueueRoom.jsx`,
  `about.astro`, `content-dates.ts`) and its three test files are untouched.

  Gates, all from this worktree on the merge commit: `pnpm check` 0 errors and 0 warnings over 917
  files, `pnpm lint` clean, `pnpm format:check` clean, `pnpm test:unit` 3930 tests in 219 files
  (#227's `poll-lease` 6 and `tip-alerts` 6 beside this branch's `presence-leader` 25, all
  unchanged), `pnpm build` green, `node scripts/seo-verify.mjs` 130 passed. End to end: the main
  config 289 passed and 5 skipped, teammate 80 passed, completion 20, analytics 8, profiles 49
  passed and 1 skipped, chat 11 passed with one load flake (`order-ai-status.spec.ts`, which
  passes in 6 s alone against 5.8 min under load). The two desk specs that the conflict touched ran
  with `--repeat-each=3`: 48 of 48, desktop and mobile, with `--trace off`. Tracing on, the same
  run reports up to 5 failures, every one of them `browserContext.close: ENOENT` on a file under
  `test-results/.playwright-artifacts-*`: Playwright's own artifact writing on a loaded laptop, no
  assertion among them.

  CI on PR #228 at this head: CodeQL and all three analyses, Browser smoke, Design guard, Quality,
  `sql-tests` and the Vercel preview all pass.
