import { defineConfig, devices } from '@playwright/test';
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
    baseURL: 'http://127.0.0.1:4334',
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
    command:
      'node node_modules/astro/bin/astro.mjs dev --root tests/fixtures/chat-ui --host 127.0.0.1 --port 4334',
    url: 'http://127.0.0.1:4334',
    reuseExistingServer: false,
  },
});
