import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import {
  INDEXNOW_KEY,
  keyLocation,
  submissionPayload,
  submitIndexNow,
} from '../../scripts/indexnow.mjs';

it('hosts the exact public verification key', () => {
  expect(INDEXNOW_KEY).toMatch(/^[a-f0-9]{32}$/);
  expect(readFileSync(`public/${INDEXNOW_KEY}.txt`, 'utf8').trim()).toBe(
    INDEXNOW_KEY,
  );
  expect(keyLocation).toBe(`https://duoly.gg/${INDEXNOW_KEY}.txt`);
});
it('validates the entire list before sending and deduplicates it', () => {
  expect(
    submissionPayload(['https://duoly.gg/games', 'https://duoly.gg/games'])
      .urlList,
  ).toEqual(['https://duoly.gg/games']);
  for (const urls of [
    [],
    ['http://duoly.gg/games'],
    ['https://other.example/'],
    ['https://duoly.gg/games#prices'],
    ['https://duoly.gg@other.example/'],
    Array.from({ length: 10001 }, (_, i) => `https://duoly.gg/${i}`),
  ])
    expect(() => submissionPayload(urls)).toThrow();
});
it('submits explicit changed URLs without retrieving the sitemap', async () => {
  const request = vi.fn().mockResolvedValue(new Response('', { status: 202 }));
  const log = vi.fn();
  expect(
    await submitIndexNow(
      ['https://duoly.gg/games/pokemon-unite/teammate'],
      request,
      log,
    ),
  ).toBe(202);
  expect(request).toHaveBeenCalledTimes(1);
  const [url, options] = request.mock.calls[0]!;
  expect(url).toBe('https://api.indexnow.org/indexnow');
  expect(options.method).toBe('POST');
  expect(JSON.parse(options.body)).toEqual(
    submissionPayload(['https://duoly.gg/games/pokemon-unite/teammate']),
  );
  expect(log).toHaveBeenCalledWith('IndexNow HTTP 202 (1 URLs)');
});
it('reads sitemap locations and posts them with the key location', async () => {
  const request = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(
        '<urlset><url><loc>https://duoly.gg/games</loc></url><url><loc>https://duoly.gg/?a=1&amp;b=2</loc></url></urlset>',
      ),
    )
    .mockResolvedValueOnce(new Response('', { status: 200 }));
  await submitIndexNow([], request, vi.fn());
  expect(request.mock.calls[0]![0]).toBe('https://duoly.gg/sitemap.xml');
  expect(JSON.parse(request.mock.calls[1]![1].body).urlList).toEqual([
    'https://duoly.gg/games',
    'https://duoly.gg/?a=1&b=2',
  ]);
});
it('stops on sitemap failure and reports API failures', async () => {
  const request = vi.fn().mockResolvedValue(new Response('', { status: 503 }));
  await expect(submitIndexNow([], request, vi.fn())).rejects.toThrow(
    'Sitemap HTTP 503',
  );
  expect(request).toHaveBeenCalledTimes(1);
  const log = vi.fn();
  await expect(
    submitIndexNow(['https://duoly.gg/games'], request, log),
  ).rejects.toThrow('HTTP 503');
  expect(log).toHaveBeenCalledWith('IndexNow HTTP 503 (1 URLs)');
});
