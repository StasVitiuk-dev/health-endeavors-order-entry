// Invoice print view (local item L3). Clicking "Print" in the invoice preview
// builds a US-Letter print layout into the body-level print host: one .printPage
// per modelled page, the table heading repeated on each, and the total on the
// last page. @media print (in owner-login.css) hides the dashboard and breaks
// each page onto its own sheet — the visual print is a manual owner check; here
// we verify the DOM and that no real print dialog is required for the test.
const { test, expect, login, gotoPage } = require('../helpers/dashboard');

test('Print builds the US-Letter print DOM: pages, repeating headings, totals last', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'run once');
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  // the preview flag reveals the Print button; stub window.print so no dialog blocks
  await page.addInitScript(() => { try { localStorage.setItem('he_invoice_preview', 'on'); } catch (e) {} window.print = () => {}; });
  await login(page);
  await gotoPage(page, 'reportHistoryPanel');
  await expect(page.locator('#invoicePreviewHost [data-print="invoice"]')).toBeVisible();
  // host starts empty (print view hidden on screen)
  await expect(page.locator('#invoicePrintHost')).toBeEmpty();
  await page.locator('#invoicePreviewHost [data-print="invoice"]').click();
  const host = page.locator('#invoicePrintHost');
  // one printable page (the sample is short -> single page) with a repeating thead
  await expect(host.locator('.printPage')).toHaveCount(1);
  await expect(host.locator('.printPage thead th').first()).toHaveText('Item');
  await expect(host.locator('.printPage thead')).toHaveCount(1);
  // the totals block is on the last page, line by line
  const totals = host.locator('.printTotals');
  await expect(totals.locator('[data-printtotal="subtotal"]')).toHaveText('Subtotal$254.00');
  await expect(totals.locator('[data-printtotal="discount"]')).toContainText('$10.00');
  await expect(totals.locator('[data-printtotal="shipping"]')).toHaveText('Shipping$12.50');
  // Nov 16: tax is pending — the page prints the word, never $0.00 and never a guessed rate
  await expect(totals.locator('[data-printtotal="tax"]')).toHaveText('TaxPENDING — no tax rate has been confirmed for this sale');
  await expect(totals.locator('[data-printtotal="totalBeforeTax"]')).toHaveText('Total before tax$256.50');
  await expect(totals.locator('[data-printtotal="total"]')).toHaveText('TotalPENDING — tax not confirmed');
  await expect(totals).not.toContainText('$272.53');
  await expect(totals).not.toContainText('6.25');
  await expect(host.locator('[data-printnote="tax-pending"]')).toContainText('Not a final invoice');
  await expect(host.locator('[data-printmark="tax-pending"]')).toHaveText('DRAFT — TAX PENDING, NOT A FINAL INVOICE');
  // who is billed, the terms, and that it has not been issued
  await expect(host.locator('.printMeta')).toContainText('Bill to');
  await expect(host.locator('.printMeta')).toContainText('SYNTHETIC Wholesale Buyer');
  await expect(host.locator('.printMeta')).toContainText('Terms: Due on receipt');
  await expect(host.locator('.printMeta')).toContainText('Issue date: not issued');
  await expect(host.locator('.printHdr')).toContainText('Invoice');
  await expect(host).toContainText('SIMULATED');
  expect(errors.join('\n')).not.toMatch(/Trusted Type|require-trusted-types|Refused to/i);
});

test('the print host is empty on screen until Print is pressed (no screen change)', async ({ page }) => {
  await login(page);
  await gotoPage(page, 'reportHistoryPanel');
  // even with the preview flag off, the body-level print host exists but is empty
  await expect(page.locator('#invoicePrintHost')).toBeEmpty();
});
