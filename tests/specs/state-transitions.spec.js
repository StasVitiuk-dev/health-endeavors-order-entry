// Runtime state-machine matrix (2026-10-06, EXT3 workstream 2).
//
// For the three main workflows (tasks, returns, purchase orders):
//  1. each status shows exactly the expected next-step buttons, and none on
//     final statuses;
//  2. every button writes a status the database accepts (db-constraints.js)
//     and carries a condition on the status the page showed;
//  3. for every button, if another tab moved the record to ANY other status
//     first, the write succeeds only when that status is an allowed
//     starting point, and otherwise changes nothing and says so.
// Database-allowed values come from Query A (tests/helpers/db-constraints.js).
// The shared setup also fails any test whose state write carries no
// condition (STATE_COLUMNS in mock-supabase.js).

const { test, expect, login, gotoPage } = require('../helpers/dashboard');
const { ALLOWED } = require('../helpers/db-constraints');
const { enableWrites } = require('../helpers/stateful-backend');

test.use({ timezoneId: 'America/Chicago', locale: 'en-US' });
test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'state matrix; run once'); });

// ------------------------------------------------------------------ fixtures
const task = status => ({ id: 't-' + status, title: 'SYNTHETIC task ' + status, priority: 'normal', status, due_at: '2026-12-01T00:00:00Z' });
const ret = status => ({
  id: 'r-' + status, order_id: 'o1', order_item_id: 'oi1', reason: 'damaged', status, product_condition: 'resalable',
  disposition: ['received', 'refunded', 'closed'].includes(status) ? 'discard' : null, refund_amount: null, approved_at: null,
  received_at: null, refunded_at: null, notes: null, created_at: '2026-09-01T00:00:00Z',
  orders: { order_number: 'SYN-1', customer_name: 'SYNTHETIC Customer' },
  order_items: { product_name: 'SYNTHETIC product', sku: 'SYN-A', quantity: 1 },
});
const po = status => ({
  id: 'po-' + status, po_number: 'PO-' + status, supplier_id: 'sup-1', status, currency: 'USD', shipping_cost: 0, tax: 0,
  expense_category: 'packaging', ordered_at: null, expected_at: null, received_at: status === 'received' ? '2026-09-02T00:00:00Z' : null,
  payment_status: 'unpaid', notes: null, created_at: '2026-09-01T00:00:00Z', deleted_at: null,
  suppliers: { name: 'SYNTHETIC Supplier' }, purchase_order_items: [],
});

// ------------------------------------------------------- expected matrix
// [status] → the next-step buttons the page offers (label → target status).
const TASK_BUTTONS = { open: { 'Mark done': 'done', 'Mark in progress': 'in_progress' }, in_progress: { 'Mark done': 'done' } };
const TASK_FROM = { done: ['open', 'in_progress'], in_progress: ['open'] };

const RETURN_BUTTONS = {
  requested: { Approve: 'approved', Reject: 'rejected' },
  rejected: { Close: 'closed' }, received: { 'Close without refund': 'closed' }, refunded: { Close: 'closed' },
};
// "Close" from rejected/received/refunded is guarded by the exact status shown.
const RETURN_FROM = shown => ({ approved: ['requested'], rejected: ['requested'], closed: [shown] });

const PO_BUTTONS = {
  draft: { 'Mark as ordered': 'ordered', Cancel: 'cancelled' },
  ordered: { 'Mark as shipped': 'shipped', Cancel: 'cancelled' },
  shipped: { Cancel: 'cancelled' },
};
const PO_FROM = { ordered: ['draft'], shipped: ['ordered'], cancelled: ['draft', 'ordered', 'shipped'] };

test('the expected matrix only uses statuses the database accepts', () => {
  const check = (table, buttons, fromFn) => {
    for (const [from, map] of Object.entries(buttons)) {
      expect(ALLOWED[table].status).toContain(from);
      for (const to of Object.values(map)) {
        expect(ALLOWED[table].status).toContain(to);
        expect(fromFn(from)[to]).toContain(from);      // the shown status is an allowed start
        expect(fromFn(from)[to]).not.toContain(to);    // a step can never be applied twice
      }
    }
  };
  check('tasks', TASK_BUTTONS, () => TASK_FROM);
  check('returns', RETURN_BUTTONS, RETURN_FROM);
  check('purchase_orders', PO_BUTTONS, () => PO_FROM);
});

// ---------------------------------------------------------------- helpers
const statusWrites = (backend, table) => backend.requests.filter(r => r.table === table && r.method === 'PATCH');
const buttonsIn = async loc => (await loc.allTextContents()).map(t => t.trim()).sort();

async function openTasks(page, backend, rows) {
  backend.tables.tasks = rows;
  enableWrites(backend, ['tasks']);
  page.on('dialog', d => d.accept());
  await login(page);
  await gotoPage(page, 'tasksPanel');
  await page.waitForLoadState('networkidle');
}
async function openReturns(page, backend, rows) {
  backend.tables.returns = rows;
  enableWrites(backend, ['returns']);
  await login(page);
  await gotoPage(page, 'returnsPanel');
  await page.waitForLoadState('networkidle');
}
async function openPos(page, backend, rows) {
  Object.assign(backend.tables, {
    suppliers: [{ id: 'sup-1', name: 'SYNTHETIC Supplier', supplier_type: 'manufacturer', contact_name: null, email: null, phone: null, notes: null, is_active: true }],
    products: [], purchase_order_items: [], inventory_lots: [], purchase_orders: rows,
  });
  enableWrites(backend, ['purchase_orders']);
  await login(page);
  await gotoPage(page, 'purchaseOrdersPanel');
  await page.waitForLoadState('networkidle');
}
async function openPoDetail(page, id) {
  await page.locator(`.poItem[data-id="${id}"] .poRow`).click();
  const overlay = page.locator('#inspectorOverlay');
  if (await overlay.evaluate(el => el.classList.contains('open'))) await page.click('#insCloseBtn');
  const box = page.locator(`#poDetail_${id}`);
  await expect(box).toBeVisible();
  return box;
}

// ------------------------------------------------------- 1. buttons per status
test('tasks: each status offers exactly the expected buttons (closed tasks are not listed)', async ({ page, backend }) => {
  await openTasks(page, backend, ALLOWED.tasks.status.map(task));
  for (const s of ALLOWED.tasks.status) {
    const row = page.locator(`#tasksTableWrap tr[data-id="t-${s}"]`);
    if (!TASK_BUTTONS[s]) { await expect(row).toHaveCount(0); continue; }
    expect(await buttonsIn(row.locator('.taskStatusBtn'))).toEqual(Object.keys(TASK_BUTTONS[s]).sort());
  }
});

test('returns: each status offers exactly the expected buttons; approved offers only Mark Received', async ({ page, backend }) => {
  await openReturns(page, backend, ALLOWED.returns.status.map(ret));
  for (const s of ALLOWED.returns.status) {
    const row = page.locator(`#returnsWrap [data-return-id="r-${s}"]`);
    const btns = await buttonsIn(row.locator('.decideReturnBtn, .advanceReturnBtn'));
    expect(btns, s).toEqual(Object.keys(RETURN_BUTTONS[s] || {}).sort());
    await expect(row.locator('.markReceivedBtn')).toHaveCount(s === 'approved' ? 1 : 0);
    await expect(row.locator('.markRefundedBtn')).toHaveCount(s === 'received' ? 1 : 0);
  }
});

test('purchase orders: each status offers exactly the expected buttons; Receive only from ordered/shipped', async ({ page, backend }) => {
  await openPos(page, backend, ALLOWED.purchase_orders.status.map(po));
  for (const s of ALLOWED.purchase_orders.status) {
    const box = await openPoDetail(page, 'po-' + s);
    expect(await buttonsIn(box.locator('.poStatusBtn')), s).toEqual(Object.keys(PO_BUTTONS[s] || {}).sort());
    await expect(box.locator('.poReceiveBtn')).toHaveCount(['ordered', 'shipped'].includes(s) ? 1 : 0);
  }
});

// --------------------------------------- 2+3. every button, every stale status
for (const [from, map] of Object.entries(TASK_BUTTONS)) {
  for (const [label, to] of Object.entries(map)) {
    for (const actual of ALLOWED.tasks.status) {
      test(`task "${label}" shown as ${from}, actually ${actual}`, async ({ page, backend }) => {
        await openTasks(page, backend, [task(from)]);
        backend.tables.tasks[0].status = actual; // another tab or an agent moved it
        await page.locator(`#tasksTableWrap tr[data-id="t-${from}"] .taskStatusBtn`, { hasText: label }).click();
        await expect.poll(() => statusWrites(backend, 'tasks').length).toBe(1);
        const ok = TASK_FROM[to].includes(actual);
        expect(backend.tables.tasks[0].status).toBe(ok ? to : actual);
        if (!ok) await expect(page.locator('#dashError')).toContainText('already changed');
      });
    }
  }
}

for (const [from, map] of Object.entries(RETURN_BUTTONS)) {
  for (const [label, to] of Object.entries(map)) {
    for (const actual of ALLOWED.returns.status) {
      test(`return "${label}" shown as ${from}, actually ${actual}`, async ({ page, backend }) => {
        await openReturns(page, backend, [ret(from)]);
        backend.tables.returns[0].status = actual;
        await page.locator(`#returnsWrap [data-return-id="r-${from}"] button`, { hasText: new RegExp('^' + label + '$') }).click();
        await expect.poll(() => statusWrites(backend, 'returns').length).toBe(1);
        const ok = RETURN_FROM(from)[to].includes(actual);
        expect(backend.tables.returns[0].status).toBe(ok ? to : actual);
        if (!ok) await expect(page.locator('#dashError')).toContainText('already changed');
      });
    }
  }
}

for (const [from, map] of Object.entries(PO_BUTTONS)) {
  for (const [label, to] of Object.entries(map)) {
    for (const actual of ALLOWED.purchase_orders.status) {
      test(`purchase order "${label}" shown as ${from}, actually ${actual}`, async ({ page, backend }) => {
        await openPos(page, backend, [po(from)]);
        const box = await openPoDetail(page, 'po-' + from);
        backend.tables.purchase_orders[0].status = actual;
        const btn = box.locator('.poStatusBtn', { hasText: label });
        await btn.click();
        if (to === 'cancelled') await btn.click(); // second press confirms
        await expect.poll(() => statusWrites(backend, 'purchase_orders').length).toBe(1);
        const ok = PO_FROM[to].includes(actual);
        expect(backend.tables.purchase_orders[0].status).toBe(ok ? to : actual);
        if (!ok) await expect(page.locator('#dashError')).toContainText('already changed');
      });
    }
  }
}
