# Analytics tracking (PostHog): build ledger

Spec: `POSTHOG-SPEC.md` (owner approved 2026-11-04) in the project folder outside this repo; research in `posthog-research/`. This ledger is the resume point after any interruption: read it, then `git log` on the branch named in the current row.

Owner decisions: four PRs; personless business totals without Analytics consent; managed proxy later (direct `https://eu.i.posthog.com` until then, env change only); no replay on `/teammate`; owner and coworker accounts internal via `ANALYTICS_INTERNAL_USER_IDS`.

| PR         | Branch                    | Status                         | Next action                                                                                                                                                                                                                           |
| ---------- | ------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1 core    | `feat/analytics-core`     | merged (#130), live 2026-11-04 | Done. Env set in Vercel production, cookieless enabled in PostHog.                                                                                                                                                                    |
| A2 journey | `feat/analytics-journey`  | in progress                    | Core pushed. Merge in `feat/analytics-consent-sync`, `feat/analytics-privacy-markers`, `feat/analytics-events` when each is green, then apply migration `20261106100000_analytics_consent.sql`, set replay project settings, open PR. |
| B outbox   | `feat/analytics-outbox`   | not started                    | Outbox migration, triggers, drain, server events, Sparky AI events, source maps.                                                                                                                                                      |
| C insights | `feat/analytics-insights` | not started                    | Dashboards, alerts, surveys, scanner, scripted in `scripts/posthog/`.                                                                                                                                                                 |

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

## Known follow-ups

- Bundle: the default `posthog-js` build adds about 120 KB gzipped to every page (module script, does not block first paint). The slim build was measured and is not smaller once web vitals are registered (128 KB gzip; extension bundles do not tree-shake), so A1 keeps the default import. Revisit only if PostHog ships tree-shakeable extensions. Evidence: `posthog-research/08-slim-bundle.md` in the project folder.
- A pageview that follows a fetch-based logout without navigation is reset only on the next document.
