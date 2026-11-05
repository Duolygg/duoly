# Discord order posts (ledger #41)

Port of Fabian's `lib/discordQueue.js`. When an order has waited 100 seconds without a teammate, the bot posts it in that game's `#general` channel (the first text channel with "general" in its name under the category named after the game; falls back to the first text channel). Switched to `#lfd` on 2026-10-28 and back to `#general`, Fabian's original, on his request 2026-10-29. **Social and Gamer Girl orders** go to the general chat of the **Social / Gamer Girl** section instead (since 2026-11-05: the first category with "gamer girl" in its name, preferring one that also says "social"; without it they fall back to the game's section). It mentions the **Teammate** role and links its own handover link. When the order is taken, cancelled, expires or is re-rolled, the post is edited in place so nobody clicks a dead link.

## Design

Discord Components V2 (`flags: 32768`), checked against the Discord component reference:

- **Open post**: a ping line, then a container with a lilac accent (pink for Gamer Girl orders):
  game banner (media gallery, `public/discord/orders/<game>.webp`, 1200 x 400), a section with the game and order reference,
  service and size, rank, server and voice next to the game icon (thumbnail), the payout, the Gamer Girl rule,
  a live `<t:...:R>` auto-cancel countdown and two link buttons: **Take this order** and **Teammate desk**.
- **Closed post**: no ping, no banner. A compact container (mint when taken, muted otherwise) with what happened and a
  disabled status button (Order taken, Closed, Cancelled, Re-rolled). A taken post shows the teammate's first name and
  how long the order waited.
- Banners are built once with `node scripts/discord/build-order-banners.mjs` (Playwright renders HTML with the site fonts).
- `node scripts/discord/preview-order-posts.ts <channelId>` posts every state to a private channel with silent mentions.

## Privacy

The game channels are public. A post never carries the customer's name, Discord, in-game name, country, note or loyalty
level. The customer note (in the original post) is left out on purpose; the teammate sees it after taking the order.
Discord roles never grant site access: the link only works for a signed-in, verified teammate with access to that game.

## Rules

- One post per order and queue round (`discord_order_posts`, unique order and `queued_at`). A re-roll starts a new round.
- No post when fewer than 20 seconds are left before auto-cancel.
- The bot link (`order_handovers.kind = 'bot'`) is separate from an admin link; neither replaces the other.
  It expires at auto-cancel and never gives the order back to a teammate the customer switched away from (admin links still can).
- If Discord refuses a post, the reservation and its link are dropped and the next tick retries.
- A post deleted by a moderator counts as closed.

## Runtime

- pg_cron job `duoly-discord-orders-tick` every 10 seconds posts to `/api/discord/orders/tick` with the existing
  Vault secret `discord_roles_tick_secret` (same Bearer check as the role sweep). The nightly log prune covers it.
- Vercel env: `DISCORD_ORDER_POSTS_ENABLED=true` switches it on (needs `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID`,
  `SUPABASE_URL`, `SUPABASE_SECRET_KEY`). `DISCORD_ORDER_POSTS_SILENT=true` shows the role without notifying anyone.
- Bot permissions needed in the game channels: View Channel, Send Messages, Embed Links, Attach Files (only for previews).

## Deploy order

1. Merge the code (the endpoint answers `{ off: true }` without the flag).
2. Apply `20261026140000_discord_order_posts.sql`.
3. Set `DISCORD_ORDER_POSTS_ENABLED=true` and redeploy.
