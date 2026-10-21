# Contributing

## Start a task

Use an individual GitHub account with MFA. Read README.md and docs/setup-status.md. Claim a GitHub issue with approved scope, acceptance criteria, owner, dependencies, exclusions and test plan.

Create feat/<issue>-<topic>, fix/<issue>-<topic> or chore/<issue>-<topic>. Each concurrent developer or coding agent gets a separate worktree/checkout. Never share writable working directories.

## Coordinate parallel work

Agree shared runtime schemas and API contracts before UI/server work splits. A designated integrator coordinates package.json/lockfile, shared layouts/tokens, authentication, contracts and migrations. Announce overlaps in the issue and resolve them with affected owners. No automatic prototype sync or unrequested dependency changes.

## Pull requests

1. Implement approved scope with tests, including error and authorization cases where applicable.
2. Run pnpm verify and pnpm test:e2e plus relevant database checks.
3. Open a PR against main with issue, actual command results, current commit, screenshots for UI and provider evidence for integrations.
4. Obtain independent review, resolve threads and re-request approval after material changes. No self-approval or autonomous agent merge.
5. Squash merge only after acceptance. Delete the completed branch.

Required checks: Quality and Browser smoke. A passing local or CI test does not establish live provider behavior or authorize release.

## Current enforcement limitation

GitHub Free does not enforce protected branches for this private organization repository. Review is currently a team policy, not a technical barrier. An owner must approve/perform a qualifying upgrade, apply .github/settings/main-ruleset.json, and verify failing/unreviewed PRs are blocked before parallel production development. Keep the repository private.

## Data and releases

Migrations live in supabase/migrations/<timestamp>_<description>.sql. Coordinate identifiers, test replay from empty disposable DB, add RLS/security tests and regenerate types once schema exists. Never rewrite applied shared migrations or alter hosted schema manually.

Keep secrets, customer data, local service state and production credentials outside Git. No live email, payments, DNS changes, paid services or production activation without approval. Use additive expand/contract changes; application rollback does not revert database migrations.

Behavior changes require test-first evidence. Completion means acceptance criteria, current-commit checks, independent review, docs and a verified preview where available. Update docs/setup-status.md with exact blockers and checkpoint each chunk for safe resumption.
