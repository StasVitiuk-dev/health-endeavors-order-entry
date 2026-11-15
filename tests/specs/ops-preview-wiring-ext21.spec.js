// Operations output previews — dashboard wiring (Phase 2 items 9-10, wave-1
// item 1). The export preview and the invoice preview are reachable through
// normal navigation to Report History, each behind its own default-OFF flag
// (he_report_export / he_invoice_preview). Flag OFF => the host is empty and the
// live dashboard is unchanged. Flag ON => a read-only, SIMULATED preview renders
// with no Trusted-Types/CSP violation. Nothing is issued, written or sent.
const { test, expect, login, gotoPage, OWNER_USER } = require('../helpers/dashboard');

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
  // ...and names who is signed in, not a placeholder (Nov 15).
  await expect(label).toContainText(OWNER_USER.email + ' (owner)');
  await expect(label).not.toContainText('signed-in user');
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
  // The invoice's own totals row follows the same rules (no placeholder rate).
  await expect(host).toContainText('Tax (6.25% state rate — local rate pending): $16.03');
  await expect(host).toContainText('Total: $272.53');
  await expect(host).not.toContainText('Tax (8%)');
  await expect(host).toContainText('Taxable base $256.50');
  await expect(host).toContainText('Payment terms: Due on receipt');
  // Owner decision #3: drafts are generated from orders and wait for review.
  const auto = host.locator('[data-autodrafts]');
  await expect(auto).toHaveAttribute('data-autodrafts', '2');
  await expect(auto.locator('[data-autodraft="SYN-O-2001"]')).toContainText('draft, not issued');
  await expect(auto.locator('[data-autodraft="SYN-O-2001"]')).toContainText('Due on receipt');
  await expect(auto.locator('[data-autodraft="SYN-O-2002"]')).toContainText('no unit price');
  await expect(auto.locator('[data-autodraft-skipped="SYN-O-2003"]')).toContainText('the order was cancelled');
  await expect(auto.locator('[data-autodraft-skipped="SYN-O-2004"]')).toContainText('already has an invoice');
  await expect(auto).toContainText('nothing is issued or numbered');
  const check = host.locator('[data-issuecheck]');
  await expect(check).toHaveAttribute('data-issuecheck', 'blocked');
  await expect(check).toContainText('Invoice total under these rules: $272.53');
  await expect(check).toContainText('still pending');
  expect(errors.join('\n')).not.toMatch(/Trusted Type|require-trusted-types|Refused to/i);
});

test('invoice preview ON: the review desk — confirm the local rate, issue, void (all simulated)', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'run the journey once');
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(() => { try { localStorage.setItem('he_invoice_preview', 'on'); } catch (e) {} });
  await login(page);
  await gotoPage(page, 'reportHistoryPanel');
  const desk = page.locator('#invoicePreviewHost .invoiceDesk');
  const msg = desk.locator('[data-invoicedesk-msg]');
  await expect(desk).toHaveAttribute('data-autodrafts', '2');
  // 1. Issuing is refused while the tax rate is pending, and says why.
  await desk.getByRole('button', { name: 'Issue the draft for order SYN-2001 (simulated)' }).click();
  await expect(msg).toContainText('Not issued');
  await expect(msg).toContainText('tax rate is still pending');
  await expect(desk.locator('[data-issued]')).toHaveCount(0);
  // 2. A nonsense rate is refused; a real one is recorded on the drafts.
  await desk.getByLabel(/Local tax rate, percent/).fill('abc');
  await desk.locator('[data-invoicedesk="confirm-tax"]').click();
  await expect(msg).toContainText('Not confirmed');
  await desk.getByLabel(/Local tax rate, percent/).fill('2.75');
  await desk.locator('[data-invoicedesk="confirm-tax"]').click();
  await expect(msg).toContainText('Rate confirmed for 2 draft(s)');
  await expect(desk.locator('[data-autodraft="SYN-O-2001"]')).toContainText('$130.80');           // (111 + 9) * 1.09
  await expect(desk.locator('#invoiceDeskRate')).toHaveCount(0);                                 // nothing left pending
  // 3. A draft with a missing price still cannot be issued.
  await desk.getByRole('button', { name: 'Issue the draft for order SYN-2002 (simulated)' }).click();
  await expect(msg).toContainText('no unit price');
  // 4. The clean draft is issued: first number of the year, due on receipt.
  await desk.getByRole('button', { name: 'Issue the draft for order SYN-2001 (simulated)' }).click();
  await expect(msg).toContainText(/Issued as HE-\d{4}-0001 \(simulated\)/);
  const issued = desk.locator('[data-issued]');
  await expect(issued).toHaveCount(1);
  await expect(issued).toHaveAttribute('data-issued-status', 'issued');
  await expect(issued).toContainText('Due on receipt');
  await expect(issued).toContainText('$130.80');
  await expect(desk).toHaveAttribute('data-autodrafts', '1');
  // 5. Voiding needs a written reason; the number then stays on the record.
  await issued.locator('[data-invoicedesk="void"]').click();
  await expect(msg).toContainText('a written reason is required');
  await desk.getByLabel(/Reason for voiding/).fill('Entered twice (synthetic)');
  await desk.locator('[data-issued] [data-invoicedesk="void"]').click();
  await expect(desk.locator('[data-issued]')).toHaveAttribute('data-issued-status', 'void');
  await expect(desk.locator('[data-issued]')).toContainText('the number stays on the record');
  await expect(msg).toContainText('is not reused');
  // 6. Reset returns to the starting example.
  await desk.locator('[data-invoicedesk="reset"]').click();
  await expect(page.locator('#invoicePreviewHost .invoiceDesk')).toHaveAttribute('data-autodrafts', '2');
  await expect(page.locator('#invoicePreviewHost .invoiceDesk [data-issued]')).toHaveCount(0);
  expect(errors.join('\n')).not.toMatch(/Trusted Type|require-trusted-types|Refused to/i);
});
