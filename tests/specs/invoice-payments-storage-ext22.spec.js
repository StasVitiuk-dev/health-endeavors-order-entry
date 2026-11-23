// Invoice PAYMENTS on the Accounting page (Nov 22): drafts/32 connected to the
// screen through he-invoice-store.js, behind the he_invoice_payments switch
// (not on the Feature Flags page).
//
// Most tests run the page against a REAL throwaway Postgres with drafts/32
// installed (tests/helpers/pg-bridge.js), because what they prove is the
// database's job: a payment survives a refresh, a retry after a lost reply
// records once, more than is owed is refused, and staff are refused even when
// the page's own check is bypassed. Where the local Postgres is not running
// (GitHub CI) they skip and say so. Two tests need no database: switch OFF, and
// switch ON but not installed (as in production today). All data is made up.
const path = require('path');
const { test, expect, login, gotoPage } = require('../helpers/dashboard');
const { pgBridge, pgAvailable } = require('../helpers/pg-bridge');
const { unnamedControls } = require('../helpers/a11y-audit');
const { OWNER_USER } = require('../fixtures/synthetic-data');

const INSTALL = path.resolve(__dirname, '..', '..', 'docs', 'ops', 'sql', 'drafts', '32_DRAFT_invoices.sql');
const TABLES = ['invoices', 'invoice_payments'];
const RPCS = ['record_invoice_payment', 'reverse_invoice_payment'];
const OWNER2 = '00000000-0000-4000-8000-0000000003b1';
// valid contents: 6 x 18.50 = 111.00 + 9.00 shipping (not taxed) + 9.99 tax (9% of 111) = 129.99
const LINES = '[{"sku":"SYN-A","description":"Synthetic lotion","quantity":6,"unitPrice":18.5,"discount":0,"lineTotal":111}]';
const BILL = '{"name":"SYN Cedar Spa","lines":["100 Example Street","Example City, IL 60000"]}';
const as = (uid, sql) => "begin; set local role authenticated; set local request.jwt.claim.sub = '" + uid + "'; " + sql + "; commit;";
const draftSql = "insert into invoices (lines, subtotal, shipping, bill_to, tax_rate, tax_rate_status, tax_place, tax, total) values ('" + LINES + "', 111, 9, '" + BILL + "', 0.09, 'CONFIRMED', 'Example City, IL', 9.99, 129.99)";
// one issued invoice (number HE-YYYY-0001), created and issued by the signed-in owner
const SEED_OWNER = as(OWNER_USER.id, draftSql) + as(OWNER_USER.id, "select public.issue_invoice((select id from invoices limit 1))");
// a staff member's own draft, issued by another owner (so the staff member can see it)
const SEED_STAFF = "insert into profiles (id, email, role, is_active, display_name, account_number) values ('" + OWNER2 + "','owner2@example.test','owner',true,'Synthetic Owner Two','500000009');" +
  as(OWNER_USER.id, draftSql) + as(OWNER2, "select public.issue_invoice((select id from invoices limit 1))");

async function switchOn(page) { await page.addInitScript(() => { try { localStorage.setItem('he_invoice_payments', 'on'); } catch (e) {} }); }
async function open(page) {
  await gotoPage(page, 'accountingPanel');
  await expect(page.locator('#invoicePaymentsHost .invoicePayments')).toHaveCount(1);
}
const needPg = () => test.skip(!pgAvailable(), 'needs the local throwaway Postgres (not available here, e.g. GitHub CI)');
const row = (page) => page.locator('#invoicePaymentsHost tr[data-ipinvoice]').first();

test('switch OFF (the default): Accounting is unchanged', async ({ page }) => {
  await login(page); await gotoPage(page, 'accountingPanel');
  await expect(page.locator('#invoicePaymentsHost')).toBeEmpty();
});

test('switch ON but not installed (production today): says so and offers nothing to record', async ({ page }, ti) => {
  test.skip(ti.project.name !== 'desktop', 'run once');
  const writes = [];
  await page.route(/\/rest\/v1\/(rpc\/[a-z_]*invoice|invoice)/, r => {
    if (r.request().method() !== 'GET') writes.push(r.request().url());
    return r.fulfill({ status: 404, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ code: 'PGRST205', message: "Could not find the table 'public.invoices' in the schema cache" }) });
  });
  await switchOn(page);
  await login(page); await open(page);
  await expect(page.locator('#invoicePaymentsHost .invoicePayments')).toHaveAttribute('data-ipmode', 'unavailable');
  await expect(page.locator('[data-ipnote]')).toContainText('not installed in the database yet');
  await expect(page.locator('form[data-ippayform]')).toHaveCount(0);
  expect(writes).toEqual([]);
});

test.describe('against a real database with drafts/32 installed', () => {
  test.beforeEach(needPg);

  test('owner: record, refresh, over-pay refused, pay in full, reverse with a reason — the database keeps every step', async ({ page }) => {
    const db = await pgBridge(page, { install: INSTALL, tables: TABLES, rpcs: RPCS, role: 'owner', setupSql: SEED_OWNER });
    try {
      await switchOn(page);
      await login(page); await open(page);
      const host = page.locator('#invoicePaymentsHost');
      await expect(host.locator('.invoicePayments')).toHaveAttribute('data-ipmode', 'stored');
      await expect(row(page)).toContainText(/HE-\d{4}-0001/);
      await expect(row(page)).toContainText('SYN Cedar Spa');
      await expect(row(page)).toContainText('Issued, unpaid');
      await expect(row(page)).toContainText('$129.99');

      await row(page).locator('[data-ipopen]').click();
      await expect(host.locator('[data-ipdetail]')).toBeFocused();
      await expect(host.locator('[data-ipdetail]')).toContainText('No payments recorded yet.');
      const f = host.locator('form[data-ippayform]');
      await f.locator('#ipAmount').fill('50');
      await f.locator('#ipDate').fill('2026-11-20');
      await f.locator('#ipMethod').selectOption('check');
      await f.locator('#ipRef').fill('SYN-CHK-1001');
      await f.locator('button[type="submit"]').click();
      await expect(host.locator('[data-ipmessage]')).toContainText('Payment of $50.00 recorded.');
      await expect(row(page)).toContainText('Partly paid');
      await expect(row(page)).toContainText('$79.99');
      expect(await db.query("select status||'/'||amount_paid from invoices")).toBe('partially_paid/50.00');

      // refresh: read back from the database
      await page.reload(); await expect(page.locator('#dash')).toBeVisible(); await open(page);
      await row(page).locator('[data-ipopen]').click();
      const hist = host.locator('[data-iphistory]');
      await expect(hist).toHaveAttribute('data-iphistory', '1');
      await expect(hist).toContainText('2026-11-20');
      await expect(hist).toContainText('Check');
      await expect(hist).toContainText('SYN-CHK-1001');
      await expect(hist).toContainText('by you');

      // more than is still owed: refused, nothing recorded
      await f.locator('#ipAmount').fill('100.00');
      await f.locator('button[type="submit"]').click();
      await expect(host.locator('[data-ipmessage]')).toContainText('more than is still owed ($79.99)');
      await expect(f.locator('#ipAmount')).toHaveValue('100.00');          // what was typed is kept
      expect(await db.query('select count(*) from invoice_payments')).toBe('1');
      // not a number of cents
      await f.locator('#ipAmount').fill('10.005');
      await f.locator('button[type="submit"]').click();
      await expect(host.locator('[data-ipmessage]')).toContainText('dollars and cents');

      // the rest, by ACH: paid, and the form gives way to a note
      await f.locator('#ipAmount').fill('79.99');
      await f.locator('#ipMethod').selectOption('ach');
      await f.locator('button[type="submit"]').click();
      await expect(row(page)).toContainText('Paid');
      await expect(host.locator('form[data-ippayform]')).toHaveCount(0);
      await expect(host.locator('[data-ipdetail]')).toContainText('Paid in full');

      // reverse the ACH payment: a reason is required
      const ach = host.locator('tr[data-ippayment]').nth(1);
      await ach.locator('[data-ipreverse]').click();
      const rf = host.locator('form[data-ipreverseform]');
      await expect(rf.locator('input[name="reason"]')).toBeFocused();
      await rf.locator('button[type="submit"]').click();
      await expect(host.locator('[data-ipmessage]')).toContainText('written reason is required');
      await rf.locator('input[name="reason"]').fill('ACH returned by the bank (synthetic)');
      await rf.locator('button[type="submit"]').click();
      await expect(host.locator('[data-ipmessage]')).toContainText('Payment reversed. The original stays on the record.');
      await expect(row(page)).toContainText('Partly paid');
      await expect(host.locator('tr[data-ippayment][data-ipreversed="true"]')).toContainText('Reversed by you: ACH returned by the bank (synthetic)');
      await expect(host.locator('tr[data-ippayment][data-ipreversed="true"] [data-ipreverse]')).toHaveCount(0);
      expect(await db.query("select string_agg(kind, ',' order by recorded_at) from invoice_payments")).toBe('payment,payment,reversal');
      expect(await db.query("select status||'/'||amount_paid from invoices")).toBe('partially_paid/50.00');
      expect(await host.evaluate(unnamedControls)).toEqual([]);
    } finally { await db.close(); }
  });

  test('a double click and a retry after a lost reply record the payment once', async ({ page }) => {
    const db = await pgBridge(page, { install: INSTALL, tables: TABLES, rpcs: RPCS, role: 'owner', setupSql: SEED_OWNER, dropReplyOnce: ['record_invoice_payment'] });
    try {
      await switchOn(page);
      await login(page); await open(page);
      await row(page).locator('[data-ipopen]').click();
      const host = page.locator('#invoicePaymentsHost');
      const f = host.locator('form[data-ippayform]');
      await f.locator('#ipAmount').fill('25.00');
      // double click: the second press finds the first on its way
      await f.locator('button[type="submit"]').dblclick();
      // the database recorded it, but the reply was lost: the page says it cannot tell
      await expect(host.locator('[data-ipmessage]')).toContainText('cannot tell whether the payment was recorded');
      expect(await db.query('select count(*) from invoice_payments')).toBe('1');
      // the person presses again: same request key, nothing added
      await f.locator('button[type="submit"]').click();
      await expect(host.locator('[data-ipmessage]')).toContainText('Already recorded. Nothing changed.');
      expect(await db.query("select count(*)||'/'||sum(amount) from invoice_payments")).toBe('1/25.00');
      await expect(row(page)).toContainText('$104.99');
    } finally { await db.close(); }
  });

  test('staff: the page says payments are for the owner and administrators; the database refuses even when the page is fooled', async ({ page }, ti) => {
    test.skip(ti.project.name !== 'desktop', 'run once');
    // the database knows this person as staff; the stand-in profile still says owner,
    // so the page's own check is bypassed and only the database stands in the way
    const db = await pgBridge(page, { install: INSTALL, tables: TABLES, rpcs: RPCS, role: 'employee', setupSql: SEED_STAFF });
    try {
      await switchOn(page);
      await login(page); await open(page);
      const host = page.locator('#invoicePaymentsHost');
      await row(page).locator('[data-ipopen]').click();
      await expect(host.locator('[data-ipdetail]')).toContainText('No payments recorded yet.');   // staff read none
      await host.locator('#ipAmount').fill('10.00');
      await host.locator('form[data-ippayform] button[type="submit"]').click();
      await expect(host.locator('[data-ipmessage]')).toContainText('Only the owner or an administrator can record payments.');
      expect(await db.query('select count(*) from invoice_payments')).toBe('0');
    } finally { await db.close(); }
  });
});

test('signed in as staff (no database needed): the section says payments are for the owner and administrators', async ({ page, backend }, ti) => {
  test.skip(ti.project.name !== 'desktop', 'run once');
  backend.tables.profiles.find(p => p.role === 'owner').role = 'employee';
  await switchOn(page);
  await login(page); await open(page);
  await expect(page.locator('#invoicePaymentsHost .invoicePayments')).toHaveAttribute('data-ipmode', 'forbidden');
  await expect(page.locator('#invoicePaymentsHost')).toContainText('visible to the owner and administrators only');
});

test('at phone size the payment section and form fit without sideways scrolling', async ({ page }, ti) => {
  test.skip(ti.project.name !== 'iphone', 'phone only');
  needPg();
  const db = await pgBridge(page, { install: INSTALL, tables: TABLES, rpcs: RPCS, role: 'owner', setupSql: SEED_OWNER });
  try {
    await switchOn(page);
    await login(page); await open(page);
    await row(page).locator('[data-ipopen]').click();
    await expect(page.locator('form[data-ippayform]')).toBeVisible();
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(over).toBeLessThanOrEqual(0);
  } finally { await db.close(); }
});
