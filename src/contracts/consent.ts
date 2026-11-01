/** Independent optional purposes. Legacy choices never grant analytics. */
export const CONSENT_COOKIE = 'duoly-consent';
export const CONSENT_DAYS = 365;
export type ConsentState = {
  version: 2;
  analytics: boolean;
  marketing: boolean;
  referral: boolean;
};

export function parseConsent(
  value: string | undefined | null,
): ConsentState | null {
  if (value === 'all' || value === 'necessary')
    return {
      version: 2,
      analytics: false,
      marketing: false,
      referral: value === 'all',
    };
  const match = /^v2\.a([01])\.m([01])\.r([01])$/.exec(value ?? '');
  return match
    ? {
        version: 2,
        analytics: match[1] === '1',
        marketing: match[2] === '1',
        referral: match[3] === '1',
      }
    : null;
}

export function serializeConsent(state: ConsentState): string {
  return `v2.a${state.analytics ? 1 : 0}.m${state.marketing ? 1 : 0}.r${state.referral ? 1 : 0}`;
}

export function needsConsentPrompt(value: string | undefined | null): boolean {
  return !/^v2\.a[01]\.m[01]\.r[01]$/.test(value ?? '');
}
