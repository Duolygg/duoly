/**
 * The single place that changes analytics SDK state (POSTHOG-SPEC section 2).
 * Runs on load, on every consent change, on bfcache restore and after logout.
 * Pure over an injected SDK so every transition is unit tested with a fake.
 */
import type { AnalyticsBoot } from '../../contracts/analytics';
import type { ConsentState } from '../../contracts/consent';

/** The slice of posthog-js the reconciler uses. */
export interface AnalyticsSdk {
  init(token: string, config: Record<string, unknown>): unknown;
  opt_in_capturing(options?: { captureEventName?: false | null }): void;
  opt_out_capturing(): void;
  reset(): void;
  identify(id: string, set?: Record<string, unknown>): void;
  register(props: Record<string, unknown>): void;
  get_property(name: string): unknown;
  capture(event: string, props?: Record<string, unknown>): unknown;
  setInternalOrTestUser(): void;
}

export const UID_PROPERTY = 'duoly_uid';

export type Controller = {
  /** Apply the current consent and identity. Safe to call any number of times. */
  sync(): void;
  /** Visible state, for tests and the debug log. */
  state(): {
    initialized: boolean;
    mode: 'none' | 'refused' | 'full';
    pageview: boolean;
  };
};

export function createController(options: {
  sdk: AnalyticsSdk;
  boot: AnalyticsBoot;
  readConsent: () => ConsentState | null;
  config: () => Record<string, unknown>;
}): Controller {
  const { sdk, boot, readConsent, config } = options;
  let initialized = false;
  let mode: 'none' | 'refused' | 'full' = 'none';
  let pageview = false;

  const sync = () => {
    const consent = readConsent();
    // No choice yet: the SDK is not even loaded, so nothing leaves the page.
    if (!consent) return;
    if (!initialized) {
      sdk.init(boot.key, config());
      initialized = true;
    }
    if (consent.analytics) {
      const stored = sdk.get_property(UID_PROPERTY);
      const known = typeof stored === 'string' ? stored : null;
      // Another account, or logged out since: forget that person before anything is sent.
      // reset() also clears the SDK's consent record, so opt in again right after it.
      if (known !== null && known !== boot.uid) sdk.reset();
      sdk.opt_in_capturing({ captureEventName: false });
      if (boot.uid && known !== boot.uid) {
        sdk.identify(boot.uid, boot.role ? { role: boot.role } : {});
        sdk.register({ [UID_PROPERTY]: boot.uid });
        if (boot.internal) sdk.setInternalOrTestUser();
      }
      sdk.register({
        viewer_role: boot.role ?? 'visitor',
        ...(boot.release ? { app_release: boot.release } : {}),
      });
      mode = 'full';
    } else {
      // Refused (or withdrawn): drop any identity once, then count without cookies.
      if (mode !== 'refused') sdk.reset();
      sdk.opt_out_capturing();
      mode = 'refused';
    }
    // The first pageview goes out only after identity is settled, so it never
    // lands on a previous account.
    if (!pageview) {
      sdk.capture('$pageview');
      pageview = true;
    }
  };

  return { sync, state: () => ({ initialized, mode, pageview }) };
}
