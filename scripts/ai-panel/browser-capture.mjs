// Consumer surface parsers. Only observable search metadata is retained, never reasoning.
import { normalizeSources, hostOf } from './sources.mjs';

const { URL } = globalThis;

export function parseBrowserCapture(capture) {
  const answer = String(capture.answer ?? '').trim();
  if (!answer) throw new Error('empty answer capture');
  if (
    /sign up and repeat your request|you.ve reached.*limit|verify you are human/i.test(
      answer,
    )
  )
    throw new Error('blocked or rate-limited answer');
  const links = (capture.sourceLinks ?? []).flatMap((source) => {
    const raw = typeof source === 'string' ? { url: source } : source;
    try {
      const url = new URL(raw.url);
      let destination = url;
      if (
        ['google.com', 'www.google.com'].includes(url.hostname) &&
        url.pathname === '/url'
      )
        destination = new URL(
          url.searchParams.get('q') || url.searchParams.get('url'),
        );
      if (!['https:', 'http:'].includes(destination.protocol)) return [];
      if (/(^|\.)google\.com$/.test(destination.hostname)) return [];
      return [{ ...raw, domain: hostOf(destination.href) }];
    } catch {
      return [];
    }
  });
  const sources = normalizeSources(links);
  return {
    answer,
    sources,
    citedUrls: sources.map((s) => s.url),
    citedDomains: [...new Set(sources.map((s) => s.domain))],
    sourceCaptureComplete: capture.sourcesExpanded === true,
    complete: capture.answerComplete === true,
  };
}

// Accepts saved consumer conversation JSON or parsed SSE events. Search result groups
// are retrieved sources, NOT evidence that each page was explicitly opened.
export function parseChatGPTTrace(events) {
  const queries = [],
    searched = [],
    opened = [];
  const visit = (value) => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    for (const query of value.search_queries ?? []) {
      const text = typeof query === 'string' ? query : (query.q ?? query.query);
      if (typeof text === 'string' && text.trim()) queries.push(text.trim());
    }
    if (value.type === 'search' && typeof value.query === 'string')
      queries.push(value.query);
    for (const group of value.search_result_groups ?? [])
      for (const result of group.entries ?? group.results ?? [])
        if (typeof result.url === 'string') searched.push(result.url);
    if (
      ['open', 'open_page'].includes(value.type) &&
      typeof value.url === 'string'
    )
      opened.push(value.url);
    // Text / reasoning fields are intentionally never collected or interpreted.
    for (const [key, child] of Object.entries(value))
      if (
        !['search_queries', 'search_result_groups', 'text', 'parts'].includes(
          key,
        )
      )
        visit(child);
  };
  visit(events);
  return {
    queries: [...new Set(queries)],
    searchedDomains: [...new Set(searched.map(hostOf).filter(Boolean))],
    openedDomains: [...new Set(opened.map(hostOf).filter(Boolean))],
    openedUrls: [...new Set(opened)],
    traceAvailable:
      queries.length > 0 || searched.length > 0 || opened.length > 0,
  };
}

export function parseTraceBody(text) {
  try {
    return JSON.parse(text);
  } catch {
    /* SSE below */
  }
  return text
    .split('\n')
    .filter((line) => line.startsWith('data: '))
    .flatMap((line) => {
      try {
        return [JSON.parse(line.slice(6))];
      } catch {
        return [];
      }
    });
}
