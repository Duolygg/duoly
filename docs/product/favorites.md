# Favorite teammates

Migration: `supabase/migrations/20261106150000_customer_favorites.sql` (owner decisions 2026-11-05).

## Customers

- Every customer can favorite a teammate they played with: the heart on the teammate card in the
  order room (once someone accepts), under the review thanks, or next to them in **Your teammates**
  on the dashboard. Up to 100 favorites.
- **Favorites** on the dashboard (also in the account menu on every page) lists them online first,
  then playing an order, then offline, with how many games you played together.
- **Rebook** opens checkout on the game you last played together.
- Favorites replaced the Diamond "Pick any teammate" perk, which ended with
  `20261106170000_gold_rerolls_no_pick.sql` (Diamond gets Duoly PRO free instead).

## Teammates

A teammate a customer favorited sees that customer's orders **the moment they reach the normal
queue, with no priority delay** (no base delay, adjustment, penalty, high-value or Elite rule, and
no 100-second wait on Apex duo orders). Teammates who are not favorites keep their usual delay, so
the order reaches more teammates the longer it waits.

Unchanged for favorites:

- A pick window still open when the pick perk ended: favorites see the order when it ends, like the
  normal queue does.
- Game access, Gamer Girl access, a plus-only duo level, queue settings, suspension, Discord
  verification, being busy, and re-roll exclusions.
- Twitch bookings go only to the booked streamer, never to other teammates and never to Discord
  (`20261105100000_twitch_streaming.sql`).
- Discord posts still go out 100 seconds after the order reaches the normal queue.

Teammates never see delay numbers. Customers are told only that favorites "see your orders first".

## Privacy

Teammate user ids never reach the browser. The browser names a teammate by a handle: one of the
customer's own orders with them (the latest completed, not refunded one when there is one).
