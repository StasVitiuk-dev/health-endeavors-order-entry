// Playwright settings for the dashboard regression tests.
// Run with:  npm test
const { defineConfig, devices } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// EXT14 (test speed): a spec file whose top-level beforeEach skips every test
// unless the project is "desktop" (Node-only and desktop-only files) is not
// loaded for the iPhone project at all, instead of starting each test only to
// skip it. Detected from the file text, so it cannot drift from the files.
// tests/specs/test-config-ext14.spec.js checks the rule.
// Only the exact unconditional form counts ("skip unless desktop", nothing else
// in the condition); a file with any exception keeps running on the iPhone.
const DESKTOP_ONLY_RE = /^(?:base\.)?test\.beforeEach\(\(\{\}, (testInfo|ti)\) => \{ (?:base\.)?test\.skip\(\1\.project\.name !== 'desktop', /m;
const desktopOnlyFiles = fs.readdirSync(path.join(__dirname, 'specs'))
  .filter(f => f.endsWith('.spec.js') && DESKTOP_ONLY_RE.test(fs.readFileSync(path.join(__dirname, 'specs', f), 'utf8')));

module.exports = defineConfig({
  metadata: { desktopOnlyFiles },
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
      testIgnore: desktopOnlyFiles,
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
