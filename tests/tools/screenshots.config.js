// Screenshot capture for design review (EXT7, workstream R). Not part of the
// test suite. Synthetic data only (the same mock as the tests); nothing is
// fetched from the live site.
//   npx playwright test -c tests/tools/screenshots.config.js            (EXT7 set)
//   SHOT_SPEC=capture-screenshots-ext8 npx playwright test -c …         (EXT8 set)
const { defineConfig, devices } = require('@playwright/test');
module.exports = defineConfig({
  testDir: '.',
  testMatch: new RegExp((process.env.SHOT_SPEC || 'capture-screenshots') + '\\.spec\\.js$'),
  outputDir: '../../test-results/screenshots',
  workers: 2,
  reporter: [['dot']],
  use: { baseURL: 'http://dashboard.test', serviceWorkers: 'block', timezoneId: 'America/Chicago', locale: 'en-US' },
  projects: [
    { name: 'w1100', use: { ...devices['Desktop Chrome'], viewport: { width: 1100, height: 800 } } },
    { name: 'w390', use: { ...devices['iPhone 13'], browserName: 'chromium', viewport: { width: 390, height: 844 } } },
    { name: 'w320', use: { ...devices['iPhone SE'], browserName: 'chromium', viewport: { width: 320, height: 640 } } },
  ],
});
