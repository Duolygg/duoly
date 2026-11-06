# Public MCP server v1

Endpoint: `https://duoly.gg/mcp`. Public, read-only, no account connection. Runs as an Astro API route on the existing Vercel Node adapter. No website design or checkout changes.

## Protocol and SDK

Pinned official TypeScript SDK: `@modelcontextprotocol/server` **2.4.0**. The older package `@modelcontextprotocol/sdk` is the v1 line and was not selected. Registry versions and installed SDK exports were checked during implementation.

Tested protocol revisions:

- **2026-07-28**: `server/discover`, per-request `_meta`, request metadata headers and `resultType: complete`. No initialize or sessions.
- **2025-11-25**, **2025-06-18**: `initialize`, `tools/list`, `tools/call` through the SDK's stateless legacy transport. No session IDs. Each request creates a fresh SDK server.

The same registered tools serve every revision. The modern handler uses `responseMode: json`; legacy uses `enableJsonResponse: true`. GET and DELETE return 405. No subscriptions or streams are offered. POST accepts one JSON-RPC message, maximum 16,384 bytes, including chunked bodies. The complete tool response, including text and structuredContent, is capped at 65,536 bytes. Unexpected tool dependency errors are sanitized; only adapter-owned input errors are returned verbatim. SDK validation owns protocol errors and version/header consistency. No authentication is required because no private or transactional tools are exposed.

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

All tools declare Zod input and output schemas, titles, narrow descriptions and annotations `readOnlyHint: true`, `openWorldHint: false`, `destructiveHint: false`, `idempotentHint: true`. Success includes `structuredContent` plus a short readable summary and compact JSON containing the full same data in text `content`. Models can read service IDs, descriptions, prices, exact tokens and bookUrls without consulting structuredContent. Share `bookUrl` as the primary booking link. See `src/server/mcp/tools.ts` for executable schemas or retrieve JSON Schemas with tools/list.

| Tool                  | Input                                                                                        | Structured output                                                                                                                                                                 |
| --------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `list_games`          | `{}`                                                                                         | `games: [{id, slug, name, bookUrl, url}]`, `url`                                                                                                                                  |
| `list_services`       | `{game}`                                                                                     | `game`, `services: [{id, name, description, fromPrice, category, unit, ranks, regions, editions, requiredInputs, bookUrl, url}]`, `url`                                           |
| `find_session`        | `{game, goal?, category?, rank?, region?, server?, quantity?, budget?, currency?, edition?}` | `game`, `matches`, `missingInputs`, `budgetApplied`, `notice`                                                                                                                     |
| `get_quote`           | `{game, service, rank?, quantity, currency, server, edition?}`                               | `kind`, `basis`, `notReserved`, `currency`, `amountMinor`, `amountEurMinor`, `formattedPrice`, `unit`, `quantity`, `quotedAt`, `fx`, `notice`, `bookUrl`, `url`                   |
| `get_availability`    | `{game?}`                                                                                    | optional `game`, optional positive `online`, `onlineByGame`, `label`, optional `medianMatchSeconds`, `medianWindowDays`, `medianScope`, `readAt`, `cacheSeconds`, `notice`, `url` |
| `create_booking_link` | `{game, service?}`                                                                           | `bookUrl`, `url`, `notice`                                                                                                                                                        |

Game accepts an exact returned short ID or page slug. Services accept exact IDs. Quantity is an integer from 1 to 10, currency is EUR or USD. `server` is an exact region token returned by list_services. Minecraft instead requires a server/world string and edition Java or Bedrock. Rank must match the service's exact rank token and must be omitted for flat-priced services. Rank tokens are preserved exactly, including punctuation in existing catalog identifiers. No game credentials or customer names are requested.

### Start with find_session

Call `find_session` first when the user wants a teammate or coach. Inputs: required `game`; optional `goal`, `category`, `rank`, `region` or `server`, `quantity`, `budget`, `currency`, `edition`. Goal tokens are `duo`, `coaching`, `ranked`, `casual`, `teams`; category aliases are `training` and `other`. Unknown values return valid tokens without fuzzy matching. Conflicting region/server values are rejected.

Returns `game`, up to three `matches` in relevant catalog order, `missingInputs`, `budgetApplied`, and `notice`. Each match includes service details, `bookUrl`, calculated `amountMinor`, `currency`, `formattedPrice`, `quantity`, `priceKind` and its own `missingInputs`. Complete inputs produce an exact base quote. Missing inputs produce an explicitly labelled from price using the cheapest eligible rank, one unit and EUR when unspecified. Flat-priced coaching can accept a valid player rank as context without passing rank to its price calculator. No player rank or region is inferred. A budget caps the total for the given quantity; without currency it is not applied. A budget too low returns no matches and guidance to change the budget or goal.

`list_services.fromPrice` is computed through `calculateQuote` for one unit across every valid rank, in EUR before account perks. Descriptions come from the existing service catalog, joined into one sentence without adding claims.

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

Share `bookUrl` to let the user book. The informational `url` remains available as a secondary source. Links only preselect the game and service using the existing homepage parser. They do not preserve rank, region, quantity or edition, create an order, reserve a teammate or start checkout. Payment and remaining selections happen on duoly.gg.

### Exclusions and honest availability

- Gamer Girl services (category `gg`) are excluded until the first store approval.
- Social as a catalog game is excluded throughout. Ordinary casual game modes whose internal category is `social` remain available.
- Bookability is determined by `parseQuoteInput`, not a hardcoded Teams category filter. Supported Teams services are included when the current parser accepts them, using its one-seat default. Social stays explicitly excluded.
- Dynamic streamer listings and pricing are excluded because they use a different quote path and streamer-specific revalidation.
- No account reads, checkout creation, wallet use, order cancellation, private chat or credentials.
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

## Next phases

After explicit approval: production firewall and native host connector checks, registry/directory submission, optional MCP Apps quote cards, then OAuth consent and database-side delegated-client guards before any private reads or writes. Financial operations require a separate approved common-core extraction, durable idempotency and trusted human confirmation. Social is a later release with safeguarding review. ChatGPT directory eligibility for paid remote services remains a separate policy gate; technical MCP connectivity is not host-store approval.
