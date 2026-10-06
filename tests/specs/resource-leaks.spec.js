// Browser resource leaks (2026-10-06, extension 4, workstream AH). The
// dashboard is a single page left open all day: moving between pages must not
// keep adding event listeners, DOM nodes or timers. Measured with Chrome's
// own counters (DevTools protocol) after warming up once, then after three
// more full rounds through every page.

const { test, expect, login, gotoPage } = require('../helpers/dashboard');
const { NOW, seedBusiness } = require('../fixtures/business-data');

test.use({ timezoneId: 'America/Chicago', locale: 'en-US' });

test('visiting every page three more times does not keep growing listeners, nodes or timers', async ({ page, backend }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Chrome counters; run once');
  test.setTimeout(300000);
  seedBusiness(backend);
  await page.clock.setFixedTime(NOW);
  await page.addInitScript(() => {
    // count live intervals (a page that re-creates its refresh timer on every
    // visit would grow this number)
    const live = new Set(); window.__liveIntervals = live;
    const si = window.setInterval, ci = window.clearInterval;
    window.setInterval = function (...a) { const id = si.apply(this, a); live.add(id); return id; };
    window.clearInterval = function (id) { live.delete(id); return ci.call(this, id); };
  });
  await login(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  const ids = await page.locator('#sidebarGroups .sidebarLink[data-page]').evaluateAll(els => [...new Set(els.map(e => e.getAttribute('data-page')))]);
  const round = async () => { for (const id of ids) { await gotoPage(page, id); await page.waitForLoadState('networkidle'); } await gotoPage(page, ids[0]); await page.waitForLoadState('networkidle'); };
  const measure = async () => {
    await cdp.send('HeapProfiler.collectGarbage').catch(() => {});
    const { metrics } = await cdp.send('Performance.getMetrics');
    const m = Object.fromEntries(metrics.map(x => [x.name, x.value]));
    return { listeners: m.JSEventListeners, nodes: m.Nodes, intervals: await page.evaluate(() => window.__liveIntervals.size) };
  };
  await round();
  const a = await measure();
  await round(); await round(); await round();
  const b = await measure();
  testInfo.annotations.push({ type: 'leak-counters', description: JSON.stringify({ after1: a, after4: b }) });
  expect(b.intervals, 'timers').toBeLessThanOrEqual(a.intervals);
  expect(b.listeners, 'event listeners').toBeLessThan(a.listeners * 1.15 + 50);
  expect(b.nodes, 'DOM nodes').toBeLessThan(a.nodes * 1.15 + 500);
});
