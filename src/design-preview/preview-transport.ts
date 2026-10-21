import { BASE_PREVIEW_FIXTURES } from './sample-data';

export const PREVIEW_UNAVAILABLE =
  'Design preview: this action is unavailable. Nothing was sent or changed.';

function deepFreeze<T>(value: T): Readonly<T> {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach((entry) => deepFreeze(entry));
    Object.freeze(value);
  }
  return value;
}

export const PREVIEW_FIXTURES = deepFreeze(BASE_PREVIEW_FIXTURES);

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-duoly-design-preview': 'sample-data',
    },
  });
}

function unavailable(status: number, error: string): Response {
  return json(status, { error });
}

/**
 * Lexically replaces vendor fetch calls. It never delegates to global fetch and
 * only serves the explicitly listed, immutable sample fixtures above.
 */
export async function previewFetch(
  input: string | URL,
  init: RequestInit = {},
): Promise<Response> {
  const method = (init.method ?? 'GET').toUpperCase();
  if (!['GET', 'HEAD'].includes(method)) {
    return unavailable(405, PREVIEW_UNAVAILABLE);
  }

  let url: URL;
  try {
    url = new URL(String(input), 'https://design-preview.invalid');
  } catch {
    return unavailable(404, 'Unknown design preview fixture.');
  }

  if (
    url.origin !== 'https://design-preview.invalid' ||
    String(input).startsWith('//') ||
    !Object.prototype.hasOwnProperty.call(PREVIEW_FIXTURES, url.pathname)
  ) {
    return unavailable(404, 'Unknown design preview fixture.');
  }

  const fixture =
    PREVIEW_FIXTURES[url.pathname as keyof typeof PREVIEW_FIXTURES];
  return method === 'HEAD'
    ? new Response(null, { status: 200 })
    : json(200, fixture);
}
