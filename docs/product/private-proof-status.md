# Private proof implementation checkpoint

## Integration

Branch `feat/private-proofs`, based on reviewed order UI `fb381d8cf9f72a7aa1f1b6d6ca7730da187ca3b5`, in the separate `duoly-proof-integration` worktree. Final SQL, HTTP and UI files were copied from their isolated worker checkouts. Early untracked source duplicates in `duoly-orders` were removed only after verifying final counterparts exist and those old paths were untracked.

The existing order UI PR #18 has passed exact-head Quality, Browser smoke and Vercel checks. It remains separate from this unpublished proof slice.

## Executed integration checks

- Frozen dependency install from the existing lockfile; no dependency or runtime version changes.
- Complete `pnpm verify`: type check, lint, full formatting check, **807 unit tests**, adapter build and **146 desktop/mobile browser tests** passed.
- The obsolete teammate assertion that all proof uploads are unavailable was reproduced as the only integration test failure, then updated to preserve the remaining completion/chat/payout restrictions and assert the new evidence-only notice. No application behavior was weakened to satisfy the assertion.
- Real development Storage schema was read through the authenticated CLI. Required bucket/object columns exist, including `metadata`, `file_size_limit` and `allowed_mime_types`. Only account and order migrations are currently applied. The proof migration and private bucket are not yet provisioned.

## Required before activation

Independent SQL and HTTP reviews found cleanup starvation behind locked orders, an upload preflight that could sweep unrelated expired orders into refund credits, authorization ordering before storage availability, and valid UUID-casing failures. Scoped fixes and regression tests are running in isolated worktrees; nothing has been applied or activated. The new side-effect-free authorization RPC is recorded in proof-api-boundary.md. Independent UI review passed with no security or logic findings. Its additional acceptance recommendations are an authenticated mounted assignment change with deferred old GET/POST responses, immediate removal of old evidence URLs after the scope reset, suppression of both delayed responses, and alphabetic UUID case coverage when integrating the HTTP fix. Static/unit/mock transport success is not proof of PostgreSQL or real object-storage correctness.

After review and fixes, the parent must execute the migration and rollback-only role-switched SQL checks against development, validate actual provider object metadata through real byte writes, exercise authenticated HTTP/browser upload/read and reroll/finalize/idempotency races, verify compensating deletion and trusted stale cleanup, and configure the server-only credential without exposing it to frontend config. Keep `ORDER_PROOFS_ENABLED` off until actual storage/authorization/cleanup acceptance passes. No public cleanup endpoint or signed read URLs.

No proof migration, storage activation, real order creation, completion, earning, loyalty, payout, production credential or customer-domain change is claimed here. Financial completion remains outside this upload/read slice.
