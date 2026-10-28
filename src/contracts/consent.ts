/** The cookie banner's choice (owner decision 2026-10-27). */
export const CONSENT_COOKIE = 'duoly-consent';
export const CONSENT_DAYS = 365;
export type Consent = 'all' | 'necessary' | null;

export function readConsent(value: string | undefined | null): Consent {
  return value === 'all' || value === 'necessary' ? value : null;
}
