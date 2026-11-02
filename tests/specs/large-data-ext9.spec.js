// EXT9 (workstream 16): thousands of tasks, incidents, approvals and purchase
// orders. The Home checks read everything in pages (counts stay exact) and
// draw in reasonable time; long lists say they are cut. Synthetic data only.
const { test, expect, login, gotoPage } = require('../helpers/dashboard');

test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'scale; run once'); });

const AT = i => new Date(Date.UTC(2025, 0, 1) + i * 60000).toISOString();
function seed(backend) {
  const N_TASKS = 5000, N_INC = 2000, N_APP = 1500, N_PO = 1200;
  backend.tables.tasks = Array.from({ length: N_TASKS }, (_, i) => ({ id: 'tk-' + i, title: 'SYNTHETIC task ' + i, priority: 'normal', status: i % 2 ? 'open' : 'in_progress',
    due_at: AT(i), created_at: AT(i), updated_at: AT(i) }));
  backend.tables.incidents = Array.from({ length: N_INC }, (_, i) => ({ id: 'in-' + i, incident_number: 'INC-' + i, title: 'SYNTHETIC incident ' + i, severity: i % 10 ? 'low' : 'high', status: 'open', due_at: AT(i), created_at: AT(i) }));
  backend.tables.approval_requests = Array.from({ length: N_APP }, (_, i) => ({ id: 'ap-' + i, action_type: 'refund', summary: 'SYNTHETIC approval ' + i, status: 'pending', created_at: AT(i) }));
  backend.tables.purchase_orders = Array.from({ length: N_PO }, (_, i) => ({ id: 'po-' + i, po_number: 'PO-' + i, status: 'ordered', supplier_id: null, currency: 'USD', shipping_cost: 0, tax: 0,
    payment_status: 'unpaid', expected_at: '2025-01-01', created_at: AT(i), deleted_at: null, purchase_order_items: [] }));
  return { N_TASKS, N_INC, N_APP, N_PO };
}

test('Home checks over thousands of open records: exact counts, drawn within 20 s', async ({ page, backend }) => {
  test.setTimeout(120000);
  const n = seed(backend);
  const t0 = Date.now();
  await login(page);
  const row = key => page.locator(`#attnChecksWrap .attnCheck[data-key="${key}"]`);
  await expect(row('overdueTasks')).toContainText(new RegExp('Overdue tasks: ' + n.N_TASKS.toLocaleString('en-US').replace(',', ',?')), { timeout: 20000 });
  await expect(row('pendingApprovals')).toContainText(String(n.N_APP));
  await expect(row('lateDeliveries')).toContainText(String(n.N_PO));
  expect(Date.now() - t0).toBeLessThan(20000);
});

test('Tasks, Incidents and Approvals with thousands of open items say how many are shown', async ({ page, backend }) => {
  test.setTimeout(120000);
  const n = seed(backend);
  await login(page);
  await gotoPage(page, 'tasksPanel');
  await expect(page.locator('#tasksPanel')).toContainText(`of ${n.N_TASKS} open tasks`);
  await gotoPage(page, 'incidentsPanel');
  await expect(page.locator('#incidentsPanel')).toContainText(`of ${n.N_INC} open incidents`);
  await gotoPage(page, 'approvalsPanel');
  await expect(page.locator('#approvalsPanel')).toContainText(`of ${n.N_APP} pending requests`);
});
