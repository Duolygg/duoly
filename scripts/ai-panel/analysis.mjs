const { URL } = globalThis;

export const brands = {
  epal: /\be[\s-]?pal\b/gi,
  fiverr: /\bfiverr\b/gi,
  tapin: /\btap[\s-]?in\b/gi,
  metafy: /\bmetafy\b/gi,
  gamerspal: /\bgamerspal\b/gi,
  playerduo: /\bplayer[\s-]?duo\b/gi,
  lfcarry: /\blfcarry\b/gi,
  discord: /\bdiscord\b/gi,
  reddit: /\breddit\b/gi,
};

export function isDuolyUrl(value) {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host === 'duoly.gg' || host.endsWith('.duoly.gg');
  } catch {
    return false;
  }
}

export function analyze(answer, urls) {
  const mentions = [...answer.matchAll(/\bduoly(?:\.gg)?\b/gi)];
  const positions = [
    ...mentions.map((match) => ({ brand: 'duoly', position: match.index })),
    ...Object.entries(brands).flatMap(([brand, pattern]) =>
      [...answer.matchAll(pattern)].map((match) => ({
        brand,
        position: match.index,
      })),
    ),
  ].sort((a, b) => a.position - b.position);
  const order = [...new Set(positions.map((entry) => entry.brand))];
  return {
    duolyMentioned: mentions.length > 0,
    duolyDomainMentioned: /\bduoly\.gg\b/i.test(answer),
    duolyCited: urls.some(isDuolyUrl),
    firstMentionCharacter: mentions[0]?.index ?? null,
    firstMentionRank: mentions.length ? order.indexOf('duoly') + 1 : null,
    competitors: Object.entries(brands)
      .filter(([, pattern]) => [...answer.matchAll(pattern)].length > 0)
      .map(([brand]) => brand),
  };
}

export function summarize(rows) {
  return [...new Set(rows.map((row) => row.provider))].map((provider) => {
    const group = rows.filter((row) => row.provider === provider);
    const answered = group.filter((row) => row.status === 'answered');
    const competitors = Object.keys(brands)
      .map((brand) => ({
        brand,
        count: answered.filter((row) => row.competitors.includes(brand)).length,
      }))
      .filter((entry) => entry.count)
      .sort((a, b) => b.count - a.count || a.brand.localeCompare(b.brand));
    return {
      provider,
      attempted: group.filter((row) => row.status !== 'skipped').length,
      answered: answered.length,
      mentioned: answered.filter((row) => row.duolyMentioned).length,
      cited: answered.filter((row) => row.duolyCited).length,
      competitors,
      estimatedUsd: group.reduce(
        (sum, row) => sum + (row.estimatedUsd ?? 0),
        0,
      ),
      unknownCostRequests: group.filter(
        (row) => row.status === 'error' || row.estimatedUsd === null,
      ).length,
    };
  });
}
