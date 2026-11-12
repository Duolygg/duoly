// The GEO ladder from 21-geo-plan.md section C: cited, named, recommended, framing.
// Every rung above "cited" is lexical, so each row carries the evidence sentence and
// needs a human read before it becomes a claim.
import { citesDuoly, duolySources } from './sources.mjs';

export const duolyPattern = /\bduoly(?:\.gg)?\b/gi;

// Sentence level recommendation language. Deliberately narrow: "use Duoly" or a bare
// list entry is not a recommendation.
const recommendationPatterns = [
  /\brecommend(?:ed|s|ation)?\b/i,
  /\bbest (?:option|bet|choice|site|platform|place|pick|service)\b/i,
  /\btop (?:pick|choice|option|recommendation)\b/i,
  /\bgo with\b/i,
  /\bi(?:'|’)?d (?:suggest|recommend|go with|use|start with)\b/i,
  /\bmy (?:pick|top pick|suggestion)\b/i,
  /\bstart with\b/i,
  /\byour best\b/i,
];

// Negation or hedging in the same sentence removes the recommendation rung.
const negationPatterns = [
  /\b(?:not|never|cannot|can(?:'|’)?t|wouldn(?:'|’)?t|don(?:'|’)?t|do not|avoid|rather than|instead of|steer clear)\b[^.!?]{0,40}\brecommend/i,
  /\bnot (?:the best|a good|my pick|recommended)\b/i,
  /\b(?:avoid|skip|steer clear of)\b/i,
];

// Framing classes, ordered by how much damage they do. These mirror the claim ledger in
// 18-geo-baseline-2026-11-09.md so the two reports line up.
export const framingClasses = [
  {
    label: 'entity-collision',
    pattern:
      /\b(?:couples?|dating|relationship|romantic)\b[^.!?]{0,40}\b(?:app|platform|service)\b|\bduolingo\b|\blanguage[- ]learning\b/i,
    note: 'Answer describes a different product with the same name',
  },
  {
    label: 'trust-doubt',
    pattern:
      /\bscam\b|\bfraud\b|\bsketchy\b|\bcould not verify\b|\bcouldn(?:'|’)?t verify\b|\bcannot verify\b|\bunverifiable\b|\bunverified\b|\bno independent\b|\blimited (?:independent )?(?:reviews|information)\b|\bno (?:public )?reviews\b|\bproceed with caution\b|\bbe cautious\b|\brisky\b|\b(?:scam|fraud|payment|safety|security)[ -]risks?\b/i,
    note: 'Answer raises trust, verification or review doubts',
  },
  {
    label: 'less-established',
    pattern:
      /\bless established\b|\bnot (?:well )?(?:known|established)\b|\brelatively new\b|\bnewer (?:platform|site|service|entrant)\b|\bsmall(?:er)? (?:platform|site|player)\b|\blittle information\b|\bniche\b/i,
    note: 'Answer frames Duoly as new, small or obscure',
  },
  {
    label: 'price-or-fees-unclear',
    pattern:
      /\b(?:pricing|prices|fees?|rates?|commission)\b[^.!?]{0,60}\b(?:unclear|not (?:listed|published|stated|transparent)|varies|unknown|not available)\b/i,
    note: 'Answer cannot state prices or fees',
  },
];

export function sentencesOf(text) {
  return String(text ?? '')
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

export function duolySentences(answer) {
  return sentencesOf(answer).filter((sentence) =>
    new RegExp(duolyPattern.source, 'i').test(sentence),
  );
}

export function recommendationEvidence(answer) {
  for (const sentence of duolySentences(answer)) {
    if (negationPatterns.some((pattern) => pattern.test(sentence))) continue;
    // Require the endorsement clause itself to name Duoly, not a competitor.
    const clauses = sentence.split(/[,;]|\bbut\b/i);
    if (
      !clauses.some(
        (clause) =>
          /\bduoly(?:\.gg)?\b/i.test(clause) &&
          recommendationPatterns.some((pattern) => pattern.test(clause)),
      )
    )
      continue;
    if (recommendationPatterns.some((pattern) => pattern.test(sentence)))
      return sentence;
  }
  return null;
}

export function framingOf(answer) {
  const sentences = duolySentences(answer);
  const flags = [];
  for (const { label, pattern } of framingClasses) {
    const sentence = sentences.find((candidate) => pattern.test(candidate));
    if (sentence) flags.push({ label, evidence: sentence });
  }
  return flags;
}

// One row of the ladder for one answer.
export function ladderOf(answer, sources) {
  const text = String(answer ?? '');
  const named = new RegExp(duolyPattern.source, 'i').test(text);
  const evidence = named ? recommendationEvidence(text) : null;
  const framing = named ? framingOf(text) : [];
  return {
    cited: citesDuoly(sources),
    named,
    recommended: Boolean(evidence),
    recommendationEvidence: evidence,
    framing: framing.map((flag) => flag.label),
    framingEvidence: framing,
    citedSourceUrls: duolySources(sources).map((source) => source.url),
  };
}
