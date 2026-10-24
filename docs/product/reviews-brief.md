# Brief: ratings and reviews (ledger #7, review part)

Worktree `~/Desktop/Duoly/duoly-reviews`, branch `feat/reviews` (from main). Work ONLY here. `node_modules` is a symlink to `../duoly/node_modules`. Node: `export PATH=~/.hermes/tools/node-v24.21.0-darwin-arm64/bin:$PATH`; tools from `node_modules/.bin/` (no npx). Read first: `~/Desktop/Duoly/HANDOFF-original-port.md` and ledger rows #7, #10, #22, #29, #35 in `docs/product/original-port-ledger.md`.

## Goal

After a completed order, the customer rates the teammate (stars) and can write a short review, exactly as in Fabian's original screens, on the real Supabase backend. Teammates and admins see the resulting rating. Tips (#10) stay switched off: keep the tip UI behind its flag, do not build payments.

## Original behaviour

Original backend files in `~/.hermes/cache/scratch/orig-audit/` (`lib/orders.js`: the `review()` function and everything that reads `o.review`; `app/api/orders/[id]/route.js` action `review`). Fetch anything else with `gh api "repos/duoly-admin/duoly/contents/<path>?ref=7f0299f" -q .content | base64 -d`. Our ports of his screens are live: `src/components/account/QueueRoom.jsx` (+ `queue-room-data.js`), `src/components/account/Dashboard.jsx`, `src/components/teammate/Teammate.jsx`, `src/components/admin/*.jsx`; the review form is gated behind a `FEATURES` flag (search for `review`). Reproduce his rules: who may review (only the order's customer, only completed orders, once; check if he allowed editing and for how long), star range, text length, what teammates see (stars and text, never the customer's private data unless he showed it), how the average is computed and shown (teammate dashboard, admin Teammates roster, admin order detail). Use his copy.

## Build

- New migration (version `20261024160000`; first confirm it doesn't collide: `ls supabase/migrations` in every `~/Desktop/Duoly/duoly-*` worktree and `select max(version) from supabase_migrations.schema_migrations` on linked project omnejesspybaxuacjlah). Never edit applied migrations. Table for reviews (or columns on orders, follow the existing order schema style), RLS on, security-definer RPC `order_review(...)` with the checks above, plus whatever read RPCs the screens need. Extend existing read functions with `create or replace` and minimal diffs.
- Rollback-only SQL test in `supabase/tests/` (pattern: `supabase/tests/support_sparky_limits.sql`: fixed UUIDs, `set local role authenticated` plus `request.jwt.claims`, read tables only after `reset role`, end with `rollback`). Run it against the linked project in one transaction with the migration body, then rollback. Do NOT `db push`; the parent applies migrations after review. Order tables block deletes on purpose (see handoff doc).
- API route following the existing order action routes (`src/server/orders/handlers.ts`, strict zod bodies in `src/contracts/orders.ts`, CSRF).
- Flip the review flag in the screens and map through the adapters (no business rules in adapters). Show ratings where his screens show them (teammate dashboard, admin roster `ledger #22`, admin order view).

## Verify

`eslint .`, `astro check` (0 errors), `vitest run`, `corepack pnpm test:e2e` (all four configs; no dev server running: check `lsof -i :4321`, the process is `astro.mjs dev`; a chat test is occasionally flaky, rerun once). Unit tests for adapter mapping and contract validation. Stop after the rollback SQL test and checks are green. Commit, push, open a DRAFT PR to Duolygg/duoly, update ledger #7 in the same PR. Never print or commit secrets. Owner style for user-facing text: no em or en dashes, no ampersands, no "not X but Y".

Final answer: PR URL, migration file name, the rules each RPC enforces (with the original file:line they came from), test numbers, open points.
