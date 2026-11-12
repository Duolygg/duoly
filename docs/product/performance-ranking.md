# Contractor performance ranking

Fabian's request (2026-10-30). Teammates are scored from real orders and reviews, ranked against each
other, and get a bracket shown on their dashboard, in the admin panel and as a Discord role.

## Score

Over a rolling window (default 90 days), for every teammate who is not suspended:

| Metric                | Weight | How it becomes 0 to 100                                                                     |
| --------------------- | ------ | ------------------------------------------------------------------------------------------- |
| Winrate               | 40%    | Games won out of games reported in match reports on completed win/loss orders               |
| Customer retention    | 25%    | Customers with 2+ completed sessions with this teammate, out of all their customers         |
| Customer satisfaction | 20%    | Average review stars, 1 star = 0 and 5 stars = 100                                          |
| Completed orders      | 15%    | Percent rank among eligible teammates (so one very busy teammate does not flatten everyone) |

Winrate (owner 2026-11-02, migration 20261102170000) is the biggest factor. It counts from 20 reported
games in the window; below that, or with no win/loss orders at all (Gamer Girl, Social, coaching), it is
left out and the other three weights scale up to 100%. Which orders have match reports:
`WL_GAMES` and `WL_SERVICES` in `src/design-reference/lib/winloss.js`.

Score = weighted sum, 0 to 100. Weights, window and the minimums below are editable in
Admin → Performance (weights must add up to 100).

**Eligibility** (default): at least 10 completed orders, 5 reviews and 3 different customers in the
window. Everyone else is "Not ranked yet" and sees how far they are from each minimum.

## Ranking and brackets

Eligible teammates are ranked by score (completed orders break ties). Percentile = rank / eligible.

| Bracket | Colour    | Discord role             |
| ------- | --------- | ------------------------ |
| TOP 1%  | `#C6A6FF` | `Performance \| TOP 1%`  |
| TOP 5%  | `#9B8AFB` | `Performance \| TOP 5%`  |
| TOP 10% | `#718CEB` | `Performance \| TOP 10%` |
| TOP 25% | `#55A9C9` | `Performance \| TOP 25%` |
| TOP 50% | `#648D91` | `Performance \| TOP 50%` |

The bottom half has no bracket. With few eligible teammates the top brackets are mathematically
out of reach (TOP 1% needs at least 100 ranked teammates, TOP 5% needs 20); the dashboard says so.

## Automation

- pg_cron `duoly-performance-recalc` runs `performance_recalculate('cron')` at 00:00 and 12:00 UTC,
  inside the database, then calls `POST /api/performance/sync` with the roles tick secret.
- "Recalculate now" in Admin → Performance runs the same calculation and the same sync.
- The sync (`src/server/performance/roles.ts`) validates the five explicitly configured canonical IDs
  against the guild before changing member roles. It requires the exact bracket name, permissions
  `0` and `managed=false` for each role. Missing, malformed or duplicate IDs fail closed. No runtime
  role creation, name adoption, renaming or deletion is allowed. Only these IDs are added or removed.
  Status per teammate: synced, no Discord, not in server, error (with the reason) or sync off. Uses
  the same switch and bot as the Teammate, Online and In Session sync (`DISCORD_ROLE_SYNC_ENABLED`,
  `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID`) plus `PERFORMANCE_ROLE_IDS`.
- The bot needs Manage Roles, and its own role must be above the five performance roles.
- Discord roles never grant anything on the site.

## Where it shows

- **Teammate dashboard**: bracket, overall score, rank, completed orders, satisfaction, retention
  rate, returning customers and progress to the next bracket (`GET /api/teammate/performance`). A
  teammate only sees their own numbers plus the score needed for the next bracket.
- **Admin → Performance**: every teammate with score, rank, bracket, the three metric scores, trend
  since the last run, Discord status, ranking history (last 60 runs), manual recalculation and the
  settings (`/api/admin/performance`).

## Read-only admin demo

Open `/admin/performance` as an admin and select **Show demo**. **Back to live**
remounts the live reader and resumes its one-minute refresh. The toggle is also
available while live rankings are loading or unavailable.

`src/components/admin/performance-demo.ts` is imported only by the admin component
(and regression tests). It builds a fixed fictional cohort of 100 eligible
teammates and one ineligible teammate. Seven representative rows cover ranks 1,
5, 10, 25, 50, 75 and the ineligible case. Summary badge counts describe displayed
representatives, not the full cohort. Metric scores use the same two-decimal
rounding, 40/25/20/15 weighting (winrate first), eligible order percent rank and rank/eligible bracket
rules as the database. Sample history includes promotions and demotions.

The preview reuses the live table, filters, metric breakdown, history, badges and
settings components. It disables recalculation, settings inputs and saving. It
makes no performance API requests, including history and automatic refresh.
Switching modes unmounts the old view, so outstanding live answers cannot replace
sample data. Discord status labels explicitly say simulated. The independent
admin-shell presence heartbeat is unchanged. No accounts, database rows, Discord
roles, environment variables or migrations are created or changed.

Coverage: `tests/unit/performance-demo.test.ts` checks the full cohort math and
history consistency. `tests/teammate-browser/performance-demo.spec.ts` checks the
actual admin route in desktop and mobile fixtures, including a failed live API,
all five badges, filters, history, disabled writes, timer isolation, outstanding
live answers and restored live reads and history.

## Data

Migration `20261030120000_performance_ranking.sql`: `performance_settings` (one row),
`performance_runs` and `performance_scores` (history, one year kept), `performance_discord` (wanted
role and sync status). All calculations are in `performance_recalculate`; nothing is computed in the
browser.

## Identity cleanup

Migration `20261030150000_performance_role_identity.sql` adds a private identity ledger. Each linked
identity is reserved before HTTP and successful applications are acknowledged with their original
snapshot. Unlink and relink preserve former IDs as cleanup targets. All former IDs must be cleaned
before a role is assigned to the current identity. A former guild-member 404 completes cleanup;
other failures keep the target for retry on the next sync. Partial cleanup progress is saved in
`cleaned_at`. Retired identities remain in the private ledger and are rechecked on subsequent syncs:
this catches a stale in-flight PUT that finishes after cleanup and crashes before its acknowledgement.
Already-clean members need only an idempotent GET, with no additional role mutations.

Identity-transition generation tokens protect A/B/A relinks. Snapshot version, Discord ID and bracket
must still match before an acknowledgement can update current status. Late successful assignments
are retained for cleanup even after their initial reservation was cleaned. Concurrent syncs use
idempotent member PUT and DELETE operations, not distributed role provisioning. Interrupted network
calls remain recoverable through their pre-HTTP reservation. Recovery occurs on the next manual or
scheduled sync, not synchronously inside the OAuth transaction.

Previously unlinked identities from before this migration cannot be reconstructed from current
links. Operators must inspect any known historical role holders manually. Do not claim the new
ledger automatically repairs pre-existing identities absent from the database.

## Operational setup and deploy order

1. Apply all five PR110 migrations in filename order, including the identity migration, before the
   new server code. It requires the new snapshot response fields. Keep Discord sync off during setup.
2. An operator provisions or explicitly approves five safe zero-permission, unmanaged roles with
   the exact names above. Set the server-only `PERFORMANCE_ROLE_IDS` to a JSON object whose keys
   are `1`, `5`, `10`, `25`, `50` and whose values are five distinct Discord snowflake strings.
3. Verify the bot's role is above all five roles and has Manage Roles. Deploy the code and enable
   `DISCORD_ROLE_SYNC_ENABLED` with the existing bot, guild and tick-secret configuration.
4. Run a manual recalculation and inspect per-teammate status. Invalid config fails closed without
   touching any member roles. Correct the configured IDs or unsafe roles manually before retrying.

Canonical IDs approved by the release operator on 2026-10-30 (production env configured separately):

```json
{
  "1": "1565507645937426492",
  "5": "1565507844198109254",
  "10": "1565507887353176064",
  "25": "1565507887365890078",
  "50": "1565507894974095531"
}
```

Duplicate role names require manual inspection of permissions, hierarchy and current holders. The
runtime deliberately ignores noncanonical duplicates and never adopts, edits or deletes them.
Changing canonical IDs also needs manual inspection and cleanup of the superseded role holders;
the identity ledger tracks people, not a history of configuration changes.

## SQL verification

SQL tests run in the `sql-tests` GitHub Actions job against a disposable local database; never run them against the hosted project.

Historical builders compose earlier migrations and are explicitly excluded from latest-schema acceptance. The manifest runner executes the behavioral suite on the fully migrated disposable database without replaying those old definitions.
