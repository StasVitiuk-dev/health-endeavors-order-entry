// Every "add" form survives a failed save and an impatient double click
// (owner priority of Nov 16: recovery from failed saves and duplicate clicks).
// The update buttons (approve, mark done, restore …) were already covered by
// the fault-injection tests; the add forms were not. For each of the 14 forms:
//   1. the server refuses the save: the person is told, what they typed is
//      still there, the button works again, and nothing was saved;
//      pressing it again then saves exactly one record;
//   2. a slow reply and a double click (or Enter pressed twice): exactly one
//      save is sent.
// Synthetic data; everything stays inside the test browser.
const { test, expect, login, gotoPage } = require('../helpers/dashboard');
const { seedBusiness } = require('../fixtures/business-data');
const { seedEveryPage } = require('../fixtures/every-page-rows');
const { enableWrites } = require('../helpers/stateful-backend');

// form id, the write it sends, the field whose typed text must survive a failure,
// and (where it is not an insert) the method of that write
const FORMS = [
  ['addProductForm', 'products', 'prodName'],
  ['addPoForm', 'purchase_orders', 'poNotes'],
  ['addSupplierForm', 'suppliers', 'supName'],
  ['addExpenseForm', 'expenses', 'expVendor'],
  // With the database stock function switched off (as in production today) the
  // first write is the stock row itself; the log row follows it.
  ['adjustInventoryForm', 'inventory', 'invReason', 'PATCH'],
  ['addReminderForm', 'manual_attention_items', 'reminderTitle'],
  ['addQcForm', 'quality_checks', 'qcDescription'],
  ['addRecallForm', 'recalls', 'recallReason'],
  ['addSopForm', 'sop_documents', 'sopTitle'],
  ['addFeatureRequestForm', 'feature_requests', 'frTitle'],
  ['addLegalHoldForm', 'legal_holds', 'lhTitle'],
  ['addDocumentForm', 'documents', 'docTitle'],
  ['addEvidenceForm', 'evidence_locker', 'evidenceTitle'],
  ['addAdverseEventForm', 'adverse_event_reports', 'aeProduct'],
];
const TABLES = FORMS.map(f => f[1]).filter(t => t !== 'inventory');

async function setUp(page, backend) {
  seedBusiness(backend); seedEveryPage(backend);
  backend.tables.feature_flags = (backend.tables.feature_flags || []).filter(f => !/^stock_fn_/.test(f.flag_key));
  enableWrites(backend, TABLES.concat(['inventory', 'inventory_adjustments']));
  await login(page);
  await page.waitForLoadState('networkidle');
}
// Opens the form's page and fills every visible field with plain made-up values.
async function fill(page, fid, keep) {
  const where = await page.evaluate(f => document.getElementById(f).closest('section.panel').id, fid);
  await gotoPage(page, where);
  await page.waitForLoadState('networkidle');
  const form = page.locator('#' + fid);
  const fields = await form.evaluate(f => [...f.querySelectorAll('input, select, textarea')]
    .filter(e => e.getClientRects().length && e.id && !['hidden', 'file', 'checkbox'].includes(e.type))
    .map(e => ({ id: e.id, tag: e.tagName, type: e.type, opt: e.tagName === 'SELECT' ? ([...e.options].map(o => o.value).filter(Boolean)[0] || null) : null })));
  for (const f of fields) {
    const loc = form.locator('#' + f.id);
    if (f.tag === 'SELECT') { if (f.opt) await loc.selectOption(f.opt); }
    else if (f.type === 'number') await loc.fill('2');
    else if (f.type === 'date') await loc.fill('2026-06-20');
    else if (f.type === 'datetime-local') await loc.fill('2026-06-20T10:00');
    else await loc.fill(f.id === keep ? 'SYNTHETIC typed by hand ' + fid : 'SYNTHETIC ' + f.id);
  }
  return form;
}
const submitOf = form => form.locator('button[type=submit], button:not([type])').first();
const sent = (backend, table, method) => backend.requests.filter(r => r.method === (method || 'POST') && r.table === table).length;
// For the stock adjustment the record is the adjustment log row.
const rows = (backend, table) => (backend.tables[table === 'inventory' ? 'inventory_adjustments' : table] || []).length;
// Whatever the page uses to say something went wrong: the banner, an error
// toast, or an error line in the form.
const errorShown = page => page.evaluate(() => [...document.querySelectorAll('#dashError, #toastHost .toast.err, .msg.error, [role=alert]')]
  .filter(e => e.getClientRects().length).map(e => e.textContent.trim()).filter(Boolean).join(' | '));

for (const [fid, table, keep, method] of FORMS) {
  const M = method || 'POST';
  test(`${fid}: a refused save is reported, keeps the typing, and a retry saves once`, async ({ page, backend }, ti) => {
    test.skip(ti.project.name !== 'desktop', 'one size is enough for the write logic');
    await setUp(page, backend);
    const form = await fill(page, fid, keep);
    const before = rows(backend, table);
    backend.failNext(table, M, { status: 500, body: { message: 'SYNTHETIC server error' } });
    const n0 = sent(backend, table, M);
    await submitOf(form).click();
    await expect.poll(() => sent(backend, table, M), { message: 'the save was attempted' }).toBe(n0 + 1);
    await expect.poll(() => errorShown(page), { message: 'the person is told it failed' }).not.toBe('');
    await expect(form.locator('#' + keep), 'what was typed is still there').toHaveValue('SYNTHETIC typed by hand ' + fid);
    await expect(submitOf(form), 'the button works again').toBeEnabled();
    expect(rows(backend, table), 'nothing was saved').toBe(before);
    // Retry: exactly one record.
    await submitOf(form).click();
    await expect.poll(() => sent(backend, table, M)).toBe(n0 + 2);
    await expect.poll(() => rows(backend, table), { message: 'the retry saved one record' }).toBe(before + 1);
    await page.waitForTimeout(300);
    expect(sent(backend, table, M), 'no extra save after the retry').toBe(n0 + 2);
  });

  test(`${fid}: a slow reply and a double click send one save`, async ({ page, backend }, ti) => {
    test.skip(ti.project.name !== 'desktop', 'one size is enough for the write logic');
    await setUp(page, backend);
    const form = await fill(page, fid, keep);
    const before = rows(backend, table);
    backend.delayNext(table, M, 1200);
    const n0 = sent(backend, table, M);
    await submitOf(form).dblclick();
    await page.keyboard.press('Enter').catch(() => {});
    await expect.poll(() => sent(backend, table, M)).toBeGreaterThanOrEqual(n0 + 1);
    await page.waitForTimeout(1800);
    expect(sent(backend, table, M), 'exactly one save was sent').toBe(n0 + 1);
    expect(rows(backend, table)).toBe(before + 1);
  });
}
