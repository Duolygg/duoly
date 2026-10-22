import type { LoyaltyTier } from './theme.ts';

/**
 * Every email is described once as structured content. The layout renders that content to
 * HTML and to plain text, so both versions always say the same thing.
 */
export interface EmailContext {
  /** Public origin used for links, for example https://duoly.gg. */
  siteUrl: string;
  /** Origin that serves /email and /fonts assets. Defaults to siteUrl. */
  assetOrigin: string;
  /** Optional legal identity, shown in the footer when present. */
  legal?: {
    company?: string;
    address?: string;
    register?: string;
    vat?: string;
  };
}

export type Tone = 'safe' | 'info' | 'warn' | 'gold';

export type Block =
  | { type: 'paragraph'; text: string; strong?: string }
  | {
      type: 'button';
      label: string;
      url: string;
      secondary?: { label: string; url: string };
    }
  | { type: 'linkFallback'; url: string }
  | {
      type: 'order';
      gameIcon: string;
      gameName: string;
      title: string;
      meta: string[];
      status?: { label: string; tone: 'live' | 'done' | 'off' };
    }
  | {
      type: 'details';
      title?: string;
      rows: { label: string; value: string; accent?: boolean }[];
      total?: { label: string; value: string };
    }
  | {
      type: 'steps';
      steps: { label: string; state: 'done' | 'active' | 'todo' }[];
    }
  | {
      type: 'teammate';
      name: string;
      avatar: string;
      flag?: string;
      country?: string;
      rank?: string;
      rating?: string;
      languages?: string[];
      bio?: string;
      status?: string;
    }
  | { type: 'note'; tone: Tone; title: string; text: string }
  | { type: 'code'; code: string; caption: string }
  | {
      type: 'tier';
      tier: LoyaltyTier;
      headline: string;
      gift?: string;
    }
  | {
      type: 'stats';
      items: { label: string; value: string; caption?: string; tone?: Tone }[];
    }
  | { type: 'quote'; author: string; avatar?: string; text: string }
  | { type: 'list'; title?: string; items: { title: string; text: string }[] }
  | { type: 'divider' };

export interface EmailContent {
  subject: string;
  /** Inbox preview line, shown next to the subject. */
  preheader: string;
  /** Short label above the title, for example "Order confirmed". */
  eyebrow: string;
  title: string;
  /** Optional second title line in brand lavender, like the homepage hero. */
  titleAccent?: string;
  /** Header art: the animated brand lockup, the animated mascots, or nothing. */
  hero?: 'brand' | 'mascots';
  /** Small label in the top-right corner of the header. */
  headerMeta?: string;
  blocks: Block[];
  /** Why the recipient got this email. Shown in the footer. */
  reason: string;
}
