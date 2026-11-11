# SQL test inventory

SQL tests run in the `sql-tests` GitHub Actions job against a disposable local database; never run them against the hosted project.

This is an inventory, not a claim that historical assertions all match the latest schema. Failed suites fail CI, never silently become skips. The rate-limit suite no longer replays its CREATE TABLE migration. Existing builders remain upgrade-only and emit the guard before migration DDL. F13/F14 corrections: explicit groups and skips, loopback client and Docker system identity, marker before fixtures, dynamically branched optional Vault check. `inet_server_addr()` is deliberately not used as a client loopback check.

| File                                    | Category              | Execution | Reason                                                                                                      |
| --------------------------------------- | --------------------- | --------- | ----------------------------------------------------------------------------------------------------------- |
| `account_authorization.sql`             | latest-schema suite   | run       | isolated session; original assertions retained (CI determines compatibility)                                |
| `admin_correct_results.sql`             | latest-schema suite   | run       | isolated session; original assertions retained (CI determines compatibility)                                |
| `admin_customers.sql`                   | latest-schema suite   | run       | isolated session; original assertions retained (CI determines compatibility)                                |
| `admin_foundation.sql`                  | latest-schema suite   | run       | isolated session; original assertions retained (CI determines compatibility)                                |
| `admin_orders.sql`                      | latest-schema suite   | run       | isolated session; original assertions retained (CI determines compatibility)                                |
| `admin_parity.sql`                      | latest-schema suite   | run       | isolated session; original assertions retained (CI determines compatibility)                                |
| `admin_permissions.sql`                 | latest-schema suite   | run       | isolated session; original assertions retained (CI determines compatibility)                                |
| `admin_teammates.sql`                   | latest-schema suite   | run       | isolated session; original assertions retained (CI determines compatibility)                                |
| `build_connect_payouts_rollback.py`     | builder               | skipped   | historical migration-upgrade composer; prepends old definitions, not latest-schema acceptance               |
| `build_gold_priority_rollback.py`       | builder               | skipped   | historical migration-upgrade composer; prepends old definitions, not latest-schema acceptance               |
| `build_loyalty_cashback_rollback.py`    | builder               | skipped   | historical migration-upgrade composer; prepends old definitions, not latest-schema acceptance               |
| `build_order_tips_rollback.py`          | builder               | skipped   | historical migration-upgrade composer; prepends old definitions, not latest-schema acceptance               |
| `build_perks_rollback.py`               | builder               | skipped   | historical migration-upgrade composer; prepends old definitions, not latest-schema acceptance               |
| `build_pr110_rollback.py`               | builder               | skipped   | historical migration-upgrade composer; prepends old definitions, not latest-schema acceptance               |
| `build_trust_deposits_rollback.py`      | builder               | skipped   | historical migration-upgrade composer; prepends old definitions, not latest-schema acceptance               |
| `chat_flag_audit.sql`                   | latest-schema suite   | run       | isolated session; original assertions retained (CI determines compatibility)                                |
| `completion_chat.sql`                   | ordered fixture group | run       | completion group, latest schema; no historical migration replay                                             |
| `completion_constraints.sql`            | ordered fixture group | run       | completion group, latest schema; no historical migration replay                                             |
| `completion_fixture.sql`                | ordered fixture group | run       | completion group, latest schema; no historical migration replay                                             |
| `completion_happy.sql`                  | ordered fixture group | run       | completion group, latest schema; no historical migration replay                                             |
| `completion_history.sql`                | ordered fixture group | run       | completion group, latest schema; no historical migration replay                                             |
| `completion_history_order.sql`          | ordered fixture group | run       | completion group, latest schema; no historical migration replay                                             |
| `completion_immutable.sql`              | ordered fixture group | run       | completion group, latest schema; no historical migration replay                                             |
| `completion_integrity.sql`              | ordered fixture group | run       | completion group, latest schema; no historical migration replay                                             |
| `completion_local.mjs`                  | non-SQL harness       | skipped   | native PostgreSQL multi-session harness; external embedded-postgres dependency, not local Supabase coverage |
| `completion_local_bootstrap.sql`        | bootstrap             | skipped   | native-only bootstrap creates managed roles/schemas; not a Supabase suite                                   |
| `completion_replay.sql`                 | ordered fixture group | run       | completion group, latest schema; no historical migration replay                                             |
| `completion_run.py`                     | non-SQL harness       | skipped   | compatibility entrypoint delegates to manifest runner; not a second suite                                   |
| `completion_security.sql`               | ordered fixture group | run       | completion group, latest schema; no historical migration replay                                             |
| `completion_tier_integration.sql`       | ordered fixture group | run       | completion group, latest schema; no historical migration replay                                             |
| `completion_tiers.sql`                  | ordered fixture group | run       | completion group, latest schema; no historical migration replay                                             |
| `connect_payouts.sql`                   | latest-schema suite   | run       | isolated session; original assertions retained (CI determines compatibility)                                |
| `creator_referrals.sql`                 | latest-schema suite   | run       | isolated session; original assertions retained (CI determines compatibility)                                |
| `discord_links.sql`                     | latest-schema suite   | run       | isolated session; original assertions retained (CI determines compatibility)                                |
| `discord_order_posts.sql`               | latest-schema suite   | run       | isolated session; original assertions retained (CI determines compatibility)                                |
| `discord_role_sync.sql`                 | latest-schema suite   | run       | isolated session; original assertions retained (CI determines compatibility)                                |
| `gated_dispatch.sql`                    | latest-schema suite   | run       | isolated session; original assertions retained (CI determines compatibility)                                |
| `gold_priority_badges.sql`              | latest-schema suite   | run       | isolated session; original assertions retained (CI determines compatibility)                                |
| `handover_admin_actions.sql`            | latest-schema suite   | run       | isolated session; original assertions retained (CI determines compatibility)                                |
| `home_live.sql`                         | latest-schema suite   | run       | isolated session; original assertions retained (CI determines compatibility)                                |
| `home_public_stats.sql`                 | latest-schema suite   | run       | isolated session; original assertions retained (CI determines compatibility)                                |
| `leaderboard.sql`                       | latest-schema suite   | run       | isolated session; original assertions retained (CI determines compatibility)                                |
| `loyalty_cashback.sql`                  | latest-schema suite   | run       | isolated session; original assertions retained (CI determines compatibility)                                |
| `mcp_rate_limits.sql`                   | latest-schema suite   | run       | isolated session; original assertions retained (CI determines compatibility)                                |
| `order_authorization.sql`               | latest-schema suite   | run       | isolated session; original assertions retained (CI determines compatibility)                                |
| `order_chat.sql`                        | latest-schema suite   | run       | isolated session; original assertions retained (CI determines compatibility)                                |
| `order_concurrency.py`                  | non-SQL harness       | skipped   | separate multi-session acceptance runner; legacy remote transport disabled pending local port               |
| `order_deadline.sql`                    | latest-schema suite   | run       | isolated session; original assertions retained (CI determines compatibility)                                |
| `order_moods.sql`                       | latest-schema suite   | run       | isolated session; original assertions retained (CI determines compatibility)                                |
| `order_proofs.sql`                      | latest-schema suite   | run       | isolated session; original assertions retained (CI determines compatibility)                                |
| `order_reports.sql`                     | latest-schema suite   | run       | isolated session; original assertions retained (CI determines compatibility)                                |
| `order_reviews.sql`                     | latest-schema suite   | run       | isolated session; original assertions retained (CI determines compatibility)                                |
| `order_status_tokens.sql`               | latest-schema suite   | run       | isolated session; original assertions retained (CI determines compatibility)                                |
| `order_tips.sql`                        | latest-schema suite   | run       | isolated session; original assertions retained (CI determines compatibility)                                |
| `payout_minimum_25.sql`                 | latest-schema suite   | run       | isolated session; original assertions retained (CI determines compatibility)                                |
| `perks.sql`                             | latest-schema suite   | run       | isolated session; original assertions retained (CI determines compatibility)                                |
| `pr110.sql`                             | latest-schema suite   | run       | isolated session; original assertions retained (CI determines compatibility)                                |
| `presence.sql`                          | latest-schema suite   | run       | isolated session; original assertions retained (CI determines compatibility)                                |
| `presence_afk.sql`                      | latest-schema suite   | run       | isolated session; original assertions retained (CI determines compatibility)                                |
| `priority_admin.sql`                    | latest-schema suite   | run       | isolated session; original assertions retained (CI determines compatibility)                                |
| `pro_subscription.sql`                  | latest-schema suite   | run       | isolated session; original assertions retained (CI determines compatibility)                                |
| `profile_bio_currency.sql`              | latest-schema suite   | run       | isolated session; original assertions retained (CI determines compatibility)                                |
| `proof_http_acceptance.cjs`             | non-SQL harness       | skipped   | HTTP/browser acceptance requires app/provider fixtures; legacy hosted execution disabled                    |
| `proof_http_acceptance.md`              | latest-schema suite   | run       | isolated session; original assertions retained (CI determines compatibility)                                |
| `proof_http_acceptance.safety.test.cjs` | non-SQL harness       | skipped   | offline HTTP runner safety tests, not SQL acceptance                                                        |
| `queue_settings.sql`                    | latest-schema suite   | run       | isolated session; original assertions retained (CI determines compatibility)                                |
| `referral_first_order_discount.sql`     | latest-schema suite   | run       | isolated session; original assertions retained (CI determines compatibility)                                |
| `sparky_presence_read.sql`              | latest-schema suite   | run       | isolated session; original assertions retained (CI determines compatibility)                                |
| `stripe_payments.sql`                   | latest-schema suite   | run       | isolated session; original assertions retained (CI determines compatibility)                                |
| `support_sparky.sql`                    | latest-schema suite   | run       | isolated session; original assertions retained (CI determines compatibility)                                |
| `support_sparky_limits.sql`             | latest-schema suite   | run       | isolated session; original assertions retained (CI determines compatibility)                                |
| `test_order_concurrency.py`             | non-SQL harness       | skipped   | offline Python transport tests, not SQL acceptance                                                          |
| `trust_deposits.sql`                    | latest-schema suite   | run       | isolated session; original assertions retained (CI determines compatibility)                                |
| `twitch_streaming.sql`                  | latest-schema suite   | run       | isolated session; original assertions retained (CI determines compatibility)                                |
| `wallet_checkout.sql`                   | latest-schema suite   | run       | isolated session; original assertions retained (CI determines compatibility)                                |
| `wallet_ledger.sql`                     | latest-schema suite   | run       | isolated session; original assertions retained (CI determines compatibility)                                |
| `weekly_payouts.sql`                    | latest-schema suite   | run       | isolated session; original assertions retained (CI determines compatibility)                                |
