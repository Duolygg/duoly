import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/teammate-browser',
  fullyParallel: true,
  workers: 2,
  // The booking fixture renders the whole homepage in a dev build; on CI runners its perks and
  // teammate requests can land just after the default 5 s (trace of PR 116), so checks get 15 s.
  expect: { timeout: 15_000 },
  use: {
    baseURL: 'http://127.0.0.1:4356',
    trace: 'retain-on-failure',
    // Signed-in screens: the visitor answered the cookie banner long ago.
    storageState: {
      cookies: [
        {
          name: 'duoly-consent',
          value: 'necessary',
          domain: '127.0.0.1',
          path: '/',
          expires: -1,
          httpOnly: false,
          secure: false,
          sameSite: 'Lax',
        },
      ],
      origins: [],
    },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'mobile',
      use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' },
    },
  ],
  webServer: {
    command:
      'node node_modules/astro/bin/astro.mjs dev --root tests/fixtures/teammate-ui --host 127.0.0.1 --port 4356',
    url: 'http://127.0.0.1:4356',
    reuseExistingServer: false,
  },
});
