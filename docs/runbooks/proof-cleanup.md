# Private proof cleanup (trusted maintenance only)

## Deployment gate

The parent/operator owns deployment, SQL, Vault provisioning and the exact UTC
schedule. This runbook is a template, not evidence of activation. Keep
`ORDER_PROOFS_ENABLED` disabled until the deployed function, SQL authorization,
real Storage deletion/readback and a real scheduled invocation all pass.
No application API route, customer action, order completion or money action is
introduced. Do not expose the service-role key to browser configuration.

## Authority and bounds

- Entry: `supabase/functions/private-proof-cleanup/index.ts`, native `Deno.serve`,
  no remote imports, npm packages or runtime dependencies. `handler.ts` is a Web
  API factory tested under Node without importing the Deno entry.
- Built-in `SUPABASE_URL` must be an HTTPS `*.supabase.co` origin with no custom
  port, credentials, path, query or fragment. Built-in
  `SUPABASE_SERVICE_ROLE_KEY` is the only accepted credential. There is no custom
  cleanup key, actor, caller URL or caller batch limit.
- POST only. Authorization must equal `Bearer ` plus that exact built-in key;
  native WebCrypto HMAC-SHA-256 verification compares fixed-size tags in native
  code rather than a JIT-able JavaScript equality loop. Its ephemeral comparison
  key is not an alternate credential. Missing configuration fails closed.
  Missing/anon/user credentials are denied
  before any body read, RPC or Storage request. No CORS or ordinary-user route.
- Request body: absent/zero bytes or an empty JSON object only, at most 64 bytes.
  URL parameters/fragments are rejected. Caller-supplied IDs, paths, keys, actors
  and limits cannot influence work.
- Exactly one service-role REST RPC:
  `claim_stale_order_proof_uploads({p_limit:25})`. Its entire response must be
  exactly `{proofs:[{id,order_id,assignment_id}]}`, at most 25 bindings, UUID
  strings only, no unknown keys or repeated proof IDs (case insensitive).
  All validation happens before any Storage operation; response cap: 16 KiB.
- SQL is the state/authorization authority: it must atomically abandon stale
  pending uploads, return only abandoned rows, never ready rows, and prevent
  abandoned rows from becoming ready. The reviewed migration uses a persistent
  bounded traversal cursor for retry fairness; preserve that behavior. The
  function does not infer proof state from caller input or list the bucket.
- For each returned binding only, DELETE the private `order-proof` bucket using
  `{prefixes:["<order_id>/<assignment_id>/<id>"]}`. Then GET that exact object.
  Count deleted only on HTTP 404, or HTTP 400 containing structured JSON with
  `statusCode: "404"` and `error: "not_found"`. Other 400s, malformed JSON,
  forbidden reads, successful reads and failed DELETEs are not verified absence.
  Structured error cap: 2 KiB. Successful object bodies are cancelled, not read.
- Every fetch rejects redirects, uses no-store, receives a cancellation signal,
  and is bounded to 3 seconds including response-body handling. Input reading
  also has a 3-second bound. Overall authenticated maintenance deadline is 20
  seconds; request cancellation propagates. Unattempted/unverified bindings
  count failed and remain SQL-retryable. At most 51 outbound requests per run;
  no internal retries, parallel fan-out or unbounded drain loop.
- Success is counts only: `{claimed,deleted,failed}`. Per-object failures are
  included in those counts. 400/401/405/503/502 responses have empty bodies.
  Responses are no-store. No handler logging, locators, keys or diagnostics.
  Failed claim/DTO responses return 502; never trust partial claimed data.

## Parent/operator deployment

1. Independently review and apply the proof migration and verify service-only
   RPC grants, ordinary-role denial, irreversible abandonment and ready-row
   exclusion/races. This function cannot compensate for a SQL authority bug.
2. Deploy `private-proof-cleanup` using the already approved/pinned Supabase CLI
   against the explicitly approved project. Keep gateway JWT verification
   enabled (default); the built-in legacy service-role JWT works at the gateway.
   Independently confirm deployed settings and do not use an anon/user token or
   an alternative key in place of `SUPABASE_SERVICE_ROLE_KEY`.
3. Confirm built-in runtime URL/key configuration matches that project. Do not
   print keys or write them to shell history, repository files or CLI output.
4. Provision the exact built-in service-role key into Supabase Vault through an
   approved secure operator channel. Use the unique Vault name
   `duoly_private_proof_cleanup_service_role_key`. No raw-secret provisioning SQL
   is included here. Restrict access to decrypted Vault secrets, cron job text
   execution privileges and `net` response tables to trusted operators.
5. Enable `pg_cron` and `pg_net` only in the approved free project, without paid
   upgrades. Parent chooses and records an exact UTC cadence and invocation
   budget within current free quotas; do not install the placeholder schedule.
   Budget at most 51 network calls/run, plus SQL work; repeated absent abandoned
   rows are intentionally idempotent and consume future runs. Avoid overlapping
   jobs and aggressive retry schedules. A low-frequency cadence is maintenance,
   not an order-completion or payment deadline.

### Placeholder-only scheduling SQL

Replace project reference and cadence only after approval. The service key stays
in Vault; neither the SQL nor cron job text contains its value. The guard skips
invocation unless the named nonempty Vault secret exists uniquely. Do not query
or log the decrypted value. Use `pg_net` timeout greater than the handler's 20s
bound, so its count response can arrive.

```sql
-- TEMPLATE ONLY: parent must choose <PARENT_APPROVED_CRON_UTC>.
select cron.schedule(
  'private-proof-cleanup',
  '<PARENT_APPROVED_CRON_UTC>',
  $job$
    select net.http_post(
      url := 'https://<PROJECT_REF>.supabase.co/functions/v1/private-proof-cleanup',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'duoly_private_proof_cleanup_service_role_key'
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 25000
    )
    where (
      select count(*) = 1 and bool_and(length(decrypted_secret) > 0)
      from vault.decrypted_secrets
      where name = 'duoly_private_proof_cleanup_service_role_key'
    );
  $job$
);
```

Verify the exact named job's active flag, cadence and project URL after creation;
no second duplicate job. Inspect `cron.job_run_details` **and** the matching
`net._http_response` status/count body: cron success alone only confirms request
queueing, not HTTP success. A missing Vault secret can also yield a successful
SQL job without an HTTP request. Restrict response retention/access; do not
record headers or secrets in acceptance reports. On key rotation, update Vault
through the secure operator channel and verify another scheduled invocation.
Pause by disabling/unscheduling only the exact `private-proof-cleanup` job;
leave unrelated jobs untouched.

## Required real acceptance before uploads

- Anonymous/missing-key and ordinary authenticated JWT calls are denied;
  wrong methods, unsafe payloads and URL parameters do no work.
- A fresh pending proof and a ready proof survive cleanup, including a finalize
  race. No completion, balances, refunds, earnings or other money state changes.
- An owned stale pending reservation becomes abandoned. Its actual private
  object is deleted and a separate exact-object GET confirms absence. Repeating
  cleanup is safe; Storage denial/timeout remains retryable and reports failure.
- Exercise malformed claim DTO/failure behavior locally. Verify actual Storage
  structured-not-found behavior against the approved project's provider.
- Observe a real scheduled request, its successful HTTP count response, SQL
  state and exact object readback. Record the selected cadence, free-tier budget,
  deployed project/function/version and acceptance evidence without secrets.
- Only then may the parent enable uploads. No deployment or scheduling was
  performed by this isolated implementation task.

## Offline checks

```sh
pnpm exec vitest run tests/unit/proof-maintenance.test.ts
pnpm exec eslint supabase/functions/private-proof-cleanup tests/unit/proof-maintenance.test.ts
pnpm exec tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution Bundler --lib ES2022,DOM,DOM.Iterable --allowImportingTsExtensions --skipLibCheck supabase/functions/private-proof-cleanup/index.ts tests/unit/proof-maintenance.test.ts
```

When native Deno is available, the deploying parent should additionally run
`deno check supabase/functions/private-proof-cleanup/index.ts` with this
function's `deno.json`. Node Web API tests and TypeScript checks do not establish
actual Edge deployment or scheduler acceptance.
