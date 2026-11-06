# Team orders (several teammates on one order)

Status: **built, not yet live** (migration `20261106190000_team_orders.sql`). Fabian's decisions
from 2026-10-30 and 2026-11-06 are below; the payment approach was agreed with Sebastian before
building.

**Rollout order matters.** Deploy the app first, then apply the migration. The app reads the new
`team` and `seat` fields as optional, so it works against the old database. The order screens of the
app that is live now would reject the new fields if the migration went first.

## Why

The homepage already shows a "Teams" tab with 21 services (Flex Squad, Ranked 5s, Clash Roster, Stack
Fill, 5-Stack Premier, Full Squad and so on), but checkout refuses them ("Teams services are not
supported", `src/server/pricing/index.ts`), because every order has exactly one teammate. The backend
brief already lists this as the next step ("Team orders: one order filled by several teammates, priced
by seat count").

## Fabian's decisions (2026-10-30)

1. **Seats.** On Teams services the customer picks how many teammates they need. Duo, Coaching,
   Gamer Girl and Social stay at one teammate.
2. **All or nothing.** The session starts only when every seat is taken. If not every seat is taken
   within the 5 minutes, the whole order is cancelled, teammates who took a seat are released, and the
   customer gets everything back.
3. **Price per seat.** The service price applies per teammate: Flex Squad €7.99 per game × 3 seats =
   €23.97 per game, bundle discounts as usual. Each teammate earns the usual 60% of their seat.
4. **One group chat** for the customer and all their teammates.

## Decisions from 2026-11-06

5. **Party modes too.** Besides the 21 Teams services, these can bring friends (1 seat by default):
   League Swiftplay, ARAM Night and Normal Draft (up to 4), CoD Zombies Run (up to 3), Minecraft
   Manhunt and Minigames Night (up to 3). The rules live in `src/contracts/seats.ts`.
6. **Group prices keep their total.** Apex Full Trio, ARC Raiders Full Squad and Escort Run are
   always 2 seats at the listed price (e.g. €17.99 an hour split €9.00 + €8.99), not doubled.
7. **Homepage:** a "How many teammates" picker next to "How many games", styled like it, only on
   group services (owner-approved; the PR needs the `design-approved` label).

## Proposed seat limits

Team size minus the customer; default is the most seats, so "fill my five" is one click.

| Game          | Service                             | Seats  |
| ------------- | ----------------------------------- | ------ |
| League        | Ranked 5s, Flex Squad, Clash Roster | 1 to 4 |
| Valorant      | Stack Fill, Premier Roster          | 1 to 4 |
| CS2           | 5-Stack Premier, FACEIT Stack       | 1 to 4 |
| Fortnite      | Squad Fill                          | 1 to 3 |
| Fortnite      | Tournament Teammate                 | 1 to 2 |
| Call of Duty  | Warzone Quad Fill, Ranked 4-Stack   | 1 to 3 |
| Apex          | Full Trio                           | 2      |
| Rainbow Six   | 5-Stack Fill                        | 1 to 4 |
| Marvel Rivals | 6-Stack Fill                        | 1 to 5 |
| Overwatch     | 5-Stack Role Queue                  | 1 to 4 |
| Rocket League | 3v3 Standard                        | 1 to 2 |
| EA FC         | Clubs Lineup                        | 1 to 5 |
| ARC Raiders   | Full Squad, Escort Run              | 2      |
| Minecraft     | Server Squad                        | 1 to 3 |
| Pokémon Unite | Full Squad                          | 1 to 4 |

Apex Full Trio and both ARC Raiders squads are fixed at 2 seats with a group price (decision 6).

## Design: a team is a group of linked seat orders

One checkout for N seats creates **N normal orders** (one per seat) that share a `team_id`. Each seat
keeps everything that already works per order: the assignment, completion, earnings, payout, review,
tip, reports and cashback. The team layer adds:

- **Taking a seat.** Any eligible teammate can take a free seat, one seat per teammate per team. The
  seat goes to `in_progress` as today, but the team is **waiting** until every seat is taken. Teammates
  who already took a seat and the customer see "Waiting for 1 more teammate".
- **Team full.** When the last seat is taken, the team starts: the group chat opens, the customer sees
  everyone, and the payment is captured.
- **Team not full in time.** At the 5 minute mark, every seat is cancelled, including taken ones: their
  assignments end with a new reason `team_incomplete`, no earning is recorded, and the payment is
  released or refunded in full.
- **Re-roll** replaces one seat, only after the team has started.
- **Discord** gets one post per team ("Flex Squad · 2 of 3 seats taken"), not one per seat. "Take this
  order" takes the next free seat.
- **Priority, Diamond pick and free coaching** do not apply to team orders.

### Payment (as built)

Today `order_payments.stripe_payment_intent_id` is unique, so one Stripe payment belongs to one order.
The card is authorized at checkout and captured when the teammate accepts (`src/server/payments/settle.ts`),
and released on cancel. For teams:

- The one payment row and the wallet entries belong to the **lead seat** (seat 1); `order_teams`
  carries the team total and wallet part. Each seat carries its share of the price (rounding on the
  lead) and the usual payout of one seat.
- **Capture once**, when the last seat is taken. Never per seat.
- **Release or refund in full** if the team does not fill.
- Seats create no refund credits while the team waits. After the start, a seat that ends cancelled
  (a switched teammate nobody replaced within 5 minutes) gives its share back as Duoly balance.
- PRO and creator discounts are worked out on the team total (Duoly covers them, payouts unchanged).
  Cashback is worked out on the lead from the team total, less seats already credited back.
- Admins refund a whole team from any of its seats; a Stripe refund marks every seat refunded.

### Group chat

Chat stays bound to each seat's assignment, and every message is copied into the other open seats'
chats (`order_team_chat_mirror`). Other teammates show as sender `mate`, so nobody sees a colleague's
message as their own. A teammate who joins gets the last 50 messages copied in, plus "X joined the
team · 2 of 3 seats taken" and "Everyone is here" lines. A re-rolled teammate loses access as today.
Moderation and flags run on the sender's own message, as before.

### Locking

Seat order row, then team row, then chat rooms in seat order. Only taking a seat and cancelling one
lock the team row. A team cancel never waits on a seat another transaction holds (it skips it), and
`order_sweep` ends any skipped seat of a cancelled team a moment later.

## Build order (done, except going live)

1. Database: `team_id` and `seats`, taking a seat, team waiting, team full, all-or-nothing cancel
   (migration, applied by Sebastian).
2. Payment: team capture and release (with Sebastian).
3. Checkout and homepage: seat picker on Teams services, price per seat, Teams unblocked.
4. Teammate desk and customer order page: seats, waiting state, team members.
5. Group chat.
6. Admin views and Discord posts.
7. Tests for every step, including a full test order with Sebastian.
