// The shared test settings must never carry this machine's browser location.
// A local run may point Playwright at an installed browser (launchOptions
// executablePath); committing that makes every browser test on GitHub fail to
// start ("executable doesn't exist"). It happened twice (fixed in 45a56fc and on
// Nov 25); this check stops a third time with a plain message, without a browser.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

test('the shared test settings name no local browser location', ({}, ti) => {
  test.skip(ti.project.name !== 'desktop', 'Node-only; run once');
  const cfg = fs.readFileSync(path.join(__dirname, '..', 'playwright.config.js'), 'utf8');
  expect(cfg, 'tests/playwright.config.js must not set executablePath (a local-only setting was committed)').not.toMatch(/executablePath/);
  expect(cfg).not.toMatch(/\/opt\/pw-browsers/);
});
