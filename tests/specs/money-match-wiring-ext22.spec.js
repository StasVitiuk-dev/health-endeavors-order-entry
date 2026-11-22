// Money matching on Accounting (owner request of Nov 22), behind the
// he_money_match preview switch: the made-up example, a Chase checking export
// and a Wells Fargo card export chosen from disk. The file is read in the
// browser only: these tests check that no request carries its contents and that
// nothing is written.
const M = require('../../assets/reports/he-money-match.js');
const { test, expect, login, gotoPage } = require('../helpers/dashboard');
const { unnamedControls } = require('../helpers/a11y-audit');

async function on(page) { await page.addInitScript(() => { try { localStorage.setItem('he_money_match', 'on'); } catch (e) {} }); }
function watch(page) {
  const seen = { writes: [], leaks: [] };
  page.on('request', r => {
    const body = r.postData() || '';
    if (/SHOPIFY PAYMENTS|SYN LABEL PRINTER|SYN SHIPPING SUPPLIES/.test(r.url() + body)) seen.leaks.push(r.method() + ' ' + r.url());
    if (/supabase\.co\/rest\/v1\//.test(r.url()) && !/\/rpc\//.test(r.url()) && ['POST', 'PATCH', 'PUT', 'DELETE'].includes(r.method())) seen.writes.push(r.method() + ' ' + r.url());
  });
  return seen;
}
const file = (name, text) => ({ name, mimeType: 'text/csv', buffer: Buffer.from(text, 'utf8') });

test('switch OFF (the default): Accounting is unchanged', async ({ page }) => {
  await login(page); await gotoPage(page, 'accountingPanel');
  await expect(page.locator('#moneyMatchHost')).toBeEmpty();
});

test('switch ON: the example lists every difference, most important first', async ({ page }) => {
  const seen = watch(page);
  await on(page); await login(page); await gotoPage(page, 'accountingPanel');
  const host = page.locator('#moneyMatchHost');
  await expect(host.locator('.moneyMatch')).toHaveAttribute('data-mmmode', 'example');
  await expect(host).toContainText('SIMULATED — example data');
  await expect(host.locator('[data-mmheadline]')).toHaveText('5 differences to look at');
  const dep = host.locator('[data-mmgroup="deposits"]');
  await expect(dep.locator('tr[data-mmoutcome="AMOUNT_DIFFERS"]')).toContainText('$11.87 short');
  await expect(dep.locator('tr[data-mmoutcome="MATCHED"]')).toHaveCount(3);
  await expect(dep.locator('tbody tr').first()).toHaveAttribute('data-mmlook', 'true');   // differences on top
  await expect(host.locator('[data-mmgroup="card"] tr[data-mmoutcome="NOT_RECORDED"]')).toContainText('SYN SHIPPING SUPPLIES');
  await expect(host.locator('[data-mmgroup="payouts"] tr[data-mmoutcome="AMOUNT_DIFFERS"]')).toContainText('but the payout is $99.00');
  expect(await host.evaluate(unnamedControls)).toEqual([]);
  expect(seen.writes).toEqual([]);
});

test('your own files: a Chase export and a Wells Fargo export are read in the browser and never sent anywhere', async ({ page, backend }) => {
  const seen = watch(page);
  backend.tables.expenses = [
    { id: 'x1', category: 'packaging', amount: '86.40', expense_date: '2026-11-16', vendor: 'SYN Label Printer', receipt_path: null, deleted_at: null, note: null, created_at: '2026-11-16T00:00:00Z' },
    { id: 'x2', category: 'software', amount: '19.99', expense_date: '2026-11-20', vendor: 'SYN Software', receipt_path: null, deleted_at: null, note: null, created_at: '2026-11-20T00:00:00Z' },
    { id: 'x3', category: 'other', amount: '32.15', expense_date: '2026-11-18', vendor: 'deleted one', receipt_path: null, deleted_at: '2026-11-19T00:00:00Z', note: null, created_at: '2026-11-18T00:00:00Z' },
  ];
  await on(page); await login(page); await gotoPage(page, 'accountingPanel');
  const host = page.locator('#moneyMatchHost');
  const f = M.fixtures();
  await host.locator('#mmCard').setInputFiles(file('wells-fargo.csv', f.wells));
  await expect(host.locator('.moneyMatch')).toHaveAttribute('data-mmmode', 'file');
  await expect(host).toContainText('YOUR FILE — read in this browser only, not saved');
  await expect(host.locator('[data-mmmessage]')).toContainText('wells-fargo.csv read: 4 lines. Nothing was uploaded.');
  const card = host.locator('[data-mmgroup="card"]');
  await expect(card.locator('tr[data-mmoutcome="MATCHED"]')).toHaveCount(2);
  // the deleted expense does not count: that purchase is not recorded
  await expect(card.locator('tr[data-mmoutcome="NOT_RECORDED"]')).toContainText('SYN SHIPPING SUPPLIES');
  await expect(host.locator('#mmCard')).toBeFocused();

  await host.locator('#mmBank').setInputFiles(file('chase.csv', f.chase));
  await expect(host).toContainText('Chase checking, 6 lines, 2026-11-17 to 2026-11-21');
  await expect(host).toContainText('Shopify payouts and wholesale payments are not connected yet');
  await expect(host.locator('[data-mmgroup="deposits"] tr[data-mmoutcome="UNEXPECTED"]')).toHaveCount(5);
  await expect(host.locator('[data-mmgroup="card"]')).toHaveCount(1);       // the card result stays
  expect(seen.leaks).toEqual([]);
  expect(seen.writes).toEqual([]);

  await host.locator('[data-mm="clear"]').click();
  await expect(host.locator('.moneyMatch')).toHaveAttribute('data-mmmode', 'example');
  await expect(host.locator('[data-mmmessage]')).toContainText('Your files were forgotten');
});

test('a file that is not a statement is refused with a reason', async ({ page }, ti) => {
  test.skip(ti.project.name !== 'desktop', 'run once');
  await on(page); await login(page); await gotoPage(page, 'accountingPanel');
  const host = page.locator('#moneyMatchHost');
  await host.locator('#mmBank').setInputFiles(file('notes.csv', 'hello,world\nthis,is not a statement\n'));
  await expect(host.locator('[data-mmmessage]')).toContainText('notes.csv: This does not look like a bank or card export');
  await expect(host.locator('.moneyMatch')).toHaveAttribute('data-mmmode', 'example');
  await host.locator('#mmBank').setInputFiles(file('empty.csv', ''));
  await expect(host.locator('[data-mmmessage]')).toContainText('The file is empty.');
});

test('at phone size the example fits without sideways scrolling', async ({ page }, ti) => {
  test.skip(ti.project.name !== 'iphone', 'phone only');
  await on(page); await login(page); await gotoPage(page, 'accountingPanel');
  await expect(page.locator('#moneyMatchHost [data-mmgroup="deposits"]')).toBeVisible();
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(over).toBeLessThanOrEqual(0);
});
