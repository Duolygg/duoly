/**
 * The shared vocabulary of a Duoly comparison page.
 *
 * /compare/e-pal established it: a cell is a mark plus a sentence, a neutral
 * mark describes a different business model rather than a worse one, and
 * `unknown` means the cited first-party page does not state a policy. Unknown
 * is never a No, and a competitor is never marked down for a model Duoly
 * simply does not share.
 *
 * Every row carries the source URL for its rival cell, so the page can link
 * the claim to the page it was read from.
 */
export type Mark = 'yes' | 'no' | 'part' | 'neutral' | 'unknown';

export interface CompareRow {
  label: string;
  duoly: Mark;
  rival: Mark;
  duolyNote: string;
  rivalNote: string;
  /** A URL from the page's own source list. */
  rivalSource: string;
}

export interface CompareSource {
  title: string;
  url: string;
  accessed: string;
}

/** The glyph for each mark, drawn in a 16 by 16 viewBox. */
export const MARK_ICONS: Record<Mark, string> = {
  yes: 'M4 8.5 6.8 11.2 12 5.4',
  no: 'M5 5 11 11M11 5 5 11',
  part: 'M4.5 8H11.5',
  neutral: 'M8 8h.01',
  unknown: 'M6 6a2 2 0 1 1 3 1.7C8 8.2 8 8.5 8 9M8 11h.01',
};

/** What each mark is read out as, for the legend and for screen readers. */
export const MARK_WORDS: Record<Mark, string> = {
  yes: 'Yes',
  no: 'No',
  part: 'Partly',
  neutral: 'Different model or stated fact',
  unknown: 'Not stated',
};
