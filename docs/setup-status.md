# Setup checkpoints

## Domain cutover completed

**https://duoly.gg** now serves the public Astro design demo. `www.duoly.gg` redirects to the apex, with valid HTTPS and preserved paths/query strings. Owner-saved DNS records were verified against Vercel, aliases were activated on the accepted production deployment, and 19 HTTP checks plus 26 desktop/mobile browser views passed without authentication. MX, TXT and nameservers are unchanged. See [verified cutover and rollback](runbooks/domain-migration.md). Earlier no-cutover statements below are historical checkpoints. Real marketplace operations remain disconnected.

## Public release checkpoint

Owner-approved public demo: **https://duoly-pi.vercel.app**, with no Vercel login required. PRs #7 and #8 are merged into `main`. Released code commit: `9370d9c6fa8cdaebf48ab3ef248e9b17a180acae`; production deployment: `dpl_EhBubZytDjfgPkuyLvPGjKod8J7c`. It has the same source tree as the reviewed design preview. The squash-merge ancestry was reconciled without changing source files or rewriting published history.

Vercel authentication now applies to previews only. Custom-domain auto-assignment remains disabled. Only `duoly-pi.vercel.app` was explicitly assigned; no `duoly.gg` DNS or existing-site cutover was performed. Sample-data warnings, noindex HTML metadata and disallow-all robots remain. Real marketplace services remain disconnected. Production deployment remains manual.

The protected-preview checks below are historical checkpoints. Public acceptance and final CI evidence are recorded in the release handover on [PR #8](https://github.com/Duolygg/duoly/pull/8).

Updated 21 October 2026. Verified results and remaining gates are recorded separately.

## Repository and collaboration

Private production repository: https://github.com/Duolygg/duoly.
Foundation PR: https://github.com/Duolygg/duoly/pull/7, open for human review and not merged. main contains the documented README bootstrap; application work remains in the PR. The design sandbox is unchanged.

Organization base permission corrected from admin to none; non-owner repository creation disabled. Developers team has Write, maintainers team has Maintain. Sebastian is the verified active owner. duoly-admin organization/repository invitations remain pending.

Squash merge only, merged branch deletion on, auto-merge off, issues on, wiki/discussions off. Actions has read-only tokens, no PR self-approval, full commit-SHA pinning and an action allowlist. Dependabot alerts and automated security fixes enabled and read back.

## Protection gate

GitHub Free returned HTTP 403 for private branch protection. Required reviews/status checks are NOT enforced. No paid upgrade performed. Before relying on enforcement, approve/perform a qualifying upgrade, confirm another active reviewer, update CODEOWNERS, apply .github/settings/main-ruleset.json and test failing/unreviewed PRs and direct pushes are blocked.

## Local foundation and CI

Astro 7.4.2, Vercel adapter 11.0.16, React integration 7.1.1. Node 24.21.0 development/CI pin, Vercel 24.x, pnpm 12.6.0. Narrow security/compatibility overrides are explained in docs/dependencies.md.

Executed successfully: frozen install, types (zero errors/warnings/hints), lint, formatting, adapter build, 15 unit tests, 6 desktop/mobile browser tests. Full dependency audit reports no known vulnerabilities; peer check reports no issues. Secret-pattern and staged-path checks passed. .env.example is tracked; real env files, tokens and generated artifacts are ignored.

Independent review passed after the pnpm action annotated tag was resolved to a verified commit. Follow-up review found no blocking issues.

Remote CI Quality and Browser smoke passed for foundation commit 95fd3207cc991a1755198adcfb509dbaae0736cb. Later documentation/trigger refinements require current-head checks. CI now runs on PRs and main pushes to avoid duplicate feature-push/PR jobs.

This is a technical foundation, not accounts, bookings, payments, chat or live tracking. Browser smoke uses the Astro dev server; deployed acceptance below is separate.

## Verified protected Vercel preview

Account: sebastian.schrottenbach@gmail.com. Existing team: sebastianschrottenbach-gmailcoms-projects. No paid team/seat/plan changes.
Project: prj_jxy8Z8IWlcQdMcYp4AYGznrddL5A.

READY preview:
https://duoly-h80l1agcc-sebastianschrottenbach-gmailcoms-projects.vercel.app

Deployment: dpl_92SkQNFhfTyTQ2B2MB1JFpdYX5wN.
Source: 95fd3207cc991a1755198adcfb509dbaae0736cb. Preview target, Node 24.x, verified GitHub noreply author. No customer domain or production activation.

Actual authorized HTTP checks: homepage 200 with foundation/noindex markup; /api/health 200 with exact status ok JSON and no-store; robots 200 with Disallow:/; missing route 404. All returned baseline security headers and X-Robots-Tag:noindex. Unauthenticated access redirects to authentication (302). CLI curl used an authorized protection bypass without exposing it in Git/logs.

Historical failures: first deployment failed on the platform's Node 22.23.3; second was BLOCKED because the bootstrap commit used an unlinked Proton author address. Node 24.x and repository-local verified GitHub noreply identity fixed both. Global Git identity unchanged.

A deploymentSources policy is saved, but enforcement is not established: the first explicit preview was reclassified production and attempted despite it. Keep all-deployment authentication, no customer domain and no live service credentials as the prelaunch boundary. Custom-domain auto-assignment is disabled.

Git integration is now connected and provider readback confirms GitHub Duolygg/duoly, production branch main. A docs-only push exercises the new automatic preview connection; current-head PR checks establish acceptance. duoly.gg and www.duoly.gg are prepared in Vercel, with www configured to redirect308 to the apex. Authoritative DNS remains on the current registrar and the Replit site is unchanged. Owner explicitly chose to defer cutover until the new site is ready. See docs/runbooks/domain-migration.md.

## Provider reuse and remaining acceptance

Existing provider configuration was recovered from other projects/Keychain without printing credentials or changing those projects.

- Resend account access verified. Separate duoly.gg domain created/read back: c6c7296d-0736-4ce8-9e9b-f2d7ff83691a, eu-west-1, sending/receiving enabled, open/click tracking off, enforced TLS. DNS unverified; exact public records in docs/runbooks/email-dns.json. Domain uses registrar-servers.com nameservers and is absent from the current Vercel account. No DNS changed, mail sent or webhook activated.
- PostHog EU reporting key reads Pet to Portrait project 233929 but cannot list/create projects (HTTP 403). A separate Duoly project needs owner-authorized access. Never mix Duoly events into Pet to Portrait.
- Supabase CLI 2.121.0 pinned/installed and fresh login verified. Created a separate Duoly organization (`vbrxnajhjbbkclijigxi`) and `duoly-dev` project (`omnejesspybaxuacjlah`) in Frankfurt (`eu-central-1`). Exact organization readback confirmed **Free before and after provisioning**; paid upgrades/add-ons are prohibited by owner decision. Project readback is `ACTIVE_HEALTHY`. Real read-only SQL returned PostgreSQL 17.11 and zero public base tables. SSL enforcement enabled/applied; signup and all external auth providers disabled, confirmed through public auth settings. No SMTP, product schema, production database or application cloud credentials activated. Administrator password stored/read back in macOS Keychain without disclosure. CLI link and remote TypeScript generation succeeded; linked status read back. Existing paused projects untouched. Docker-compatible runtime absent, so local startup/migration replay, RLS tests, collaborator membership, backups and restore remain unverified. See docs/runbooks/database.md.

## Other gates

- AGENTS.md creation approval timed out. It was not written or retried; explicit approval is required.
- GitHub Projects board requires additional project scope. No credential scope expansion made. Issues 1 through 6 form the verified chunked backlog.
- Browser account inspection is blocked by unsupported default-browser integration; no browser preferences changed.
- MFA/recovery, a second active owner, provider ownership, domain access, MVP rules and production release require owner confirmation.

## Resume

Read this file and the PR, inspect live state, then resume the next incomplete issue. Checkpoint each chunk with actual commands/results. No blind recreation, unapproved upgrades, live email, DNS changes or production activation.

## Astro design preview verification

Local acceptance on 2026-10-21 is complete on `feat/astro-design-preview`:

- All 13 original UI page families and all 12 admin sections are ported with explicitly synthetic data.
- `pnpm verify`: passed check, lint, formatting, 29 unit tests, production build and 92 desktop/mobile browser tests. Astro reports zero errors, zero warnings and 15 unused-declaration hints in quarantined source.
- A separate screenshot and browser-console pass verified all 13 pages at desktop and mobile widths: 26 views, no errors, broken loaded images or horizontal overflow. It caught two mobile sizing defects that were fixed and reverified.
- Original asset inventory: 302 files, zero missing files and zero byte mismatches against the pinned source.
- Production accounts, payments, submissions and persistence are not connected. No provider SDKs or credentials are introduced by this port.
- Independent safety review passed after an API-anchor regression was reproduced and fixed. The [protected Astro preview](https://duoly-9v75q33kl-sebastianschrottenbach-gmailcoms-projects.vercel.app) at code commit `d3b92ee92943ed208490669423237480d882dcdc` passed 19 deployed HTTP checks and 26 deployed desktop/mobile browser views. Unauthenticated access returns HTTP 302. See [deployment handover](deployments/2026-10-21-design-preview.md) and [PR #8](https://github.com/Duolygg/duoly/pull/8). No customer-domain cutover is authorized by this checkpoint.

See [design port](design-port.md) for route mapping, compatibility boundaries and remaining production implementation.
