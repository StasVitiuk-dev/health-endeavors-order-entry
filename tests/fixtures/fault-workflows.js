// Shared by fault-injection.spec.js and fault-injection-2.spec.js (EXT4):
// single-step actions, each with one database write, and how to read the
// value that write changes.

const { expect, gotoPage, OWNER_USER } = require('../helpers/dashboard');

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
  // ---- EXT5: more single-write actions, so every failure kind runs on them too ----
  { name: 'feature request: Mark in progress', table: 'feature_requests', method: 'PATCH', page: 'featureRequestsPanel',
    seed: b => { b.tables.feature_requests = [{ id: 'fr-1', title: 'SYNTHETIC request', description: null, priority: 'normal', status: 'requested', requested_at: '2026-09-20T00:00:00Z', deleted_at: null }]; },
    act: async page => { await page.click('#featureRequestsWrap [data-id="fr-1"] .frAdvanceBtn'); },
    value: b => b.tables.feature_requests[0].status, before: 'requested', after: 'in_progress' },
  { name: 'legal hold: Release', table: 'legal_holds', method: 'PATCH', page: 'legalHoldsPanel',
    seed: b => { b.tables.legal_holds = [{ id: 'lh-1', title: 'SYNTHETIC hold', description: null, related_type: 'order', related_reference: 'SYN-1', placed_at: '2026-09-20T00:00:00Z', status: 'active' }]; },
    act: async page => { await page.click('#legalHoldsWrap [data-id="lh-1"] .lhReleaseBtn'); await confirmPassword(page); },
    value: b => b.tables.legal_holds[0].status, before: 'active', after: 'released' },
  { name: 'adverse event: Mark reported to FDA', table: 'adverse_event_reports', method: 'PATCH', page: 'adverseEventsPanel',
    seed: b => { b.tables.adverse_event_reports = [{ id: 'ae-1', product_name: 'SYNTHETIC lotion', date_received: '2026-09-20', description: 'SYNTHETIC', outcome_type: 'other', fda_report_deadline: '2026-12-01', fda_reported: false, fda_reported_at: null, reporter_name: null, reporter_contact: null, created_at: '2026-09-20T00:00:00Z' }]; },
    act: async page => { const btn = page.locator('#adverseEventsWrap [data-id="ae-1"] .aeMarkReportedBtn'); await btn.click(); await btn.click(); },
    value: b => b.tables.adverse_event_reports[0].fda_reported, before: false, after: true },
  { name: 'expense: Restore', table: 'expenses', method: 'PATCH', page: 'expensesPanel', business: true,
    act: async page => { await page.click('#deletedExpensesWrap .restoreExpenseBtn'); },
    value: b => b.tables.expenses.find(e => e.id === 'e5').deleted_at === null, before: false, after: true },
  { name: 'recall: Mark resolved', table: 'recalls', method: 'PATCH', page: 'recallsPanel',
    seed: b => {
      b.tables.recalls = [{ id: 'rc-1', reason: 'SYNTHETIC', severity: 'high', status: 'quarantined', quantity_quarantined: 2, resolution: null, resolved_at: null, incident_id: null,
        created_at: '2026-09-20T00:00:00Z', lot_id: 'lot-1', product_id: 'prod-a', products: { name: 'SYNTHETIC A', sku: 'SYN-A' }, inventory_lots: { lot_number: 'L-1' }, incidents: null }];
      b.tables.inventory_lots = [{ id: 'lot-1', lot_number: 'L-1', product_id: 'prod-a', quantity_remaining: 5, products: { name: 'SYNTHETIC A', sku: 'SYN-A' } }];
    },
    act: async page => { const row = page.locator('#recallsPanel [data-id="rc-1"]'); await row.locator('.recallResolutionInput').fill('SYNTHETIC resolved'); await row.locator('.recallResolveBtn').click(); if (await page.locator('#reauthOverlay').isVisible()) await confirmPassword(page); },
    value: b => b.tables.recalls[0].status, before: 'quarantined', after: 'resolved' },
];

const RAW_INTERNALS = /row-level security|violates check constraint|evidence_locker|_policy|Failed to fetch|Load failed|NetworkError|TypeError/i;

module.exports = { WORKFLOWS, RAW_INTERNALS, open, confirmPassword };
