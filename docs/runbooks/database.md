# Database

Selected: Supabase PostgreSQL. No hosted Duoly database provisioned yet.

Use the exact repository-pinned CLI through pnpm exec supabase. Install a supported Docker-compatible container runtime, then run pnpm exec supabase start from the repository root. Config and seed SQL live in supabase/. No product schema is approved. Initial signup is disabled; no external OAuth or SMTP.

pnpm exec supabase status prints local credentials: inspect privately, do not publish logs. Stop using pnpm exec supabase stop. Resets are destructive; verify local target first.

## Schema workflow

Use pnpm exec supabase migration new <description>. Commit SQL and schema/RLS tests, coordinate timestamps, test pnpm exec supabase db reset and pnpm exec supabase db lint --local on disposable resources, then regenerate types. Never rewrite applied migrations or edit hosted schema manually. A running CLI without Docker is not database acceptance.

Critical transitions need constraints/atomic transactions. Realtime only publishes outcomes. Concurrent order acceptance must have exactly one winner when implemented.

## Hosted setup

Owner selects Supabase organization, EU region near Vercel fra1 unless requirements differ, plan and independent dev/production projects. Confirm quotas and costs before provisioning. No Pet to Portrait credential/project reuse. Preview resources never receive production credentials. Review branch-preview lifecycle and costs or document shared-dev migration coordination.

Use secure login/credential storage, never chat/Git. Hosted migration push, backups, retention/deletion, object backup and isolated restore tests require approval and real verification. Database backup alone does not protect storage objects.
