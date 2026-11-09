/**
 * The parts of /about that only the founders can write.
 *
 * The GEO plan asks /about to answer "who is behind this", with a founder
 * story, real names, roles, gaming background and a launch timeline. None of
 * that is derivable from the code, and inventing it is exactly the failure
 * mode an /about page exists to cure: an assistant that quotes a fabricated
 * founding date has been made less accurate by our page, not more.
 *
 * So the data lives here, empty, and /about renders nothing at all for an
 * empty list. No placeholder, no "coming soon", no empty heading: a reader and
 * a crawler both see a page that simply does not have that section yet. Fill a
 * list in and its section appears, with no edit to the page.
 *
 * WHAT THE OWNER HAS TO SUPPLY (every field is optional except the ones marked
 * required, and a half-filled entry is better left out than guessed):
 *
 *   story       one to three short paragraphs, in the founders' own words, on
 *               why Duoly was built. No statistics, no user counts.
 *   founders    one entry per person who should be named on the page:
 *                 name     required, as they want it published
 *                 role     required, for example "Co-founder and design"
 *                 bio      required, two or three sentences including the
 *                          gaming background (games, ranks, years played)
 *                 photo    optional, a file committed under public/assets/
 *                          plus its alt text. Square, at least 320x320.
 *                 profile  optional, a public profile URL they control
 *                          (LinkedIn, X). It also belongs in
 *                          OFFICIAL_PROFILES in src/site/seo.ts if it is a
 *                          company profile rather than a personal one.
 *   milestones  real dated events only, oldest first: the day duoly.gg went
 *               live, the day a game was added, the first paid session. A
 *               milestone nobody can date is not a milestone.
 *   foundedOn   the real founding date as YYYY-MM-DD (the trade licence date
 *               is the checkable one). It flows into the Organization
 *               `foundingDate` in the JSON-LD as well as the page.
 *
 * tests/unit/about-story.test.ts holds this file to the rule above: an empty
 * list may never reach the markup, and a filled entry has to carry its
 * required fields.
 */

export interface Founder {
  /** As the person wants it published. Required. */
  readonly name: string;
  /** For example "Co-founder, design and product". Required. */
  readonly role: string;
  /** Two or three sentences, including the gaming background. Required. */
  readonly bio: string;
  /** A square image committed under public/assets/, with real alt text. */
  readonly photo?: { readonly src: string; readonly alt: string };
  /** A public profile the person controls. Absolute URL. */
  readonly profile?: string;
}

export interface Milestone {
  /** YYYY-MM-DD. The day it really happened. */
  readonly date: string;
  /** Short label, for example "duoly.gg goes live". */
  readonly label: string;
  /** One sentence of detail, or an empty string. */
  readonly detail: string;
}

export interface AboutStory {
  /** Why Duoly was built, in the founders' words. One paragraph per entry. */
  readonly story: readonly string[];
  readonly founders: readonly Founder[];
  /** Oldest first. */
  readonly milestones: readonly Milestone[];
  /** The real founding date, YYYY-MM-DD, or undefined while unknown. */
  readonly foundedOn?: string;
}

/**
 * Empty on purpose. See the file comment: every list here is content the owner
 * has to supply, and /about renders nothing for an empty one.
 */
export const ABOUT_STORY: AboutStory = {
  story: [],
  founders: [],
  milestones: [],
};
