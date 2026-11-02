# What the customer paid, in their currency

Owner request 2026-11-02. A US customer sees dollar prices on the homepage, and Stripe (Adaptive
Pricing) charges them in dollars, but the order room showed the euro price. It now shows what they
paid, and they tip in dollars too.

## Order total and method

- Orders are still priced and created in EUR. Stripe may present and charge the card part in the
  customer's currency; `order_payments` already stored that amount, currency and payment method.
- `order_customer_dto` gains `payment` (`amount_minor`, `currency`, `method`, `wallet_eur_cents`).
- `paidOf` in `src/components/account/dashboard-data.js` turns it into what the order room and the
  dashboard show:
  - card part charged in USD, no wallet part: the USD amount Stripe charged (e.g. $18.91);
  - EUR, any other currency, or part paid from the wallet: the EUR price;
  - method: the Stripe payment method type as customers know it (Card, PayPal, Klarna…; Apple Pay
    and Google Pay arrive as Card), `+ Duoly balance` when the wallet paid part, `Duoly balance`
    when it paid all.
- When the order was charged in USD, the rest of the order room uses `$` too (report bounty, tips).

## Tips in dollars

- The tip buttons follow the order's currency: $2 / $5 / $10 / Other ($2 to $100) for a USD order.
- The tip is still charged in EUR. The server converts the dollar amount at the customer rate (ECB
  rate + 1%, the rate the homepage shows USD prices at): $5.00 at 1.0908 is €4.58.
- `order_tips.shown_currency` / `shown_amount_cents` keep the $5.00 so the order room repeats it
  back ("You rated Mia 5/5 and tipped $5.00"); the payment step says "$5.00 tip (charged as €4.58)".
- `order_tip_set_shown` (service role) records it right after `order_review_tip`; if that fails the
  tip still opens, shown in EUR.

## Deploy order

The code goes live **first**: the customer contracts accept `payment` and `tip.shown` being there or
missing, but the code live before this change rejects keys it doesn't know.

1. Merge and deploy the code.
2. Apply `supabase/migrations/20261102120000_shown_currency.sql`.

Until step 2, the order room works as before: the EUR price, "Stripe checkout", and tips in EUR.

## Dashboard, PRO and level-up gifts

- The customer dashboard uses the same currency as the homepage (the account's, then the one
  picked on this browser): wallet, cashback, refunds and rewards show in dollars for a USD
  customer, at the customer rate. Orders show what was charged.
- PRO is €9.99, or $9.99 for a USD customer, charged as its euro equivalent like dollar tips (see `pro.md`).
- Level-up gifts are fixed amounts in the customer's currency: €5 / €15 / €40 / €100, or exactly
  $5 / $15 / $40 / $100. A USD gift is credited as the EUR amount worth that many dollars at the
  customer rate of the order that reached the level (`20261102130000_usd_level_gifts.sql`), so
  the wallet shows $5.00. The migration doesn't depend on any code and can be applied any time.
