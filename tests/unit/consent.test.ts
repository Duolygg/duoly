import type { AstroCookies } from 'astro';
import { describe, expect, it } from 'vitest';
import {
  CONSENT_COOKIE,
  parseConsent,
  serializeConsent,
  needsConsentPrompt,
} from '../../src/contracts/consent';
import { consentFromCookies } from '../../src/server/consent';
import { readFileSync } from 'node:fs';

const values = [false, true].flatMap((analytics) =>
  [false, true].flatMap((marketing) =>
    [false, true].map((referral) => ({
      version: 2 as const,
      analytics,
      marketing,
      referral,
    })),
  ),
);

describe('consent v2', () => {
  it.each(values)('round trips independent purposes: %j', (state) => {
    const value = `v2.a${Number(state.analytics)}.m${Number(state.marketing)}.r${Number(state.referral)}`;
    expect(parseConsent(value)).toEqual(state);
    expect(serializeConsent(state)).toBe(value);
    expect(needsConsentPrompt(value)).toBe(false);
    const cookies = {
      get: (name: string) => (name === CONSENT_COOKIE ? { value } : undefined),
    } as unknown as Pick<AstroCookies, 'get'>;
    expect(consentFromCookies(cookies)).toEqual(state);
  });
  it.each([
    undefined,
    null,
    '',
    'garbage',
    'v2.a2.m0.r0',
    'v2.a0.m2.r0',
    'v2.a0.m0.r2',
    'v3.a1.m1.r1',
    'v2.a1.m1.r1.extra',
    ' v2.a1.m1.r1',
    'v2.a1.r1',
    'v2.a1.r1.m1',
    'v2.a1.m1.r1\n',
    'v2.a1.m1.r1\r',
  ])('rejects %s', (value) => {
    expect(parseConsent(value)).toBeNull();
    expect(needsConsentPrompt(value)).toBe(true);
    expect(
      consentFromCookies({
        get: () => (value == null ? undefined : { value }),
      } as unknown as Pick<AstroCookies, 'get'>),
    ).toBeNull();
  });
  it.each([
    ['all', true],
    ['necessary', false],
  ] as const)('preserves only legacy referral for %s', (value, referral) => {
    const state = { version: 2, analytics: false, marketing: false, referral };
    expect(parseConsent(value)).toEqual(state);
    expect(needsConsentPrompt(value)).toBe(true);
    expect(
      consentFromCookies({ get: () => ({ value }) } as unknown as Pick<
        AstroCookies,
        'get'
      >),
    ).toEqual(state);
  });
});

/*
 * The banner's final state is painted in the first frame, so two inline scripts read the cookie
 * before any module can: one in the layout head that sets html[data-cookie-prompt], and the
 * banner's own. They cannot import needsConsentPrompt (they run before the bundle), so the
 * literal they carry has to stay equal to it.
 */
describe('inline consent prompt check', () => {
  const sources = {
    'src/layouts/SiteLayout.astro': readFileSync(
      'src/layouts/SiteLayout.astro',
      'utf8',
    ),
    'src/components/site/CookieBanner.astro': readFileSync(
      'src/components/site/CookieBanner.astro',
      'utf8',
    ),
  };
  it.each(Object.entries(sources))(
    '%s carries the same wire-format test',
    (_file, source) => {
      const inline = /\/\^v2\\\.a\[01\]\\\.m\[01\]\\\.r\[01\]\$\//.exec(source);
      expect(inline).not.toBeNull();
      const pattern = new RegExp(inline![0].slice(1, -1));
      for (const value of [
        'v2.a0.m0.r0',
        'v2.a1.m1.r1',
        'v2.a1.m0.r1',
        'all',
        'necessary',
        'garbage',
        'v2.a1.r1',
        '',
      ])
        expect(!pattern.test(value)).toBe(needsConsentPrompt(value));
    },
  );
});
