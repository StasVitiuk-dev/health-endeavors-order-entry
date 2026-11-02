// EXT9 (workstreams 41/43): every page at common phone and tablet widths, and
// at 320 px with text at 200%: the page itself never scrolls sideways (wide
// tables may scroll inside their own box, X7-15). Synthetic data only.
const { test, expect, login, gotoPage } = require('../helpers/dashboard');

const PANELS = ['attentionPanel', 'dailySummaryPanel', 'reportHistoryPanel', 'calendarPanel', 'ordersPanel', 'inventoryPanel', 'returnsPanel',
  'suppliersPanel', 'purchaseOrdersPanel', 'qualityControlPanel', 'expensesPanel', 'accountingPanel', 'taxRecordsPanel', 'tasksPanel',
  'incidentsPanel', 'evidenceLockerPanel', 'approvalsPanel', 'inquiriesPanel', 'recallsPanel', 'adverseEventsPanel', 'legalHoldsPanel',
  'documentsPanel', 'sopsPanel', 'aiPanel', 'flagsPanel', 'businessRulesPanel', 'continuityPanel', 'sessionsPanel', 'featureRequestsPanel', 'activityPanel'];
const SIZES = [{ w: 320, zoom: 1 }, { w: 360, zoom: 1 }, { w: 414, zoom: 1 }, { w: 768, zoom: 1 }, { w: 320, zoom: 2 }];

test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'iphone', 'sets its own viewport; run once'); });

for (const sz of SIZES) {
  test(`${sz.w} px${sz.zoom > 1 ? ' at ' + sz.zoom * 100 + '% text' : ''}: no page scrolls sideways`, async ({ page }) => {
    test.setTimeout(240000);
    await page.setViewportSize({ width: sz.w, height: 800 });
    await login(page);
    // EXT15: style-src 'self' blocks an injected <style>; a constructed stylesheet (CSSOM) is allowed
    if (sz.zoom > 1) await page.evaluate(z => { const s = new CSSStyleSheet(); s.replaceSync(`html { font-size: ${z * 100}% !important; }`); document.adoptedStyleSheets = [...document.adoptedStyleSheets, s]; }, sz.zoom);
    const bad = [];
    for (const id of PANELS) {
      await gotoPage(page, id);
      await page.waitForTimeout(150);
      const over = await page.evaluate(() => {
        const el = document.scrollingElement;
        return el.scrollWidth - el.clientWidth;
      });
      if (over > 1) bad.push(id + ' +' + over + 'px');
    }
    expect(bad).toEqual([]);
  });
}
