// Sales & Growth generated inventory: the committed doc must match a fresh
// regeneration (node tests/tools/sales-inventory.js --write), and the inventory
// must stay internally consistent (loaded modules are a subset that exist;
// every flag-gated page has a title in the program).
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const inv = require('../tools/sales-inventory.js');

test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });

test('SALES_INVENTORY.md is up to date (regenerate: node tests/tools/sales-inventory.js --write)', () => {
  const committed = fs.readFileSync(inv.DOC, 'utf8');
  expect(committed).toContain(inv.render());
});

test('every loaded sales module actually exists on disk', () => {
  const all = new Set(inv.salesModules());
  for (const m of inv.loadedModules()) expect(all.has(m)).toBe(true);
});

test('every flag-gated sales page is backed by a loader/title in the program', () => {
  const app = fs.readFileSync(require('path').join(__dirname, '..', '..', 'assets', 'owner-login-app.js'), 'utf8');
  for (const p of inv.salesPages()) {
    expect(app).toContain(p.id + ':'); // has a SALES_TITLES / PANEL_LOADERS entry
  }
});
