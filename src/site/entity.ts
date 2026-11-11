import { SERVERS } from '../design-reference/lib/servers.js';
import { servicesFor } from '../design-reference/lib/catalog.js';
import { SITE_GAMES } from './games';
import { SUPPORT_EMAIL } from './nav';

/**
 * Who Duoly is, as a machine-readable entity.
 *
 * AI assistants answering "is Duoly legit" currently describe a different
 * product (a couples app of the same name on Google Play) or say they cannot
 * verify the operator. The cure is not more adjectives: it is the same
 * checkable facts the law already makes us publish, in one typed place that
 * both the /about page and the Organization JSON-LD read.
 *
 * Every field below is copied from /imprint (src/pages/imprint.astro) or
 * derived from the catalog. Nothing here may be guessed: /imprint is the legal
 * notice under §5 ECG, so a value that disagrees with it is a legal problem
 * before it is an SEO problem. tests/unit/entity.test.ts reads imprint.astro
 * and fails when the two drift apart.
 *
 * What is deliberately absent is a date. The code base's first commit used to
 * live here and on /about and /press, which told a customer about our git
 * history and made a weeks-old service sound like a disclaimer. The honest
 * founding date is `foundedOn` in src/content/about-story.ts, which only the
 * owner can fill in; until it exists, no date is published and the
 * Organization carries no `foundingDate`.
 */
export const BUSINESS = {
  /** The business name on the trade register entry, not a company form we do not have. */
  legalName: 'Duoly',
  legalForm: 'Sole proprietorship (Einzelunternehmen)',
  representedBy: 'Fabian Nöbauer',
  /** Austrian trade register (Gewerbeinformationssystem Austria) number. */
  gisa: '38381850',
  street: 'Jesuitenmühlstraße 10',
  postalCode: '2320',
  city: 'Schwechat',
  country: 'AT',
  countryName: 'Austria',
  email: SUPPORT_EMAIL,
} as const;

/** "2320 Schwechat, Austria": the business location as /imprint states it. */
export const BUSINESS_LOCATION = `${BUSINESS.postalCode} ${BUSINESS.city}, ${BUSINESS.countryName}`;

/**
 * The one sentence that separates duoly.gg from everything else called Duoly.
 *
 * Google AI Mode answered "is Duoly legit" on 9 November 2026 by describing a
 * couples relationship app on Google Play, and assistants reach for Duolingo on
 * the name alone. Both confusions are cheap to end, so this line goes into
 * `disambiguatingDescription`, the /about page and llms.txt, identically.
 */
export const DISAMBIGUATION =
  'Gaming teammate and coaching marketplace at duoly.gg; not the Duoly couples app.';

/** The longer, human version of the same clarification. */
export const DISAMBIGUATION_PROSE =
  'Duoly at duoly.gg is a gaming service. It is not the Duoly couples app on Google Play and is not affiliated with Duolingo.';

/**
 * The matchmaking areas Duoly's server pickers cover, read out of the catalog's
 * region groups rather than claimed as "worldwide".
 */
// SERVERS is untyped catalog data ([value, label, group, zones] rows); row[2] is
// the matchmaking area such as "Europe" or "Middle East & Africa".
export const SERVED_AREAS: string[] = [
  ...new Set(
    Object.values(
      SERVERS as unknown as Record<string, [string, string, string][]>,
    ).flatMap((rows) => rows.map((row) => row[2])),
  ),
].map((area) => area.replaceAll('&', 'and'));

/** Service categories in the catalog, as topics rather than product names. */
const CATEGORY_TOPICS: Record<string, string> = {
  duo: 'ranked duo sessions',
  other: 'team fills',
  training: 'gaming coaching',
  gg: 'verified Gamer Girl sessions',
  social: 'friendly voice sessions',
};

/**
 * `knowsAbout`: every game Duoly really sells, plus the kinds of session the
 * catalog really contains. Derived, so adding a game or a category updates the
 * entity without a second edit.
 */
export const KNOWS_ABOUT: string[] = (() => {
  const games = SITE_GAMES.filter((game) => game.id !== 'social');
  const categories = new Set(
    games.flatMap((game) =>
      ((servicesFor(game.id) as { modes?: { cat: string }[] }).modes ?? []).map(
        (mode) => mode.cat,
      ),
    ),
  );
  return [
    ...games.map((game) => game.name),
    ...Object.entries(CATEGORY_TOPICS)
      .filter(([category]) => categories.has(category))
      .map(([, topic]) => topic),
  ];
})();
