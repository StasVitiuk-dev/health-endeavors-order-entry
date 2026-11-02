// EXT17: high-risk and long UI chaos. The busy-operator mix of chaos-ui-ext15
// plus manual stock adjustments with lost replies and an impatient second
// press. Extra invariant: one adjustment moves the stock by 0 or by its amount,
// never twice. A short run is part of the normal suite; the 250 / 500 / 1,000
// step runs are opt-in (CHAOS_LONG=1) because each takes many minutes.
const { test, expect, login } = require('../helpers/dashboard');
const { enableWrites } = require('../helpers/stateful-backend');
const { genOps, runOps, freshSignIn } = require('../helpers/chaos');
const { shrink, describe } = require('../helpers/shrink');

function seedStock(backend) {
  const inv = { id: 'inv-chaos', product_id: 'prod-chaos', available: 500, reserved: 0, damaged: 0, sample: 0, wholesale: 0, promotional: 0, returned: 0, recalled: 0, low_stock_threshold: null };
  backend.tables.products = (backend.tables.products || []).filter(p => p.id !== 'prod-chaos').concat([{ id: 'prod-chaos', name: 'SYNTHETIC chaos product', sku: 'SYN-CHAOS', is_active: true, status: 'active', cost: 1, retail_price: 2, wholesale_price: 1, packaging_info: null, updated_at: '2026-09-01T00:00:00Z', inventory: inv, inventory_lots: [] }]);
  backend.tables.inventory = (backend.tables.inventory || []).filter(r => r.product_id !== 'prod-chaos').concat([inv]);
  backend.tables.inventory_adjustments = backend.tables.inventory_adjustments || [];
  enableWrites(backend, ['inventory', 'inventory_adjustments']);
}

const RUNS = [[1711, 40, false]].concat(process.env.CHAOS_LONG ? [[1712, 250, true], [1713, 500, true], [1714, 1000, true]] : []);

for (const [seed, steps, long] of RUNS) {
  test(`high-risk UI chaos seed ${seed}: ${steps} steps (incl. adjustments with lost replies) keep every invariant`, async ({ page, backend, context }, ti) => {
    test.skip(ti.project.name !== 'desktop', 'desktop runs the high-risk mix');
    test.setTimeout(long ? steps * 6000 : 600000);
    page.setDefaultTimeout(30000);
    seedStock(backend);
    const startRows = JSON.parse(JSON.stringify(backend.tables));
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await login(page);
    const ids = await page.locator('#sidebarGroups .sidebarLink[data-page]').evaluateAll(els => [...new Set(els.map(e => e.getAttribute('data-page')))]);
    const ops = genOps(seed, steps, ids, { highRisk: true });
    const t0 = Date.now();
    const fail = await runOps(page, backend, context, ops, false, errors);
    if (fail) {
      const replay = async cand => {
        backend.tables = JSON.parse(JSON.stringify(startRows)); errors.length = 0;
        await context.setOffline(false); await page.setViewportSize({ width: 1280, height: 800 });
        await freshSignIn(page);
        return !!(await runOps(page, backend, context, cand, false, errors));
      };
      const small = await shrink(ops.slice(0, fail.step + 1), replay, { maxRuns: 25, maxMs: 300000 });
      throw new Error(`high-risk chaos seed ${seed} failed at step ${fail.step} (${fail.message}).\n`
        + `Smallest failing sequence found (${small.ops.length} of ${fail.step + 1} steps, ${small.runs} replays${small.complete ? '' : ', budget reached'}): ${describe(small.ops)}`);
    }
    expect(errors).toEqual([]);
    // End-of-run total: the stock is exactly the start plus every adjustment that
    // should have landed (a lost reply that WAS saved counts once, never twice).
    await page.waitForLoadState('networkidle');
    const expected = 500 + ops.filter(o => o.op === 'adjust' && o.mode !== 'lostUnsaved').reduce((a, o) => a + o.amount, 0);
    expect(backend.tables.inventory.find(r => r.product_id === 'prod-chaos').available, 'stock = start + each landed adjustment once').toBe(expected);
    const adjusts = ops.filter(o => o.op === 'adjust');
    ti.annotations.push({ type: 'chaos', description: `seed ${seed}: ${steps} steps in ${Math.round((Date.now() - t0) / 1000)} s; ${adjusts.length} adjustments (${adjusts.filter(o => o.mode !== 'ok').length} with a lost reply)` });
  });
}
