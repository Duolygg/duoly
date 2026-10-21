# Protected Astro design-preview handover

Date: 2026-10-21.

## Exact accepted artifact

- Code commit: `d3b92ee92943ed208490669423237480d882dcdc`.
- Deployment ID: `dpl_6ndXFfCbNzr65DPAjpf9aLD8WNxC`.
- [Immutable preview URL](https://duoly-9v75q33kl-sebastianschrottenbach-gmailcoms-projects.vercel.app).
- [Design-port PR #8](https://github.com/Duolygg/duoly/pull/8), stacked on foundation PR #7.
- Branch: `feat/astro-design-preview`. Neither PR was merged during acceptance.

The authenticated Vercel deployment API returned `readyState: READY` and a `gitSource.sha` matching the exact code commit. Its raw `target` field was null; the official CLI explicitly classified the deployment as `preview`. No production alias or customer domain was assigned.

## Actual verification

Local `pnpm verify` passed type checking, lint, formatting, 29 unit tests, adapter build and 92 desktop/mobile browser tests. Astro reported zero errors, zero warnings and 15 unused-declaration hints in the quarantined original source. An independent read-only review found an API-anchor activation gap; source anchors were made inert, early click/auxclick guards were added, red regressions were verified green, and focused re-review passed.

Provider acceptance against the exact URL above passed:

- All 13 UI routes returned HTTP 200, server-rendered preview disclosure, noindex and the required security headers.
- `/api/health` returned exactly `{"status":"ok"}` with `Cache-Control: no-store`.
- `/robots.txt` returned exactly `User-agent: *\nDisallow: /\n`.
- Invalid queue, handover, missing-page and unavailable-order API targets were rejected.
- Unauthenticated access returned HTTP 302, confirming that protection was retained.
- An authorized headless browser checked all 13 pages at desktop and mobile widths: 26 views, no browser/console errors, broken loaded images or horizontal overflow.

The Vercel connector lacked access to this team; the already authenticated official Vercel CLI was used. Authorization was not weakened. Protection cookies were held only in memory and were not included in logs, screenshots or repository files.

[GitHub CI for the accepted code commit](https://github.com/Duolygg/duoly/actions/runs/39665848291) was explicitly dispatched because the current foundation workflow automatically targets PRs into `main`, while this review is stacked on the unmerged foundation branch. The latest CI outcome and any documentation-only follow-up artifact are recorded in PR #8; do not infer CI success from a successful Vercel build.

## Scope and remaining work

This is the original connected UI running in Astro with explicit sample data. No live marketplace accounts, payments, orders, chat, uploads, finance, email or analytics transport are enabled. Legal text and financial rules remain prototype material. Refer to [design-port boundaries](../design-port.md) and the [screen-to-backend integration map](../product/integration-map.md) before implementing those services.

The customer domain and existing Replit site were not changed. Supabase remains Free-only. Rollback means returning to a prior protected preview; there is no production cutover to reverse.
