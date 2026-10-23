import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/completion-browser',
  fullyParallel: true,
  workers: 2,
  use: { baseURL: 'http://127.0.0.1:4336', trace: 'retain-on-failure' },
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
