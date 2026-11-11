import { intentPages, intentPath } from '../content/intent-pages';
import { FINISHED_HUB_SLUGS } from '../content/hub-pages';
import { coachFormats } from '../content/coaching-formats';

/**
 * Where every indexable page's copy actually lives, and the day that copy last
 * changed.
 *
 * `<lastmod>` in sitemap.xml is read by Google, so it has to mean "the day this
 * page's content last changed" and never "the day the site was built". A build
 * timestamp would re-announce 40 unchanged pages on every deploy and teach
 * Search Console to ignore the signal.
 *
 * The runtime value is the declared date in `CONTENT_UPDATED` below, because
 * the sitemap renders on a serverless request where no git history exists.
 * `CONTENT_SOURCES` is what keeps that declaration honest: tests/unit/seo.test.ts
 * asks git for the last commit that touched each page's own copy files and
 * fails when a declared date has drifted from it. So the flow when you change
 * page copy is: edit the copy, set that page's date here to the day you commit.
 *
 * Sources are a page's own copy, not the shared layout or component it renders
 * through. A spacing fix in GameHub.astro is not a content change on 15 hubs,
 * and treating it as one would put the churn back that `lastmod` exists to
 * avoid.
 */
export const CONTENT_SOURCES: Record<string, string[]> = {
  '/': ['src/pages/index.astro'],
  '/games': ['src/pages/games/index.astro'],
  '/ai': ['src/pages/ai.astro', 'src/site/ai.ts'],
  '/developers/mcp': ['src/pages/developers/mcp.astro'],
  '/blog': ['src/pages/blog/index.astro'],
  '/about': [
    'src/pages/about.astro',
    'src/site/entity.ts',
    'src/content/about-story.ts',
  ],
  '/fees-and-refunds': [
    'src/pages/fees-and-refunds.astro',
    'src/server/seo/fees.ts',
  ],
  '/how-it-works': [
    'src/pages/how-it-works.astro',
    'src/server/seo/booking.ts',
  ],
  '/trust-and-safety': [
    'src/pages/trust-and-safety.astro',
    'src/server/seo/booking.ts',
  ],
  '/pricing': ['src/pages/pricing.astro', 'src/server/seo/price-table.ts'],
  '/press': ['src/pages/press.astro', 'src/server/seo/press.ts'],
  '/contact': ['src/pages/contact.astro'],
  '/terms': ['src/pages/terms.astro'],
  '/privacy': ['src/pages/privacy.astro'],
  '/get-paid-to-play-games': ['src/pages/get-paid-to-play-games.astro'],
  '/blog/what-is-an-egirl': ['src/pages/blog/[slug].astro'],
  '/blog/what-does-lfg-mean': ['src/pages/blog/what-does-lfg-mean.astro'],
  '/blog/how-to-find-a-valorant-duo': [
    'src/pages/blog/how-to-find-a-valorant-duo.astro',
  ],
  '/blog/how-to-choose-a-gaming-coach': [
    'src/pages/blog/how-to-choose-a-gaming-coach.astro',
  ],
  '/blog/free-lfg-or-paid-teammate': [
    'src/pages/blog/free-lfg-or-paid-teammate.astro',
  ],
  '/coaching': ['src/pages/coaching.astro', 'src/server/seo/directories.ts'],
  '/find-gaming-buddies': [
    'src/pages/find-gaming-buddies.astro',
    'src/server/seo/directories.ts',
  ],
  '/compare/e-pal': [
    'src/pages/compare/e-pal.astro',
    'src/content/epal-comparison.ts',
  ],
  '/compare/metafy': [
    'src/pages/compare/metafy.astro',
    'src/content/metafy-comparison.ts',
  ],
  '/compare/queueup': [
    'src/pages/compare/queueup.astro',
    'src/content/queueup-comparison.ts',
  ],
  '/games/social': ['src/content/hubs.ts'],
  '/reports/gaming-coaching-and-teammate-prices-2026': [
    'src/pages/reports/gaming-coaching-and-teammate-prices-2026.astro',
    'src/content/price-report-2026.ts',
    'src/server/seo/price-report.ts',
  ],
};
for (const slug of FINISHED_HUB_SLUGS)
  if (slug !== 'social')
    CONTENT_SOURCES[`/games/${slug}`] = [
      `src/content/game-hubs/${slug}.ts`,
      'src/content/hub-pages.ts',
    ];
for (const page of intentPages)
  CONTENT_SOURCES[intentPath(page)] = [
    'src/content/intent-pages.ts',
    'src/content/guide-pages.ts',
  ];
// Keyed off coachFormats rather than a second hand-written slug list: that list
// drifted once already when a coaching page was added, and the sitemap then
// quietly stopped declaring sources for it.
for (const slug of Object.keys(coachFormats))
  CONTENT_SOURCES[`/games/${slug}/coaching`] = [
    'src/content/coaching.ts',
    'src/content/coaching-examples.ts',
    'src/content/coaching-formats.ts',
  ];

/**
 * The day each page's copy last changed, as `YYYY-MM-DD`.
 *
 * Declared rather than computed, because sitemap.xml renders per request. Set a
 * page's date to the day you commit its copy; `lastmodProblem` below is the
 * rule tests/unit/seo.test.ts holds the declaration to, and it names the path
 * and the date to write when the two disagree.
 */
export const CONTENT_UPDATED: Record<string, string> = {
  '/': '2026-11-05',
  '/terms': '2026-11-05',
  '/privacy': '2026-11-05',
  // The price survey was read and written on 10 November 2026, which is also
  // the date the report publishes as its own survey date.
  '/reports/gaming-coaching-and-teammate-prices-2026': '2026-11-10',
  // The five pages that gained a paragraph linking the survey on the same day.
  '/pricing': '2026-11-10',
  '/coaching': '2026-11-10',
  '/compare/metafy': '2026-11-10',
  '/compare/queueup': '2026-11-10',
  '/blog': '2026-11-10',
  // The conversion and visual polish pass: official channels on /press, and a
  // missing space before the checked date in the comparison table's caption
  // ("checked9 November 2026") on /compare/e-pal.
  '/press': '2026-11-10',
  '/compare/e-pal': '2026-11-10',
};
/**
 * The 10 November 2026 conversion pass rewrote the copy of every game hub and
 * every teammate page, because prose on all of them quoted a rank-priced
 * service as if it had one price. Hubs and teammate pages share their copy
 * files, so the whole set moves together rather than page by page.
 *
 * ARC Raiders and Minecraft kept their old date at first, because neither has
 * a ranked ladder (lib/ranks.js lists no entry for them) and so neither page
 * quoted a rank-priced service. The same day's discount pass reached them
 * anyway: every hub now states the whole bundle ladder and names the one
 * service that sells bundles. Social is not a game and keeps its own copy.
 */
for (const slug of FINISHED_HUB_SLUGS)
  if (slug !== 'social') CONTENT_UPDATED[`/games/${slug}`] = '2026-11-10';
// All fifteen teammate pages share src/content/intent-pages.ts and
// src/content/guide-pages.ts, so none of them can date its copy apart from the
// others: the window's floor is the day either registry last changed. Both
// changed on 10 November 2026, #198 for the guides and the five LFG FAQs for
// the pages, so every teammate page declares that day.
for (const page of intentPages)
  CONTENT_UPDATED[intentPath(page)] = '2026-11-10';
/**
 * The same pass gave every guide under /blog a reading measure, real lists
 * where the copy was a list in prose, and an inline offer card, so their copy
 * changed too.
 */
for (const path of Object.keys(CONTENT_SOURCES))
  if (path.startsWith('/blog/')) CONTENT_UPDATED[path] = '2026-11-10';
/**
 * The 10 November 2026 plain-language pass took the "First, ... Second, ...
 * For example, ..." scaffolding out of every page that carried it, so the
 * reference pages and every coaching page changed their copy on the same day.
 * The coaching pages are keyed off coachFormats for the same reason their
 * sources are: a hand-written slug list drifted once already.
 */
for (const path of [
  '/games',
  '/ai',
  '/developers/mcp',
  '/about',
  '/fees-and-refunds',
  '/how-it-works',
  '/trust-and-safety',
  '/get-paid-to-play-games',
  '/find-gaming-buddies',
  ...Object.keys(coachFormats).map((slug) => `/games/${slug}/coaching`),
])
  CONTENT_UPDATED[path] = '2026-11-10';
/**
 * The 11 November 2026 voice pass rewrote /about, /press and /ai paragraph by
 * paragraph: the owner read /about and found a page written for a scorer
 * instead of for a reader. The code base's first commit left the
 * customer-facing copy on the same day, and /about gained the one thing it was
 * missing, which is who actually runs Duoly.
 *
 * The same pass took the "Three facts settle the practical questions" and
 * "Three facts make the Duoly figures checkable" openers off the four pages
 * that still carried them, and gave the price report's closing paragraph a
 * real example where it used to say "For example" in front of one more rule.
 * That is a sentence of copy on each, so each moves its date with it.
 */
for (const path of [
  '/about',
  '/press',
  '/ai',
  '/blog/what-is-an-egirl',
  '/blog/free-lfg-or-paid-teammate',
  '/blog/how-to-find-a-valorant-duo',
  '/reports/gaming-coaching-and-teammate-prices-2026',
])
  CONTENT_UPDATED[path] = '2026-11-11';
// Everything else is copy the catalog-promotion pass rewrote, plus the pages
// the trust and entity pass touched on the same day: every hub, every teammate
// page, the coaching pages, /games, /blog and its e-girl guide,
// /get-paid-to-play-games, /ai, /developers/mcp, /about, /fees-and-refunds,
// /contact and /compare/e-pal.
for (const path of Object.keys(CONTENT_SOURCES))
  CONTENT_UPDATED[path] ??= '2026-11-09';

/** What git knows about the last two changes to one page's copy. */
export type ContentHistory = {
  /** Committer date (`YYYY-MM-DD`) of the newest commit that touched the copy. */
  landed: string;
  /**
   * Committer date of the commit that touched the same copy before that one.
   * Absent for copy that has only ever been written once.
   */
  previous?: string;
};

/**
 * The rule that keeps a declared `lastmod` honest. Returns the sentence to fail
 * with, or undefined when the declaration is defensible.
 *
 * It is a window rather than an equality because a committer date is not the day
 * the copy was written:
 *
 *  - A squash merge rewrites it. GitHub sets both the author and the committer
 *    date of a squashed pull request to the moment it lands, which is why every
 *    commit on main has `%as` equal to `%cs`. Copy written on the 9th and merged
 *    on the 10th reads as changed on the 10th, so an equality check failed on
 *    main for every pull request that merged a day after it was written. That is
 *    how it broke after #189, and the only ways to satisfy it were to guess the
 *    merge day while the branch was still open or to patch main afterwards.
 *  - Rewriting a page and changing your mind rewrites it twice. The second
 *    commit moves `landed` without changing what the merged page says, so the
 *    day that copy was written stays where it was.
 *
 * So a date is accepted when it falls between the last two commits that touched
 * the copy, which is the span it could honestly have been written in:
 *
 *  - Never later than `landed`. A date git has no commit for is a page
 *    announcing freshness that did not happen, and that stays a hard failure.
 *  - Never earlier than `previous`. Writing can precede a merge by any number of
 *    days, but it cannot precede the previous version of the same copy.
 *
 * That keeps the gate's purpose without a day-count tolerance to tune. A
 * forgotten bump leaves the declaration at the previous change's day, so the
 * next change to that copy fails it: staleness cannot accumulate past one
 * change, and it can never reach the scale that makes `lastmod` worthless.
 *
 * One thing the window cannot rescue: a branch that edits a page's copy and
 * reverts it inside a single day leaves two commits on that copy and no honest
 * date, because the merged page is unchanged while git says it changed today.
 * Keep that churn out of the history, with a fixup or an amend, and the page
 * keeps the date it already had.
 */
export function lastmodProblem(
  declared: string | undefined,
  { landed, previous }: ContentHistory,
): string | undefined {
  if (!declared) return `declares no lastmod; its copy changed ${landed}`;
  if (declared > landed)
    return `lastmod ${declared} is newer than the commit that changed its copy (${landed}); a page cannot announce a change git has no commit for. Set it to '${landed}'`;
  if (previous && declared < previous)
    return `lastmod ${declared} is older than the previous change to the same copy (${previous}), so it was not updated when the copy changed on ${landed}. Set it to the day you wrote the copy`;
  return undefined;
}
