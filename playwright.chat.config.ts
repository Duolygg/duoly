import { defineConfig, devices } from '@playwright/test';
const port = process.env.DUOLY_TEST_PORT ?? '4334';
const baseURL = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: './tests/chat-browser',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  use: {
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
    baseURL: baseURL,
    trace: 'retain-on-failure',
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
    command: `node scripts/dev-server.mjs --root tests/fixtures/chat-ui --host 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: false,
  },
});
