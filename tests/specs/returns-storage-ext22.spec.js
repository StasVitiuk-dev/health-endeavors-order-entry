// Returns and corrections on the Returns page (owner's rules of Nov 22, D-ops-5),
// the last screens on drafts/40, behind the he_receiving_store switch (not on the
// Feature Flags page). Customer returns wait "awaiting inspection" until the owner
// inspects them (opened or used skincare is never restocked); returns to a
// supplier wait for the owner's approval; the owner corrects a wrong stock
// movement with a reason, as a new linked movement. Runs the page against a REAL
// throwaway Postgres with drafts/40 (and drafts/44 for staff) installed; skips
// where it is not running. All data is made up.
const fs = require('fs');
const path = require('path');
const { test, expect, login, gotoPage } = require('../helpers/dashboard');
const { pgBridge, pgAvailable } = require('../helpers/pg-bridge');
const { unnamedControls } = require('../helpers/a11y-audit');

const DRAFTS = path.resolve(__dirname, '..', '..', 'docs', 'ops', 'sql', 'drafts');
const INSTALL = path.join(DRAFTS, '40_DRAFT_partial_receiving_returns.sql');
const STAFF_PO = fs.readFileSync(path.join(DRAFTS, '44_DRAFT_staff_read_purchase_orders.sql'), 'utf8');
const TABLES = ['orders', 'order_items', 'products', 'purchase_orders', 'purchase_order_items', 'supplier_returns', 'customer_return_inspections', 'stock_movements'];
const RPCS = ['record_customer_return', 'decide_customer_return', 'submit_supplier_return', 'decide_supplier_return', 'correct_stock_movement'];
const P = '00000000-0000-4000-8000-0000000006b1', SUP = '00000000-0000-4000-8000-0000000006c1', PO = '00000000-0000-4000-8000-0000000006d1', IT = '00000000-0000-4000-8000-0000000006d2';
const ORD = '00000000-0000-4000-8000-0000000006e1', OI = '00000000-0000-4000-8000-0000000006e2';
const SEED = "insert into products (id, name, sku) values ('" + P + "','SYNTHETIC Honey Milk 8 oz','SYN-RTN-A');" +
  "insert into inventory (product_id, available, damaged) values ('" + P + "', 5, 0);" +
  "insert into suppliers (id, name, supplier_type, is_active) values ('" + SUP + "','SYN Lotion Lab','lab',true);" +
  "insert into purchase_orders (id, po_number, supplier_id, status, payment_status, created_at) values ('" + PO + "','SYN-PO-060','" + SUP + "','received','unpaid', now());" +
  "insert into purchase_order_items (id, purchase_order_id, product_id, sku, description, quantity, unit_cost, quantity_received) values ('" + IT + "','" + PO + "','" + P + "','SYN-RTN-A','Honey Milk 8 oz',10,4.25,10);" +
  "insert into orders (id, channel, status, order_number, placed_at) values ('" + ORD + "','synthetic','paid','SYN-RTN-1001', now());" +
  "insert into order_items (id, order_id, sku, product_name, quantity, unit_price, line_total) values ('" + OI + "','" + ORD + "','SYN-RTN-A','Honey Milk 8 oz',3,18.5,55.5);";
async function on(page) { await page.addInitScript(() => { try { localStorage.setItem('he_receiving_store', 'on'); } catch (e) {} }); }
async function open(page) { await gotoPage(page, 'returnsPanel'); await expect(page.locator('#stockReturnsHost .stockReturns')).toHaveCount(1); }
const needPg = () => test.skip(!pgAvailable(), 'needs the local throwaway Postgres (not available here, e.g. GitHub CI)');
const msg = (page) => page.locator('#stockReturnsHost [data-rtnmessage]');
async function customerReturn(page, qty) {
  const host = page.locator('#stockReturnsHost');
  await host.locator('#rtnCrLine').selectOption(OI);
  await host.locator('#rtnCrQty').fill(String(qty));
  await host.locator('form[data-rtnform="cr"] button[type="submit"]').click();
}
async function supplierReturn(page, f) {
  const host = page.locator('#stockReturnsHost');
  await host.locator('#rtnSrLine').selectOption(IT);
  await host.locator('#rtnSrQty').fill(String(f.qty));
  await host.locator('#rtnSrFrom').selectOption(f.from);
  await host.locator('#rtnSrReason').fill(f.reason);
  if (f.replacement) await host.locator('#rtnSrRepl').check();
  await host.locator('form[data-rtnform="sr"] button[type="submit"]').click();
}

test('switch OFF (the default): the Returns page is unchanged', async ({ page }) => {
  await login(page); await gotoPage(page, 'returnsPanel');
  await expect(page.locator('#stockReturnsHost')).toBeEmpty();
});

test('switch ON but not installed (production today): says so and saves nothing', async ({ page }, ti) => {
  test.skip(ti.project.name !== 'desktop', 'run once');
  await page.route(/\/rest\/v1\/(supplier_returns|customer_return_inspections|stock_movements|rpc\/(record_customer|decide_customer|submit_supplier|decide_supplier|correct_stock))/, r => r.fulfill({ status: 404, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify({ code: 'PGRST205', message: "Could not find the table 'public.supplier_returns' in the schema cache" }) }));
  await on(page); await login(page); await open(page);
  await expect(page.locator('#stockReturnsHost [data-rtnnote]')).toContainText('not installed in the database yet');
  await expect(page.locator('#stockReturnsHost form')).toHaveCount(0);
});

test.describe('against a real database with drafts/40 installed', () => {
  test.beforeEach(needPg);

  test('owner: a customer return is inspected before restocking, a supplier return is approved, a wrong movement is corrected', async ({ page }) => {
    const db = await pgBridge(page, { install: INSTALL, tables: TABLES, rpcs: RPCS, role: 'owner', setupSql: SEED });
    // stock and the purchase-order line read in ONE query, and waited for
    const read = () => db.query("select i.available||'/'||i.damaged||' '||p.quantity_received from inventory i, purchase_order_items p where i.product_id = '" + P + "' and p.id = '" + IT + "'");
    const settled = (want) => expect.poll(read, { timeout: 5000 }).toBe(want);
    try {
      await on(page); await login(page); await open(page);
      const host = page.locator('#stockReturnsHost');
      await expect(host.locator('.stockReturns')).toHaveAttribute('data-rtnmode', 'stored');
      await expect(host.locator('#rtnCrLine option[value="' + OI + '"]')).toHaveText('SYN-RTN-1001 · SYN-RTN-A — sold 3, can come back 3');

      // 1. customer return: recorded, not for sale, no stock change
      await customerReturn(page, 4);
      await expect(msg(page)).toContainText('Only 3 unit(s) of that order line have not been returned yet.');
      await customerReturn(page, 2);
      await expect(msg(page)).toContainText('Recorded: awaiting inspection, not for sale.');
      await expect(host.locator('[data-rtncrwaiting]')).toHaveAttribute('data-rtncrwaiting', '1');
      await expect(host.locator('[data-rtncr]')).toContainText('SYN-RTN-1001 · SYN-RTN-A: 2 unit(s) awaiting inspection');
      await expect(host.locator('#rtnCrLine option[value="' + OI + '"]')).toHaveText('SYN-RTN-1001 · SYN-RTN-A — sold 3, can come back 1');
      await settled('5/0 10');

      // 2. inspection: opened skincare is never restocked; every unit needs an outcome
      const crId = await db.query('select id from customer_return_inspections');
      await host.locator('[data-rtnact="inspect-open"]').click();
      await expect(page.locator('#rtnOpened-' + crId)).toBeFocused();
      await page.locator('#rtnOpened-' + crId).selectOption('yes'); await page.locator('#rtnUsed-' + crId).selectOption('no');
      await page.locator('#rtnRestock-' + crId).fill('2');
      await host.locator('form[data-rtnform="inspect"] button[type="submit"]').click();
      await expect(msg(page)).toContainText('Opened or used skincare cannot be restocked');
      await page.locator('#rtnOpened-' + crId).selectOption('no');
      await page.locator('#rtnRestock-' + crId).fill('1');
      await host.locator('form[data-rtnform="inspect"] button[type="submit"]').click();
      await expect(msg(page)).toContainText('Every returned unit needs an outcome: 2 unit(s) came back.');
      await page.locator('#rtnDamaged-' + crId).fill('1');
      await host.locator('form[data-rtnform="inspect"] button[type="submit"]').click();
      await expect(msg(page)).toContainText('Inspection recorded.');
      await expect(host.locator('[data-rtncrwaiting]')).toHaveAttribute('data-rtncrwaiting', '0');
      await settled('6/1 10');
      await expect(host.locator('[data-rtnmoves]')).toHaveAttribute('data-rtnmoves', '2');

      // 3. return to the supplier with a replacement expected: stock moves only on approval
      await supplierReturn(page, { qty: 3, from: 'available', reason: 'abc', replacement: true });
      await expect(msg(page)).toContainText('Say why they go back');
      await page.locator('#rtnSrReason').fill('Wrong scent batch');
      await host.locator('form[data-rtnform="sr"] button[type="submit"]').click();
      await expect(msg(page)).toContainText('Return to the supplier recorded. It waits for the owner or an administrator (or a manager other than you).');
      await expect(host.locator('[data-rtnsr]')).toContainText('SYN-PO-060 · SYN-RTN-A: 3 unit(s) from Available');
      await expect(host.locator('[data-rtnsr]')).toContainText('Wrong scent batch · replacement expected');
      await settled('6/1 10');
      await host.locator('[data-rtnact="sr-approve"]').click();
      await expect(msg(page)).toContainText('Approved: stock is reduced.');
      await settled('3/1 7');
      expect(await db.query("select status from purchase_orders where id = '" + PO + "'")).toBe('ordered');   // 3 to come again

      // 4. correction: the newest movement (the supplier return, -3) is reversed by a linked movement
      const moveId = await db.query("select id from stock_movements where source_kind = 'supplier_return'");
      const row = host.locator('[data-rtnmove="' + moveId + '"]');
      await row.locator('[data-rtnact="fix-open"]').click();
      await expect(page.locator('#rtnFixWhy-' + moveId)).toBeFocused();
      await row.locator('form[data-rtnform="fix"] button[type="submit"]').click();
      await expect(msg(page)).toContainText('Say why it is corrected');
      await page.locator('#rtnFixWhy-' + moveId).fill('Approved by mistake');
      await host.locator('form[data-rtnform="fix"] button[type="submit"]').click();
      await expect(msg(page)).toContainText('Corrected by a linked movement.');
      await expect(row).toContainText('corrected');
      await expect(row.locator('[data-rtnact="fix-open"]')).toHaveCount(0);
      // the correction itself is never corrected again
      const fixId = await db.query("select id from stock_movements where corrects = " + moveId);
      await expect(host.locator('[data-rtnmove="' + fixId + '"]')).toContainText('Correction of movement ' + moveId + ': Approved by mistake');
      await expect(host.locator('[data-rtnmove="' + fixId + '"] [data-rtnact="fix-open"]')).toHaveCount(0);
      await expect.poll(() => db.query("select available||'/'||damaged from inventory where product_id = '" + P + "'"), { timeout: 5000 }).toBe('6/1');
      expect(await db.query('select count(*) from stock_movements')).toBe('4');
      expect(await host.evaluate(unnamedControls)).toEqual([]);
    } finally { await db.close(); }
  });

  test('a return recorded by mistake is cancelled: it stays on the record, no stock moves, and the units can come back again', async ({ page }) => {
    const db = await pgBridge(page, { install: INSTALL, tables: TABLES, rpcs: RPCS, role: 'owner', setupSql: SEED });
    try {
      await on(page); await login(page); await open(page);
      const host = page.locator('#stockReturnsHost');
      await customerReturn(page, 2);
      await expect(host.locator('#rtnCrLine option[value="' + OI + '"]')).toContainText('can come back 1');
      await host.locator('[data-rtnact="cr-cancel"]').click();
      await expect(msg(page)).toContainText('Cancelled. It stays on the record; no stock changed.');
      await expect(host.locator('[data-rtncrwaiting]')).toHaveAttribute('data-rtncrwaiting', '0');
      await expect(host.locator('#rtnCrLine option[value="' + OI + '"]')).toContainText('can come back 3');
      await supplierReturn(page, { qty: 2, from: 'available', reason: 'Recorded on the wrong order' });
      await host.locator('[data-rtnact="sr-cancel"]').click();
      await expect(msg(page)).toContainText('Cancelled.');
      await expect(host.locator('[data-rtnsrwaiting]')).toHaveAttribute('data-rtnsrwaiting', '0');
      expect(await db.query("select (select string_agg(status, ',') from customer_return_inspections)||' '||(select string_agg(status, ',') from supplier_returns)")).toBe('cancelled cancelled');
      expect(await db.query("select i.available||'/'||i.damaged||' '||p.quantity_received||' '||(select count(*) from stock_movements) from inventory i, purchase_order_items p where i.product_id = '" + P + "' and p.id = '" + IT + "'")).toBe('5/0 10 0');
      // a cancelled return offers nothing more to press
      await expect(host.locator('[data-rtnact="cr-cancel"], [data-rtnact="sr-cancel"], [data-rtnact="inspect-open"], [data-rtnact="sr-approve"]')).toHaveCount(0);
    } finally { await db.close(); }
  });

  test('a double click and a retry after a lost reply record a customer return once', async ({ page }) => {
    const db = await pgBridge(page, { install: INSTALL, tables: TABLES, rpcs: RPCS, role: 'owner', setupSql: SEED, dropReplyOnce: ['record_customer_return'] });
    try {
      await on(page); await login(page); await open(page);
      const host = page.locator('#stockReturnsHost');
      await host.locator('#rtnCrLine').selectOption(OI);
      await host.locator('#rtnCrQty').fill('1');
      await host.locator('form[data-rtnform="cr"] button[type="submit"]').dblclick();
      await expect(msg(page)).toContainText('cannot tell whether it was recorded');
      await host.locator('form[data-rtnform="cr"] button[type="submit"]').click();
      await expect(msg(page)).toContainText('Already recorded. Nothing changed.');
      expect(await db.query('select count(*) from customer_return_inspections')).toBe('1');
    } finally { await db.close(); }
  });

  test('staff (with drafts/44): record both kinds of return; no approving, no inspecting, no stock movements; the database refuses when the page is fooled', async ({ page, backend }, ti) => {
    test.skip(ti.project.name !== 'desktop', 'run once');
    const db = await pgBridge(page, { install: INSTALL, tables: TABLES, rpcs: RPCS, role: 'employee', setupSql: SEED + STAFF_PO });
    try {
      backend.tables.profiles.find(p => p.role === 'owner').role = 'employee';
      await on(page); await login(page); await open(page);
      const host = page.locator('#stockReturnsHost');
      await customerReturn(page, 1);
      await expect(msg(page)).toContainText('Recorded: awaiting inspection');
      await supplierReturn(page, { qty: 2, from: 'damaged', reason: 'Cracked jars' });
      await expect(msg(page)).toContainText('It waits for the owner or an administrator (or a manager other than you).');
      await expect(host).toContainText('Your returns to suppliers waiting for the owner or an administrator');
      await expect(host.locator('[data-rtnact="sr-approve"]')).toHaveCount(0);
      await expect(host.locator('[data-rtnact="inspect-open"]')).toHaveCount(0);
      await expect(host.locator('[data-rtnmoves]')).toHaveCount(0);
      // staff can cancel what they recorded by mistake
      await expect(host.locator('[data-rtnact="cr-cancel"]')).toHaveCount(1);
      await customerReturn(page, 1);
      await host.locator('[data-rtnact="cr-cancel"]').first().click();
      await expect(msg(page)).toContainText('Cancelled.');
      expect(await db.query("select count(*) filter (where status = 'cancelled')||'/'||count(*) from customer_return_inspections")).toBe('1/2');
      // the page now believes this person is the owner; the database knows better
      backend.tables.profiles.find(p => p.role === 'employee').role = 'owner';
      await page.reload(); await expect(page.locator('#dash')).toBeVisible(); await open(page);
      await host.locator('[data-rtnact="sr-approve"]').click();
      await expect(msg(page)).toContainText('Only the owner or an administrator can approve or reject a return to the supplier.');
      expect(await db.query('select status from supplier_returns')).toBe('submitted');
      expect(await db.query("select available||'/'||damaged from inventory where product_id = '" + P + "'")).toBe('5/0');
    } finally { await db.close(); }
  });
});

test('at phone size the returns forms fit without sideways scrolling', async ({ page }, ti) => {
  test.skip(ti.project.name !== 'iphone', 'phone only');
  needPg();
  const db = await pgBridge(page, { install: INSTALL, tables: TABLES, rpcs: RPCS, role: 'owner', setupSql: SEED });
  try {
    await on(page); await login(page); await open(page);
    await customerReturn(page, 1);
    await page.locator('#stockReturnsHost [data-rtnact="inspect-open"]').click();
    await expect(page.locator('#stockReturnsHost form[data-rtnform="inspect"]')).toBeVisible();
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(over).toBeLessThanOrEqual(0);
  } finally { await db.close(); }
});
