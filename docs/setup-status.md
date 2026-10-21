# Setup checkpoints

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

Executed successfully: frozen install, types (zero errors/warnings/hints), lint, formatting, adapter build, 14 unit tests, 6 desktop/mobile browser tests. Full dependency audit reports no known vulnerabilities; peer check reports no issues. Secret-pattern and staged-path checks passed. .env.example is tracked; real env files, tokens and generated artifacts are ignored.

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
- Supabase CLI 2.121.0 pinned/installed; local config initialized with signup/OAuth disabled. Stored CLI credential returned HTTP 401. Fresh authentication needed. Docker-compatible runtime absent, so DB startup, migration replay, hosted project and restore remain unverified. No invented product schema.

## Other gates

- AGENTS.md creation approval timed out. It was not written or retried; explicit approval is required.
- GitHub Projects board requires additional project scope. No credential scope expansion made. Issues 1 through 6 form the verified chunked backlog.
- Browser account inspection is blocked by unsupported default-browser integration; no browser preferences changed.
- MFA/recovery, a second active owner, provider ownership, domain access, MVP rules and production release require owner confirmation.

## Resume

Read this file and the PR, inspect live state, then resume the next incomplete issue. Checkpoint each chunk with actual commands/results. No blind recreation, unapproved upgrades, live email, DNS changes or production activation.
