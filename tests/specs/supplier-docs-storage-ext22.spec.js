// Supplier document STORAGE on the Suppliers page (owner decision of Nov 16, later):
// drafts/36 connected to the screen through he-supplier-docs-store.js.
//
// Most tests here run the page against a REAL throwaway Postgres with drafts/36
// installed (tests/helpers/pg-bridge.js), because what they prove is the
// database's job: records survive a refresh, a retried save records once, and
// an administrator or staff member cannot approve even when the page's own check
// is bypassed. Where the local Postgres is not running (GitHub CI) they skip and
// say so. Two tests need no database: storage OFF, and storage ON but not
// installed (as in production today).
const path = require('path');
const { test, expect, login, gotoPage } = require('../helpers/dashboard');
const { pgBridge, pgAvailable } = require('../helpers/pg-bridge');
const { unnamedControls } = require('../helpers/a11y-audit');

const INSTALL = path.resolve(__dirname, '..', '..', 'docs', 'ops', 'sql', 'drafts', '36_DRAFT_supplier_documents.sql');
const LAB = '00000000-0000-4000-8000-0000000002b1', LBL = '00000000-0000-4000-8000-0000000002b3', POL = '00000000-0000-4000-8000-0000000002c1';
const STAFF = '00000000-0000-4000-8000-0000000002a3';
const TABLES = ['supplier_document_types', 'supplier_type_document_profiles', 'supplier_document_supplier_profiles', 'supplier_document_subjects',
  'supplier_documents', 'supplier_document_events', 'suppliers', 'purchase_orders'];
// profiles too, so names and roles come from the same database (except where a
// test needs the page to believe something the database does not)
const WITH_PROFILES = TABLES.concat(['profiles']);
const RPCS = ['record_supplier_document', 'review_supplier_document', 'withdraw_supplier_document', 'set_supplier_type_document_profiles', 'set_supplier_document_type_active'];
// A lotion lab with one received, paid order; a label printer; and one
// certificate recorded earlier by a staff member, waiting for review.
const SEED = "insert into profiles (id, email, role, is_active, display_name, account_number) values ('" + STAFF + "','staff@example.test','employee',true,'Synthetic Staff','500000003');" +
  "insert into suppliers (id, name, supplier_type, is_active) values ('" + LAB + "','SYN Lotion Lab','lab',true),('" + LBL + "','SYN Label Printer','other',true);" +
  "insert into purchase_orders (id, po_number, supplier_id, status, payment_status) values ('" + POL + "','SYN-PO-971','" + LAB + "','received','paid');" +
  "begin; set local role authenticated; set local request.jwt.claim.sub = '" + STAFF + "';" +
  "select public.record_supplier_document('00000000-0000-4000-8000-000000000901','" + LAB + "','certificate_of_analysis','batch','LOT-700','Lot 700','COA-700','2026-11-10',null,null,null); commit;";

async function switchOn(page, store) {
  await page.addInitScript((s) => { try { localStorage.setItem('he_supplier_documents', 'on'); if (s) localStorage.setItem('he_supplier_documents_store', 'on'); } catch (e) {} }, store);
}
async function asRoleInPage(backend, role) {
  const me = backend.tables.profiles.find(p => p.role === 'owner'); me.role = role;
}
async function open(page) {
  await gotoPage(page, 'suppliersPanel');
  await expect(page.locator('#supplierDocsHost .supplierDocs')).toHaveCount(1);
}
const needPg = () => test.skip(!pgAvailable(), 'needs the local throwaway Postgres (not available here, e.g. GitHub CI)');

test('storage switch OFF: the checklist shows the example data, exactly as before', async ({ page }, ti) => {
  test.skip(ti.project.name !== 'desktop', 'run once');
  await switchOn(page, false);
  await login(page); await open(page);
  await expect(page.locator('#supplierDocsHost .supplierDocs')).toHaveAttribute('data-sdmode', 'example');
  await expect(page.locator('#supplierDocsHost')).toContainText('SIMULATED — example data, read-only');
  await expect(page.locator('form[data-sdform]')).toHaveCount(0);
});

test('storage ON but not installed (production today): says so, shows the example data, saves nothing', async ({ page }, ti) => {
  test.skip(ti.project.name !== 'desktop', 'run once');
  const writes = [];
  await page.route(/\/rest\/v1\/(rpc\/[a-z_]*supplier_document|supplier_document)/, r => {
    if (r.request().method() !== 'GET') writes.push(r.request().url());
    return r.fulfill({ status: 404, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ code: 'PGRST205', message: "Could not find the table 'public.supplier_documents' in the schema cache" }) });
  });
  await switchOn(page, true);
  await login(page); await open(page);
  await expect(page.locator('#supplierDocsHost .supplierDocs')).toHaveAttribute('data-sdmode', 'example');
  await expect(page.locator('[data-sdstorenote]')).toContainText('not installed in the database yet');
  await expect(page.locator('form[data-sdform]')).toHaveCount(0);
  expect(writes).toEqual([]);
});

test.describe('against a real database with drafts/36 installed', () => {
  test.beforeEach(needPg);

  test('owner: record, refresh, approve, refresh — every step is still there, with its history', async ({ page }) => {
    const db = await pgBridge(page, { install: INSTALL, rpcs: RPCS, role: 'owner', setupSql: SEED, tables: WITH_PROFILES });
    try {
      await switchOn(page, true);
      await login(page); await open(page);
      const host = page.locator('#supplierDocsHost');
      await expect(host.locator('.supplierDocs')).toHaveAttribute('data-sdmode', 'stored');
      await expect(host).toContainText('STORED — saved in the database');
      // the staff member's certificate waits for the owner
      const coa = host.locator('tr[data-dockey="certificate_of_analysis"][data-subject="LOT-700"]');
      await expect(coa).toContainText('Awaiting review');
      await expect(coa).toContainText('recorded by Synthetic Staff');
      // the lab's received, paid order needs its three purchase documents
      await expect(host.locator('[data-supplierdocs-supplier="' + LAB + '"] tr[data-dockey="packing_slip"]')).toContainText('Missing');

      // record the packing slip for that order
      const f = page.locator('form[data-sdform]');
      await f.locator('#sdSupplier').selectOption(LAB);
      await f.locator('#sdKind').selectOption('packing_slip');
      await f.locator('#sdSubject').fill('SYN-PO-971');
      await f.locator('#sdRef').fill('PS-971');
      await f.locator('#sdReceived').fill('2026-11-16');
      await f.locator('[data-sdsave]').click();
      await expect(host.locator('[data-supplierdocs-supplier="' + LAB + '"] tr[data-dockey="packing_slip"]')).toContainText('Awaiting review');
      expect(await db.query("select count(*)||'/'||max(reference) from supplier_documents where kind = 'packing_slip'")).toBe('1/PS-971');

      // refresh: the page reads it back from the database
      await page.reload(); await expect(page.locator('#dash')).toBeVisible(); await open(page);
      const slip = page.locator('#supplierDocsHost [data-supplierdocs-supplier="' + LAB + '"] tr[data-dockey="packing_slip"]');
      await expect(slip).toContainText('Awaiting review');
      await expect(slip).toContainText('ref. PS-971');

      // approve the staff member's certificate
      await page.locator('#supplierDocsHost tr[data-dockey="certificate_of_analysis"][data-subject="LOT-700"] [data-sdact="approved"]').click();
      await expect(page.locator('#supplierDocsHost tr[data-dockey="certificate_of_analysis"][data-subject="LOT-700"]')).toHaveCount(0);   // approved: no longer needs attention
      await page.reload(); await expect(page.locator('#dash')).toBeVisible(); await open(page);
      await page.locator('[data-supplierdocs="all"]').click();
      const approved = page.locator('#supplierDocsHost tr[data-dockey="certificate_of_analysis"][data-subject="LOT-700"]');
      await expect(approved).toContainText('Approved');
      await expect(approved).toContainText('Reviewed by you');
      expect(await db.query("select status from supplier_documents where reference = 'COA-700'")).toBe('approved');
      // the history: recorded by staff, recorded by you, approved by you
      const hist = page.locator('[data-sdhistory]');
      await hist.locator('summary').click();
      await expect(hist.locator('li[data-sdevent="approved"]')).toContainText('you approved Certificate of analysis for Lot 700');
      await expect(hist.locator('li[data-sdevent="recorded"]')).toHaveCount(2);
      await expect(hist).toContainText('Synthetic Staff recorded Certificate of analysis for Lot 700');
      expect(await page.locator('#supplierDocsHost').evaluate(unnamedControls)).toEqual([]);
    } finally { await db.close(); }
  });

  test('a double click and a retry after a lost reply record the document once', async ({ page }) => {
    const db = await pgBridge(page, { install: INSTALL, tables: TABLES, rpcs: RPCS, role: 'owner', setupSql: SEED, dropReplyOnce: ['record_supplier_document'] });
    try {
      await switchOn(page, true);
      await login(page); await open(page);
      const f = page.locator('form[data-sdform]');
      await f.locator('#sdSupplier').selectOption(LAB);
      await f.locator('#sdKind').selectOption('batch_record');
      await f.locator('#sdSubject').fill('LOT-700');
      await f.locator('#sdRef').fill('BR-700');
      // double click: the first save is on its way, the second press does nothing
      await f.locator('[data-sdsave]').dblclick();
      // the database saved it, but the reply was lost: the page says it could not tell
      await expect(f.locator('[data-sdformmsg]')).toContainText(/Could not reach the database|try again/);
      expect(await db.query("select count(*) from supplier_documents where kind = 'batch_record'")).toBe('1');
      // the person presses Save again: same request key, so nothing is added
      await f.locator('[data-sdsave]').click();
      await expect(page.locator('#supplierDocsHost tr[data-dockey="batch_record"][data-subject="LOT-700"]')).toContainText('Awaiting review');
      expect(await db.query("select count(*) from supplier_documents where kind = 'batch_record'")).toBe('1');
      expect(db.calls.filter(c => c === 'rpc record_supplier_document').length).toBe(2);
      expect(db.calls).toContain('reply lost record_supplier_document');
    } finally { await db.close(); }
  });

  test('an administrator cannot approve, even if the page offered the button: the database refuses', async ({ page, backend }) => {
    // The page believes this is the owner (so it shows Approve); the database knows it is an administrator.
    const db = await pgBridge(page, { install: INSTALL, tables: TABLES, rpcs: RPCS, role: 'administrator', setupSql: SEED });
    try {
      await switchOn(page, true);
      await login(page); await open(page);
      const row = page.locator('#supplierDocsHost tr[data-dockey="certificate_of_analysis"][data-subject="LOT-700"]');
      await row.locator('[data-sdact="approved"]').click();
      await expect(page.locator('.toast', { hasText: 'Only the owner can approve or reject a supplier document.' })).toHaveCount(1);
      await expect(page.locator('#supplierDocsHost tr[data-dockey="certificate_of_analysis"][data-subject="LOT-700"]')).toContainText('Awaiting review');
      expect(await db.query("select status from supplier_documents where reference = 'COA-700'")).toBe('received');
      // nor change the checklist (after the section has redrawn from the database)
      await page.waitForLoadState('networkidle');
      await page.locator('[data-sdsettings] summary').click();
      await page.locator('[data-sdtype="other"] input[value="labels_printing"]').check();
      await page.locator('[data-sdtypesave="other"]').click();
      await expect(page.locator('.toast', { hasText: 'Only the owner can change the supplier document checklist.' })).toHaveCount(1);
      expect(await db.query("select count(*) from supplier_type_document_profiles where supplier_type = 'other'")).toBe('0');
    } finally { await db.close(); }
  });

  test('staff: no approve, reject or checklist controls; purchase documents not offered; may withdraw their own', async ({ page, backend }) => {
    await asRoleInPage(backend, 'employee');
    const db = await pgBridge(page, { install: INSTALL, tables: WITH_PROFILES, rpcs: RPCS, role: 'employee', setupSql: SEED });
    try {
      await switchOn(page, true);
      await login(page); await open(page);
      const host = page.locator('#supplierDocsHost');
      await expect(host.locator('[data-sdact="approved"], [data-sdact="rejected"]')).toHaveCount(0);
      await expect(host.locator('[data-sdsettings]')).toHaveCount(0);
      await expect(host).toContainText('Purchase documents are recorded by the owner or an administrator.');
      await expect(page.locator('#sdKind option[value="packing_slip"]')).toHaveCount(0);
      const f = page.locator('form[data-sdform]');
      await f.locator('#sdSupplier').selectOption(LAB);
      await f.locator('#sdKind').selectOption('batch_record');
      await f.locator('#sdSubject').fill('LOT-700');
      await f.locator('[data-sdsave]').click();
      const mine = host.locator('tr[data-dockey="batch_record"][data-subject="LOT-700"]');
      await expect(mine).toContainText('recorded by you');
      // the someone-else's certificate has no controls for staff; their own batch record can be withdrawn
      await expect(host.locator('tr[data-dockey="certificate_of_analysis"][data-subject="LOT-700"] [data-sdact]')).toHaveCount(0);
      await mine.locator('[data-sdreason]').fill('Recorded against the wrong lot');
      await mine.locator('[data-sdact="withdraw"]').click();
      await expect(host.locator('tr[data-dockey="batch_record"][data-subject="LOT-700"]')).toContainText('Missing');
      expect(await db.query("select status||'/'||withdraw_note from supplier_documents where kind = 'batch_record'")).toBe('withdrawn/Recorded against the wrong lot');
    } finally { await db.close(); }
  });

  test('owner changes the checklist for a kind of supplier; after a refresh the supplier is held to it', async ({ page }) => {
    const db = await pgBridge(page, { install: INSTALL, tables: TABLES, rpcs: RPCS, role: 'owner', setupSql: SEED +
      "insert into supplier_document_subjects (supplier_id, subject_kind, subject_ref, label) values ('" + LBL + "','artwork','ART-5','Honey Milk label v5');" });
    try {
      await switchOn(page, true);
      await login(page); await open(page);
      await expect(page.locator('[data-supplierdocs-supplier="' + LBL + '"] tr[data-dockey="approved_artwork"]')).toHaveCount(0);
      await page.locator('[data-sdsettings] summary').click();
      await page.locator('[data-sdtype="other"] input[value="labels_printing"]').check();
      await page.locator('[data-sdtypesave="other"]').click();
      await page.reload(); await expect(page.locator('#dash')).toBeVisible(); await open(page);
      const lbl = page.locator('[data-supplierdocs-supplier="' + LBL + '"]');
      await expect(lbl.locator('tr[data-dockey="approved_artwork"]')).toContainText('Missing');
      await expect(lbl.locator('tr[data-dockey="printer_proof"]')).toContainText('Missing');
      expect(await db.query("select count(*) from supplier_document_events where area = 'checklist' and by_user is not null")).toBe('1');
    } finally { await db.close(); }
  });
});
