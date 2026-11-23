// Owner request of Nov 16 (later): "verify that an unresolved tax amount can't
// be mistaken for zero or used to issue a live invoice." The single-place tests
// (tax-ext21, invoice-desk-ext21, ops-preview-wiring-ext21, invoice-print-view-ext21,
// and the database tests of drafts/32) each check one surface. This sweep checks
// them all at once: every pending tax line and total on the invoice screen and on
// the printed page, and the corner case of a draft marked "confirmed" whose tax
// figure is missing.
const { test, expect, login, gotoPage } = require('../helpers/dashboard');
const I = require('../../assets/invoice/he-invoice.js');
const T = require('../../assets/invoice/he-tax.js');

const ZERO = /\$\s?0\.00\b/;

test('engine: a missing tax figure is pending however the draft is labelled, and no totals line shows 0 for it', ({}, ti) => {
  test.skip(ti.project.name !== 'desktop', 'Node-only; run once');
  const shapes = [
    { taxRateStatus: 'PENDING', tax: null, total: null, subtotal: 100, shipping: 10, totalBeforeTax: 110 },
    { taxRateStatus: 'CONFIRMED', tax: null, total: null, subtotal: 100, shipping: 10, totalBeforeTax: 110 },   // labelled confirmed, figure missing
    { taxRateStatus: 'CONFIRMED', tax: 8, total: null, subtotal: 100, shipping: 10, totalBeforeTax: 110 },      // total missing
    { subtotal: 100, shipping: 10 },                                                                         // nothing about tax at all
  ];
  for (const s of shapes) {
    expect(I.taxIsPending(s), JSON.stringify(s)).toBe(true);
    const lines = I.totalsLines(s);
    const tax = lines.find(l => l.key === 'tax'); const total = lines.find(l => l.key === 'total');
    expect(tax.amount, 'tax line ' + JSON.stringify(s)).toBeNull();
    expect(total.amount, 'total line ' + JSON.stringify(s)).toBeNull();
    expect(tax.text).toMatch(/^PENDING/);
    expect(total.text).toMatch(/^PENDING/);
  }
  // Only a verified exemption shows 0, and it always says why.
  const ex = I.totalsLines({ taxRateStatus: 'EXEMPT', taxExempt: true, tax: 0, total: 110, subtotal: 100, shipping: 10, taxExemptReason: 'resale exempt — certificate SYN-1' }).find(l => l.key === 'tax');
  expect(ex.amount).toBe(0);
  expect(ex.text).toContain('resale exempt');
  // The tax engine never hands back 0 for an unknown rate.
  const t = T.computeTax({ subtotal: 100, shipping: { amount: 10, separatelyStated: true, avoidable: true } });
  expect(t.status).toBe('PENDING');
  expect(t.tax).toBeNull();
  // And issuing refuses every one of them.
  for (const s of shapes) {
    const r = I.issue(Object.assign({ lines: [{ sku: 'SYN-1', qty: 1, unitPrice: 100, lineTotal: 100 }], status: 'draft' }, s), { role: 'owner', number: 'HE-2026-0001', now: '2026-11-16T12:00:00Z', account: {} });
    expect(r.ok, 'issue ' + JSON.stringify(s)).toBe(false);
  }
});

test('screen and paper: no pending tax line or pending total shows $0.00 anywhere, and pending drafts cannot be issued', async ({ page }, ti) => {
  test.skip(ti.project.name !== 'desktop', 'run the sweep once');
  await page.addInitScript(() => { try { localStorage.setItem('he_invoice_preview', 'on'); } catch (e) {} window.print = () => {}; });
  await login(page);
  await gotoPage(page, 'reportHistoryPanel');
  const host = page.locator('#invoicePreviewHost');
  await expect(host.locator('[data-taxstatus]')).toHaveAttribute('data-taxstatus', 'PENDING');
  // the example invoice: the tax and total lines
  for (const k of ['tax', 'total']) await expect(host.locator(`[data-total="${k}"]`)).not.toContainText(ZERO);
  // every generated draft whose tax is pending
  const pending = host.locator('[data-autodraft]:has([data-taxline="PENDING"])');
  const n = await pending.count();
  expect(n, 'the example orders include pending drafts').toBeGreaterThan(0);
  for (let i = 0; i < n; i++) {
    const row = pending.nth(i);
    const text = await row.innerText();
    expect(text, text).toMatch(/total pending/);
    expect(text, text).toMatch(/TAX PENDING/);
    expect(text.replace(/\(\$[\d,.]+ before tax\)/, ''), text).not.toMatch(ZERO);
  }
  // the only $0.00 tax on the screen is the verified resale, and it says why
  const zeroTax = host.locator('[data-taxline]', { hasText: 'tax $0.00' });
  await expect(zeroTax).toHaveCount(1);
  await expect(zeroTax).toHaveAttribute('data-taxline', 'EXEMPT');
  await expect(zeroTax).toContainText('resale exempt');
  // issue every pending draft: each is refused, nothing gets a number
  const desk = host.locator('.invoiceDesk');
  const ids = await pending.evaluateAll(els => els.map(e => e.getAttribute('data-autodraft')));
  for (const id of ids) {
    await desk.locator(`[data-autodraft="${id}"] [data-invoicedesk="issue"]`).click();
    await expect(desk.locator('[data-invoicedesk-msg]')).toContainText('Not issued');
  }
  await expect(desk.locator('[data-issued]')).toHaveCount(0);
  // paper: the printed invoice
  await host.locator('[data-print="invoice"]').click();
  const paper = page.locator('#invoicePrintHost');
  await expect(paper.locator('[data-printmark="tax-pending"]')).toHaveText('DRAFT — TAX PENDING, NOT A FINAL INVOICE');
  for (const k of ['tax', 'total']) await expect(paper.locator(`[data-printtotal="${k}"]`)).not.toContainText(/\$/);
  await expect(paper).not.toContainText(ZERO);
});
