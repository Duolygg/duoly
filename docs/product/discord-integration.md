# Discord integration

Port of the original Next.js Discord features (`duoly-admin/duoly` at `7f0299f`: `lib/discordBot.js`, `lib/discordRoles.js`, `lib/discordQueue.js`, `lib/discordAccounts.js`, `lib/accountRequest.js`, `app/api/discord/link/*`) to Astro on Vercel with Supabase.

Discord application: **Duoly**, client id `1561389796239220816`. Client secret and bot token live in macOS Keychain (`duoly-discord-client-secret`, `duoly-discord-bot-token`, account `duoly-prod`), Supabase Auth (provider config) and Vercel env. Never in the repo.

## Phase 1: login and Connect Discord (this PR)

| Original                                                          | New                                                                                                                                                        |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NextAuth Discord provider                                         | Supabase Auth Discord provider (`/auth/oauth`, button on `/login`)                                                                                         |
| `GET /api/discord/link` + own OAuth code exchange                 | `POST /api/discord/link` (CSRF) → `supabase.auth.linkIdentity` (manual identity linking). Supabase does the OAuth exchange.                                |
| `DELETE /api/discord/link`                                        | `POST /api/discord/unlink` (CSRF). Refused when Discord is the only sign-in method (the original "connected automatically" case).                          |
| `lib/roles.js` `discordOf/linkDiscord/unlinkDiscord` (JSON store) | `public.discord_accounts`, maintained only by a trigger on `auth.identities`. Clients can read their own row and can never write a Discord id.             |
| "Connect your Discord to start" teammate gate                     | Gate card on `/teammate` when no link; `teammate_order_access.discord_id/verified_at` are mirrored from the link (queue acceptance already requires them). |
| `?discord=linked/cancelled/taken/failed/unavailable` notices      | Same values, via `/auth/callback?next=profile                                                                                                              | teammate`. |

Migration `20261023100000_discord_links.sql`, rollback-only checks in `supabase/tests/discord_links.sql`, unit tests in `tests/unit/discord-link.test.ts`.

Discord developer portal → OAuth2 → Redirects must contain `https://omnejesspybaxuacjlah.supabase.co/auth/v1/callback` (login and linking both return through Supabase).

## Phase 2: bot over HTTP (needs bot token and server id)

Vercel functions cannot hold the original gateway WebSocket or the in-process `setInterval` loops, so the loops become a scheduled tick:

- **Scheduler:** Supabase `pg_cron` + `pg_net` (free tier) calls `POST /api/discord/tick` every 10 seconds with a shared secret. Replaces `instrumentation.js`.
- **Role sync** (`lib/discordRoles.js`): Teammate, Online, In Session computed from the database; only changes are sent. Also triggered right after link/unlink/accept/complete.
- **Queue posts** (`lib/discordQueue.js`): order waiting 100 s → embed in the game category's `general` channel mentioning @Teammate; edited when taken, cancelled or re-rolled. Post ids stored in a `discord_order_posts` table instead of on the order object.
- **Interactions endpoint** (new): `/api/discord/interactions`, Ed25519-verified. Buttons to claim an order directly from the post, slash commands (`/queue`, `/online`).

## Phase 3: always-on gateway worker (optional, separate host)

Needed only for the bot's green "online" dot and reading chat messages (account-request replies from `lib/discordAccounts.js` + `lib/accountRequest.js`, which needs the Message Content intent). Runs as one small process outside Vercel (Fly.io or Railway); exactly one instance.
