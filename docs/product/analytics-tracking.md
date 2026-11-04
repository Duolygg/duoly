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

## Known follow-ups

- Bundle: the default `posthog-js` build adds about 117 KB gzipped to every page; slim build evaluated in `posthog-research/08-slim-bundle.md`.
- A pageview that follows a fetch-based logout without navigation is reset only on the next document.
