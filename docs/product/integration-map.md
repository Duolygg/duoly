# Design-to-Astro integration map

This document connects the pinned design source to the Astro preview and the production work still required. Source evidence is not approval of prototype prices, financial rules or access policies.

Source: [duoly-admin/duoly at 7f0299fe35d4ebbba1ebea36f1ecd46bab5f0280](https://github.com/duoly-admin/duoly/tree/7f0299fe35d4ebbba1ebea36f1ecd46bab5f0280).

The machine-readable [source inventory](design-inventory.json) reconciles all13 page route files,31 API route files and12 admin sections against that source. These counts exclude modal and state permutations. The [port report](../design-port.md) describes the actual Astro compatibility boundaries and executed checks.

## Where the screens belong

| Original route   | Design component                        | Production responsibilities still needed                                                                     |
| ---------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `/`              | `HomeWithAuth` and `Home`               | Public catalog/content, server-owned quotes, identity entry, currency preferences and checkout handoff.      |
| `/dashboard`     | `Dashboard`, `Rewards`                  | Customer-owned order/history reads, credit/reward policy, support and account navigation.                    |
| `/queue/[id]`    | `QueueRoom`                             | Ownership checks, order lifecycle, cancellation, teammate changes, chat, reports, review and tips.           |
| `/teammate`      | `Teammate`, `Leaderboard`, `TrustScore` | Approval/eligibility, availability, queue access, atomic acceptance, proof, completion and earnings.         |
| `/admin`         | `admin/AdminApp` and section components | Independent admin authorization and audited operational commands across orders, users, support and finances. |
| `/apply`         | `Apply`                                 | Validated application intake, evidence handling, review and approval policy.                                 |
| `/claim/[token]` | `Claim`                                 | Expiring handover capability, teammate eligibility and atomic acceptance.                                    |
| `/profile`       | `Profile`                               | Account-owned profile updates, avatar storage and upload constraints.                                        |
| `/contact`       | `Contact`, `LegalPage` primitives       | Validated contact intake, abuse controls, durable support/email delivery.                                    |
| `/creators`      | `Creators`, `LegalPage` primitives      | Application intake; referral attribution, discounts and commissions require separate approved scope.         |
| `/rules`         | `Rules`, `TrustScore`                   | Approved teammate policy and any acknowledgment/enforcement rules.                                           |
| `/privacy`       | `LegalPage`                             | Accurate provider/data/retention disclosures and verified merchant/contact facts.                            |
| `/terms`         | `LegalPage`                             | Approved service, cancellation, payment and legal policies with verified merchant facts.                     |

Astro owns routing, server rendering, metadata and the security boundary. React handles imported interactive designs inside an explicit preview compatibility layer. The original Next.js route handlers and JSON stores are not deployed as the production backend. Quarantining the original design preserves visual fidelity while keeping newly authored adapters separate from future business services.

## Connected journeys

### Customer purchase and fulfillment

Observed source path: `Home` submits to `app/api/orders/route.js`, which calls `lib/orders.js`, then the customer navigates to `/queue/{id}`. The waiting room reads order/chat state. Teammate acceptance/completion and admin intervention affect the same underlying order.

Production must define server-authoritative pricing and payment confirmation before an order can be considered paid. The prototype receives a browser total and stores a `paid` object without collecting a payment. Never port that behavior as proof of funds.

The shared order contract must define eligible actors, allowed transitions, deadlines, cancellation/refund treatment, proof, completion, reviews and recovery. Two acceptance attempts must have one winner. Browser state and notifications cannot be the authority.

### Teammate onboarding and assignment

Observed source path: application, approval/access rules, teammate dashboard, Discord-link gating, queue eligibility and optional handover token. Production identity and Discord's role are unresolved. Choosing Supabase PostgreSQL did not choose the authentication provider or approve mandatory Discord.

### Administration and recovery

The12 design sections are Overview, Live desk, Priority, Users and roles, Orders, Teammates, Customers, Payouts, Support chat, Reports and safety, Audit log, and Settings. Each is a view over shared data or operational commands, not a separate backend per screen.

Financial actions require a durable ledger, authorization, idempotency and recovery. The source uses local JSON for orders, earnings and payouts; those stores are not compatible with the required durable serverless architecture. Support, uploads, moderation and retention also need explicit contracts.

## Preview boundary

The deployed design preview uses explicitly labeled sample data. Its local selectors, navigation, tabs and dialogs can be exercised. Login, live checkout, order mutations, support sending, uploads, approvals and payouts must not succeed or contact live providers. No sample role switch grants a real account role. No sample queue/handover identifier is a production record.

Production replacements must be introduced one tested vertical slice at a time. Keep public content server-rendered and extract smaller islands as approved features replace the temporary design compatibility layer. Maintain noindex and provider deployment protection before launch.

## Developer handoff rules

1. Agree one shared contract per journey before parallel UI and backend implementation.
2. Give each issue a screen/interaction scope, actor, request/response schema, state transition, authorization policy, dependencies, exclusions and tests.
3. Assign one integrator for shared contracts, migrations, layout and lockfile changes.
4. Put migrations only in `supabase/migrations/`. Explicit grants/RLS and actual disposable-DB tests are required before exposing product data.
5. Separate identity, pricing, payments, order state and notifications. UI integration must use the same contracts across customer, teammate and admin views.
6. Stay within Supabase Free. Do not assume paid branching, upgrades or add-ons.
7. A preview is accepted by real route/interaction/network tests and protected deployment checks. A production feature additionally needs verified business behavior, persistence, failure handling and authorization.

Pending owner decisions remain in [MVP scope](mvp.md). The preview does not silently approve them.
