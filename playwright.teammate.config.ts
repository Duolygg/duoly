import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/teammate-browser',
  fullyParallel: true,
  workers: 2,
  use: { baseURL: 'http://127.0.0.1:4356', trace: 'retain-on-failure' },
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
