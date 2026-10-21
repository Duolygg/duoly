# Setup checkpoints

Updated 21 October 2026. Implemented configuration is distinct from external acceptance.

## Repository

Private https://github.com/Duolygg/duoly created. Design repo untouched. Organization default permission corrected from admin to none; non-owner repository creation disabled. Squash merge only, merged branch deletion on, auto-merge off, issues on, wiki/discussions off.

Actions read-only token, no PR self-approval, SHA pinning required; GitHub-owned actions and pnpm/action-setup allowlisted. duoly-admin has a pending write invitation; organization invitation also pending at inspection. Only Sebastian is a verified active organization owner.

main contains bootstrap README only. Application work belongs in the foundation PR.

## Protection blocker

GitHub Free on this private org repo returned HTTP403 for branch protection, requesting upgrade. Required reviews and status checks are NOT enforced. Desired ruleset is versioned at .github/settings/main-ruleset.json. Owner must approve/perform qualifying upgrade, apply rules and test a failing/unreviewed PR is blocked. No paid upgrade performed.

## Application and CI

Local quality verified on the updated Astro7.4.2 foundation:14 unit tests and6 desktop/mobile browser tests pass; lint/format/types/build pass. Full dependency audit reports zero known vulnerabilities and peer check reports no issues. CI action annotation SHA was corrected to its verified underlying commit after independent review. Follow-up review and remote CI pending. Product functionality remains unimplemented.

## Supabase

Pinned CLI/local configuration being prepared. No Docker-compatible runtime installed locally. No Supabase access token available in process environment. No hosted project, migration replay or restore verified. No invented product schema.

## External services

Vercel project exists with authentication and custom-domain auto-assignment disabled. A deployment policy is saved to block production sources, but enforcement is unverified: the first explicit preview request was reclassified production and attempted a build. It failed because platform Node22.23.3 was below Astro7 requirements, with no alias assigned. Runtime is now Node24.x with local/CI pin24.21.0. The second preview deployment dpl_7AMxsnZ9mgLWfjLRoP2AVYXipwDC is BLOCKED (TEAM_ACCESS_REQUIRED) because the old HEAD commit author used an unlinked Proton address. Repository-local Git identity has been corrected to the verified GitHub noreply address; global identity unchanged. A fresh authored commit/deploy is still required. Local CLI link succeeded; generated .env.local contains a short-lived Vercel token and is ignored, not committed. No customer domain or live service credentials. Git connection failed because Vercel cannot access this private organization repo; authorize the Vercel GitHub app for Duolygg/duoly before retrying. No deployment verified.

Existing provider configuration was recovered through the other projects and Keychain without printing secrets. Resend account access is verified (HTTP200); Pet to Portrait is left unchanged. A separate duoly.gg sending/receiving domain was created and read back, IDc6c7296d-0736-4ce8-9e9b-f2d7ff83691a, eu-west-1, click/open tracking off, enforced TLS. DNS records are pending in docs/runbooks/email-dns.json; authoritative DNS is at registrar-servers.com, outside this Vercel account. No DNS changed or mail sent. PostHog EU project233929 Pet to Portrait is accessible with the existing reporting key, but that key is restricted to that project and cannot list/create Duoly projects (HTTP403). Existing Supabase CLI credential returned HTTP401. Browser session inspection remains unavailable because the current default browser is unsupported; no preference changes made. Existing account access is distinct from permission to create a Duoly-specific project.

## Project board

GitHub Projects access is blocked because the current CLI token lacks read:project/project scopes. Issues 1 through 6 are created and verified as the chunked backlog. No token permission expansion performed.

## Protected instruction file

AGENTS.md creation was blocked by an approval prompt that timed out. It was not written or retried. Agent-instruction setup remains pending explicit approval.

## Resume

Read this file, inspect current repo/PR/provider state and resume the next incomplete chunk. Do not recreate resources blindly. Keep each chunk checkpointed with exact commands/results. No paid upgrades, production activation or live email without approval.
