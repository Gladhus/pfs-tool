import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  // Keep Playwright's trace/attachment output out of test-results/ — Vitest's JSON
  // reporter writes there too, and Playwright wipes its outputDir on every run.
  outputDir: './playwright-output',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [['github'], ['json', { outputFile: 'playwright-report/results.json' }]]
    : 'html',
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: 'http://localhost:8080/pfs-tool/',
    storageState: 'e2e/fixtures/storage-state.json',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:8080/pfs-tool/',
    reuseExistingServer: !process.env.CI,
  },
});
