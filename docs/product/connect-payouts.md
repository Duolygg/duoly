# Stripe Connect payouts (ledger #14, phase 2, money step M9)

Phase 2 of the teammate payout rail (MONEY-RULES 6.3 "Rail, phase 2", E3). Phase 1, the manual
rail (weekly payout lines, payout details, admin Mark paid with method and reference), stays live
and is the fallback for every teammate without a ready Stripe account.

## What it does

- **Teammate desk** (payout section, `PayoutPanel.jsx`): a "Stripe payouts" box with the status
  (Not started, Pending verification, Ready, Restricted), "Set up payouts with Stripe" (creates one
  Express account and opens Stripe onboarding), "Continue setup with Stripe" / "Update details in
  Stripe" (a fresh account link) and "Refresh status". Stripe collects identity (KYC) and bank
  details. Duoly never sees the bank account.
- **Admin Payouts**: a Rail column (Stripe or Manual, with a note such as "Stripe pending
  verification", "transfer pending", "transfer reversed"). A Scheduled line of a teammate with a
  Ready account shows **Pay via Stripe**, every other Scheduled line shows **Mark paid** as before.
  "Pay all scheduled" only marks manual lines paid and skips Stripe-ready lines.
- Without the flag nothing changes: no Rail column, no Stripe box, no Stripe calls.

## Rules (unchanged from M2, enforced in the database)

- Same weekly lines, 10 USD minimum with carry forward, never a negative payout.
- Only Scheduled lines can be paid. On hold, carried, paid and running weeks are refused.
- Payout details (DAC7) are still required before any payout, also with Stripe.
- Rail selection: Stripe only when the teammate's account status is `ready` (transfers capability
  active and payouts enabled). Otherwise the line must be paid manually.
- One live transfer per line (unique index). Idempotency key `duoly-payout-<line id>-<attempt>`.
  The attempt only moves on after Stripe clearly refused the previous one (4xx). After a timeout
  or 5xx the same row, amount and key are reused, and a resumed press first lists the transfers of
  the line's `transfer_group`, so a retry never pays twice.
- While a transfer is pending the line cannot be marked paid by hand, held, or changed by an
  automatic order hold; a released hold goes into the next week instead.
- Recording checks the Stripe transfer's destination, amount and currency against the prepared
  row; a mismatch is not recorded and is audited for review.
- Reversals (`transfer.reversed`, `amount_reversed`): the reversed share in USD is owed again and
  counted in the payout week it is recorded in (line item `transfer_reversal`, shown as an
  adjustment "Stripe transfer reversed, owed again"). The paid line stays as history.
- Every action is audited: setup started, status changes, Stripe payout started, paid, failed,
  reversed, bank payout failed, mismatch and review cases.
- Every function that writes Connect or transfer state is granted to `service_role` only. The
  server re-checks the admin role and passes the actor; the database checks it again.

## Currency

Lines are in USD; the platform account is in Austria and settles in EUR (test balance: EUR only).

- Default `CONNECT_TRANSFER_CURRENCY=eur`: the transfer amount is `round(USD cents / rate)` at the
  **ECB EUR to USD mid rate** fetched when the transfer is prepared. The rate, its source and the
  EUR amount are stored on the transfer row and audited. If only the fallback rate is available,
  Pay via Stripe refuses ("Today’s ECB rate is not available yet").
- `usd` transfers the exact USD cents, but only works when the platform has a USD balance
  (multi-currency settlement or USD top-ups). Not available on the test account today.
- **Open point for the owner**: confirm EUR at the ECB mid rate on the payout day (teammates bear
  the rate move since booking, and Stripe converts EUR to their bank currency at its own rate), or
  pick a different rule (booking rate, USD balance, adding a margin). Nothing else is invented.

## Endpoints

| Route                                                                    | Who            | What                                                             |
| ------------------------------------------------------------------------ | -------------- | ---------------------------------------------------------------- |
| `GET /api/teammate/connect` (`?sync=1` re-reads the account from Stripe) | teammate       | `{ enabled }` or status                                          |
| `POST /api/teammate/connect` `{ action: onboard \| refresh, country? }`  | teammate       | account link URL                                                 |
| `POST /api/admin/payout-stripe` `{ payoutId }`                           | admin          | Pay via Stripe for one line                                      |
| `POST /api/webhooks/stripe` (existing)                                   | Stripe         | adds `transfer.created`, `transfer.updated`, `transfer.reversed` |
| `POST /api/webhooks/stripe-connect` (new)                                | Stripe Connect | `account.updated`, `payout.failed`                               |

Supported countries (Connect cross-border payouts from an EEA platform): EEA, UK, Switzerland, US
and Canada. The account country comes from the teammate's payout details country. Others stay
manual.

## Env

- `CONNECT_PAYOUTS_ENABLED=true` switches it on. Off by default. Also refuses live keys for now.
- `CONNECT_TRANSFER_CURRENCY=eur` (default) or `usd`.
- `STRIPE_CONNECT_WEBHOOK_SECRET` signing secret of the Connect endpoint.
- Uses the existing `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_*`, `AUTH_ORIGIN`.

## Stripe Dashboard steps (owner, test mode first)

The test platform has **not signed up for Connect yet**: `POST /v1/accounts` answers "You can only
create new accounts if you've signed up for Connect". So all Stripe calls were tested against a
mocked Stripe and signed test events. Before switching the flag on:

1. Dashboard, test mode, Connect (`https://dashboard.stripe.com/test/connect`): Get started, choose
   "Marketplace" style with **Express** accounts, the platform pays out (separate transfers, no
   `on_behalf_of`).
2. Complete the **platform profile** (business type, what teammates sell, who is responsible for
   losses and refunds: the platform).
3. Connect settings, Branding: name Duoly, icon, colour (shown in Express onboarding and emails).
4. Connect settings, Onboarding options / countries: allow the countries listed above, transfers
   capability only.
5. Developers, Webhooks:
   - existing platform endpoint `https://duoly.gg/api/webhooks/stripe`: **add** events
     `transfer.created`, `transfer.updated`, `transfer.reversed`;
   - **new** endpoint "Events on connected accounts" `https://duoly.gg/api/webhooks/stripe-connect`
     with `account.updated`, `payout.failed`; put its signing secret in
     `STRIPE_CONNECT_WEBHOOK_SECRET`.
6. Test: create a test balance (test card `4000000000000077` charges land in the available balance
   at once), onboard a test teammate with Stripe's test data, Pay via Stripe one line.
7. Live later: repeat 1 to 5 in live mode, review Connect pricing (monthly active account and
   cross-border payout fees), then a code change is needed (live keys are refused on purpose).

## Deploy order

1. Apply migration `20261026130000_connect_payouts.sql` (additive; old code never calls the new
   functions, replaced read models only add keys).
2. Deploy the code with `CONNECT_PAYOUTS_ENABLED` unset (manual rail unchanged).
3. Dashboard steps above, then set `STRIPE_CONNECT_WEBHOOK_SECRET` and
   `CONNECT_PAYOUTS_ENABLED=true` in test (preview) first.

## Tests

- `supabase/tests/connect_payouts.sql` (rollback only, build with
  `supabase/tests/build_connect_payouts_rollback.py`): rail selection, idempotency, only
  Scheduled, minimum and negative rules, DAC7 details, pending locks, mismatch, refusal and retry,
  late confirmation, reversals, audit, permissions.
- `tests/unit/connect-payouts.test.ts`: helpers, admin route, onboarding route, both signed
  webhook endpoints.
- `tests/teammate-browser/teammate-connect.spec.ts`, `admin-connect-payouts.spec.ts`.

## Legal (MONEY-RULES 8.3)

Stripe does KYC and sanctions screening for Connect accounts; manual transfers do not. DAC7 data
is still collected in payout details. Minimum age, US 1099 reporting and contractor status remain
open owner checks.
