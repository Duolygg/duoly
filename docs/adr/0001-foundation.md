# ADR 0001: Production foundation

Status: accepted for setup; product behavior pending.

Use a new private organization-owned repository, Duolygg/duoly. Preserve duoly-admin/duoly as separate design reference. One Astro app, strict TypeScript, selected React islands, Supabase PostgreSQL, Vercel, PostHog and Resend.

Prerender suitable public content; opt dynamic/private routes into SSR. Keep public key content readable without client JavaScript. Server domains and credentials stay separate from browser code. Use pinned tooling and one lockfile.

The foundation does not approve product screens, account models, booking rules, payments, realtime, uploads or legal content. Supabase selection does not automatically approve every bundled feature. Do not invent a schema ahead of lifecycle/access requirements. PostHog and email stay disabled until independent configuration and verification.

GitHub stores code, documentation, tests, contracts, migrations and setup records. Providers store secrets and persistent data. Actual provider acceptance is distinct from local tests.
