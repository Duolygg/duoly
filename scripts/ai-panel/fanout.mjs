// Retrieved search sources, explicit opens and citations are separate evidence.
import { rankDomains, isDuolyDomain } from './sources.mjs';

export function aggregateFanOut(rows) {
  const answered = (rows ?? []).filter((row) => row.status === 'answered');
  const ranks = (field) =>
    new Map(
      rankDomains(answered.map((row) => ({ domains: row[field] }))).map(
        (entry) => [entry.domain, entry],
      ),
    );
  const searched = ranks('searchedDomains');
  const opened = ranks('openedDomains');
  const cited = ranks('citedDomains');
  const domains = [
    ...new Set([...searched.keys(), ...opened.keys(), ...cited.keys()]),
  ]
    .map((domain) => ({
      domain,
      searchedInPrompts: searched.get(domain)?.prompts ?? 0,
      openedInPrompts: opened.get(domain)?.prompts ?? 0,
      opens: opened.get(domain)?.hits ?? 0,
      citedInPrompts: cited.get(domain)?.prompts ?? 0,
    }))
    .sort(
      (a, b) =>
        b.searchedInPrompts - a.searchedInPrompts ||
        b.openedInPrompts - a.openedInPrompts ||
        b.citedInPrompts - a.citedInPrompts ||
        a.domain.localeCompare(b.domain),
    );
  return {
    promptsAnswered: answered.length,
    searchCalls: answered.reduce((sum, row) => sum + (row.searchCalls ?? 0), 0),
    distinctQueries: new Set(answered.flatMap((row) => row.queries ?? [])).size,
    tracesAvailable: answered.filter((row) => row.traceAvailable).length,
    sourceIncludeSupported: answered.every(
      (row) => row.sourceInclude !== false,
    ),
    queriesByPrompt: answered.map((row) => ({
      id: row.id,
      prompt: row.prompt,
      queries: row.queries ?? [],
      searchedDomains: [...new Set(row.searchedDomains ?? [])],
      openedDomains: [...new Set(row.openedDomains ?? [])],
      duolySearched:
        row.traceAvailable === false
          ? null
          : (row.searchedDomains ?? []).some(isDuolyDomain),
    })),
    domains,
  };
}
