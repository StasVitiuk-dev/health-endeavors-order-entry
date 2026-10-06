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
      shipping_cost: 15, tax: 5, expense_category: 'packaging',
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
  // second, deliberate press (receiving adds stock and logs the expense)
  await page.locator('.poReceiveBtn').click();
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
  await expect.poll(() => snapshot(backend)).toEqual(AFTER_ONE_RECEIVE);
});

// Since the 2026-10-05 change the order is "claimed" first: it is marked
// Received only if it is still Ordered/Shipped, and only then is the stock and
// expense written. That removes every double-count path from the browser. It
// is still not all-or-nothing (that needs the R1 database function), so a drop
// part-way leaves the order Received with some work missing — but the page
// says exactly what, and never invites a second Receive.
test.describe('claim-first receiving (current behaviour)', () => {
  test('drop on the claim: nothing is saved, and trying again receives once', async ({ page, backend }) => {
    backend.dropNext('purchase_orders', 'PATCH');
    await clickReceive(page);
    await expectReceiveError(page);
    await expect(page.locator('body')).toContainText('Nothing was changed, so it is safe to try again');
    expect(snapshot(backend)).toEqual(BEFORE);
    await clickReceive(page);
    await expect.poll(() => snapshot(backend)).toEqual(AFTER_ONE_RECEIVE);
  });

  test('claim saved but its reply lost: the page recognises its own claim and finishes once', async ({ page, backend }) => {
    backend.dropNext('purchase_orders', 'PATCH', { applied: true });
    await clickReceive(page);
    await expect.poll(() => snapshot(backend)).toEqual(AFTER_ONE_RECEIVE);
    await expect(page.locator('.poReceiveBtn')).toHaveCount(0);
  });

  test('a second click, a second tab or a stale page adds nothing', async ({ page, backend }) => {
    await clickReceive(page);
    await expect.poll(() => snapshot(backend)).toEqual(AFTER_ONE_RECEIVE);
    // A page that still shows the order as Shipped (opened before the receive):
    backend.tables.purchase_orders[0].status = 'shipped';
    await reloadAndReopen(page);
    backend.tables.purchase_orders[0].status = 'received';
    await clickReceive(page);
    await expect(page.locator('body')).toContainText('already changed');
    expect(snapshot(backend)).toEqual(AFTER_ONE_RECEIVE);
  });

  test('drop after the database saved line A\'s stock: order Received, the page names the uncertain line, and no Receive button', async ({ page, backend }) => {
    backend.dropNext('inventory', 'PATCH', { applied: true });
    await clickReceive(page);
    await expect(page.locator('body')).toContainText('is marked Received, but the work stopped part-way');
    await expect(page.locator('body')).toContainText('SYNTHETIC product A');
    await expect(page.locator('body')).toContainText('expense NOT logged');
    expect(snapshot(backend)).toEqual({ ...BEFORE, availableA: 60, poStatus: 'received' });
    await expect(page.locator('.poReceiveBtn')).toHaveCount(0);
  });

  test('...and after a reload there is still no way to receive it a second time', async ({ page, backend }) => {
    backend.dropNext('inventory', 'PATCH', { applied: true });
    await clickReceive(page);
    await expect(page.locator('body')).toContainText('stopped part-way');
    await page.reload();
    await expect(page.locator('#dash')).toBeVisible();
    await gotoPage(page, 'purchaseOrdersPanel');
    await page.locator(`.poItem[data-id="${PO_ID}"] .poRow`).click();
    const overlay = page.locator('#inspectorOverlay');
    if (await overlay.evaluate(el => el.classList.contains('open'))) await page.click('#insCloseBtn');
    await expect(page.locator(`#poDetail_${PO_ID}`)).toContainText('Received');
    await expect(page.locator('.poReceiveBtn')).toHaveCount(0);
    expect(snapshot(backend).availableA).toBe(60);
  });
});

test.describe('all-or-nothing (wanted behaviour; needs the R1 database function)', () => {
  test('a dropped connection part-way leaves nothing half-saved', async ({ page, backend }) => {
    test.fail(true, 'Receiving is not atomic yet: needs receive_purchase_order (R1), drafted and tested; waits for Query C, owner approval and install (docs/ops/R1-R5-INSTALL-RUNBOOK.md)');
    backend.dropNext('inventory', 'PATCH', { applied: true });
    await clickReceive(page);
    await expect(page.locator('body')).toContainText('stopped part-way');
    expect(snapshot(backend)).toEqual(BEFORE);
  });
});

// EXT4 (workstream R): the sign-in expires part-way. From the chosen request
// on, every database request is refused, including any clean-up.
test.describe('sign-in expires while receiving', () => {
  async function expireAt(page, table, method) {
    let expired = false;
    await page.route(/\/rest\/v1\//, route => {
      const req = route.request();
      const t = new URL(req.url()).pathname.slice('/rest/v1/'.length);
      if (!expired && t === table && req.method() === method) expired = true;
      if (!expired) return route.fallback();
      return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST301', message: 'JWT expired' }) });
    });
  }

  test('on the claim: nothing saved, the page says to sign in again', async ({ page, backend }) => {
    await expireAt(page, 'purchase_orders', 'PATCH');
    await clickReceive(page);
    // (the list cannot reload either, so the Receive button may disappear)
    await expect(page.locator('body')).toContainText('Could not receive that delivery');
    await expect(page.locator('body')).toContainText('Sign in again');
    expect(snapshot(backend)).toEqual(BEFORE);
  });

  test('after the claim: the order is Received, the page says what is missing and to sign in, and offers no second Receive', async ({ page, backend }) => {
    await expireAt(page, 'inventory', 'PATCH');
    await clickReceive(page);
    await expect(page.locator('body')).toContainText('stopped part-way');
    await expect(page.locator('body')).toContainText('expense NOT logged');
    await expect(page.locator('body')).toContainText('Sign in again');
    await expect(page.locator('#toastHost .toast.ok')).toHaveCount(0);
    expect(snapshot(backend)).toEqual({ ...BEFORE, poStatus: 'received' });
    await expect(page.locator('.poReceiveBtn')).toHaveCount(0);
  });
});

// EXT4 (workstream E): the delivery's expense is dated with the Central
// calendar day. It used the UTC date, so a delivery received after 7 pm on
// the last day of a month was logged in the NEXT month.
test.describe('expense date', () => {
  test.use({ timezoneId: 'America/Chicago' });
  test('received at 9 pm Central on Sept 30: the expense is dated Sept 30', async ({ page, backend }) => {
    await page.clock.setFixedTime(new Date('2026-10-01T02:00:00Z'));
    await clickReceive(page);
    await expect.poll(() => snapshot(backend)).toEqual(AFTER_ONE_RECEIVE);
    expect(backend.tables.expenses[0].expense_date).toBe('2026-09-30');
  });
});

// EXT5: Receive used the lines, shipping and tax the page loaded, not what is
// in the database when the order is received. Another tab (or person) that
// changed the order meanwhile was silently ignored. Now the order is re-read
// right after the claim and the current lines are received; a change that
// lands while receiving is reported, never shown as a clean success.
test.describe('order changed in another tab before Receive', () => {
  const removeLine = (backend, id) => {
    backend.tables.purchase_order_items = backend.tables.purchase_order_items.filter(l => l.id !== id);
    const po = backend.tables.purchase_orders[0];
    po.purchase_order_items = po.purchase_order_items.filter(l => l.id !== id);
  };
  test('a line removed elsewhere is not stocked and not charged', async ({ page, backend }) => {
    removeLine(backend, 'poi-b');
    await clickReceive(page);
    await expect.poll(() => snapshot(backend).poStatus).toBe('received');
    await expect.poll(() => backend.tables.expenses.length).toBe(1);
    expect(snapshot(backend)).toMatchObject({ availableA: 60, availableB: 0 });
    expect(backend.tables.expenses[0].amount).toBe(50 * 2 + 15 + 5); // line A + shipping + tax
    await expect(page.locator('body')).toContainText('changed since this page was opened');
  });
  test('a line added elsewhere is received too', async ({ page, backend }) => {
    const extra = { id: 'poi-c', purchase_order_id: PO_ID, product_id: PRODUCT_B, description: 'SYNTHETIC product B extra', sku: 'SYN-B', quantity: 3, unit_cost: 5, quantity_received: 0, landed_unit_cost: null };
    backend.tables.purchase_order_items.push(extra); // the order's embedded list is the same array in this fixture
    await clickReceive(page);
    await expect.poll(() => snapshot(backend).availableB).toBe(23);
    expect(backend.tables.expenses[0].amount).toBe(100 + 100 + 15 + 15 + 5);
  });
  test('shipping changed elsewhere: the expense uses the saved figure', async ({ page, backend }) => {
    backend.tables.purchase_orders[0].shipping_cost = 40;
    await clickReceive(page);
    await expect.poll(() => backend.tables.expenses.length).toBe(1);
    expect(backend.tables.expenses[0].amount).toBe(100 + 100 + 40 + 5);
  });
  test('a line removed WHILE receiving (before it is marked): no success; the page names the cause', async ({ page, backend }) => {
    let fired = false;
    // remove line B just before the first stock write, i.e. after the re-read
    const orig = backend.handle.bind(backend);
    backend.handle = async route => {
      const u = new URL(route.request().url());
      if (!fired && u.pathname.endsWith('/rest/v1/inventory') && route.request().method() === 'PATCH') { fired = true; removeLine(backend, 'poi-b'); }
      return orig(route);
    };
    await clickReceive(page);
    await expect(page.locator('#dashError')).toContainText('removed from the order while it was being received', { timeout: 15000 });
    await expect(page.locator('#toastHost .toast.ok')).toHaveCount(0);
  });
});

test('a line removed after the last line was marked (just before the expense): the final re-check reports it', async ({ page, backend }) => {
  let fired = false;
  const orig = backend.handle.bind(backend);
  backend.handle = async route => {
    const u = new URL(route.request().url());
    if (!fired && u.pathname.endsWith('/rest/v1/expenses') && route.request().method() === 'POST') {
      fired = true;
      backend.tables.purchase_order_items = backend.tables.purchase_order_items.filter(l => l.id !== 'poi-b');
    }
    return orig(route);
  };
  await clickReceive(page);
  await expect(page.locator('#dashError')).toContainText('lines of this order changed while it was being received', { timeout: 15000 });
  await expect(page.locator('#toastHost .toast.ok')).toHaveCount(0);
});
