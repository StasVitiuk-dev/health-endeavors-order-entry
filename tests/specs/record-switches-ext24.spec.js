// Switches that save real records (owner rule, Nov 24: "everything I can turn on,
// off or pause on the dashboard"). Feature Flags, owner only: each feature with its
// database step, checked live (read only); on only when installed, after a second
// tap; off always. assets/views/he-record-switches.js. Every value is made up.
const R = require('../../assets/views/he-record-switches.js');
const { test, expect, login, gotoPage } = require('../helpers/dashboard');
const { unnamedControls, contrastFailures } = require('../helpers/a11y-audit');

const node = (ti) => test.skip(ti.project.name !== 'desktop', 'Node-only; run once');
const NOT_INSTALLED = { status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST205', message: 'Could not find the table in the schema cache' }) };

test.describe('the list and the rules (no browser)', () => {
  test('every switch that saves records is listed once, with its database step and a probe', ({}, ti) => {
    node(ti);
    const keys = R.RECORD_SWITCHES.map(s => s.key);
    expect(keys.sort()).toEqual(['he_dropoff', 'he_incident_close', 'he_invoice_payments', 'he_money_issues', 'he_order_costs', 'he_receiving_store', 'he_shared_settings', 'he_supplier_documents_store', 'he_tax_rates']);
    expect(R.RECORD_SWITCHES.every(s => s.name && s.where && s.draft && s.what && /^[a-z_]+$/.test(s.probe))).toBe(true);
    // the same keys the preview-switch test keeps OFF the preview list
    const fs = require('fs'), path = require('path');
    const spec = fs.readFileSync(path.join(__dirname, 'preview-switches-ext21.spec.js'), 'utf8');
    const notPreviews = JSON.parse(/const NOT_PREVIEWS = (\[[^\]]*\])/.exec(spec)[1].replace(/'/g, '"'));
    expect([...notPreviews].sort()).toEqual([...keys].sort());
  });

  test('install check and what each row offers', async ({}, ti) => {
    node(ti);
    const sw = R.RECORD_SWITCHES[0];
    const client = (res) => ({ from: () => ({ select: () => ({ limit: async () => res }) }) });
    expect(await R.probe(client({ data: [] }), sw)).toBe('installed');
    expect(await R.probe(client({ error: { code: 'PGRST205', message: 'Could not find the table' } }), sw)).toBe('not_installed');
    expect(await R.probe(client({ error: { code: '42P01', message: 'relation does not exist' } }), sw)).toBe('not_installed');
    expect(await R.probe(client({ error: { code: '42501', message: 'permission denied' } }), sw)).toBe('unknown');
    expect(await R.probe({ from: () => { throw new Error('x'); } }, sw)).toBe('unknown');
    expect(await R.probe(null, sw)).toBe('unknown');
    expect(R.action(false, 'installed')).toMatchObject({ button: 'Turn on', allowed: true });
    expect(R.action(false, 'not_installed')).toMatchObject({ allowed: false, note: 'Install its database step first.' });
    expect(R.action(false, 'unknown').allowed).toBe(false);
    expect(R.action(true, 'not_installed')).toMatchObject({ button: 'Turn off', allowed: true });   // off always works
  });
});

test.describe('on Feature Flags', () => {
  test('the owner sees live install states; on needs a confirmation; off always works; reads only', async ({ page, backend }, ti) => {
    test.skip(ti.project.name !== 'desktop', 'run once');
    for (const t of ['invoice_payments', 'money_match_issues', 'receiving_records', 'supplier_documents', 'order_parcels']) {
      await page.route(`**/rest/v1/${t}?*`, route => route.fulfill(NOT_INSTALLED));
    }
    await login(page); await gotoPage(page, 'flagsPanel');
    const host = page.locator('#recordSwitchesHost');
    await expect(host.locator('h3')).toHaveText('Features that save real records (owner only)');
    await expect(host.locator('tr[data-record-key]')).toHaveCount(9);
    const tax = host.locator('tr[data-record-key="he_tax_rates"]');
    await expect(tax.locator('[data-record-status]')).toHaveText('Installed');
    const drop = host.locator('tr[data-record-key="he_dropoff"]');
    await expect(drop.locator('[data-record-status]')).toHaveText('Not installed yet');
    await expect(drop.getByRole('button', { name: 'Turn on Drop-off receipts' })).toBeDisabled();
    await expect(drop).toContainText('Install its database step first.');
    // on: a second tap; cancel changes nothing
    await tax.getByRole('button', { name: 'Turn on Confirmed tax rates' }).click();
    await tax.getByRole('button', { name: 'Cancel turning on Confirmed tax rates' }).click();
    expect(await page.evaluate(() => localStorage.getItem('he_tax_rates'))).toBeNull();
    await tax.getByRole('button', { name: 'Turn on Confirmed tax rates' }).click();
    await tax.getByRole('button', { name: 'Yes, turn on Confirmed tax rates' }).click();
    expect(await page.evaluate(() => localStorage.getItem('he_tax_rates'))).toBe('on');
    await expect(host.locator('[data-record-msg]')).toContainText('Confirmed tax rates is on. Reload the page');
    await expect(tax).toHaveAttribute('data-record-on', 'yes');
    // off always works, even when the step is not installed
    await page.evaluate(() => localStorage.setItem('he_dropoff', 'on'));
    await page.reload(); await expect(page.locator('#dash')).toBeVisible(); await gotoPage(page, 'flagsPanel');
    await expect(drop.locator('[data-record-status]')).toHaveText('Not installed yet');
    await drop.getByRole('button', { name: 'Turn off Drop-off receipts' }).click();
    expect(await page.evaluate(() => localStorage.getItem('he_dropoff'))).toBeNull();
    expect(backend.requests.filter(r => r.method && r.method !== 'GET' && r.method !== 'HEAD' && !r.rpc && String(r.path || '').startsWith('/rest/v1/')).map(r => r.method + ' ' + r.path)).toEqual([]);
  });

  test('an administrator does not see it (owner only)', async ({ page, backend }, ti) => {
    test.skip(ti.project.name !== 'desktop', 'run once');
    backend.tables.profiles[0].role = 'administrator';
    await login(page); await gotoPage(page, 'flagsPanel');
    await expect(page.locator('#previewSwitchesHost tbody tr').first()).toBeVisible();   // the previews still show
    await expect(page.locator('#recordSwitchesHost')).toHaveCount(0);
  });

  test('readable in light and dark; named controls; fits a phone', async ({ page }, ti) => {
    await login(page);
    const check = (loc) => loc.evaluate((root, src) => (new Function('return ' + src)())(root), contrastFailures.toString());
    for (const scheme of ti.project.name === 'desktop' ? ['light', 'dark'] : ['light']) {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      await gotoPage(page, 'flagsPanel');
      await expect(page.locator('#recordSwitchesHost [data-record-status]').first()).not.toHaveText('Checking…');
      await page.evaluate(() => Promise.all(document.getAnimations().map(a => a.finished.catch(() => {}))));
      expect(await check(page.locator('#recordSwitchesHost')), scheme).toEqual([]);
      expect(await page.locator('#recordSwitchesHost').evaluate(unnamedControls), scheme).toEqual([]);
    }
    if (ti.project.name === 'iphone') expect(await page.evaluate(() => document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth)).toBeLessThanOrEqual(1);
  });
});
