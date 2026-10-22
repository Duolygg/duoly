# Duoly backend: rebuild brief

You're rebuilding the backend of **Duoly** (duoly.gg) in a new framework. The old version was Next.js 14 (App Router API routes) with NextAuth, and it stored everything in JSON files under `data/` with in-memory state on `globalThis`. Keep **all the behaviour below** but use the new stack's own idioms. Use a real database (Postgres is the plan) in place of the JSON files, and use realtime in place of polling wherever the stack allows it.

## What Duoly is

A marketplace where gamers book a paid **teammate** ("duo") who joins them in-game. The flow: the customer picks a game and a service, pays upfront, and the order enters a **shared live queue**. The first eligible teammate to accept gets it. They play, then upload screenshot proof, and the customer rates and tips. Based in Vienna, Austria. Prices are in EUR, with USD shown to some customers. Teammates are paid weekly in USD.

**Games** (id: name · what the in-game name is called): lol League of Legends · Riot ID, val Valorant · Riot ID, cs2 Counter-Strike 2 · Steam name, fn Fortnite · Epic name, cod Call of Duty · Activision ID, apex Apex Legends · EA ID, r6 Rainbow Six Siege · Ubisoft name, mr Marvel Rivals · username, ow Overwatch 2 · BattleTag, rl Rocket League · Epic name, tft Teamfight Tactics · Riot ID, fc EA SPORTS FC 27 · EA ID, arc ARC Raiders · Embark ID, mc Minecraft · Minecraft name, pu Pokémon Unite · trainer name. They are ordered by expected demand, and that order is used everywhere.

## Roles & auth

- Three roles: **customer** (the default for every account), **teammate**, **admin**. One dashboard per role: `/dashboard`, `/teammate`, `/admin`.
- **Owners** are the emails in the `ADMIN_EMAILS` env var. They are always admin and nobody can change that. An admin can't change their own role. Check roles on the server on every request. `/admin` returns 404 to non-admins.
- Admins **never play orders**. They watch and route orders (handover links). Teammate and admin accounts **can't book** orders.
- Sign-in methods: **Discord OAuth, Google OAuth, email + password** (scrypt hash with a random salt, timing-safe compare, password min 8 characters). Sessions are JWT cookies.
- Discord account linking: a Discord sign-in maps to an existing account if that Discord id was linked to it before, or if Discord's **verified** email matches a non-Discord account (then the Discord id gets linked to it). Otherwise it creates a new account whose id is the Discord id. Any account can also "Connect Discord" through a separate OAuth flow (state cookie). One Discord account can be linked to only one Duoly account.
- Every account that signs in is recorded (name, email, image, provider, firstSeen, lastSeen) so admins can find it.
- **Profile** (`/profile`): display name (2–32 chars), avatar (one of 10 presets or an upload: the browser crops it to 256², max 400 KB, magic bytes checked, filename is a hash of the user id plus random), country (from a fixed list with flags). Teammates also have a bio (160 chars) and languages (up to 6 of 16). The profile overrides the provider's name and picture everywhere.
- Display currency (EUR/USD) is saved on the account.

## Catalog & pricing

- Each game has services in tabs: `duo`, `other` (shown as "Teams"), `social`, `gg` (Gamer Girls), `training` (coaching). Each service has an id, title, tier line, description, EUR price per unit and an optional badge or "was" price. The unit is `game` for match-based games and `hour` for BR/sandbox games and most coaching. Every game also gets "Gamer Girl Duo" and "Gamer Girl Ranked" services, and most get "Play & Learn" (the first session is half price). The full catalog with all prices is in the old `lib/catalog.js`: port it 1:1.
- **Bundles**: three per game, built from the game's main service (3 / 5 / 10 units), with names per game ("Lane Phase", "Baron Call", "Elder Soul").
- **Quantity discount** on play sessions (never coaching): 3 → −10%, 5 → −15%, 10 → −25%. 1–10 units per order.
- **Rank pricing** (old `lib/ranks.js`): ranked services ask for the customer's rank and multiply the price by that rank's factor. The rank marked ×1 pays the list price, the range is about ×0.8 to ×1.6, and results round to .49/.99. Some services have their own ladder (League Arena, CS2 Wingman). Games with no ranked ladder (ARC Raiders, Minecraft), coaching, Gamer Girls and social modes use a flat price.
- **Servers/regions** per game (old `lib/servers.js`). The default is guessed from the browser's time zone. Minecraft takes free text instead (server name or own world, plus Java/Bedrock edition).
- **FX**: EUR→USD rate from the ECB daily reference rate (Frankfurter API first, the ECB XML feed as fallback). It's refreshed every 6 hours and persisted, with a fallback of 1.08 until the first fetch. A USD customer pays mid-rate +1% markup. Teammates and tips use the mid rate.
- **Platform fee 40%**: the teammate gets 60%. Payout = `max(0.99, round(amountEur × 0.6 × eurToUsd, 2) − 0.01)` in USD, stored on the order together with the fx rate it was booked at.

## Orders (the core)

Order fields: `id` (`DL-<seq>`), status `queued | in_progress | completed | cancelled`, game, title, badge, games (count), unit, gg flag, customer first name, customerId, avatar, flag, rank ("from"), region, note (200), ign (40), voice, amountEur, payout (USD), fxRate, `paid { total, currency, walletEur, charged, method, at }`, teammate snapshot, acceptedAt, completedAt, cancelledAt, cancelReason, refund, proof[], review, tip, rerolls, previousTeammates[], oldChats[], chat[], typing, handover, botHandover, discordPosts, ignoredBy[].

**Placing an order** (customer only, not blocked): **one open order per customer**, so placing again returns the existing one. The server validates game, units 1–10, total €0.99–1000, the region against the game's list, and ign ≥ 2 chars. Gamer Girl orders get flagged `gg`. A **wallet** can pay part or all of it (`useWallet`). The wallet pays first and the payment method is charged the rest.

> ⚠️ There's **no payment provider yet**: the old code trusted the client's `total` and only recorded `paid`. In the rebuild, compute the price **server-side** from catalog + rank + qty discount + FX, and create the order from the payment webhook (Stripe is the plan: cards, Apple/Google Pay, PayPal).

**Queue rules:**

- **Auto-cancel after 5 minutes** with no teammate. The full price (wallet part included) goes back to the customer as **wallet credit**. A sweep runs before any read or write of the queue, so a cancelled order can never be accepted.
- **Who sees what** (`canTake`): a regular teammate sees only orders for their **admin-approved games** and never Gamer Girl orders. A **Gamer Girl** teammate sees **only** GG orders, in every game. Enforce this on the server so ineligible orders never reach the browser.
- **Priority** = seconds (0–100) after an order is created before it shows up for a given person (and their bell rings). Effective = base (default 50, set by an admin) − buff/nerf tier points (Small +10, Buff +20, Big buff +35, Nerf −10, Big nerf −20, Heavy −35; lasts 24h, 7d or until removed) + **missed-order penalty** (+10 s per miss, cap 50, misses from the last 7 days, admins can "forgive" them). **Priority is admin-only.** Teammates never see their value or how many orders are hidden from them.
- **Missed order**: an order auto-cancels while a teammate was online, eligible, not busy, hadn't been re-rolled off it, and it had been visible to them for ≥ 60 s. That counts as "ignored by" them.
- **Accept**: requires the teammate role, a linked Discord, not suspended, the order still queued, released to them by priority (unless via a handover link), eligible, not the teammate's own order, and no other active order of theirs. First accept wins. If the order is already taken the answer is 409, and if it was cancelled it's 410.
- **Complete**: only the assigned teammate, with **1–5 screenshots of proof** (≤ 1.5 MB each, webp/jpg/png with magic bytes checked, stored privately). Only the order's customer, its teammate and admins can open them.
- **Customer cancel**: free while queued, refunded to the wallet. Not possible once accepted.
- **Re-roll**: the customer swaps teammate up to **2×** per order, only in the **first 5 min after accept**. The order goes back to queued with the 5-min timer restarted. The old teammate can never take it again from the queue (only via an admin's handover link). The chat is archived with the old teammate and the new one starts fresh.
- **Review**: once completed, one per order. 1–5 stars, text (500), up to 4 tags from a fixed list ("Great comms", "Shotcaller", "Super friendly", "Taught me a lot", "Carried hard", "Patient", "Fun to play with"), and an optional tip of 0–100 (100% goes to the teammate, converted to USD). The tip isn't charged yet: wire it to the payment provider.
- **Report**: the customer reports the current or last teammate, type `off_platform` ("Tried to move me off Duoly") or `toxic`, with text ≥ 10 chars and 1–5 screenshots, at most one per type per order. An admin approves (a **€50 bounty** is owed to the customer) or rejects it.
- **Handover link** (admin): a token link `/claim/<token>`, valid 30 min. The order stays in the queue meanwhile. Claim states: open / taken / expired / cancelled / invalid.
- **Data visibility**: teammates never see what the customer paid, the customer's id, queue timing (waited / auto-cancel time), previous teammates, old chats, proof, review, tip or ignoredBy. A re-rolled order looks fresh to them. The customer sees their whole order plus the teammate's name, picture, country, bio and languages.

**Order chat** (customer ↔ assigned teammate, only while in_progress): max 500 chars, the last 200 messages kept, a "typing" indicator (4 s), at most 20 messages/min, system messages on accept/complete/rate. A **safety filter** blocks messages about passwords, logins, account details, PayPal, Venmo, CashApp, IBAN, bank transfers, crypto, WhatsApp, Telegram, Snapchat and "pay me directly". Blocked messages are **never delivered**: the sender sees "Not sent: keep payments and account details on Duoly…", and the message is logged as a **flag** for admins (rule: Account access / Moving off Duoly / Off-platform payment). An admin marks each flag Warned or Dismissed, and warnings are counted per account.

## Money

**Customer wallet (EUR)** = refunds + cashback + level-up gifts + admin adjustments − wallet spent at checkout. It never goes below 0 and never expires.

- **Loyalty levels** by completed orders: Bronze 0 (1% cashback), Silver 100 (2%, €5 gift), Gold 250 (3%, €15), Platinum 500 (5%, €40), Diamond 1000 (7%, €100). Cashback on each completed order uses the level the customer had at that time. Refunded orders earn nothing and don't count toward the level.

**Teammate ledger (USD)**: one permanent entry per completed order: payout, deposit %, held, net, tip, rating, tags, text.

- **Trust levels** by completed orders set the **security deposit** held from each payout: Rookie 0 (10%), Trusted 100 (8%), Veteran 250 (5%), Elite 500 (3%), Legend 1000 (0%). Held deposits are released after **14 days** without a dispute.
- **Weekly payouts**: weeks run Friday 00:00 → Friday 00:00 and are paid on the Friday. Each row (week × teammate) = net + tips + deposits released that week + manual admin adjustments (± up to $1000, with a reason the teammate sees). Status: Accruing (current week) → Scheduled → Paid / On hold (with a reason). Admins can mark one paid, hold it, release it or "pay all". Nothing is sent yet: wire a payout provider (Stripe Connect is the plan).
- **Leaderboard**: week / month / all-time, global and per game. Points = 10 per order + 5 per 5-star review.
- **Teammate stats**: completed count, tier, held now, saved vs Rookie, average rating, tips, last 8 days of entries (the browser buckets them into local days), latest reviews.

**Admin refunds**: cancel a queued or in-progress order (full price to the wallet, reason recorded). Refund a completed order to the wallet: the teammate keeps their pay. Admin wallet adjustments for customers are ±€1000 with a reason and can't take the balance below 0.

## Presence ("online")

Teammate and admin dashboards **heartbeat every few seconds**. Not heard from for 20 s means offline. The heartbeat carries the online toggle, lastActive and the games switched on in the teammate's queue settings (filtered to their approved games). A teammate can go online only with Discord linked and while not suspended. Admins are always online. An admin can **force a teammate offline** (applied on their next heartbeat, with the reason). Presence is in-memory: in the rebuild, use the realtime/presence layer.

## Admin panel (`/admin`)

Overview (60-day daily revenue and fees excluding refunds, avg wait over 7 days, number online) · Live desk (queue with release progress, live, recent, cancelled, "not yet visible" count) · Orders (cancel, refund, handover) · Teammates (tier, rating, earned in 30 days, held, owed, warnings, status playing/online/offline, suspend/unsuspend with reason, balance adjust; you can't suspend someone mid-order) · Applications · Customers (orders, spent, wallet, level, block/unblock, wallet adjust) · Users (set role, set game access + Gamer Girl flag; you can't change the role of someone mid-order, and someone who stops being a teammate is forced offline) · Priority (breakdown per person, set/reset base, buff/nerf, forgive misses) · Payouts · Reports & safety (reports + chat flags) · Support inbox · **Audit log** (every admin action: who, action, target, detail; keep 2000) · Settings. Emails are masked in lists (`k•••o@gmail.com`).

## Teammate applications (`/apply`)

Fields: name, email, Discord, country, game, rank, region, role, link, hours (5–10/10–20/20–30/30+), why (600), services (Duo/Coaching/Social/Gamer Girl), and an "18+" confirmation. Only one pending application per email, max 30 per hour site-wide. Approving makes the account with that email a teammate with access to that game (or reports "no account yet" / "already teammate/admin").

## Support

- **Sparky** chat widget: guests are identified by a random httpOnly cookie, signed-in users by id. One open conversation per person. Status: `bot → waiting → open → closed`. Sparky is **rule-based, not AI**: it matches intents and answers with the person's **own live data** (customer: order status and time in queue, cancel/refund, wallet, re-roll/report; teammate: this week's payout and payday, deposit/tier, why they can't go online, why they get no orders, approved games, proof, Discord roles). Otherwise it falls back to an FAQ word-match, then offers a human. Quick-reply chips per role. Sparky never reveals priority. 15 messages/min limit.
- "Talk to a human" → status waiting, and the bot pings the admins' Discord channel (the first text channel with "admin" in its name, mentioning the `Admin` role). In the inbox an admin can reply (with their own name and picture), claim, hand back to Sparky, close, or mark seen. The Discord note is edited to say "✅ X is on it", "Closed by X" and so on. The inbox shows the person's context (teammate tier, games, owed, rating; customer wallet, level, active order).
- The **contact form** (`/contact`) lands in the same inbox and pings Discord. It has topics, an optional order id, a honeypot field, and a limit of 3 messages per 10 min per person.

## Discord bot (no library: raw gateway WebSocket + REST)

**Exactly one process may run the bot.** It runs alongside the server and needs `DISCORD_BOT_TOKEN`, plus optional `DISCORD_GUILD_ID` and `DISCORD_QUEUE_SILENT=1`.

1. **Gateway**: hello → identify → heartbeats, resume, exponential backoff, fatal close codes. Intents GUILDS, GUILD_MESSAGES, MESSAGE_CONTENT. Without the content intent (close code 4014) it reconnects with no intents and stays online without reading messages.
2. **Role sync every 5 s** (only changes are sent): `Teammate` = every teammate with Discord linked, `Online` = dashboard toggle on or playing an order, `In Session` = has an in-progress order. Admins get Online while their panel is open, and their Teammate role is never touched. Rate-limit retries are handled.
3. **Queue posts**: an order still unclaimed after **100 s** is posted in that game's channel (the `general` text channel under the category named after the game), mentioning `@Teammate`, with a "Take this order" link button (its own bot handover token, valid until the order's auto-cancel). It falls back to a text link when Discord rejects the button URL (e.g. localhost). When the order is taken, cancelled or re-rolled, the post is edited, and nothing is ever posted twice (key = orderId:rerollCount).
4. **Account requests**: in `general` channels, when someone **asks** for a game account ("need euw acc", "anyone has a pokemon unite account?"), the bot replies with `@here <user> needs an EUW Pokémon Unite account…`. The detector is strict about the ask and ignores talk about accounts (banned, my account, selling…). Limited to once per user per 10 min and once per channel per minute. The detector regex is in the old `lib/accountRequest.js`: port it 1:1.

## Other pages and content

Homepage (games, modes, bundles, live totals, login popup, FAQ, globe, live Vienna clock) · `/queue/[id]` order room · `/rules`, `/terms`, `/privacy` (Austrian Impressum fields: company, owner, address, register, VAT, still to be filled in) · `/creators` creator program (proposal only: viewers get 10% off their first order, creators earn 8/10/12% commission at 0/25/100 orders a month for 12 months, €50 payout minimum; **codes aren't tracked at checkout yet**).

## Env vars

`NEXTAUTH_URL` (site URL), `NEXTAUTH_SECRET`, `DISCORD_CLIENT_ID/SECRET`, `GOOGLE_CLIENT_ID/SECRET`, `ADMIN_EMAILS`, `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID`, `DISCORD_QUEUE_SILENT`. The Discord app needs redirect URIs for both sign-in and `/api/discord/link/callback`.

## Not built yet (do these as part of the rebuild or next)

1. Real database (users, accounts/roles, orders, chat, ledger, payouts, adjustments, priority, reports, flags, applications, support, audit) and file storage for avatars and proof.
2. Payments: Stripe checkout, server-side pricing, webhook-created orders, real tips and refunds (refunds currently go to the wallet only).
3. Payouts provider (Stripe Connect).
4. Realtime instead of polling (queue, order room, chat, presence, support).
5. Creator codes at checkout.
6. **Team orders** (queued next): one order filled by **several teammates**, priced by **seat count** (the "Teams" tab services like 5-stack fill, Flex Squad, Full Trio). Today every order has exactly one teammate.
