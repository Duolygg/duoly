/**
 * The stream kit a creator copies from their dashboard: two chat commands, panel text, a line for
 * a link in bio, the two disclosure templates and the brand files that already live in
 * /public/assets/brand.
 *
 * Pure strings built from the code, so the dashboard, the tests and any later email say the same
 * thing. The Nightbot form is the documented `!commands add` syntax (24a); the StreamElements form
 * is its chat bot's `!command add`, which the dashboard labels as the chat bot command because the
 * research note asks for it to be verified separately before we promise more.
 *
 * Disclosure wording: 24b section 3. The German template is the one the advisor is asked to
 * approve, word for word.
 */
import { CREATOR_RULES } from '../contracts/creators';

export const DUOLY_ORIGIN = 'https://duoly.gg';

const discount = CREATOR_RULES.viewerDiscountPercent;

export interface StreamKitDisclosure {
  language: 'English' | 'Deutsch';
  text: string;
}
export interface StreamKitAsset {
  label: string;
  href: string;
  note: string;
}
export interface StreamKit {
  code: string;
  shortLink: string;
  refLink: string;
  nightbot: string;
  streamElements: string;
  panel: string;
  linkInBio: string;
  disclosures: StreamKitDisclosure[];
  assets: StreamKitAsset[];
}

/** Everything a creator can copy, for one code. The origin is only for local previews. */
export function streamKit(code: string, origin = DUOLY_ORIGIN): StreamKit {
  const upper = code.toUpperCase();
  const shortLink = `${origin}/${upper.toLowerCase()}`;
  const line = `Ad: ${discount}% off your first Duoly order with code ${upper}: ${shortLink}`;
  return {
    code: upper,
    shortLink,
    refLink: `${origin}/?ref=${upper}`,
    nightbot: `!commands add !duoly ${line}`,
    streamElements: `!command add !duoly ${line}`,
    panel: `Duo with a rank verified teammate in under 2 minutes. Use code ${upper} for ${discount}% off your first order: ${shortLink}`,
    linkInBio: `Duoly: ${discount}% off your first order with code ${upper}: ${shortLink}`,
    disclosures: [
      {
        language: 'English',
        text: `Ad for Duoly. My code gets you ${discount}% off your first order, and I get a commission.`,
      },
      {
        language: 'Deutsch',
        text: `Werbung für Duoly. Mit meinem Code erhältst du ${discount}% auf deine erste Bestellung; ich erhalte eine Provision.`,
      },
    ],
    assets: [
      {
        label: 'Wordmark',
        href: '/assets/brand/logo-wordmark.webp',
        note: 'For panels and overlays on a dark background.',
      },
      {
        label: 'Mascots',
        href: '/assets/brand/logo-mascots.webp',
        note: 'The two Duoly mascots, no text.',
      },
      {
        label: 'Full logo',
        href: '/assets/brand/logo-full.webp',
        note: 'Mascots and wordmark together, for thumbnails.',
      },
    ],
  };
}
