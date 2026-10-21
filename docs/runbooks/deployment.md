# Deployment and recovery

Vercel project duoly: prj_jxy8Z8IWlcQdMcYp4AYGznrddL5A.

Owner scope: sebastianschrottenbach-gmailcoms-projects, the account's existing Pro team. No paid team/seat/plan changes made. Confirm shared operational ownership before adding potentially billable collaborators.

Configured: Astro, Node24.x, frozen pnpm install, pnpm build, fra1 functions, basic fixed build machine, elastic concurrency off, all deployments behind Vercel Authentication, fork protection on, protected source maps, directory listing off, automatic custom-domain assignment off. No customer domain attached. See setup-status.md for Git connection and deployment acceptance.

## Environments and releases

No production credentials exist in this new project. PostHog/email are disabled. Non-production must never use production DB/payment/email credentials. Do not pull production vars for local development.

A deploymentSources policy is saved to disable production creation from Git, CLI, REST API, deployment hooks, integrations and v0, but enforcement is not established: Vercel reclassified the first explicit preview request as production and attempted the build despite this configuration. The first build failed on the platform Node22 patch level and assigned no alias. Rely on all-deployment authentication, absent customer domains and absent service credentials for prelaunch isolation, not this unverified policy. Owner approval is required before production activation. Local Vercel link succeeded; Git connect failed because the private organization repo is not accessible to the Vercel integration. Authorize its GitHub app for this repo only, then retry and read back the link. Keep production deploy/domain promotion manual. Before connecting Git, verify the Vercel GitHub app can access Duolygg/duoly and automatic production deployment is disabled. Vercel may classify the first deployment as production even when requested as preview; verify protection and non-assignment first. A protected scaffold is not an approved product launch.

Release: approved commit, passing checks, independent review, compatible migration plan, isolated resources, protected candidate, exact HTTP/header/health and integration checks, owner approval, then domain promotion. Record deployment ID, commit, migration state and evidence.

Rollback to the last verified compatible deployment only with release approval. Application rollback does not undo migrations. Use additive expand/contract changes and a reviewed repair/restore plan. Verify DB and object restore independently.

Incident: stop risky side effects, preserve sanitized logs/request IDs, revoke compromised credentials, notify owners privately and verify recovery. No secrets/private messages/tokens in logs.
