// Accessibility + phone sweep of the OPERATIONS sections with their switches ON.
// The broad a11y specs (a11y-basics, a11y-ext8) only ever see the switch-OFF
// dashboard, and sales-a11y-ext20k covers only the Sales & Growth pages, so the
// switch-gated operations sections (scan entry, reorder planning, saved views,
// cycle count, reconciliation, export preview, report versions, recovery drill,
// invoice preview, supplier scorecard) had no accessibility coverage at all.
// One parameterized pass per concern:
//   - every visible control has a name a screen reader announces;
//   - element ids stay unique with every section rendered;
//   - no data table lacks column headers; each section has a visible heading;
//   - text meets WCAG AA contrast in light AND dark themes;
//   - at 390 px, and at 320 px with text at 200 %, no page scrolls sideways;
//   - visible buttons are at least a 24 px tap target on a phone.
// Everything is synthetic and read-only; nothing is sent, saved or deployed.
const { test, expect, login, gotoPage } = require('../helpers/dashboard');

const FLAGS = ['he_scan_shipment', 'he_reorder_planning', 'he_saved_views', 'he_cycle_count', 'he_partial_receiving', 'he_supplier_scorecard', 'he_supplier_documents',
  'he_reconcile', 'he_report_versions', 'he_report_export', 'he_invoice_preview', 'he_recovery_drill', 'he_ops_watch',
  // Nov 23: the sections added since (money matching, packing slips, Backups & Printouts)
  'he_money_match', 'he_order_slips', 'he_backups_page', 'he_store_campaigns',
  // Nov 23: product list import; Nov 24: batch stickers
  'he_product_import', 'he_batch_labels', 'he_order_channels'];
// page -> the switch-gated hosts on it. heading:false = a small strip of
// controls (not a titled section), so no heading is expected there.
const PAGES = [
  ['attentionPanel', [['scanEntryHome', false]]],
  ['ordersPanel', [['scanEntryOrders', false], ['savedViewsOrders', false], ['orderSlipsHost', false]]],
  ['inventoryPanel', [['reorderPlanningHost', true], ['savedViewsInventory', false], ['cycleCountHost', true], ['partialReceivingHost', true], ['productImportHost', true], ['batchLabelsHost', true]]],
  ['accountingPanel', [['reconcileHost', true], ['moneyMatchHost', true]]],
  ['reportHistoryPanel', [['reportExportHost', true], ['reportVersionsHost', true], ['recoveryDrillHost', true], ['invoicePreviewHost', true], ['opsWatchHost', true]]],
  ['suppliersPanel', [['supplierScorecardHost', true], ['supplierDocsHost', true]]],
  ['backupsPanel', [['backupsPanel', true]]],
  ['storeCampaignsPanel', [['storeCampaignsPanel', true]]],
];

async function enableAll(page) {
  await page.addInitScript(flags => { try { flags.forEach(f => localStorage.setItem(f, 'on')); } catch (e) {} }, FLAGS);
}
// Wait until every host on the page has rendered something.
async function openPage(page, panel, hosts) {
  await gotoPage(page, panel);
  for (const [id] of hosts) await expect(page.locator('#' + id), id + ' rendered').not.toBeEmpty();
}

const { unnamedControls, contrastFailures } = require('../helpers/a11y-audit');

// ---- desktop: structure (names, ids, headings, table headers) ----

test('every switched-on section: controls are named, ids unique, headings and table headers present', async ({ page }, ti) => {
  test.skip(ti.project.name !== 'desktop', 'markup; run once');
  test.setTimeout(180000);
  await enableAll(page);
  await login(page);
  const problems = [];
  for (const [panel, hosts] of PAGES) {
    await openPage(page, panel, hosts);
    for (const [id, wantsHeading] of hosts) {
      const bad = await page.locator('#' + id).evaluate(unnamedControls);
      bad.forEach(b => problems.push(`${id} unnamed: ${b}`));
      const r = await page.evaluate(hid => {
        const host = document.getElementById(hid);
        const vis = el => el.getClientRects().length > 0;
        return {
          heading: [...host.querySelectorAll('h1, h2, h3, h4, [role=heading]')].some(vis),
          bareTables: [...host.querySelectorAll('table')].filter(vis).filter(t => !t.querySelector('th')).length,
        };
      }, id);
      if (wantsHeading && !r.heading) problems.push(`${id}: no visible heading`);
      if (r.bareTables) problems.push(`${id}: ${r.bareTables} table(s) without <th>`);
    }
  }
  const dupIds = await page.evaluate(() => {
    const seen = {}; document.querySelectorAll('[id]').forEach(e => { seen[e.id] = (seen[e.id] || 0) + 1; });
    return Object.entries(seen).filter(([, n]) => n > 1).map(([k, n]) => `${k} ×${n}`);
  });
  expect(problems).toEqual([]);
  expect(dupIds).toEqual([]);
});

// ---- desktop: contrast in both themes ----

for (const scheme of ['light', 'dark']) {
  test(`every switched-on section: text meets AA contrast (${scheme})`, async ({ page }, ti) => {
    test.skip(ti.project.name !== 'desktop', 'colours; run once');
    test.setTimeout(180000);
    await page.emulateMedia({ colorScheme: scheme });
    await enableAll(page);
    await login(page);
    const bad = new Map();
    for (const [panel, hosts] of PAGES) {
      await openPage(page, panel, hosts);
      for (const [id] of hosts) {
        const found = await page.locator('#' + id).evaluate(contrastFailures);
        found.forEach(f => { if (!bad.has(id + f)) bad.set(id + f, `${id}: ${f}`); });
      }
    }
    expect([...bad.values()]).toEqual([]);
  });
}

// ---- phone: no sideways scroll; tap targets ----

test('every switched-on section: no page scrolls sideways at phone width', async ({ page }, ti) => {
  test.skip(ti.project.name !== 'iphone', 'phone size only');
  test.setTimeout(180000);
  await enableAll(page);
  await login(page);
  const over = [];
  for (const [panel, hosts] of PAGES) {
    await openPage(page, panel, hosts);
    const x = await page.evaluate(() => document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth);
    if (x > 1) over.push(`${panel}: ${x}px sideways`);
  }
  expect(over).toEqual([]);
});

test.describe('phone 320 px with text at 200 %', () => {
  test.use({ viewport: { width: 320, height: 640 } });

  test('no switched-on section makes its page scroll sideways', async ({ page }, ti) => {
    test.skip(ti.project.name !== 'iphone', 'small screen; run once');
    test.setTimeout(180000);
    await enableAll(page);
    await login(page);
    // style-src 'self' blocks an injected <style>; a constructed stylesheet is allowed.
    await page.evaluate(() => { const s = new CSSStyleSheet(); s.replaceSync('html { font-size: 200% !important; }'); document.adoptedStyleSheets = [...document.adoptedStyleSheets, s]; });
    const over = [];
    for (const [panel, hosts] of PAGES) {
      await openPage(page, panel, hosts);
      const x = await page.evaluate(() => document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth);
      if (x > 1) over.push(`${panel}: ${x}px sideways`);
    }
    expect(over).toEqual([]);
  });
});

test('every switched-on section: visible buttons are at least a 24 px tap target (phone)', async ({ page }, ti) => {
  test.skip(ti.project.name !== 'iphone', 'phone size only');
  test.setTimeout(180000);
  await enableAll(page);
  await login(page);
  const small = [];
  for (const [panel, hosts] of PAGES) {
    await openPage(page, panel, hosts);
    for (const [id] of hosts) {
      const found = await page.locator('#' + id).evaluate(host => [...host.querySelectorAll('button, a[href], input:not([type=hidden]), select, [role=button]')]
        .filter(el => el.getClientRects().length > 0)
        .map(el => { const r = el.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), t: (el.getAttribute('aria-label') || el.textContent || el.id || el.tagName).trim().slice(0, 40) }; })
        .filter(b => b.w < 24 || b.h < 24).map(b => `${b.t} ${b.w}×${b.h}`));
      found.forEach(f => small.push(`${id}: ${f}`));
    }
  }
  expect(small).toEqual([]);
});
