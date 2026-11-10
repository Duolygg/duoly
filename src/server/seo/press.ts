import { BUSINESS, BUSINESS_LOCATION, SERVED_AREAS } from '../../site/entity';
import { OFFICIAL_CHANNELS } from '../../site/seo';
import { PRESS_EMAIL } from '../../site/press-contact';
import { ABOUT_STORY } from '../../content/about-story';
import {
  COACHABLE_GAMES,
  COACHING_PRICE,
  PLAYABLE_GAMES,
  SHORT_GAME_PRICE,
  SOCIAL_MODES,
} from './teammate-facts';
import { CATALOG_GAMES, SERVICE_COUNT } from './booking';

/**
 * The press kit: the boilerplate, the fact sheet and the logo files.
 *
 * A press page is the one page written to be copied, so a wrong figure here
 * ends up in somebody else's article. Everything below is therefore derived
 * from the catalog, the pricing engine or /imprint, and
 * tests/unit/press.test.ts re-derives each number and asserts every logo file
 * really exists in public/.
 *
 * Two things are deliberately absent. There is no launch date, because the
 * owner has not published one (src/content/about-story.ts carries `foundedOn`
 * for exactly this, and it is still empty); the page states the first commit
 * date in the public code base instead, which is checkable. And there are no
 * metrics: no user count, no session count, no funding, no rating. A press
 * page that invents those is the reason journalists stop trusting press pages.
 */

/** The one-sentence boilerplate, for a caption or an article's first mention. */
export const BOILERPLATE_SENTENCE = `Duoly (duoly.gg) is an Austrian online marketplace where players book rank-verified gaming teammates and coaches by the game or by the hour across ${PLAYABLE_GAMES} games.`;

/** The one-paragraph boilerplate, for the end of an article. */
export const BOILERPLATE_PARAGRAPH = `Duoly (duoly.gg) is an online marketplace for rank-verified gaming teammates and coaches, operated from ${BUSINESS_LOCATION}. Customers pick a game, a session type and a quantity, pay once at a published price and are matched with a verified player who joins their lobby on a separate account. The catalog spans ${SERVICE_COUNT} bookable services across ${CATALOG_GAMES} games, from ${SHORT_GAME_PRICE} for a short teammate game to ${COACHING_PRICE} per hour for coaching in ${COACHABLE_GAMES} titles, plus ${SOCIAL_MODES} voice session types. Duoly never signs into a customer account, never asks for a password and promises no rank, no win and no start time. The business is a sole proprietorship registered in Austria under trade register number GISA ${BUSINESS.gisa}.`;

/** The fact sheet, as label and value pairs so extractors read them as pairs. */
export const FACT_SHEET: readonly [string, string][] = [
  ['What it is', 'Marketplace for gaming teammates and coaches'],
  ['Website', 'duoly.gg'],
  ['Business name', BUSINESS.legalName],
  ['Legal form', BUSINESS.legalForm],
  ['Business location', BUSINESS_LOCATION],
  ['Legally represented by', BUSINESS.representedBy],
  ['Trade register', `GISA ${BUSINESS.gisa}`],
  ['Games in the catalog', `${PLAYABLE_GAMES} plus a voice-only category`],
  ['Bookable services', String(SERVICE_COUNT)],
  ['Games with coaching', String(COACHABLE_GAMES)],
  ['Lowest listed price', `${SHORT_GAME_PRICE} per game`],
  ['Coaching rate', `${COACHING_PRICE} per hour or game`],
  ['Matchmaking areas', SERVED_AREAS.join(', ')],
  ['Payment', 'Card and wallet payment through Stripe, one upfront charge'],
  ['Voice', 'Discord'],
  ['Minimum age', '18 for customers and teammates'],
  ['Official channels', OFFICIAL_CHANNELS.map(({ label }) => label).join(', ')],
  ['Press contact', PRESS_EMAIL],
];

export interface LogoFile {
  /** Where the file lives under public/, as the URL a reader downloads. */
  readonly href: string;
  readonly label: string;
  readonly pixels: string;
}

export interface LogoAsset {
  readonly name: string;
  readonly detail: string;
  /** The file to show as a preview, which is also one of the downloads. */
  readonly preview: LogoFile;
  readonly files: readonly LogoFile[];
}

/**
 * The logo files already committed to public/, offered as downloads.
 *
 * Nothing new is drawn for this page: these are the exact files the site runs
 * on, which is also what a publisher should use. No game art and no publisher
 * logo is offered, because none of it is Duoly's to license.
 */
export const LOGO_ASSETS: readonly LogoAsset[] = [
  {
    name: 'Full logo',
    detail: 'The wordmark with both mascots. The default choice.',
    preview: {
      href: '/assets/brand/logo-full-560.webp',
      label: 'WebP 560px',
      pixels: '560x461',
    },
    files: [
      {
        href: '/assets/brand/logo-full-1120.webp',
        label: 'WebP 1120px',
        pixels: '1120x922',
      },
      {
        href: '/assets/brand/logo-full.webp',
        label: 'WebP 900px',
        pixels: '900x741',
      },
      {
        href: '/assets/brand/logo-full-560.webp',
        label: 'WebP 560px',
        pixels: '560x461',
      },
    ],
  },
  {
    name: 'Wordmark',
    detail: 'Text only, for a byline or a narrow space.',
    preview: {
      href: '/assets/brand/logo-wordmark.webp',
      label: 'WebP 360px',
      pixels: '360x135',
    },
    files: [
      {
        href: '/assets/brand/logo-wordmark.webp',
        label: 'WebP 360px',
        pixels: '360x135',
      },
      {
        href: '/assets/brand/logo-wordmark-208.webp',
        label: 'WebP 208px',
        pixels: '208x78',
      },
    ],
  },
  {
    name: 'Mascots',
    detail: 'The two characters without the wordmark.',
    preview: {
      href: '/assets/brand/logo-mascots.webp',
      label: 'WebP 240px',
      pixels: '240x151',
    },
    files: [
      {
        href: '/assets/brand/logo-mascots.webp',
        label: 'WebP 240px',
        pixels: '240x151',
      },
      {
        href: '/assets/brand/logo-mascots-144.webp',
        label: 'WebP 144px',
        pixels: '144x91',
      },
    ],
  },
  {
    name: 'App icon',
    detail: 'The square icon, for a favicon row or an app listing.',
    preview: { href: '/icon-512.png', label: 'PNG 512px', pixels: '512x512' },
    files: [
      { href: '/icon-512.png', label: 'PNG 512px', pixels: '512x512' },
      { href: '/icon-192.png', label: 'PNG 192px', pixels: '192x192' },
    ],
  },
];

/** Every file the page offers, flattened for the test that checks they exist. */
export const LOGO_FILES: readonly string[] = [
  ...new Set(
    LOGO_ASSETS.flatMap((asset) => [
      asset.preview.href,
      ...asset.files.map((file) => file.href),
    ]),
  ),
];

/**
 * The social preview image the site already serves, offered as the one
 * ready-made graphic a publisher can drop into a post.
 */
export const SOCIAL_IMAGE = {
  href: '/og/duoly.jpg',
  label: 'JPG 1200x630',
} as const;

/**
 * Whether the owner has published a launch date yet. While this is false the
 * page says so instead of guessing, which is the whole point of the empty
 * ABOUT_STORY.
 */
export const HAS_LAUNCH_DATE = Boolean(ABOUT_STORY.foundedOn);
export const LAUNCH_DATE = ABOUT_STORY.foundedOn;
