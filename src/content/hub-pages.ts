/**
 * Game hub copy types and registry, one entry per game Duoly sells.
 *
 * A game hub is the landing page for a game and the internal-linking centre for
 * every other page about it. A game counts as finished (indexable, in the
 * sitemap and in llms.txt) only when an entry exists in src/content/game-hubs,
 * so a new game stays noindex until somebody writes its copy.
 *
 * Price tokens such as `{{p_duo2}}` come from src/server/seo/hub.ts, which asks
 * the checkout pricing engine, so copy and checkout cannot drift apart.
 * `**Bold**` and `[links](/path)` are rendered by src/components/seo/rich.ts.
 *
 * Valorant and Social keep their own older copy in src/content/hubs.ts.
 */
import { GAME_HUBS } from './game-hubs';

export interface HubPick {
  /** The reader's goal, phrased so one option clearly matches. */
  goal: string;
  /** The catalog service id the goal points at. */
  service: string;
  /** One sentence naming the service, the player tier and the price. */
  answer: string;
}

export interface HubPageCopy {
  gameSlug: string;
  /**
   * The broad title for the game. Where a game also has an intent page, that
   * page owns the narrow query (LFG, duos, duo partner) and the hub stays off
   * it, so the two never compete. See `intent` below.
   */
  title: string;
  /** Meta description; 140 to 160 characters once price tokens are filled. */
  description: string;
  eyebrow: string;
  h1: string;
  lead: string;
  cta: string;
  facts: [string, string, string];
  /** Other game hubs the guides block links, by game slug. */
  related: string[];
  /**
   * One sentence handing the narrow query to the game's intent page, shown as a
   * callout under the intro. The link itself comes from src/content/intent-pages
   * (path) and `intentAnchor` (anchor text), so this text must not repeat
   * either. Games without an intent page leave it out and render no callout.
   */
  intent?: string;
  /** The answer-first intro: what you can book for this game, with real prices. */
  format: { heading: string; text: string };
  /** One short line per price card, by catalog service id. */
  services: Record<string, string>;
  /** Orientation line above a price grid. Never quote a price here. */
  intros: { teammate: string; team?: string; coaching?: string };
  steps: { heading: string; items: [string, string, string]; note: string };
  decide: { heading: string; intro: string; picks: HubPick[] };
  sections: { heading: string; paragraphs: [string, string] }[];
  faq: { heading: string; items: [string, string][] };
  closing: { heading: string; text: string };
}

export const HUB_PAGES: HubPageCopy[] = GAME_HUBS;

export const hubPageFor = (slug: string | undefined) =>
  HUB_PAGES.find((page) => page.gameSlug === slug);

/**
 * Game slugs with finished hub copy, in sitemap order. Valorant and Social come
 * first because both shipped before the data-driven hubs.
 */
export const FINISHED_HUB_SLUGS = [
  'valorant',
  'social',
  ...HUB_PAGES.map((page) => page.gameSlug),
];
