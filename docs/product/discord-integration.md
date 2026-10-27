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

Vercel functions cannot hold the original gateway WebSocket or the in-process `setInterval` loops, so the loops become event hooks plus a scheduled tick.

### Role sync (ledger #40, migration `20261025100000_discord_role_sync.sql`)

Port of `lib/discordRoles.js` in `src/server/discord/role-sync.ts` (engine) and `src/server/discord/role-hooks.ts` (hooks and tick endpoint).

- **Rules** (unchanged from the original): Teammate = every teammate with Discord linked, removed when they stop being a teammate. Online = desk toggle on and checking in within 20 seconds, or playing an order. In Session = an order in progress. Admins get Online while the admin panel checks in, never In Session, and the bot never touches an admin's Teammate role. Suspended teammates keep Teammate and never get Online. Only linked accounts that are members of the server get roles.
- **Roles by name**: `GET /guilds/{id}/roles`, case-insensitive `teammate`, `online`, `in session`, cached 10 minutes per instance. Without Online or In Session the sync pauses; without Teammate only the other two are synced. The bot only ever calls `PUT`/`DELETE /guilds/{id}/members/{user}/roles/{role}` for those three ids, so every other role (games, modes, Admin, Bot) is never touched.
- **Only changes**: the applied state lives in `public.discord_role_sync` (service role only). A member is read from Discord when unknown, every 10 minutes to catch hand-made changes, and every 2 minutes while not in the server (404). `429` waits `retry_after` (at most 3 tries), `403` is logged once ("give the bot Manage Roles and drag its role above Teammate, Online and In Session"), `404` marks the account as not a member. Unknown role (code 10011) refreshes the role lookup.
- **Wanted state** comes from `public.discord_role_facts(p_users, p_order)`, a security-definer function only `service_role` may call.
- **Events** (sync of the affected people right after the action succeeded, capped at about 3 seconds, never changes the response): Discord link or sign-in callback, unlink, admin role change, suspend or reinstate, admin set offline, desk on or off, admin panel open or close, accept, complete, reroll, handover claim, admin cancel and handover link.
- **Sweep**: pg_cron job `duoly-discord-roles-tick` (every 30 seconds, same pg_net pattern as `duoly-payments-tick`) posts to `POST /api/discord/roles/tick` with `Authorization: Bearer <Vault discord_roles_tick_secret>`. It reconciles every linked teammate and admin plus everyone the bot gave roles to (unlinked accounts lose them). Presence going stale therefore drops Online within about 50 seconds. `duoly-discord-roles-log-prune` keeps a week of that job's run log.
- **Switch**: nothing happens unless `DISCORD_ROLE_SYNC_ENABLED=true`, `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID`, `SUPABASE_URL` and `SUPABASE_SECRET_KEY` are set. The tick additionally needs `DISCORD_ROLES_TICK_SECRET` (at least 32 characters) in Vercel and the same value as Vault secret `discord_roles_tick_secret`. The token is never logged or returned.

Release: deploy the code first (feature off), apply the migration, add the Vault secret and the Vercel env, then switch `DISCORD_ROLE_SYNC_ENABLED=true`. Rollback-only checks: `supabase/tests/discord_role_sync.sql`; unit tests: `tests/unit/discord-role-sync.test.ts`, `tests/unit/discord-role-hooks.test.ts`.

### Still to do

- **Queue posts** (`lib/discordQueue.js`, #41): order waiting 100 s → embed in the game category's `general` channel mentioning @Teammate; edited when taken, cancelled or re-rolled. Post ids stored in a `discord_order_posts` table instead of on the order object.
- **Interactions endpoint** (new): `/api/discord/interactions`, Ed25519-verified. Buttons to claim an order directly from the post, slash commands (`/queue`, `/online`).

## Phase 3: always-on gateway worker (optional, separate host)

Needed only for the bot's green "online" dot and reading chat messages (account-request replies from `lib/discordAccounts.js` + `lib/accountRequest.js`, which needs the Message Content intent). Runs as one small process outside Vercel (Fly.io or Railway); exactly one instance.
