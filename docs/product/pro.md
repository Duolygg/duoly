# Duoly PRO (ledger #39, money step M8)

Optional membership: €4.99 a month, 7 days free. MONEY-RULES section 7, decisions R1 to R6 (owner approved all defaults).

## Rules enforced

| Rule                                                          | Where                                                                                                                                                                  |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1 price 4.99 EUR monthly                                     | Stripe Price with lookup key `duoly_pro_monthly`; `isProPrice` refuses anything else                                                                                   |
| R1 10% off every order, on top of bundles                     | `src/server/pro/discounts.ts` from the server quote, before the wallet split; `checkout_intents.pro_discount_cents` plus the guard trigger (only `is_pro()` customers) |
| R1 priority matching                                          | `order_priority_boost_snapshot` writes reason `pro` (M7 head start)                                                                                                    |
| R1 / R2 unlimited re-rolls, still only 5 minutes after accept | `reroll_order`: the limit of 2 applies only when `is_pro()` is false                                                                                                   |
| R1 7-day trial                                                | `subscription_data.trial_period_days = 7` when `pro_trial_eligible()`                                                                                                  |
| R3 Duoly pays the discount                                    | `payout_usd_cents` is never changed by the discount                                                                                                                    |
| R4 one trial per customer                                     | `pro_trial_eligible()` is false after any earlier subscription                                                                                                         |
| R4 one trial per card                                         | `pro_trial_cards` by card (or SEPA) fingerprint; a reused card ends the trial at once (`trial_end: now`)                                                               |
| R5 no cashback, no loyalty on the fee                         | the fee lives only in `pro_invoices`; no wallet entry, no order                                                                                                        |
| R6 3-day grace                                                | `is_pro()` counts `past_due` for 3 days from the first failed renewal event                                                                                            |

## Discount stacking (open point)

MONEY-RULES does not decide how the creator first-order 10% and the PRO 10% combine. They never stack: the larger single discount applies and a tie goes to PRO (`checkout_intents_one_discount` enforces one). Owner to decide.

## Flow

1. `/pro` (customer only, 404 while `PRO_ENABLED` is off) posts to `/api/pro/checkout`, which links one Stripe customer per account and returns a Checkout Session client secret (`ui_mode: elements`, `mode: subscription`).
2. Checkout Elements confirms; the customer lands on `/dashboard?pro=welcome#pro`.
3. The signed webhook re-reads the subscription from Stripe and writes it through `pro_apply_subscription` (idempotent, stale events ignored, a second live subscription is cancelled).
4. Manage PRO on the dashboard opens the Stripe Customer Portal (`/api/pro/portal`) for cancel and card change. Cancel takes effect at period end.

## Configuration

- `PRO_ENABLED=true` switches PRO on (off by default, so it ships dark).
- `STRIPE_PRO_PORTAL_CONFIG=bpc_...` (optional) picks the PRO portal configuration.
- `node scripts/stripe/setup-pro.mjs` creates the product, price and portal configuration (test keys only, idempotent).
- Webhook endpoint events to add: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed` (`checkout.session.completed` is already subscribed).

## Deploy order

1. Apply migration `20261026120000_pro_subscription.sql`.
2. Deploy the code (PRO stays off).
3. Add the webhook events, set `STRIPE_PRO_PORTAL_CONFIG`, then `PRO_ENABLED=true`.
