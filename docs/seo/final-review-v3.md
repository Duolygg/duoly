# PR 145 final SEO and visual review

## Scope and evidence

Rebased onto main `b4fb027`, retaining the creator-code checkout box and homepage game, tab and service deep links. No merge or production deployment performed. Protected pricing, payments, referral, analytics, catalog and migration files remain unchanged by this pass.

The right hero card now has 120px game art, a price chip and three facts aligned with the eyebrow. Multi-game art no longer overlaps. Mobile hero CTAs match widths. Text sections use consistent container widths. Guide navigation is inline, lists all eight H2 sections and links to matching anchors. Coaching ranks appear in the service-price section, preparation uses check icons and the sample review clearly states its one-hour format. Social boundaries sit below the CTA row. The shared Vienna footer band remains.

The known chat resize test failed in two full-suite attempts, affecting desktop first and then desktop plus mobile. Its chat configuration passed on the first isolated retry, and the final full `pnpm test:e2e` retry passed all 328 tests across all five configurations. No chat implementation or assertion was changed. The upstream creator-checkout tests now ignore only the unrelated `pro_billing_customer` lookup when asserting no creator eligibility RPC was made. Checkout behavior and money assertions are unchanged.

## Metadata

| URL                                 | Title                                                          | Description                                                                                                                                                    | H1                                                     |
| ----------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `/`                                 | Gaming Teammates, Coaching and Social Sessions &#124; Duoly    | Book gaming teammates, coaching and friendly Social sessions on Duoly. Compare games and services from €2.49, choose a session and play on your own account.   | Gaming teammates for your next game.                   |
| `/games/valorant/coaching`          | Valorant Coaching, VOD Review and Aim Training &#124; Duoly    | Valorant coaching from €10.99 per game. Choose live Play and Learn, VOD Review or Aim and Crosshair. Set a practice goal and book your coach on Duoly.         | Valorant coaching with a focused practice plan         |
| `/games/league-of-legends/coaching` | League of Legends Coaching and VOD Review &#124; Duoly         | League of Legends coaching from €10.99 per game. Book LoL live learning, VOD Review or Champion Mastery. Work on your role, lane and recall decisions.         | League of Legends coaching for your next practice goal |
| `/games/rocket-league/coaching`     | Rocket League Coaching and Mechanics Training &#124; Duoly     | Rocket League coaching from €13.99 per hour. Book Doubles or Mechanics Training with practice packs. Work on aerials, recoveries and second-player decisions.  | Rocket League coaching for decisions and mechanics     |
| `/games/fortnite/coaching`          | Fortnite Coaching for Builds, Edits and Decisions &#124; Duoly | Fortnite coaching at €14.99 per hour. Book a Fortnite coach for live Ranked learning or Creative build and edit practice, with a plan for your input.          | Fortnite coaching for your next practice goal          |
| `/games/teamfight-tactics/coaching` | TFT Coaching and Teamfight Tactics Econ Review &#124; Duoly    | TFT coaching at €15.49 per hour. Book a Teamfight Tactics Comp and Econ Review. Work on gold, roll timing, board strength and your next spending decision.     | TFT coaching for economy and decisions                 |
| `/games/apex-legends/coaching`      | Apex Legends Coaching and Movement Practice &#124; Duoly       | Apex Legends coaching at €14.99 per hour. Book live Ranked learning or a Firing Range Movement Course. Practice rotations and movement for your input.         | Apex Legends coaching for movement and rotations       |
| `/games/marvel-rivals/coaching`     | Marvel Rivals Coaching and Hero Practice &#124; Duoly          | Marvel Rivals coaching from €7.99 per game. Choose live Play and Learn or hourly Hero Coaching. Review positioning, abilities and ultimate timing.             | Marvel Rivals coaching for your hero and role          |
| `/games`                            | Gaming Teammates and Coaching by Game &#124; Duoly             | Browse gaming teammates and coaching on Duoly, with sessions from €2.49. Compare Valorant, League of Legends, Fortnite and more, or book friendly Social time. | Gaming teammates and coaching by game                  |
| `/blog`                             | Gaming Guides and Playing Together Safely &#124; Duoly         | Read Duoly guides on gaming culture, respectful sessions and choosing who to play with. Explore Social services, teammates and coaching by game.               | Guides to playing together                             |
| `/get-paid-to-play-games`           | Get Paid to Play Games as a Duoly Teammate &#124; Duoly        | Get paid to play games as a Duoly teammate. Earn a 60 percent session share with weekly payouts from $25. See requirements and apply to play, coach or host.   | Get paid to play games as a Duoly teammate             |
| `/contact`                          | Contact &#124; Duoly                                           | Book gaming teammates, coaching and friendly Social sessions. Compare services and prices, choose your game and play together on your own account.             | Talk to the teambehind Duoly.                          |
| `/terms`                            | Terms &#124; Duoly                                             | Book gaming teammates, coaching and friendly Social sessions. Compare services and prices, choose your game and play together on your own account.             | Terms of Service                                       |
| `/privacy`                          | Privacy &#124; Duoly                                           | Book gaming teammates, coaching and friendly Social sessions. Compare services and prices, choose your game and play together on your own account.             | Privacy Policy                                         |
| `/games/valorant`                   | Valorant LFG: Find Teammates or Book a Duo &#124; Duoly        | Find Valorant teammates: free LFG options plus paid duo sessions from €2.49 per game. Compare ranked and casual prices, then book a teammate.                  | Valorant LFG: find teammates for your next session     |
| `/blog/what-is-an-egirl`            | What Is an E-Girl? How to Play Together Safely &#124; Duoly    | What is an e-girl? Learn how gamers use the term, find people to play with respectfully and explore friendly Duoly Social sessions at €12.99 per hour.         | What is an e-girl? And how to play with one            |
| `/games/social`                     | Play With an E-Girl: Social Sessions and Prices &#124; Duoly   | Play with an e-girl on Duoly: friendly Social voice sessions with Just Chat, Watch Together, Sleep Call or Karaoke. €12.99 per hour. 18+ only.                 | Play with an e-girl or book friendly Social time       |

## Crawl and internal linking

Production bundle crawl from home follows real anchors only. 38 routes checked, no internal 404 targets. All 17 indexable URLs are within two clicks of home and have at least two distinct indexable referring pages with descriptive anchor text. Counts below exclude self-links and count each referring page once. `link-graph-v3.json` preserves the full graph including intentional noindex utility links.

| URL                                 | Inbound indexable pages | Home click depth |
| ----------------------------------- | ----------------------- | ---------------- |
| `/`                                 | 16                      | 0                |
| `/games/valorant/coaching`          | 16                      | 1                |
| `/games/league-of-legends/coaching` | 16                      | 1                |
| `/games/rocket-league/coaching`     | 16                      | 1                |
| `/games/fortnite/coaching`          | 16                      | 1                |
| `/games/teamfight-tactics/coaching` | 16                      | 1                |
| `/games/apex-legends/coaching`      | 16                      | 1                |
| `/games/marvel-rivals/coaching`     | 16                      | 1                |
| `/games`                            | 16                      | 1                |
| `/blog`                             | 16                      | 1                |
| `/get-paid-to-play-games`           | 16                      | 1                |
| `/contact`                          | 16                      | 1                |
| `/terms`                            | 16                      | 1                |
| `/privacy`                          | 16                      | 1                |
| `/games/valorant`                   | 4                       | 2                |
| `/blog/what-is-an-egirl`            | 10                      | 2                |
| `/games/social`                     | 4                       | 2                |

The games directory intentionally links to every public game hub, including noindex hubs that still provide a live booking destination and link to their finished coaching page. Sign-in, application, creator signup and imprint links are intentional shared navigation or conversion utilities, not indexable editorial landing pages. The guide, social page and Valorant hub link to one another. Each coaching page has two in-article related coaching links, a hub link and a games link. The footer provides all seven coaching routes and Get paid to play games. The application page links back to the recruiting explanation.

## Sitemap

Absolute URLs from `Astro.site`, no request-time dates. All content revisions below are recorded in `CONTENT_DATES` and all current revisions are 2026-11-05. The guide's dateModified reads that same map. The production test checks both directions against all indexable URLs found by the crawl, verifies 200 status, index meta and self-canonical, and rejects duplicates.

| Canonical URL                                     | Last modified |
| ------------------------------------------------- | ------------- |
| https://duoly.gg/                                 | 2026-11-05    |
| https://duoly.gg/games                            | 2026-11-05    |
| https://duoly.gg/blog                             | 2026-11-05    |
| https://duoly.gg/contact                          | 2026-11-05    |
| https://duoly.gg/terms                            | 2026-11-05    |
| https://duoly.gg/privacy                          | 2026-11-05    |
| https://duoly.gg/games/valorant                   | 2026-11-05    |
| https://duoly.gg/games/social                     | 2026-11-05    |
| https://duoly.gg/get-paid-to-play-games           | 2026-11-05    |
| https://duoly.gg/blog/what-is-an-egirl            | 2026-11-05    |
| https://duoly.gg/games/valorant/coaching          | 2026-11-05    |
| https://duoly.gg/games/league-of-legends/coaching | 2026-11-05    |
| https://duoly.gg/games/rocket-league/coaching     | 2026-11-05    |
| https://duoly.gg/games/fortnite/coaching          | 2026-11-05    |
| https://duoly.gg/games/teamfight-tactics/coaching | 2026-11-05    |
| https://duoly.gg/games/apex-legends/coaching      | 2026-11-05    |
| https://duoly.gg/games/marvel-rivals/coaching     | 2026-11-05    |

## Lighthouse mobile

Lighthouse default mobile simulated throttling against the built Vercel bundle, with provider-style gzip for text assets. Lab results, not field Core Web Vitals. Fixed the shared footer copyright contrast failure. All four accessibility and SEO scores are now 100.

| URL                        | Performance | Accessibility | SEO | LCP   | CLS | TBT   |
| -------------------------- | ----------- | ------------- | --- | ----- | --- | ----- |
| `/games/valorant/coaching` | 100         | 100           | 100 | 0.9 s | 0   | 10 ms |
| `/games/social`            | 100         | 100           | 100 | 0.9 s | 0   | 0 ms  |
| `/blog/what-is-an-egirl`   | 97          | 100           | 100 | 2.1 s | 0   | 0 ms  |
| `/games/valorant`          | 97          | 100           | 100 | 2.1 s | 0   | 0 ms  |

## Verification and reproduction

- `pnpm check`: zero errors and warnings, 48 existing hints.
- `pnpm lint` and `pnpm format:check`: passed.
- `pnpm test:unit`: 140 files, 1985 tests passed.
- `pnpm build`: passed with the Vercel adapter.
- Production built-HTML tests: 20 passed. These parse JSON-LD from saved responses, compare visible Offer prices and BreadcrumbList, check Article and home schemas, metadata, social preview tags, canonicals, hierarchy, links, click depth and sitemap equality.
- E2E configurations: default 220, chat 10, completion 16, teammate 74, analytics 8 tests. The chat resize retry is recorded above.

```sh
pnpm build
node scripts/seo-verify.mjs
```

The production SEO check runs in Browser smoke CI after build and Chromium installation. It starts and stops its own preview at port 4381. Existing Playwright configurations retain their separate dev ports. It writes raw HTML plus its crawl report to ignored `.vercel/seo-audit/`.

For screenshots, start `node scripts/seo-preview.mjs` separately, then run `SEO_SCREENSHOTS=/absolute/output/path node scripts/seo-screenshots.mjs`. Desktop is 1440px, mobile is 390px. Production captures contain no `astro-dev-toolbar`, no overflow, and have been visually inspected. All ten full-page files and ten hero crops are at:

`/Users/sebastianschrottenbach/.hermes/cache/scratch/duoly-seo-v3/{coaching,social,guide,valorant,getpaid}-{desktop,mobile}-v3.png`

Hero crops use `-hero-v3.png`. Final contact sheets use `desktop-review-v3.png` and `mobile-review-v3.png`. Lighthouse raw reports are `/Users/sebastianschrottenbach/.hermes/cache/scratch/lh-*-v3.json`.

## Remaining owner actions

Submit the sitemap in Search Console and Bing after merge. Verify search-generative inclusion in Search Console. No ranking or field performance result is implied by this local audit.
