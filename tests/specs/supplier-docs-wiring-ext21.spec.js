// Supplier document checklist on the Suppliers page, behind the default-OFF
// he_supplier_documents switch (owner decision of Nov 16). Read-only worked
// example: what each kind of supplier should have on file, and which documents
// are missing or awaiting review. Switch OFF leaves Suppliers unchanged.
const { test, expect, login, gotoPage } = require('../helpers/dashboard');
const { unnamedControls, contrastFailures } = require('../helpers/a11y-audit');

async function enable(page) {
  await page.addInitScript(() => { try { localStorage.setItem('he_supplier_documents', 'on'); } catch (e) {} });
}

test('switch OFF (default): no supplier documents section', async ({ page }) => {
  await login(page);
  await gotoPage(page, 'suppliersPanel');
  await expect(page.locator('#supplierDocsHost')).toBeEmpty();
});

test('switch ON: missing and awaiting-review documents per supplier, the full list on request, and the checklist itself', async ({ page, backend }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'run the journey once');
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await enable(page);
  await login(page);
  await gotoPage(page, 'suppliersPanel');
  const host = page.locator('#supplierDocsHost');
  await expect(host.locator('.supplierDocs')).toHaveCount(1);
  await expect(host).toContainText('SIMULATED — example data, read-only');
  await expect(host.locator('[data-supplierdocs-totals]')).toHaveAttribute('data-supplierdocs-totals', '7/3/8');
  await expect(host.locator('[data-supplierdocs-totals]')).toContainText('7 documents missing · 3 awaiting review · 8 approved, across 3 suppliers');
  // By default only what needs work is listed.
  await expect(host.locator('tr[data-docstate="APPROVED"]')).toHaveCount(0);
  await expect(host.locator('tr[data-docstate="MISSING"]')).toHaveCount(6);
  await expect(host.locator('tr[data-docstate="AWAITING_REVIEW"]')).toHaveCount(3);
  await expect(host.locator('tr[data-docstate="REJECTED"]')).toHaveCount(1);
  // The lotion lab: the second batch has a certificate waiting for review and no batch record.
  const lab = host.locator('[data-supplierdocs-supplier="SUP-LAB"]');
  await expect(lab).toHaveAttribute('data-missing', '3');
  await expect(lab).toHaveAttribute('data-awaiting', '2');
  await expect(lab).toContainText('Checklist: purchases + lotion lab');
  await expect(lab.locator('tr[data-dockey="certificate_of_analysis"]')).toContainText('Batch LOT-205');
  await expect(lab.locator('tr[data-dockey="certificate_of_analysis"]')).toContainText('Awaiting review');
  await expect(lab.locator('tr[data-dockey="batch_record"]')).toContainText('Missing');
  await expect(lab.locator('tr[data-dockey="approved_ingredient_list"]')).toContainText('Formula Vegan');
  // Bottles and pumps, which also prints directly on bottles.
  const bot = host.locator('[data-supplierdocs-supplier="SUP-BOT"]');
  await expect(bot).toContainText('purchases + bottles and pumps + printed labels or direct bottle printing');
  await expect(bot.locator('tr[data-dockey="component_specification"]')).toContainText('Rejected — needs a new copy');
  await expect(bot.locator('tr[data-dockey="component_specification"]')).toContainText('Wrong neck size on the drawing');
  await expect(bot.locator('tr[data-dockey="printer_proof"]')).toContainText('Missing');
  // The label printer.
  await expect(host.locator('[data-supplierdocs-supplier="SUP-LBL"] tr[data-dockey="printer_proof"]')).toContainText('Artwork Honey Milk label v3');
  // "Every document" adds the approved ones, with who reviewed them.
  const all = host.locator('[data-supplierdocs="all"]');
  await all.focus();
  await page.keyboard.press('Enter');
  await expect(host.locator('tr[data-docstate="APPROVED"]')).toHaveCount(8);
  await expect(host.locator('tr[data-docstate="APPROVED"]').first()).toContainText('Reviewed by owner (example) on 2026-10-02');
  await expect(host.locator('[data-supplierdocs="all"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(host.locator('[data-supplierdocs="all"]')).toBeFocused();
  await expect(page.locator('#srAnnounce')).toContainText('Showing every document.');
  await host.locator('[data-supplierdocs="attention"]').click();
  await expect(host.locator('tr[data-docstate="APPROVED"]')).toHaveCount(0);
  // The checklist itself can be read on the page.
  await host.locator('details summary').click();
  await expect(host.locator('[data-checklist="purchase"]')).toContainText('Quote or order confirmation (one per purchase); Supplier invoice (one per purchase); Packing slip (one per purchase)');
  await expect(host.locator('[data-checklist="lotion_lab"]')).toContainText('Approved ingredient list (one per formula); Batch or lot record (one per batch); Certificate of analysis (one per batch)');
  await expect(host.locator('[data-checklist="bottles_pumps"]')).toContainText('Component specification (one per component)');
  await expect(host.locator('[data-checklist="labels_printing"]')).toContainText('Approved artwork (one per artwork); Printer proof (one per artwork)');
  // Read-only: nothing was written anywhere.
  expect(backend.tableWrites()).toEqual([]);
  expect(errors.join('\n')).not.toMatch(/Trusted Type|require-trusted-types|Refused to/i);
});

for (const scheme of ['light', 'dark']) {
  test(`switch ON: controls are named and text meets AA contrast (${scheme})`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'colours; run once');
    await page.emulateMedia({ colorScheme: scheme });
    await enable(page);
    await login(page);
    await gotoPage(page, 'suppliersPanel');
    const host = page.locator('#supplierDocsHost .supplierDocs');
    await host.locator('[data-supplierdocs="all"]').click();
    await page.locator('#supplierDocsHost details summary').click();
    expect(await host.evaluate(unnamedControls)).toEqual([]);
    expect(await host.evaluate(contrastFailures)).toEqual([]);
    expect(await host.evaluate(h => [...h.querySelectorAll('table')].filter(t => !t.querySelector('th')).length)).toBe(0);
  });
}

test('switch ON at phone size: no sideways page scroll, tables become labelled cards', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'iphone', 'phone size only');
  await enable(page);
  await login(page);
  await gotoPage(page, 'suppliersPanel');
  const host = page.locator('#supplierDocsHost .supplierDocs');
  await host.locator('[data-supplierdocs="all"]').click();
  await expect(host.locator('tr[data-docstate="APPROVED"]')).toHaveCount(8);
  expect(await page.evaluate(() => document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth)).toBeLessThanOrEqual(1);
  const r = await host.evaluate(h => ({
    unlabelled: [...h.querySelectorAll('table.phoneCards tbody td')].filter(td => !td.dataset.label).length,
    small: [...h.querySelectorAll('button, summary')].filter(b => b.getClientRects().length).map(b => ({ t: b.textContent.slice(0, 30), r: b.getBoundingClientRect() })).filter(b => b.r.height < 24 || b.r.width < 24).map(b => b.t + ' ' + Math.round(b.r.width) + 'x' + Math.round(b.r.height)),
  }));
  expect(r).toEqual({ unlabelled: 0, small: [] });
});
