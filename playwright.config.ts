import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/specs',
  globalSetup: './e2e/global-setup.ts',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0, // gate runs are deterministic; flakes are diagnosed in the fix loop, never auto-passed
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['json', { outputFile: 'test-results/e2e-results.json' }],
  ],
  use: {
    baseURL: 'http://localhost:5000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'en-US',
  },
  projects: [
    {
      name: 'rules',
      testMatch: /(^|\/)rules\.spec\.ts$/,
      use: { browserName: 'chromium' },
    },
    {
      name: 'storage-prod',
      testMatch: /storage-rules\.spec\.ts$/,
      use: { browserName: 'chromium' },
    },
    {
      name: 'chromium',
      testIgnore: [/rules\.spec\.ts$/, /storage-rules\.spec\.ts$/],
      use: { browserName: 'chromium' },
    },
    {
      name: 'webkit',
      testIgnore: [/rules\.spec\.ts$/, /storage-rules\.spec\.ts$/],
      use: { browserName: 'webkit' },
    },
    {
      name: 'firefox',
      testIgnore: [/rules\.spec\.ts$/, /storage-rules\.spec\.ts$/],
      use: { browserName: 'firefox' },
    },
  ],
});
