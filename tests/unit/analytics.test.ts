import { describe, expect, it } from 'vitest';
import { createAnalytics } from '../../src/lib/analytics';

describe('analytics consent gate', () => {
  for (const enabled of [false, true]) {
    for (const configured of [false, true]) {
      for (const consent of [false, true]) {
        it(`emits only with all gates true: ${enabled}/${configured}/${consent}`, () => {
          const events: unknown[] = [];
          const analytics = createAnalytics({
            enabled,
            configured,
            consent,
            send: (event) => events.push(event),
          });
          analytics.pageview();
          expect(events).toEqual(
            enabled && configured && consent ? [{ name: 'pageview' }] : [],
          );
        });
      }
    }
  }
  it('emits no URL, identity or arbitrary properties even if passed at runtime', () => {
    const events: unknown[] = [];
    const analytics = createAnalytics({
      enabled: true,
      configured: true,
      consent: true,
      send: (event) => events.push(event),
    });
    // @ts-expect-error Pageviews deliberately accept no caller properties.
    analytics.pageview({
      url: 'https://example.invalid/private?email=person@example.invalid#token',
      email: 'person@example.invalid',
    });
    expect(events).toEqual([{ name: 'pageview' }]);
  });
  it('stops emitting immediately when consent is withdrawn', () => {
    const events: unknown[] = [];
    const analytics = createAnalytics({
      enabled: true,
      configured: true,
      consent: true,
      send: (event) => events.push(event),
    });
    analytics.pageview();
    analytics.setConsent(false);
    analytics.pageview();
    expect(events).toEqual([{ name: 'pageview' }]);
  });
  it('does not emit unless explicitly configured and consented', () => {
    const events: unknown[] = [];
    for (const enabled of [false, true]) {
      for (const consent of [false, true]) {
        const analytics = createAnalytics({
          enabled,
          configured: false,
          consent,
          send: (event) => events.push(event),
        });
        analytics.pageview();
      }
    }
    expect(events).toEqual([]);
  });
});
