# Private proof cleanup

## Authority

The native Deno function `private-proof-cleanup` accepts only the exact explicitly provisioned project service-role credential. `PRIVATE_PROOF_CLEANUP_SERVICE_ROLE_KEY` is mapped into the handler's service credential for both authentication and fixed provider calls. Keep gateway JWT verification enabled. Missing configuration fails closed; anonymous and ordinary user credentials cannot invoke maintenance. Do not expose this credential through public configuration or an application endpoint.

The reserved Edge `SUPABASE_SERVICE_ROLE_KEY` can differ from the legacy service-role JWT returned by the native project API. Actual digest comparisons confirmed this mismatch during deployment. Consequently it is not suitable for equality authentication of the scheduler's native credential. The explicit key must be the approved project's native service-role JWT, never an unrelated shared secret. Native HMAC verification still compares exact bytes.

## Bounds and safety

- POST, no URL parameters, absent body or empty JSON object only, maximum 64 bytes.
- One service-only `claim_stale_order_proof_uploads({p_limit:25})` RPC. Validate its complete bounded exact UUID DTO response before any delete. No caller-controlled IDs, paths, actors, URL, key or limit.
- SQL atomically abandons stale pending rows, returns abandoned rows, excludes immutable ready proofs and serializes traversal with a finite immutable cursor. Abandoned uploads cannot finalize.
- Compute exact private paths from validated bindings. DELETE then GET through an authenticated URL with a fresh nonsecret random nonce and no-cache. A delete acknowledgement, catalog count or cached old GET is insufficient.
- Count absence only on HTTP 404, or HTTP 400 with the exact structured provider not-found response. Denial, timeout, malformed output and successful reads are failures.
- Fixed 25 bindings, at most 51 outbound requests, three-second operation bounds, 20-second overall bound, cancellation and redirect rejection. No drain loop, retries or parallel fan-out.
- Responses expose only counts with no-store. Failed or unattempted work remains retryable. There is no application or financial side effect.

## Deployed configuration

Approved project: `omnejesspybaxuacjlah`. The deployed function is ACTIVE with `verify_jwt: true`.

Migration `20261023200000_proof_cleanup_schedule.sql` installs the previously absent `pg_cron` and `pg_net`, restricts their schema/table/function access from application roles, and schedules these PostgreSQL-owner jobs:

| Job                               | UTC schedule   | Purpose                                                            |
| --------------------------------- | -------------- | ------------------------------------------------------------------ |
| `private-proof-cleanup`           | `*/15 * * * *` | Fixed empty-object POST to the function                            |
| `private-proof-cleanup-log-prune` | `25 3 * * *`   | Delete only these owned jobs' completed logs older than seven days |

Vault contains unique names `duoly_private_proof_cleanup_service_role_key` and `duoly_private_proof_cleanup_url`. Provision their values over the authenticated management channel, in memory; never put credentials in command arguments, logs, repository files or cron command text. Verify the URL is exactly this project's `/functions/v1/private-proof-cleanup` endpoint and the key belongs to the same project. The SQL destination regex validates URL shape, not project ownership; privileged Vault provisioning is a trust boundary.

The guarded schedule queues nothing if either unique configuration value is absent or invalid. Cron SQL success therefore does not establish HTTP delivery. Read both `cron.job_run_details` and the matching `net._http_response` status/count body. Do not query decrypted keys or record request headers. Runtime authorization headers enter the protected transient net request queue.

Cadence is 96 cleanup calls per day. The fixed worst-case per-call request bound is 51; ordinary empty calls make only the claim RPC. No paid plan, always-on worker or automatic upgrade is configured. A temporary one-minute cadence was used for acceptance and restored to the verified 15-minute schedule.

## Executed acceptance

Deployment readback confirmed gateway JWT verification. Missing and anon credentials returned 401, GET returned 405 and a caller-supplied limit returned 400. The exact service credential returned HTTP 200 with counts and no-store. Two real cron runs received HTTP 200 and zero-failure count bodies. The guarded browser runner additionally created an owned stale pending fixture with real bytes, invoked the deployed function, verified abandonment and provider-readback absence, and confirmed all five ready proofs remained readable. All fixture objects, rows and accounts were removed and absence verified. PostgreSQL concurrency acceptance separately covers finalize/cleanup and reroll locking. See `docs/product/private-proof-status.md`.

## Rotation, pause and recovery

Rotate the same project's service-role credential consistently in the function secret, Vault and production application's sensitive Vercel variable. Securely read back only digests/metadata and test exact-auth denial, a service call and a scheduled HTTP response again. If rotation temporarily mismatches, cleanup must fail closed.

To pause, disable only the named `private-proof-cleanup` job owned by `postgres`; do not delete unrelated jobs. Disable application uploads with `ORDER_PROOFS_ENABLED=false` and deploy that setting if cleanup health is uncertain. Keep metadata bindings until provider absence is proven. Investigate nonzero failed counts, HTTP errors, missing responses and scheduler gaps; do not interpret SQL queueing success as deletion success.

Failed runs can revisit abandoned rows, including already absent objects. Idempotent rechecks consume calls but cannot delete ready proofs. Retention/deletion of ready evidence remains a separate owner-approved operation.

## Local checks

```sh
pnpm check
pnpm lint
pnpm test:unit
node --test supabase/tests/proof_http_acceptance.safety.test.cjs
```

Actual cloud/browser acceptance requires the explicit guarded command documented in `supabase/tests/proof_http_acceptance.md`; it is not part of ordinary CI and is never implied by these offline checks.
