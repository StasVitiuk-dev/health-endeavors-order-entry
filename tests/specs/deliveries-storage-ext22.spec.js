// Deliveries with partial receiving on Purchase Orders (owner's rules of Nov 22,
// D-ops-5): drafts/40 connected through he-receiving-store.js, behind the
// he_receiving_store switch (not on the Feature Flags page). Runs the page
// against a REAL throwaway Postgres with drafts/40 (and drafts/44 for staff)
// installed; skips where it is not running. All data is made up.
const fs = require('fs');
const path = require('path');
const { test, expect, login, gotoPage } = require('../helpers/dashboard');
const { pgBridge, pgAvailable } = require('../helpers/pg-bridge');
const { unnamedControls } = require('../helpers/a11y-audit');

const DRAFTS = path.resolve(__dirname, '..', '..', 'docs', 'ops', 'sql', 'drafts');
const INSTALL = path.join(DRAFTS, '40_DRAFT_partial_receiving_returns.sql');
const STAFF_PO = fs.readFileSync(path.join(DRAFTS, '44_DRAFT_staff_read_purchase_orders.sql'), 'utf8');
const TABLES = ['purchase_orders', 'purchase_order_items', 'receiving_records', 'receiving_record_lines'];
const RPCS = ['submit_receiving_record', 'approve_receiving_record', 'reject_receiving_record', 'cancel_receiving_record', 'decide_receiving_surplus'];
const P = '00000000-0000-4000-8000-0000000005b1', SUP = '00000000-0000-4000-8000-0000000005c1', PO = '00000000-0000-4000-8000-0000000005d1', IT = '00000000-0000-4000-8000-0000000005d2';
const SEED = "insert into products (id, name, sku) values ('" + P + "','SYNTHETIC Honey Milk 8 oz','SYN-DLV-A');" +
  "insert into inventory (product_id, available, damaged) values ('" + P + "', 5, 0);" +
  "insert into suppliers (id, name, supplier_type, is_active) values ('" + SUP + "','SYN Lotion Lab','lab',true);" +
  "insert into purchase_orders (id, po_number, supplier_id, status, payment_status, created_at) values ('" + PO + "','SYN-PO-040','" + SUP + "','ordered','unpaid', now());" +
  "insert into purchase_order_items (id, purchase_order_id, product_id, sku, description, quantity, unit_cost, quantity_received) values ('" + IT + "','" + PO + "','" + P + "','SYN-DLV-A','Honey Milk 8 oz',20,4.25,0);";
async function on(page) { await page.addInitScript(() => { try { localStorage.setItem('he_receiving_store', 'on'); } catch (e) {} }); }
async function open(page) { await gotoPage(page, 'purchaseOrdersPanel'); await expect(page.locator('#deliveriesHost .deliveries')).toHaveCount(1); }
const needPg = () => test.skip(!pgAvailable(), 'needs the local throwaway Postgres (not available here, e.g. GitHub CI)');
async function record(page, f) {
  const host = page.locator('#deliveriesHost');
  await host.locator('#dlvPo').selectOption(PO);
  await expect(host.locator('fieldset[data-dlvline="' + IT + '"]')).toBeVisible();
  for (const [k, v] of Object.entries(f)) await host.locator('#dlv' + k + '-' + IT).fill(String(v));
  await host.locator('form[data-dlvform] button[type="submit"]').click();
}

test('switch OFF (the default): Purchase Orders is unchanged', async ({ page }) => {
  await login(page); await gotoPage(page, 'purchaseOrdersPanel');
  await expect(page.locator('#deliveriesHost')).toBeEmpty();
});

test('switch ON but not installed (production today): says so and saves nothing', async ({ page }, ti) => {
  test.skip(ti.project.name !== 'desktop', 'run once');
  await page.route(/\/rest\/v1\/(rpc\/[a-z_]*receiving|receiving_)/, r => r.fulfill({ status: 404, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify({ code: 'PGRST205', message: "Could not find the table 'public.receiving_records' in the schema cache" }) }));
  await on(page); await login(page); await open(page);
  await expect(page.locator('#deliveriesHost [data-dlvnote]')).toContainText('not installed in the database yet');
  await expect(page.locator('form[data-dlvform]')).toHaveCount(0);
});

test.describe('against a real database with drafts/40 installed', () => {
  test.beforeEach(needPg);

  test('owner: three deliveries — approve, rejected units stay to come, surplus kept — stock moves only on approval', async ({ page }) => {
    const db = await pgBridge(page, { install: INSTALL, tables: TABLES, rpcs: RPCS, role: 'owner', setupSql: SEED });
    // stock and quantity received read in ONE query (one snapshot), and waited for:
    // the page's reply can arrive a moment before a separate reading sees the commit
    const read = () => db.query("select i.available||'/'||i.damaged||' '||p.quantity_received from inventory i, purchase_order_items p where i.product_id = '" + P + "' and p.id = '" + IT + "'");
    const stock = read;
    const settled = (want) => expect.poll(read, { timeout: 5000 }).toBe(want);
    try {
      await on(page); await login(page); await open(page);
      const host = page.locator('#deliveriesHost');
      await expect(host.locator('.deliveries')).toHaveAttribute('data-dlvmode', 'stored');
      await record(page, { Good: 8 });
      await expect(host.locator('[data-dlvmessage]')).toContainText('Delivery recorded. It waits for the owner or an administrator');
      await expect(host.locator('[data-dlvwaiting]')).toHaveAttribute('data-dlvwaiting', '1');
      expect(await stock()).toBe('5/0 0');                                  // nothing moved yet
      await host.locator('[data-dlvact="approve"]').click();
      await expect(host.locator('[data-dlvmessage]')).toContainText('Approved. Stock and the purchase order are updated.');
      await settled('13/0 8');

      await record(page, { Good: 9, Damaged: 1, Rejected: 2 });
      await expect(host.locator('[data-dlvmessage]')).toContainText('Say why units were rejected');
      await host.locator('#dlvReason-' + IT).fill('Leaking caps');
      await host.locator('form[data-dlvform] button[type="submit"]').click();
      await expect(host.locator('[data-dlvrecord]')).toContainText('9 good, 1 damaged, kept, 2 rejected (Leaking caps)');
      await host.locator('[data-dlvact="approve"]').click();
      await expect(host.locator('[data-dlvwaiting]')).toHaveAttribute('data-dlvwaiting', '0');
      await settled('22/1 18');

      // 5 good on 2 still to come is refused by the page, then surplus is accepted
      await record(page, { Good: 5 });
      await expect(host.locator('[data-dlvmessage]')).toContainText('Only 2 unit(s) are still to come');
      await host.locator('#dlvGood-' + IT).fill('2'); await host.locator('#dlvSurplus-' + IT).fill('3');
      await host.locator('form[data-dlvform] button[type="submit"]').click();
      await host.locator('[data-dlvact="approve"]').click();
      await expect(host.locator('[data-dlvsurplus]')).toContainText('3 unit(s) more than ordered');
      await settled('24/1 20');
      await host.locator('[data-dlvact="keep"]').click();
      await expect(host.locator('[data-dlvmessage]')).toContainText('Surplus kept');
      await settled('27/1 20');
      expect(await db.query("select status from purchase_orders where id = '" + PO + "'")).toBe('received');
      expect(await host.evaluate(unnamedControls)).toEqual([]);
    } finally { await db.close(); }
  });

  test('a double click and a retry after a lost reply record the delivery once', async ({ page }) => {
    const db = await pgBridge(page, { install: INSTALL, tables: TABLES, rpcs: RPCS, role: 'owner', setupSql: SEED, dropReplyOnce: ['submit_receiving_record'] });
    try {
      await on(page); await login(page); await open(page);
      const host = page.locator('#deliveriesHost');
      await host.locator('#dlvPo').selectOption(PO);
      await host.locator('#dlvGood-' + IT).fill('4');
      await host.locator('form[data-dlvform] button[type="submit"]').dblclick();
      await expect(host.locator('[data-dlvmessage]')).toContainText('cannot tell whether it was recorded');
      await host.locator('form[data-dlvform] button[type="submit"]').click();
      await expect(host.locator('[data-dlvmessage]')).toContainText('Already recorded. Nothing changed.');
      expect(await db.query('select count(*) from receiving_records')).toBe('1');
    } finally { await db.close(); }
  });

  test('administrator (owner decision, Nov 24): sees Approve, approves, and the database moves stock with them as approver', async ({ page, backend }, ti) => {
    test.skip(ti.project.name !== 'desktop', 'run once');
    const db = await pgBridge(page, { install: INSTALL, tables: TABLES, rpcs: RPCS, role: 'administrator', setupSql: SEED });
    try {
      backend.tables.profiles.find(p => p.role === 'owner').role = 'administrator';
      await on(page); await login(page); await open(page);
      const host = page.locator('#deliveriesHost');
      await record(page, { Good: 6 });
      await expect(host.locator('[data-dlvmessage]')).toContainText('It waits for the owner or an administrator');
      await expect(host).toContainText('Waiting for your approval (1)');
      expect(await db.query("select available from inventory where product_id = '" + P + "'")).toBe('5');
      await host.locator('[data-dlvact="approve"]').click();
      await expect(host.locator('[data-dlvmessage]')).toContainText('Approved. Stock and the purchase order are updated.');
      await expect.poll(() => db.query("select available from inventory where product_id = '" + P + "'"), { timeout: 5000 }).toBe('11');
      expect(await db.query("select status||'/'||(decided_by = submitted_by) from receiving_records")).toBe('approved/true');
    } finally { await db.close(); }
  });

  test('staff (with drafts/44): record a delivery; the owner approves; staff cannot approve even when the page is fooled', async ({ page, backend }, ti) => {
    test.skip(ti.project.name !== 'desktop', 'run once');
    const db = await pgBridge(page, { install: INSTALL, tables: TABLES, rpcs: RPCS, role: 'employee', setupSql: SEED + STAFF_PO });
    try {
      backend.tables.profiles.find(p => p.role === 'owner').role = 'employee';
      await on(page); await login(page); await open(page);
      const host = page.locator('#deliveriesHost');
      await record(page, { Good: 6 });
      await expect(host.locator('[data-dlvmessage]')).toContainText('It waits for the owner');
      await expect(host).toContainText('Your deliveries waiting for the owner or an administrator');
      await expect(host.locator('[data-dlvact="approve"]')).toHaveCount(0);
      await expect(host.locator('[data-dlvact="cancel"]')).toHaveCount(1);
      expect(await db.query("select available from inventory where product_id = '" + P + "'")).toBe('5');
      // the page now believes this person is the owner; the database knows better
      backend.tables.profiles.find(p => p.role === 'employee').role = 'owner';
      await page.reload(); await expect(page.locator('#dash')).toBeVisible(); await open(page);
      await host.locator('[data-dlvact="approve"]').click();
      await expect(host.locator('[data-dlvmessage]')).toContainText('Only the owner or an administrator can approve or reject a delivery.');
      expect(await db.query("select status from receiving_records")).toBe('submitted');
      expect(await db.query("select available from inventory where product_id = '" + P + "'")).toBe('5');
    } finally { await db.close(); }
  });
});

test('at phone size the delivery form fits without sideways scrolling', async ({ page }, ti) => {
  test.skip(ti.project.name !== 'iphone', 'phone only');
  needPg();
  const db = await pgBridge(page, { install: INSTALL, tables: TABLES, rpcs: RPCS, role: 'owner', setupSql: SEED });
  try {
    await on(page); await login(page); await open(page);
    await page.locator('#deliveriesHost #dlvPo').selectOption(PO);
    await expect(page.locator('#deliveriesHost fieldset[data-dlvline]')).toBeVisible();
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(over).toBeLessThanOrEqual(0);
  } finally { await db.close(); }
});
