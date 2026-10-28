# Discord gateway (ledger #27 and #38)

Port of Fabian's `lib/discordBot.js`, `lib/discordAccounts.js` and `lib/accountRequest.js`. Vercel functions cannot
hold a connection open, so the live Discord connection runs in a Cloudflare Worker with one Durable Object on the Duoly Cloudflare account (duolygg@proton.me, Workers Free)
(`workers/discord-gateway`, free plan).

## What it does

- Keeps the bot **online** in the server (presence only, no activity line), like the original.
- Reads the general chats for **account requests** ("need euw account", "anyone has an acc?") and replies to the
  message with `@here <user> needs an EUW Valorant account. Got one to spare? Reply here or DM them.`
  Only channels with "general" in the name, at most once per person every 10 minutes and once per channel per minute.
  The matcher is `src/server/discord/account-request.ts`, unchanged from the original.
- Needs the Message Content intent (on). Without it the bot stays online without reading.

Role sync (#40) and order posts (#41) stay on Vercel and pg_cron; they only need Discord's REST API.

## How it stays up

- One Durable Object named `bot` holds the gateway WebSocket (hello, identify or resume, heartbeats, zombie
  detection, reconnect with backoff up to 60 s, fatal close codes stop it).
- An alarm every 30 s and a cron trigger every minute wake the object and reconnect if needed.
- `GET https://duoly-discord-gateway.duoly.workers.dev/status` shows status, bot name, whether it reads
  messages, online since and the last heartbeat ack. No secrets.
- Cost: one object in memory all day is about 10,800 GB-s, under the free 13,000 GB-s per day.

## Deploy

```sh
cd workers/discord-gateway
wrangler deploy
security find-generic-password -s duoly-discord-bot-token -w | wrangler secret put DISCORD_BOT_TOKEN
curl https://duoly-discord-gateway.duoly.workers.dev/status
```

Wrangler is not a repo dependency (it is large and only needed to deploy); use a global or tool install.
Run only one copy of the gateway with the bot token.
