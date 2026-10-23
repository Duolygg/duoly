# Teammate original-screen port

## Scope

`/teammate` now renders Fabian's original Teammate dashboard from the pinned
`duoly-admin/duoly@7f0299f` source. This is a literal source port, not a generated
redesign. The quarantined reference files, APIs, contracts, SQL, and financial
rules are unchanged. Exact-head CI, merge and deployed acceptance are recorded in the integrating PR; earlier implementation checks do not by themselves establish a production booking.

## Original to live mapping

| Original                            | Live wiring                                                                                                                                                                                                       |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `components/Teammate.jsx`           | `src/components/teammate/Teammate.jsx`, original header, status card, queue rows, active order, chat markup, proof section and retained gated sections                                                            |
| Supporting components and libraries | Imports from `../../design-reference/...`, no reference edits                                                                                                                                                     |
| Preview auth                        | `LiveTeammate.tsx`, real viewer props, `/auth/logout` with CSRF                                                                                                                                                   |
| `/api/desk`                         | Instance-scoped `createTeammateFetch`: parallel `/api/teammate/queue` and `/api/teammate/order`, exact strict envelopes                                                                                           |
| Original order display shape        | `toOriginalTeammateOrder`: UUID remains route binding; `publicReference` is display-only; cents become USD; server-projected customer fields only                                                                 |
| Legacy accept command               | Only `{action:'accept'}` maps to `/api/teammate/orders/:UUID/accept` with `{csrf}`. Exact order UUID, `in_progress` and assignment UUID required. Queue and assignment are re-read before opening an active order |
| Original chat look                  | Existing strict `src/client/order-chat.ts` read, send and typing transports; header CSRF; captured assignment; no fake customer replies or optimistic delivered messages                                          |
| Original proof section              | Existing `PrivateProofs` in teammate mode, with original order and assignment UUIDs and CSRF; existing frozen completion and upload machinery                                                                     |
| Discord popup                       | Original popup with real `POST /api/discord/link`, hidden `csrf` and `next=teammate`; unavailable provider honestly disabled                                                                                      |
| Page shell                          | Fresh server identity, teammate-only role guard, `SiteLayout bare`, one original header                                                                                                                           |

The server queue is the sole eligibility source. The hidden online toggle and
absent client approval/preferences never suppress eligible orders. No creation,
acceptance or customer timestamps, payment state, approval metadata, private IDs,
queue wait times or aggregate statistics are invented.

## Retained, switched-off sections

All unsupported original sections remain in JSX behind `FEATURES`, all false:
presence/online controls, notifications and bell, preferences (games and voice),
trust/deposit statistics, earnings/payout/reviews, leaderboard, admin handovers,
cancelled lists, support, original data-URL proof controls and simulated customers.
No unimplemented stats, heartbeat, leaderboard or settings endpoint is requested.
Legacy stand-ins (`OrderDesk.tsx`, `CustomerOrderRoom.tsx`, `customer-orders.ts`) and
their browser fixtures remain for the separately requested cleanup chunk.

The original right-column layout stays intact, with its unsupported content
absent. No substitute summary cards or fabricated zero balances were added.

## Intentional compatibility changes

- Presence text becomes neutral `Ready to play?`; customer online dot is gated.
- Queue waiting copy does not promise notifications. Discord copy does not promise
  unimplemented presence roles or a timed linking duration.
- Order payout is shown without inventing a trust tier or deposit deduction.
- No synthetic system chat transcript or guessed in-game handle is inserted.
- Empty projected customer images use the neutral original avatar asset, not a
  nonexistent preview avatar index. Hour orders retain their actual unit label.
- The safe upload and completion controls replace the original data-URL controls
  inside the same proof section. Their buttons use original lavender/card tokens
  and 44px tap targets. The original uploader remains behind `legacyProof:false`.
- The active-order summary can wrap on narrow screens. A browser regression caught
  a 34px title column when the honest payout caption replaced the original short
  deposit caption; flex wrapping fixes the overlap without a layout redesign.

## Lifecycle and privacy protections

Queue and assignment initial loading, authorization denial and unavailable reads
are separate from empty success. Acceptance never mutates local assignment state
from an uncertain acknowledgement. Commands never retry automatically.

Chat resets on assignment UUID, ignores stale asynchronous assignment reads,
clears transcript and typing on 401/403/404, honors read-only and blocked replies,
and retains the same request UUID for an uncertain manual send retry. No simulated
customer or speculative delivered bubble is used in the live flow.

While completion confirmation or uncertainty is pending, automatic desk polling
and acceptance are locked. In-flight desk reads cannot replace the frozen proof
request. After a confirmed completion, the port reads both authoritative desk
resources; it clears the active order only after `order:null`. If readback fails or
still reports an assignment, the active component stays mounted, polls remain
locked and `Read back desk` retries only reads, never a money mutation. Shared
completion controls are left unchanged.

## Verification

Run with the repository-pinned Node binary on PATH:

```sh
pnpm check
pnpm lint
pnpm test:unit
pnpm build
pnpm exec playwright test --config playwright.teammate.config.ts
```

The isolated fixture uses port **4356**, never the parent's real-data QA port or an
existing dev server. `tests/fixtures/teammate-ui` mounts **LiveTeammate**, not the
stand-in. Its fictional account and order are confined to tests and mocked HTTP.
No credentials, env files, database inserts or financial writes are used.

Focused unit coverage includes strict mapping, parallel reads, denied/malformed
success, exact accept binding, unsupported legacy commands, initial states,
server-only eligibility, authoritative acceptance readback, frozen completion,
revoked/stale chat, stable chat retry IDs, customer avatar fallback and actual units.
Browser coverage runs desktop and mobile: original heading and single header,
safe feature flags, queue acceptance, actual chat transport format, private proof
upload, completion confirmation, uncertain same-command retry, paused polls,
failed authoritative readback and eventual explicit clearing, plus the real
Discord form with no desk reads before linking.

Screenshots are emitted under `test-results/` for both viewport projects:
`teammate-queue.png`, `teammate-active.png`,
`teammate-completion-uncertain.png`, and `teammate-completed.png`.
They are local test artifacts, not committed product assets. Vision review caught
the narrow active-order heading and unstyled shared proof controls; both are
covered by browser assertions. Sticky-header positioning in a scrolled full-page
capture is a screenshot artifact; browser actions exercise the actual controls.

## Parent integration evidence

The worktree was fast-forwarded onto `5918ba5`, preserving the other agent's Home and login-popup release without editing its files. `pnpm verify` passed with 1,095 unit tests and all four browser suites (108 main, 10 chat, eight completion and 12 teammate-port cases), plus type check, lint, formatting and the Vercel-adapter build. Astro reports zero errors and warnings; unused original-source declarations remain hints.

A separate real-data browser run used native password sign-in against hosted Supabase and a fresh, uniquely marked temporary teammate. It verified the original Discord gate, an owned synthetic Discord-link fixture, real private queue and current-assignment reads, repeated queue polling, actual database profile-name binding, zero page errors and no horizontal overflow at 390px. Desktop/mobile screenshots were visually reviewed without the development toolbar obscuring content. This does not establish a real Discord OAuth exchange or a paid-order completion.

Credentials remained in process memory, never `.env` or browser-state files. The owned Astro server was stopped before Playwright. No shared test account was promoted, no test orders or financial rows were created, no triggers were disabled, and normal fixture deletion was read back across Auth, profile, role, Discord and access records. The exact credential-free QA command was `node $HOME/.hermes/cache/scratch/teammate-port-live-qa.cjs` using the pinned Node binary. The same harness supports a `TEAMMATE_QA_ORIGIN` override for post-deployment verification; deployment evidence belongs in the PR.

## Review regressions

Independent review reproduced two state-handling defects before release. Definitive desk 401 responses now revoke customer, in-game name, chat and mounted private-proof context just like 403/404; stale chat reads cannot restore it. An uncertain acceptance blocks every further accept until a successful fresh desk read resolves the assignment. Manual refresh performs reads only. Dedicated unit and desktop/mobile browser regressions cover session expiry, 503 and network uncertainty, and completion readback remains fail-closed without discarding financial safety locks.

## Acceptance boundaries

Mocked browser tests establish screen and client transport integration, not hosted
payment capture, storage authorization, real concurrent acceptance or a full real
paid-order completion. Those are explicitly reserved for parent backend QA. OAuth
provider consent is not completed in this fixture. Unsupported sections remain
gated until their actual backend contracts and owner decisions are available.
