# Payments (Stripe)

Owner decisions (2026-10-22): every payment method Stripe offers, Stripe receipts (no invoices), no VAT yet (no Stripe Tax), Duoly-branded order emails, refunds only as the exception.

Update (2026-10-22): Stripe Tax and post-purchase invoices are switched on in **test mode only** (`config.testMode`, i.e. an `sk_test_`/`rk_test_` key). Live keys keep the receipts-only, no-VAT behaviour above. In test mode the session adds `automatic_tax`, `tax_id_collection` and `invoice_creation`; the line item is `tax_behavior: inclusive` with tax code `txcd_20030000` (General - Services), so the customer still pays exactly the quoted EUR amount and the webhook amount check is unchanged.

When money goes back on an invoiced payment (`src/server/payments/invoice.ts`), the invoice is corrected too: a refund gets a credit note linked to that refund; a released authorization gets an out-of-band credit note if the invoice is already paid, or the invoice is voided while it is still open. The same applies to the duplicate-checkout release in the webhook (reason `duplicate`). If the invoice step fails, the money state stays final and the error lands in `order_payments.last_error` (never a retry, which could repeat the refund).

## Flow

1. Home → "Continue to payment" → `POST /api/checkout` (signed-in customer, CSRF, one open order). The server prices the selection (`src/server/pricing`), stores a `checkout_intents` row and creates an Embedded Checkout Session (`ui_mode=embedded_page`, EUR, inline `price_data`, `client_reference_id` = intent id, idempotency key `checkout_<intent>`).
2. `/checkout/<intent>` mounts Stripe's form. Stripe decides which methods to show (dynamic payment methods, Adaptive Pricing for non-EUR customers).
3. Stripe → `/checkout/return?session_id=…` polls `GET /api/checkout/<intent>/status` and forwards to `/queue/<order>`.
4. Webhook `POST /api/webhooks/stripe` (signature verified, `stripe_events` dedupe) → `create_paid_order()` → order `queued` + `order_payments` row → order-confirmed email via Resend.

## Money states

| Method                                                                     | At checkout | Teammate accepts | Cancelled or nobody in 5 min                         |
| -------------------------------------------------------------------------- | ----------- | ---------------- | ---------------------------------------------------- |
| Card, Apple Pay, Google Pay, Link, PayPal, Klarna, Amazon Pay, Revolut Pay | authorized  | captured         | authorization voided, nothing charged                |
| All other methods (EPS, iDEAL, Bancontact, TWINT, Wero, …)                 | captured    | nothing          | refunded (the exception)                             |
| Delayed methods (SEPA Direct Debit, bank transfer, Multibanco)             | processing  |                  | order is created only when Stripe confirms the funds |

The order state machine requests money actions by trigger (`order_payments.settle`); `settlePending()` applies them. It runs right after accept/cancel requests and every 20 seconds from `pg_cron` job `duoly-payments-tick` (`POST /api/payments/tick`, Bearer secret in Supabase Vault `payments_tick_secret`), which also expires stale queue orders. Stripe-paid orders never get wallet credit.

## Configuration

Vercel (production): `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SECRET_KEY`, `PAYMENTS_TICK_SECRET`, `RESEND_API_KEY`, `EMAIL_MODE`, `EMAIL_FROM`, `EMAIL_REPLY_TO`, `EMAIL_SITE_URL`. Without the Stripe/Supabase values the homepage keeps the sample flow.

Stripe (test mode, account `acct_1UQsy7QtXk6y39Ra`): webhook `we_1UTS0QQtXk6y39RaQ94C402e` → `https://duoly.gg/api/webhooks/stripe` for `checkout.session.completed`, `.async_payment_succeeded`, `.async_payment_failed`, `.expired`. All available payment methods are switched on in the default payment method configuration. Test-mode tax and invoices need, in the test Dashboard: Tax settings with a head-office address (otherwise session creation fails), a test VAT registration (otherwise tax is 0), and Settings → Customer emails → successful payments on (otherwise invoices aren't emailed). Invoices for Checkout one-off payments are billed per invoice in live mode.

Secrets live in macOS Keychain (`duoly-stripe-*`, `duoly-supabase-secret-key`, `duoly-payments-tick-secret`, `duoly-resend-send-key`), Vercel and Supabase Vault, never in the repo.

## Local testing

1. Copy `.env.example` to `.env` and fill the Stripe block with **test** keys (Dashboard → Developers → API keys, test mode), plus `SUPABASE_URL`, `SUPABASE_SECRET_KEY` and the auth values (checkout needs a signed-in account).
2. Install the [Stripe CLI](https://docs.stripe.com/stripe-cli) (Windows: `scoop install stripe`; macOS: `brew install stripe/stripe-cli/stripe`) and run `stripe login` once.
3. Run `pnpm stripe:listen` next to `pnpm dev`. It forwards the four Checkout events to `localhost:4321/api/webhooks/stripe` and prints a `whsec_…` secret; put that in `STRIPE_WEBHOOK_SECRET` and restart `pnpm dev`. The secret stays the same for your CLI login, so this is a one-time step.
4. Pay with test card `4242 4242 4242 4242` (any future expiry, any CVC). The listener should log `checkout.session.completed` → `[200]`, and the return page forwards to `/queue/<order>`. A `[503]` means `STRIPE_WEBHOOK_SECRET` is missing; `[400]` means it doesn't match the running listener.
5. Accept/cancel settlement runs right after those actions. For the stale-order sweep, call the tick by hand: `curl -X POST -H "Authorization: Bearer $PAYMENTS_TICK_SECRET" localhost:4321/api/payments/tick`.

## Before live mode

Activate the Stripe account (business details), create live keys and a live webhook, swap the secret key for a restricted key, register for VAT (OSS) and then drop the `testMode` gate on tax and invoices, persist an ECB FX rate (payouts use the 1.08 fallback today), and decide how a failed capture is handled operationally (currently `capture_failed`, visible in `order_payments`).
