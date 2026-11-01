import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/completion-browser',
  fullyParallel: true,
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
    baseURL: 'http://127.0.0.1:4336',
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
      'node node_modules/astro/bin/astro.mjs dev --root tests/fixtures/chat-ui --host 127.0.0.1 --port 4336',
    url: 'http://127.0.0.1:4336',
    reuseExistingServer: false,
  },
});
