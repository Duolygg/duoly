import { execFileSync } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';

export const HOST = 'https://eu.posthog.com';
export const PROJECT = 329587;
export const ROOT = `/api/environments/${PROJECT}/`;

export function readKey() {
  return (
    process.env.POSTHOG_PERSONAL_API_KEY ||
    execFileSync(
      'security',
      ['find-generic-password', '-s', 'duoly-posthog-personal-api-key', '-w'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    ).trim()
  );
}

export class ApiError extends Error {
  constructor(status, method, path, body) {
    // Never include provider response text: it can contain credentials/identity.
    super(
      `PostHog ${method} ${path.split('?')[0]}: HTTP ${status} (${body?.type || 'request_error'}${body?.code ? `/${body.code}` : ''})`,
    );
    this.status = status;
    this.validation = status === 400 ? body : undefined;
  }
}

export class ApiClient {
  constructor({
    key = '',
    apply = false,
    fetchImpl = globalThis.fetch,
    sleep = (ms) =>
      new Promise((resolve) => globalThis.setTimeout(resolve, ms)),
  } = {}) {
    this.key = key;
    this.apply = apply;
    this.fetchImpl = fetchImpl;
    this.sleep = sleep;
    this.counts = {
      creates: 0,
      updates: 0,
      unchanged: 0,
      verified: 0,
      plannedCreates: 0,
      plannedUpdates: 0,
    };
  }
  async request(path, { method = 'GET', body, recover } = {}) {
    const url = new globalThis.URL(path, HOST);
    if (url.origin !== HOST || !url.pathname.startsWith('/api/'))
      throw new Error('Refusing untrusted API URL');
    if (!this.apply && !['GET', 'OPTIONS'].includes(method))
      throw new Error('Dry run cannot write');
    for (let attempt = 0; attempt < 6; attempt++) {
      let response;
      try {
        response = await this.fetchImpl(url.toString(), {
          method,
          headers: {
            Authorization: `Bearer ${this.key}`,
            'Content-Type': 'application/json',
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          signal: globalThis.AbortSignal.timeout(90000),
        });
      } catch {
        if (attempt === 5)
          throw new Error(`PostHog network failure: ${method} ${url.pathname}`);
        await this.sleep(1000 * 2 ** attempt);
        const recovered = recover && (await recover());
        if (recovered) return recovered;
        continue;
      }
      const text = await response.text();
      let data;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = null;
      }
      if (response.ok) return data;
      if ((response.status === 429 || response.status >= 500) && attempt < 5) {
        const retry = response.headers.get('Retry-After');
        const seconds = retry === null ? NaN : Number(retry);
        const delay =
          retry === null
            ? 0
            : Number.isFinite(seconds)
              ? seconds * 1000
              : Math.max(0, Date.parse(retry) - Date.now());
        await this.sleep(
          Math.max(Number.isFinite(delay) ? delay : 0, 1000 * 2 ** attempt),
        );
        const recovered = recover && (await recover());
        if (recovered) return recovered;
        continue;
      }
      throw new ApiError(response.status, method, url.pathname, data);
    }
  }
  async list(resource, params = '') {
    let path = `${ROOT}${resource}/?limit=100${params ? `&${params}` : ''}`;
    const rows = [];
    while (path) {
      const data = await this.request(path);
      rows.push(...(Array.isArray(data) ? data : data.results || []));
      path = data.next || null;
    }
    return rows;
  }
}

/** Server may add defaults; all requested fields must survive read-back. */
export function contains(actual, expected) {
  if (expected === null || typeof expected !== 'object')
    return isDeepStrictEqual(actual, expected);
  if (Array.isArray(expected))
    return (
      Array.isArray(actual) &&
      actual.length === expected.length &&
      expected.every((value, index) => contains(actual[index], value))
    );
  return (
    actual &&
    Object.entries(expected).every(([key, value]) =>
      contains(actual[key], value),
    )
  );
}

export function matches(row, payload) {
  return Object.entries(payload).every(([key, value]) => {
    if (key === 'tags')
      return (
        Array.isArray(row.tags) &&
        row.tags.length === value.length &&
        value.every((tag) => row.tags.includes(tag))
      );
    if (key === 'dashboards')
      return value.every(
        (id) =>
          row.dashboards?.includes(id) ||
          row.dashboard_tiles?.some((t) => t.dashboard_id === id),
      );
    if (key === 'subscribed_users')
      return value.every((id) =>
        row.subscribed_users?.some((u) => u === id || u.id === id),
      );
    return contains(row[key], value);
  });
}

/** One stable name, no deletion or mutation of unrelated objects. Run serially. */
export async function upsert(
  api,
  resource,
  rows,
  payload,
  { canonical = false } = {},
) {
  if (!canonical && !payload.name.startsWith('[duoly]'))
    throw new Error('Missing management marker');
  const found = rows.filter((row) => row.name === payload.name && !row.deleted);
  if (found.length > 1)
    throw new Error(`Duplicate stable name: ${resource}/${payload.name}`);
  const existing = found[0];
  const changed = !existing || !matches(existing, payload);
  if (!api.apply) {
    if (changed) api.counts[existing ? 'plannedUpdates' : 'plannedCreates']++;
    return existing || { ...payload, id: `dry-${resource}-${payload.name}` };
  }
  let result = existing;
  if (changed) {
    result = await api.request(
      `${ROOT}${resource}/${existing ? `${existing.id}/` : ''}`,
      {
        method: existing ? 'PATCH' : 'POST',
        body: payload,
        // Recover a POST accepted before a timeout/5xx, instead of duplicating it.
        ...(existing
          ? {}
          : {
              recover: async () => {
                const candidates = (await api.list(resource)).filter(
                  (row) => row.name === payload.name && !row.deleted,
                );
                if (candidates.length > 1)
                  throw new Error(`Duplicate after retry: ${payload.name}`);
                return candidates[0];
              },
            }),
      },
    );
    api.counts[existing ? 'updates' : 'creates']++;
  } else api.counts.unchanged++;
  const verified = await api.request(
    `${ROOT}${resource}/${result.id}/?include_dashboards=true`,
  );
  if (!matches(verified, payload))
    throw new Error(`Read-back mismatch: ${resource}/${payload.name}`);
  api.counts.verified++;
  if (!existing) rows.push(verified);
  return verified;
}
