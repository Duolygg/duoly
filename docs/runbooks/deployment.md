# Deployment and recovery

## Current public demo

Owner-approved primary public URL: **https://duoly.gg**; `www.duoly.gg` redirects to it. https://duoly-pi.vercel.app remains a secondary URL. Production deployment `dpl_EhBubZytDjfgPkuyLvPGjKod8J7c` serves code commit `9370d9c6fa8cdaebf48ab3ef248e9b17a180acae`. Source is on `main`; GitHub remains private. This is a sample-data design demo, with no live marketplace backend.

Authentication applies to previews only (`ssoProtection.deploymentType: preview`). Public production was deployed with `--prod --skip-domain`, then only the existing `duoly-pi.vercel.app` alias was explicitly assigned. Keep automatic custom-domain assignment disabled and automatic Git production deployment disabled. The owner subsequently approved and completed the `duoly.gg` cutover; see [verified domain migration](domain-migration.md). This does not enable real account/payment operations.

For the next approved release, require passing current-commit checks and review, deploy production without automatic domain promotion, verify anonymous HTTP and browser behavior, then assign only the explicitly approved Vercel alias. Check actual alias readback. Public indexing remains blocked by the application robots meta and robots.txt; production does not inherit Vercel’s preview-only X-Robots-Tag header.

## Project setup and historical checkpoints

Vercel project duoly: prj_jxy8Z8IWlcQdMcYp4AYGznrddL5A.

Owner scope: sebastianschrottenbach-gmailcoms-projects, the account's existing Pro team. No paid team/seat/plan changes made. Confirm shared operational ownership before adding potentially billable collaborators.

Configured: Astro, Node24.x, frozen pnpm install, pnpm build, fra1 functions, basic fixed build machine, elastic concurrency off, preview deployments behind Vercel Authentication, public production demo as documented above, fork protection on, protected source maps, directory listing off, automatic custom-domain assignment off. Customer domains are staged in Vercel; their web DNS has not been cut over. See setup-status.md for Git connection and deployment acceptance. The authenticated Node24 preview dpl_92SkQNFhfTyTQ2B2MB1JFpdYX5wN reached READY and its actual homepage, health, robots, 404 and security headers passed HTTP checks. That scaffold checkpoint did not authorize a customer-domain launch.

## Environments and releases

No production credentials exist in this new project. PostHog/email are disabled. Non-production must never use production DB/payment/email credentials. Do not pull production vars for local development.

A deploymentSources policy is saved to disable production creation from Git, CLI, REST API, deployment hooks, integrations and v0, but enforcement is not established: Vercel reclassified the first explicit preview request as production and attempted the build despite this configuration. The first build failed on the platform Node22 patch level and assigned no alias. The initial protected-scaffold phase relied on all-deployment authentication, absent customer-domain routing and absent service credentials for isolation, not this unverified policy. Owner approval is required before production activation. Local Vercel link and GitHub connection now succeed. Provider readback confirms Duolygg/duoly and main as production branch. The owner approved domain preparation only: duoly.gg/www are added in Vercel, while web DNS and the Replit site remain unchanged until the new site is ready. See domain-migration.md. Keep production deploy/domain promotion manual. Before connecting Git, verify the Vercel GitHub app can access Duolygg/duoly and automatic production deployment is disabled. Vercel may classify the first deployment as production even when requested as preview; verify protection and non-assignment first. A protected scaffold is not an approved product launch.

Release: approved commit, passing checks, independent review, compatible migration plan, isolated resources, protected candidate, exact HTTP/header/health and integration checks, owner approval, then domain promotion. Record deployment ID, commit, migration state and evidence.

Rollback to the last verified compatible deployment only with release approval. Application rollback does not undo migrations. Use additive expand/contract changes and a reviewed repair/restore plan. Verify DB and object restore independently.

Incident: stop risky side effects, preserve sanitized logs/request IDs, revoke compromised credentials, notify owners privately and verify recovery. No secrets/private messages/tokens in logs.
