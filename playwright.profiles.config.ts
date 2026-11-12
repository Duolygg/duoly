import { defineConfig, devices } from '@playwright/test';
const port = Number(process.env.DUOLY_PROFILE_TEST_PORT ?? 4389);
export default defineConfig({
  testDir: './tests/profiles',
  fullyParallel: true,
  workers: 2,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'retain-on-failure',
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
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'mobile',
      use: {
        ...devices['iPhone 13'],
        defaultBrowserType: 'chromium',
        viewport: { width: 390, height: 844 },
      },
    },
  ],
  webServer: [
    {
      command: `node scripts/dev-server.mjs --host 127.0.0.1 --port ${port}`,
      url: `http://127.0.0.1:${port}`,
      reuseExistingServer: false,
      env: { PUBLIC_PROFILES_ENABLED: 'true', PUBLIC_PROFILE_FIXTURES: 'true' },
    },
    {
      command: `node scripts/dev-server.mjs --host 127.0.0.1 --port ${port + 1}`,
      url: `http://127.0.0.1:${port + 1}`,
      reuseExistingServer: false,
      env: {
        PUBLIC_PROFILES_ENABLED: 'false',
        PUBLIC_PROFILE_FIXTURES: 'true',
      },
    },
  ],
});
