# Public teammate profiles: system plan

Status: draft for owner review, 2026-11-12. Design direction: **B, Broadcast** (`~/.hermes/cache/scratch/profiles-design/B-broadcast/`). Nothing built yet.

## 1. What already exists (verified in the code)

| Need | Exists today | Where |
|---|---|---|
| Display name, avatar (10 presets), country | Yes | `profiles` (`name`, `image`, `country`), account foundation migration |
| Bio (max 160) and languages (max 6) | Yes, teammates only, already shown to customers in orders | `profiles.bio`, `profiles.languages`; edited on `/profile` (`src/components/account/Profile.jsx`) |
| Games a teammate may play | Yes | `teammate_order_access.approved_games`, `enabled_games`, `gg_access`, `duo_level` |
| **Verified rank per game** | **No.** Only the rank typed into the application (one game, free text) | `teammate_applications.rank` |
| Roles, agents, champions per game | **No** | |
| Sessions completed, trust tier (Rookie to Legend) | Yes, computed from completed orders | `teammate_earning_entries`, `src/design-reference/lib/trust.js` |
| Rating and review tags | Yes | `order_reviews` (`rating`, `text`, `tags`) |
| Win rate | Yes, from match reports | `order_match_reports`, `performance_scores` |
| Online now | Yes | `teammate_presence` (online and last_seen_at) |
| Favorite a teammate | Yes, but only through one of your own orders | `customer_favorites` (`20261106150000`); favorites see your order the moment it queues, no priority delay |
| Book the same teammate again | Yes, only after a completed order (Play again, 60 second exclusive window) | `order_teammate_picks`, `order_pick_candidate` needs a completed source order |
| **Book a specific teammate you never played with** | **No** | |
| Sitemap | Static list only | `src/pages/sitemap.xml.ts` reads `INDEXABLE_PATHS` in `src/site/seo.ts` |
| IndexNow | After every deploy, sitemap only | `scripts/indexnow.mjs` |
| Off-platform contact filter | Yes | `BLOCKED` in `src/design-reference/lib/chatRules.js` |
| Game pages | SSR, data-driven hubs | `src/pages/games/[game].astro`, `src/components/seo/GameHub.astro` |
| Rendering | Every page server-rendered per request on Vercel | `astro.config.mjs` (`output: 'server'`) |

Rule carried over from favorites: **teammate user ids never leave the database.** Public pages address a teammate by a public slug only.

## 2. Pages and where they live

| URL | What | Indexing |
|---|---|---|
| `/teammates/<slug>` | The profile (design B) | Indexed only when it passes the quality rule (section 5) |
| `/teammates` | Directory: all published teammates, filter by game, online first | Indexed once at least 3 profiles qualify |
| `/games/<game>` (existing) | New section "Teammates for <Game>": up to 6 cards, online first, link to directory | Unchanged |
| `/profile` (existing) | New "Public profile" settings block for teammates | Not indexed |
| Admin, Teammates screen (existing) | Verify ranks per game, unpublish a profile, see reports | Not indexed |

## 3. Buttons and links (placement map)

**On the profile**
| Place | Element | Behaviour |
|---|---|---|
| Hero, next to name | Online pill | Live presence. Offline shows "Last online today" only if under 24 h, else nothing |
| Hero, primary | **Book with Nyx** (online) | See booking flow, section 6 |
| Hero, primary when offline | **Book a Valorant teammate** | Normal booking for the featured game; secondary "Save Nyx" |
| Hero, secondary | Coaching with Nyx | Only if the teammate offers coaching for that game |
| Hero, small | Save (heart) | Adds to favorites (customer must be signed in) |
| Hero, small | Share | Copies the link. Teammates share their own page on socials: free traffic |
| Price | "from €6.49 per game" once, beside the primary button | Live price from the pricing engine (`hubPrices`), never typed |
| Games section | Per game: rank, roles, agents, "Book Valorant with Nyx" text link | Same flow as primary |
| Mobile | Sticky bottom bar with the primary button only (no second price) | |
| Bottom | "More Valorant teammates": 3 mini cards, then "See all teammates" | Internal links |
| Breadcrumb | Duoly / Teammates / Nyx | BreadcrumbList data |

**Elsewhere**
| Place | Link |
|---|---|
| Game page section | Teammate cards to profiles, "See all <Game> teammates" to directory |
| Order room and review screen, teammate card | "View profile" (only if published) |
| Dashboard "Your teammates" (favorites) | Name links to profile if published |
| Teammate desk header | "Your public profile: On/Off" with link to settings and to the live page |
| Main nav and footer | "Teammates". **Fabi's design area**: needs his OK and the `design-approved` label |
| `llms.txt` | Add `/teammates` with one line |

## 4. Data model (one new migration)

`teammate_public_profiles`
- `user_id` primary key, references profiles
- `slug` unique, `^[a-z0-9-]{3,24}$`, reserved list (admin, duoly, support, teammates, login and similar), chosen at first publish, defaults from the display name
- `published` boolean default false, `published_at`, `updated_at`
- `accent` one of 8 curated keys, `banner` one of 4 keys
- `featured_game` must be in `approved_games`
- `vibe_tags` up to 3 from a fixed list
- `show_country` boolean default false
- `coaching` boolean (offers coaching on this profile)
- `admin_hidden` boolean plus reason (moderation)

`teammate_public_slug_history` (old slug, user_id, retired_at) for 301 redirects after a rename.

`teammate_game_ranks` (user_id, game, `rank`, `peak_rank`, `roles` text[], `picks` text[] (agents or champions), `verified_at`, `verified_by`)
- Teammate edits roles and picks. **Only an admin sets rank and peak and marks them verified.** Ranks must come from `ranks.js` for that game.

Read path: one security-definer function `public_teammate_profile(p_slug text)` returning only whitelisted fields (no ids, no email, no Discord, no earnings, country only if `show_country`), plus `public_teammates(p_game text, p_limit int)` for game pages and the directory. Both return nothing for unpublished, admin-hidden, suspended or non-teammate accounts. Writes go through `teammate_public_profile_save(...)` with the same validation in Postgres as on the server (pattern of the bio migration).

DB load: one read per page view, no writes on view. The game-page section adds one read per game page view.

## 5. SEO structure

- **URL:** `https://duoly.gg/teammates/<slug>`, lowercase, no trailing slash. Old slugs 301 to the new one.
- **Title:** `Nyx, Valorant Immortal 3 teammate | Duoly`. **Meta description** built from facts: games, verified rank, languages, sessions (only when shown on the page).
- **One h1** (the name), h2 per section: games, reviews, more teammates.
- **Structured data:** `ProfilePage` with `mainEntity` `Person` (`name`, `image`, `description` = bio, `knowsLanguage`, `knowsAbout` = games, `interactionStatistic` for completed sessions), `BreadcrumbList`, and a `Service` offered by the Duoly organisation for the featured game with the live price. **No star ratings in structured data**: Google does not support review snippets for people, and self-served ratings would count as an invented trust signal.
- **Quality rule (index or not):** published, not hidden, at least one admin-verified rank, and either a bio of 60+ characters or 5+ completed sessions. Otherwise `noindex, follow` and kept out of the sitemap. Stops thin pages.
- **Unpublish, suspension, account deletion:** `410 Gone` with noindex, removed from sitemap, IndexNow ping.
- **Sitemap:** `sitemap.xml.ts` adds qualifying profiles with `lastmod = updated_at` (one read, cached 1 hour like now). Directory added once 3+ qualify.
- **IndexNow:** server pings the profile URL on publish, slug change and unpublish (key already live).
- **Internal links:** game page to profiles to game page and coaching page; directory; related teammates. Every profile is two clicks from a game page.
- **Content rules:** each price once per page; stats hidden below sample minimums (rating under 5 reviews, win rate under 20 reported games); "New on Duoly" for new teammates.
- **Citability tests:** profiles are dynamic, so they get their own check (quality rule, single h1, one price, no dashes) and stay out of the static citability floor.

## 6. Booking flow ("Book with Nyx")

Today the system cannot route an order to a teammate the customer never played with. Two options:

**Option 1, launch (no change to checkout or pricing code):** "Book with Nyx" signs the customer in if needed, adds Nyx to their favorites (new endpoint, extends the existing favorites RPC to accept a profile slug), then opens normal booking for Nyx's featured game. Favorites already see the order the moment it queues with no priority delay. Honest copy beside the button: "Nyx sees your order first. If Nyx is busy, another verified teammate takes it." Button shows only while Nyx is online.

**Option 2, later (needs Fabi):** a real 60 second exclusive window for Nyx, the same mechanism as Play again (`order_pick_start`), triggered from the profile. This changes `src/server/payments/checkout.ts` and `create_paid_order`, which are protected money paths, so Fabi must review and approve.

Recommendation: ship Option 1, propose Option 2 to Fabi with data from the first weeks (how often Book with Nyx ends with Nyx).

## 7. Teammate settings ("Public profile" on `/profile`)

- Switch "Show my public profile" (off by default). First switch-on shows a short explainer: what is public, what never is (email, Discord, real name, earnings), that it can be switched off any time and disappears immediately.
- Fields: link (slug, check availability), featured game, accent (8 swatches), banner (4), vibe tags (up to 3), show country, offer coaching, roles and agents per approved game.
- Bio and languages stay where they are (already on `/profile`).
- Live preview link. Verified ranks shown read-only with "Ask support to update".
- Bio passes the existing `BLOCKED` filter plus a no links, no handles rule (off-platform protection).

## 8. Admin

- Teammate detail: set rank and peak per approved game (from `ranks.js`), mark verified; hide or unhide a profile with a reason (logged via `admin_log`).
- Profiles are also hidden automatically on suspension.

## 9. Reviews: privacy and consent

- Existing reviews were written for the teammate, not for a public page. **Publish stars and tags from all reviews, but review text only from reviews written after a notice is added to the review form**: "Your review may appear on Nyx's public profile, without your name."
- Customers stay anonymous on profiles: "Verified customer, Valorant, Oct 2026".
- Privacy policy needs a section on public teammate profiles. The policy text lives in `src/design-reference/lib/legal.js`, a protected file, so **Fabi (legal representative) updates it**. Profiles stay off in production until it is live.

## 10. Analytics

Events: `teammate_profile_viewed`, `teammate_profile_book_clicked`, `teammate_profile_saved`, `teammate_profile_shared`, `teammate_profile_published`, `teammate_profile_unpublished`, and whether a profile booking ended with that teammate. The typed event list is in `src/lib/analytics.ts`, a protected file: server-side events go through the existing analytics outbox; browser events need Fabi's OK to extend the list.

## 11. Design (B, Broadcast) fixes before porting

From the review: remove about 40% of borders (no boxes in boxes), larger and higher-contrast Book button, small text at least 13px and AA contrast, no north-east arrows on internal links, no repeated stats (312, 4.9), verified tick on the baseline, a real rank glyph per game (geometric, not official emblems), rich mini cards for related teammates (rank, rating, online), the slash motif used as a system (dividers, tabs, bars), and the Valorant and League blocks given equal care. Accent, banner and tier states stay driven by `--accent` and `data-banner`.

## 12. Build order (each step one PR, all behind a feature flag, gates green)

1. **Data:** migration (tables, validation, read and save functions, hide on suspension), SQL tests in the local CI suite, contracts. Applied to production only with owner OK.
2. **Profile page:** port design B to `src/pages/teammates/[slug].astro` with components, JSON-LD, 301 and 410 handling, quality rule. Flag off in production (404).
3. **Settings and admin:** `/profile` public profile block, admin rank verification and hide.
4. **Discovery:** game page section, `/teammates` directory, sitemap, IndexNow, llms.txt.
5. **Booking (Option 1), Save, Share, analytics.**
6. **Launch:** Fabi reviews design and copy, privacy text live, review form notice live, first teammates opt in and get ranks verified, flag on, GEO remeasure.

## 13. Needs a decision or someone else

| Item | Who |
|---|---|
| Design B approval, game page section placement, nav and footer link | Fabi (design area) |
| Option 1 now, Option 2 later | Owner, Fabi for Option 2 |
| Privacy policy section, review notice wording | Fabi (legal representative) |
| Who verifies ranks and how (screenshot, tracker link) | Owner and Fabi |
| Browser analytics events | Fabi (protected file) |
| First teammates to opt in | Owner and Fabi |

## 14. Risks

- **Thin or empty profiles** hurt SEO: quality rule and noindex.
- **Poaching off platform** via bio: filter, no links, admin hide.
- **Harassment:** no Discord or real name, opt-in, instant off, 410.
- **Impersonation or slug squatting:** reserved list, admin override.
- **Stale online status:** presence read at request time; no caching of the HTML.
- **Protected files:** checkout, pricing, analytics and legal text are untouched in the launch scope.
