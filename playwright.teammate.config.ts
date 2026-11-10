import { defineConfig, devices } from '@playwright/test';
const port = process.env.DUOLY_TEST_PORT ?? '4356';
const baseURL = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: './tests/teammate-browser',
  fullyParallel: true,
  workers: 2,
  // The booking fixture renders the whole homepage in a dev build; on CI runners its perks and
  // teammate requests can land just after the default 5 s (trace of PR 116), so checks get 15 s.
  expect: { timeout: 15_000 },
  use: {
    baseURL: baseURL,
    trace: 'retain-on-failure',
    // Signed-in screens: the visitor answered the cookie banner long ago.
    storageState: {
      cookies: [
        {
          name: 'duoly-consent',
          value: 'v2.a0.m0.r0',
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
    // scripts/dev-server.mjs, never `astro dev`: see the comment in that file.
    command: `node scripts/dev-server.mjs --root tests/fixtures/teammate-ui --host 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: false,
  },
});
