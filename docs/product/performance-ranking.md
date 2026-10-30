# Contractor performance ranking

Fabian's request (2026-10-30). Teammates are scored from real orders and reviews, ranked against each
other, and get a bracket shown on their dashboard, in the admin panel and as a Discord role.

## Score

Over a rolling window (default 90 days), for every teammate who is not suspended:

| Metric                | Weight | How it becomes 0 to 100                                                                     |
| --------------------- | ------ | ------------------------------------------------------------------------------------------- |
| Customer retention    | 45%    | Customers with 2+ completed sessions with this teammate, out of all their customers         |
| Customer satisfaction | 35%    | Average review stars, 1 star = 0 and 5 stars = 100                                          |
| Completed orders      | 20%    | Percent rank among eligible teammates (so one very busy teammate does not flatten everyone) |

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
- The sync (`src/server/performance/roles.ts`) finds the five roles by exact name and creates missing
  ones in their colour, then gives each teammate exactly one of them and removes any other
  performance role. No other role is touched. Status per teammate: synced, no Discord, not in
  server, error (with the reason) or sync off. Uses the same switch and bot as the Teammate, Online
  and In Session sync (`DISCORD_ROLE_SYNC_ENABLED`, `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID`).
- The bot needs Manage Roles, and its own role must be above the five performance roles.
- Discord roles never grant anything on the site.

## Where it shows

- **Teammate dashboard**: bracket, overall score, rank, completed orders, satisfaction, retention
  rate, returning customers and progress to the next bracket (`GET /api/teammate/performance`). A
  teammate only sees their own numbers plus the score needed for the next bracket.
- **Admin → Performance**: every teammate with score, rank, bracket, the three metric scores, trend
  since the last run, Discord status, ranking history (last 60 runs), manual recalculation and the
  settings (`/api/admin/performance`).

## Data

Migration `20261030120000_performance_ranking.sql`: `performance_settings` (one row),
`performance_runs` and `performance_scores` (history, one year kept), `performance_discord` (wanted
role and sync status). All calculations are in `performance_recalculate`; nothing is computed in the
browser.

## Deploy order

1. Sebastian applies the migration (it also schedules the cron job).
2. Merge the code. Until then the cron sync call gets a 404 and the ranking still works in the database.
3. With Discord sync on, the first run creates the five roles. Check the bot's role sits above them.
