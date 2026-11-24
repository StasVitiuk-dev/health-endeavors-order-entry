// Preview switches on the Feature Flags page: on/off buttons for the preview
// features, so the owner can review them without typing commands. A switch is
// stored in this browser only, is off by default, and reveals only previews
// that use example data or are read-only. Owner and administrators see the
// section; other roles do not.
const fs = require('fs');
const path = require('path');
const { test, expect, login, gotoPage } = require('../helpers/dashboard');

const CONFIG = fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'app', 'he-config.js'), 'utf8');
// Switches that are deliberately NOT previews and NOT on the Feature Flags page:
// they read and write real records once their database draft is installed, so
// the owner turns them on only after approving that draft (Nov 16, later).
const NOT_PREVIEWS = ['he_supplier_documents_store', 'he_invoice_payments', 'he_money_issues', 'he_receiving_store', 'he_tax_rates', 'he_dropoff', 'he_shared_settings', 'he_order_costs'];
const ALL_KEYS = [...CONFIG.matchAll(/localStorage\.getItem\('(he_[a-z_]+)'\) === 'on'/g)].map(m => m[1]).sort();
const FLAG_KEYS = ALL_KEYS.filter(k => !NOT_PREVIEWS.includes(k));
const LISTED = [...CONFIG.matchAll(/\{ key: '(he_[a-z_]+)'/g)].map(m => m[1]).sort();

test('every preview flag in the code is listed for the owner, and nothing else is', async ({}, ti) => {
  test.skip(ti.project.name !== 'desktop', 'Node-only; run once');
  expect(FLAG_KEYS.length).toBeGreaterThanOrEqual(12);
  expect(LISTED).toEqual(FLAG_KEYS);
});

test('a storage switch is never offered on the page as a preview, and works only with its preview switch on', async ({}, ti) => {
  test.skip(ti.project.name !== 'desktop', 'Node-only; run once');
  for (const k of NOT_PREVIEWS) {
    expect(ALL_KEYS, k + ' exists in the code').toContain(k);
    expect(LISTED, k + ' is not on the Feature Flags page').not.toContain(k);
  }
  expect(CONFIG).toMatch(/function supplierDocsStoreOn\(\) \{\s*try \{ return supplierDocsOn\(\) &&/);
});

test('the owner sees every switch, all off by default; nothing is stored until one is turned on', async ({ page }, ti) => {
  test.skip(ti.project.name !== 'desktop', 'run once');
  await login(page);
  await gotoPage(page, 'flagsPanel');
  const host = page.locator('#previewSwitchesHost');
  await expect(host.locator('tbody tr')).toHaveCount(FLAG_KEYS.length);
  await expect(host.locator('tr[data-preview-on="yes"]')).toHaveCount(0);
  await expect(host).toContainText('this browser on this device only');
  await expect(host).toContainText('nothing is sent, issued, charged or written to stock');
  await expect(host.locator('[data-preview-count]')).toHaveAttribute('data-preview-count', '0');
  expect(await page.evaluate(keys => keys.filter(k => localStorage.getItem(k) !== null), FLAG_KEYS)).toEqual([]);
  // Every button says what it does to a screen reader.
  await expect(host.getByRole('button', { name: 'Turn on Payment reconciliation' })).toHaveCount(1);
});

test('turning a preview on shows it on its page; turning all off hides it again', async ({ page }, ti) => {
  test.skip(ti.project.name !== 'desktop', 'run once');
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await login(page);
  await gotoPage(page, 'accountingPanel');
  await expect(page.locator('#reconcileHost')).toBeEmpty();
  await gotoPage(page, 'flagsPanel');
  const host = page.locator('#previewSwitchesHost');
  await host.getByRole('button', { name: 'Turn on Payment reconciliation' }).click();
  const row = host.locator('tr[data-preview-key="he_reconcile"]');
  await expect(row).toHaveAttribute('data-preview-on', 'yes');
  await expect(host.locator('[data-preview-msg]')).toContainText('Payment reconciliation is on');
  await expect(host.locator('[data-preview-count]')).toHaveAttribute('data-preview-count', '1');
  expect(await page.evaluate(() => localStorage.getItem('he_reconcile'))).toBe('on');
  // Only that one key was written.
  expect(await page.evaluate(keys => keys.filter(k => localStorage.getItem(k) !== null), FLAG_KEYS)).toEqual(['he_reconcile']);
  // The message says to reload; "Reload now" does it, and the preview is then on its page.
  await host.locator('[data-previewswitch="reload"]').click();
  await expect(page.locator('#dash')).toBeVisible({ timeout: 15000 });   // a full page load; slower when many tests run at once
  await gotoPage(page, 'accountingPanel');
  await expect(page.locator('#reconcileHost .reconcileReview')).toHaveCount(1);
  // It is still on after the reload (it is this browser's setting)...
  await gotoPage(page, 'flagsPanel');
  await expect(page.locator('#previewSwitchesHost tr[data-preview-key="he_reconcile"]')).toHaveAttribute('data-preview-on', 'yes');
  // ...and "Turn all off" clears every switch.
  await page.locator('#previewSwitchesHost [data-previewswitch="alloff"]').click();
  await expect(page.locator('#previewSwitchesHost tr[data-preview-on="yes"]')).toHaveCount(0);
  expect(await page.evaluate(keys => keys.filter(k => localStorage.getItem(k) !== null), FLAG_KEYS)).toEqual([]);
  await page.locator('#previewSwitchesHost [data-previewswitch="reload"]').click();
  await expect(page.locator('#dash')).toBeVisible();
  await gotoPage(page, 'accountingPanel');
  await expect(page.locator('#accountingPanel')).toBeVisible();
  await expect(page.locator('#reconcileHost')).toBeEmpty();
  expect(errors.join('\n')).not.toMatch(/Trusted Type|require-trusted-types|Refused to/i);
});

test('a key that is not on the list is never written, even if a button is tampered with', async ({ page }, ti) => {
  test.skip(ti.project.name !== 'desktop', 'run once');
  await login(page);
  await gotoPage(page, 'flagsPanel');
  const btn = page.locator('#previewSwitchesHost [data-previewswitch="toggle"]').first();
  await btn.evaluate(el => el.setAttribute('data-key', 'he_theme_evil'));
  await btn.click();
  expect(await page.evaluate(() => localStorage.getItem('he_theme_evil'))).toBeNull();
});

test('someone who is not the owner or an administrator does not get the section', async ({ page, backend }, ti) => {
  test.skip(ti.project.name !== 'desktop', 'run once');
  await login(page);
  backend.tables.profiles[0].role = 'employee';
  await page.reload(); // the page reads the signed-in person's role when it loads
  await expect(page.locator('#dash')).toBeVisible();
  await expect(page.locator('#whoAmI')).toContainText('role: employee');
  // Open Feature Flags if this role can reach it at all; either way no switches appear.
  const reachable = await page.locator('#sidebarGroups .sidebarLink[data-page="flagsPanel"]').count();
  if (reachable) {
    await gotoPage(page, 'flagsPanel');
    await expect(page.locator('#flagsWrap')).not.toContainText('Loading');
  }
  await expect(page.locator('#previewSwitchesHost')).toBeEmpty();
  // And a forged click cannot write a switch for this role.
  await page.evaluate(() => { const b = document.createElement('button'); b.setAttribute('data-previewswitch', 'toggle'); b.setAttribute('data-key', 'he_reconcile'); document.body.appendChild(b); b.click(); b.remove(); });
  expect(await page.evaluate(() => localStorage.getItem('he_reconcile'))).toBeNull();
});

test('phone size: the section does not make the page scroll sideways', async ({ page }, ti) => {
  test.skip(ti.project.name !== 'iphone', 'phone size only');
  await login(page);
  await gotoPage(page, 'flagsPanel');
  await expect(page.locator('#previewSwitchesHost tbody tr')).toHaveCount(FLAG_KEYS.length);
  expect(await page.evaluate(() => document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth)).toBeLessThanOrEqual(1);
  const small = await page.locator('#previewSwitchesHost').evaluate(hst => [...hst.querySelectorAll('button')].map(b => b.getBoundingClientRect()).filter(r => r.width > 0 && (r.height < 24 || r.width < 24)).length);
  expect(small).toBe(0);
});
