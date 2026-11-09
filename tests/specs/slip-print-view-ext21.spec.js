// Packing-slip US-Letter print view (follow-on). A "Print packing slip" button
// in the invoice preview builds a slip print layout into the body-level print
// host: lot numbers per line, no price column by default, and a header that says
// it is not an invoice and not a carrier label. Default-OFF (rides
// he_invoice_preview). window.print stubbed so no dialog blocks.
const { test, expect, login, gotoPage } = require('../helpers/dashboard');

test('Print packing slip builds the slip print DOM: lot numbers, no prices, distinct from invoice', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'run once');
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(() => { try { localStorage.setItem('he_invoice_preview', 'on'); } catch (e) {} window.print = () => {}; });
  await login(page);
  await gotoPage(page, 'reportHistoryPanel');
  await expect(page.locator('#invoicePreviewHost [data-print="slip"]')).toBeVisible();
  await page.locator('#invoicePreviewHost [data-print="slip"]').click();
  const host = page.locator('#invoicePrintHost');
  await expect(host.locator('.printPage')).toHaveCount(1);
  await expect(host.locator('.printPage thead th')).toHaveCount(3); // Item, Qty, Lot (no price)
  await expect(host).toContainText('Packing slip');
  await expect(host).toContainText('not an invoice, not a carrier label');
  await expect(host).toContainText('LOT-A');
  expect(errors.join('\n')).not.toMatch(/Trusted Type|require-trusted-types|Refused to/i);
});
