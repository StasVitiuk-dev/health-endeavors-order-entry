// Playwright settings for the dashboard regression tests.
// Run with:  npm test
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './specs',
  outputDir: '../test-results',
  fullyParallel: true,
  retries: 0,
  reporter: [['list']],
  use: {
    // A made-up address: the mock serves the repo's files for it, so no
    // web server is needed and nothing is fetched from the live site.
    baseURL: 'http://dashboard.test',
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1100, height: 800 } },
    },
    {
      name: 'iphone',
      use: {
        ...devices['iPhone 13'],
        // Same engine as desktop (Chromium) with an iPhone-sized screen,
        // touch and user agent. Real Safari is not tested here.
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
      },
    },
  ],
});
