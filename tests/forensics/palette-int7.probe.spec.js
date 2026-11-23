// EXT20 forensic probe for INT-7 (not part of npm test): where does a palette
// keystroke spend its time with 10,000 records in the search index?
// Same set-up as search-palette.spec.js "10,000 records". Measures 25 rounds of
// the same five keystrokes and takes a CPU profile of them, so the time can be
// split into search, rendering, layout and garbage collection.
// Run: npx playwright test -c tests/forensics/probe.config.js palette-int7 --project=desktop
//   PAL_THROTTLE=4   slows the browser CPU 4x (controlled contention)
//   PAL_OUT=file     writes the numbers as JSON
//   add --repeat-each=4 --workers=4 for four browsers at once
// Results and conclusions: docs/ops/INTERMITTENT_FORENSICS_EXT20.md
const fs = require('fs');
const { test, expect, login, gotoPage } = require('../helpers/dashboard');

test('INT-7: palette keystroke time distribution and profile', async ({ page, backend }, ti) => {
  test.skip(ti.project.name !== 'desktop', 'once');
  test.setTimeout(300000);
  backend.tables.products = Array.from({ length: 10000 }, (_, i) => ({ id: 'p-' + i, name: 'SYNTHETIC scale product ' + i, sku: 'SC-' + i, is_active: true, status: 'active', cost: null, retail_price: null, wholesale_price: null, packaging_info: null }));
  backend.tables.inventory = backend.tables.products.map(p => ({ product_id: p.id, available: 1, reserved: 0, damaged: 0, sample: 0, wholesale: 0, promotional: 0, returned: 0, recalled: 0, low_stock_threshold: null }));
  await login(page);
  await expect(page.locator('#inventoryWrap [data-product-id="p-9999"]')).toHaveCount(1, { timeout: 90000 });
  await gotoPage(page, 'inventoryPanel');
  await page.keyboard.press('ControlOrMeta+k');
  await expect(page.locator('#paletteInput')).toBeFocused();
  const cdp = await page.context().newCDPSession(page);
  const throttle = Number(process.env.PAL_THROTTLE || 1);
  if (throttle > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
  await cdp.send('Profiler.start');
  const times = await page.evaluate(() => {
    const input = document.getElementById('paletteInput');
    const out = [];
    for (let round = 0; round < 25; round++) {
      for (const q of ['s', 'sc', 'sca', 'scale', 'scale product 99']) {
        const t0 = performance.now();
        input.value = q; input.dispatchEvent(new Event('input', { bubbles: true }));
        out.push({ q, ms: performance.now() - t0 });
      }
    }
    return out;
  });
  const { profile } = await cdp.send('Profiler.stop');
  // Self time per function name.
  const self = {};
  const dt = profile.timeDeltas || [];
  const byId = new Map(profile.nodes.map(n => [n.id, n]));
  profile.samples.forEach((id, i) => {
    const n = byId.get(id);
    const name = n.callFrame.functionName || '(anonymous ' + (n.callFrame.url || '').split('/').pop() + ':' + n.callFrame.lineNumber + ')';
    self[name] = (self[name] || 0) + (dt[i] || 0) / 1000;
  });
  const top = Object.entries(self).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => [k, Math.round(v)]);
  const ms = times.map(t => t.ms).sort((a, b) => a - b);
  const pct = p => Math.round(ms[Math.min(ms.length - 1, Math.floor(p * ms.length))] * 10) / 10;
  const byQ = {};
  for (const t of times) (byQ[t.q] = byQ[t.q] || []).push(t.ms);
  const med = a => { const s = [...a].sort((x, y) => x - y); return Math.round(s[Math.floor(s.length / 2)] * 10) / 10; };
  const result = { throttle, n: ms.length, p50: pct(0.5), p90: pct(0.9), p99: pct(0.99), max: Math.round(ms[ms.length - 1] * 10) / 10,
    medianByQuery: Object.fromEntries(Object.entries(byQ).map(([q, a]) => [q, med(a)])), profileTopSelfMs: top,
    slowest: times.map((t, i) => [i, t.q, Math.round(t.ms)]).sort((a, b) => b[2] - a[2]).slice(0, 5) };
  console.log('INT7 ' + JSON.stringify(result));
  if (process.env.PAL_OUT) fs.writeFileSync(process.env.PAL_OUT, JSON.stringify(result, null, 1));
  expect(ms.length).toBe(125);
});
