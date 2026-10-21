# Duoly

Private production application owned by the Duolygg GitHub organization.

**Stack:** Astro, strict TypeScript, selected React islands, Supabase PostgreSQL, Vercel hosting, PostHog analytics and Resend email.

This repository establishes the production foundation. It does not yet implement customer accounts, bookings, payments, chat or a live product. External services remain disabled until configured and verified.

## Start locally

Prerequisites: Node **24.21.0**, pnpm **12.6.0**, Git and individual GitHub repository access. Use your preferred Node version manager with `.node-version`. Install/activate the exact pnpm version listed in `package.json` through your package manager or Corepack.

```sh
git clone https://github.com/Duolygg/duoly.git
cd duoly
pnpm install --frozen-lockfile
pnpm dev
```

No cloud credentials are required to build and test the scaffold. `.env.example` documents optional settings and safe disabled defaults. If needed, copy it to an ignored local environment file. Never commit real credentials or paste them into issues/chat.

```sh
pnpm format:check
pnpm lint
pnpm check
pnpm test:unit
pnpm build
pnpm exec playwright install chromium
pnpm verify
pnpm test:e2e
```

`verify` runs types, lint, formatting, unit tests, build and browser smoke. The standalone `test:e2e` command is useful for focused reruns. CI runs the quality and browser jobs separately. The homepage and original screen families are now a visibly labeled, offline design preview. `/api/health` tests server routing, not database/provider readiness. Pre-launch indexing is blocked. See [design port and boundaries](docs/design-port.md) and [screen-to-backend integration map](docs/product/integration-map.md).

## Database

Use `pnpm exec supabase --version` for the pinned CLI. Shared hosted development is provisioned as `duoly-dev` in the separate Duoly organization, on the verified **Free plan** in Frankfurt. Paid Supabase resources are prohibited. The cloud connection is verified, but there is no product schema or application database integration yet. A Docker-compatible runtime is required for `pnpm exec supabase start`; local configuration is in `supabase/`. See [database workflow and access](docs/runbooks/database.md). Do not put product migrations in a second migrations directory.

## Collaboration

1. Read [CONTRIBUTING.md](CONTRIBUTING.md) and [setup status](docs/setup-status.md).
2. Claim one issue with scope, owner, dependencies, acceptance criteria and tests.
3. Work on a dedicated short-lived branch and separate checkout/worktree.
4. Agree shared contracts before parallel UI/server work. Coordinate shared config, lockfile and migration edits with an integrator.
5. Open a PR, pass checks, obtain independent review and squash merge. No self-approval or autonomous agent merge.

**Important:** GitHub Free currently cannot enforce review/status protections for this private organization repository. This is a documented blocker, not an active protection. A qualifying upgrade and verified ruleset are required before relying on enforcement. No paid upgrade has been made.

## Design reference

The separate [design sandbox](https://github.com/duoly-admin/duoly) is preserved at `7f0299fe35d4ebbba1ebea36f1ecd46bab5f0280`. Its screens are visual references. Next.js code, sample data and backend assumptions are not production specifications. No automatic synchronization. See [reference policy](docs/design-reference.md).

## Documentation

- [Architecture decision](docs/adr/0001-foundation.md)
- [MVP decisions still needed](docs/product/mvp.md)
- [Analytics](docs/analytics.md)
- [Deployment and recovery](docs/runbooks/deployment.md)
- [Database](docs/runbooks/database.md)
- [Email](docs/runbooks/email.md)
- [Security](SECURITY.md)
- [Current setup checkpoints and blockers](docs/setup-status.md)

Production domains, live sending, payment operations and paid service changes require owner approval. Source is private/proprietary unless owners explicitly approve a license; third-party assets retain their own licenses.
