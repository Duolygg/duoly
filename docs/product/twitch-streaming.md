# Twitch streaming bookings

Selected teammates can offer paid sessions where a customer plays with them on their Twitch stream.
Migration: `supabase/migrations/20261105100000_twitch_streaming.sql`.

## Who can stream

- Admins grant streaming per game in **Admin → Users → Edit access → Twitch streaming**. Only games
  the teammate is already approved for are offered. Taking a game away from their order access also
  takes it away from streaming. Removing every streaming game switches streaming off.
- The streamer sees a **Twitch streaming** panel on their desk only while they have at least one
  streaming game.

## Streamer panel

- Hourly rate: €9.99 to €100 (EUR, like every price). The panel shows what they keep (60%, the same share
  as every order).
- Bookable lengths: any of 1 to 10 hours.
- Twitch username, **required to go online**. It is shown as a link on their card. Nothing checks
  with Twitch that they are actually live (migration `20261105190000_streamer_no_twitch_check.sql`
  removed the Helix check from `20261105150000_streamer_twitch_live.sql`): streamers who go online
  without streaming are suspended by an admin. The panel tells them so.
- **Go online for streaming** / **Go offline for streaming**.

A streamer is listed ("live") only while all of these are true: streaming is on, their desk is online
with a fresh heartbeat (20 s), they have a rate and a streaming game, Discord is verified, they are not
suspended, and they are not already taken.

**One booking at a time** (migration `20261105110000_streamer_one_booking.sql`). A streamer counts as
taken, and is hidden and can't be booked, while they play an order, while a booking for them waits in
the queue (until accepted or expired), or while another customer is paying for them (an open checkout
from the last 10 minutes). That avoids two bookings at once that would end in a cancellation. They
come back on their own once the session ends, the booking expires, or the other checkout is
abandoned. The same customer can retry their own checkout. Going offline on the desk or closing it
hides them right away.

## Customers

- The homepage shows **Live on Twitch** between the teammate carousel and checkout, only while someone
  is live. Each card shows the name, the hourly rate, the games, rating and the Twitch link.
- **Book** opens a short form: game (if they stream several), length, server, in-game name, note and
  voice. The total is the rate × hours.
- Payment is the normal checkout. The server re-checks that the streamer is live, streams that game and
  offers that length, and prices it from their saved rate. No PRO or creator discount and no creator
  code. Wallet balance is used first.

## Queue

- The order title is **Twitch stream with {name}**, so the streamer's name is on the order everywhere
  (desk, admin, customer, emails).
- The order is visible at once, and only to the booked streamer. It skips the priority delays and is
  never shown to other teammates, posted to Discord, or claimable through a handover.
- If the streamer does not accept within 5 minutes it is cancelled and refunded, like every queued
  order. A booked order can't be rerolled.
- Everything else in the priority system is unchanged.
