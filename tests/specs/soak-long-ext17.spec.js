// EXT17: long real-time operator soak (opt-in: SOAK_MINUTES=<n>, e.g. 60).
// The high-risk chaos mix (page changes, Back/Forward, palette, search, resize,
// offline, double clicks, slow replies, stock adjustments with lost replies)
// runs for n minutes of real time in one signed-in page. Every 5 minutes the
// page's event listeners, DOM nodes, live timers and JS heap are sampled; after
// a warm-up sample, nothing may keep growing, every invariant of the chaos
// runner must hold, and the stock must equal the start plus each landed
// adjustment exactly once.
const { test, expect, login } = require('../helpers/dashboard');
const { enableWrites } = require('../helpers/stateful-backend');
const { genOps, runOps } = require('../helpers/chaos');

const MINUTES = Number(process.env.SOAK_MINUTES || 0);

test('long operator soak: no growth in listeners, nodes, timers or memory; every invariant holds', async ({ page, backend, context }, ti) => {
  test.skip(!MINUTES || ti.project.name !== 'desktop', 'opt-in: SOAK_MINUTES=<n> (desktop)');
  test.setTimeout((MINUTES + 15) * 60000);
  page.setDefaultTimeout(30000);
  const inv = { id: 'inv-soak', product_id: 'prod-soak', available: 5000, reserved: 0, damaged: 0, sample: 0, wholesale: 0, promotional: 0, returned: 0, recalled: 0, low_stock_threshold: null };
  backend.tables.products = (backend.tables.products || []).concat([{ id: 'prod-soak', name: 'SYNTHETIC soak product', sku: 'SYN-SOAK', is_active: true, status: 'active', cost: 1, retail_price: 2, wholesale_price: 1, packaging_info: null, updated_at: '2026-09-01T00:00:00Z', inventory: inv, inventory_lots: [] }]);
  backend.tables.inventory = (backend.tables.inventory || []).concat([inv]);
  backend.tables.inventory_adjustments = [];
  enableWrites(backend, ['inventory', 'inventory_adjustments']);
  await page.addInitScript(() => {
    const liveT = new Set(), liveI = new Set();
    window.__live = () => ({ timeouts: liveT.size, intervals: liveI.size });
    const st = window.setTimeout, ct = window.clearTimeout, si = window.setInterval, ci = window.clearInterval;
    window.setTimeout = function (fn, ms, ...a) { let id; id = st.call(this, function () { liveT.delete(id); return typeof fn === 'function' ? fn.apply(this, arguments) : undefined; }, ms, ...a); liveT.add(id); return id; };
    window.clearTimeout = function (id) { liveT.delete(id); return ct.call(this, id); };
    window.setInterval = function (...a) { const id = si.apply(this, a); liveI.add(id); return id; };
    window.clearInterval = function (id) { liveI.delete(id); return ci.call(this, id); };
  });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await login(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  const sample = async () => {
    await page.waitForLoadState('networkidle');
    await cdp.send('HeapProfiler.collectGarbage').catch(() => {});
    const { metrics } = await cdp.send('Performance.getMetrics');
    const m = Object.fromEntries(metrics.map(x => [x.name, x.value]));
    return { t: Math.round((Date.now() - t0) / 60000), listeners: m.JSEventListeners, nodes: m.Nodes, heapMB: Math.round(m.JSHeapUsedSize / 1048576 * 10) / 10, ...(await page.evaluate(() => window.__live())) };
  };
  const ids = await page.locator('#sidebarGroups .sidebarLink[data-page]').evaluateAll(els => [...new Set(els.map(e => e.getAttribute('data-page')))]);
  const t0 = Date.now(); const samples = []; let chunk = 0, steps = 0, expected = 5000, adjusts = 0;
  let next = t0 + 5 * 60000;
  while (Date.now() - t0 < MINUTES * 60000) {
    const ops = genOps(17500 + chunk++, 25, ids, { highRisk: true });
    const fail = await runOps(page, backend, context, ops, false, errors);
    if (fail) throw new Error(`soak chunk ${chunk - 1} failed at step ${fail.step} (${fail.message}) after ${Math.round((Date.now() - t0) / 60000)} min`);
    steps += ops.length;
    for (const o of ops) if (o.op === 'adjust') { adjusts++; if (o.mode !== 'lostUnsaved') expected += o.amount; }
    if (Date.now() >= next || !samples.length) { samples.push(await sample()); next += 5 * 60000; }
  }
  samples.push(await sample());
  const base = samples[1] || samples[0], last = samples[samples.length - 1];
  ti.annotations.push({ type: 'soak', description: JSON.stringify({ minutes: MINUTES, steps, adjusts, samples }) });
  console.log('SOAK ' + JSON.stringify({ minutes: MINUTES, steps, adjusts, first: samples[0], base, last }));
  expect(errors).toEqual([]);
  expect(backend.tables.inventory.find(r => r.product_id === 'prod-soak').available, 'stock = start + each landed adjustment once').toBe(expected);
  expect(last.listeners - base.listeners, JSON.stringify(samples)).toBeLessThanOrEqual(80);
  expect(last.intervals, JSON.stringify(samples)).toBeLessThanOrEqual(base.intervals);
  expect(last.timeouts, JSON.stringify(samples)).toBeLessThanOrEqual(base.timeouts + 10);
  expect(last.heapMB, JSON.stringify(samples)).toBeLessThanOrEqual(base.heapMB * 1.5 + 5);
  expect(last.nodes, JSON.stringify(samples)).toBeLessThanOrEqual(base.nodes * 1.5 + 2000);
});
