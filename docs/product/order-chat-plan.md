# Native order chat: implementation plan and contract

Base: origin/main 6323542. Work only in the dedicated feat/order-chat worktree. Do not touch the primary checkout or the unrelated Stripe worktree. This is implementation authorization, not permission to change payment behavior, paid plans, production credentials or deploy unreviewed work.

## Release checkpoint

Owner authorized merge and deployment. Integrated current main through `3c5730b`, preserving its new admin console, Orders/payment trail, wallet checkout and email fixes. Chat moderation now lives in the existing `/admin/safety` section. Renumbered the chat migration to `20261024110000_order_chat.sql` because admin had already used `20261024090000`.

Hosted migration dry-run passed and rolled back cleanly. Migration `20261024110000` was then applied to `omnejesspybaxuacjlah` and its exact history/table state read back. Actual authenticated hosted acceptance passed for user-scoped reads, unrelated denial, direct-table denial, private WebSocket join and message-free invalidation delivery, immutable retry/conflict, blocked nondelivery, idempotent admin warning resolution, typing expiry, and 21 concurrent requests yielding 20 successes and one rate limit. Owned test accounts and synthetic order/chat rows were deleted and zero remaining fixtures verified. Supabase adds its own event UUID to the fixed invalidation payload; clients ignore all payload content.

Local checks on the integrated source passed 1002 unit tests, lint, format, type checking and Vercel build. PR/deployment and final browser evidence are recorded on the release PR to avoid repeatedly changing the release commit merely to record provider handles.

## Original authority and scope

BACKEND_REBUILD_PROMPT.md lines 19, 47, 51 and 53 govern this feature. Reuse the original QueueRoom.jsx and Teammate.jsx visual behavior and lib/chatRules.js patterns, adapting persistence and transport. Chat is customer to assigned teammate, writes only while in_progress, 500 Unicode code points, last 200 delivered messages per assignment, typing expires after four seconds, at most 20 message attempts per account in a rolling minute, system messages on accept/complete/rate. Blocked messages never reach recipients and produce private admin flags. Admins may investigate and mark Warned or Dismissed, but never impersonate a player. Reroll creates a fresh conversation for the replacement; customer and admin may inspect archived assignments, former/replacement teammates never inspect each other's history. Do not add completion, reviews, tips or money transitions to implement their system messages: provide the completion transition hook; review integration remains inactive until that real domain event exists.

## Product and layout

- Native inline conversation, not a floating global messenger or another support bubble.
- Customer order room: desktop keeps compact order/teammate information alongside a prominent conversation card; mobile puts the conversation immediately after the session summary, above secondary evidence details. Preserve booking, reroll and evidence actions.
- Teammate desk: conversation belongs inside the active assignment, beside its details/evidence when width permits, stacked on mobile. Never show chat for unaccepted queue cards.
- Existing near-black/purple surfaces, restrained lavender/pink accent, Bricolage/DM Sans typography, rounded existing card language and existing avatar assets. Do not introduce a new design system or Tailwind dependency.
- Header: actual counterpart profile image, name, role and explicit connection label. No invented online status. Avatars beside grouped incoming messages, subtle own-message treatment, readable timestamps, restrained centered system events.
- Composer: multiline, Enter sends, Shift+Enter newline, IME-safe; accessible send button, small locally bundled Unicode emoji chooser with labels, native OS emoji support, code-point-aware counter. No GIFs, attachments, rich HTML or Markdown execution. Text and emoji are safely rendered as text.
- Preserve drafts on failure or moderation rejection. Show sending, confirmed, uncertain/retry, rate-limited, reconnecting and read-only states honestly. Reuse the same request UUID when retrying an uncertain send. Never render a blocked message as delivered.
- Automatic scroll only when already near the bottom; otherwise show a new-message affordance. No draft persistence in localStorage or cross-order state reuse. Popover keyboard/focus support, reduced motion, mobile keyboard/overflow and accessible contrast checks.
- Queued before initial acceptance: clear waiting state. Reroll archives prior chat; customer's archive selector is read-only and explicit. Completed/cancelled conversation is read-only. Chat typing and sending never change order state.

## Exact shared DTO contract (snake_case, strict objects)

Participant: `{ role:'customer'|'teammate', name:string, image:string }`. No account UUID, email, Discord id, money, priority or old-team information in teammate DTOs.
Message: `{ id:uuid, sequence:positive integer, kind:'user'|'system', sender:'customer'|'teammate'|'system', name:string, image:string, body:string, created_at:ISO timestamp, request_id:uuid|null }`. System request_id is null. Bodies max 500 code points; no storage/internal ids. User request_id is included to reconcile sender retries, not another participant's identity.
Room: `{ order_id:uuid, assignment_id:uuid|null, viewer:'customer'|'teammate'|'admin', writable:boolean, participant:Participant|null, messages:Message[], typing:{role:'customer'|'teammate',expires_at:ISO timestamp}[], archives:{assignment_id:uuid,label:string}[] }`. Messages ordered by sequence, max 200. No assignment and empty lists are valid for an owned queued order. Teammates always receive archives:[]; no raw user ids.
Send input: `{ assignment_id:uuid, request_id:uuid, body:string }` plus HTTP header CSRF. Sender/time/profile are server-derived.
Send result: `{ order_id:uuid, assignment_id:uuid, request_id:uuid, outcome:'sent'|'blocked', message:Message|null, note:string|null }`. sent requires message with matching assignment/request binding at the outer result; blocked requires null message and original BLOCKED_NOTE. Same actor/assignment/request/body retry returns the exact committed result; changed body is 409.
Typing input: `{ assignment_id:uuid }`, HTTP header CSRF; response `{ order_id:uuid, assignment_id:uuid, ok:true }`.
Flag: `{ id:uuid,order_id:uuid,assignment_id:uuid,sender_name:string,body:string,rule:'Account access'|'Moving off Duoly'|'Off-platform payment',status:'open'|'warned'|'dismissed',created_at:ISO timestamp,warning_count:nonnegative integer }`. Admin-only, bounded list 50, no email or secret credentials. Resolution `{id:uuid,status:'warned'|'dismissed'}`; repeat same resolution idempotent, conflicting resolution 409. Warning counts increment exactly once.

## SQL RPC interface

All arguments qualified p_..., empty search_path, explicit grants and RLS. SQL is the final authority, including moderation for direct authenticated RPC calls; HTTP checks are defense in depth.

- `get_order_chat(p_order_id uuid,p_assignment_id uuid default null)` returns Room. Fresh actor/role/current assignment checks. No queue expiry sweep. Customer/admin history allowed, current/historical-final teammate allowed only for their non-rerolled assignment and fresh access. Archived writes always forbidden.
- `send_order_chat_message(p_order_id uuid,p_assignment_id uuid,p_request_id uuid,p_body text)` returns Send result. Lock account-rate state then order then room consistently; do not take proof locks. Authorize before body reflection/recording. Lock/recheck assignment; global per-account rolling 20/min includes blocked attempts; same-id retry does not consume another slot. Length, moderation and idempotency enforced in SQL; no client actor fields. Record blocked text only in private moderation storage, never delivered message rows, realtime payloads or application logs. Prune delivered messages to last 200 without corrupting retry records or rate limits.
- `set_order_chat_typing(p_order_id uuid,p_assignment_id uuid)` returns Typing response. Fresh writer access only; expire four seconds server-side, throttle emitted updates (maximum one per two seconds per actor/assignment), do not count as a message attempt.
- `list_order_chat_flags()` returns `{flags:Flag[]}`; admin fresh role only.
- `resolve_order_chat_flag(p_flag_id uuid,p_status text)` returns `{flag:Flag}`; admin only, exact allowed transitions, record reviewer/time privately, unique warning accounting.
- private `order_chat_can_receive_topic(p_topic text)` boolean helper used by realtime policy; its only result is membership, false on malformed/inaccessible topics. Do not grant raw tables or account data.

Tables for rooms/messages, independent idempotent attempt records, typing and moderation are private (RLS and no raw application-role grants). Sequence is per assignment, not a global business-volume counter. New assignment/accepted and completed state hooks append unique idempotent system messages without causing lifecycle or financial transitions. Existing active assignments backfill safely. Preserve original regex categories with PostgreSQL word-boundary adaptation and regression cases; do not reuse JS \b literally in SQL.

## Realtime and security

Use Supabase private Broadcast channels `order-chat:<assignment_uuid>` with receive authorization against fresh DB membership. Restrictive policy must prevent unrelated permissive policies bypassing order-chat checks. No client broadcast INSERT for this namespace. Database trigger sends only fixed `{changed:true}` invalidation, never message text, sender ids, flags or token data. All actual messages are read via freshly authorized HTTP. Existing subscribers may retain cached channel permission after reroll: invalidation-only transport plus assignment-specific topics and fresh API authorization prevents disclosure of replacement messages. No long-lived Vercel socket process.

Existing auth cookies are HttpOnly. An explicit same-origin authenticated realtime bootstrap endpoint may return the current user's access JWT (never refresh token) for the Supabase private subscription, retained only in JS memory. This is a deliberate security decision to review: token exposure to JS is limited to existing short-lived access credentials, no localStorage, cookie weakening, service-role key, signing-secret provisioning or new auth model. Publishable key/URL are public config. Bootstrap must verify room access, emit no-store/no-referrer, and never log credentials. New auth/reconnect requests repeat authorization. No token in server-rendered HTML or DOM props. If independent review rejects this bridge, retain authoritative HTTP chat and do not weaken channel security as a workaround.

## HTTP interface (parent owns)

- GET `/api/orders/:id/chat` optional sole query `assignment_id`.
- POST `/api/orders/:id/chat` exact Send input, Origin and X-CSRF-Token, bounded JSON body.
- POST `/api/orders/:id/chat/typing` exact Typing input, same CSRF.
- GET `/api/orders/:id/chat/realtime` authenticates room and returns memory-only subscription credentials `{url,publishable_key,access_token,expires_at,topic}`. No side-effecting order reads.
- GET `/api/admin/chat-flags` and POST `/api/admin/chat-flags/:id` resolution input `{status}` with CSRF.

Every response private/no-store. Cross-order/missing/unauthorized reads return 404; unauthenticated writes 401; methods 405; invalid input 400; forbidden write 403 or stale assignment 409; rate limit 429; infrastructure 503. Denials clear participant/message state. Strict runtime schemas and identity/binding checks for both server and UI. Any token/bootstrap failure must not leak a privileged fallback credential.

## Activation and independent security review

Applying the migration and its authenticated EXECUTE grants activates direct Supabase RPC access. `ORDER_CHAT_ENABLED=false` gates the application HTTP surface only; it is not a database-wide kill switch. Withhold the production migration until release is approved. No production migration, enablement flag, credentials or deployment has been changed by this implementation.

The memory-only Realtime bridge deliberately exposes the current user's general short-lived Supabase access capability to same-origin JavaScript, not a room-scoped token. Never describe it as room-scoped. HttpOnly refresh/session cookies remain unchanged; no refresh token is returned. XSS could still extract an in-memory access token. Independent source review conditionally accepted this tradeoff, pending actual browser/provider verification and confirmation of the configured token lifetime.

The browser uses the public Supabase SDK's `accessToken` callback, which bypasses browser Auth initialization entirely. It closes the old transport, drops its in-memory token and obtains a fresh authenticated bootstrap on reconnect and shortly before expiry. Retries are coalesced and bounded; authoritative HTTP refresh remains available if live updates fail. The middleware now preserves the bootstrap's stricter `no-referrer` header. Verify real Supabase channel authorization and provider-delivered headers before release. Cached old assignment subscriptions never carry replacement message bodies.

Native SQL `{error:{code,message}}` envelope decoding is regression-tested so denied, stale and rate-limited results retain their real HTTP statuses without diagnostic reflection. SQL now rejects unsupported control characters instead of silently changing bodies, aligns Unicode trimming with HTTP, and preserves typing emission timestamps across sends.

Local verification: 104 desktop/mobile Playwright regression tests also passed, including actual HTTP verification that middleware preserves chat `no-referrer` and no-store headers. The original 969 unit tests across 39 files passed, whole-project ESLint passed, Astro check returned zero errors, and the Vercel adapter build completed. The actual migration and rollback-only behavioral SQL suite passed in embedded PostgreSQL/PGlite with minimal Supabase auth/Realtime stubs. This does not verify hosted Realtime, true concurrent sessions or production behavior. Page integration, admin moderation UI, browser interaction/visual QA and hosted-provider acceptance remain open.

## Approved local integration and browser fixtures

The owner approved Superdesign draft `81077ceb-c11e-4375-ba97-8eb6729820c2` version 4 and explicitly selected local integration. This does not authorize cloud migration application, activation, commits, merges or deployment.

`playwright.chat.config.ts` runs a separate Astro fixture app under `tests/fixtures/chat-ui`, not production `src/pages`. It imports real components/layout and intercepts API calls with explicitly fictional, schema-validated data. Ten desktop/mobile interaction tests pass: Unicode emoji insertion, multiline and escaped delivery, blocked-message nondelivery and preserved draft, immutable lost-ACK retry, two isolated browser contexts and revocation clearing, resize anchoring/history-scroll preservation, 500-code-point enforcement and IME-safe Enter. These are real browser interactions against mocked transport, not hosted Supabase acceptance. The regular `test:e2e` script now includes this fixture suite.

## Chunks and ownership

1. Plan, source mapping, visual context and executable DTO tests (parent).
2. SQL authorization/moderation/retention/typing/realtime policies plus actual rollback SQL acceptance (SQL worker owns migration, SQL suite and its focused static regression only).
3. HTTP/DTO/realtime bootstrap, typed browser transport and server tests (parent).
4. Native OrderChat component, scoped CSS, accessible emoji picker and component tests (UI worker owns src/components/chat only and tests/unit/chat-ui.test.ts; no shared pages/contracts/lockfiles).
5. Integrate customer/teammate and admin safety UI, multi-user browser, race/reconnect/moderation/emoji/avatar/mobile checks, independent security and visual review (parent).

## Acceptance and release

No completion/payments/payout mutation, no raw message publication, no service credential in browser. Actual tests cover anonymous/unrelated/former/replacement/admin, role changes, reroll/send races, simultaneous limits, same-id lost ACK, blocked-message nondelivery and duplicate warning prevention, timestamp/name spoofing, four-second typing expiry, message trimming, reconnect catch-up and current-order side-effect isolation. Use owned fixtures with verified cleanup only. Run pinned Node 24.21.0 frozen install, types/lint/format/unit/build and desktop/mobile browser checks. Production activation, merges and credential changes remain separate gates; report exactly what was exercised and what is still gated.
