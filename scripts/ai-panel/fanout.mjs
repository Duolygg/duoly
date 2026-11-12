// Aggregates the ChatGPT fan-out rows into the ranked domain list that tells us where
// to be cited. One row per prompt, written by run.mjs --fan-out.
import { rankDomains } from './sources.mjs';

export function aggregateFanOut(rows) {
  const answered = (rows ?? []).filter((row) => row.status === 'answered');
  const opened = rankDomains(
    answered.map((row) => ({ promptId: row.id, domains: row.openedDomains })),
  );
  const cited = new Map(
    rankDomains(
      answered.map((row) => ({ promptId: row.id, domains: row.citedDomains })),
    ).map((entry) => [entry.domain, entry]),
  );
  const domains = [
    ...opened,
    // Domains that only appear as citations still belong in the list.
    ...[...cited.values()]
      .filter((entry) => !opened.some((row) => row.domain === entry.domain))
      .map((entry) => ({ domain: entry.domain, prompts: 0, hits: 0 })),
  ]
    .map((entry) => ({
      domain: entry.domain,
      searchedInPrompts: entry.prompts,
      opens: entry.hits,
      citedInPrompts: cited.get(entry.domain)?.prompts ?? 0,
    }))
    .sort(
      (a, b) =>
        b.searchedInPrompts - a.searchedInPrompts ||
        b.citedInPrompts - a.citedInPrompts ||
        b.opens - a.opens ||
        a.domain.localeCompare(b.domain),
    );
  return {
    promptsAnswered: answered.length,
    searchCalls: answered.reduce((sum, row) => sum + (row.searchCalls ?? 0), 0),
    distinctQueries: new Set(answered.flatMap((row) => row.queries ?? [])).size,
    sourceIncludeSupported: answered.every(
      (row) => row.sourceInclude !== false,
    ),
    queriesByPrompt: answered.map((row) => ({
      id: row.id,
      prompt: row.prompt,
      queries: row.queries ?? [],
      openedDomains: [...new Set(row.openedDomains ?? [])],
      duolySearched: (row.openedDomains ?? []).some(
        (domain) => domain === 'duoly.gg',
      ),
    })),
    domains,
  };
}
