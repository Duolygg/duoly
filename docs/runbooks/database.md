# Database

Selected: Supabase PostgreSQL. The shared development project is provisioned and verified. The account foundation is applied to development and exercised through real provider/browser integration. The owner supplied the rebuild brief as the behavioral target. Orders, payments and other product schemas remain unimplemented. See [backend rebuild status](../product/backend-rebuild-status.md).

## Hosted development

| Setting                  | Verified value                                                |
| ------------------------ | ------------------------------------------------------------- |
| Organization             | Duoly, `vbrxnajhjbbkclijigxi`                                 |
| Organization plan        | Free, read back before and after provisioning                 |
| Project                  | `duoly-dev`, `omnejesspybaxuacjlah`                           |
| Region                   | `eu-central-1`, Frankfurt                                     |
| Database                 | PostgreSQL 17.11                                              |
| Console                  | <https://supabase.com/dashboard/project/omnejesspybaxuacjlah> |
| Database SSL enforcement | Enabled and applied successfully                              |
| Product tables           | profiles and account_roles, both RLS enabled                  |
| Customer auth            | Email enabled; signup closed; social, phone and anonymous off |
| SMTP                     | Resend configured; verification blocks successful sending     |

Supabase is **free-only** by owner decision. Do not upgrade the organization, enable paid branching, select paid compute or enable paid add-ons. If quotas prevent work, stop and raise the exact limitation. Paused projects do not count toward the active free-project allowance; unrelated paused projects were preserved. Do not delete other projects as routine cleanup.

Organization membership is separate from GitHub access. Obtain an individual Duoly Supabase invitation and use your own account with MFA; do not share the owner's login or management token. Confirm a second owner and team access before relying on shared cloud operations.

```sh
pnpm exec supabase login
pnpm exec supabase link --project-ref omnejesspybaxuacjlah
```

Provide database credentials only through a secure prompt or secret manager. Do not paste them into commands, chat, issues or Git. The initial administrator password is held in the owner's macOS Keychain, service `duoly-supabase-db-password`, account `duoly-dev`. This is a management credential, not an application or CI credential. CLI link metadata is ignored under `supabase/.temp/` and must not be committed.

The shared pooler discovered from the provider is `aws-1-eu-central-1.pooler.supabase.com`; transaction mode uses port `6543` and user `postgres.omnejesspybaxuacjlah`. Do not construct a pooler hostname from the region. Future serverless clients need TLS, small connection pools and transaction-pooler-compatible prepared-statement settings. Use a least-privilege application identity once the schema and authorization contracts exist. Never give browsers an administrator password, secret API key or service-role key.

No database password, management token, secret API key or connection URL has been added to GitHub or Vercel. The scaffold still builds without Supabase credentials. Production has no database yet. Development and previews must never use future production credentials. With a shared development project, coordinate migrations with one integrator; do not assume paid per-PR database branches exist.

## Local development

Use the exact repository-pinned CLI through `pnpm exec supabase`. Install a supported Docker-compatible container runtime, then run `pnpm exec supabase start` from the repository root. Config and seed SQL live in `supabase/`. The configured PostgreSQL major version is 17, matching the hosted project. Initial signup is disabled; no external OAuth or SMTP is configured.

`pnpm exec supabase status` prints local credentials: inspect privately, do not publish logs. Stop using `pnpm exec supabase stop`. Resets are destructive; verify the local target first. A container runtime is still missing on the setup machine, so local startup and migration replay are not verified.

## Schema workflow

Use `pnpm exec supabase migration new <description>`. Commit SQL and schema/RLS tests, coordinate timestamps, test `pnpm exec supabase db reset` and `pnpm exec supabase db lint --local` on disposable resources, then regenerate types. Never rewrite applied migrations or edit hosted product schema manually. A running CLI without Docker is not local database acceptance.

The local config requires explicit API grants for new objects. Do not assume those local settings automatically configure the hosted database. Every product migration must explicitly define grants, enable RLS and test allowed and denied access before exposure through the Data API.

Critical transitions need constraints and atomic transactions. Realtime only publishes outcomes. Concurrent order acceptance must have exactly one winner when implemented.

```sh
pnpm exec supabase gen types --project-id omnejesspybaxuacjlah --lang typescript --schema public
```

This remotely introspects development without requiring local Docker. Commit generated application types when approved schema migrations exist. Do not add a second migrations directory.

Hosted migration push, backups, retention/deletion, object backup and isolated restore tests require approval and real verification. Database backup alone does not protect storage objects. The Free plan must not be described as providing a verified production backup or recovery guarantee.

## Executed acceptance

- Provider readback: exact Duoly organization on Free and exact development project `ACTIVE_HEALTHY`.
- Read-only SQL returned database `postgres`, PostgreSQL `17.11` and zero public base tables.
- SSL configuration readback reported database enforcement enabled and successfully applied.
- Public auth settings returned HTTP 200, signup disabled and all external providers disabled.
- Public REST schema enumeration returned HTTP 401 with a secret-key requirement. This is an access boundary, not a failed database connection.
- CLI link succeeded and a subsequent project listing identified the exact project as linked.
- Hosted TypeScript type generation succeeded.

Not yet accepted: application database integration, product schema, local migration replay, RLS tests, collaborator membership, production project, backups and isolated restore.

## References

- [Supabase billing and free-project allowance](https://supabase.com/docs/guides/platform/billing-on-supabase)
- [Connection modes and pooling](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Management API auth configuration](https://supabase.com/docs/reference/api/v1-update-auth-service-config)
- [Management API SSL enforcement](https://supabase.com/docs/reference/api/v1-update-ssl-enforcement-config)
