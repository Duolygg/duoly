import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearCreatorClickThrottle,
  countCreatorLinkClick,
  shouldCountClick,
} from '../../src/server/creators/clicks';
import { creatorApplicationBody } from '../../src/server/creators/inbox';
import { waitUntil } from '@vercel/functions';

vi.mock('@vercel/functions', () => ({ waitUntil: vi.fn() }));

/**
 * The aggregate click counter. It is the one creator number that is counted without any consent,
 * because there is nothing in it about the visitor: a code, a day and a count.
 */
describe('creator link clicks', () => {
  beforeEach(() => clearCreatorClickThrottle());

  it('counts a landing with a valid code, once per visit', () => {
    const counter = vi.fn(async () => undefined);
    expect(
      countCreatorLinkClick(
        new URL('https://duoly.gg/?ref=alex10'),
        'GET',
        counter,
        1000,
      ),
    ).toBe('ALEX10');
    expect(counter).toHaveBeenCalledWith('ALEX10');
  });
  it('does not care about the consent cookie', () => {
    // The signature takes no cookies at all: there is nothing to gate on.
    expect(countCreatorLinkClick.length).toBeLessThanOrEqual(4);
    // The code itself, without the comments that explain why there is nothing to gate on.
    const code = readFileSync('src/server/creators/clicks.ts', 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '');
    expect(code).not.toMatch(/consent|cookie|headers|ip\b|user_id/i);
  });
  it('keeps a pending database write alive after the response without awaiting it', async () => {
    vi.mocked(waitUntil).mockClear();
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    expect(
      countCreatorLinkClick(
        new URL('https://duoly.gg/?ref=LIFETIME'),
        'GET',
        () => pending,
      ),
    ).toBe('LIFETIME');
    expect(waitUntil).toHaveBeenCalledWith(expect.any(Promise));
    finish();
    await pending;
  });
  it('ignores pages without a code, bad codes, API paths and other methods', () => {
    const counter = vi.fn(async () => undefined);
    for (const [url, method] of [
      ['https://duoly.gg/', 'GET'],
      ['https://duoly.gg/?ref=no', 'GET'],
      ['https://duoly.gg/?ref=bad%20code', 'GET'],
      ['https://duoly.gg/api/checkout?ref=ALEX10', 'GET'],
      ['https://duoly.gg/auth/callback?ref=ALEX10', 'GET'],
      ['https://duoly.gg/?ref=ALEX10', 'POST'],
    ] as const)
      expect(
        countCreatorLinkClick(new URL(url), method, counter),
        `${method} ${url}`,
      ).toBeNull();
    expect(counter).not.toHaveBeenCalled();
  });
  it('throttles a burst on one code, and keeps counting the next visitor', () => {
    expect(shouldCountClick('ALEX10', 1000)).toBe(true);
    expect(shouldCountClick('ALEX10', 1100)).toBe(false);
    expect(shouldCountClick('BETA', 1100)).toBe(true);
    expect(shouldCountClick('ALEX10', 9000)).toBe(true);
  });
  it('never lets a failing counter reach the visitor', () => {
    const thrower = vi.fn(() => {
      throw new Error('database down');
    });
    expect(
      countCreatorLinkClick(
        new URL('https://duoly.gg/?ref=ALEX10'),
        'GET',
        thrower as never,
      ),
    ).toBe('ALEX10');
  });
  it('is wired into the middleware, before the response is built', () => {
    const middleware = readFileSync('src/middleware.ts', 'utf8');
    expect(middleware).toContain('countCreatorLinkClick(');
    expect(middleware.indexOf('countCreatorLinkClick(')).toBeLessThan(
      middleware.indexOf('await next()'),
    );
    // Not awaited: a click must never slow a page down.
    expect(middleware).not.toMatch(/await countCreatorLinkClick/);
    // The short link redirect sends the visitor to /?ref=CODE, which is counted there, so the
    // short link is not counted a second time.
    expect(middleware).toContain('creatorShortLink(');
  });
});

describe('the support inbox note', () => {
  it('carries the channel and never the applicant account id', () => {
    const body = creatorApplicationBody({
      name: 'Alex Rivera',
      email: 'alex@example.com',
      code: 'ALEX10',
      platform: 'Twitch',
      channel: 'twitch.tv/alexrivera',
      audience: '1K to 10K',
      game: 'lol',
      country: 'Austria',
      message: 'I stream every evening.',
    });
    expect(body).toContain('Creator application');
    expect(body).toContain('Code: ALEX10');
    expect(body).toContain('twitch.tv/alexrivera');
    expect(body).toContain('I stream every evening.');
    expect(body).toContain('Admin, Creators');
    expect(body.length).toBeLessThanOrEqual(2000);
  });
});
