// Error language (2026-10-06, extension 4, workstream AK). Messages on screen
// are for the owner and staff, not for a developer: no "send me the error",
// no internal codes, no promise of a code fix. Static check over every
// showDashError / toast / showError call on every page. Runtime wording is
// covered by the fault-injection specs (raw database text is rewritten).

const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'static; run once'); });

const ROOT = path.resolve(__dirname, '..', '..');
const PAGES = ['owner-login.html', 'manual-order-entry.html', 'index.html', 'search.html', 'dashboard.html', 'change-password.html'];
const BANNED = /send me|I'll fix|I will fix|ask Claude|tell Claude|Claude session|PGRST\d|SQLSTATE|stack trace|console|undefined|\bnull\b|TypeError/i;

test('no on-screen message talks like a developer', () => {
  const bad = [];
  for (const file of PAGES) {
    const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
    for (const m of src.matchAll(/(showDashError|toastOk|toastErr|toast|showError)\(([^;]{0,600})\)/g)) {
      // only the literal text, not variable names around it
      const literals = [...m[2].matchAll(/'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g)].map(x => x[1] || x[2] || x[3] || '').join(' ');
      if (BANNED.test(literals)) bad.push(`${file}: ${literals.slice(0, 120)}`);
    }
  }
  expect(bad).toEqual([]);
});
