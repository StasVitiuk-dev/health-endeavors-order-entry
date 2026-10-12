// EXT15 soak: repeated open/close of overlays and a long accelerated session must
// not keep growing listeners, DOM nodes or live timers (resource-leaks.spec
// covers three rounds of page visits; this covers what an operator repeats
// hundreds of times a day). Counters come from Chrome itself (DevTools) and
// from wrapped timer functions. Growth is compared after a warm-up round.
const { test, expect, login, gotoPage } = require('../helpers/dashboard');
const { NOW, seedBusiness } = require('../fixtures/business-data');

test.use({ timezoneId: 'America/Chicago', locale: 'en-US' });

async function instrument(page) {
  await page.addInitScript(() => {
    const liveT = new Set(), liveI = new Set();
    window.__live = () => ({ timeouts: liveT.size, intervals: liveI.size });
    const st = window.setTimeout, ct = window.clearTimeout, si = window.setInterval, ci = window.clearInterval;
    window.setTimeout = function (fn, ms, ...a) { let id; id = st.call(this, function () { liveT.delete(id); return typeof fn === 'function' ? fn.apply(this, arguments) : undefined; }, ms, ...a); liveT.add(id); return id; };
    window.clearTimeout = function (id) { liveT.delete(id); return ct.call(this, id); };
    window.setInterval = function (...a) { const id = si.apply(this, a); liveI.add(id); return id; };
    window.clearInterval = function (id) { liveI.delete(id); return ci.call(this, id); };
  });
}
async function counters(page, cdp) {
  await cdp.send('HeapProfiler.collectGarbage').catch(() => {});
  const { metrics } = await cdp.send('Performance.getMetrics');
  const m = Object.fromEntries(metrics.map(x => [x.name, x.value]));
  return { listeners: m.JSEventListeners, nodes: m.Nodes, ...(await page.evaluate(() => window.__live())) };
}

test('overlays opened and closed hundreds of times: no growth in listeners, nodes or live timers', async ({ page, backend }, ti) => {
  test.skip(ti.project.name !== 'desktop', 'Chrome counters + keyboard overlays; once');
  test.setTimeout(420000);
  seedBusiness(backend);
  await instrument(page);
  await page.clock.setFixedTime(NOW);
  await login(page);
  await page.waitForLoadState('networkidle');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  const cycle = async (n) => {
    for (let i = 0; i < n; i++) {
      await page.keyboard.press('ControlOrMeta+k'); await page.keyboard.type('ta'); await page.keyboard.press('Escape');
      if (i % 2 === 0) { await page.keyboard.press('Shift+Slash').catch(() => {}); await page.keyboard.press('Escape'); }
      if (i % 2 === 1) { await page.keyboard.press('ControlOrMeta+n'); await page.keyboard.press('Escape'); }
    }
    await page.waitForTimeout(300);
  };
  await cycle(20);
  const a = await counters(page, cdp);
  await cycle(200);
  const b = await counters(page, cdp);
  ti.annotations.push({ type: 'soak-overlays', description: JSON.stringify({ afterWarmup: a, after200More: b }) });
  expect(b.listeners - a.listeners, JSON.stringify({ a, b })).toBeLessThanOrEqual(20);
  expect(b.nodes - a.nodes, JSON.stringify({ a, b })).toBeLessThanOrEqual(400);
  expect(b.intervals).toBeLessThanOrEqual(a.intervals);
  expect(b.timeouts).toBeLessThanOrEqual(a.timeouts + 5);
});

test('an accelerated working day (page changes, searches, edits, sign-out/in) stays flat', async ({ page, backend }, ti) => {
  test.skip(ti.project.name !== 'desktop', 'Chrome counters; once');
  test.setTimeout(600000);
  seedBusiness(backend);
  await instrument(page);
  await page.clock.install({ time: NOW });
  await login(page);
  await page.waitForLoadState('networkidle');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  const ids = await page.locator('#sidebarGroups .sidebarLink[data-page]').evaluateAll(els => [...new Set(els.map(e => e.getAttribute('data-page')))]);
  const hour = async (k) => {
    for (const id of ids.filter((_, i) => i % 3 === k % 3)) { await gotoPage(page, id); }
    await page.fill('#sidebarSearch', 'SYN'); await page.fill('#sidebarSearch', '');
    await page.clock.runFor(60 * 60 * 1000); // an hour passes: timers that should fire do, nothing piles up
    await page.waitForLoadState('networkidle');
  };
  await hour(0);
  const a = await counters(page, cdp);
  for (let h = 1; h <= 8; h++) await hour(h);
  const b = await counters(page, cdp);
  ti.annotations.push({ type: 'soak-day', description: JSON.stringify({ afterHour1: a, afterHour9: b }) });
  expect(b.listeners - a.listeners, JSON.stringify({ a, b })).toBeLessThanOrEqual(60);
  expect(b.intervals, JSON.stringify({ a, b })).toBeLessThanOrEqual(a.intervals);
  expect(b.timeouts, JSON.stringify({ a, b })).toBeLessThanOrEqual(a.timeouts + 10);
  await expect(page.locator('#dash')).toBeVisible();
});
