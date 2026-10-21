# Astro design port

## Scope and provenance

This is a protected, noindex design preview. It is not a working marketplace. It ports all 13 page families and 12 admin sections from [duoly-admin/duoly](https://github.com/duoly-admin/duoly/tree/7f0299fe35d4ebbba1ebea36f1ecd46bab5f0280), pinned at `7f0299fe35d4ebbba1ebea36f1ecd46bab5f0280`.

All 302 files under the original `public/assets/` were copied and independently verified byte-for-byte. The flag collection's license is preserved. Brand and game artwork remains source artwork; this port does not establish additional third-party usage rights. The self-hosted Geist and Bricolage Grotesque fonts have their SIL Open Font License texts and verified source hashes under `public/fonts/`. No package install scripts were used to obtain the fonts.

## Route mapping

| Astro route               | Original design component                   | Adapter/data                                            |
| ------------------------- | ------------------------------------------- | ------------------------------------------------------- |
| `/`                       | `Home`                                      | `HomePreview`, offline auth and selectors               |
| `/dashboard`              | `Dashboard`, `Rewards`                      | `DashboardPreview`, shared sample order/history         |
| `/teammate`               | `Teammate`, `Leaderboard`, `TrustScore`     | `TeammatePreview`, sample access and desk               |
| `/admin`                  | `admin/AdminApp` and all section components | Sample administrator and read-only operational fixtures |
| `/queue/preview-order`    | `QueueRoom`                                 | Same sample order as customer and teammate views        |
| `/claim/preview-handover` | `Claim`                                     | Same sample order, explicit synthetic handover          |
| `/apply`                  | `Apply`                                     | Original application UI; submission blocked             |
| `/contact`                | `Contact`                                   | Original contact UI; submission blocked                 |
| `/creators`               | `Creators`                                  | Original creator UI; submission blocked                 |
| `/profile`                | `Profile`                                   | Synthetic profile; saves, linking and uploads blocked   |
| `/rules`                  | `Rules`                                     | Prototype rules and explicit sample return navigation   |
| `/privacy`                | `LegalPage`, `PRIVACY`                      | Explicitly marked unapproved legal draft                |
| `/terms`                  | `LegalPage`, `TERMS`                        | Explicitly marked unapproved legal draft                |

Other queue/handover identifiers return HTTP 404. No product API routes were added. The server health route still tests routing only.

## Compatibility boundary

`src/design-reference/` quarantines 47 original JS/JSX modules and their stylesheet. Only browser-safe components and data helpers were copied. No original Next.js handlers, JSON persistence, authentication modules, Discord bots, order services, ledgers or payout services are imported. New routing, fixtures and adapters are Astro and strict TypeScript under `src/pages/`, `src/layouts/DesignLayout.astro` and `src/design-preview/`.

The imported JSX uses page-sized React compatibility islands rendered on the Astro server and hydrated for local interaction. This is a deliberate visual-port stage. It is not the final small-island/performance architecture. Extract public content and progressively replace these islands with typed, feature-scoped components as approved production contracts are implemented. Original NextAuth was not installed.

Legacy formatting/lint exclusions apply only to the quarantined source and unchanged third-party assets. Newly authored code remains linted and type-checked, including browser/server import restrictions. Dedicated TypeScript-AST boundary tests inspect the copied source imports, require lexical binding of fetch to the offline adapter and reject beacon/network escape hatches. Astro currently reports legacy unused-declaration hints; these are not hidden by disabling authored-code diagnostics.

## Safety and local behavior

- Every page visibly identifies itself as a design preview with sample data and unavailable backend actions.
- The scoped `previewFetch` never delegates to browser or server fetch. It serves only an explicit allowlist of deeply frozen synthetic GET fixtures, returns fresh response copies and rejects unknown/external paths.
- All write methods return HTTP-like 405 responses with an explicit nothing-sent message. These are in-memory responses, not fake production endpoints.
- The original teammate check-in combined presence writes and queue reads in one POST. This preview maps that helper to the read-only `/preview/desk` fixture. It performs no presence write. The unload beacon is removed.
- Browser notifications are disabled. Upload and password fields are disabled in both server HTML and React output, avoiding hydration mismatches.
- Native form submission and API click/auxclick navigation are blocked by an early inline guard before hydration. All four original API anchors also have no href in server or React output and carry disabled semantics. A no-JavaScript check, an unlinked-teammate SSR markup regression and a module-blocked middle-click regression verify this boundary. Hydrated controls block form submit buttons and display an accessible preview notice.
- The prototype's pretend-login fallback is removed. Provider buttons show unavailable, never redirect to OAuth or set a fake session. No password or provider credential is collected.
- Local selectors, currency preference, navigation, tabs, dialogs, filters and visual calculators remain usable. They do not establish approved pricing, rewards or financial rules.
- Customer, queue, handover, teammate and admin reads share one clearly synthetic order. Declined acceptance leaves it visible; no session is opened or persisted.
- The missing comma in the original admin settings array was repaired. Its rate card explicitly describes a sample fixture, not a live ECB feed.
- The original handover card now uses border-box sizing, and Rules retains its original shorter back label. A second screenshot pass caught these mobile overflows after the first layout test pass.
- No analytics SDK, live support responder, email, payment processing, cloud database client or production credentials are enabled.

## Verification

Tests cover the original route families, all admin sections, desktop/mobile layouts, broken imagery, runtime errors, immutable read projections, network boundaries, blocked auth/submission behavior, invalid identifiers, server security headers, robots and exact health JSON. Tracer tests were run red before the missing routes/adapters were implemented and then green. The sample-acceptance regression was tightened to catch temporary optimistic removal before fixing the copied component.

Run the final acceptance suite with `pnpm verify`. The deployment handover must additionally record the exact commit, protected Vercel preview URL/ID and actual HTTP/browser results. Local development-server tests alone do not prove deployed behavior.

## Not implemented

Real identity/session/role authorization, authoritative catalog quotes, payments and webhooks, durable orders, atomic acceptance, RLS, chat transport, moderation workflows, uploads, credits/refunds/rewards, payouts, email delivery and analytics consent/provider integration remain production work. Prototype policy text and prices are not approval of these rules. Supabase stays Free-only. The customer domain and existing Replit site must remain unchanged until separately approved launch.

See [integration map](product/integration-map.md), [source inventory](product/design-inventory.json), [MVP decisions](product/mvp.md) and [database runbook](runbooks/database.md).
