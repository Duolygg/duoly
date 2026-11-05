import { describe, expect, it } from 'vitest';
import {
  LIVE_PRIVACY,
  PRIVACY_LIVE_EDITS,
  livePrivacy,
} from '../../src/site/privacy';

const text = () => JSON.stringify(LIVE_PRIVACY);

describe('live privacy policy', () => {
  it('applies every correction to the design reference text', () => {
    expect(livePrivacy().missing).toEqual([]);
  });
  it('no longer calls analytics planned or inactive', () => {
    expect(text()).not.toMatch(
      /Analytics is planned|counting is also planned|Analytics and ad measurement are planned/,
    );
    expect(text()).toContain(
      'Ad measurement is planned and is not active yet.',
    );
  });
  it('keeps the rest of the analytics section', () => {
    const analytics = LIVE_PRIVACY.sections.find((s) => s.id === 'analytics')!;
    expect(analytics.blocks[0]).toMatch(
      /^With your permission, we use \*\*PostHog/,
    );
    expect(JSON.stringify(analytics)).toContain('linked to your account ID');
  });
  it('states the real PostHog cookie lifetime', () => {
    expect(text()).toContain(
      '"ph_<project>_posthog (optional)","Cookie and local storage","Analytics, only with your consent","6 months"',
    );
  });
  it('new wording follows the copy rules', () => {
    for (const [, , to] of PRIVACY_LIVE_EDITS)
      expect(to ?? '').not.toMatch(/[\u2013\u2014&]/);
  });
});
