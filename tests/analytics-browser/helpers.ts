import type { Page, Request } from '@playwright/test';
import { gunzipSync } from 'node:zlib';
import { readFile } from 'node:fs/promises';

export const HOST = 'https://ph.analytics.test';

// posthog-js treats automated browsers (navigator.webdriver, HeadlessChrome brand) as bots
// and sends nothing.
export async function hideAutomation(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'webdriver', {
      get: () => false,
    });
    Object.defineProperty(Navigator.prototype, 'userAgentData', {
      get: () => undefined,
    });
  });
}

export type Sent = {
  event: string;
  properties: Record<string, unknown>;
  $set_once?: unknown;
};

/** rrweb compresses full snapshots and mutation fields independently (cv 2024-10). */
function unpackSnapshots(value: unknown): unknown {
  if (typeof value === 'string' && value.charCodeAt(0) === 31) {
    return unpackSnapshots(
      JSON.parse(gunzipSync(Buffer.from(value, 'latin1')).toString('utf8')),
    );
  }
  if (Array.isArray(value)) return value.map(unpackSnapshots);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, unpackSnapshots(v)]),
    );
  return value;
}

/** Decode a posthog-js batch whatever the transport encoding (json, gzip, base64 form). */
export function decode(request: Request): Sent[] {
  const body = request.postDataBuffer();
  if (!body || body.length === 0) return [];
  let text: string;
  try {
    text = gunzipSync(body).toString('utf8');
  } catch {
    text = body.toString('utf8');
  }
  if (text.startsWith('data=')) {
    text = Buffer.from(decodeURIComponent(text.slice(5)), 'base64').toString(
      'utf8',
    );
  }
  try {
    const parsed: unknown = JSON.parse(text);
    const list = Array.isArray(parsed)
      ? parsed
      : ((parsed as { batch?: unknown[] }).batch ?? [parsed]);
    return list.map((event) => {
      const sent = event as Sent;
      if (sent.event === '$snapshot')
        sent.properties.$snapshot_data = unpackSnapshots(
          sent.properties.$snapshot_data,
        );
      return sent;
    });
  } catch (error) {
    throw new Error(
      `Analytics payload could not be decoded: ${String(error)}`,
      {
        cause: error,
      },
    );
  }
}

export async function capture(page: Page, replay = false) {
  const requests: Request[] = [];
  await page.route(`${HOST}/**`, async (route) => {
    requests.push(route.request());
    const url = route.request().url();
    if (
      replay &&
      /\/(lazy-recorder|posthog-recorder)\.js/.test(new URL(url).pathname)
    ) {
      return route.fulfill({
        contentType: 'text/javascript',
        body: await readFile(
          new URL(
            '../../node_modules/posthog-js/dist/lazy-recorder.js',
            import.meta.url,
          ),
        ),
      });
    }
    if (url.endsWith('.js') && url.includes('/config'))
      return route.fulfill({ contentType: 'text/javascript', body: '' });
    if (
      replay &&
      /\/(flags|decide)\/?|\/array\/.*\/config/.test(new URL(url).pathname)
    ) {
      return route.fulfill({
        json: {
          sessionRecording: {
            endpoint: '/s/',
            sampleRate: 1,
            minimumDurationMilliseconds: 0,
          },
          supportedCompression: [],
          capturePerformance: false,
        },
      });
    }
    if (url.endsWith('.js'))
      return route.fulfill({ contentType: 'text/javascript', body: '' });
    return route.fulfill({ contentType: 'application/json', body: '{}' });
  });
  const events = () =>
    requests
      .filter((r) => r.method() === 'POST')
      .flatMap((r) => decode(r))
      .filter((e) => e && typeof e.event === 'string');
  return { requests, events };
}
