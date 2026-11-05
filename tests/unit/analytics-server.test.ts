import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
const fake = vi.hoisted(() => ({
  capture: vi.fn(),
  flush: vi.fn(async () => {}),
  on: vi.fn(),
  construct: vi.fn(),
  waitUntil: vi.fn(),
}));
vi.mock('posthog-node', () => ({
  PostHog: class {
    capture = fake.capture;
    flush = fake.flush;
    on = fake.on;
    constructor(key: string, options: unknown) {
      fake.construct(key, options);
    }
  },
}));
vi.mock('@vercel/functions', () => ({ waitUntil: fake.waitUntil }));
import {
  resolveIdentity,
  uuidv5,
  validSessionId,
  serverTrack,
  flushAnalytics,
} from '../../src/server/analytics/client';
import { serverCatalogueProps } from '../../src/contracts/analytics-events';
const session = '019a1234-1234-7123-8123-123456789abc';
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('PUBLIC_ANALYTICS_ENABLED', 'true');
  vi.stubEnv('PUBLIC_POSTHOG_KEY', 'phc_test');
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
describe('server analytics privacy', () => {
  it('only identifies explicit consent', () => {
    expect(
      resolveIdentity('user', { analytics: true }, 'key', session),
    ).toEqual({ distinctId: 'user', properties: { $session_id: session } });
    for (const consent of [null, { analytics: false }]) {
      const result = resolveIdentity('user', consent, 'key', session);
      expect(result.distinctId).toBe(uuidv5('personless:key'));
      expect(result.properties).toEqual({ $process_person_profile: false });
    }
    expect(
      resolveIdentity(null, { analytics: true }, 'key', session).properties,
    ).toEqual({ $process_person_profile: false });
  });
  it('uses deterministic RFC v5 event identities, not account identities', () => {
    expect(uuidv5('a')).toBe('e1407479-3136-56c0-9908-bb02fb0339e2');
    expect(uuidv5('a')).not.toBe(uuidv5('b'));
    expect(resolveIdentity('a', null, 'key')).toEqual(
      resolveIdentity('b', null, 'key'),
    );
  });
  it.each([
    null,
    '',
    'https://example.com',
    session.replace('-7123-', '-4123-'),
    session + 'x',
    session.replace('-8123-', '-7123-'),
  ])('rejects invalid session header %s', (value) => {
    expect(validSessionId(value)).toBe(false);
    expect(
      resolveIdentity('user', { analytics: true }, 'key', value).properties,
    ).toEqual({});
  });
  it('accepts only v7 sessions', () => {
    expect(validSessionId(session)).toBe(true);
  });
  it('drops undeclared, URL and text properties and wrong kinds', () => {
    expect(
      serverCatalogueProps('review_submitted', {
        rating: 5,
        tag_count: 2,
        has_tip: true,
        user_id: 'secret',
        url: 'https://example.com',
        text: 'hello world',
      }),
    ).toEqual({ rating: 5, tag_count: 2, has_tip: true });
    expect(
      serverCatalogueProps('teammate_applied', {
        game: 'https://secret',
        services_count: -1,
        hours_bucket: 'anything',
        has_video: 'true',
      }),
    ).toEqual({});
    expect(serverCatalogueProps('unknown', {})).toBeNull();
    expect(serverCatalogueProps('constructor', {})).toBeNull();
  });
  it('disabled telemetry creates no client', async () => {
    vi.resetModules();
    const sdk = await import('../../src/server/analytics/client');
    vi.stubEnv('PUBLIC_ANALYTICS_ENABLED', 'false');
    sdk.serverTrack({ event: 'discord_linked', userId: 'user', consent: null });
    sdk.flushAnalytics();
    expect(fake.construct).not.toHaveBeenCalled();
    expect(fake.capture).not.toHaveBeenCalled();
  });
  it('missing key is a no-op', () => {
    vi.stubEnv('PUBLIC_POSTHOG_KEY', '');
    serverTrack({ event: 'discord_linked', userId: 'user', consent: null });
    expect(fake.capture).not.toHaveBeenCalled();
  });
  it('queues sanitized personless facts and flushes without shutdown', () => {
    serverTrack({
      event: 'review_submitted',
      userId: 'secret',
      consent: null,
      sessionId: session,
      stableKey: 'fact',
      properties: { rating: 4, user_id: 'secret' },
    });
    expect(fake.capture).toHaveBeenCalledWith({
      event: 'review_submitted',
      distinctId: uuidv5('personless:fact'),
      properties: { rating: 4, $process_person_profile: false },
    });
    flushAnalytics();
    expect(fake.waitUntil).toHaveBeenCalledWith(expect.any(Promise));
  });
  it('SDK errors never escape capture or flush, including missing platform context', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    fake.capture.mockImplementationOnce(() => {
      throw new Error('private');
    });
    expect(() =>
      serverTrack({ event: 'discord_linked', userId: 'user', consent: null }),
    ).not.toThrow();
    fake.flush.mockRejectedValueOnce(new Error('private'));
    fake.waitUntil.mockImplementationOnce(() => {
      throw new Error('not on Vercel');
    });
    expect(flushAnalytics).not.toThrow();
    await Promise.resolve();
    expect(console.warn).toHaveBeenCalledWith(
      'Server analytics delivery failed.',
    );
  });
});
