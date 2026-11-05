# Play again

Owner decisions 2026-11-05. Migrations: `20261106170000_gold_rerolls_no_pick.sql` (the pick window
without the Diamond check) and `20261106180000_play_again.sql` (`customer_play_again`).
Server: `src/server/payments/play-again.ts`. Order room: `src/components/account/PlayAgain.jsx`.

## What the customer sees

Once the teammate has closed the order (status `completed`: proof and W/L submitted), the order
room shows **Play again with {name} · €8.07**. It books the same session again: same game, service,
units or bundle, server, rank, in-game name, note, voice and mood. A tap opens a short summary
(balance part, card part) and **Pay €8.07 and play again**.

- The price is today's price for that session, with PRO when they have it, never the creator
  first-order discount. Normally that is exactly what they paid. If the price changed since the
  button was shown, nothing is charged and the new price is shown.
- The Duoly balance pays first, then a card saved at checkout. US-dollar customers are charged the
  euro price (like tips).
- The button only shows while the teammate is online and free and can take that session. Otherwise
  the order room says why ("Alex is offline right now") and checks again every 20 seconds.
- Not offered for Twitch streamer bookings and the free monthly coaching (booked from the homepage).

## Paying

- **Saving a card.** Checkout sessions now carry the account's Stripe customer (one per account,
  shared with PRO: `src/server/payments/customer.ts`) and
  `saved_payment_method_options.payment_method_save: 'enabled'`. Stripe's payment form shows its
  own optional "save" box: that is the customer's consent. Cards saved that way (`allow_redisplay: 'always'`) are also prefilled at
  the next checkout.
- **One tap.** Play again is the customer's own click on the site, so the saved card is charged
  on-session: a PaymentIntent with `confirm: true` and manual capture, authorized now and captured
  when the order completes, like every card order.
- **3D Secure.** If the bank asks, the order room runs `stripe.handleNextAction` and then
  `POST /api/orders/:id/play-again/confirm` creates the order. If the tab closes after 3D Secure,
  the webhook does it (`payment_intent.amount_capturable_updated`). Abandoned checks hold nothing:
  the balance hold is released when the intent expires or the payment fails.
- **No saved card or a declined card.** The normal payment page opens with the session ready.
- **Balance covers everything.** No card at all (`create_wallet_order`).
- **An order opened meanwhile.** The authorization is voided at once, like a second checkout.

## The teammate

The new order's checkout intent carries `pick_source_order_id` = the order it replays, so
`create_paid_order` → `order_pick_start` gives that teammate the order **alone for 60 seconds**
(`order_teammate_picks`): it shows at once at the top of their desk as **Play again** with a Pass
button. Then it reaches the normal queue (and Discord after 100 seconds) like any other order. The
window ends early if they pass or go offline.

## Stripe setup

The webhook endpoint must also receive `payment_intent.amount_capturable_updated` (the 3D Secure
backup); `payment_intent.payment_failed` and `payment_intent.canceled` are already subscribed for tips.
