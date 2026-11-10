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
 *     word "First," only when it is the one signpost in the paragraph.
 *  2. A "For example," sentence has to name something concrete: a number, a
 *     price token, or a capitalised name. "For example, a longer booking
 *     reaches the largest discount shown." names nothing, so it is not an
 *     example of anything; "For example, 3 hours cost {{p_duo2_x3}}." is.
 *
 * Together they also settle the case the brief calls out: a paragraph may not
 * end on a "For example," sentence unless that sentence carries a number or a
 * named thing, because rule 2 applies wherever the sentence sits.
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
 */
const NAMES_SOMETHING =
  /\d|\{\{[^}]+\}\}|\{(?:amount|price|seats):[^}]+\}|\[[^\]]+\]\(|€|\$|[a-z,)"”] [A-Z][A-Za-z+]/;

export interface PlainCopyProblem {
  paragraph: string;
  rule: 'too-many-connectors' | 'example-names-nothing';
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
  for (const sentence of sentences(paragraph)) {
    if (!/^For example,/.test(sentence)) continue;
    if (!NAMES_SOMETHING.test(sentence.replace(/^For example,\s*/, '')))
      problems.push({
        paragraph,
        rule: 'example-names-nothing',
        detail: sentence,
      });
  }
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
