// Accessibility + phone sweep of the Sales outreach workbench (Nov 15), in its
// fullest state: stores imported, a draft open for review, approved, "sent"
// into the simulated outbox, a reply recorded, and the step-by-step record
// opened. The workbench tests so far ran at computer size only.
//   - every visible control has a name a screen reader announces; ids unique;
//     a visible heading; the store table has column headers;
//   - the result of every button is read out by a screen reader through the
//     page's permanent status region, and keyboard focus returns to the button
//     (this section, reconciliation, preview switches and the invoice desk all
//     redraw themselves after a click);
//   - text meets WCAG AA contrast in light AND dark themes;
//   - at 390 px, and at 320 px with text at 200 %, the page does not scroll
//     sideways (a wide table may scroll inside its own box);
//   - visible buttons are at least a 24 px tap target on a phone.
// Synthetic; nothing is sent or saved anywhere but this test browser.
const { test, expect, login, gotoPage } = require('../helpers/dashboard');
const { enableSalesFlag } = require('../helpers/sales-pages');
const { unnamedControls, contrastFailures } = require('../helpers/a11y-audit');

async function fullWorkbench(page) {
  await enableSalesFlag(page);
  await login(page);
  await gotoPage(page, 'salesApprovalsPanel');
  const wb = page.locator('#salesWorkbenchHost .salesWorkbench');
  await wb.locator('[data-workbench="import"]').click();
  await expect(wb.locator('tr[data-wb-store]')).toHaveCount(5);
  await wb.getByRole('button', { name: 'Draft an email to SYN Cedar Spa' }).click();
  const review = wb.locator('[data-wb-review="S1"]');
  await review.locator('[data-workbench="approve"]').click();
  await review.locator('[data-workbench="send"]').click();
  await expect(wb.locator('[data-wb-outbox="S1"]')).toHaveCount(1);
  await review.locator('[data-workbench="reply"]').click();
  await expect(wb.locator('[data-wb-msg]')).toContainText(/INTERESTED|reply/i);
  const log = wb.locator('details').filter({ hasText: 'What happened' });
  if (await log.count()) await log.first().locator('summary').click();
  return wb;
}

test('workbench: controls named, ids unique, heading, table headers, message announced', async ({ page }, ti) => {
  test.skip(ti.project.name !== 'desktop', 'markup; run once');
  const wb = await fullWorkbench(page);
  expect(await wb.evaluate(unnamedControls)).toEqual([]);
  const r = await wb.evaluate(host => {
    const vis = el => el.getClientRects().length > 0;
    const seen = {}; document.querySelectorAll('[id]').forEach(e => { seen[e.id] = (seen[e.id] || 0) + 1; });
    const msg = host.querySelector('[data-wb-msg]');
    return {
      heading: [...host.querySelectorAll('h1, h2, h3, h4, [role=heading]')].some(vis),
      bareTables: [...host.querySelectorAll('table')].filter(vis).filter(t => !t.querySelector('th')).length,
      dupIds: Object.entries(seen).filter(([, n]) => n > 1).map(([k, n]) => `${k} ×${n}`),
      msgShown: !!msg,
      textareaLabelled: [...host.querySelectorAll('textarea')].every(t => (t.id && document.querySelector(`label[for="${CSS.escape(t.id)}"]`)) || t.getAttribute('aria-label')),
    };
  });
  expect(r.heading).toBe(true);
  expect(r.bareTables).toBe(0);
  expect(r.dupIds).toEqual([]);
  expect(r.msgShown).toBe(true);
  expect(r.textareaLabelled).toBe(true);
});

for (const scheme of ['light', 'dark']) {
  test(`workbench: text meets AA contrast (${scheme})`, async ({ page }, ti) => {
    test.skip(ti.project.name !== 'desktop', 'colours; run once');
    await page.emulateMedia({ colorScheme: scheme });
    const wb = await fullWorkbench(page);
    expect(await wb.evaluate(contrastFailures)).toEqual([]);
  });
}

test('workbench: no sideways page scroll at phone width; tap targets at least 24 px', async ({ page }, ti) => {
  test.skip(ti.project.name !== 'iphone', 'phone size only');
  const wb = await fullWorkbench(page);
  expect(await page.evaluate(() => document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth)).toBeLessThanOrEqual(1);
  const small = await wb.evaluate(host => [...host.querySelectorAll('button, a[href], input:not([type=hidden]), select, summary, [role=button]')]
    .filter(el => el.getClientRects().length > 0)
    .map(el => { const r = el.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), t: (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 40) }; })
    .filter(b => b.w < 24 || b.h < 24).map(b => `${b.t} ${b.w}×${b.h}`));
  expect(small).toEqual([]);
});

test.describe('phone 320 px with text at 200 %', () => {
  test.use({ viewport: { width: 320, height: 640 } });
  test('workbench: the page does not scroll sideways', async ({ page }, ti) => {
    test.skip(ti.project.name !== 'iphone', 'small screen; run once');
    const wb = await fullWorkbench(page);
    await page.evaluate(() => { const s = new CSSStyleSheet(); s.replaceSync('html { font-size: 200% !important; }'); document.adoptedStyleSheets = [...document.adoptedStyleSheets, s]; });
    await expect(wb).toBeVisible();
    expect(await page.evaluate(() => document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth)).toBeLessThanOrEqual(1);
  });
});

// ---- announcements and focus after a redraw (four sections) ----

const announced = page => page.locator('#srAnnounce');

test('the page has one permanent, invisible status region from the start', async ({ page }, ti) => {
  test.skip(ti.project.name !== 'desktop', 'markup; run once');
  await login(page);
  const r = await page.evaluate(() => {
    const els = document.querySelectorAll('#srAnnounce');
    const el = els[0]; const b = el.getBoundingClientRect();
    return { n: els.length, role: el.getAttribute('role'), live: el.getAttribute('aria-live'), atomic: el.getAttribute('aria-atomic'), w: b.width, h: b.height, text: el.textContent };
  });
  expect(r).toEqual({ n: 1, role: 'status', live: 'polite', atomic: 'true', w: 1, h: 1, text: '' });
  // The recreated message lines no longer claim to be status regions (no double reading).
  expect(await page.evaluate(() => document.querySelectorAll('[data-wb-msg][role], [data-reconcile-msg][role], [data-preview-msg][role], [data-invoicedesk-msg][role]').length)).toBe(0);
});

test('workbench: each result is announced, and focus returns to the pressed button', async ({ page }, ti) => {
  test.skip(ti.project.name !== 'desktop', 'run once');
  await enableSalesFlag(page);
  await login(page);
  await gotoPage(page, 'salesApprovalsPanel');
  const wb = page.locator('#salesWorkbenchHost .salesWorkbench');
  await wb.locator('[data-workbench="import"]').focus();
  await page.keyboard.press('Enter');
  await expect(announced(page)).toContainText(/Imported|import/i);
  await expect(wb.locator('[data-workbench="import"]')).toBeFocused();
  await wb.getByRole('button', { name: 'Draft an email to SYN Cedar Spa' }).click();
  const send = wb.locator('[data-wb-review="S1"] [data-workbench="send"]');
  await send.focus();
  await page.keyboard.press('Enter');
  await expect(announced(page)).toContainText('has not been approved');
  await expect(send).toBeFocused();
  // The same refusal twice is read out twice: the region is emptied and filled
  // again, which is what makes a screen reader repeat it. Counted with an
  // observer (the empty moment lasts 60 ms, too short to catch by polling).
  await page.evaluate(() => {
    window.__said = 0;
    new MutationObserver(() => { if (document.getElementById('srAnnounce').textContent) window.__said++; })
      .observe(document.getElementById('srAnnounce'), { childList: true, characterData: true, subtree: true });
  });
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.__said)).toBe(1);
  await expect(announced(page)).toContainText('has not been approved');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.__said)).toBe(2);
});

test('reconciliation, preview switches and invoice desk: results are announced', async ({ page }, ti) => {
  test.skip(ti.project.name !== 'desktop', 'run once');
  await page.addInitScript(() => { try { ['he_reconcile', 'he_invoice_preview'].forEach(k => localStorage.setItem(k, 'on')); } catch (e) {} });
  await login(page);
  await gotoPage(page, 'accountingPanel');
  const rec = page.locator('#reconcileHost tr[data-outcome="UNDERPAID"] [data-reconcile="review"]');
  await rec.click();
  await expect(announced(page)).toContainText('a written note is required');
  await expect(page.locator('#reconcileHost tr[data-outcome="UNDERPAID"] [data-reconcile="review"]')).toBeFocused();
  await gotoPage(page, 'reportHistoryPanel');
  const desk = page.locator('#invoicePreviewHost .invoiceDesk');
  await desk.getByLabel(/Local tax rate, percent/).fill('abc');
  await desk.locator('[data-invoicedesk="confirm-tax"]').click();
  await expect(announced(page)).toContainText('Not confirmed');
  await expect(desk.locator('[data-invoicedesk="confirm-tax"]')).toBeFocused();
  await gotoPage(page, 'flagsPanel');
  const sw = page.locator('#previewSwitchesHost').getByRole('button', { name: 'Turn on Payment reconciliation' });
  await expect(sw).toHaveCount(0);   // already on via this test's setup, so the button offers "Turn off"
  await page.locator('#previewSwitchesHost').getByRole('button', { name: 'Turn off Payment reconciliation' }).click();
  await expect(announced(page)).toContainText('Payment reconciliation is off');
});
