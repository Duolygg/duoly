# Brief: handover links and admin order actions (ledger #17, #20)

Worktree `~/Desktop/Duoly/duoly-handover`, branch `feat/handover-admin-actions` (from main). Work ONLY here. `node_modules` is a symlink to `../duoly/node_modules`. Node: `export PATH=~/.hermes/tools/node-v24.21.0-darwin-arm64/bin:$PATH`; tools from `node_modules/.bin/` (no npx). Read first: `~/Desktop/Duoly/HANDOFF-original-port.md` and ledger rows #17, #20, #41 in `docs/product/original-port-ledger.md`.

## Goal

1. **Handover links (#17):** an admin creates a link for a queued order and sends it to a specific teammate; opening it lets that teammate take the order directly (skipping queue priority), with all eligibility rules. `/claim` is a placeholder today; port Fabian's `Claim.jsx` screen.
2. **Admin order actions (#20):** the admin Orders and live desk screens (already ported, read-only) get their actions: cancel an order, refund, create handover link. Use Fabian's buttons and copy.

## Original behaviour

Files in `~/.hermes/cache/scratch/orig-audit/`: `lib/orders.js` (`createHandover`, `accept` with `opts.handover`, lines ~126-240, the cancel and refund code), `app/api/orders/[id]/route.js` (action `handover`), `app/api/claim/[token]/route.js`, `app/claim/[token]/page.jsx`, `components/Claim.jsx`, `components/admin/Orders.jsx`, `components/admin/LiveDesk.jsx`, `app/api/admin/orders/route.js`. Fetch more with `gh api "repos/duoly-admin/duoly/contents/<path>?ref=7f0299f" -q .content | base64 -d`. Rules to keep: admins never play orders; handover token is random and unguessable, stored hashed, expires at the order's auto-cancel time, one active link per order, revoked on cancel/accept/reroll; game access and Gamer Girl rules (`lib/access.js`) apply to handover links too; a teammate the customer re-rolled away from cannot take it from the queue, but an admin's link still works (check his exact rule); Discord linked and not suspended required, as for accept.

**Money differs from his version on purpose:** his cancellations credited a Duoly wallet. Ours never charge before acceptance (Stripe authorises, captures on accept, releases the hold on cancel/expiry). Keep ours. Admin cancel of a queued order = release the authorisation. Admin refund of an accepted or completed order = Stripe refund (full; partial only if his screen had it), recorded on the order and in the admin audit log, idempotent (Stripe idempotency key), handled through the existing Stripe code in `src/server/` (find the payments/stripe module and the webhook handler; refunds must also be reflected if they arrive via webhook). Refunds are meant to be the exception: require a reason and a confirm step, as his UI does.

## Build

- New migration version `20261024170000` (first confirm no collision: `ls supabase/migrations` in every `~/Desktop/Duoly/duoly-*` worktree and `select max(version) from supabase_migrations.schema_migrations` on linked project omnejesspybaxuacjlah). Never edit applied migrations; `create or replace` existing functions with minimal diffs. Admin-only RPCs via `admin_caller()` and audited with `admin_log`.
  SQL tests run in the `sql-tests` GitHub Actions job against a disposable local database; never run them against the hosted project.
- Stripe: use test-mode keys only for anything you run; unit-test the refund path with a mocked Stripe client. Never call live Stripe.
- API routes following existing patterns (`src/server/orders/handlers.ts`, `src/server/admin/handlers.ts`, strict zod contracts, CSRF). `/claim/[token]` page with his Claim screen.

## Verify

`eslint .`, `astro check` (0 errors), `vitest run`, `corepack pnpm test:e2e` (all four configs; no dev server running: check `lsof -i :4321`, the process is `astro.mjs dev`; a chat test is occasionally flaky, rerun once). Stop after the rollback SQL test and checks are green. Commit, push, open a DRAFT PR to Duolygg/duoly, update ledger #17 and #20 in the same PR. Never print or commit secrets. Owner style for user-facing text: no em or en dashes, no ampersands, no "not X but Y".

Final answer: PR URL, migration file name, rules each RPC enforces (with original file:line), how refunds flow end to end, test numbers, open points.
