import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Configuration — Amélia CRM
 *
 * Runs against a deployed environment (staging or production).
 * Set BASE_URL via environment variable or defaults to localhost.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [['html', { open: 'never' }], ['github']]
    : [['html', { open: 'on-failure' }]],

  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:8080',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    /* ---------- Setup: authenticate once, reuse state ---------- */
    {
      name: 'setup',
      testMatch: /global-setup\.ts/,
      teardown: 'teardown',
    },
    {
      name: 'teardown',
      testMatch: /global-teardown\.ts/,
    },

    /* ---------- Desktop Chrome ---------- */
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/fixtures/.auth/user.json',
      },
      dependencies: ['setup'],
    },

    /* ---------- Mobile Safari (responsive) ---------- */
    {
      name: 'mobile-safari',
      use: {
        ...devices['iPhone 14'],
        storageState: 'e2e/fixtures/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],
});
