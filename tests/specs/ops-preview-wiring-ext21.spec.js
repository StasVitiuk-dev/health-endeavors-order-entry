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
  // #72: the export carries a traceable label bound to its content checksum.
  const label = host.locator('[data-exportlabel]');
  await expect(label).toHaveAttribute('data-exportlabel', 'ok');
  await expect(label).toContainText(/HE · (INTERNAL|CONFIDENTIAL) · trace [0-9a-f]{8}/);
  await expect(label).toContainText('matches this export');
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
  // Owner decisions #1/#2 applied inside the invoice: mandatory shipping is in
  // the tax base (16.03 on 256.50 at the 6.25% state rate), the invoice's own
  // total follows, and issuing is BLOCKED while the local rate is unconfirmed.
  await expect(host).toContainText('Taxable base $256.50');
  await expect(host).toContainText('Payment terms: Due on receipt');
  const check = host.locator('[data-issuecheck]');
  await expect(check).toHaveAttribute('data-issuecheck', 'blocked');
  await expect(check).toContainText('Invoice total under these rules: $272.53');
  await expect(check).toContainText('still pending');
  expect(errors.join('\n')).not.toMatch(/Trusted Type|require-trusted-types|Refused to/i);
});
