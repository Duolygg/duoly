/* global fetch, URL, AbortSignal, console */
import process from 'node:process';
import { pathToFileURL } from 'node:url';

export const INDEXNOW_KEY = 'ef93dbc5aa33702f80250d826948b1cf';
const host = 'duoly.gg';
export const keyLocation = `https://${host}/${INDEXNOW_KEY}.txt`;

export function submissionPayload(urls) {
  const urlList = [...new Set(urls)];
  if (!urlList.length || urlList.length > 10000)
    throw new Error('IndexNow requires 1 to 10000 URLs');
  for (const value of urlList) {
    const url = new URL(value);
    if (
      url.origin !== `https://${host}` ||
      url.username ||
      url.password ||
      url.hash
    )
      throw new Error(
        `Expected an absolute https://${host} URL without a fragment: ${value}`,
      );
  }
  return { host, key: INDEXNOW_KEY, keyLocation, urlList };
}

export async function submitIndexNow(
  args = [],
  request = fetch,
  log = console.log,
) {
  let urls = args;
  if (!urls.length) {
    const response = await request(`https://${host}/sitemap.xml`, {
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error(`Sitemap HTTP ${response.status}`);
    const xml = await response.text();
    urls = [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map((match) =>
      match[1]
        .replaceAll('&amp;', '&')
        .replaceAll('&quot;', '"')
        .replaceAll('&apos;', "'")
        .replaceAll('&lt;', '<')
        .replaceAll('&gt;', '>'),
    );
  }
  const payload = submissionPayload(urls);
  const response = await request('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30000),
  });
  log(`IndexNow HTTP ${response.status} (${payload.urlList.length} URLs)`);
  if (!response.ok)
    throw new Error(`IndexNow submission failed: HTTP ${response.status}`);
  return response.status;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  submitIndexNow(process.argv.slice(2)).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
