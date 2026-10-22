# Backend rebuild checkpoint

The owner's `BACKEND_REBUILD_PROMPT.md` is the behavioral target for the Astro migration. Preserve useful source behavior and record deliberate changes. Email and password was explicitly selected over the earlier email-code implementation. Supabase Auth owns credentials and hashing; do not reproduce NextAuth's local password store.

## Integration order

1. Preserve the original source revision and reconcile every backend library and API route. See the backend-salvage inventory when its independent audit has finished.
2. Identity, verified email, server-side role checks, own-account profiles and private storage authorization.
3. Original catalog, service-specific rank ladders, region validation, server-owned prices and persisted FX. A quote is not an order or proof of payment.
4. Stripe test-mode checkout, verified webhook, idempotent paid-order creation and wallet reservations. Never trust client totals. No live charges during migration.
5. Transactional single-winner acceptance, eligibility, release priority, expiry, rerolls and restricted role-specific reads.
6. Private proof, completion, immutable ledgers, loyalty, reviews, provider-backed tips and reports.
7. Realtime chat/presence and support, preserving server-side authorization and moderation.
8. Audited admin commands, applications and game approval, payout calculations and Stripe Connect test-mode settlement.
9. Exactly-one-process Discord worker and durable outbox. Do not start a gateway WebSocket inside a Vercel request function.
10. Creator attribution and team-seat fulfillment after their contracts and acceptance tests exist. Preserve their source content but do not sell unsupported multi-person fulfillment.

## Current order and Google checkpoint

- Account foundation PR #16 was merged. Google login-entry correction is in [PR #17](https://github.com/Duolygg/duoly/pull/17), with green exact-head CI and a protected preview. The owner completed Google login successfully; provider readback confirmed the linked Google identity, sign-in and customer role. Public signup remains closed. Public production authentication has not been activated.
- Current Google preview: <https://duoly-git-fix-f6b568-sebastianschrottenbach-gmailcoms-projects.vercel.app/login>. Only that approved branch uses its development configuration. The approved owner test account is intentionally retained; historical zero-fixture cleanup statements below do not authorize deleting it.
- The order slice is on `feat/order-foundation`. Reviewed migration `20261022093000_order_foundation.sql` is applied to development only, with migration history, RLS/grants, generated types and both post-migration rollback suites verified. See [the contract and evidence](order-foundation-contract.md).
- All nine customer/teammate HTTP endpoints are implemented. Parent `pnpm verify` passed type check, lint, formatting, 718 unit tests, Vercel-adapter build and 122 desktop/mobile browser tests. Separate runner safety suites passed 19 normal and 19 optimized-Python tests. Independent final HTTP review passed with no security or logic findings.
- Actual user-scoped Supabase sessions exercised 18 HTTP checks through a configured local Astro server: successful private reads, all nine route paths, missing-order command denials, metadata escalation denial, fresh role changes, admin play/book denial, CSRF-protected requests and wrong-email staging denial. Two temporary accounts were removed and auth/profile/role/access cleanup read back. No order or payment was created, and the owner's Google account was untouched. This supplements actual PostgreSQL transition/concurrency tests; it does not claim a successful paid-order checkout or deployed order UI.
- Both real accept races and instrumented overlapping cross-target sweeps passed in PostgreSQL. Reintroducing old lock ordering produced actual 40P01. Owned cleanup, foreign-invocation refusal and lost-acknowledgement recovery were verified. The service-only expiry sweep exists; pg_cron is available but not activated.
- Payment-dependent creation, proof/completion, realtime and marketplace screen wiring remain unavailable. A separate Duoly Stripe test account/connection is still needed. Production credentials and database remain separate and unprovisioned.

## Historical account checkpoint on 2026-10-22

- Working branch: `feat/accounts-and-email`, [PR #16](https://github.com/Duolygg/duoly/pull/16). Reviewed application-code checkpoint: `c1cae434ceff8039db43930fefea5bcd3653cc4c`. Quality, Browser smoke and Vercel checks passed for that commit. Documentation follow-ups are separately identified by Git history.
- Original backend audit returned all 78 source files (46 libraries, 31 API handlers, one instrumentation file). A reference-only offline archive and exact blob inventory preserve the code independently of the original GitHub repository. The pricing adapter reuses the existing catalog, ranks and regions. It is a pure quote calculator, not checkout or a payment flow.
- Parent rerun after security fixes: 589 unit tests and 102 desktop/mobile browser tests passed, together with Astro check, lint, formatting and the Vercel-adapter build. The independent review found retired OTP routes still exposed and missing callback session cleanup. Both are fixed with regressions; independent re-review passed with no remaining security concerns, logic errors or suggestions. Retired OTP GET/POST routes now return404, including while the email/password provider flag is enabled.
- Real GoTrue API account creation and browser password login succeeded against development. Profile changes persisted across reload, role injection returned400, customer staff routes returned404, logout returned to login and subsequent own-profile access returned401. Email was admin-confirmed only for the ephemeral test fixture; this does not prove confirmation-mail delivery. The fixture was deleted and zero auth users/profiles/roles were independently read back.
- Original source freshly fetched: `duoly-admin/duoly`, latest commit remains `7f0299fe35d4ebbba1ebea36f1ecd46bab5f0280`. No source changes were discarded.
- Baseline before password changes: `pnpm verify` passed 38 unit tests and 98 desktop/mobile browser tests, lint, formatting, Astro check and Vercel-adapter build. This is baseline evidence, not acceptance of subsequent edits.
- Independent account SQL source review passed. Enhanced rollback-only authorization checks executed successfully against `duoly-dev`, including no-subject JWT isolation and existing-user safe backfill. An attempted `SET ROLE supabase_auth_admin` was rejected by the managed database. No grants were expanded. Actual GoTrue account creation was subsequently verified through the provider API and the ephemeral fixture was cleaned up.
- Migration `20261021230000_account_foundation.sql` applied to the approved shared development project through the pinned Supabase CLI. Migration history, two account tables and their enabled RLS were read back. Database types regenerated from that exact project.
- Production still has no production database. Do not give production or unrelated preview branches this shared development database's credentials. Supabase remains Free.
- Real `/admin` now returns 404 to non-admins. Real `/teammate` requires its role. Original visual samples are preserved under `/preview/admin` and `/preview/teammate`, alongside `/preview/dashboard` and `/preview/profile`. Operational staff tools are not yet implemented. These are honest role-protected holding pages, not completed admin/teammate features.
- Dedicated Resend key requested with `sending_access` and exact Duoly domain restriction. Stored in macOS Keychain service `duoly-resend-smtp-key`, account `duoly-dev`. It is configured only as Supabase development SMTP, never committed or exposed to browsers. List readback confirms the key ID/name but omits permission/scope fields; creation payload and provider enforcement are the scope evidence.
- Development email provider enabled; signup remains disabled, email confirmation required, minimum password length 8. Google and Discord remain disabled because their Duoly OAuth applications are not configured.

## Email DNS and actual SMTP result

Authoritative DNS and both 1.1.1.1 and 8.8.8.8 resolve the expected `send` MX and SPF TXT. DKIM and `rsend` CNAME are verified in Resend. Resend still reports `partially_verified`, with the `send` MX/TXT pending and receiving MX not started.

One owner-only SMTP test attempted using the domain-restricted key was rejected at DATA with SMTP 550: the associated domain is not verified. No email was accepted. Readback of recent Resend sends found no matching Duoly test. Do not retry uncertain sends or replace the key with cross-project full-access credentials to bypass this boundary.

Receiving MX is absent from authoritative and public resolvers:

| Type | Host | Value                         | Priority |
| ---- | ---- | ----------------------------- | -------- |
| MX   | `@`  | `receive-euw1.forge.rmta.net` | `9`      |

No inbound forwarding or successful authentication-email delivery is claimed. A later verified send must record its provider ID, exact recipient and delivery readback.

## External blockers

- Stripe tool access exposes only the unrelated **Pet to Portrait** live account. Do not configure Duoly products, webhooks or payments there. Duoly needs its own account/test-mode connection.
- Discord OAuth credentials, application permissions and bot hosting remain unconfigured. Google is configured and owner-tested on the protected preview above. Do not reuse another project's secrets.
- Production database separation and legal merchant fields still require resolution before live commerce.

## Hosted staging acceptance

Protected feature-branch URL: <https://duoly-git-feat-32a834-sebastianschrottenbach-gmailcoms-projects.vercel.app>.

Reviewed code was redeployed with branch-specific staging configuration: <https://duoly-dwe5yrckn-sebastianschrottenbach-gmailcoms-projects.vercel.app>. Deployment is Preview, not Production. Password sign-in is enabled only for the approved test email. Public registration and Google/Discord remain disabled. Sensitive environment-variable metadata was read back for the exact branch and preview target. No production or unrelated-branch variables were created.

A real browser exercised the actual Vercel hostname and Supabase development project: password login, own-profile persistence across reload, role-injection rejection, customer denial from admin/teammate routes and logout followed by profileAPI401. No browser runtime errors. The provider created an ephemeral, admin-confirmed test fixture without sending mail. It was deleted after the test, and provider auth, profiles and account_roles were all read back empty. This verifies hosted password/session/profile integration, not new-user confirmation delivery or OAuth.

The ordinary Keychain CLI timed out reading the Supabase CLI management-token item. The already-authorized official Supabase CLI successfully retrieved this exact project's API keys instead. No Keychain permissions were changed. Only the publishable key was deployed; the service-role key was held in memory for fixture creation/cleanup and was never added to Vercel.

## Still unimplemented or unaccepted

Password recovery, signup confirmation delivery, owner-role bootstrap, Discord linking, avatar uploads and full profile parity remain open. Quotes are a tested pure module, not persisted FX, checkout or payment confirmation. Order frontend/realtime bindings, paid-order production, wallet spending and earnings ledgers, private proof/chat/reports, applications/support/admin commands, payouts and the singleton Discord worker remain tracked migration work in backend-salvage.md/json. The shared order SQL and HTTP foundation is implemented as described above; refund credits are ledger postings, not provider refunds or a spendable wallet. Original screens remain samples until their actual contracts are wired. Source preservation is complete; the marketplace rebuild is not.

Keep public signup and live money off until their provider, authorization, transaction and recovery tests pass. No production deployment, main merge or duoly.gg change occurred in this PR.
