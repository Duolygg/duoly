# Public MCP server v1

Endpoint: `https://duoly.gg/mcp`. Public, read-only, no account connection. Runs as an Astro API route on the existing Vercel Node adapter. No website design or checkout changes.

## Protocol and SDK

Pinned official TypeScript SDK: `@modelcontextprotocol/server` **2.4.0**. The older package `@modelcontextprotocol/sdk` is the v1 line and was not selected. Registry versions and installed SDK exports were checked during implementation.

Tested protocol revisions:

- **2026-07-28**: `server/discover`, per-request `_meta`, request metadata headers and `resultType: complete`. No initialize or sessions.
- **2025-11-25**, **2025-06-18**: `initialize`, `tools/list`, `tools/call` through the SDK's stateless legacy transport. No session IDs. Each request creates a fresh SDK server.

The same registered tools serve every revision. The modern handler uses `responseMode: json`; legacy uses `enableJsonResponse: true`. GET and DELETE return 405. No subscriptions or streams are offered. POST accepts one JSON-RPC message, maximum 16,384 bytes, including chunked bodies. The complete tool response, including text and structuredContent, is capped at 65,536 bytes. Unexpected tool dependency errors are sanitized; only adapter-owned input errors are returned verbatim. SDK validation owns protocol errors and version/header consistency. Catalog tools need no authentication. get_order_status requires a private, revocable per-order capability; no tool performs order lifecycle or payment mutations.

Modern requests need `MCP-Protocol-Version: 2026-07-28`, `Mcp-Method` matching the method and, for tools/call, `Mcp-Name` matching the tool name. Their params include:

```json
{
  "_meta": {
    "io.modelcontextprotocol/protocolVersion": "2026-07-28",
    "io.modelcontextprotocol/clientInfo": { "name": "example", "version": "1" },
    "io.modelcontextprotocol/clientCapabilities": {}
  }
}
```

Reference: [Streamable HTTP specification](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http), [official SDK](https://github.com/modelcontextprotocol/typescript-sdk).

## Tools and schemas

All tools declare Zod input and output schemas, titles, narrow descriptions and annotations `readOnlyHint: true`, `openWorldHint: false`, `destructiveHint: false`, `idempotentHint: true`. Success includes exactly one short readable text block with names, descriptions, prices and booking links. `structuredContent` carries the full output validated by outputSchema; JSON is never dumped into text. View-only price matrices live in result `_meta["gg.duoly/card"]`, outside model context. Share `bookUrl` as the primary booking link. See `src/server/mcp/tools.ts` for executable schemas or retrieve JSON Schemas with tools/list.

| Tool                  | Input                                                                                                                                             | Structured output                                                                                                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `list_games`          | `{}`                                                                                                                                              | `games: [{id, slug, name, bookUrl, url}]`, `url`                                                                                                                                  |
| `list_services`       | `{game}`                                                                                                                                          | `game`, `services: [{id, name, description, fromPrice, category, unit, ranks, regions, editions, requiredInputs, bookUrl, url}]`, `url`                                           |
| `find_session`        | `{game, goal?, goalType?, category?, rank?, region?, server?, quantity?, budget?, currency?, edition?, role?, character?, voice?, mood?, seats?}` | `game`, `matches`, optional `recommendation`, `missingInputs`, `budgetApplied`, `notice`                                                                                          |
| `get_quote`           | `{game, service, rank?, quantity, currency, server, edition?, seats?}`                                                                            | `kind`, `basis`, `notReserved`, `currency`, `amountMinor`, `amountEurMinor`, `formattedPrice`, `unit`, `quantity`, `quotedAt`, `fx`, `notice`, `bookUrl`, `url`                   |
| `get_availability`    | `{game?}`                                                                                                                                         | optional `game`, optional positive `online`, `onlineByGame`, `label`, optional `medianMatchSeconds`, `medianWindowDays`, `medianScope`, `readAt`, `cacheSeconds`, `notice`, `url` |
| `create_booking_link` | `{game, service?, rank?, region?, server?, quantity?, currency?, edition?, role?, character?, voice?, mood?, seats?}`                             | `bookUrl`, `url`, `notice`                                                                                                                                                        |

Game accepts an exact returned short ID or page slug. Services accept exact IDs. Quantity is an integer from 1 to 10, currency is EUR or USD. `server` is an exact region token returned by list_services. Minecraft instead requires a server/world string and edition Java or Bedrock. Rank must match the service's exact rank token and must be omitted for flat-priced services. Rank tokens are preserved exactly, including punctuation in existing catalog identifiers. No game credentials or customer names are requested.

### Start with find_session

Call `find_session` first when the user wants a teammate or coach. Inputs: required `game`; optional `goal`, `category`, `rank`, `region` or `server`, `quantity`, `budget`, `currency`, `edition`. Legacy goal tokens are `duo`, `coaching`, `ranked`, `casual`, `teams`; category aliases are `training` and `other`. Optional `goalType` accepts `climb`, `learn`, `learn_role`, `learn_character`, `review`, `mechanics`, `friends`, `casual`, `have_fun`, `play_tonight`. Free goal text uses documented whole-word rules: climb/rank up, learn/improve, review/vod/demo, mechanics/aim/movement, friends/team, fun/relax/chill, tonight. Multiple or unknown intents ask for clarification with an explicit token. Explicit goalType takes precedence. Ordered per-game service IDs are intersected with the public bookable catalog. One optional `recommendation` names the first budget-qualified match and explains the actual catalog inclusion and calculated bundle savings. No ranked-climb rule exists for Minecraft or ARC Raiders. Tonight means a casual session, never promised availability. CS2 and CoD recommendations ask to confirm the ranked playlist. No new card visuals. Conflicting region/server values are rejected.

Returns `game`, up to three `matches` in relevant catalog order, `missingInputs`, `budgetApplied`, and `notice`. Each match includes service details, `bookUrl`, calculated `amountMinor`, `currency`, `formattedPrice`, `quantity`, `priceKind` and its own `missingInputs`. A supplied rank and quantity produce an exact base price (flat-priced services need only quantity), defaulting to EUR with that currency explicitly labelled. Missing rank or quantity produces a from price plus one representative row at the supplied rank or Gold when available, otherwise the first valid service rank. Representative rows are examples, never inferred user selections. Full rank/region arrays stay in list_services, not each discovery match. Totals, per-unit prices, saved minor units and bundle discount percentages come from the server calculator. Remaining inputs are listed explicitly. Flat-priced coaching can accept a valid player rank as context without passing rank to its price calculator. No player rank or region is inferred. A budget caps the total for the given quantity; omitted currency defaults silently to EUR and the budget is applied in EUR. A budget too low returns no matches and guidance to change the budget or goal.

`list_services.fromPrice` is computed through `calculateQuote` for one unit across every valid rank, in EUR before account perks. Rank-priced services include priceNote explaining that price scales with the customer's rank, and typicalPrice at Gold for one unit (first valid rank if Gold is unavailable). Descriptions come from the existing service catalog, joined into one sentence without adding claims.

Examples: `{ "game": "lol", "goal": "ranked", "rank": "Gold", "server": "EUW", "quantity": 3, "currency": "EUR" }` and `{ "game": "val", "goal": "coaching", "budget": 15, "currency": "EUR" }`.

Example quote arguments:

```json
{
  "game": "val",
  "service": "duo2",
  "rank": "Platinum",
  "quantity": 3,
  "currency": "EUR",
  "server": "EU"
}
```

The real calculator returns `amountMinor: 1752`, `amountEurMinor: 1752`, `formattedPrice: "€17.52"`, `kind: "preview"`, `basis: "base price before account perks"`, `notReserved: true`. FX includes the rate, source, date and fetchedAt returned by the existing cached ECB loader. USD is an estimate, not a guaranteed Stripe conversion. Payout is never exposed. PRO, creator, wallet and first-session eligibility are never inferred or set by the adapter.

Example link for Valorant VOD review:

`https://duoly.gg/?game=val&service=vod&agent=claude#modes-h`

Share `bookUrl` to let the user book. The informational `url` remains available as a secondary source. Links carry the game, optional service, claimed agent source and supplied selections. They do not create an order, reserve a teammate or start checkout. Payment and remaining selections happen on duoly.gg.

### Booking link parameter contract

The destination is `https://duoly.gg/` with fragment `#modes-h`. All selections use existing controls; no link creates an order or starts payment.

| Parameter     | Validation                                                                                                                                                                                                                |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `game`        | Exact catalog short ID, such as `lol` or `val`; required on landing. MCP also resolves exact page slugs to IDs.                                                                                                           |
| `service`     | Exact service ID for that game. MCP accepts only the public bookable catalog.                                                                                                                                             |
| `tab`         | Existing category token; an exact service takes precedence.                                                                                                                                                               |
| `agent`       | Claimed assistant platform for attribution only, never a Valorant character. Preserved in the URL.                                                                                                                        |
| `rank`        | Exact case-sensitive service ladder from `list_services`; omitted for flat-price services.                                                                                                                                |
| `region`      | Exact case-sensitive non-Minecraft catalog server token, including spaces and punctuation.                                                                                                                                |
| `server`      | Minecraft only: trimmed server/world text, 2 to 60 characters; never fetched or DNS-resolved. Conflicting `region` and `server` are ignored on landing. MCP also accepts non-Minecraft `server` as an alias for `region`. |
| `qty`         | Decimal integer 1 to 10, in games or hours. MCP input name is `quantity`. Out-of-range values are ignored, never clamped.                                                                                                 |
| `edition`     | Minecraft only, exact `Java` or `Bedrock`.                                                                                                                                                                                |
| `role`        | Exact `rolesFor(game, service)` token from `list_services.roles`. Final Fill/Flex/Any means no preference. Unsupported modes ignore it.                                                                                   |
| `character`   | One trimmed free-text character, 1 to 40 characters, only for character-bearing coaching games. Not a champion pool or enum.                                                                                              |
| `voice`       | Exact `true` or `false`; false preserves the existing text-chat choice. Social stays voice-only.                                                                                                                          |
| `mood`        | Exact `chill`, `tryhard`, `teach`, `fun`; Social ignores it.                                                                                                                                                              |
| `seats`       | Integer within `list_services.seats.min` and `.max`. Counts hired teammates, excluding customer and friends. Fixed groups stay fixed.                                                                                     |
| `ign`         | Explicit hand-written links only: trimmed 2 to 40 characters. Not accepted or emitted by MCP. Prefer entering it on Duoly.                                                                                                |
| `note`        | Explicit hand-written links only: trimmed plain text up to 200 characters. Not accepted or emitted by MCP. Prefer entering it on Duoly.                                                                                   |
| `creatorCode` | Explicit hand-written links only: exact uppercase letters/digits, 3 to 20 characters. Syntax is not eligibility; existing preview and checkout decide. Not accepted or emitted by MCP.                                    |

`create_booking_link` and `find_session` accept `role`, `character`, `voice`, `mood`, `seats`, `edition`, and `server` alongside their existing inputs. Use `list_services` for exact options: it also exposes `roles`, `characterLabel`, `seats`, `voice`, and `moods`. `get_quote` accepts `seats` for pricing parity. Invalid MCP preferences return a tool error with catalog guidance; recommendation candidates must support all supplied preferences. `currency` (EUR or USD) affects card pricing only, never the URL.

Examples:

- Coaching: `https://duoly.gg/?game=lol&service=learn&agent=claude&region=EUW&qty=3&role=Jungle&character=Ahri&voice=false&mood=teach#modes-h`
- Minecraft: `https://duoly.gg/?game=mc&service=squad&agent=claude&server=my+world&edition=Bedrock&seats=2#modes-h`

### Homepage prefill behavior

The shared pure parser in `src/contracts/booking-link.ts` uses the existing catalog and role/seat contracts. Duplicate, invalid, wrong-case or incompatible optional parameters are silently ignored. Valid optional fields apply independently. A valid game is required. On consumption the homepage strips all booking selection parameters immediately, preserving `agent`, unrelated parameters and the hash. This does not prevent initial URLs reaching web logs, history, or referrers: do not distribute personal data or credentials in links.

Quantities 3, 5 and 10 retain named bundles on the main service unless an explicit role, character or seat preference would be suppressed by that bundle. Other services never switch to the main service. Link selection resets incompatible role, character, seats, mood and Minecraft state; absent/invalid regions retain existing saved/time-zone fallback when confirmation opens. Sign-in resume preserves the new selections. Cards preserve compatible selections when changing tier/pack, and server-calculated card prices, recommendations and quotes use the same seat count as the homepage (including fixed groups).

No new visible controls, labels, titles or shared chrome. Payment still requires the existing confirmation and server checkout. `useWallet` and `freePerk` are intentionally not URL-controlled: spending preference and eligibility remain user/server-owned. Dynamic streamer bookings remain excluded because live inventory, allowed games and duration require their separate resolver; an arbitrary streamer UUID is never treated as bookable.

### Would need new UI (Fabi)

Structured language, scheduled start date/time/timezone, platform (PC/console), champion pools/multiple characters, requested teammate-role separate from the customer's role, and richer communication modes beyond the existing voice boolean have no current booking control/strict checkout field. Notes express wishes only and never enforce a match or reservation.

### Exclusions and honest availability

- Gamer Girl services (category `gg`) are excluded until the first store approval.
- Social as a game and every service with category `social` are excluded until first store approval, including casual social services embedded in supported games. The shared catalog filter governs discovery, direct quotes, booking links, cards and valid-token error messages.
- Bookability is determined by `parseQuoteInput`, not a hardcoded Teams category filter. Supported Teams services are included when the current parser accepts them, using the service seat-rule default. Social stays explicitly excluded.
- Dynamic streamer listings and pricing are excluded because they use a different quote path and streamer-specific revalidation.
- No account lookup, checkout creation, wallet use, order cancellation, private chat or credentials. Only get_order_status reads its explicitly authorized order projection.
- Online means **online now (may include teammates in a session)**. It does not mean immediately reservable capacity. Orders enter a queue and a teammate must accept. No rank gains or instant matching are promised.
- Availability reuses the 30-second cached homeLive loader and exposes only game aggregates. The overall total is omitted because it can include excluded sessions. Zero and unavailable counts are omitted in text and structuredContent. Only positive online counts are shown. find_session does not surface online counts.
- Historical match median is sitewide across accepted orders in the last 30 days, including sessions outside this tool catalog. It is not game-specific or predictive. It is only included when the public loader has a value. The loader suppresses small samples in the database and may retain a previous snapshot on failure. `readAt` is when this tool read the cache, not a claim of fresh database observation.
- Customers and teammates use their own separate game accounts. Never ask for a game password or account sharing.

## Abuse limits and deployment requirements

Every accepted POST consumes one request from both fixed UTC buckets per IP: **60 per minute and 2,000 per day**. This includes discovery and legacy initialization. Requests with malformed JSON, invalid origin, invalid media type or oversized bodies are rejected before database access. JSON-RPC batches are rejected, so batching cannot bypass quotas.

IP comes from Astro's adapter `clientAddress`, never caller-controlled forwarded headers in application code. Vercel is the trusted ingress. A dedicated server-only `MCP_IP_HASH_SECRET` of at least 32 characters HMAC-SHA256 hashes the IP with a namespace. Neither raw IPs nor hash keys are sent to analytics. Rotating this secret resets quotas. Shared NAT addresses share quotas. Missing secret, invalid adapter address or missing service configuration fails closed with HTTP 503 and Retry-After 60. RPC errors, timeouts and malformed RPC results fail open under a process-wide cap of 30 requests per fixed minute. The cap retains no IPs and emits one generic warning per affected minute, without error details, secrets or addresses. It is not a durable quota and scales with instance count; the durable daily quota is unavailable during an outage. Restore RPC health promptly. Quota rejection returns HTTP 429, JSON-RPC code -32029, original RPC ID and retry guidance in `error.data.retryAfterSeconds` plus `Retry-After`.

Origin is allowed when absent. Any well-formed HTTPS origin is accepted, because AI clients call from their own sites (Claude sends `Origin: https://claude.ai`) and treat a 403 as an authentication requirement, which made Claude attempt OAuth client registration and fail. The endpoint is public and read-only, accepts no cookies or credentials, never sets `Access-Control-Allow-Credentials`, and rate limits per IP, so a cross-origin caller gains nothing. `null`, malformed origins, origins with a path and plain HTTP stay rejected; HTTP localhost is allowed only in dev.

### Migration and owner steps

New additive migration: `supabase/migrations/20261107100000_mcp_rate_limits.sql`.

It adds an RLS-enabled counter table, service_role-only privileges and a security-definer RPC. Atomic upserts advance both counters under row locks. Keys are validated hashes. Counters saturate above the quota. Each call deletes up to 200 rows older than two days with skip-locked cleanup. No existing migration, marketplace table or financial function is changed.

**Not applied remotely by this PR.** Apply before merging/enabling the route, because the application depends on this RPC. Owner steps:

1. Review this additive migration and confirm its version is newer than the applied remote history and does not conflict with another pending migration.
2. Run the rollback-only SQL test against a disposable local Supabase before applying. The implementation machine has no Docker or Podman, so local PostgreSQL acceptance was unavailable.
3. Use the project's normal approved migration procedure. `supabase db push --dry-run` first, inspect the exact pending list, then apply only after owner authorization. Do not use reset or blindly push unrelated pending migrations.
4. Read back RLS, grants and the function definition. Verify anon and authenticated cannot call the RPC or read the table.
5. Add `MCP_IP_HASH_SECRET` in Vercel, generated with a secure random source, at least 32 characters. The route also needs existing `SUPABASE_URL` and `SUPABASE_SECRET_KEY` service-role credentials. Never use browser-public env names for secrets.
6. Merge only after CI and owner approval, then run smoke and Inspector against production. Verify the deployed Node function and trusted source address behavior. No merge or remote migration is authorized by creating this PR.

Rollback-only test, on a local database **before this migration has been applied**:

```sh
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -v ON_ERROR_STOP=1 -f supabase/tests/mcp_rate_limits.sql
```

The test begins a transaction, includes the migration, checks RLS/privileges, minute and daily boundaries, independent keys, cleanup and invalid keys, then rolls back. Do not run this command against production. SQL source inspection and mocked RPC tests do not establish real PostgreSQL concurrency acceptance.

## Attribution and privacy

The allowlisted server event `agent_tool_called` accepts only a tool-name enum and platform enum: claude, chatgpt, gemini, perplexity, mistral, other. Platform is derived from an exact `?client=claude|chatgpt|gemini` hint first, then recognized SDK client info when available, then User-Agent. Unknown client hints are ignored. These claims affect only attribution and never authentication, authorization or pricing. It is a client claim, not verified commercial attribution. Legacy stateless requests cannot carry client info over from a previous initialize request, so User-Agent is the fallback.

Events reuse serverTrack and flushAnalytics with no user ID, no consent identity, no session ID and a new personless fact identity per event. Existing global analytics enablement still applies. No arguments, result bodies, IPs, game names supplied by the client, account IDs or credentials are sent. Invalid calls rejected by SDK schema validation do not reach the tool analytics callback.

Existing analytics does not accept arbitrary UTM attribution into its funnel contract, so links use a separate `agent` param ignored by the page. This PR does not claim durable booking conversion attribution and does not change creator codes, referral cookies or commission.

## Testing

```sh
corepack pnpm check
corepack pnpm lint
corepack pnpm format:check
corepack pnpm test:unit
corepack pnpm build
corepack pnpm test:e2e
node scripts/mcp-smoke.mjs http://127.0.0.1:4321
npx @modelcontextprotocol/inspector --cli http://127.0.0.1:4321/mcp --transport http --method tools/list
```

The smoke script exercises discovery and all six tools on all three revisions, plus GET 405 over real HTTP. It requires working limiter configuration. Unit tests use an injected limiter and mocked RPC so they never touch production. Local dev and Inspector can be exercised against a test-only mock limiter RPC; this verifies actual Astro routing and SDK transport, not the database migration. There is no public limiter bypass. The bounded process fallback applies only to limiter RPC outages, not missing security configuration.

The local run on port 4398 used a test-only mock Supabase limiter on port 4397, with no production credentials. All three protocol revisions passed the smoke script. A separate curl run exercised all six tools over both legacy revisions (18 calls including both requested game examples). League Gold, EUW, three Duo Pro games returned €10.77. Valorant coaching returned three options at €12.99 for one game or hour. Zero online counts and their labels were absent. Inspector tools/list exited 0 with six titled read-only tools and input/output schemas. This is not a real Claude or ChatGPT UI acceptance test; those remain a post-deployment owner step.

[Verbatim model-visible text samples from the curl run](./mcp-text-samples.md) include list_services, find_session and get_quote for League and Valorant coaching. The samples contain actual local calculator output and booking links with agent=claude.

## Interactive cards (MCP Apps)

Stable SEP-1865 revision **2026-01-26** is implemented with the official `@modelcontextprotocol/ext-apps` **2.0.4** server helpers, compatible with server SDK 2.4.0. `find_session`, `create_booking_link` and `list_games` declare `_meta.ui.resourceUri`. Three versioned `ui://duoly/` resources cover four views: ranked or casual teammate finder, coaching finder, session ticket, and game picker. Both resources/list and resources/read are available. All resources return `text/html;profile=mcp-app` with `_meta.ui.csp.resourceDomains: ["https://duoly.gg"]`, no external connections, no nested frames and no `ui.domain`.

The self-contained resource inlines the approved dark widget CSS and vanilla JS. No external scripts or view bundler are needed. Fonts, game icons and the mascot use duoly.gg. The app initiates `ui/initialize`, waits for its result, sends `ui/notifications/initialized`, receives tool-input and tool-result notifications, and reports content-based size changes. Link clicks use `ui/open-link`; an ordinary `_blank` anchor with `rel=noopener` remains available if the bridge fails. Copy-link denial exposes a selectable URL. The picker calls `find_session` through the host's `tools/call` bridge. All tools retain titles and read-only annotations.

### Price and result delivery

Every displayed total is calculated server-side by the unchanged `calculateQuote`, the same path as get_quote and checkout. The card payload contains per-service, per-rank arrays for quantities 1 through 10. Each row is `[customerTotalMinor, customerOriginalMinor, quantityDiscountPercent]`, including the calculator's EUR rounding and USD conversion. The view selects these exact totals instead of duplicating pricing formulas, discount schedules or FX logic. Its per-unit summary divides an already rounded total and rounds to cents for display only. Catalog tier descriptions and badges come from the existing catalog. No account perks or eligibility are inferred.

UI-only data is carried once in result `_meta["gg.duoly/card"]`, including selections, service options and the price matrix. SEP-1865 delivers the full CallToolResult to the view via `ui/notifications/tool-result`; result metadata is not intended for the model. The redundant JSON text block has been removed.

The compatibility problem is real, but does not justify duplicating the matrix into model context. [ext-apps #696](https://github.com/modelcontextprotocol/ext-apps/issues/696) reports Claude Desktop 1.18286.2 stripping structuredContent. Its Apify production-server comment independently reports content/isError-only notifications on Linux and macOS, and confirms that the host tools/call proxy returns the full result ([implementation](https://github.com/apify/apify-mcp-server/pull/1187)). [ext-apps #646](https://github.com/modelcontextprotocol/ext-apps/issues/646) separately reports basic-host dropping metadata. The prior PR body incorrectly linked modelcontextprotocol/modelcontextprotocol#696, an unrelated console-log PR.

Fallback decision: retain compatibility through one bounded, read-only tools/call proxy retry using the original tool-input arguments when view metadata is absent. No second text block, no JSON-text parser, no matrix in structuredContent. A failed or stripped retry displays a booking-link-in-chat message. Compliant hosts do not re-call. No pricing formulas move into the browser. The complete result remains capped at 64 KiB.

The reported empty get_quote was an input-validation error: the request omitted required currency. Live raw HTTP returned isError:true and a 115-character currency error, with structuredContent absent, not an empty success object. The enhanced validation error lists all valid input fields and currency choices. Successful quotes always pass the output schema; errors omit structuredContent rather than returning `{}`. get_quote remains for deployed compatibility; find_session is the preferred discovery/pricing tool and create_booking_link is only for final-link generation.

No online counts are shown in cards, so zero or unknown availability cannot become a placeholder. No names, reviews, ratings or predictive wait times are invented. Existing Social and Gamer Girl exclusions, HTTP origin policy, rate limits and attribution semantics are unchanged. Missing rank and region stay explicit, and minimum prices are labelled From. Budget badges require a budget with currency and an actual nonnegative difference for the selected total. Coaching inclusion copy is taken directly from the selected real service description.

### Reproducible visual and HTTP smoke

Run `node scripts/mcp-cards-smoke.mjs http://127.0.0.1:4398` from the worktree root with a running local Astro MCP endpoint. It performs real HTTP initialization, tool and resource discovery and reads, captures all four real tool results, renders sandboxed iframes, checks rank/tier/pack price parity against get_quote, tests the open-link bridge, tests metadata-stripped proxy recovery and exercises game-picker to coaching tool calls. Screenshots at 712px and 390px and captured JSON are written to `~/.hermes/cache/scratch/mcp-cards/` by default (`MCP_CARDS_OUTPUT` overrides this). The host page is local test infrastructure, never a production endpoint. Unit tests exercise the actual inlined view JS against get_quote across every rank, tier and 1/3/5/10 pack in Valorant and League, in EUR and USD.

Native rendering inside signed-in Claude or ChatGPT is a separate owner acceptance check. Issue [#671](https://github.com/modelcontextprotocol/ext-apps/issues/671) documents hosts that do not mount an iframe at all; server-side fallbacks cannot force a host to render. Plain text and booking links still work. The official Claude documentation currently recommends a host-specific domain, but this implementation intentionally omits `ui.domain` as required for the portable card scope.

## Next phases

After explicit approval: production firewall and native host connector checks, registry/directory submission and native host card acceptance. The approved per-order capability below is the only private read; broader account access or writes still require OAuth consent and database-side delegated-client guards. Financial operations require a separate approved common-core extraction, durable idempotency and trusted human confirmation. Social is a later release with safeguarding review. ChatGPT directory eligibility for paid remote services remains a separate policy gate; technical MCP connectivity is not host-store approval.

## Private per-order status (Fabi-approved board)

Design: `ai-agents-research/10-mcp-order-status.html` and `10-mcp-order-status-board.png`; architecture and source citations: `08-mcp-next-features.md`, section A. The panel mounts directly below the existing order summary on `/queue/[id]` without changing the page title or shared chrome.

`get_order_status {token}` accepts only a canonical `dos_` code (32 random bytes, base64url). It returns one short text summary and schema-validated structuredContent: status, game, service, quantity, current accepted flag, teammateDisplayName, team status/count/members with display names and thisSeat, nextStep, updatedAt. A queued reroll or cancellation exposes no old teammate name. A filled seat does not imply a started team.

The approved receipt card `ui://duoly/order-v1.html` additionally receives title, rank, region, EUR price paid and lifecycle timestamps in `_meta["gg.duoly/card"]`. The authenticated room URL lives only in this view metadata and is not an access capability. No email, billing/card information, account/assignment identifiers, reference, IGN, note, chat or profile images are returned. The room UUID is present only inside this approved authenticated navigation destination. Treat all display names as untrusted plain text. The card says **Updated HH:MM**, not Live: it is a snapshot and does not poll. Ask again to refresh. It never retains the input code.

The owner generates or revokes a code through POST/DELETE `/api/orders/[id]/ai-status-token`, using the existing session, Origin and CSRF checks. Caller-supplied ownership is rejected. Service-role-only RPCs independently check `orders.customer_id` against the server-verified customer ID and lock the order for atomic rotation/revocation. Other customers and missing orders receive 404. Only the SHA-256 hash is stored; raw codes are returned once, held only in island memory, and copied only on explicit action. The panel is blocked from session replay. No code enters URLs, data attributes, browser storage, logs or analytics. Revoke remains available after reload even though plaintext cannot be recovered.

Codes expire seven days after issuance. Unknown, expired, revoked and malformed codes have the same tool error with no structuredContent. Storage/projection errors are sanitized. The existing HTTP IP quotas still apply. An additional durable quota keyed by token hash uses the existing 60/minute, 2,000/day limiter and **fails closed** on outage, malformed limiter responses or denial. Public tools retain their existing process-wide outage fallback. No token or result telemetry is emitted by the private tool.

### Order status migration: separate owner action

New additive file: `supabase/migrations/20261107120000_order_status_tokens.sql`. No existing migration is changed. RLS is enabled with no client policy; only service_role receives table/RPC grants. The read RPC is STABLE, explicitly selects the allowlist and never calls customer_order, order_sweep, expiry, payment or settlement helpers. A stale queued row stays queued.

**Not applied to any remote database.** Before enabling this feature, review the pending migration history, run the rollback-only test `supabase/tests/order_status_tokens.sql` against disposable local Supabase, then the owner may apply the reviewed pending migrations with `corepack pnpm exec supabase db push --linked` from the repository. Inspect `corepack pnpm exec supabase migration list --linked` first; db push applies every pending migration, not just this file. Do not run it without owner authorization. This machine has no Docker or psql, so SQL execution is unverified; static review is not a database test.
