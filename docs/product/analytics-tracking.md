# Analytics tracking (PostHog): build ledger

Spec: `POSTHOG-SPEC.md` (owner approved 2026-11-04) in the project folder outside this repo; research in `posthog-research/`. This ledger is the resume point after any interruption: read it, then `git log` on the branch named in the current row.

Owner decisions: four PRs; personless business totals without Analytics consent; managed proxy later (direct `https://eu.i.posthog.com` until then, env change only); no replay on `/teammate`; owner and coworker accounts internal via `ANALYTICS_INTERNAL_USER_IDS`.

| Slice                  | PR   | Status                                   | Merge commit                               |
| ---------------------- | ---- | ---------------------------------------- | ------------------------------------------ |
| A1 core                | #130 | Merged                                   | `c85fc5091d0312f00998aec0ac7aeef1bfaf2c84` |
| A2 journey             | #132 | Merged                                   | `76a350e29ef8a8e8fddd1b51a848c17ce6e8a897` |
| Privacy copy           | #133 | Merged                                   | `11040f6878faf1b3269585bf64429da730e26146` |
| B outbox/server/Sparky | #137 | Merged                                   | `c0799b0265fd98557b9f8eb8750e8eeb99652c58` |
| C insights             | #139 | Merged                                   | `3b4f5076a7c8364d137cb77ead477024ad549b74` |
| Source maps            | #140 | Merged; upload awaiting owner activation | `36e76f8ff88fe8f97735bf89ec3545134b74a5e3` |

## Live status (2026-11-05, 09:41–09:44 UTC)

Read-only site, database and EU PostHog project **329587** checks; no synthetic events or hosted configuration changes. Counts below are unfiltered ingestion checks, not dashboard business metrics. Earlier slice sections retain their historical verification scope.

| Check                                          | Observed                                                                                                                                                                                                                                                                                             |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Production release                             | `/games` serves `36e76f8ff88f`, matching latest `origin/main` at verification (#140).                                                                                                                                                                                                                |
| Public source maps                             | Three home-page `/_astro/*.js` bundles checked: all `.map` requests **404**, no `sourceMappingURL` comments. Upload/release linkage remains inactive pending credentials.                                                                                                                            |
| Database outbox                                | Backlog **0**, oldest pending age **0 s**; only `user_signed_up`: **4 total / 4 sent / 0 parked**. PostHog contains all four across their original occurrence dates.                                                                                                                                 |
| Drain                                          | Latest **10/10** cron runs succeeded (09:34–09:43 UTC). HTTP responses in each run's first second: **10/10 HTTP 200**, no timeouts, each reporting **0 claimed / 0 sent**.                                                                                                                           |
| Events, preceding 24h                          | `$pageview` **69**, `$pageleave` **64**, `$web_vitals` **50**, `$identify` **3**, `$set` **2**, `user_signed_up` **1**. The signup is `source=outbox`.                                                                                                                                               |
| Direct server / AI / exceptions, preceding 24h | `user_logged_in`, `review_submitted`, `discord_linked`, `teammate_applied`, `handover_created`: **0 each**. `$ai_generation`: **0**, average latency **N/A**. `$exception`: **0**, with `$release_id`: **0**. These paths remain unproven by natural production activity, not demonstrated failures. |
| Privacy spot check, preceding 24h              | **0** events with `@` in `$current_url` or `$el_text`; this narrow check is not a full PII audit.                                                                                                                                                                                                    |
| Dashboards                                     | IDs **1086532–1086539**, all `[duoly]`: North star **4**, Booking funnel **9**, Liquidity **4**, Acquisition **6**, Retention **3**, Quality **4**, Health **15**, Sparky **6** tiles (**51 total**).                                                                                                |
| Declarative dry-run                            | `node scripts/posthog/apply.mjs`: **0 planned creates / 0 planned updates**, no settings changes.                                                                                                                                                                                                    |
| Alerts                                         | **3 enabled** (checkout spike, queue expiry, pageviews zero), **2 paused** (funding zero, outbox zero); all five **Not firing**.                                                                                                                                                                     |

## Owner follow-ups

1. Create a PostHog personal API key with `error_tracking:write` + `organization:read`, scoped to project **329587**. Set Vercel production `POSTHOG_CLI_API_KEY` and `POSTHOG_CLI_PROJECT_ID=329587`, then redeploy and verify real uploads/symbolication.
2. Launch surveys A and B from drafts when ready. Survey rendering is consent-gated (`disable_surveys: !full`); Survey A's same-session abandonment targeting remains a limitation. See `scripts/posthog/README.md`.
3. Enable paused funded-zero and outbox-zero alerts after launch through `PAUSED_UNTIL_LAUNCH` in `scripts/posthog/plan.mjs`, then apply and read back. Outbox silence is not scheduler/backlog health.
4. `checkout_abandon_detected` needs a server signal; not built.
5. Replay Vision monitor and Discord destination were not created.
6. `e.duoly.gg` managed proxy is deferred.

## A2: what it adds

- Interaction capture (autocapture of click, change and submit; rage and dead clicks; heatmaps; unhandled errors) only with Analytics consent. `featureConfig()` is re-applied on every consent change; `before_send` drops these events for refusers regardless.
- Session replay is started by the controller only with Analytics consent and only on `policy: 'full'` pages. Inputs masked, `[data-private]` text masked, `[data-private-block]` and iframes not recorded, no console logs, no headers or bodies, network names templated and secret routes hidden.
- Sanitizer handles `$elements_chain` hrefs, heatmap URL keys, replay meta and custom events (DOM tree untouched), exception frames, and scrubs URLs and email addresses in free text.
- Product events: `track()` in `src/client/analytics/track.ts` dispatches a window event; the boot script captures it with catalogue-validated properties (`src/contracts/analytics-events.ts`). `reportError()` does the same for handled errors.

## A1: what it does

- `src/server/analytics/boot.ts` decides per page: no data island (SDK never starts) when not configured, on `/admin`, `/claim`, `/reset-password`, `/auth` and for admins. `no-replay` on desk, profile, dashboard and checkout. Sends only account id, role, internal flag, route template and release.
- `src/client/analytics/controller.ts` is the only code that changes SDK state: nothing before a cookie choice; refusers get cookieless counting; accepters are identified before the first pageview; logout or account switch resets; withdrawal resets and opts out.
- `src/client/analytics/sanitize.ts` runs as `before_send`: SDK protocol fields kept, every URL channel templated (`/queue/:id`), query reduced to bounded UTM values (Analytics consent only) and click ids (marketing consent only), titles replaced, unknown events dropped.
- A1 sends only `$pageview`, `$pageleave` (scroll depth), `$web_vitals`, `$identify`, `$set`. Autocapture, replay, heatmaps, surveys and exceptions stay off until A2 adds the privacy markers.

## Activation (owner, after merge)

1. PostHog project 329587: enable cookieless tracking (Web analytics settings). Without it refusers are not counted.
2. Vercel production env: `PUBLIC_ANALYTICS_ENABLED=true`, `PUBLIC_POSTHOG_KEY` (project token, Keychain `duoly-posthog-project-token`), `ANALYTICS_INTERNAL_USER_IDS` (comma separated account ids). Optional `PUBLIC_POSTHOG_HOST` (default EU ingestion), `ANALYTICS_HOSTS` (default `duoly.gg,www.duoly.gg`). Redeploy.
3. Verify: accept analytics on duoly.gg, then a HogQL query shows a pageview with a templated URL.

## Tests

- Unit: `tests/unit/analytics-core.test.ts` (sanitizer, controller transitions, server boot, config).
- Browser: `playwright.analytics.config.ts` (port 4361) points the SDK at a fake host and decodes real payloads. posthog-js drops events from automated browsers, so the spec hides `navigator.webdriver` and the HeadlessChrome brand. Astro's dev toolbar covers the banner buttons: use `press('Enter')`.

## Server consent snapshot

`feat/analytics-consent-sync` adds `20261106100000_analytics_consent.sql`.
Apply the additive migration before deploying the sync endpoint. It has RLS,
no browser policies or grants, and service-role CRUD only. No hosted database
changes are part of this branch's verification.

- `recordAnalyticsConsent(client, userId, state)` stores only analytics and
  marketing with a refreshed timestamp. The endpoint reuses `supportService()`
  (the existing service-role factory and `SUPABASE_SECRET_KEY`). Errors are
  logged without identity or provider payloads and swallowed.
- `POST /api/analytics/consent` uses `accountContext.identity()` and reads only
  `duoly-consent`, never body consent or identity. The existing `verifyCsrf`
  helper requires the configured Origin and an `X-CSRF-Token` matching the
  HttpOnly CSRF cookie. SiteLayout passes its existing token through the
  analytics island's `data-csrf` attribute.
- Responses are no-store: 204 with an empty body on valid consent, absent or
  invalid consent, or best-effort sync failure; 401 `{ "error": "Authentication
required." }` when signed out; 403 `{ "error": "Request could not be verified.
Reload and try again." }` for Origin or CSRF failure; 405 `{ "error": "Method
not allowed." }` with `Allow: POST` for other methods.
- Signed-in, eligible analytics pages sync once per document when a choice
  exists and again on `duoly:consent`, including withdrawal. Network failures
  are ignored. No cookie choice, no uid or no island means no sync request.
- Tests: `analytics-consent-sync.test.ts` (endpoint, write failures, timestamp,
  static migration isolation and additive-only diff) and
  `analytics-consent-browser.test.ts` (load, withdrawal, first choice, guards).
  SQL assertions are source checks, not executed database acceptance.
- Delivery-time identity resolution and pre-handler checkout, PRO and review
  adapter snapshots remain for the outbox/server-events branch.

## Browser product event wiring (`feat/analytics-events`)

- Live components and pages call the typed `track()` API for section 7 browser events. No server or outbox producers are added. The event catalogue is unchanged.
- Game and PRO views run after window load; selections run only in user handlers, not for defaults. Payment events cover order, PRO and tip forms, including express checkout. Stripe error properties use only structured type/code, never messages.
- `match_seen` uses the existing server DTO timestamps, preserved by the dashboard mapper, rather than estimating queue wait from the time the page was opened. Tips use the server-returned EUR amount.
- Deliberate skip: `checkout_abandon_detected`. The browser has no existing server-provided signal for an open checkout intent older than 15 minutes. Pending local booking selections are not payment intents.
- `tests/unit/analytics-events-wiring.test.ts` checks catalogue membership, browser event coverage with this explicit skip, and no instrumentation in design references. `analytics-event-values.test.ts` checks bounded structured error codes.
- No production PostHog ingestion, hosted payment, or database changes are exercised by these local gates.

## Replay privacy markers and island boundaries

`feat/analytics-privacy-markers` adds live DOM blocks for account menus, payment
forms, chat, support, authentication, payouts, proofs, applications, contact,
booking details, teammate identities, testimonials, activity and order history.
QueueRoom masks its remaining text. Design-reference components are untouched.

`AnalyticsErrorBoundary` wraps the LiveHome, LiveQueueRoom, CheckoutPanel,
LiveDashboard and LiveTeammate exports. It reports through `reportError`, adds no
DOM, and renders only an explicit fallback or null after a render error.

The real-recorder canaries in `tests/analytics-browser/privacy.spec.ts` check
`/s/` POSTs and decode transport gzip/base64 plus rrweb's independently gzipped
snapshot and mutation fields. Public hero text must occur in a decoded snapshot;
rendered testimonial text, a teammate supplied through Astro island props, masked
text and contact input `CANARY-7781` must not. The preview contact page is opened
using its existing `closed` island prop in the intercepted document response, so
no database or provider configuration or form submission is needed.

The tests found two additional replay prerequisites: consented visitors need
remote config (`advanced_disable_flags: false`), and Astro island `props`
attributes must be masked independently of descendant privacy markers. The dev
toolbar also copies island props into its shadow DOM and is blocked. Refusers
still disable remote config. The fake host serves the installed lazy recorder,
not a recorder stub; invalid payload decoding fails the test.

## Server direct facts and Sparky (`feat/analytics-server`)

- Dependencies are exact: `posthog-node` 5.61.2 and `@vercel/functions` 3.10.6.
  The lazy warm-runtime client reads the same runtime/build env fallback as boot,
  queues with `flushAt: 20`, disables timer flushing and GeoIP, and never shuts
  down. `flushAnalytics()` protects each instrumented path with `waitUntil` and
  catches SDK/platform failures without logging provider payloads or identities.
- `SERVER_EVENT_CATALOGUE` is separate from the browser catalogue: creator link,
  review, login, Discord link/unlink, reset request, teammate application, desk
  transition, offer pass, handover, first match report, streaming save, payout
  setup, and support handoff. Only declared bounded values leave the server.
- Direct requests read `duoly-consent`. Explicit Analytics consent permits the
  verified account id and a validated UUID v7 session header. False or missing
  consent uses an independent UUID v5 derived from a per-fact key, with person
  profiles disabled. No account/order/intent ids are allowed in event properties.
- Sparky emits one `$ai_generation` per actual fetch, a per-turn trace id, and
  `$ai_span` for each executed tool. It sends only actual provider usage, model,
  timings in seconds, status, safe tool names and bounded outcomes. Conversation
  ids are included only with Analytics consent; admin questions produce no AI
  telemetry. Prompts, answers, tool definitions, arguments and results are absent.
- Review instrumentation runs before the tip retry branch can replace the failed
  initial review result. Recovery and Discord linking do not count as logins.
  Creator events count successful referral-cookie captures in the editable
  middleware wrapper; the protected referral implementation is unchanged.
- First-report and explicit desk-transition detection use best-effort pre-reads
  because the existing write RPCs return no atomic `created`/`changed` marker.
  Unknown prior state suppresses the event rather than guessing. Desk reads use
  the existing service-role factory and its column grant; heartbeats never emit.
  Concurrent duplicate first saves or switches are not an exactly-once guarantee:
  atomic predicates would require a separately coordinated RPC/database change.
- Tests cover identity/consent/session validation, RFC UUID v5 vectors, catalogue
  and AI sanitization, disabled config, capture/flush failures, real mocked model
  calls, missing usage, network/HTTP/JSON failures, tools, admin exclusion, and
  handler first-save/transition guards. The consent migration test uses the
  owner-requested `existsSync(file)` fix for a migration already on the base branch.
  The chat browser test now waits for emoji insertion to restore textarea focus
  before filling a new draft: otherwise its deferred rAF can reset the new draft's
  caret to position 2. This reproduced twice in the full gate; the synchronized
  mobile test passes ten repeated runs without changing application chat code.
  Disabled analytics adds no first-report/desk pre-reads or application identity
  lookup.
- No outbox/drain, SQL, PostHog, Vercel, or other hosted changes belong to this
  branch. Local fake-provider gates do not prove production ingestion, replay
  joins, Vercel request lifetime, or database concurrency behavior.

## Outbox database layer (`feat/analytics-outbox-db`)

Additive migration `20261106110000_analytics_outbox.sql` installs the private
outbox, 14 guarded per-source trigger functions, six drain/maintenance RPCs and
shared safe projections. No existing migration or business RPC is changed.
Table/sequence access and callable helpers/RPCs are service-role-only; RLS has no
browser policy. Every function is SECURITY DEFINER with an empty search path.
Warnings contain only the source and SQLSTATE, never source rows or error text.
Delivery-time consent/identity is **not** implemented here: internal user IDs and
dedup keys must not be copied into provider properties.

| Source                      | AFTER timing    | Events and dedup keys                                                                                                                                                                         |
| --------------------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `checkout_intents`          | UPDATE          | `order_funded`: `funded:order`; `checkout_expired` / `checkout_failed_server`: `intent:status` (failed and conflict share the latter event)                                                   |
| `order_payments`            | INSERT / UPDATE | `payment_captured`: `captured:order`; `authorization_voided` / `order_refunded`: `state:order` (order is the payment PK)                                                                      |
| `orders`                    | UPDATE          | `order_matched`: `matched:order:assignment`; `order_expired`: `expired:order`; `order_cancelled`: `cancelled:order`; `order_rerolled`: `reroll:order:n`; `order_completed`: `completed:order` |
| `order_handovers`           | UPDATE          | `handover_accepted`: `handover:id` on null revoked_at to accepted revocation                                                                                                                  |
| `order_match_reports`       | UPDATE          | `order_results_corrected`: `corrected:assignment:edited_at`                                                                                                                                   |
| `order_tips`                | UPDATE          | `tip_paid`: `tip:id` on first paid_at, not dispute recovery                                                                                                                                   |
| `pro_subscriptions`         | INSERT / UPDATE | `pro_trial_started`, `pro_activated`, `pro_paused`, `pro_resumed`, `pro_ended`: `sub:status:last_event_at`; `pro_cancel_scheduled` / `pro_cancel_undone`: `sub:cape:boolean:last_event_at`    |
| `pro_invoices`              | INSERT / UPDATE | `pro_invoice_paid` / `pro_invoice_failed`: `invoice:state`; zero paid amounts excluded                                                                                                        |
| `teammate_applications`     | UPDATE          | `teammate_approved`: `app:approved`                                                                                                                                                           |
| `payout_transfers`          | UPDATE          | `payout_sent`: `stripe:id`                                                                                                                                                                    |
| `payout_lines`              | UPDATE          | `payout_sent`: `manual:id`, only bank/wise/paypal/other, never Stripe                                                                                                                         |
| `creator_payouts`           | INSERT          | `payout_sent`: `creator:id`                                                                                                                                                                   |
| `payout_transfer_reversals` | INSERT          | `payout_reversed`: `reversal:id`, including partial reversal while transfer state remains paid                                                                                                |
| `auth.users`                | INSERT          | `user_signed_up`: `signup:user`; provider allowlist, otherwise `other`                                                                                                                        |

Schema verification and deliberate semantics:

- Payments/invoices/transfers/tips use `state`, not `status`; order expiry is
  `cancelled` + `queue_expired`, never an expired order status.
- Funding is observed only at the checkout paid/order binding, after the payment
  insert. Free coaching retains positive list value but all three funded/card/
  wallet cents are zero; wallet/free use `payment_state: n_a`. Stream is a
  boolean from the intent, not a booking join that races another trigger.
- `order_payments` has no separate payment ID: use its `order_id` primary key for
  the spec's `state:payment`. No exact partial order-refund amount exists: the
  event labels the full **card portion**, not a refund delta. PRO invoice amounts
  retain actual minor units/currency, without invented EUR conversion.
- `creators` has no auth account mapping; creator payout user_id stays null.
  Approval account_id may also be null. Never substitute an entity ID as a user.
- Service is only length-constrained in SQL, not an enum: project the checked-in
  catalogue allowlist plus stream and map everything else to `unknown`.
- PRO active from paused is resumed; initial/incomplete/trialing to active is
  activated; past_due recovery is not a fresh activation. Ended means canceled,
  incomplete_expired or unpaid. Initial cancel=true schedules cancellation.
  The cancel key includes its boolean to distinguish opposite changes at equal
  provider timestamps. Repeated same-state transitions at the exact same
  last_event_at, or corrections with the same edited_at, can still collide;
  neither source has an immutable occurrence revision.
- Match report JSON is never serialized: only its array length and integer
  wins/losses. Timing is order acceptance-to-completion, not summed active play.

Claim uses SKIP LOCKED, oldest-first ordering, a two-minute lease, bounded batch
size (0–1000, null defaults to 200), and increments attempts. Failure releases the
lease, truncates last_error to 1000 characters and parks at ten attempts. A later
claim also parks expired tenth leases left by crashed workers. Stats excludes
sent/parked rows and includes in-flight leases. Acknowledgements do not mutate
already-sent or parked rows. The RPC interface has no lease-token fencing;
workers must finish within the lease and treat ambiguous acknowledgements as
at-least-once delivery, not exactly-once remote processing.

Reconcile idempotently covers funded, completed, expired, tip paid, signup and all
three payout-sent rails. It uses source terminal/updated timestamps, not a global
scan of business transitions. It cannot reconstruct arbitrary overwritten
history (e.g. a transfer already reversed), original funding payment state after
settlement/refund, or pre-correction completion counters. Unavailable historic
payment state is omitted rather than invented. Use a rolling overlap (example:
two days); replaying all history after sent-row retention can re-enqueue old
facts because the dedup key was deleted. Cleanup deletes only sent rows after 30
days; unsent and parked rows remain for operations. This is not an unconditional
completeness guarantee for every transition.

The migration ends with **commented owner-applied examples only**: minute
pg_cron + pg_net drain using a dedicated analytics Bearer secret, and nightly
reconcile/cleanup. It neither schedules jobs nor reads/writes Vault at install.
No HTTP drain endpoint, hosted migration, secret, cron job or provider ingestion
is enabled by this branch. `checkout_abandon_detected` remains deliberately absent.

Verification (Node 24.21.0): check, lint, format:check, test:unit and build pass;
125 unit files / 1839 tests, including seven outbox source-contract tests.
The only existing-test edit is the explicitly approved consent migration guard
fix: test file existence rather than requiring an already-merged migration in
the added diff. No source TS/JSX changed, so browser E2E was not run.

No native PostgreSQL, Docker or running Supabase CLI stack was available. An
isolated PGlite PostgreSQL smoke test installed the new migration over 51 actual
source-table CREATE/ALTER statements extracted in migration order (foreign keys
omitted; managed auth.users represented by its consumed columns). It observed
all 27 events across 14 triggers and exercised card/wallet/mixed/free, capture
dedup, expiry/cancel/reroll/handover, correction counters, tip dispute recovery,
PRO cancellation/resume and zero/failed-to-paid invoices, all payout rails,
partial reversal, leases/parking, reconcile idempotence, retention, privileges,
rollback and a deliberately rejected analytics insert without aborting signup.
A canary in names/notes/IGN/report data did not reach properties. This is an
isolated smoke check, **not** the full Supabase chain or a multi-session lock test.
Hosted auth privileges, full composed triggers/FKs, concurrent SKIP LOCKED and
provider delivery remain unverified; no hosted database was contacted.

## Known follow-ups

- Bundle: the default `posthog-js` build adds about 120 KB gzipped to every page (module script, does not block first paint). The slim build was measured and is not smaller once web vitals are registered (128 KB gzip; extension bundles do not tree-shake), so A1 keeps the default import. Revisit only if PostHog ships tree-shakeable extensions. Evidence: `posthog-research/08-slim-bundle.md` in the project folder.
- A pageview that follows a fetch-based logout without navigation is reset only on the next document.

## PR B fixes (2026-11-05)

1. **Server events join replays.** With Analytics consent the SDK's `tracing_headers` (first-party `ANALYTICS_HOSTS` only) adds `X-POSTHOG-SESSION-ID` to our own requests; server events read it. Refusers and withdrawn users send no header. Browser test: `transport.spec.ts` "server events join the replay only with Analytics consent".
2. **No duplicates for `match_report_saved` and `desk_online_changed`.** Moved from best-effort handler pre-reads to outbox triggers: `order_match_reports` INSERT (dedup `report:<assignment>`, teammate, `games`) and `teammate_presence` online transitions (dedup per desk session `desk:<user>:on|off:<online_since>`, `by` self or admin). Heartbeats never fire. Verified on PGlite with real DDL.

## PR B drain and schedule

- `POST /api/internal/analytics/drain` (Bearer `ANALYTICS_DRAIN_SECRET`, 32+ chars, constant-time compare). Claims up to 5 batches of 200, reads `analytics_consent` once per batch (lookup failure means personless for everyone), validates every row against `OUTBOX_EVENT_CATALOGUE`, posts PostHog `/batch/` with the row `uuid` and `occurred_at`.
- Only HTTP 2xx marks rows sent. 429, 5xx and network errors call `analytics_outbox_mark_failed` (lease cleared, retried next minute, parked after 10 attempts); a 429 stops the run. Uncatalogued rows are retired without sending.
- Identity: Analytics consent means distinct id = account id; otherwise `uuidv5('outbox:' + uuid)` with `$process_person_profile: false`. Owner accounts (`ANALYTICS_INTERNAL_USER_IDS`) get `internal: true`.
- Schedule: `20261106120000_analytics_outbox_schedule.sql` (drain every minute, reconcile 03:10, cleanup 03:20, log prune 03:40). Inert until Vault `analytics_drain_secret` exists.

### Ship order

1. Vercel production env `ANALYTICS_DRAIN_SECRET` (new random secret).
2. Vault secret `analytics_drain_secret` with the same value.
3. Apply `20261106110000_analytics_outbox.sql`, then merge (deploy), then apply `20261106120000_analytics_outbox_schedule.sql`.
4. Check: `select * from public.analytics_outbox_stats()` and the PostHog events table.

## Error Tracking source maps (`feat/analytics-sourcemaps`)

- `pnpm build` keeps `astro build` first, then runs
  `scripts/posthog-sourcemaps.mjs`. Vite emits hidden client and server maps.
  The script uses the exact devDependency `@posthog/cli` 0.19.0; its binary
  download requires the explicit `allowBuilds` entry in `pnpm-workspace.yaml`.
- Owner activation, **production build environment only**:
  `POSTHOG_CLI_API_KEY` (personal API key scoped to this project, with
  **error tracking write** and **organization read**) and
  `POSTHOG_CLI_PROJECT_ID`. These are the current CLI names, not
  `POSTHOG_CLI_TOKEN` / `POSTHOG_CLI_ENV_ID`. The script pins the EU app host
  `https://eu.posthog.com`; no host env var is needed. Vercel must expose its
  built-in `VERCEL_ENV` and `VERCEL_GIT_COMMIT_SHA` to the build.
  No Vercel or PostHog settings were changed by this branch.
- Only production with both credentials and a valid commit SHA injects/uploads.
  Both CLI commands receive release name `duoly`, version = the first 12 SHA
  characters (the existing boot data convention), and `--release-mode event`.
  Upload uses `--delete-after`. Preview, missing configuration and CLI failures
  continue without an upload; CLI failures produce only a fixed warning, never
  raw command output or credentials. Commands have a two-minute timeout each.
- Public assets are `.vercel/output/static/_astro`. The final SSR function is
  `.vercel/output/functions/_render.func/dist/server` (entry plus `chunks/`).
  The adapter stages server maps in `.vercel/output/_functions` but omits them
  from its traced function. Before injection, the script restores each map
  beside final JS only when staging and served JS are byte-identical. The CLI
  excludes staging `_functions`, so it rewrites the actual served function.
  A `finally` cleanup deletes **all** maps under `.vercel/output`, including
  skipped/failed uploads. Cleanup filesystem failures remain fatal rather than
  deploy public maps; telemetry/CLI failures themselves never fail the build.
- `app_release` is a custom display/filter property, **not** PostHog's release
  linkage. No browser change is needed: CLI event-mode injection supplies
  `_posthogReleaseId`, which installed posthog-js 1.445.1 reads and emits as
  `$release_id` on exceptions; the sanitizer preserves it. Injected chunk IDs
  select source maps independently of that display property. Successful real
  release creation, upload and production symbolication still need verification
  after owner activation.
- Local verification: unit tests cover production/preview/missing config,
  failures with secret-bearing errors, cleanup and byte-matched server maps.
  A no-key `pnpm build` left zero maps under both static and the entire output.
  Hidden-map generation changed no JS bytes: 1,874,384 bytes before and after.
  Offline CLI injection rewrote 60 client chunks and 219 final server chunks;
  client JS increased by 21,480 raw bytes (1.15%), excluding real release-ID
  injection overhead. All eight analytics Playwright tests passed against these
  injected production-build assets and the emitted SSR function using a local
  HTTP fixture, not Astro dev. For that offline probe only, the CLI ran from a
  non-Git scratch directory with placeholder credentials, no release arguments
  and an unreachable localhost host; it injected chunk IDs without resolving a
  release. Upload was intentionally rejected by the injected runner, exercising
  warning plus cleanup. This is **not** evidence of real PostHog ingestion.
- Gates on Node 24.21.0: `check` (0 errors/warnings; 46 existing hints),
  `lint`, `format:check`, `test:unit` (131 files / 1,899 tests), `build`, and
  `test:e2e` (296 tests across all five suites) passed. The first full browser
  run hit the existing mobile chat resize anchoring test (509px from bottom);
  it passed ten isolated repetitions and the complete unchanged suite rerun.
  No chat implementation or chat test changes were made here.
- Baseline gate fix: removed a duplicate `existsSync` import already present on
  main in `analytics-consent-sync.test.ts`; otherwise `pnpm check` could not run.
