// Adapter for Fabian's SupportChat fetch calls. The endpoint paths and response
// shapes stay the same; this only carries the live CSRF token and session cookies.
export function createSupportFetch({ csrf, fetcher = fetch }) {
  return async (url, init = {}) => {
    const next = { credentials: 'same-origin', cache: 'no-store', ...init };
    if (next.method === 'POST') {
      const body = JSON.parse(next.body || '{}');
      next.body = JSON.stringify({ ...body, csrf });
    }
    return fetcher(url, next);
  };
}
