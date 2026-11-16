import { beforeEach, expect, it, vi } from 'vitest';
import {
  clearShortLinkCache,
  creatorShortLink,
  shortLinkCode,
} from '../../src/server/creators/short-link';

const url = (path: string) => new URL('https://duoly.gg' + path);
beforeEach(() => clearShortLinkCache());

it('only treats one-segment code-shaped paths as creator links', () => {
  expect(shortLinkCode('/yourname')).toBe('YOURNAME');
  expect(shortLinkCode('/Kiwi10/')).toBe('KIWI10');
  expect(shortLinkCode('/teammates/kiwi')).toBeNull();
  expect(shortLinkCode('/wp-login.php')).toBeNull();
  expect(shortLinkCode('/ab')).toBeNull();
  expect(shortLinkCode('/')).toBeNull();
});

it('redirects a 404 for an active code to the referral link and keeps other params', async () => {
  const lookup = vi.fn(async (code: string) => code === 'KIWI10');
  expect(
    await creatorShortLink(
      url('/kiwi10?utm_source=twitch'),
      'GET',
      404,
      lookup,
    ),
  ).toBe('/?utm_source=twitch&ref=KIWI10');
  expect(await creatorShortLink(url('/nobody'), 'GET', 404, lookup)).toBeNull();
});

it('never touches pages that exist, non-GET requests or a failing lookup', async () => {
  const lookup = vi.fn(async () => true);
  expect(
    await creatorShortLink(url('/pricing'), 'GET', 200, lookup),
  ).toBeNull();
  expect(
    await creatorShortLink(url('/kiwi10'), 'POST', 404, lookup),
  ).toBeNull();
  expect(lookup).not.toHaveBeenCalled();
  const broken = vi.fn(async () => {
    throw new Error('down');
  });
  expect(await creatorShortLink(url('/kiwi10'), 'GET', 404, broken)).toBeNull();
});

it('caches answers so repeated 404 probes do not hit the database', async () => {
  const lookup = vi.fn(async () => false);
  await creatorShortLink(url('/admin1'), 'GET', 404, lookup, 1000);
  await creatorShortLink(url('/ADMIN1'), 'GET', 404, lookup, 2000);
  expect(lookup).toHaveBeenCalledTimes(1);
  await creatorShortLink(url('/admin1'), 'GET', 404, lookup, 1000 + 6 * 60_000);
  expect(lookup).toHaveBeenCalledTimes(2);
});
