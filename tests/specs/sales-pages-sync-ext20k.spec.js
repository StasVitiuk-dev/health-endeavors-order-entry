// Reserve IV — keep the shared sales-pages helper honest.
//
// tests/helpers/sales-pages.js is the one list the deep per-page matrices
// (a11y, mobile, scalability) iterate over. If a page were added to the app
// but not to that list, the matrices would silently skip it. This spec fails
// the moment the helper's id->title map drifts from the live SALES_TITLES map
// in assets/owner-login-app.js, so the coverage can never quietly fall behind.
const fs = require('fs');
const path = require('path');
const base = require('@playwright/test');
const { test, expect } = base;
const { SALES_PAGES } = require('../helpers/sales-pages');

test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });

function appTitles() {
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'owner-login-app.js'), 'utf8');
  const block = src.match(/SALES_TITLES\s*=\s*\{([\s\S]*?)\};/);
  if (!block) throw new Error('SALES_TITLES not found in owner-login-app.js');
  const map = {};
  const re = /(sales[A-Za-z]+Panel)\s*:\s*'((?:[^'\\]|\\.)*)'/g;
  let m;
  while ((m = re.exec(block[1]))) map[m[1]] = m[2].replace(/\\'/g, "'");
  return map;
}

test('the sales-pages helper lists exactly the app\'s SALES_TITLES, with matching titles', () => {
  const app = appTitles();
  // Same set of ids, in the same order (the helper mirrors the app).
  expect(Object.keys(SALES_PAGES)).toEqual(Object.keys(app));
  // Same title for every id.
  for (const [id, title] of Object.entries(app)) {
    expect(SALES_PAGES[id], `title drift for ${id}`).toBe(title);
  }
  // 42 pages — if this changes, it is a deliberate wiring change and the
  // matrices below are meant to grow with it.
  expect(Object.keys(SALES_PAGES).length).toBe(42);
});

test('every helper panel id has a host <section> in owner-login.html', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', '..', 'owner-login.html'), 'utf8');
  const missing = Object.keys(SALES_PAGES).filter(id => !html.includes(`id="${id}"`));
  expect(missing).toEqual([]);
});
