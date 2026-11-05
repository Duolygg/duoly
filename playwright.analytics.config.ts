import { defineConfig, devices } from '@playwright/test';

/**
 * Analytics transport checks (POSTHOG-SPEC section 12). The SDK is pointed at a fake host
 * that tests intercept with page.route, so no request ever reaches PostHog. No consent
 * cookie is preloaded: every test makes its own choice.
 */
export default defineConfig({
  testDir: './tests/analytics-browser',
  fullyParallel: true,
  workers: 2,
  expect: { timeout: 15_000 },
  use: {
    baseURL: 'http://127.0.0.1:4361',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        // posthog-js drops events from headless browsers as bots; look like a normal Chrome.
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
      },
    },
  ],
  webServer: {
    command:
      'node node_modules/astro/bin/astro.mjs dev --host 127.0.0.1 --port 4361',
    url: 'http://127.0.0.1:4361',
    reuseExistingServer: false,
    env: {
      PUBLIC_ANALYTICS_ENABLED: 'true',
      PUBLIC_POSTHOG_KEY: 'phc_testtesttesttesttest0123456789',
      PUBLIC_POSTHOG_HOST: 'https://ph.analytics.test',
      ANALYTICS_HOSTS: '127.0.0.1',
    },
  },
});
