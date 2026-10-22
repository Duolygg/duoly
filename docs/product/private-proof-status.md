# Private proofs

## Scope

Private screenshot uploads and authorized reads are integrated into the customer order room and teammate desk. This slice preserves the original product's limits and role rules. It does not complete orders, create paid orders, change earnings or initiate payments. See `proof-api-boundary.md` and `proof-completion-contract.md`.

## Verified infrastructure and behavior

- The proof migration and service-only cleanup scheduler are applied to approved project `omnejesspybaxuacjlah`. The bucket is private, with PNG, JPEG and WebP only, a 1.5 MiB object limit and five reserved/ready slots per assignment.
- Independent SQL, HTTP, UI, maintenance and scheduler reviews passed. PostgreSQL role/RLS acceptance and five independent-session concurrency checks passed. Cleanup uses immutable finite-epoch traversal and order-before-proof locking; ready rows are immutable and excluded.
- The guarded HTTP/browser acceptance runner passed 14 real checks, including source-byte validation, actual image uploads/decoding, identical request replay, five-slot limits, private customer/admin access, former/replacement teammate isolation, raw-storage denial, mobile layout and unrelated expired-order/refund isolation.
- The deployed cleanup function deleted an actual stale object's bytes, confirmed absence through a fresh authenticated Storage read and preserved five ready proofs. Its deployed gateway has JWT verification enabled. Missing/anon credentials and unsafe payloads are denied.
- Actual scheduled SQL invocations received HTTP 200 and `{claimed:0,deleted:0,failed:0}`. Final cadence is every 15 minutes UTC; only these jobs' logs older than seven days are pruned daily.
- Browser/SQL fixture accounts, objects and rows were removed and their absence verified. No real payment or outgoing mail was involved.
- Provider readback uses a fresh nonsecret nonce and an authenticated object URL: an acknowledged DELETE or a cached old GET is not evidence of absence.

## Release and operations

`ORDER_PROOFS_ENABLED` and the server-only `SUPABASE_SERVICE_ROLE_KEY` control application availability. Cleanup separately uses an explicitly provisioned service-role credential because the reserved Edge runtime credential may differ from the native project's legacy JWT. See `docs/runbooks/proof-cleanup.md` for scheduling, rotation, failure and pause procedures.

Current-commit quality, browser CI, release SHA, custom-domain deployment and production activation are recorded in the integrating PR. Do not infer current production activation from a historical checkpoint or a successful local build. Recovery branches remain preserved until their content is confirmed integrated.

## Remaining product work

Completion, immutable earnings/wallet ledgers, checkout, payouts and payment-backed creation remain separate work. Upload success does not claim financial or order completion.
