# Site structure

One layout (`src/layouts/SiteLayout.astro`) for every page. Links, footer columns, admin sections and public routes live in `src/site/nav.ts`; change them there, not in pages. The homepage keeps the header and footer from the original design (`Home.jsx`, rendered with `bare`), and its footer reads the same `FOOTER_COLUMNS`.

## Sitemap

| Area     | Routes                                                                                                                                      | State                                                                                                                                |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Public   | `/`, `/games`, `/games/[game]`, `/blog`, `/blog/[slug]`, `/apply`, `/creators`, `/rules`, `/contact`, `/terms`, `/privacy`, `/imprint`      | Game and blog pages are SEO placeholders; Apply, Contact and Creators forms show an honest "opens soon" state with Discord and email |
| Account  | `/login`, `/reset-password`, `/profile`                                                                                                     | Live (reset via Supabase recovery email through Resend)                                                                              |
| Customer | `/dashboard`, `/checkout/[id]`, `/checkout/return`, `/queue/[id]`                                                                           | Live                                                                                                                                 |
| Teammate | `/teammate`                                                                                                                                 | Live                                                                                                                                 |
| Admin    | `/admin`, `/admin/[section]` (live, orders, teammates, customers, users, applications, priority, payouts, safety, support, audit, settings) | Shell and sidebar only; 404 for non-admins                                                                                           |
| Utility  | `/claim/[token]`, `/404`, `/sitemap.xml`, `/robots.txt`                                                                                     | Claim is inactive until handover links exist                                                                                         |

## Navigation

- Header: logo, Games, How it works, FAQ, Blog, Become a teammate (signed out and customers), then Sign in or the account menu (role home, Edit profile, Rules, Help, Sign out). Customers see an "Active order" pill while an order is open. Below 900px the main links move into a menu.
- Footer: Duoly (Games, How it works, FAQ, Blog), Join (Become a teammate, Creator program), Help (Contact, Rules, Discord), Legal (Terms, Privacy, Imprint).

## Launch switches

Every page sends `noindex, nofollow` and `robots.txt` disallows crawling. At launch: remove the robots meta from `SiteLayout`, allow crawling in `public/robots.txt`, reference `/sitemap.xml` there, and add `PUBLIC_ROUTES` entries for new public pages.

## Removed

The design-preview strip, `/preview/*`, the sample queue room and handover, and the preview submit guards. Design components that still call `previewFetch` (support chat teaser, profile and dashboard widgets) are not reachable as standalone pages.
