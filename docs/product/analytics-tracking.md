# Analytics tracking (PostHog): build ledger

Spec: `POSTHOG-SPEC.md` (owner approved 2026-11-04) in the project folder outside this repo; research in `posthog-research/`. This ledger is the resume point after any interruption: read it, then `git log` on the branch named in the current row.

Owner decisions: four PRs; personless business totals without Analytics consent; managed proxy later (direct `https://eu.i.posthog.com` until then, env change only); no replay on `/teammate`; owner and coworker accounts internal via `ANALYTICS_INTERNAL_USER_IDS`.

| PR         | Branch                    | Status      | Next action                                                                         |
| ---------- | ------------------------- | ----------- | ----------------------------------------------------------------------------------- |
| A1 core    | `feat/analytics-core`     | in review   | Owner OK to merge. Inert until the env vars below exist.                            |
| A2 journey | `feat/analytics-journey`  | not started | Browser events, privacy markers, replay, error capture, consent sync, privacy copy. |
| B outbox   | `feat/analytics-outbox`   | not started | Outbox migration, triggers, drain, server events, Sparky AI events, source maps.    |
| C insights | `feat/analytics-insights` | not started | Dashboards, alerts, surveys, scanner, scripted in `scripts/posthog/`.               |

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

## Known follow-ups

- Bundle: the default `posthog-js` build adds about 120 KB gzipped to every page (module script, does not block first paint). The slim build was measured and is not smaller once web vitals are registered (128 KB gzip; extension bundles do not tree-shake), so A1 keeps the default import. Revisit only if PostHog ships tree-shakeable extensions. Evidence: `posthog-research/08-slim-bundle.md` in the project folder.
- A pageview that follows a fetch-based logout without navigation is reset only on the next document.
