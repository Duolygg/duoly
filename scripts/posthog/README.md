# Duoly PostHog analysis layer

EU project **329587**, actual no-card Free plan. No billing, subscriptions,
paid correlation, group analytics, destinations or Replay Vision monitor are enabled.
Existing starter dashboard and internal-user cohort are untouched.

## Run

Requires Node **24.21.0** (native TypeScript stripping reads the checked-in
catalogue), no new dependencies. Run from the repo root, **one process at a time**:

```sh
export PATH="$HOME/.hermes/tools/node-v24.21.0-darwin-arm64/bin:$PATH"
node scripts/posthog/apply.mjs                 # default dry-run; read-only API calls
node scripts/posthog/apply.mjs --dry-run       # explicit read-only plan
node scripts/posthog/apply.mjs --apply         # upsert, then read every object back
node scripts/posthog/apply.mjs --apply --verify-queries # also execute every insight
corepack pnpm exec vitest run tests/unit/posthog-insights-script.test.ts
```

The personal key is read at runtime from macOS Keychain service
`duoly-posthog-personal-api-key`; `POSTHOG_PERSONAL_API_KEY` is the fallback for
non-macOS/CI. Never pass it on the command line or save it to a file. The public
project token is not needed. Credentials and owner identity are never included in
reports. Email alert subscriptions resolve the authenticated owner via
`/api/users/@me/` and send only the user ID to the alerts API.

`plan.mjs` exports the pure `buildPlan()`. `lib.mjs` pins the EU API, paginates
lists, retries network errors/429/5xx (including Retry-After seconds or date),
recovers potentially accepted POSTs by name before retrying, and verifies desired
fields after every write. Names carry `[duoly]`; insights additionally have stable
keys such as `02-full`, so a title update retains the same ID. Duplicate keys fail
closed. Updates are in place; nothing is deleted. Tag order and native query
visualization wrappers are normalized for comparison. Do not run concurrent
provisioners: name-based APIs do not expose a cross-process transaction lock.

The script prints the dry-run plan and saves sanitized `last-dry-run.json` or
`last-apply.json`. `provisioned.json` preserves initial settings changes and the
verified inventory from the deployment. It is a snapshot, not a credential store.
The latest apply report is the idempotence evidence; resumed provisioning passes
were needed to accommodate server normalization, and are not described as a
single atomic deployment.

## What is configured

- Eight private dashboards with native trends, funnels, paths, retention,
  lifecycle, stickiness and Web Analytics goal overviews, plus HogQL for custom
  calculations. Every saved insight was executed successfully through `/query/`.
- All browser/server/outbox catalogue events and the SDK/AI event definitions are
  described, tagged by area and verified. Real, observed event/person property
  definitions are also documented and verified. Missing property definitions are
  deferred because REST has no create route; rerun after actual ingestion. No
  synthetic events were captured to manufacture definitions.
- Four dynamic cohorts (365-day funded/repeat windows, 24-hour person-level
  checkout drop-off, teammates), and a semantic funded-order action. Customer
  cohorts use project internal filters. Teammates intentionally do not: all
  teammate accounts are marked internal by the application.
- Two **draft** single-question surveys, 100 lifetime responses each, once per
  person with a seven-day cross-survey wait. Combined target 200 responses is
  below the 1,500/month organization allowance, but other surveys share that cap
  and threshold enforcement can overshoot. Drafts do not collect responses.
- Five enabled hourly alerts subscribed to the owner account, with AI
  investigations explicitly off: checkout failures >5/rolling hour, queue
  expiries >3/rolling day, zero outbox facts/6h, zero pageviews/24h, zero funded
  orders/3 days. The first is an absolute spike proxy, not a trained anomaly
  detector. Zero-business-activity alerts can fire immediately with sparse data.

## Project settings (verified before -> after)

| Setting                              | Before               | After                                                                      |
| ------------------------------------ | -------------------- | -------------------------------------------------------------------------- |
| Timezone                             | UTC                  | Europe/Vienna                                                              |
| App URLs                             | `[]`                 | `["https://duoly.gg"]`                                                     |
| Dead clicks                          | false                | true                                                                       |
| Surveys opt-in                       | null                 | true                                                                       |
| Default internal/test filter enabled | null                 | true                                                                       |
| Test filters                         | not-in cohort 304906 | exclude person `$internal_or_test_user=true` **and** event `internal=true` |
| Heatmap allowlist                    | empty                | `https://duoly.gg/`, `https://duoly.gg/games/*`, `https://duoly.gg/pro`    |

Exception autocapture, web vitals and heatmaps were already on and remain on.
`anonymize_ips=true` and `cookieless_server_hash_mode=1` were read and preserved.
Every recording/replay setting (including console/network/performance recording
settings) was compared before/after and left untouched. The heatmap API reports a
three-entry cap, `can_capture_all_urls=false` and `enforcement_enabled=false`:
the allowlist is saved, but the server-enforcement rollout is not writable here.
No screenshot cookie, screenshot secret or recording domain was changed.

## Interpretation and deliberate limitations

- **Booking events:** all nine spec steps exist in the current catalogue, so no
  invented or substituted funnel names. Full journey is the card branch:
  `payment_submitted` has `kind=order`; wallet/free checkouts can skip it. A
  separate checkout-to-funded funnel covers all methods, with a one-day window.
  Drop-off persons and eligible replays are accessed from native funnel step
  controls. The paths chart excludes sessions with funding in its 30-day window.
- **Identity:** personless outbox facts count in money/activity totals but cannot
  support reliable cross-event identity conversion or retention. First/repeat
  means first **observed since tracking began**, not lifetime. The first/repeat
  session conversion query requires a session ID, funding after checkout and
  within 24h. No past history is invented. Cohort retention/lifecycle/stickiness
  need real traffic and history before they support conclusions.
- **Liquidity:** wait p50 uses native `median`, p90 uses native `p90` on
  `order_matched.wait_seconds`. Expiry share is expired/(matched+expired)
  **outcome events**, not an exact per-order probability; rerolls can match
  again. Offer passes per funded order is an aggregate event ratio because
  private order IDs are deliberately absent. The online-supply chart includes
  teammate persons despite their internal flag, but excludes `internal=true`
  owner/test events; otherwise every teammate would disappear.
- **North star:** funded EUR is gross booking value, not net platform revenue.
  PRO active is latest observed consented state, not a complete historical
  subscription ledger. Exact partial refunds and historical baselines are not
  available. Supabase remains authoritative.
- **Quality:** tip, Trustpilot and rebook rates are explicitly labeled aggregate
  event ratios. Events spanning dates or repeated clicks can exceed 100%; these
  are not causal, deduplicated order conversions.
- **Sparky:** token counts are actual provider usage. Cost uses PostHog's
  token/model-derived `$ai_total_cost_usd`; missing cost is unknown, never free.
  Verify the model pricing in LLM Analytics before financial interpretation.
  No hardcoded guessed token price, prompt or response content is added.
- **Outbox:** no `analytics_outbox_heartbeat` event is produced by this repo.
  Health counts all `source=outbox` facts by hour and a rolling six-hour count.
  This detects silence, **not** backlog or scheduler liveness. An idle healthy
  marketplace can alert; a proper scheduler/backlog heartbeat needs a future
  instrumentation change, which is out of this branch's scope. Both outbox-zero
  and funding-zero alerts were already firing in sparse launch data on read-back.

## API/Free-plan limitations and owner next steps

1. **Property definitions:** 75 desired property definitions were not yet
   observed at apply time. Management REST supports GET/PATCH but no POST for
   property definitions. All intended descriptions/types live in `plan.mjs`.
   Rerun after real events arrive; do not inject test marketplace events.
2. **Web Analytics goals:** both `user_signed_up` and `order_funded` are persisted
   in native `WebOverviewQuery.conversionGoal` insights on Acquisition. The
   standalone Web Analytics goal selector is per-view, not a global goal-list
   REST resource; select either event there manually when using that UI. This
   does not enable Marketing Analytics or a paid product.
3. **Survey A:** REST event targeting is positive OR triggers and cannot express
   "checkout_started AND NOT order_funded in the same session". It remains
   draft with the real checkout trigger and the requested question plus Other.
   `checkout_abandon_detected` exists in the contract but is deliberately **not
   emitted**, so using it would silently create a dead survey. The person-level
   24h cohort is not falsely claimed as session targeting.
4. **Survey B:** `review_confirmation_shown` exists, so the exact event and 0-10
   NPS-style scale are used. It remains draft because site
   `src/client/analytics/config.ts` has **`disable_surveys: true`**. Site code is
   unchanged. Enabling consent-safe rendering requires a separately approved
   site change; do not launch either draft expecting it to display now.
5. **Replay Vision and Discord:** deliberately not created. Owner can later
   choose a consent-eligible replay scanner (masked areas unknown, no billing,
   within 2,500 Replay Vision credits/month) and private Discord destinations.
   Neither a secret webhook nor an external delivery was configured. Paid funnel
   correlation and group analytics are excluded; use the existing free funnel
   breakdowns, paths, persons and replays instead.
6. **Heatmap enforcement:** inspect the three saved entries in the in-app viewer;
   server enforcement is reported false and cannot be toggled by this settings
   schema. Do not change frame headers or replay settings to work around it.

## Verification

Latest unchanged re-run: **0 creates, 0 updates, 160 unchanged objects**, each
read back by its exact ID; all eight dashboard memberships checked for missing
or duplicate tiles. **51/51 insight queries executed successfully**, including
both Web Analytics goal queries. The five alert configurations and owner user-ID
subscription were verified without storing the owner identity. Four cohorts
calculated without errors. No public sharing was enabled.

Node 24.21.0: **check, lint, format:check, test:unit and build all pass**.
Unit suite: **131 files / 1,899 tests passed**, including ten provisioner tests.
No browser/site code changed, so browser E2E was not run for this analysis-only branch.
The inherited main commit unexpectedly had two `existsSync` imports in
`analytics-consent-sync.test.ts`; the redundant import was removed to restore
parsing. No application code or protected file was modified.

## Verified object inventory

Object counts: 80 event_definitions, 9 property_definitions, 1 actions, 4 cohorts, 8 dashboards, 51 insights, 2 surveys, 5 alerts.

| Type                 | Name                                                                         | ID                                     | URL                                                                                                           |
| -------------------- | ---------------------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| event_definitions    | game_viewed                                                                  | `01a1aaeb-beb8-0000-afd4-0dab364fec49` | [Open](https://eu.posthog.com/project/329587/data-management/events/01a1aaeb-beb8-0000-afd4-0dab364fec49)     |
| event_definitions    | cta_clicked                                                                  | `01a1aaec-9824-0000-23fb-a5b66d1e405d` | [Open](https://eu.posthog.com/project/329587/data-management/events/01a1aaec-9824-0000-23fb-a5b66d1e405d)     |
| event_definitions    | game_selected                                                                | `01a1aaec-9917-0000-dd0f-c6e61fad6461` | [Open](https://eu.posthog.com/project/329587/data-management/events/01a1aaec-9917-0000-dd0f-c6e61fad6461)     |
| event_definitions    | service_selected                                                             | `01a1aaec-9a51-0000-af84-97117df45e45` | [Open](https://eu.posthog.com/project/329587/data-management/events/01a1aaec-9a51-0000-af84-97117df45e45)     |
| event_definitions    | booking_option_changed                                                       | `01a1aaec-9c52-0000-0da2-be2dd44ec5a1` | [Open](https://eu.posthog.com/project/329587/data-management/events/01a1aaec-9c52-0000-0da2-be2dd44ec5a1)     |
| event_definitions    | wallet_toggled                                                               | `01a1aaec-9d54-0000-214e-db64fa3163b5` | [Open](https://eu.posthog.com/project/329587/data-management/events/01a1aaec-9d54-0000-214e-db64fa3163b5)     |
| event_definitions    | perk_toggled                                                                 | `01a1aaec-9e51-0000-3aff-9a2cfdfaae71` | [Open](https://eu.posthog.com/project/329587/data-management/events/01a1aaec-9e51-0000-3aff-9a2cfdfaae71)     |
| event_definitions    | teammate_pick_changed                                                        | `01a1aaec-9f31-0000-c8b4-06df04b83fff` | [Open](https://eu.posthog.com/project/329587/data-management/events/01a1aaec-9f31-0000-c8b4-06df04b83fff)     |
| event_definitions    | checkout_login_required                                                      | `01a1aaec-a05b-0000-c53b-8dd1de33df9d` | [Open](https://eu.posthog.com/project/329587/data-management/events/01a1aaec-a05b-0000-c53b-8dd1de33df9d)     |
| event_definitions    | booking_confirm_opened                                                       | `01a1aaec-a12d-0000-08fb-f34ce9bc55c8` | [Open](https://eu.posthog.com/project/329587/data-management/events/01a1aaec-a12d-0000-08fb-f34ce9bc55c8)     |
| event_definitions    | checkout_started                                                             | `01a1aaec-a24f-0000-b6e2-333ba52b9abf` | [Open](https://eu.posthog.com/project/329587/data-management/events/01a1aaec-a24f-0000-b6e2-333ba52b9abf)     |
| event_definitions    | checkout_resumed                                                             | `01a1aaec-a322-0000-6874-da4334066b5d` | [Open](https://eu.posthog.com/project/329587/data-management/events/01a1aaec-a322-0000-6874-da4334066b5d)     |
| event_definitions    | checkout_failed                                                              | `01a1aaec-a418-0000-f88c-b194cf93a4f9` | [Open](https://eu.posthog.com/project/329587/data-management/events/01a1aaec-a418-0000-f88c-b194cf93a4f9)     |
| event_definitions    | payment_form_ready                                                           | `01a1aaec-a57a-0000-a3e4-72146e083374` | [Open](https://eu.posthog.com/project/329587/data-management/events/01a1aaec-a57a-0000-a3e4-72146e083374)     |
| event_definitions    | payment_submitted                                                            | `01a1aaec-a680-0000-5c6c-6d197c7f0142` | [Open](https://eu.posthog.com/project/329587/data-management/events/01a1aaec-a680-0000-5c6c-6d197c7f0142)     |
| event_definitions    | payment_confirm_failed                                                       | `01a1aaec-a748-0000-a8e5-90955193f1cb` | [Open](https://eu.posthog.com/project/329587/data-management/events/01a1aaec-a748-0000-a8e5-90955193f1cb)     |
| event_definitions    | checkout_returned                                                            | `01a1aaec-a835-0000-4990-7f6988ce6833` | [Open](https://eu.posthog.com/project/329587/data-management/events/01a1aaec-a835-0000-4990-7f6988ce6833)     |
| event_definitions    | checkout_abandon_detected                                                    | `01a1aaec-a8f3-0000-f65a-e9ab6f245b77` | [Open](https://eu.posthog.com/project/329587/data-management/events/01a1aaec-a8f3-0000-f65a-e9ab6f245b77)     |
| event_definitions    | review_confirmation_shown                                                    | `01a1aaec-a9b1-0000-6698-a42eb19df54d` | [Open](https://eu.posthog.com/project/329587/data-management/events/01a1aaec-a9b1-0000-6698-a42eb19df54d)     |
| event_definitions    | tip_started                                                                  | `01a1aaec-aa81-0000-dfb4-8231207c203e` | [Open](https://eu.posthog.com/project/329587/data-management/events/01a1aaec-aa81-0000-dfb4-8231207c203e)     |
| event_definitions    | trustpilot_clicked                                                           | `01a1aaec-ab40-0000-cef6-b685ba302d24` | [Open](https://eu.posthog.com/project/329587/data-management/events/01a1aaec-ab40-0000-cef6-b685ba302d24)     |
| event_definitions    | rebook_clicked                                                               | `01a1aaec-ac4f-0000-3648-e656609e196b` | [Open](https://eu.posthog.com/project/329587/data-management/events/01a1aaec-ac4f-0000-3648-e656609e196b)     |
| event_definitions    | queue_room_viewed                                                            | `01a1aaec-ad10-0000-6f52-53b4c462e464` | [Open](https://eu.posthog.com/project/329587/data-management/events/01a1aaec-ad10-0000-6f52-53b4c462e464)     |
| event_definitions    | match_seen                                                                   | `01a1aaec-aeae-0000-8431-5df1cdc91aa3` | [Open](https://eu.posthog.com/project/329587/data-management/events/01a1aaec-aeae-0000-8431-5df1cdc91aa3)     |
| event_definitions    | login_started                                                                | `01a1aaec-af6b-0000-f860-ac6daf8718c3` | [Open](https://eu.posthog.com/project/329587/data-management/events/01a1aaec-af6b-0000-f860-ac6daf8718c3)     |
| event_definitions    | pro_viewed                                                                   | `01a1aaec-b065-0000-2ba0-4f45a21154ab` | [Open](https://eu.posthog.com/project/329587/data-management/events/01a1aaec-b065-0000-2ba0-4f45a21154ab)     |
| event_definitions    | pro_checkout_started                                                         | `01a1aaec-b133-0000-fc0d-cda667e42937` | [Open](https://eu.posthog.com/project/329587/data-management/events/01a1aaec-b133-0000-fc0d-cda667e42937)     |
| event_definitions    | pro_portal_opened                                                            | `01a1aaec-b1f1-0000-689a-c7f74ed5aff7` | [Open](https://eu.posthog.com/project/329587/data-management/events/01a1aaec-b1f1-0000-689a-c7f74ed5aff7)     |
| event_definitions    | support_opened                                                               | `01a1aaec-b2b5-0000-d4a3-475ebac174a7` | [Open](https://eu.posthog.com/project/329587/data-management/events/01a1aaec-b2b5-0000-d4a3-475ebac174a7)     |
| event_definitions    | support_message_sent                                                         | `01a1aaec-b381-0000-7bda-1a98703517f3` | [Open](https://eu.posthog.com/project/329587/data-management/events/01a1aaec-b381-0000-7bda-1a98703517f3)     |
| event_definitions    | creator_link_landed                                                          | `01a1aaec-b47b-0000-5570-0f2bffd87a6e` | [Open](https://eu.posthog.com/project/329587/data-management/events/01a1aaec-b47b-0000-5570-0f2bffd87a6e)     |
| event_definitions    | review_submitted                                                             | `01a1aaec-b53c-0000-1a36-1d6c36cc9d86` | [Open](https://eu.posthog.com/project/329587/data-management/events/01a1aaec-b53c-0000-1a36-1d6c36cc9d86)     |
| event_definitions    | user_logged_in                                                               | `01a1aaec-b5fc-0000-0760-55951b1b36fa` | [Open](https://eu.posthog.com/project/329587/data-management/events/01a1aaec-b5fc-0000-0760-55951b1b36fa)     |
| event_definitions    | discord_linked                                                               | `01a1aaec-b6e8-0000-1e86-6a25de580cfd` | [Open](https://eu.posthog.com/project/329587/data-management/events/01a1aaec-b6e8-0000-1e86-6a25de580cfd)     |
| event_definitions    | discord_unlinked                                                             | `01a1aaec-b7b3-0000-f575-9e5595cc45c6` | [Open](https://eu.posthog.com/project/329587/data-management/events/01a1aaec-b7b3-0000-f575-9e5595cc45c6)     |
| event_definitions    | password_reset_requested                                                     | `01a1aaec-b895-0000-9116-eecbfdbbd91a` | [Open](https://eu.posthog.com/project/329587/data-management/events/01a1aaec-b895-0000-9116-eecbfdbbd91a)     |
| event_definitions    | teammate_applied                                                             | `01a1aaec-b967-0000-7398-e42449be1db5` | [Open](https://eu.posthog.com/project/329587/data-management/events/01a1aaec-b967-0000-7398-e42449be1db5)     |
| event_definitions    | order_offer_passed                                                           | `01a1aaec-ba29-0000-fc1d-49bf594c1be8` | [Open](https://eu.posthog.com/project/329587/data-management/events/01a1aaec-ba29-0000-fc1d-49bf594c1be8)     |
| event_definitions    | handover_created                                                             | `01a1aaec-baf1-0000-7cc4-8060b2d21878` | [Open](https://eu.posthog.com/project/329587/data-management/events/01a1aaec-baf1-0000-7cc4-8060b2d21878)     |
| event_definitions    | streaming_availability_saved                                                 | `01a1aaec-bbb4-0000-f0f1-955bd6ec802b` | [Open](https://eu.posthog.com/project/329587/data-management/events/01a1aaec-bbb4-0000-f0f1-955bd6ec802b)     |
| event_definitions    | payout_setup_completed                                                       | `01a1aaec-bcad-0000-6985-a4ef0907ae87` | [Open](https://eu.posthog.com/project/329587/data-management/events/01a1aaec-bcad-0000-6985-a4ef0907ae87)     |
| event_definitions    | support_handoff_requested                                                    | `01a1aaec-bd6e-0000-dc70-2d0b9b8d7b6c` | [Open](https://eu.posthog.com/project/329587/data-management/events/01a1aaec-bd6e-0000-dc70-2d0b9b8d7b6c)     |
| event_definitions    | user_signed_up                                                               | `01a1aad7-3722-73c1-b88d-3a8c515fcf0e` | [Open](https://eu.posthog.com/project/329587/data-management/events/01a1aad7-3722-73c1-b88d-3a8c515fcf0e)     |
| event_definitions    | order_funded                                                                 | `01a1aaec-bf00-0000-58a2-9d95dc1e74bb` | [Open](https://eu.posthog.com/project/329587/data-management/events/01a1aaec-bf00-0000-58a2-9d95dc1e74bb)     |
| event_definitions    | payment_captured                                                             | `01a1aaec-bfc5-0000-fff1-807527651c9c` | [Open](https://eu.posthog.com/project/329587/data-management/events/01a1aaec-bfc5-0000-fff1-807527651c9c)     |
| event_definitions    | authorization_voided                                                         | `01a1aaec-c0cb-0000-6c39-790dc674a851` | [Open](https://eu.posthog.com/project/329587/data-management/events/01a1aaec-c0cb-0000-6c39-790dc674a851)     |
| event_definitions    | order_refunded                                                               | `01a1aaec-c187-0000-01c3-bed5c0d2d832` | [Open](https://eu.posthog.com/project/329587/data-management/events/01a1aaec-c187-0000-01c3-bed5c0d2d832)     |
| event_definitions    | checkout_expired                                                             | `01a1aaec-c29a-0000-9f85-5f2f035d04d3` | [Open](https://eu.posthog.com/project/329587/data-management/events/01a1aaec-c29a-0000-9f85-5f2f035d04d3)     |
| event_definitions    | checkout_failed_server                                                       | `01a1aaec-c35f-0000-37c7-3aa439eee278` | [Open](https://eu.posthog.com/project/329587/data-management/events/01a1aaec-c35f-0000-37c7-3aa439eee278)     |
| event_definitions    | order_matched                                                                | `01a1aaec-c41d-0000-2ed2-fa4007a89462` | [Open](https://eu.posthog.com/project/329587/data-management/events/01a1aaec-c41d-0000-2ed2-fa4007a89462)     |
| event_definitions    | order_expired                                                                | `01a1aaec-c58a-0000-77a9-33af4c66fd29` | [Open](https://eu.posthog.com/project/329587/data-management/events/01a1aaec-c58a-0000-77a9-33af4c66fd29)     |
| event_definitions    | order_cancelled                                                              | `01a1aaec-c6f0-0000-d0e2-fb8bbf0fb5ee` | [Open](https://eu.posthog.com/project/329587/data-management/events/01a1aaec-c6f0-0000-d0e2-fb8bbf0fb5ee)     |
| event_definitions    | order_rerolled                                                               | `01a1aaec-c7cd-0000-cb1a-b89f2ca03dbc` | [Open](https://eu.posthog.com/project/329587/data-management/events/01a1aaec-c7cd-0000-cb1a-b89f2ca03dbc)     |
| event_definitions    | handover_accepted                                                            | `01a1aaec-c895-0000-4127-7fa5ec3d9236` | [Open](https://eu.posthog.com/project/329587/data-management/events/01a1aaec-c895-0000-4127-7fa5ec3d9236)     |
| event_definitions    | order_completed                                                              | `01a1aaec-c950-0000-f717-16ea5e5778df` | [Open](https://eu.posthog.com/project/329587/data-management/events/01a1aaec-c950-0000-f717-16ea5e5778df)     |
| event_definitions    | order_results_corrected                                                      | `01a1aaec-ca14-0000-46b0-acddd4d8aedb` | [Open](https://eu.posthog.com/project/329587/data-management/events/01a1aaec-ca14-0000-46b0-acddd4d8aedb)     |
| event_definitions    | match_report_saved                                                           | `01a1aaec-cb27-0000-3b60-552bb2225689` | [Open](https://eu.posthog.com/project/329587/data-management/events/01a1aaec-cb27-0000-3b60-552bb2225689)     |
| event_definitions    | desk_online_changed                                                          | `01a1aaec-cc0c-0000-ab9f-b8bab7ce5942` | [Open](https://eu.posthog.com/project/329587/data-management/events/01a1aaec-cc0c-0000-ab9f-b8bab7ce5942)     |
| event_definitions    | tip_paid                                                                     | `01a1aaec-cd14-0000-5b27-e911f75b2085` | [Open](https://eu.posthog.com/project/329587/data-management/events/01a1aaec-cd14-0000-5b27-e911f75b2085)     |
| event_definitions    | pro_trial_started                                                            | `01a1aaec-cdd0-0000-e49f-bd7e67b57c3e` | [Open](https://eu.posthog.com/project/329587/data-management/events/01a1aaec-cdd0-0000-e49f-bd7e67b57c3e)     |
| event_definitions    | pro_activated                                                                | `01a1aaec-ce8f-0000-9fb1-d83da65bb0dc` | [Open](https://eu.posthog.com/project/329587/data-management/events/01a1aaec-ce8f-0000-9fb1-d83da65bb0dc)     |
| event_definitions    | pro_paused                                                                   | `01a1aaec-cf6e-0000-dc97-b7c90079156f` | [Open](https://eu.posthog.com/project/329587/data-management/events/01a1aaec-cf6e-0000-dc97-b7c90079156f)     |
| event_definitions    | pro_resumed                                                                  | `01a1aaec-d353-0000-aac1-211daf24819e` | [Open](https://eu.posthog.com/project/329587/data-management/events/01a1aaec-d353-0000-aac1-211daf24819e)     |
| event_definitions    | pro_ended                                                                    | `01a1aaec-d411-0000-20fb-33120fd8bbd9` | [Open](https://eu.posthog.com/project/329587/data-management/events/01a1aaec-d411-0000-20fb-33120fd8bbd9)     |
| event_definitions    | pro_cancel_scheduled                                                         | `01a1aaec-d4d0-0000-57f2-ebba8685a521` | [Open](https://eu.posthog.com/project/329587/data-management/events/01a1aaec-d4d0-0000-57f2-ebba8685a521)     |
| event_definitions    | pro_cancel_undone                                                            | `01a1aaec-d59d-0000-3254-25b52c86da16` | [Open](https://eu.posthog.com/project/329587/data-management/events/01a1aaec-d59d-0000-3254-25b52c86da16)     |
| event_definitions    | pro_invoice_paid                                                             | `01a1aaec-d695-0000-d1ee-ab1d54ef2911` | [Open](https://eu.posthog.com/project/329587/data-management/events/01a1aaec-d695-0000-d1ee-ab1d54ef2911)     |
| event_definitions    | pro_invoice_failed                                                           | `01a1aaec-d79e-0000-98ce-e01c41213db1` | [Open](https://eu.posthog.com/project/329587/data-management/events/01a1aaec-d79e-0000-98ce-e01c41213db1)     |
| event_definitions    | teammate_approved                                                            | `01a1aaec-d85e-0000-9d69-02638580d0be` | [Open](https://eu.posthog.com/project/329587/data-management/events/01a1aaec-d85e-0000-9d69-02638580d0be)     |
| event_definitions    | payout_sent                                                                  | `01a1aaec-d95f-0000-6caf-b936566449a7` | [Open](https://eu.posthog.com/project/329587/data-management/events/01a1aaec-d95f-0000-6caf-b936566449a7)     |
| event_definitions    | payout_reversed                                                              | `01a1aaec-da26-0000-08d3-79887e7f5924` | [Open](https://eu.posthog.com/project/329587/data-management/events/01a1aaec-da26-0000-08d3-79887e7f5924)     |
| event_definitions    | $pageview                                                                    | `01a1a8c9-7020-7733-9097-300f5d9d881e` | [Open](https://eu.posthog.com/project/329587/data-management/events/01a1a8c9-7020-7733-9097-300f5d9d881e)     |
| event_definitions    | $pageleave                                                                   | `01a1a8c9-f947-7e43-ad49-412e04616094` | [Open](https://eu.posthog.com/project/329587/data-management/events/01a1a8c9-f947-7e43-ad49-412e04616094)     |
| event_definitions    | $autocapture                                                                 | `01a1aaec-dca8-0000-31e2-08ea0ac233ba` | [Open](https://eu.posthog.com/project/329587/data-management/events/01a1aaec-dca8-0000-31e2-08ea0ac233ba)     |
| event_definitions    | $exception                                                                   | `01a1aaec-ddaf-0000-264c-585454e53667` | [Open](https://eu.posthog.com/project/329587/data-management/events/01a1aaec-ddaf-0000-264c-585454e53667)     |
| event_definitions    | $web_vitals                                                                  | `01a1a8c9-6e93-78b3-812d-b9790aa005df` | [Open](https://eu.posthog.com/project/329587/data-management/events/01a1a8c9-6e93-78b3-812d-b9790aa005df)     |
| event_definitions    | $rageclick                                                                   | `01a1aaec-df84-0000-a4de-3f5e87eb1ecc` | [Open](https://eu.posthog.com/project/329587/data-management/events/01a1aaec-df84-0000-a4de-3f5e87eb1ecc)     |
| event_definitions    | $dead_click                                                                  | `01a1aaec-e048-0000-8a8c-7abcf69e2259` | [Open](https://eu.posthog.com/project/329587/data-management/events/01a1aaec-e048-0000-8a8c-7abcf69e2259)     |
| event_definitions    | $ai_generation                                                               | `01a1aaec-e119-0000-86b5-3830c917ebf5` | [Open](https://eu.posthog.com/project/329587/data-management/events/01a1aaec-e119-0000-86b5-3830c917ebf5)     |
| event_definitions    | $ai_span                                                                     | `01a1aaec-e1dd-0000-abc9-8e46d992967c` | [Open](https://eu.posthog.com/project/329587/data-management/events/01a1aaec-e1dd-0000-abc9-8e46d992967c)     |
| property_definitions | source                                                                       | `01a1aad7-3723-79d2-ae08-90853690d5f2` | [Open](https://eu.posthog.com/project/329587/data-management/properties/01a1aad7-3723-79d2-ae08-90853690d5f2) |
| property_definitions | method                                                                       | `01a1aad7-3723-79d2-ae08-90706e9f404a` | [Open](https://eu.posthog.com/project/329587/data-management/properties/01a1aad7-3723-79d2-ae08-90706e9f404a) |
| property_definitions | route                                                                        | `01a1a8c9-6e95-7e70-a4d0-5c4aa851bcc4` | [Open](https://eu.posthog.com/project/329587/data-management/properties/01a1a8c9-6e95-7e70-a4d0-5c4aa851bcc4) |
| property_definitions | app_release                                                                  | `01a1a8c9-6e95-7e70-a4d0-5c19c416bab8` | [Open](https://eu.posthog.com/project/329587/data-management/properties/01a1a8c9-6e95-7e70-a4d0-5c19c416bab8) |
| property_definitions | viewer_role                                                                  | `01a1a8c9-6e95-7e70-a4d0-5c6f477ce639` | [Open](https://eu.posthog.com/project/329587/data-management/properties/01a1a8c9-6e95-7e70-a4d0-5c6f477ce639) |
| property_definitions | $device_type                                                                 | `01a1a8c9-6e95-7e70-a4d0-556a9f754569` | [Open](https://eu.posthog.com/project/329587/data-management/properties/01a1a8c9-6e95-7e70-a4d0-556a9f754569) |
| property_definitions | $web_vitals_LCP_value                                                        | `01a1a8c9-6e95-7e70-a4d0-5bf73389e91a` | [Open](https://eu.posthog.com/project/329587/data-management/properties/01a1a8c9-6e95-7e70-a4d0-5bf73389e91a) |
| property_definitions | $internal_or_test_user                                                       | `01a1a912-e5b3-7260-810b-6b040e973750` | [Open](https://eu.posthog.com/project/329587/data-management/properties/01a1a912-e5b3-7260-810b-6b040e973750) |
| property_definitions | role                                                                         | `01a1a8c9-700d-7791-bf6c-b09a28600214` | [Open](https://eu.posthog.com/project/329587/data-management/properties/01a1a8c9-700d-7791-bf6c-b09a28600214) |
| actions              | [duoly] Funded order                                                         | `181731`                               | [Open](https://eu.posthog.com/project/329587/data-management/actions/181731)                                  |
| cohorts              | [duoly] Funded customers                                                     | `312035`                               | [Open](https://eu.posthog.com/project/329587/cohorts/312035)                                                  |
| cohorts              | [duoly] Repeat customers (2+ order_funded)                                   | `312036`                               | [Open](https://eu.posthog.com/project/329587/cohorts/312036)                                                  |
| cohorts              | [duoly] Checkout started not funded 24h                                      | `312037`                               | [Open](https://eu.posthog.com/project/329587/cohorts/312037)                                                  |
| cohorts              | [duoly] Teammates                                                            | `312038`                               | [Open](https://eu.posthog.com/project/329587/cohorts/312038)                                                  |
| dashboards           | [duoly] 1. North star                                                        | `1086532`                              | [Open](https://eu.posthog.com/project/329587/dashboard/1086532)                                               |
| dashboards           | [duoly] 2. Booking funnel                                                    | `1086533`                              | [Open](https://eu.posthog.com/project/329587/dashboard/1086533)                                               |
| dashboards           | [duoly] 3. Liquidity                                                         | `1086534`                              | [Open](https://eu.posthog.com/project/329587/dashboard/1086534)                                               |
| dashboards           | [duoly] 4. Acquisition                                                       | `1086535`                              | [Open](https://eu.posthog.com/project/329587/dashboard/1086535)                                               |
| dashboards           | [duoly] 5. Retention                                                         | `1086536`                              | [Open](https://eu.posthog.com/project/329587/dashboard/1086536)                                               |
| dashboards           | [duoly] 6. Quality                                                           | `1086537`                              | [Open](https://eu.posthog.com/project/329587/dashboard/1086537)                                               |
| dashboards           | [duoly] 7. Health                                                            | `1086538`                              | [Open](https://eu.posthog.com/project/329587/dashboard/1086538)                                               |
| dashboards           | [duoly] 8. Sparky                                                            | `1086539`                              | [Open](https://eu.posthog.com/project/329587/dashboard/1086539)                                               |
| insights             | [duoly] 01-funded Funded orders per week                                     | `7121191`                              | [Open](https://eu.posthog.com/project/329587/insights/oCTVdLNI)                                               |
| insights             | [duoly] 01-eur Funded EUR (booking value, not net revenue)                   | `7121222`                              | [Open](https://eu.posthog.com/project/329587/insights/txpFVfQj)                                               |
| insights             | [duoly] 01-repeat New vs repeat identified customers                         | `7121223`                              | [Open](https://eu.posthog.com/project/329587/insights/58JsZQ1i)                                               |
| insights             | [duoly] 01-pro PRO active (observed consented state)                         | `7121228`                              | [Open](https://eu.posthog.com/project/329587/insights/J8BVmKaT)                                               |
| insights             | [duoly] 02-full Full booking journey (card branch)                           | `7121229`                              | [Open](https://eu.posthog.com/project/329587/insights/UCrkOyqP)                                               |
| insights             | [duoly] 02-funding Checkout to funded (all payment methods)                  | `7121230`                              | [Open](https://eu.posthog.com/project/329587/insights/rxn6nsDV)                                               |
| insights             | [duoly] 02-game Booking conversion by game                                   | `7121231`                              | [Open](https://eu.posthog.com/project/329587/insights/vaXiR2u3)                                               |
| insights             | [duoly] 02-device Booking conversion by device                               | `7121232`                              | [Open](https://eu.posthog.com/project/329587/insights/rVKC5gaX)                                               |
| insights             | [duoly] 02-channel Booking conversion by channel                             | `7121233`                              | [Open](https://eu.posthog.com/project/329587/insights/yplHofIt)                                               |
| insights             | [duoly] 02-currency Booking conversion by currency                           | `7121234`                              | [Open](https://eu.posthog.com/project/329587/insights/vqdRU8qk)                                               |
| insights             | [duoly] 02-time Time from checkout to funding                                | `7121235`                              | [Open](https://eu.posthog.com/project/329587/insights/far1ZXf4)                                               |
| insights             | [duoly] 02-paths Paths after checkout, no funding in session                 | `7121236`                              | [Open](https://eu.posthog.com/project/329587/insights/AO8rEAZ2)                                               |
| insights             | [duoly] 03-wait Match wait p50 and p90 seconds                               | `7121259`                              | [Open](https://eu.posthog.com/project/329587/insights/UbS1bD3Y)                                               |
| insights             | [duoly] 03-expiry Queue expiry share by hour and game                        | `7121260`                              | [Open](https://eu.posthog.com/project/329587/insights/B4N3TCpL)                                               |
| insights             | [duoly] 03-online Teammates going online per hour (includes supply)          | `7121261`                              | [Open](https://eu.posthog.com/project/329587/insights/ViQdn3RQ)                                               |
| insights             | [duoly] 03-passes Offer passes per funded order (aggregate proxy)            | `7121262`                              | [Open](https://eu.posthog.com/project/329587/insights/k7eak88S)                                               |
| insights             | [duoly] 04-traffic Visitors by acquisition channel                           | `7121264`                              | [Open](https://eu.posthog.com/project/329587/insights/YeDuqz1q)                                               |
| insights             | [duoly] 04-landing Pageviews by route                                        | `7121265`                              | [Open](https://eu.posthog.com/project/329587/insights/w4dKRxOw)                                               |
| insights             | [duoly] 04-creators Creator link landings                                    | `7121266`                              | [Open](https://eu.posthog.com/project/329587/insights/pYXGDcoF)                                               |
| insights             | [duoly] 04-conversion Landing route to funded conversion                     | `7121267`                              | [Open](https://eu.posthog.com/project/329587/insights/E7PRwSt2)                                               |
| insights             | [duoly] 05-retention Weekly funded customer retention                        | `7121268`                              | [Open](https://eu.posthog.com/project/329587/insights/9t2kMZlT)                                               |
| insights             | [duoly] 05-lifecycle Weekly funded customer lifecycle                        | `7121269`                              | [Open](https://eu.posthog.com/project/329587/insights/uk4kzs8h)                                               |
| insights             | [duoly] 05-stickiness Booking stickiness (active days in 30 days)            | `7121271`                              | [Open](https://eu.posthog.com/project/329587/insights/ckddyGRP)                                               |
| insights             | [duoly] 06-ratings Review rating distribution                                | `7121274`                              | [Open](https://eu.posthog.com/project/329587/insights/R6W4iTNm)                                               |
| insights             | [duoly] 06-tips tips event rate (aggregate)                                  | `7121277`                              | [Open](https://eu.posthog.com/project/329587/insights/dhnlzDat)                                               |
| insights             | [duoly] 06-trustpilot trustpilot event rate (aggregate)                      | `7121278`                              | [Open](https://eu.posthog.com/project/329587/insights/JcU9Hz2D)                                               |
| insights             | [duoly] 06-rebook rebook event rate (aggregate)                              | `7121279`                              | [Open](https://eu.posthog.com/project/329587/insights/a3nkhXBk)                                               |
| insights             | [duoly] 07-exceptions-route Exceptions by route                              | `7121280`                              | [Open](https://eu.posthog.com/project/329587/insights/yEgvitGS)                                               |
| insights             | [duoly] 07-exceptions-release Exceptions by release                          | `7121281`                              | [Open](https://eu.posthog.com/project/329587/insights/jc3RQRTn)                                               |
| insights             | [duoly] 07-failures Checkout failures by reason                              | `7121282`                              | [Open](https://eu.posthog.com/project/329587/insights/VhAJnEtV)                                               |
| insights             | [duoly] 07-vitals LCP p90 by route (milliseconds)                            | `7121283`                              | [Open](https://eu.posthog.com/project/329587/insights/zwU5N3sy)                                               |
| insights             | [duoly] 07-rageclick rageclick by route                                      | `7121284`                              | [Open](https://eu.posthog.com/project/329587/insights/LaY0MfuM)                                               |
| insights             | [duoly] 07-dead_click dead_click by route                                    | `7121285`                              | [Open](https://eu.posthog.com/project/329587/insights/KsQH4bF2)                                               |
| insights             | [duoly] 07-outbox Outbox heartbeat: delivered facts per hour                 | `7121286`                              | [Open](https://eu.posthog.com/project/329587/insights/SP4F703f)                                               |
| insights             | [duoly] 08-generations Sparky generations                                    | `7121288`                              | [Open](https://eu.posthog.com/project/329587/insights/xWEFbB8Y)                                               |
| insights             | [duoly] 08-tokens Sparky actual input, output and cached tokens              | `7121289`                              | [Open](https://eu.posthog.com/project/329587/insights/Xr4ZcqGJ)                                               |
| insights             | [duoly] 08-latency Sparky generation latency p50 and p90                     | `7121290`                              | [Open](https://eu.posthog.com/project/329587/insights/WvZD88cS)                                               |
| insights             | [duoly] 08-cost Sparky token-derived cost USD (PostHog model pricing)        | `7121293`                              | [Open](https://eu.posthog.com/project/329587/insights/AKvq11cd)                                               |
| insights             | [duoly] 08-handoff Handoff requests / generations                            | `7121296`                              | [Open](https://eu.posthog.com/project/329587/insights/1CLbj6cO)                                               |
| insights             | [duoly] 08-tools Generations by executed tool names                          | `7121297`                              | [Open](https://eu.posthog.com/project/329587/insights/omLaMOkf)                                               |
| insights             | [duoly] 02-first-repeat Session funding by first vs repeat observed customer | `7121437`                              | [Open](https://eu.posthog.com/project/329587/insights/dmhFUqWI)                                               |
| insights             | [duoly] 04-web-user_signed_up Web Analytics: user_signed_up conversion goal  | `7121438`                              | [Open](https://eu.posthog.com/project/329587/insights/VU2WJaC3)                                               |
| insights             | [duoly] 04-web-order_funded Web Analytics: order_funded conversion goal      | `7121439`                              | [Open](https://eu.posthog.com/project/329587/insights/qYpbCsh8)                                               |
| insights             | [duoly] 07-vitals-inp INP p90 by route                                       | `7121440`                              | [Open](https://eu.posthog.com/project/329587/insights/aF9OeQrs)                                               |
| insights             | [duoly] 07-vitals-fcp FCP p90 by route                                       | `7121441`                              | [Open](https://eu.posthog.com/project/329587/insights/pRRGLxbH)                                               |
| insights             | [duoly] 07-vitals-cls CLS p90 by route                                       | `7121442`                              | [Open](https://eu.posthog.com/project/329587/insights/BI3ewtMU)                                               |
| insights             | [duoly] 07-alert-checkout-spike Checkout failed spike (>5 in rolling hour)   | `7121298`                              | [Open](https://eu.posthog.com/project/329587/insights/qlPRT05C)                                               |
| insights             | [duoly] 07-alert-expiry-day Order expired (>3 in rolling day)                | `7121300`                              | [Open](https://eu.posthog.com/project/329587/insights/aAYbQlDn)                                               |
| insights             | [duoly] 07-alert-outbox-zero Outbox delivered facts zero for 6h              | `7121301`                              | [Open](https://eu.posthog.com/project/329587/insights/ZFn4X2Db)                                               |
| insights             | [duoly] 07-alert-pageviews-zero Pageviews zero for 24h                       | `7121303`                              | [Open](https://eu.posthog.com/project/329587/insights/X1WT59kV)                                               |
| insights             | [duoly] 07-alert-funding-zero Funded orders zero for 3 days                  | `7121305`                              | [Open](https://eu.posthog.com/project/329587/insights/FMERI0UQ)                                               |
| surveys              | [duoly] Survey A: booking blockers                                           | `01a1aaf1-4a1e-0000-132b-c364ef6867f3` | [Open](https://eu.posthog.com/project/329587/surveys/01a1aaf1-4a1e-0000-132b-c364ef6867f3)                    |
| surveys              | [duoly] Survey B: book again                                                 | `01a1aaf1-4b5d-0000-2e4b-520cc309e0b0` | [Open](https://eu.posthog.com/project/329587/surveys/01a1aaf1-4b5d-0000-2e4b-520cc309e0b0)                    |
| alerts               | [duoly] Checkout failed spike (>5 in rolling hour)                           | `01a1aaf1-4d35-0000-8d9c-55900ff362fe` | [Open](https://eu.posthog.com/api/environments/329587/alerts/01a1aaf1-4d35-0000-8d9c-55900ff362fe/)           |
| alerts               | [duoly] Order expired (>3 in rolling day)                                    | `01a1aaf2-1893-0000-3498-fff895f07325` | [Open](https://eu.posthog.com/api/environments/329587/alerts/01a1aaf2-1893-0000-3498-fff895f07325/)           |
| alerts               | [duoly] Outbox delivered facts zero for 6h                                   | `01a1aaf2-1b77-0000-0064-af0b6e1acadd` | [Open](https://eu.posthog.com/api/environments/329587/alerts/01a1aaf2-1b77-0000-0064-af0b6e1acadd/)           |
| alerts               | [duoly] Pageviews zero for 24h                                               | `01a1aaf2-1d1c-0000-727a-43770ead3e9e` | [Open](https://eu.posthog.com/api/environments/329587/alerts/01a1aaf2-1d1c-0000-727a-43770ead3e9e/)           |
| alerts               | [duoly] Funded orders zero for 3 days                                        | `01a1aaf2-204c-0000-16f1-33c3f4fd1e3d` | [Open](https://eu.posthog.com/api/environments/329587/alerts/01a1aaf2-204c-0000-16f1-33c3f4fd1e3d/)           |
