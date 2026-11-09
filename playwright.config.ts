import { defineConfig, devices } from '@playwright/test';

const preview = !!process.env.PLAYWRIGHT_PREVIEW;
const port = preview ? 4174 : 4173;
const baseURL = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: './tests/e2e',
  outputDir: preview ? 'test-results/preview' : 'test-results/dev',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `pnpm ${preview ? 'preview' : 'dev'} --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI && !preview,
  },
});
