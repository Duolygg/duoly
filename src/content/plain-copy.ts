/**
 * The plain-language rule for Duoly copy, as a check any test can run.
 *
 * Earlier SEO passes opened sentences with "First, ... Second, ... For example,
 * ..." to lift an AI citability score, and a reviewer reading the live pages
 * saw it for what it was: scaffolding written for a scorer, not for a player.
 * Many of the connectors were false, because nothing was first, nothing
 * followed second, and the "example" was not an example of the sentence before
 * it ("For example, name tank, healer or damage in the order chat using
 * Discord.").
 *
 * Two rules keep that out, and both are mechanical on purpose: a rule a writer
 * has to argue about is a rule that comes back.
 *
 *  1. One connector opener per paragraph, at most. A real sequence is a list,
 *     and the list components already number their items, so prose needs the
 *     word "First," only when it is the one signpost in the paragraph. This is
 *     the rule that catches the paragraph the reviewer read: "First, ...
 *     Second, ... For example, ..." is an outline, not prose.
 *  2. A paragraph may not end on a "For example," sentence unless that
 *     sentence names something concrete: a digit, a price token, a link or a
 *     capitalised name. An example is the evidence for the sentence before it,
 *     so an example that names nothing and is never picked up again is
 *     padding. "For example, a longer booking reaches the largest discount
 *     shown." names no booking and no discount; "For example, 3 hours cost
 *     {{p_duo2_x3}}." names both.
 *
 * Deliberately not a rule: a mid-paragraph "For example," without a number.
 * "For example, the entry player turns a corner while the second player is
 * still behind a smoke." is a real example, and the sentences after it do the
 * work. Only the closing position is padding-shaped, so only it is checked.
 */

/** The openers a scorer rewards and a reader trips over. */
export const CONNECTOR_OPENERS = [
  'First,',
  'Second,',
  'Third,',
  'For example,',
] as const;

/** At most this many connector openers in one paragraph. */
export const MAX_CONNECTORS_PER_PARAGRAPH = 1;

const OPENER_PATTERN =
  /(?:^|(?<=[.!?:]\s)|(?<=[.!?:]\s{2})|(?<=\*\*\s)|(?<=\)\s))(First|Second|Third|For example),/g;

/** Sentence-ish split that keeps decimal prices and "2,500+" intact. */
const sentences = (paragraph: string) =>
  paragraph
    .split(/(?<=[.!?])\s+(?=[A-Z0-9*[{"'(])/)
    .map((part) => part.trim())
    .filter(Boolean);

/**
 * Something a reader can check: a digit, a price token, a markdown link, or a
 * capitalised name that is not just the first word of the sentence.
 *
 * A token counts because a token is a number by the time a reader sees it.
 * `{{p_duo2_x3}}` on a hub, `{amount:learn}` in a lesson and a `{value}` left
 * by an interpolated page expression are all a price or a count at build time.
 * A quoted phrase counts too: "my mid-round calls fall apart after the first
 * death" is the most concrete thing a sentence about asking for help can hold.
 */
const NAMES_SOMETHING =
  /\d|\{\{[^}]+\}\}|\{[a-z]+(?::[^}]+)?\}|\[[^\]]+\]\(|€|\$|["“][^"”]{6,}["”]|[a-z,)"”] [A-Z][A-Za-z+]/;

export interface PlainCopyProblem {
  paragraph: string;
  rule: 'too-many-connectors' | 'closing-example-names-nothing';
  detail: string;
}

/** Every plain-language problem in one paragraph of copy. */
export function plainCopyProblems(paragraph: string): PlainCopyProblem[] {
  const problems: PlainCopyProblem[] = [];
  const openers = [...paragraph.matchAll(OPENER_PATTERN)];
  if (openers.length > MAX_CONNECTORS_PER_PARAGRAPH)
    problems.push({
      paragraph,
      rule: 'too-many-connectors',
      detail: `${openers.length} connector openers (${openers
        .map((match) => `${match[1]},`)
        .join(' ')})`,
    });
  // Only the last sentence: an example in the middle of a paragraph is picked
  // up by the sentences after it, while one at the end has to stand alone.
  const last = sentences(paragraph).at(-1) ?? '';
  if (
    /^For example,/.test(last) &&
    !NAMES_SOMETHING.test(last.replace(/^For example,\s*/, ''))
  )
    problems.push({
      paragraph,
      rule: 'closing-example-names-nothing',
      detail: last,
    });
  return problems;
}

/** Every string inside a copy object, however deeply nested. */
export function copyStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(copyStrings);
  if (value && typeof value === 'object')
    return Object.values(value).flatMap(copyStrings);
  return [];
}
