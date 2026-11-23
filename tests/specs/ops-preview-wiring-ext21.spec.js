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
  // Owner decision of Nov 16: no tax rate is built in, and unknown tax is never
  // shown as 0. The example invoice says TAX PENDING, gives the total before
  // tax, has no total, and issuing is BLOCKED.
  await expect(host.locator('[data-total="tax"]')).toHaveText('Tax: PENDING — no tax rate has been confirmed for this sale');
  await expect(host.locator('[data-total="totalBeforeTax"]')).toHaveText('Total before tax: $256.50');
  await expect(host.locator('[data-total="total"]')).toHaveText('Total: PENDING — tax not confirmed');
  await expect(host.locator('[data-total="tax"]')).not.toContainText('$');
  await expect(host).not.toContainText('6.25');
  await expect(host).not.toContainText('$16.03');
  await expect(host).not.toContainText('Tax (8%)');
  await expect(host.locator('[data-taxstatus]')).toHaveAttribute('data-taxstatus', 'PENDING');
  await expect(host).toContainText('no tax rate is built into the dashboard');
  await expect(host).toContainText('Payment terms: Due on receipt');
  // Owner decision #3: drafts are generated from orders and wait for review.
  const auto = host.locator('[data-autodrafts]');
  await expect(auto).toHaveAttribute('data-autodrafts', '6');
  await expect(auto.locator('[data-autodraft="SYN-O-2001"]')).toContainText('draft, not issued');
  await expect(auto.locator('[data-autodraft="SYN-O-2001"]')).toContainText('total pending ($120.00 before tax)');
  await expect(auto.locator('[data-autodraft="SYN-O-2001"] [data-taxline]')).toHaveAttribute('data-taxline', 'PENDING');
  // A verified resale order is settled from the start: tax $0.00, with the document named.
  await expect(auto.locator('[data-autodraft="SYN-O-2006"] [data-taxline]')).toHaveAttribute('data-taxline', 'EXEMPT');
  await expect(auto.locator('[data-autodraft="SYN-O-2006"]')).toContainText('tax $0.00 — resale exempt — certificate SYN-RESALE-0001 verified by owner (example)');
  // Resale claimed without verified paperwork is not exempt.
  await expect(auto.locator('[data-autodraft="SYN-O-2007"]')).toContainText('has not been verified');
  await expect(auto.locator('[data-autodraft="SYN-O-2001"]')).toContainText('Due on receipt');
  await expect(auto.locator('[data-autodraft="SYN-O-2002"]')).toContainText('no unit price');
  await expect(auto.locator('[data-autodraft-skipped="SYN-O-2003"]')).toContainText('the order was cancelled');
  await expect(auto.locator('[data-autodraft-skipped="SYN-O-2004"]')).toContainText('already has an invoice');
  await expect(auto).toContainText('nothing is issued or numbered');
  const check = host.locator('[data-issuecheck]');
  await expect(check).toHaveAttribute('data-issuecheck', 'blocked');
  await expect(check).toContainText('Invoice total under these rules: pending ($256.50 before tax)');
  await expect(check).toContainText('still pending');
  expect(errors.join('\n')).not.toMatch(/Trusted Type|require-trusted-types|Refused to/i);
});

test('invoice preview ON: the review desk — a rate per place, the three tax cases, issue, void (all simulated)', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'run the journey once');
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(() => { try { localStorage.setItem('he_invoice_preview', 'on'); } catch (e) {} });
  await login(page);
  await gotoPage(page, 'reportHistoryPanel');
  const desk = page.locator('#invoicePreviewHost .invoiceDesk');
  const msg = desk.locator('[data-invoicedesk-msg]');
  const row = n => desk.locator(`[data-autodraft="SYN-O-${n}"]`);
  const A = 'Example City A, IL', B = 'Example City B, IL';
  await expect(desk).toHaveAttribute('data-autodrafts', '6');
  // 1. Issuing is refused while the tax is pending, and says why.
  await desk.getByRole('button', { name: 'Issue the draft for order SYN-2001 (simulated)' }).click();
  await expect(msg).toContainText('Not issued');
  await expect(msg).toContainText('tax is still pending');
  await expect(desk.locator('[data-issued]')).toHaveCount(0);
  // 2. Each place has its own rate field. A nonsense rate is refused.
  await expect(desk.locator('[data-taxplace]')).toHaveCount(2);
  await desk.getByLabel('Full tax rate for ' + A + ', percent').fill('abc');
  await desk.locator(`[data-invoicedesk="confirm-tax"][data-place="${A}"]`).click();
  await expect(msg).toContainText('Not confirmed');
  await expect(row(2001)).toContainText('total pending');
  // 3. A rate for place A settles only the drafts for place A whose facts are complete.
  await desk.getByLabel('Full tax rate for ' + A + ', percent').fill('9');
  await desk.locator(`[data-invoicedesk="confirm-tax"][data-place="${A}"]`).click();
  await expect(msg).toContainText('Rate 9% confirmed for ' + A + ': 3 draft(s) now carry tax; 2 still pending');
  //    CASE 1 — shipping stated separately and optional: not taxed. 111.00 x 9% = 9.99
  await expect(row(2001)).toContainText('$129.99');
  await expect(row(2001)).toContainText('tax $9.99 at 9% (' + A + ', shipping not taxed)');
  //    Shipping terms never recorded: still pending, with the reason, even though the place has a rate.
  await expect(row(2008)).toContainText('TAX PENDING — the shipping terms are not recorded');
  await expect(row(2008)).toContainText('total pending ($118.00 before tax)');
  //    Place B is untouched by place A's rate.
  await expect(row(2005)).toContainText('TAX PENDING');
  await expect(desk.locator('[data-taxplace]')).toHaveCount(1);
  // 4. CASE 2 — mandatory shipping is taxed, at place B's own rate. (111 + 12) x 10% = 12.30
  await desk.getByLabel('Full tax rate for ' + B + ', percent').fill('10');
  await desk.locator(`[data-invoicedesk="confirm-tax"][data-place="${B}"]`).click();
  await expect(msg).toContainText('Rate 10% confirmed for ' + B + ': 1 draft(s) now carry tax; 1 still pending');
  await expect(row(2005)).toContainText('$135.30');
  await expect(row(2005)).toContainText('tax $12.30 at 10% (' + B + ', shipping taxed)');
  await expect(desk.locator('[data-taxplace]')).toHaveCount(0);
  // 5. A draft with a missing price still cannot be issued; nor can the one still pending.
  await desk.getByRole('button', { name: 'Issue the draft for order SYN-2002 (simulated)' }).click();
  await expect(msg).toContainText('no unit price');
  await desk.getByRole('button', { name: 'Issue the draft for order SYN-2008 (simulated)' }).click();
  await expect(msg).toContainText('tax is still pending');
  // 6. The clean draft is issued: first number of the year, due on receipt.
  await desk.getByRole('button', { name: 'Issue the draft for order SYN-2001 (simulated)' }).click();
  await expect(msg).toContainText(/Issued as HE-\d{4}-0001 \(simulated\)/);
  const issued = desk.locator('[data-issued]');
  await expect(issued).toHaveCount(1);
  await expect(issued).toHaveAttribute('data-issued-status', 'issued');
  await expect(issued).toContainText('Due on receipt');
  await expect(issued).toContainText('$129.99');
  await expect(desk).toHaveAttribute('data-autodrafts', '5');
  // 7. Voiding needs a written reason; the number then stays on the record.
  await issued.locator('[data-invoicedesk="void"]').click();
  await expect(msg).toContainText('a written reason is required');
  await desk.getByLabel(/Reason for voiding/).fill('Entered twice (synthetic)');
  await desk.locator('[data-issued] [data-invoicedesk="void"]').click();
  await expect(desk.locator('[data-issued]')).toHaveAttribute('data-issued-status', 'void');
  await expect(desk.locator('[data-issued]')).toContainText('the number stays on the record');
  await expect(msg).toContainText('is not reused');
  // 8. CASE 3 — the verified resale order is issued with tax $0.00; it takes the NEXT number.
  await desk.getByRole('button', { name: 'Issue the draft for order SYN-2006 (simulated)' }).click();
  await expect(msg).toContainText(/Issued as HE-\d{4}-0002 \(simulated\)/);
  await expect(desk.locator('[data-issued-status="issued"]')).toContainText('$120.00');
  // 9. Reset returns to the starting example, with no rate confirmed.
  await desk.locator('[data-invoicedesk="reset"]').click();
  await expect(page.locator('#invoicePreviewHost .invoiceDesk')).toHaveAttribute('data-autodrafts', '6');
  await expect(page.locator('#invoicePreviewHost .invoiceDesk [data-taxplace]')).toHaveCount(2);
  await expect(page.locator('#invoicePreviewHost .invoiceDesk [data-issued]')).toHaveCount(0);
  expect(errors.join('\n')).not.toMatch(/Trusted Type|require-trusted-types|Refused to/i);
});
