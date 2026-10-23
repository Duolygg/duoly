# Payments (Stripe)

Owner decisions (2026-10-22): every payment method Stripe offers, Stripe receipts (no invoices), no VAT yet (no Stripe Tax), Duoly-branded order emails, refunds only as the exception.

## Flow

1. Home → "Continue to payment" → `POST /api/checkout` (signed-in customer, CSRF, one open order). The server prices the selection (`src/server/pricing`), stores a `checkout_intents` row and creates a Checkout Session in Elements mode (`ui_mode=elements`, EUR, inline `price_data`, `client_reference_id` = intent id, idempotency key `checkout_<intent>`).
2. `/checkout/<intent>` is Duoly's own page: a server-rendered order summary plus `CheckoutPanel`, which mounts Stripe's Express Checkout Element (Apple Pay, Google Pay, PayPal, Link) and Payment Element, themed through the Appearance API, with our own pay button. Stripe decides which methods to show (dynamic payment methods, Adaptive Pricing for non-EUR customers). Card-like methods confirm in place and the page polls `/api/checkout/<intent>/status` until the webhook has queued the order; redirect methods (Klarna, EPS, iDEAL…) come back through `/checkout/return`.
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

Stripe (test mode, account `acct_1UQsy7QtXk6y39Ra`): webhook `we_1UTS0QQtXk6y39RaQ94C402e` → `https://duoly.gg/api/webhooks/stripe` for `checkout.session.completed`, `.async_payment_succeeded`, `.async_payment_failed`, `.expired`. All available payment methods are switched on in the default payment method configuration.

Secrets live in macOS Keychain (`duoly-stripe-*`, `duoly-supabase-secret-key`, `duoly-payments-tick-secret`, `duoly-resend-send-key`), Vercel and Supabase Vault, never in the repo.

## Before live mode

Activate the Stripe account (business details), create live keys and a live webhook, swap the secret key for a restricted key, revisit VAT/Stripe Tax once registered, persist an ECB FX rate (payouts use the 1.08 fallback today), and decide how a failed capture is handled operationally (currently `capture_failed`, visible in `order_payments`).
