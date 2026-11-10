import { defineConfig, devices } from '@playwright/test';
const port = process.env.DUOLY_TEST_PORT ?? '4321';
const baseURL = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  workers: process.env.DUOLY_TEST_WORKERS
    ? Number(process.env.DUOLY_TEST_WORKERS)
    : undefined,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
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
    baseURL,
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
    // scripts/dev-server.mjs, never `astro dev`: the CLI detaches itself when an
    // AI coding agent started the run, and Playwright kills a run whose web
    // server process exits. The script explains the rest.
    command: `node scripts/dev-server.mjs --host 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
});
