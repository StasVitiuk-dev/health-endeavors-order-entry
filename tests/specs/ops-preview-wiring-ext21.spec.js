// Operations output previews — dashboard wiring (Phase 2 items 9-10, wave-1
// item 1). The export preview and the invoice preview are reachable through
// normal navigation to Report History, each behind its own default-OFF flag
// (he_report_export / he_invoice_preview). Flag OFF => the host is empty and the
// live dashboard is unchanged. Flag ON => a read-only, SIMULATED preview renders
// with no Trusted-Types/CSP violation. Nothing is issued, written or sent.
const { test, expect, login, gotoPage } = require('../helpers/dashboard');

test('flags OFF (default): neither preview renders in Report History', async ({ page }) => {
  await login(page);
  await gotoPage(page, 'reportHistoryPanel');
  await expect(page.locator('#reportExportHost')).toBeEmpty();
  await expect(page.locator('#invoicePreviewHost')).toBeEmpty();
});

test('export preview ON: manifest + checksum + integrity, labeled SIMULATED, no PDF claim', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'run the journey once');
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(() => { try { localStorage.setItem('he_report_export', 'on'); } catch (e) {} });
  await login(page);
  await gotoPage(page, 'reportHistoryPanel');
  const host = page.locator('#reportExportHost');
  await expect(host).toContainText('Export preview');
  await expect(host).toContainText('SIMULATED');
  await expect(host).toContainText('Checksum');
  await expect(host).toContainText('OK — checksum matches');
  await expect(host).toContainText('print model, not a rendered PDF');
  await expect(host).toContainText('Automatic Mac sync');
  expect(errors.join('\n')).not.toMatch(/Trusted Type|require-trusted-types|Refused to/i);
});

test('invoice preview ON: draft totals + packing slip; issuing stays an owner decision', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'run the journey once');
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(() => { try { localStorage.setItem('he_invoice_preview', 'on'); } catch (e) {} });
  await login(page);
  await gotoPage(page, 'reportHistoryPanel');
  const host = page.locator('#invoicePreviewHost');
  await expect(host).toContainText('Invoice preview');
  await expect(host).toContainText('SIMULATED');
  await expect(host).toContainText('Subtotal');
  await expect(host).toContainText('Total');
  // packing slip is present, distinct from an invoice and a carrier label
  await expect(host).toContainText('Packing slip — not an invoice, not a carrier label');
  await expect(host).toContainText('lot LOT-A');
  // issuing is explicitly gated to the owner decision (numbering/terms/tax)
  await expect(host).toContainText('owner decision');
  expect(errors.join('\n')).not.toMatch(/Trusted Type|require-trusted-types|Refused to/i);
});
