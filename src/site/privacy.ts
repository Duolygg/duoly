/**
 * Live corrections to the privacy policy. The source text lives in the protected design
 * reference (src/design-reference/lib/legal.js), which still describes analytics as
 * planned. PostHog analytics went live on 2026-11-04, so the live page overrides exactly
 * those statements. Each replacement must match, otherwise the build fails a unit test
 * instead of silently showing outdated text.
 */
import { PRIVACY } from '../design-reference/lib/legal';

type Block = unknown;
type Section = { id: string; title: string; blocks: Block[] };
type Doc = Omit<typeof PRIVACY, 'sections'> & { sections: Section[] };

/** [section id, exact old text, new text or null to remove the block / sentence]. */
export const PRIVACY_LIVE_EDITS: [string, string, string | null][] = [
  [
    'cookies',
    ' Analytics and ad measurement are planned and are not active yet.',
    ' Ad measurement is planned and is not active yet.',
  ],
  [
    'analytics',
    'Analytics is planned and is not active yet. The following describes how it will work once enabled.',
    'We use GDPR compliant analytics. Nothing is tracked before you make a choice in the cookie banner, your data stays in the EU, and you can change your choice at any time.',
  ],
  [
    'analytics',
    ' This anonymous counting is also planned and is not active yet.',
    '',
  ],
  [
    'analytics',
    'amounts, game and service, with no personal details in these measurements.',
    'amounts, game and service, with no personal details in these measurements. If you allowed Analytics, they are linked to your account ID.',
  ],
];

/** Cookie table row for the PostHog cookie: real lifetime is 180 days. */
const COOKIE_ROW = 'ph_<project>_posthog (optional)';
const COOKIE_LIFETIME = '6 months';

function editBlock(
  block: Block,
  from: string,
  to: string | null,
): [Block | undefined, boolean] {
  if (typeof block !== 'string' || !block.includes(from)) return [block, false];
  if (to === null) return [undefined, true];
  return [block.replace(from, to), true];
}

export function livePrivacy(doc: Doc = PRIVACY as unknown as Doc): {
  doc: Doc;
  missing: string[];
} {
  const missing: string[] = [];
  const sections = doc.sections.map((s) => ({ ...s, blocks: [...s.blocks] }));
  for (const [id, from, to] of PRIVACY_LIVE_EDITS) {
    const section = sections.find((s) => s.id === id);
    let hit = false;
    if (section)
      section.blocks = section.blocks.flatMap((b) => {
        if (hit) return [b];
        const [next, changed] = editBlock(b, from, to);
        hit = changed;
        return next === undefined ? [] : [next];
      });
    if (!hit) missing.push(from);
  }
  let cookieHit = false;
  for (const section of sections)
    section.blocks = section.blocks.map((b) => {
      const table = (b as { table?: string[][] })?.table;
      if (!table) return b;
      return {
        ...(b as object),
        table: table.map((row) => {
          if (row[0] !== COOKIE_ROW) return row;
          cookieHit = true;
          return [...row.slice(0, -1), COOKIE_LIFETIME];
        }),
      };
    });
  if (!cookieHit) missing.push(COOKIE_ROW);
  return { doc: { ...doc, sections }, missing };
}

export const LIVE_PRIVACY = livePrivacy().doc;
