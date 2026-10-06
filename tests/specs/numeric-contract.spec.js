// Numeric field contract (2026-10-06, extension 4, workstreams Y and Z).
// docs/ops/NUMERIC_FIELD_CONTRACT.md. Every number box on every page has a
// lower limit and a step; every one has an upper limit (max attribute or a
// numberInputError check with max); money boxes allow whole cents only.

const fs = require('fs');
const path = require('path');
const { test, expect, login, gotoPage } = require('../helpers/dashboard');
const { enableWrites } = require('../helpers/stateful-backend');

const ROOT = path.resolve(__dirname, '..', '..');
const PAGES = ['owner-login.html', 'manual-order-entry.html', 'index.html', 'search.html', 'dashboard.html', 'change-password.html'];
// Boxes whose upper limit (and decimals) the page checks in code, by id or class.
const CHECKED_IN_CODE = ['invAmount', 'expAmount', 'poLineQty', 'poLineCost', 'poShipping', 'poTax', 'ruleValueInput', 'invThresholdInput',
  'peCost', 'peRetail', 'peWholesale', 'prodRetail', 'prodWholesale'];

test.describe('numeric contract (static)', () => {
  test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'static; run once'); });

  const inputs = PAGES.flatMap(file => {
    const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
    return [...src.matchAll(/<input\b[^>]*type="number"[^>]*>/g)].map(m => {
      const tag = m[0];
      const name = (tag.match(/\bid="([^"]+)"/) || tag.match(/\bclass="([^" ]+)/) || [])[1];
      return { file, tag, name };
    });
  });

  test('the pages have the expected number of number boxes', () => {
    expect(inputs.length).toBeGreaterThanOrEqual(19);
  });
  test('every number box has a step', () => {
    expect(inputs.filter(i => !/\bstep="/.test(i.tag)).map(i => `${i.file} ${i.name}`)).toEqual([]);
  });
  test('every number box has a lower limit, except signed stock changes and rule values checked in code', () => {
    const signed = ['invAmount', 'ruleValueInput'];
    expect(inputs.filter(i => !/\bmin="/.test(i.tag) && !signed.includes(i.name)).map(i => `${i.file} ${i.name}`)).toEqual([]);
  });
  test('every number box has an upper limit (attribute or a check in code)', () => {
    expect(inputs.filter(i => !/\bmax="/.test(i.tag) && !CHECKED_IN_CODE.includes(i.name)).map(i => `${i.file} ${i.name}`)).toEqual([]);
  });
  test('every box listed as checked in code really is checked', () => {
    const src = fs.readFileSync(path.join(ROOT, 'owner-login.html'), 'utf8');
    for (const name of CHECKED_IN_CODE) {
      // near a mention of the box, a numberInputError call (it always applies a
      // max: the one given, or 1,000,000,000 by default; business rules also
      // have per-rule limits)
      const found = [...src.matchAll(new RegExp(name, 'g'))].some(m => /numberInputError\(/.test(src.slice(Math.max(0, m.index - 200), m.index + 1500)));
      expect(found, name).toBe(true);
    }
  });
  test('money boxes in steps of a cent; cost boxes may use fractions of a cent', () => {
    const money = inputs.filter(i => /step="0\.01"/.test(i.tag)).map(i => i.name);
    expect(money).toEqual(expect.arrayContaining(['prodRetail', 'prodWholesale', 'expAmount', 'poShipping', 'poTax', 'refundAmountInput', 'shippingTotal', 'taxTotal', 'item-price']));
  });
});

test('adding a product with a cost above $1,000,000 is refused with plain words (EXT4)', async ({ page, backend }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'run once');
  backend.tables.products = [];
  enableWrites(backend, ['products']);
  await login(page);
  await gotoPage(page, 'inventoryPanel');
  await page.fill('#prodName', 'SYNTHETIC big');
  await page.locator('#prodCost').evaluate(el => { el.removeAttribute('max'); el.value = '5000000'; });
  await page.locator('#prodName').press('Enter');
  await expect(page.locator('#dashError')).toContainText('Cost is too large');
  expect(backend.tables.products).toHaveLength(0);
});

// EXT5 (workstream 7): a browser number box empties text it can't read
// ("$12.50", "1,200"); the page used to say "is empty". Typed for real with
// the keyboard, as a person would.
for (const typed of ['12-', '1e', '5..5']) { // typos Chromium accepts but cannot read (pasted "$12.50" ends the same way)
  test(`expense amount typed as "${typed}": told to type a plain number, nothing saved`, async ({ page, backend }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'run once');
    const { enableWrites } = require('../helpers/stateful-backend');
    backend.tables.expenses = [];
    enableWrites(backend, ['expenses']);
    await login(page);
    await gotoPage(page, 'expensesPanel');
    await page.selectOption('#expCategory', { index: 1 });
    await page.locator('#expAmount').click();
    await page.keyboard.type(typed);
    const bad = await page.locator('#expAmount').evaluate(el => el.validity.badInput || el.value === '');
    test.skip(!bad, 'this browser kept the text as a number');
    await page.locator('#expAmount').evaluate(el => el.form.noValidate = true); // reach the page's own check, as with a pasted value
    await page.locator('#addExpenseForm button[type=submit]').click();
    await expect(page.locator('#dashError')).toContainText('must be a plain number');
    expect(backend.tables.expenses).toHaveLength(0);
  });
}
