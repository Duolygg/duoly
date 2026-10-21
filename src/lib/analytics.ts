// Transport abstraction only. No SDK is installed and the application does not
// instantiate this facade. Provider setup and consent UI require separate approval.
export interface PageviewEvent {
  name: 'pageview';
}

export interface AnalyticsOptions {
  enabled: boolean;
  configured: boolean;
  consent: boolean;
  send: (event: PageviewEvent) => void;
}

export function createAnalytics(options: AnalyticsOptions) {
  let consent = options.consent;
  return {
    setConsent(granted: boolean) {
      consent = granted;
    },
    // Deliberately accepts no URL, path, query, fragment or arbitrary properties.
    pageview() {
      if (options.enabled && options.configured && consent) {
        options.send({ name: 'pageview' });
      }
    },
  };
}
