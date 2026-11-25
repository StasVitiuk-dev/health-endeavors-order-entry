// Fill an expense in from a receipt's text (owner, Nov 24: "receipt inbox ... turns a
// photo into an expense draft"; free reading first). On Expenses, behind
// he_receipt_reader (off): paste the text of a receipt, or let the browser read the
// chosen photo where it can. Amount, date and shop are FILLED IN for the owner to
// check; nothing is saved until Add expense is pressed.
// assets/scan/he-receipt-text.js. Every receipt here is made up.
const R = require('../../assets/scan/he-receipt-text.js');
const { test, expect, login, gotoPage } = require('../helpers/dashboard');

const node = (ti) => test.skip(ti.project.name !== 'desktop', 'Node-only; run once');
const NOW = Date.parse('2026-11-24T18:00:00Z');
const RECEIPT = ['SYNTHETIC SUPPLY CO', '123 Example St', 'Testville, NV 89000', '11/22/2026 3:14 PM', 'Boxes 12x9   24.00', 'Tape          6.50',
  'SUBTOTAL     30.50', 'TAX           2.52', 'TOTAL       $33.02', 'VISA ****1234  33.02', 'Thank you!'].join('\n');

test.describe('reading the text (no browser)', () => {
  test('the total comes from the line that says total (not the subtotal, not the tax); the date and the shop are found', ({}, ti) => {
    node(ti);
    expect(R.parse(RECEIPT, NOW)).toEqual({ total: 33.02, totalHow: 'total line', date: '2026-11-22', vendor: 'SYNTHETIC SUPPLY CO', found: 3, notes: [] });
    expect(R.parse('SYN Shop\nAmount due: $1,204.50\n2026-11-03', NOW)).toMatchObject({ total: 1204.5, totalHow: 'total line', date: '2026-11-03' });
    expect(R.parse('SYN Shop\nTotal savings 9.00\nSubtotal 40.00\nTotal tax 3.00\nGrand Total 43.00', NOW)).toMatchObject({ total: 43, totalHow: 'total line' });
  });

  test('no "total" line: the largest amount is taken and it says it is a guess', ({}, ti) => {
    node(ti);
    const r = R.parse('Coffee shop\nNov 3, 2026\nLatte 4.50\nMuffin 3.25', NOW);
    expect(r).toMatchObject({ total: 4.5, totalHow: 'largest amount', date: '2026-11-03', vendor: 'Coffee shop' });
    expect(r.notes).toEqual(['No line says "total", so the largest amount was taken. Check it.']);
  });

  test('dates in the usual ways; never a day that does not exist or lies in the future', ({}, ti) => {
    node(ti);
    const d = (line) => R.parse('SYN Shop\n' + line + '\nTotal 5.00', NOW).date;
    expect(['11/22/2026', '11-22-26', '2026-11-22', 'Nov 22, 2026', 'November 22 2026', '22 Nov 2026', 'Sept 5, 2026'].map(d))
      .toEqual(['2026-11-22', '2026-11-22', '2026-11-22', '2026-11-22', '2026-11-22', '2026-11-22', '2026-09-05']);
    // a day that does not exist, a future day, a year too old, and a word that only starts like a month
    expect(['02/30/2026', '13/01/2026', '12/31/2026', '11/22/1999', 'someday', 'Octember 5, 2026', 'Marchy 3, 2026', 'Ju 4, 2026'].map(d)).toEqual([null, null, null, null, null, null, null, null]);
    expect(['Mar. 3, 2026', 'MAY 4 2026', '3 June 2026', 'Dec 1st, 2025'].map(d)).toEqual(['2026-03-03', '2026-05-04', '2026-06-03', '2025-12-01']);
    expect(R.parse('SYN Shop\nTotal 5.00', NOW).notes).toEqual(['No date was found. Choose it.']);
  });

  test('what it cannot find it says, and it fills nothing by guess; odd input never throws', ({}, ti) => {
    node(ti);
    expect(R.parse('', NOW)).toEqual({ total: null, totalHow: '', date: null, vendor: '', found: 0, notes: ['There is no text to read.'] });
    expect(R.parse('12345\n$$$\n----', NOW)).toMatchObject({ total: null, date: null, vendor: '', found: 0 });
    expect(R.parse('Receipt\nwww.example.test\nTel 555 0100\nTotal 9.99', NOW).vendor).toBe('');           // none of these is a shop's name
    expect(R.parse('SYN <b>Shop</b> & Co.\nTotal 9.99', NOW).vendor).toBe('SYN bShopb & Co.');           // only plain characters are kept
    expect(R.parse('SYN Shop\nTotal 999999.00\nTotal 0.00', NOW).total).toBeNull();                        // amounts no receipt has are ignored
    for (const junk of [null, undefined, 7, {}, [], 'x'.repeat(50000), '$'.repeat(5000), '1.00 '.repeat(8000)]) expect(() => R.parse(junk, 1e300)).not.toThrow();
    expect(R.parse('a\n'.repeat(1000) + 'Total 5.00', NOW).total).toBeNull();                              // only the first 400 lines are read
  });
});

const on = (page) => page.addInitScript(() => { try { localStorage.setItem('he_receipt_reader', 'on'); } catch (e) {} });

test.describe('on the Expenses page', () => {
  test('switch off (as shipped): the expense form is as before', async ({ page }) => {
    await login(page);
    await gotoPage(page, 'expensesPanel');
    await expect(page.locator('#addExpenseForm')).toBeVisible();
    await expect(page.locator('#receiptReaderHost')).toHaveCount(0);
  });

  test('pasted text fills in amount, date and shop for checking; nothing is saved until Add expense', async ({ page, backend }, ti) => {
    test.skip(ti.project.name !== 'desktop', 'run once');
    await on(page);
    await page.clock.setFixedTime(new Date(NOW));
    await login(page);
    await gotoPage(page, 'expensesPanel');
    const host = page.locator('#receiptReaderHost');
    await expect(host.locator('h4')).toHaveText('Fill in from a receipt');
    // it sits inside the expense form, right under the receipt box
    expect(await page.evaluate(() => { const h = document.getElementById('receiptReaderHost'); return !!h.closest('#addExpenseForm') && h.previousElementSibling.contains(document.getElementById('expReceipt')); })).toBe(true);
    await host.getByLabel('The text of the receipt').fill(RECEIPT);
    await host.getByRole('button', { name: 'Fill in from this text' }).click();
    await expect(page.locator('#expAmount')).toHaveValue('33.02');
    await expect(page.locator('#expDate')).toHaveValue('2026-11-22');
    await expect(page.locator('#expVendor')).toHaveValue('SYNTHETIC SUPPLY CO');
    await expect(host.locator('[data-rrstatus]')).toHaveText('Filled in: amount $33.02 (from the total line); date 2026-11-22; vendor SYNTHETIC SUPPLY CO. Check each one before saving.');
    await expect(host).toHaveAttribute('data-rrfound', '3');
    expect(backend.tableWrites()).toEqual([]);                                  // filling in is not saving
    // a guess is said as a guess, and what is missing is said
    await host.getByLabel('The text of the receipt').fill('Latte 4.50\nMuffin 3.25');
    await host.getByRole('button', { name: 'Fill in from this text' }).click();
    await expect(page.locator('#expAmount')).toHaveValue('4.50');
    await expect(host.locator('[data-rrstatus]')).toContainText('a guess: the largest amount');
    await expect(host.locator('[data-rrstatus]')).toContainText('No date was found. Choose it.');
    await expect(page.locator('#expDate')).toHaveValue('2026-11-22');           // the date found before stays; nothing is cleared
    // empty text: nothing is filled, and it says so
    await host.getByLabel('The text of the receipt').fill('');
    await host.getByRole('button', { name: 'Fill in from this text' }).click();
    await expect(host.locator('[data-rrstatus]')).toHaveText('Nothing could be filled in. There is no text to read.');
    expect(backend.tableWrites()).toEqual([]);
  });

  test('a browser that can read photos gets a "Read the chosen photo" button; one that cannot is not offered it', async ({ page }, ti) => {
    test.skip(ti.project.name !== 'desktop', 'run once');
    await on(page);
    await login(page);
    await gotoPage(page, 'expensesPanel');
    await expect(page.locator('#receiptReaderHost [data-rr="fill"]')).toBeVisible();
    await expect(page.locator('#receiptReaderHost [data-rr="read"]')).toHaveCount(0);       // this test browser cannot read text in photos
  });

  test('with a photo reader: the chosen photo is read and the form filled in; no photo chosen, a PDF, or a failed read are said plainly', async ({ page }, ti) => {
    test.skip(ti.project.name !== 'desktop', 'run once');
    await on(page);
    await page.addInitScript((text) => {
      window.TextDetector = function () { this.detect = async () => (window.__rrFail ? Promise.reject(new Error('no')) : text.split('\n').map(l => ({ rawValue: l }))); };
      window.createImageBitmap = async () => ({ width: 10, height: 10 });
    }, RECEIPT);
    await page.clock.setFixedTime(new Date(NOW));
    await login(page);
    await gotoPage(page, 'expensesPanel');
    const host = page.locator('#receiptReaderHost');
    await host.getByRole('button', { name: 'Read the chosen photo' }).click();
    await expect(host.locator('[data-rrstatus]')).toHaveText('Choose the photo of the receipt first (the Receipt box above).');
    await page.locator('#expReceipt').setInputFiles({ name: 'SYNTHETIC-receipt.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 synthetic') });
    await host.getByRole('button', { name: 'Read the chosen photo' }).click();
    await expect(host.locator('[data-rrstatus]')).toHaveText('Only a photo can be read. For a PDF, copy its text and paste it here.');
    await page.locator('#expReceipt').setInputFiles({ name: 'SYNTHETIC-receipt.png', mimeType: 'image/png', buffer: Buffer.from('synthetic image bytes') });
    await host.getByRole('button', { name: 'Read the chosen photo' }).click();
    await expect(page.locator('#expAmount')).toHaveValue('33.02');
    await expect(host.getByLabel('The text of the receipt')).toHaveValue(RECEIPT);       // the owner sees what was read
    await expect(host.locator('[data-rrstatus]')).toContainText('Check each one before saving.');
    await page.evaluate(() => { window.__rrFail = true; });
    await host.getByRole('button', { name: 'Read the chosen photo' }).click();
    await expect(host.locator('[data-rrstatus]')).toHaveText('This browser could not read the photo. Paste the text instead.');
    await expect(host.getByRole('button', { name: 'Read the chosen photo' })).toBeEnabled();
  });

  test('at phone size the helper fits without sideways scrolling', async ({ page }, ti) => {
    test.skip(ti.project.name === 'desktop', 'phone');
    await on(page);
    await login(page);
    await gotoPage(page, 'expensesPanel');
    await expect(page.locator('#receiptReaderHost')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  });
});
