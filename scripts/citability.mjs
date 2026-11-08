/* global document, NodeFilter */
/**
 * Citability scoring, ported from the research tool Duoly measures pages with
 * (~/.hermes/skills/research/geo-ai-search/scripts/citability_scorer.py).
 *
 * The port exists so the score can be a build gate: the Python tool is not
 * installed in CI, and a gate that cannot run is not a gate. Every rule below
 * mirrors that script deliberately, including the parts a fresh design would
 * do differently, because a score that disagrees with the tool the team
 * measures with is worse than no score. Checked against it on 2026-11-08 over
 * all 43 sitemap URLs: identical block counts and identical averages.
 *
 * Two behaviours worth knowing before reading a number:
 * - Blocks start at every h1 to h4 and run to the next one, ignoring section
 *   boundaries. A fixed cookie banner late in the DOM therefore joins the last
 *   headed block on the page.
 * - script, style, nav, footer, header, aside and form are dropped first, so
 *   chrome does not count as content.
 */

const WORDS = (text) => text.trim().split(/\s+/).filter(Boolean);
const count = (text, pattern) => (text.match(pattern) || []).length;

/** Score one block of running text, 0 to 100, the way the research tool does. */
export function scorePassage(text, heading) {
  const words = WORDS(text);
  const wordCount = words.length;
  const scores = {
    answerBlockQuality: 0,
    selfContainment: 0,
    structuralReadability: 0,
    statisticalDensity: 0,
    uniquenessSignals: 0,
  };

  // 1. Answer block quality (30)
  let abq = 0;
  const definitions = [
    /\b\w+\s+is\s+(?:a|an|the)\s/i,
    /\b\w+\s+refers?\s+to\s/i,
    /\b\w+\s+means?\s/i,
    /\b\w+\s+(?:can be |are )?defined\s+as\s/i,
    /\bin\s+(?:simple|other)\s+(?:terms|words)\s*,/i,
  ];
  if (definitions.some((pattern) => pattern.test(text))) abq += 15;
  const opening = words.slice(0, 60).join(' ');
  const early = [
    /\b(?:is|are|was|were|means?|refers?)\b/i,
    /\d+%/,
    /[$€£][\d,]+/,
    /\d+\s+(?:million|billion|thousand)/i,
  ];
  if (early.some((pattern) => pattern.test(opening))) abq += 15;
  if (heading && heading.endsWith('?')) abq += 10;
  const sentences = text.split(/[.!?]+/);
  const clear = sentences.filter((sentence) => {
    const length = WORDS(sentence).length;
    return length >= 5 && length <= 25;
  }).length;
  if (sentences.length) abq += Math.floor((clear / sentences.length) * 10);
  if (
    /(?:according to|research shows|studies? (?:show|indicate|suggest|found)|data (?:shows|indicates|suggests))/i.test(
      text,
    )
  )
    abq += 10;
  scores.answerBlockQuality = Math.min(abq, 30);

  // 2. Self-containment (25)
  let sc = 0;
  if (wordCount >= 134 && wordCount <= 167) sc += 10;
  else if (wordCount >= 100 && wordCount <= 200) sc += 7;
  else if (wordCount >= 80 && wordCount <= 250) sc += 4;
  else if (wordCount >= 30 && wordCount <= 400) sc += 2;
  if (wordCount > 0) {
    const ratio =
      count(
        text,
        /\b(?:it|they|them|their|this|that|these|those|he|she|his|her)\b/gi,
      ) / wordCount;
    if (ratio < 0.02) sc += 8;
    else if (ratio < 0.04) sc += 5;
    else if (ratio < 0.06) sc += 3;
  }
  const proper = count(text, /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g);
  if (proper >= 3) sc += 7;
  else if (proper >= 1) sc += 4;
  scores.selfContainment = Math.min(sc, 25);

  // 3. Structural readability (20)
  let sr = 0;
  if (sentences.length) {
    const average = wordCount / sentences.length;
    if (average >= 10 && average <= 20) sr += 8;
    else if (average >= 8 && average <= 25) sr += 5;
    else sr += 2;
  }
  if (
    /(?:first|second|third|finally|additionally|moreover|furthermore)/i.test(
      text,
    )
  )
    sr += 4;
  if (/(?:\d+[.)]\s|\b(?:step|tip|point)\s+\d+)/i.test(text)) sr += 4;
  if (text.includes('\n')) sr += 4;
  scores.structuralReadability = Math.min(sr, 20);

  // 4. Statistical density (15)
  let sd = 0;
  sd += Math.min(count(text, /\d+(?:\.\d+)?%/g) * 3, 6);
  sd += Math.min(
    count(
      text,
      /(?:[$€£][\d,]+(?:\.\d+)?|\b(?:EUR|USD|GBP)\s?[\d,]+(?:\.\d+)?)(?:\s*(?:million|billion|M|B|K))?/g,
    ) * 3,
    5,
  );
  sd += Math.min(
    count(
      text,
      /\b\d+(?:,\d{3})*(?:\.\d+)?\s+(?:users|customers|pages|sites|companies|businesses|people|percent|times|x\b)/gi,
    ) * 2,
    4,
  );
  if (count(text, /\b20(?:2[3-6]|1\d)\b/g) > 0) sd += 2;
  for (const pattern of [
    /(?:according to|per|from|by)\s+[A-Z]/,
    /(?:Gartner|Forrester|McKinsey|Harvard|Stanford|MIT|Google|Microsoft|OpenAI|Anthropic)/,
    /\([A-Z][a-z]+(?:\s+\d{4})?\)/,
  ])
    if (pattern.test(text)) sd += 2;
  scores.statisticalDensity = Math.min(sd, 15);

  // 5. Uniqueness signals (10)
  let us = 0;
  if (
    /(?:our (?:research|study|data|analysis|survey|findings)|we (?:found|discovered|analyzed|surveyed|measured))/i.test(
      text,
    )
  )
    us += 5;
  if (
    /(?:case study|for example|for instance|in practice|real-world|hands-on)/i.test(
      text,
    )
  )
    us += 3;
  if (/(?:using|with|via|through)\s+[A-Z][a-z]+/.test(text)) us += 2;
  scores.uniquenessSignals = Math.min(us, 10);

  const total = Object.values(scores).reduce((sum, value) => sum + value, 0);
  return { heading, wordCount, total, scores };
}

/**
 * The browser-side extractor: the same elements, order and text joining the
 * Python tool gets from BeautifulSoup. Runs inside page.evaluate, so it may
 * only use browser globals and has to be self-contained.
 */
export function extractBlocks() {
  for (const element of document.querySelectorAll(
    'script, style, nav, footer, header, aside, form',
  ))
    element.remove();
  // BeautifulSoup get_text(strip=True) strips each text node and joins with no
  // separator, so "2026.Add" is one token there and has to be here too.
  const textOf = (element) => {
    let out = '';
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const value = walker.currentNode.nodeValue.trim();
      if (value) out += value;
    }
    return out;
  };
  const words = (value) => value.trim().split(/\s+/).filter(Boolean).length;
  const blocks = [];
  let heading = 'Introduction';
  let paragraphs = [];
  const flush = () => {
    const combined = paragraphs.join(' ');
    if (words(combined) >= 20) blocks.push({ heading, text: combined });
    paragraphs = [];
  };
  for (const element of document.querySelectorAll(
    'h1, h2, h3, h4, p, ul, ol, table',
  )) {
    if (/^H[1-4]$/.test(element.tagName)) {
      if (paragraphs.length) flush();
      heading = textOf(element);
      paragraphs = [];
    } else {
      const text = textOf(element);
      if (text && words(text) >= 5) paragraphs.push(text);
    }
  }
  if (paragraphs.length) flush();
  return blocks;
}

/**
 * Round to one decimal the way Python's `round` does, half to even, so a page
 * averaging exactly 85.25 reads 85.2 here and 85.2 in the research tool rather
 * than 85.3 in one and 85.2 in the other.
 */
function roundHalfEven(value) {
  const scaled = value * 10;
  const floor = Math.floor(scaled);
  const rest = scaled - floor;
  if (Math.abs(rest - 0.5) > Number.EPSILON * Math.abs(scaled) * 8)
    return Math.round(scaled) / 10;
  return (floor % 2 === 0 ? floor : floor + 1) / 10;
}

/** Page-level result: the average block score, rounded like the research tool. */
export function scorePage(blocks) {
  const scored = blocks.map((block) => scorePassage(block.text, block.heading));
  const average = scored.length
    ? scored.reduce((sum, block) => sum + block.total, 0) / scored.length
    : 0;
  return { blocks: scored, average: roundHalfEven(average) };
}
