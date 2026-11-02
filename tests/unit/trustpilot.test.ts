import { describe, expect, it } from 'vitest';
import { trustpilotSummary } from '../../src/site/trustpilot';

const url = 'https://www.trustpilot.com/review/duoly.gg';

describe('Trustpilot hero line', () => {
  it('stays hidden until the live profile is filled in', () => {
    expect(
      trustpilotSummary({ url: null, score: null, reviews: null }),
    ).toBeNull();
    expect(trustpilotSummary({ url, score: null, reviews: 120 })).toBeNull();
    expect(trustpilotSummary({ url, score: 4.8, reviews: null })).toBeNull();
    expect(
      trustpilotSummary({ url: null, score: 4.8, reviews: 120 }),
    ).toBeNull();
  });

  it('only links to Trustpilot over https', () => {
    for (const bad of [
      'http://www.trustpilot.com/review/duoly.gg',
      'https://trustpilot.com.evil.example/review/duoly.gg',
      'https://example.com/',
      'not a url',
    ])
      expect(
        trustpilotSummary({ url: bad, score: 4.8, reviews: 120 }),
      ).toBeNull();
    expect(
      trustpilotSummary({
        url: 'https://de.trustpilot.com/review/duoly.gg',
        score: 4.8,
        reviews: 120,
      }),
    ).not.toBeNull();
  });

  it('rejects scores and counts that cannot be real', () => {
    for (const score of [0, 5.1, Number.NaN])
      expect(trustpilotSummary({ url, score, reviews: 120 })).toBeNull();
    for (const reviews of [0, -3, 2.5])
      expect(trustpilotSummary({ url, score: 4.8, reviews })).toBeNull();
  });

  it('formats score, label, half stars and count', () => {
    expect(trustpilotSummary({ url, score: 4.76, reviews: 2113 })).toEqual({
      url,
      score: '4.8',
      label: 'Excellent',
      stars: 5,
      reviews: '2,113 reviews',
    });
    const great = trustpilotSummary({ url, score: 4.2, reviews: 1 });
    expect(great).toMatchObject({
      label: 'Great',
      stars: 4,
      reviews: '1 review',
    });
    expect(trustpilotSummary({ url, score: 3.3, reviews: 9 })).toMatchObject({
      label: 'Average',
      stars: 3.5,
    });
  });
});
