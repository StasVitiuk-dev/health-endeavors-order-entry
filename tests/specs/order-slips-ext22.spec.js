// Packing slips for real orders and printer test pages (Nov 23), behind the
// "Packing slips" preview switch (he_order_slips, off by default). Each order on
// the Orders page gets a 4 x 6 slip (Rollo label printer) and a Letter slip
// (Brother). Checks: switch off changes nothing; the slip carries the order's own
// lines, a blank lot to write by hand and never prices; the test browser's own
// PDF has the right paper (4 x 6 = 288 x 432 points, Letter = 612 x 792) and a
// long order continues on a second label; the test pages print one page each;
// everything is black on white. Made-up orders; window.print is replaced, so
// nothing reaches a printer.
const { test, expect, login, gotoPage } = require('../helpers/dashboard');
const { seedBusiness } = require('../fixtures/business-data');

const pdfPages = (buf) => [...buf.toString('latin1').matchAll(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/g)].map(m => Math.round(+m[1]) + 'x' + Math.round(+m[2]));
async function open(page, backend, on) {
  seedBusiness(backend);
  await page.addInitScript((x) => { try { if (x) localStorage.setItem('he_order_slips', 'on'); } catch (e) {} window.print = () => { window.__printed = (window.__printed || 0) + 1; }; }, on);
  await login(page);
  await gotoPage(page, 'ordersPanel');
  await expect(page.locator('#ordersTableWrap tr[data-id="o1"]')).toBeVisible();
}
const printed = (page) => page.evaluate(() => window.__printed || 0);

test('switch OFF (the default): the Orders page is unchanged', async ({ page, backend }) => {
  await open(page, backend, false);
  await expect(page.locator('#orderSlipsHost')).toBeEmpty();
  await expect(page.locator('#ordersTableWrap [data-slip]')).toHaveCount(0);
});

test('a 4 x 6 slip carries the order lines, a blank lot, no prices, and prints on 4 x 6', async ({ page, backend, browserName }, ti) => {
  test.skip(ti.project.name !== 'desktop' || browserName !== 'chromium', 'PDF needs Chromium; run once');
  await open(page, backend, true);
  await expect(page.locator('#orderSlipsHost [data-printtest]')).toHaveCount(2);
  const row = page.locator('#ordersTableWrap tr[data-id="o1"]');
  await expect(row.locator('[data-slip="4x6"]')).toHaveAccessibleName('Print a 4×6 packing slip for order SYN-1001');
  await row.locator('[data-slip="4x6"]').click();
  expect(await printed(page)).toBe(1);
  await expect(page.locator('#labelPrintCss')).toHaveAttribute('media', 'print');
  const host = page.locator('#invoicePrintHost');
  await expect(host.locator('.printPage[data-printsize="4x6"]')).toHaveCount(1);
  await expect(host.locator('.labelOrder')).toHaveText('Order SYN-1001');
  await expect(host).toContainText('For: SYNTHETIC Customer One');
  await expect(host.locator('thead th')).toHaveText(['Item', 'Qty', 'Lot']);
  await expect(host.locator('tbody tr')).toHaveCount(2);
  await expect(host.locator('tbody tr').first()).toContainText('SYN-A');
  await expect(host.locator('tbody tr').first().locator('td.labelQty')).toHaveText('2');
  await expect(host.locator('tbody tr').first().locator('td').nth(2)).toHaveText('________');
  await expect(host).not.toContainText('$');
  expect(pdfPages(await page.pdf({ preferCSSPageSize: true }))).toEqual(['288x432']);
  // the Letter slip of the same order goes on Letter
  await row.locator('[data-slip="letter"]').click();
  await expect(page.locator('#labelPrintCss')).toHaveAttribute('media', 'not all');
  await expect(host.locator('.printPage[data-printsize="letter"]')).toHaveCount(1);
  expect(pdfPages(await page.pdf({ preferCSSPageSize: true }))).toEqual(['612x792']);
});

test('a long order continues on a second label with the heading repeated', async ({ page, backend, browserName }, ti) => {
  test.skip(ti.project.name !== 'desktop' || browserName !== 'chromium', 'PDF needs Chromium; run once');
  seedBusiness(backend);
  backend.tables.order_items = backend.tables.order_items.filter(i => i.order_id !== 'o5')
    .concat(Array.from({ length: 10 }, (_, k) => ({ id: 'oi5-' + k, order_id: 'o5', sku: 'SYN-L' + (k + 1), product_name: 'SYNTHETIC long-name lotion number ' + (k + 1) + ' in an 8 oz jar', quantity: k + 1 })));
  await page.addInitScript(() => { localStorage.setItem('he_order_slips', 'on'); window.print = () => {}; });
  await login(page); await gotoPage(page, 'ordersPanel');
  await page.locator('#ordersTableWrap tr[data-id="o5"] [data-slip="4x6"]').click();
  const host = page.locator('#invoicePrintHost');
  await expect(host.locator('.printPage')).toHaveCount(2);
  await expect(host.locator('.printPage').nth(1)).toContainText('Page 2 of 2');
  await expect(host.locator('.printPage').nth(1).locator('thead th')).toHaveText(['Item', 'Qty', 'Lot']);
  expect(pdfPages(await page.pdf({ preferCSSPageSize: true }))).toEqual(['288x432', '288x432']);
});

test('the printer test pages print one page each on the right paper, black only', async ({ page, backend, browserName }, ti) => {
  test.skip(ti.project.name !== 'desktop' || browserName !== 'chromium', 'PDF needs Chromium; run once');
  await page.emulateMedia({ colorScheme: 'dark' });
  await open(page, backend, true);
  for (const [size, want] of [['4x6', '288x432'], ['letter', '612x792']]) {
    await page.locator('#orderSlipsHost [data-printtest="' + size + '"]').click();
    await expect(page.locator('#invoicePrintHost .printTest')).toHaveAttribute('data-printsize', size);
    expect(pdfPages(await page.pdf({ preferCSSPageSize: true })), size).toEqual([want]);
    await page.emulateMedia({ media: 'print', colorScheme: 'dark' });
    const notBlack = await page.locator('#invoicePrintHost').evaluate(root => [root, ...root.querySelectorAll('*')]
      .map(el => getComputedStyle(el)).filter(cs => cs.display !== 'none' && cs.color !== 'rgb(0, 0, 0)').length);
    expect(notBlack, size).toBe(0);
    // the 1-inch square really is 1 inch (96 CSS pixels)
    const box = await page.locator('#invoicePrintHost .printInch').boundingBox();
    expect(Math.round(box.width)).toBe(96);
    // the frame leaves room for Safari's own page margins (Nov 26: at 9.9 in the owner's
    // Brother printout spilled its bottom edge onto a second sheet): at most 8.75 in on
    // Letter (11 in) and 5.2 in on a 6 in label
    const frame = await page.locator('#invoicePrintHost .printTest').boundingBox();
    expect(frame.height, size).toBeLessThanOrEqual((size === 'letter' ? 8.75 : 5.2) * 96 + 1);
    expect(frame.height, size).toBeGreaterThan((size === 'letter' ? 8 : 4.5) * 96);
    await page.emulateMedia({ media: 'screen', colorScheme: 'dark' });
  }
});

test('an order with no lines on file says so and opens no print window', async ({ page, backend }, ti) => {
  test.skip(ti.project.name !== 'desktop', 'run once');
  await open(page, backend, true);
  await page.locator('#ordersTableWrap tr[data-id="o2"] [data-slip="4x6"]').click();
  await expect(page.locator('#orderSlipsHost [data-slipmessage]')).toHaveText('Order SYN-1002 has no items on file, so there is nothing to put on a slip.');
  expect(await printed(page)).toBe(0);
});

test('pressed while the order lines are still loading: says so, opens no print window, works a moment later', async ({ page, backend }, ti) => {
  test.skip(ti.project.name !== 'desktop', 'run once');
  seedBusiness(backend);
  let release; const gate = new Promise(r => { release = r; });
  await page.route(/\/rest\/v1\/order_items/, async route => { await gate; await route.fallback(); });
  await page.addInitScript(() => { localStorage.setItem('he_order_slips', 'on'); window.print = () => { window.__printed = (window.__printed || 0) + 1; }; });
  await login(page); await gotoPage(page, 'ordersPanel');
  await page.locator('#ordersTableWrap tr[data-id="o1"] [data-slip="4x6"]').click();
  await expect(page.locator('#orderSlipsHost [data-slipmessage]')).toHaveText('The order lines are still loading. Try again in a moment.');
  expect(await printed(page)).toBe(0);
  release();
  await expect(async () => {
    await page.locator('#ordersTableWrap tr[data-id="o1"] [data-slip="4x6"]').click();
    expect(await printed(page)).toBe(1);
  }).toPass({ timeout: 5000 });
});

test('at phone size the slip buttons fit without sideways scrolling', async ({ page, backend }, ti) => {
  test.skip(ti.project.name !== 'iphone', 'phone only');
  await open(page, backend, true);
  await expect(page.locator('#ordersTableWrap [data-slip="4x6"]').first()).toBeVisible();
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(over).toBeLessThanOrEqual(0);
});
