// EXT6 (workstream 9): several operators acting on the same record at the
// same moment. 2, 5 and 10 browser tabs share one synthetic backend (the mock
// serves the whole browser context), each opens the record, then all press
// at once. Expected for a guarded workflow step:
//   * exactly one change is applied (no lost update, no double step)
//   * every other operator is told it was already changed (stale-write
//     rejection), and nobody sees a false success
// Honest limit: the mock applies one request at a time, like a database row
// lock would; it proves the PAGE sends a condition and reports the result
// truthfully. Database-level concurrency is proven separately on PostgreSQL
// (docs/ops/sql/local-test/stress_test.sh, po_*_races.sh).

const { test, expect, login, gotoPage } = require('../helpers/dashboard');
const { enableWrites } = require('../helpers/stateful-backend');

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'concurrency logic; run once'); });

const STALE = 'already changed';

async function operators(page, context, n, panel) {
  await login(page);
  const pages = [page];
  for (let i = 1; i < n; i++) {
    const p = await context.newPage();
    await p.goto('/owner-login.html'); // same browser: already signed in
    await expect(p.locator('#dash')).toBeVisible();
    pages.push(p);
  }
  for (const p of pages) {
    p.on('dialog', d => d.accept());
    await gotoPage(p, panel);
  }
  return pages;
}

for (const n of [2, 5, 10]) {
  test(`${n} operators press "Mark in progress" on one task at once: one change, ${n - 1} told it already changed`, async ({ page, context, backend }) => {
    test.setTimeout(180000);
    backend.tables.tasks = [{ id: 't1', title: 'SYNTHETIC shared task', priority: 'normal', status: 'open', due_at: '2026-12-01T00:00:00Z' }];
    enableWrites(backend, ['tasks']);
    const pages = await operators(page, context, n, 'tasksPanel');
    const btn = p => p.locator('#tasksTableWrap tr[data-id="t1"] .taskStatusBtn', { hasText: 'Mark in progress' });
    for (const p of pages) await expect(btn(p)).toBeVisible();
    await Promise.all(pages.map(p => btn(p).click()));
    await expect.poll(() => backend.tables.tasks[0].status).toBe('in_progress');
    // every operator gets an answer: told it changed elsewhere, or it worked
    await expect.poll(async () => (await Promise.all(pages.map(p => p.locator('#dashError').textContent()))).filter(t => (t || '').includes(STALE)).length, { timeout: 20000 }).toBe(n - 1);
    const okPages = (await Promise.all(pages.map(p => p.locator('#dashError').isVisible()))).filter(v => !v).length;
    expect(okPages, 'exactly one operator saw no error').toBe(1);
    const patches = backend.requests.filter(r => r.table === 'tasks' && r.method === 'PATCH');
    expect(patches).toHaveLength(n); // each sent one request, each with the "only if still open" condition
    expect(patches.every(r => r.params.some(([k, v]) => k === 'status' && /open/.test(v)))).toBe(true);
  });
}

for (const n of [2, 5, 10]) {
  test(`${n} operators split between Approve and Reject on one return: one decision recorded, the rest told`, async ({ page, context, backend }) => {
    test.setTimeout(180000);
    backend.tables.returns = [{
      id: 'r1', order_id: 'o1', order_item_id: 'oi1', reason: 'damaged', status: 'requested', product_condition: 'resalable', disposition: null,
      refund_amount: null, approved_at: null, received_at: null, refunded_at: null, notes: null, created_at: '2026-09-01T00:00:00Z',
      orders: { order_number: 'SYN-1', customer_name: 'SYNTHETIC Customer' }, order_items: { product_name: 'SYNTHETIC product', sku: 'SYN-A', quantity: 1 },
    }];
    enableWrites(backend, ['returns']);
    const pages = await operators(page, context, n, 'returnsPanel');
    for (const p of pages) {
      const overlay = p.locator('#inspectorOverlay');
      if (await overlay.evaluate(el => el.classList.contains('open'))) await p.click('#insCloseBtn');
    }
    const btn = (p, label) => p.locator('#returnsWrap [data-return-id="r1"] button', { hasText: new RegExp('^' + label + '$') });
    await Promise.all(pages.map((p, i) => btn(p, i % 2 ? 'Reject' : 'Approve').click()));
    await expect.poll(() => backend.tables.returns[0].status).not.toBe('requested');
    const final = backend.tables.returns[0].status;
    expect(['approved', 'rejected']).toContain(final);
    await expect.poll(async () => (await Promise.all(pages.map(p => p.locator('#dashError').textContent()))).filter(t => (t || '').includes(STALE)).length, { timeout: 20000 }).toBe(n - 1);
    // the decision is recorded once: never approved and then rejected (or back)
    const writesThatChanged = backend.requests.filter(r => r.table === 'returns' && r.method === 'PATCH');
    expect(writesThatChanged).toHaveLength(n);
    expect(writesThatChanged.every(r => r.params.some(([k, v]) => k === 'status' && /requested/.test(v)))).toBe(true);
  });
}
