// Failure-injection matrix (2026-10-06, EXT3 workstream 3).
//
// Every single-step action below is run five times, each time with a
// different failure on its one database write:
//   server500  – the database answers with an error
//   rls403     – a row-level-security refusal (raw text names the table/policy)
//   constraint – a CHECK-rule refusal (raw text names the constraint)
//   dropBefore – the connection drops before the database saved anything
//   dropAfter  – the connection drops AFTER the database saved the change
// Rules checked every time:
//   * never a success message;
//   * an error is shown, without internal table/policy/constraint names and
//     without the raw browser text ("Failed to fetch");
//   * refused / dropped-before: the record is unchanged;
//   * dropped-after: the record IS changed, and the page says it cannot tell
//     whether the change was saved (never "nothing was changed").
// Multi-step workflows (receive, refund, quarantine, uploads) have their own
// step-by-step failure tests (po-receive, failure-recovery, storage-safety)
// and, for true all-or-nothing behaviour, need the R1–R5 database functions.

const { test, expect, login, gotoPage, OWNER_USER } = require('../helpers/dashboard');
const { enableWrites } = require('../helpers/stateful-backend');
const { NOW, seedBusiness } = require('../fixtures/business-data');

test.use({ timezoneId: 'America/Chicago', locale: 'en-US' });
test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'fault matrix; run once'); });

const FAULTS = {
  server500: b => b.failNext,
  rls403: null, constraint: null, dropBefore: null, dropAfter: null,
};

async function confirmPassword(page) {
  await expect(page.locator('#reauthOverlay')).toBeVisible();
  await page.fill('#reauthPassword', OWNER_USER.password);
  await page.click('#reauthConfirmBtn');
  await expect(page.locator('#reauthOverlay')).toBeHidden();
}
async function open(page, id) {
  await gotoPage(page, id);
  await page.waitForLoadState('networkidle');
  const overlay = page.locator('#inspectorOverlay');
  if (await overlay.evaluate(el => el.classList.contains('open'))) await page.click('#insCloseBtn');
}

// Each workflow: tables to persist, seed, page, action, and how to read the
// value that the action changes.
const WORKFLOWS = [
  { name: 'task: Mark in progress', table: 'tasks', method: 'PATCH', page: 'tasksPanel',
    seed: b => { b.tables.tasks = [{ id: 't1', title: 'SYNTHETIC task', priority: 'normal', status: 'open', due_at: '2026-12-01T00:00:00Z' }]; },
    act: async page => { await page.locator('#tasksTableWrap .taskStatusBtn', { hasText: 'Mark in progress' }).click(); },
    value: b => b.tables.tasks[0].status, before: 'open', after: 'in_progress' },
  { name: 'approval: Approve', table: 'approval_requests', method: 'PATCH', page: 'approvalsPanel',
    seed: b => { b.tables.approval_requests = [{ id: 'ap-1', action_type: 'refund_cancellation_review', summary: 'SYNTHETIC request', status: 'pending', created_at: '2026-09-20T00:00:00Z' }]; },
    act: async page => { await page.click('#approvalsWrap .approveBtn'); await confirmPassword(page); },
    value: b => b.tables.approval_requests[0].status, before: 'pending', after: 'approved' },
  { name: 'product: Deactivate', table: 'products', method: 'PATCH', page: 'inventoryPanel', business: true,
    act: async page => {
      const row = page.locator('#inventoryWrap [data-product-id="prod-b"]');
      await row.locator('.editProductBtn').click(); // Deactivate sits in the edit panel
      await row.locator('.toggleProductBtn').click();
    },
    value: b => b.tables.products.find(p => p.id === 'prod-b').is_active, before: true, after: false },
  { name: 'expense: Delete', table: 'expenses', method: 'PATCH', page: 'expensesPanel', business: true,
    act: async page => { await page.locator('#expensesWrap .approvalRow[data-id="e1"] .expDeleteBtn').click(); },
    value: b => b.tables.expenses.find(e => e.id === 'e1').deleted_at === null, before: true, after: false },
  { name: 'order: Restore', table: 'orders', method: 'PATCH', page: 'ordersPanel', business: true,
    act: async page => { await page.locator('#deletedOrdersWrap .restoreOrderBtn').click(); await confirmPassword(page); },
    value: b => b.tables.orders.find(o => o.id === 'o6').deleted_at === null, before: false, after: true },
  { name: 'return: Approve', table: 'returns', method: 'PATCH', page: 'returnsPanel', business: true,
    act: async page => { await page.locator('#returnsWrap [data-return-id="ret-requested"] .decideReturnBtn[data-next="approved"]').click(); },
    value: b => b.tables.returns.find(r => r.id === 'ret-requested').status, before: 'requested', after: 'approved' },
  { name: 'purchase order: Mark as ordered', table: 'purchase_orders', method: 'PATCH', page: 'purchaseOrdersPanel',
    seed: b => Object.assign(b.tables, {
      suppliers: [{ id: 'sup-1', name: 'SYNTHETIC Supplier', supplier_type: 'manufacturer', contact_name: null, email: null, phone: null, notes: null, is_active: true }],
      products: [], purchase_order_items: [], inventory_lots: [],
      purchase_orders: [{ id: 'po-d', po_number: 'PO-D', supplier_id: 'sup-1', status: 'draft', currency: 'USD', shipping_cost: 0, tax: 0, expense_category: 'packaging',
        ordered_at: null, expected_at: null, received_at: null, payment_status: 'unpaid', notes: null, created_at: '2026-09-01T00:00:00Z', deleted_at: null,
        suppliers: { name: 'SYNTHETIC Supplier' }, purchase_order_items: [] }],
    }),
    act: async page => {
      await page.locator('.poItem[data-id="po-d"] .poRow').click();
      if (await page.locator('#inspectorOverlay').evaluate(el => el.classList.contains('open'))) await page.click('#insCloseBtn');
      await page.locator('#poDetail_po-d .poStatusBtn', { hasText: 'Mark as ordered' }).click();
    },
    value: b => b.tables.purchase_orders[0].status, before: 'draft', after: 'ordered' },
  { name: 'business rule: Save value', table: 'business_rules', method: 'PATCH', page: 'businessRulesPanel',
    seed: b => { b.tables.business_rules = [{ id: 'br-1', rule_key: 'refund_review_threshold_usd', label: 'SYNTHETIC Refund review', description: 'SYNTHETIC', config: { amount: 100 }, is_active: true }]; },
    act: async page => {
      const row = page.locator('#businessRulesWrap .flagRow[data-id="br-1"]');
      await row.locator('.ruleValueInput').fill('250');
      await row.locator('.ruleSaveBtn').click();
      await confirmPassword(page);
    },
    value: b => b.tables.business_rules[0].config.amount, before: 100, after: 250 },
  { name: 'feature flag: turn on', table: 'feature_flags', method: 'PATCH', page: 'flagsPanel',
    seed: b => { b.tables.feature_flags = [{ id: 'ff-x', flag_key: 'synthetic_test_flag', label: 'SYNTHETIC flag', description: 'SYNTHETIC', enabled: false }]; },
    act: async page => { await page.locator('.flagRow[data-id="ff-x"] .slider').click(); await confirmPassword(page); },
    value: b => b.tables.feature_flags[0].enabled, before: false, after: true },
];

const RAW_INTERNALS = /row-level security|violates check constraint|evidence_locker|_policy|Failed to fetch|Load failed|NetworkError|TypeError/i;

for (const w of WORKFLOWS) {
  for (const fault of Object.keys(FAULTS)) {
    test(`${w.name} — ${fault}`, async ({ page, backend }) => {
      if (w.business) seedBusiness(backend); else if (w.seed) w.seed(backend);
      enableWrites(backend, [w.table]);
      backend.expectViolations = fault === 'constraint';
      await page.clock.setFixedTime(NOW);
      await login(page);
      await open(page, w.page);
      expect(w.value(backend)).toEqual(w.before);

      if (fault === 'server500') backend.failNext(w.table, w.method, { status: 500, body: { message: 'Synthetic server error' } });
      if (fault === 'rls403') backend.failNext(w.table, w.method, { status: 403, body: { code: '42501', message: `new row violates row-level security policy for table "${w.table}"` } });
      if (fault === 'constraint') backend.failNext(w.table, w.method, { status: 400, body: { code: '23514', message: `new row for relation "${w.table}" violates check constraint "${w.table}_synthetic_check"` } });
      if (fault === 'dropBefore') backend.dropNext(w.table, w.method, { applied: false });
      if (fault === 'dropAfter') backend.dropNext(w.table, w.method, { applied: true });

      await w.act(page);
      const err = page.locator('#dashError');
      await expect(err).toBeVisible();
      const text = (await err.textContent()) || '';
      expect(text, 'no internal names or raw browser text').not.toMatch(RAW_INTERNALS);
      await expect(page.locator('#toastHost .toast.ok')).toHaveCount(0);

      if (fault === 'dropAfter') {
        expect(w.value(backend), 'the database did save it').toEqual(w.after);
        expect(text).toContain('cannot tell whether');
        expect(text).not.toMatch(/nothing was (changed|saved)/i);
      } else {
        expect(w.value(backend), 'nothing changed').toEqual(w.before);
      }
      if (fault === 'dropBefore') expect(text).toContain('cannot tell whether');
      if (fault === 'rls403') expect(text).toContain('only the Owner or an Administrator');
    });
  }
}
