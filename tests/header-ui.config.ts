import { defineConfig, devices } from '@playwright/test';
import base from '../playwright.teammate.config';

export default defineConfig({
  ...base,
  testDir: './teammate-browser',
  testMatch: ['header-upload-regressions.spec.ts', 'header-heic.spec.ts'],
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['iPhone 13'] } },
  ],
  webServer: {
    command: `node scripts/dev-server.mjs --root tests/fixtures/teammate-ui --host 127.0.0.1 --port ${process.env.DUOLY_TEST_PORT ?? '4356'}`,
    url: base.use?.baseURL,
    reuseExistingServer: false,
    cwd: new URL('..', import.meta.url).pathname,
    env: { PUBLIC_PROFILES_ENABLED: 'true', PUBLIC_PROFILE_FIXTURES: 'true' },
  },
});
