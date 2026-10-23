# Order completion and immutable USD earnings

## Release activation

The owner authorized merge on 23 October 2026. PR [#51](https://github.com/Duolygg/duoly/pull/51) preserves the merged admin Teammates work and leaves the other agent's Customers worktree untouched. Migration `20261024130000_order_completion` was applied through the pinned Supabase CLI, using a scratch copy of the fetched remote migration history so already-applied parallel migrations were neither copied into this PR nor replayed. Readback confirmed the migration record, RPCs, immutable ledger, authenticated RPC execution and denied raw ledger inserts. All eleven behavioral SQL suites passed again against the installed schema in a transaction ending rollback.

Database types were regenerated from the hosted schema and the temporary migration-RPC type extension was removed. Type check, lint, 1,066 unit tests, build and desktop/mobile chat and completion tests passed. One local chat run lost its development server; reruns on worktree-isolated ports passed all ten chat and eight completion cases. Exact-head GitHub checks and deployed acceptance are recorded on PR #51; local or CI success alone does not claim a completed production booking.

The remaining sections preserve the implementation and pre-activation evidence. Statements below that no migration was applied describe that earlier checkpoint, not the release state above.

## Scope and authority

This is the owner-approved **no-rewards completion slice**, not a complete financial product. It narrowly supersedes the blocking statements in `proof-completion-contract.md` §Authority and §Later completion boundary **only** for: assigned-teammate completion with existing ready proof, permanent booked-USD earning/security-deposit snapshots, assignment closure, and closed historical chat. That older document remains authoritative for private proof and deferred financial ambiguities.

No customer wallet rewards, cashback, loyalty gifts, reviews, tips, deposit release, dispute decisions, weekly payout generation, provider charges/refunds, or production activation are implemented. An immutable earning is not a provider payout. There is no backfill from historical JSON or already-completed orders. Trust counts only this new immutable ledger; any future backfill requires an explicit reviewed migration.

Read before implementation: original `BACKEND_REBUILD_PROMPT.md` (mirrored in `backend-rebuild-brief.md`), original `lib/orders.js`, `lib/ledger.js`, and `lib/trust.js` from the preserved `duoly-design-source` checkout. Original-to-SQL mapping:

| Original                               | This slice                                                                                                                          |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `orders.complete`, lines 253–267       | `complete_order`; existing ready proof IDs replace async local file writes; one DB transaction removes the source race/partial save |
| `ledger.recordCompletion`, lines 24–40 | `teammate_earning_entries`; permanent per-order booked payout, prior-completion count and tier snapshot                             |
| `trust.TIERS` / `tierFor`              | Private `completion_trust`; thresholds 0/100/250/500/1000 and deposits 10/8/5/3/0%                                                  |
| `orders.chatSystem` completion         | Existing `orders_chat_transition`; exactly one persisted completion system message, no manual append                                |
| active assignment / chat lifecycle     | End assignment with `completed`; permit historical-final read, retain in-progress-only sends/typing                                 |

## Database contract

Migration: `supabase/migrations/20261024130000_order_completion.sql`.

```text
public.complete_order(
  p_order_id uuid,
  p_assignment_id uuid,
  p_proof_ids uuid[],
  p_request_id uuid
) -> {completion:{
  order_id, assignment_id, request_id, proof_ids, completed_at,
  payout_usd_cents, deposit_percent, held_usd_cents, net_usd_cents, trust_tier
}}

public.teammate_earnings(p_limit integer default 20, p_offset integer default 0)
  -> {earnings:[the same inner completion DTO, newest first]}
```

Expected business failures use existing `{error:{code,message}}` via `public.order_error`, **not** `status`, and not raw SQL exceptions. Infrastructure/constraint failures deliberately propagate so the entire statement rolls back. Pagination is 1–100 / 0–100000. History has no arbitrary account parameter and uses the fresh teammate role, not metadata. Suspension/Discord/game access gate playing and completion; owning previously earned history requires the current teammate role, not current playing eligibility.

- Authenticate fresh DB role and access. Admin/customer/stranger/former assignment/stale role cannot complete. Missing subject is 401; wrong role 403; inaccessible order 404; stale/conflicting assignment/request 409; malformed/nonready evidence 400.
- Lock order: teammate `account_roles FOR UPDATE` (same serialization mutex as accept), access `FOR SHARE`, order `FOR UPDATE`, captured payment `FOR UPDATE`, selected proof in UUID order `FOR SHARE`, then ledger/association/assignment/order writes. No sweep or priority reapplication. A previously rerolled assignment never becomes current by replay.
- Actual `order_payments` must exist with `state='captured'` and `settle='none'`. Authorized/capture-failed/voided/refunded/release-failed/outstanding settlement/absent payment reject. Payment rows, settlements, refunds and Stripe events are not mutated by completion.
- Select 1–5 distinct, one-dimensional, non-null UUIDs, all ready and owned by the current assignment and actor. Input ordering is canonicalized by UUID. No URL, path, bytes, caller price, tier, FX or timestamp inputs.
- Per-teammate request UUID is permanently bound to one order/assignment/canonical proof set. Matching retry returns the **stored JSONB result exactly**, even after completion or later order/FX changes, following fresh authorization. Another request or payload for an already-completed order returns 409. A request reused on another own order returns 409.
- One immutable ledger row per order; assignment/uploader FKs restrict deletion. `order_completion_proofs` permanently binds the selected proof rows with restrictive FKs; update/delete guards protect both audit tables. Ready evidence already has immutable metadata. Unselected ready evidence remains private investigation evidence; it is **not** part of the frozen submitted set.
- The assignment ends with server `ended_at`/`completed` in the same transaction; both active-assignment partial indexes are freed. The existing assignment-ended trigger abandons pending uploads, and existing finalization rejects late attachment. The order retains its final assignment FK.
- Prior immutable earning count is serialized per teammate. Payout comes from stored `orders.payout_usd_cents`, not current FX. Positive integer-cents half-up: `held=(payout*percent+50)/100` using integer division, `net=payout-held`. Constraints independently enforce conservation, rounding and count/tier/rate consistency. Audit stores count/tier/completion time, booked payout/FX and captured payment source identity/state. Refunds later must not rewrite this earning.
- New tables have RLS and no raw table grants to PUBLIC/anon/authenticated/service_role. Only the two user RPCs are granted to authenticated. Helpers are private invoker functions; RPCs are narrowly scoped security-definer functions, all with empty `search_path`.
- Chat change replaces only its private viewer predicate: the completed **final** assignment remains readable to eligible teammate/customer/admin, never rerolled teammates or replacements. Existing send/typing checks still reject after completion. The inherited transition can issue multiple fixed invalidations for one status change; tests claim one persisted system message, **not** exactly-once websocket delivery.

## Verification and TDD evidence

Observed real hosted-PostgreSQL RED failures before their implementations:

1. Happy path: `function public.complete_order(uuid, uuid, uuid[], uuid) does not exist`.
2. Replay: `completion assertion: same-request exact replay after completion`.
3. Immutable audit: `completion earning update was allowed`.
4. Historical chat: `completion assertion: final teammate can read closed chat`.
5. History: `function public.teammate_earnings() does not exist`.
6. Trust boundaries: `function public.completion_trust(bigint) does not exist`; then actual 100-entry integration failed `100 prior entries chooses Trusted` before wiring the helper to posting.
7. Multidimensional input: raw PostgreSQL `0A000 searching for elements in multidimensional arrays is not supported`; fixed to the normal 400 envelope.
8. Persisted invariants: `completion incoherent immutable money/tier snapshot was allowed` before rounding/tier CHECK constraints.

Real hosted test command (all tentative schema/fixtures **one transaction ending rollback**):

```sh
python3 supabase/tests/completion_run.py
```

The runner strips only the migration's outer BEGIN/COMMIT, adds all `completion_*` behavioral suites in dependency order, and invokes pinned local Supabase CLI `db query --linked --project-ref omnejesspybaxuacjlah --file ... --output-format json`. Fixtures use explicit order references (no order-sequence consumption), temporary helpers, no actual provider calls or storage bytes. The final read asserts `migration_rolled_back:true`. Do not run fixture SQL standalone on a shared/hosted DB.

Covered: actual role-switched raw-table denial; current role/access revocation; payment states; zero/six/duplicates/null/multidimensional/nonready/foreign proof; five-proof canonical replay; request conflict; immutable update/delete and selected-evidence delete denial; forced ledger failure and forced failure **after** all transitions restore order/assignment/ledger/proofs/chat; next acceptance; pending abandonment/late finalization rejection; former/replacement isolation; closed chat reads/sends/typing; tier thresholds and actual 100-entry posting; exact own history, order and pagination; unchanged payment/refund state.

Independent concurrency uses **native PostgreSQL**, not PGlite, with separate backend PIDs and observed `pg_stat_activity.wait_event_type='Lock'` barriers:

```sh
export PATH="$HOME/.hermes/tools/node-v24.21.0-darwin-arm64/bin:$PATH"
# Scratch-only dependencies, no repository lockfile/dependency changes:
npm install --prefix "$HOME/.hermes/cache/scratch/completion-postgres" \
  embedded-postgres@18.4.0-beta.17 pg@8.16.3
# If npm disables the reviewed binary package postinstall:
node "$HOME/.hermes/cache/scratch/completion-postgres/node_modules/@embedded-postgres/darwin-arm64/scripts/hydrate-symlinks.js"
node supabase/tests/completion_local.mjs
```

The runner starts/stops a disposable loopback server, executes the SQL suites, then commits **local-only** fixtures for same-request concurrent completion and both completion-versus-reroll lock schedules. It verifies exact replay/one ledger/one completion message and a single legal winner. Native PostgreSQL 18.4 runs successfully here (packaged binary reports x86_64 on Darwin); hosted tests independently cover managed Postgres. Local managed auth/storage/realtime schemas are explicitly minimal stand-ins; the realtime sink records transactional calls, not delivery. The two managed cron/HTTP cleanup migrations are omitted locally; hosted rollback verification uses the complete existing managed schema. No production/hosted persistent schema or fixtures are written.

Static migration guardrails are separate from runtime acceptance:

```sh
pnpm exec vitest run tests/unit/completion-migration.test.ts
```

## Verified results (local worktree)

- `python3 supabase/tests/completion_run.py`: `PASS: 11 real hosted PostgreSQL suites; migration + fixtures rolled back`, with final `migration_rolled_back: true`.
- `node supabase/tests/completion_local.mjs`: the same 11 behavioral suites pass on native PostgreSQL 18.4; three overlapping-backend schedules pass (same-key replay, completion wins reroll, reroll wins completion). Distinct backend PIDs and actual Lock waits are asserted.
- `pnpm exec vitest run tests/unit/completion-migration.test.ts`: 4 tests passed.
- `pnpm test:unit`: 48 test files / 1065 tests passed on the then-current shared worktree (including the parent's concurrent API/UI work).
- Targeted ESLint/Prettier checks and `git diff --check` passed.
- A read-only hosted check at wrap-up found migration head **20261024125000 (`admin_teammates`)**, newly applied by another session while this work ran. Its target-account role mutex matches this completion lock order; it adds no completion/earning schema. Both `complete_order` and `teammate_earning_entries` remained absent after rollback. Parent should integrate the separately landed migration; this work did not apply it or modify its file.

## Integrated application verification

Parent fast-forwarded this worktree to `origin/main` at `b210820`, preserving the separately landed admin Overview and original-port ledger. The hosted `admin_teammates` migration is not in that Git snapshot; it belongs to another session, has no conflicting completion objects, and was not copied or activated by this feature.

- `pnpm verify` passed: type check (zero errors/warnings, 23 existing hints), lint, formatting, **1,066 unit tests**, Vercel-adapter build, **126 browser tests** (108 main, 10 chat, 8 completion).
- Parent reran `python3 supabase/tests/completion_run.py`: all 11 hosted suites passed and the migration/fixtures rolled back.
- Parent reran `node supabase/tests/completion_local.mjs`: all 11 behavioral suites and three overlapping native-session schedules passed.
- Independent API/contract review and final SQL/UI source review found no blocking security or correctness issues. The final reviewer also independently ran 42 scoped unit tests and eight desktop/mobile completion browser tests successfully.
- Desktop/mobile completion-browser fixtures exercise confirmation, double-click protection, identical manual retry after a lost acknowledgement, readback recovery without a second mutation, stale evidence rejection, denied-history versus empty-history handling, and authoritative assignment-clear gating. The screenshot fixture serves decodable PNG bytes and checks `naturalWidth`, rather than treating a broken thumbnail as visual acceptance.
- `POST /api/teammate/orders/:id/complete` uses the existing same-origin CSRF and bounded JSON control transport. Only assignment UUID, request UUID and ready proof UUIDs are accepted; the route owns the order UUID. Money, actor and timestamps come from SQL. The response must exactly match all request bindings.
- `GET /api/teammate/earnings` reads private own history. The native desk shows gross, held and net USD **recorded**, with the order identity. It never labels a record as paid or withdrawable.
- A final independent hosted readback confirmed `complete_order` and `teammate_earning_entries` remain absent and migration head is `20261024125000`. No feature activation or deployment occurred.

These browser tests use explicit fictional API fixtures; database tests use controlled SQL fixtures. A real signed-in browser completing an actual Stripe test-mode booking on the deployed domain remains a **release acceptance gate**, not a result claimed here.

## Integration / remaining gates

Parent owns API/UI/contracts/generated types and independent review. Generated types were deliberately untouched; use the narrow typed migration-RPC extension until authorized persistent migration and regeneration. The local server URL is loopback port 55439 while the native runner executes, and stops on exit; it is **not** a complete managed public-schema regeneration source because managed cleanup migrations are omitted.

Applying this migration grants authenticated direct completion RPC access independently of any HTTP feature flag. No apply, commit, push, deploy or activation was performed. No provider charge, actual image byte upload, realtime websocket delivery, customer reward, review/tip, release/payout, or production browser result is claimed.
