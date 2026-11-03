/**
 * Duoly's Trustpilot profile, behind the "Our customers say we are ..." line under the homepage hero
 * (ledger #43: real figures only). The line names neither Trustpilot nor its logo (paid plans only).
 * Stays hidden until all three values come from the live profile. Update score and reviews by hand.
 */
export const TRUSTPILOT = {
  url: 'https://www.trustpilot.com/review/duoly.gg' as string | null,
  score: 4.8 as number | null, // PREVIEW ONLY: replace with the real Trustpilot score
  reviews: 12 as number | null, // PREVIEW ONLY: replace with the real review count
};

export interface TrustpilotSummary {
  url: string;
  score: string;
  label: string;
  stars: number;
  reviews: string;
}

// Trustpilot's own TrustScore wording.
function labelOf(score: number): string {
  if (score >= 4.3) return 'Excellent';
  if (score >= 3.8) return 'Great';
  if (score >= 2.8) return 'Average';
  if (score >= 1.8) return 'Poor';
  return 'Bad';
}

export function trustpilotSummary(
  config: typeof TRUSTPILOT = TRUSTPILOT,
): TrustpilotSummary | null {
  const { url, score, reviews } = config;
  if (!url || score === null || reviews === null) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (
    parsed.protocol !== 'https:' ||
    !/(^|\.)trustpilot\.com$/.test(parsed.hostname)
  )
    return null;
  if (!Number.isFinite(score) || score < 1 || score > 5) return null;
  if (!Number.isInteger(reviews) || reviews < 1) return null;
  return {
    url: parsed.href,
    score: score.toFixed(1),
    label: labelOf(score),
    stars: Math.round(score * 2) / 2,
    reviews:
      reviews.toLocaleString('en-US') +
      (reviews === 1 ? ' review' : ' reviews'),
  };
}

/**
 * Trustpilot's "write a review" page, offered after every review in the order room. Every customer
 * gets it whatever they rated: asking only happy customers breaks Trustpilot's guidelines.
 */
export const TRUSTPILOT_EVALUATE =
  'https://www.trustpilot.com/evaluate/duoly.gg';
