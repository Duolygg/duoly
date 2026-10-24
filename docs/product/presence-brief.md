# Brief: teammate online switch, presence and new-order bell (ledger #15)

Worktree `~/Desktop/Duoly/duoly-presence`, branch `feat/presence` (from main fbf8717). Work ONLY here. `node_modules` is a symlink to `../duoly/node_modules`. Node: `export PATH=~/.hermes/tools/node-v24.21.0-darwin-arm64/bin:$PATH`; run tools from `node_modules/.bin/` (no npx). Read first: `~/Desktop/Duoly/HANDOFF-original-port.md` (conventions, test procedure, pitfalls) and ledger rows #15, #19, #20, #22, #40 in `docs/product/original-port-ledger.md`.

## Goal

Fabian's teammate dashboard (`src/components/teammate/Teammate.jsx`, already live) has the Online toggle, the "online since" timer, the new-order bell and desktop popup, but `FEATURES.presence` is false, so none of it is real. Make it real on Supabase, so that "online" exists in the database for the admin live desk, the homepage, Sparky, and later the Discord Online role (#40).

## Original behaviour (the checklist)

Original files are fetched in `~/.hermes/cache/scratch/orig-audit/`: `lib/presence.js`, `app/api/desk/route.js`, `app/api/admin/presence/route.js`, `lib/sounds.js`, `components/admin/LiveDesk.jsx`, `app/api/admin/users/route.js`, `app/api/admin/people/route.js`. Read them. Key rules:

- A teammate toggles Online on their desk. While online the desk checks in periodically; presence goes **stale after 20 s** without a check-in (closing the tab = offline soon after; an unload beacon makes it immediate).
- **Discord required to go online** (`desk/route.js:18`). **Suspended teammates can't go online** (`:20-21`). Customers can't.
- **Admins are always online** while the admin panel is open (`presence.js:39`); admin presence is for the support widget/team list, they never get orders.
- Admin "Set offline" for a teammate from the live desk uses **preset reasons** and is **refused while that teammate has an order in progress**.
- Role change away from teammate and suspension **force offline** (`users/route.js:39`, `people/route.js:27`). Wire this into our existing admin role-change and suspend RPCs.
- "Playing" (has an in_progress order) counts as online for display.
- New-order bell and desktop notification fire for orders the teammate is eligible for (their approved games, Gamer Girl rules as in `lib/access.js`), only while online. Our desk already polls/receives the queue; hook the bell to newly appearing eligible orders. The audio file is `/assets/sounds/order-bell.wav` (check it exists in `public/`).

## How to build it

- **Database** (new migration; check `ls supabase/migrations` here AND in other worktrees, and `select max(version) from supabase_migrations.schema_migrations` on the linked project omnejesspybaxuacjlah; pick a version after `20261024141000` that doesn't collide): a `teammate_presence` table (user_id pk, online bool, online_since, last_seen_at, set_offline_reason, set_offline_by), RLS on, no direct client access; security-definer RPCs: `desk_set_online(p_online)` (checks role teammate, Discord linked via `discord_accounts`, not suspended), `desk_check_in()` (updates last_seen_at, returns the desk queue like the current endpoint or just ok; keep it cheap, the Supabase project is on the Free plan), `admin_set_teammate_offline(p_user, p_reason)` (admin only via `admin_caller()`, refuses mid-order, audited via `admin_log`), and a view or function returning who is online now (`last_seen_at > now() - 20s` or has in_progress order). Force offline inside the existing role-change and suspend functions (create or replace them in the new migration with minimal diffs; never edit applied migrations).
- Write a rollback-only SQL test in `supabase/tests/` like `support_sparky_limits.sql` (seed users with fixed UUIDs, `set local role authenticated` plus `request.jwt.claims`, read tables only after `reset role`, end with `rollback`). Run it against the linked project inside a transaction that also contains the migration body, then rollback. Do NOT `db push`; the parent applies migrations after review.
- **Server**: Astro API routes under `src/pages/api/teammate/` (follow existing teammate routes for auth, CSRF via `verifyCsrf`, strict zod bodies). Check-in interval about 10 s; an unload beacon (`navigator.sendBeacon`) to go offline. Admin presence for the admin panel: check-in from the admin shell while open.
- **Client**: flip `FEATURES.presence` in `Teammate.jsx` and connect its existing toggle, timer, bell and popup to the new endpoints with minimal changes to his file (adapter pattern, as in the handoff doc). Keep his copy.
- **Consumers to switch on** where they already have a slot: admin live desk / Teammates roster "Online" filter (ledger #22 says it shows "Playing" until presence exists), the support widget team list (`supportTeam` in `src/server/support/store.ts` currently hardcodes `online: false`; admins with a fresh admin check-in are online), and the homepage "teammates online" figure only if a slot for it already exists (ledger #36; otherwise leave it and note it).
- Not in scope: Discord role sync (#40), priority/penalty (#16), queue settings (#33).

## Verify (required)

`eslint .`, `astro check` (0 errors), `vitest run`, and `corepack pnpm test:e2e` (all four Playwright configs; make sure NO dev server is running: check `lsof -i :4321`, the process shows as `astro.mjs dev`). Unit tests for the adapter mapping and the eligibility check for the bell. Then a real check with a local dev server against the live database (`.env.local` per the handoff doc, `AUTH_ORIGIN=http://localhost:4321` and open the site on `http://localhost:4321`, not 127.0.0.1, or CSRF rejects every write) — but only after the parent has applied your migration; until then stop after the rollback SQL test and report. Delete `.env.local` and stop the dev server at the end.

Commit and push to `feat/presence`, open a DRAFT PR to Duolygg/duoly, update ledger row #15 in the same PR. Never print or commit secrets. Owner style for user-facing text: no em or en dashes, no ampersands, no "not X but Y".

Final answer: PR URL, migration file name, what each RPC enforces, test results (numbers), anything left open.
