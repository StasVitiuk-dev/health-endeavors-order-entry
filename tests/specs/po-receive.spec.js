// Purchase Orders page: "Receive delivery" when the connection drops halfway.
//
// Receiving a delivery is many separate writes from the browser (landed cost
// per line; per line: lot, inventory, inventory_adjustments, line received;
// then one expense and the purchase order status). Nothing makes them
// all-or-nothing, so a dropped connection can leave some of them saved and
// the rest not. Pressing Receive again then repeats the saved ones.
//
// These tests use synthetic data only; the mock answers every request.
//
// "current behaviour" tests pin down what happens today (they pass now and
// document the bug). "all-or-nothing" tests describe the behaviour we want;
// they are marked test.fail() so the suite stays green until the fix lands,
// and Playwright will report them as unexpectedly passing once it does.

const { test, expect, login, gotoPage } = require('../helpers/dashboard');

const PO_ID = 'po-synthetic-1';
const PRODUCT_A = 'prod-synthetic-a';
const PRODUCT_B = 'prod-synthetic-b';

// Adds purchase-order data to the mock and makes inserts/upserts on the
// receiving tables persist, so the test can read back what was saved. Also
// adds `dropNext(table, method, { applied })`: the next matching request
// fails like a dropped connection. With applied = true the database saves
// the write but the browser never hears back (the worst case).
function setUpReceiving(backend) {
  const items = [
    { id: 'poi-a', purchase_order_id: PO_ID, product_id: PRODUCT_A, description: 'SYNTHETIC product A', sku: 'SYN-A', quantity: 50, unit_cost: 2, quantity_received: 0, landed_unit_cost: null },
    { id: 'poi-b', purchase_order_id: PO_ID, product_id: PRODUCT_B, description: 'SYNTHETIC product B', sku: 'SYN-B', quantity: 20, unit_cost: 5, quantity_received: 0, landed_unit_cost: null },
  ];
  Object.assign(backend.tables, {
    products: [
      { id: PRODUCT_A, name: 'SYNTHETIC product A', sku: 'SYN-A' },
      { id: PRODUCT_B, name: 'SYNTHETIC product B', sku: 'SYN-B' },
    ],
    inventory: [
      { product_id: PRODUCT_A, available: 10 },
      { product_id: PRODUCT_B, available: 0 },
    ],
    inventory_adjustments: [],
    inventory_lots: [],
    expenses: [],
    purchase_order_items: items,
    // The embedded purchase_order_items are the same objects as the table
    // rows, so updates to a line show up when the order is reloaded.
    purchase_orders: [{
      id: PO_ID, po_number: 'PO-SYN-0001', status: 'shipped', currency: 'USD',
      shipping_cost: 15, tax: 5, expense_category: 'inventory',
      ordered_at: '2026-09-01T00:00:00Z', expected_at: '2026-09-20', received_at: null,
      payment_status: 'unpaid', notes: null, created_at: '2026-09-01T00:00:00Z',
      suppliers: { name: 'SYNTHETIC Supplier Co' },
      purchase_order_items: items,
    }],
  });

  const persisted = new Set(['inventory', 'inventory_adjustments', 'inventory_lots', 'expenses']);
  const drops = [];
  backend.dropNext = (table, method, { applied = false } = {}) => drops.push({ table, method, applied });

  const originalHandle = backend.handle.bind(backend);
  backend.handle = async route => {
    const req = route.request();
    const url = new URL(req.url());
    const table = url.pathname.startsWith('/rest/v1/') ? url.pathname.slice('/rest/v1/'.length) : null;
    const i = drops.findIndex(d => d.table === table && d.method === req.method());
    if (i === -1) return originalHandle(route);
    const drop = drops.splice(i, 1)[0];
    if (drop.applied) {
      // Save the write, then lose the reply.
      await originalHandle({ request: () => req, fulfill: async () => {} });
    } else {
      backend.requests.push({ method: req.method(), table, dropped: true });
    }
    return route.abort('connectionreset');
  };

  const originalRest = backend.handleRest.bind(backend);
  backend.handleRest = (route, entry) => {
    if (entry.method !== 'POST' || !persisted.has(entry.table)) return originalRest(route, entry);
    const rows = backend.tables[entry.table];
    const incoming = Array.isArray(entry.body) ? entry.body : [entry.body];
    const saved = incoming.map(body => {
      const conflict = new URLSearchParams(entry.query).get('on_conflict');
      const existing = conflict && rows.find(r => String(r[conflict]) === String(body[conflict]));
      if (existing) return Object.assign(existing, body);
      const row = { id: entry.table + '-' + (rows.length + 1), ...body };
      rows.push(row);
      return row;
    });
    const prefer = entry.headers['prefer'] || '';
    const wantsObject = (entry.headers['accept'] || '').includes('vnd.pgrst.object');
    const data = prefer.includes('return=representation') ? (wantsObject ? saved[0] : saved) : undefined;
    return route.fulfill({ status: 201, contentType: 'application/json', body: data === undefined ? '' : JSON.stringify(data) });
  };
}

function snapshot(backend) {
  const t = backend.tables;
  const inv = id => t.inventory.find(r => r.product_id === id).available;
  return {
    availableA: inv(PRODUCT_A),
    availableB: inv(PRODUCT_B),
    adjustments: t.inventory_adjustments.length,
    expenses: t.expenses.length,
    poStatus: t.purchase_orders[0].status,
  };
}

const BEFORE = { availableA: 10, availableB: 0, adjustments: 0, expenses: 0, poStatus: 'shipped' };
const AFTER_ONE_RECEIVE = { availableA: 60, availableB: 20, adjustments: 2, expenses: 1, poStatus: 'received' };

async function openPurchaseOrder(page) {
  await gotoPage(page, 'purchaseOrdersPanel');
  await page.locator(`.poItem[data-id="${PO_ID}"] .poRow`).click();
  // On a phone, tapping the row also opens the change-history overlay on top
  // of the order. Close it so the Receive button can be reached.
  const overlay = page.locator('#inspectorOverlay');
  if (await overlay.evaluate(el => el.classList.contains('open'))) await page.click('#insCloseBtn');
  await expect(overlay).not.toHaveClass(/open/);
  await expect(page.locator('.poReceiveBtn')).toBeVisible();
  await page.waitForLoadState('networkidle');
}

async function reloadAndReopen(page) {
  await page.reload();
  await expect(page.locator('#dash')).toBeVisible();
  await openPurchaseOrder(page);
}

async function clickReceive(page) {
  await page.locator('.poReceiveBtn').click();
}

async function expectReceiveError(page) {
  await expect(page.locator('body')).toContainText('Could not receive that delivery');
  await expect(page.locator('.poReceiveBtn')).toBeEnabled();
}

test.beforeEach(async ({ page, backend }) => {
  setUpReceiving(backend);
  await login(page);
  await openPurchaseOrder(page);
});

test('baseline: receiving with a good connection adds each line once', async ({ page, backend }) => {
  await clickReceive(page);
  await expect.poll(() => snapshot(backend).poStatus).toBe('received');
  expect(snapshot(backend)).toEqual(AFTER_ONE_RECEIVE);
});

test.describe('current behaviour (documents the bug)', () => {
  test('drop on the final status update: stock and expense saved, order still open', async ({ page, backend }) => {
    backend.dropNext('purchase_orders', 'PATCH');
    await clickReceive(page);
    await expectReceiveError(page);
    expect(snapshot(backend)).toEqual({ ...AFTER_ONE_RECEIVE, poStatus: 'shipped' });
  });

  test('...then pressing Receive again adds all stock and the expense a second time', async ({ page, backend }) => {
    backend.dropNext('purchase_orders', 'PATCH');
    await clickReceive(page);
    await expectReceiveError(page);
    await clickReceive(page);
    await expect.poll(() => snapshot(backend).poStatus).toBe('received');
    expect(snapshot(backend)).toEqual({ availableA: 110, availableB: 40, adjustments: 4, expenses: 2, poStatus: 'received' });
  });

  test('...even after reloading the page, the expense is logged twice', async ({ page, backend }) => {
    backend.dropNext('purchase_orders', 'PATCH');
    await clickReceive(page);
    await expectReceiveError(page);
    await reloadAndReopen(page);
    await clickReceive(page);
    await expect.poll(() => snapshot(backend).poStatus).toBe('received');
    expect(snapshot(backend)).toEqual({ ...AFTER_ONE_RECEIVE, expenses: 2 });
  });

  test('drop after the database saved line A\'s stock: stock raised with no adjustment record', async ({ page, backend }) => {
    // Line A's inventory write is saved but the reply is lost, so its
    // adjustment, "line received", line B, the expense and the status are
    // never written.
    backend.dropNext('inventory', 'POST', { applied: true });
    await clickReceive(page);
    await expectReceiveError(page);
    expect(snapshot(backend)).toEqual({ ...BEFORE, availableA: 60 });
    expect(backend.tables.purchase_order_items.map(l => l.quantity_received)).toEqual([0, 0]);
  });

  test('...then pressing Receive again after a reload adds line A\'s stock twice', async ({ page, backend }) => {
    backend.dropNext('inventory', 'POST', { applied: true });
    await clickReceive(page);
    await expectReceiveError(page);
    await reloadAndReopen(page);
    await clickReceive(page);
    await expect.poll(() => snapshot(backend).poStatus).toBe('received');
    expect(snapshot(backend)).toEqual({ ...AFTER_ONE_RECEIVE, availableA: 110 });
  });
});

test.describe('all-or-nothing (wanted behaviour; fails until fixed)', () => {
  test('a dropped connection leaves nothing half-saved', async ({ page, backend }) => {
    test.fail(true, 'Receiving is not atomic yet: see docs/code-quality/owner-login-review.md 2.1');
    backend.dropNext('purchase_orders', 'PATCH');
    await clickReceive(page);
    await expectReceiveError(page);
    expect(snapshot(backend)).toEqual(BEFORE);
  });

  test('pressing Receive again after a failure never double-counts', async ({ page, backend }) => {
    test.fail(true, 'Receiving is not atomic yet: see docs/code-quality/owner-login-review.md 2.1');
    backend.dropNext('inventory', 'POST', { applied: true });
    await clickReceive(page);
    await expectReceiveError(page);
    await clickReceive(page);
    await expect.poll(() => snapshot(backend).poStatus).toBe('received');
    expect(snapshot(backend)).toEqual(AFTER_ONE_RECEIVE);
  });
});
