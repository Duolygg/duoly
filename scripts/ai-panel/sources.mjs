// Source links behind an answer: normalize what each provider returns into one shape,
// so Google grounding redirects stop hiding the real cited domain.
const { URL } = globalThis;

// Google grounding returns a redirect wrapper instead of the source URL. Following it
// needs a network call, so the domain is recovered from the chunk metadata instead.
export const redirectHosts = new Set([
  'vertexaisearch.cloud.google.com',
  'grounding-api-redirect.googleapis.com',
]);

// A grounding title is often the bare source domain. These endings look domain shaped
// but are filenames, so they must not become a domain.
const fileEndings = new Set([
  'pdf',
  'doc',
  'docx',
  'html',
  'htm',
  'json',
  'csv',
  'txt',
  'md',
  'png',
  'jpg',
  'jpeg',
  'webp',
  'xml',
  'zip',
]);

export function hostOf(value) {
  try {
    const { hostname } = new URL(value);
    return hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function isRedirectUrl(value) {
  const host = hostOf(value);
  if (redirectHosts.has(host)) return true;
  return host === 'google.com' && /\/url\?/.test(value);
}

export function domainFromTitle(title) {
  const text = String(title ?? '')
    .trim()
    .toLowerCase()
    .replace(/^www\./, '');
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(text)) return '';
  const ending = text.split('.').at(-1);
  if (fileEndings.has(ending) || ending.length < 2) return '';
  return text;
}

// Accepts a URL string or a provider source object and returns one normalized record.
export function normalizeSource(input) {
  const raw = typeof input === 'string' ? { url: input } : (input ?? {});
  const url = typeof raw.url === 'string' ? raw.url : '';
  const title = typeof raw.title === 'string' ? raw.title : '';
  const redirect = isRedirectUrl(url);
  // A direct URL is authoritative. Metadata is only a fallback for redirects.
  const domain =
    (redirect ? '' : hostOf(url)) ||
    domainFromTitle(raw.domain) ||
    domainFromTitle(title);
  return {
    url,
    title,
    domain,
    redirect,
    // Flags the rows where the domain came from metadata rather than a resolvable URL.
    domainFromMetadata: Boolean(domain) && (redirect || !hostOf(url)),
  };
}

export function normalizeSources(list) {
  const seen = new Set();
  const sources = [];
  for (const entry of list ?? []) {
    const source = normalizeSource(entry);
    if (!source.url && !source.domain) continue;
    const key = source.url || `domain:${source.domain}`;
    if (seen.has(key)) continue;
    seen.add(key);
    sources.push(source);
  }
  return sources;
}

export function isDuolyDomain(domain) {
  const host = String(domain ?? '')
    .trim()
    .toLowerCase()
    .replace(/^www\./, '');
  return host === 'duoly.gg' || host.endsWith('.duoly.gg');
}

export function citesDuoly(sources) {
  return (sources ?? []).some((source) => isDuolyDomain(source.domain));
}

export function duolySources(sources) {
  return (sources ?? []).filter((source) => isDuolyDomain(source.domain));
}

// Ranked domain counts. `prompts` counts distinct prompts, `hits` counts every occurrence,
// so one answer citing a domain six times cannot outrank six answers citing it once.
export function rankDomains(entries) {
  const totals = new Map();
  for (const entry of entries ?? []) {
    const domains = (entry.domains ?? []).filter(Boolean).map(String);
    for (const domain of domains) {
      const row = totals.get(domain) ?? { domain, prompts: 0, hits: 0 };
      row.hits += 1;
      totals.set(domain, row);
    }
    for (const domain of new Set(domains)) totals.get(domain).prompts += 1;
  }
  return [...totals.values()].sort(
    (a, b) =>
      b.prompts - a.prompts ||
      b.hits - a.hits ||
      a.domain.localeCompare(b.domain),
  );
}
