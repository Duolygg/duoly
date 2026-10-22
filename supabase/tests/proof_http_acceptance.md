# Guarded private-proof HTTP/browser acceptance

This runner is **not executed by adding these files**. It imports inertly. Only the parent/operator may run the explicit integration command after reviewing/applying the SQL migration. Offline tests do not use credentials, the CLI, a browser, a server, Git, or network.

## Offline validation

```sh
node --check supabase/tests/proof_http_acceptance.cjs
node --test supabase/tests/proof_http_acceptance.safety.test.cjs
```

## Explicit development execution (parent only)

From this checkout, using the supplied Node 24 installation and the final implementation as the target:

```sh
PATH="/Users/sebastianschrottenbach/.hermes/cache/scratch/duoly-node24/node-v24.21.0-darwin-arm64/bin:$PATH" \
node /Users/sebastianschrottenbach/Desktop/Duoly/duoly-proof-acceptance/supabase/tests/proof_http_acceptance.cjs \
  --project-ref omnejesspybaxuacjlah \
  --allow-development-fixtures \
  --root /Users/sebastianschrottenbach/Desktop/Duoly/duoly-proof-finalize
```

Portable form: `node /path/to/proof_http_acceptance.cjs --project-ref omnejesspybaxuacjlah --allow-development-fixtures --root /absolute/canonical/target-checkout`.

All three arguments are mandatory; duplicates, unknown flags, another project, relative/traversal roots and malformed object-binding UUIDs are refused. The target root must be a real nonsymlinked canonical path. The target checkout supplies **all** third-party dependencies (`@playwright/test`, installed Chromium, `@supabase/ssr`, Astro and Supabase CLI); no install, dependency/provider additions or Git operations are performed. The CLI must already be authenticated and its owner SQL `db query --linked --project-ref … --output json` capability available, as in the exercised order helper. Keys are retrieved through the actual CLI and retained in memory. CLI child processes inherit only a small OS environment allowlist, not ambient credential variables or Node injection flags. The CLI can use its existing HOME-based authentication.

The parent must have applied the reviewed proof migration and earlier account/order migrations. The runner does not apply migrations or enable hosted production uploads. It refuses `.env`, `.env.local`, `.env.development` and `.env.development.local` in the target because Astro would otherwise load ambient project settings. `.env.example` is harmless. It never edits dotenv files.

## What the integration run exercises

- Four unique, admin-confirmed GoTrue fixture accounts at `example.invalid`, no outgoing mail; real password SDK sessions and SSR cookies. Roles and teammate access come from owner SQL, not editable auth metadata. The unrelated customer is temporarily promoted to admin by SQL for private-read checks.
- One clearly labeled synthetic, **not paid** order accepted through the actual teammate UI. Five renderable browser-canvas image fixtures (PNG/JPEG/WebP) are uploaded through the real file input and button.
- Actual HTTP validation for missing Origin/CSRF, explicit invalid-magic source bytes and an oversized source-byte fixture; rejected requests must create neither reservations nor objects. Five-slot cap, disabled sixth UI selection, sixth HTTP refusal, same-request/body replay with the same proof ID and unchanged object count, changed-body conflict.
- A committed same-ID replay whose HTTP acknowledgement is discarded at the browser routing boundary, followed by an explicit identical retry. The intercepted server response must be successful and match the original proof before the test can pass. **This is lost HTTP ACK coverage on an existing ready proof, not first-write/storage-provider lost ACK injection.** It does not claim to exercise that deeper provider fault.
- Customer/current teammate opens, customer and temporary-admin browser image decoding, exact MIME, nosniff and no-store. Anonymous/unrelated/former teammate 404, cross-order proof-ID pairing 404, raw public storage and real-user-JWT storage reads denied. Infrastructure failures cannot count as denial.
- An unrelated expired queued order is inserted **after** initial desk/assignment reads and **before** the proof requests. There is no desk/order refresh in this window. Its exact status/cancel reason and refund-credit count must be unchanged after uploads, replays, authorized reads and denied reads. It is then deleted and its absence checked **before** intentional customer reroll and replacement acceptance.
- Real reroll/replacement acceptance: former teammate loses reads, replacement sees no historical evidence, customer/admin retain it. Mobile customer and replacement screens must hydrate, have no horizontal overflow, decode all images (including nonhidden evidence), and report no page errors.

No completion, payment, payout, bucket/schema deletion or real-owner account modification is part of this test. Existing accept/reroll endpoints retain their established expiry-sweep behavior; run only against the explicitly authorized development project, not a live customer environment.

## Cleanup and reporting

`finally` closes Chromium and the temporary loopback-only Astro child (TERM, bounded wait, KILL fallback). The service credential is passed only to the isolated Astro child environment, never public config or the parent process environment. No credentials, passwords, JWTs, cookies, CLI output, raw SDK errors, browser traces, screenshots or source images are persisted by the runner. Astro may create its normal development cache in the explicitly selected target checkout.

Ambiguous account creation is **never retried blindly**: reconcile exact unique run marker plus exact expected email, with three bounded recovery reads. Final cleanup also discovers accounts with that run marker. Every user deletion is preceded immediately by an admin read verifying exact ID, fixture email and owner marker. Proof bindings are selected only by fixture order IDs joined to owned fixture customer IDs and the unique fixture note. Object paths are recomputed from validated UUIDs. Existing object bytes are deleted through the real Storage API and absence is independently read back through that API; scoped catalog counts must also be zero before SQL proof bindings are removed. Proof rows are removed before assignment/order rows, then only fixture credits/access/roles/users. Final SQL reads verify zero rows and zero users/profiles.

If ownership or Storage absence cannot be proven, cleanup fails closed and preserves bindings rather than pretending that SQL metadata deletion removed bytes. SIGINT/SIGTERM trigger failure/cleanup on the normal unwinding path; SIGKILL, machine loss, unavailable infrastructure or permanent provider failures cannot guarantee cleanup. Failure reporting intentionally omits raw error messages and run identifiers; operator recovery may require inspecting the fixture ownership metadata through authorized tooling. Do not rerun indiscriminately after an incomplete cleanup.

Output is safe JSON with fixed check names, derived check count, page-error count, fixture/not-paid booleans and per-stage cleanup booleans. Exit 0 requires every integration assertion and every cleanup boolean. Any other result is not acceptance. **The author has performed syntax/offline safety validation only; actual cloud/browser acceptance remains unexecuted until the parent explicitly runs it.**
