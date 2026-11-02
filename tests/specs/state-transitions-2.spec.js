// State machines, part 2 (2026-10-06, extension 4, workstream B).
// Part 1 (state-transitions.spec.js) covers tasks, returns and purchase
// orders. This covers approvals, feature requests, legal holds, the FDA flag
// on adverse events, recall resolution, and order / expense delete-restore.
//
// Each case: the page shows one state; before the click, another tab (or an
// agent) moves the record to each possible state. The write must apply only
// from an allowed state; otherwise nothing changes and the page says so.
// A double click must apply a step once.

const { test, expect, login, gotoPage, OWNER_USER } = require('../helpers/dashboard');
const { enableWrites } = require('../helpers/stateful-backend');
const { NOW, seedBusiness } = require('../fixtures/business-data');

test.use({ timezoneId: 'America/Chicago', locale: 'en-US' });
test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'state matrix; run once'); });

async function open(page, id) {
  await gotoPage(page, id);
  await page.waitForLoadState('networkidle');
  const overlay = page.locator('#inspectorOverlay');
  if (await overlay.evaluate(el => el.classList.contains('open'))) await page.click('#insCloseBtn');
}
async function password(page) {
  await expect(page.locator('#reauthOverlay')).toBeVisible();
  await page.fill('#reauthPassword', OWNER_USER.password);
  await page.click('#reauthConfirmBtn');
}

const CASES = [
  {
    name: 'approval Approve', table: 'approval_requests', page: 'approvalsPanel',
    seed: b => { b.tables.approval_requests = [{ id: 'ap-1', action_type: 'refund_cancellation_review', summary: 'SYNTHETIC request', status: 'pending', created_at: '2026-09-20T00:00:00Z' }]; },
    act: async page => { await page.click('.approvalRow[data-id="ap-1"] .approveBtn'); await password(page); },
    states: ['pending', 'approved', 'rejected'], allowed: ['pending'], target: 'approved',
    get: b => b.tables.approval_requests[0].status, set: (b, v) => { b.tables.approval_requests[0].status = v; },
  },
  {
    name: 'approval Deny', table: 'approval_requests', page: 'approvalsPanel',
    seed: b => { b.tables.approval_requests = [{ id: 'ap-1', action_type: 'refund_cancellation_review', summary: 'SYNTHETIC request', status: 'pending', created_at: '2026-09-20T00:00:00Z' }]; },
    act: async page => { await page.click('.approvalRow[data-id="ap-1"] .denyBtn'); await password(page); },
    states: ['pending', 'approved', 'rejected'], allowed: ['pending'], target: 'rejected',
    get: b => b.tables.approval_requests[0].status, set: (b, v) => { b.tables.approval_requests[0].status = v; },
  },
  {
    name: 'feature request "Mark in progress"', table: 'feature_requests', page: 'featureRequestsPanel',
    seed: b => { b.tables.feature_requests = [{ id: 'fr-1', title: 'SYNTHETIC request', description: null, priority: 'normal', status: 'requested', requested_at: '2026-09-20T00:00:00Z', deleted_at: null }]; },
    act: async page => { await page.click('#featureRequestsWrap [data-id="fr-1"] .frAdvanceBtn'); },
    states: ['requested', 'in_progress', 'done'], allowed: ['requested'], target: 'in_progress',
    get: b => b.tables.feature_requests[0].status, set: (b, v) => { b.tables.feature_requests[0].status = v; },
  },
  {
    name: 'legal hold Release', table: 'legal_holds', page: 'legalHoldsPanel',
    seed: b => { b.tables.legal_holds = [{ id: 'lh-1', title: 'SYNTHETIC hold', description: null, related_type: 'order', related_reference: 'SYN-1', placed_at: '2026-09-20T00:00:00Z', status: 'active' }]; },
    act: async page => { await page.click('#legalHoldsWrap [data-id="lh-1"] .lhReleaseBtn'); await password(page); },
    states: ['active', 'released'], allowed: ['active'], target: 'released',
    get: b => b.tables.legal_holds[0].status, set: (b, v) => { b.tables.legal_holds[0].status = v; },
  },
  {
    name: 'adverse event "Mark reported to FDA"', table: 'adverse_event_reports', page: 'adverseEventsPanel',
    seed: b => { b.tables.adverse_event_reports = [{ id: 'ae-1', product_name: 'SYNTHETIC lotion', date_received: '2026-09-20', description: 'SYNTHETIC', outcome_type: 'other', fda_report_deadline: '2026-12-01', fda_reported: false, fda_reported_at: null, reporter_name: null, reporter_contact: null, created_at: '2026-09-20T00:00:00Z' }]; },
    act: async page => { const btn = page.locator('#adverseEventsWrap [data-id="ae-1"] .aeMarkReportedBtn'); await btn.click(); await btn.click(); },
    states: [false, true], allowed: [false], target: true,
    get: b => b.tables.adverse_event_reports[0].fda_reported, set: (b, v) => { b.tables.adverse_event_reports[0].fda_reported = v; },
  },
  {
    name: 'recall "Mark resolved" (shown as quarantined)', table: 'recalls', page: 'recallsPanel',
    seed: b => {
      b.tables.recalls = [{ id: 'rc-1', reason: 'SYNTHETIC', severity: 'high', status: 'quarantined', quantity_quarantined: 2, resolution: null, resolved_at: null, incident_id: null,
        created_at: '2026-09-20T00:00:00Z', lot_id: 'lot-1', product_id: 'prod-a', products: { name: 'SYNTHETIC A', sku: 'SYN-A' }, inventory_lots: { lot_number: 'L-1' }, incidents: null }];
      b.tables.inventory_lots = [{ id: 'lot-1', lot_number: 'L-1', product_id: 'prod-a', quantity_remaining: 5, products: { name: 'SYNTHETIC A', sku: 'SYN-A' } }];
    },
    act: async page => { const row = page.locator('#recallsPanel [data-id="rc-1"]'); await row.locator('.recallResolutionInput').fill('SYNTHETIC resolved'); await row.locator('.recallResolveBtn').click(); await password(page).catch(() => {}); },
    states: ['initiated', 'quarantined', 'resolved'], allowed: ['quarantined'], target: 'resolved',
    get: b => b.tables.recalls[0].status, set: (b, v) => { b.tables.recalls[0].status = v; },
  },
  {
    name: 'expense Delete (shown on file)', table: 'expenses', page: 'expensesPanel', business: true,
    act: async page => { await page.click('#expensesWrap .approvalRow[data-id="e1"] .expDeleteBtn'); },
    states: [null, '2026-06-14T00:00:00Z'], allowed: [null], target: 'deleted',
    get: b => (b.tables.expenses.find(e => e.id === 'e1').deleted_at ? 'deleted' : null),
    set: (b, v) => { b.tables.expenses.find(e => e.id === 'e1').deleted_at = v; },
    norm: v => (v ? 'deleted' : null),
  },
  {
    name: 'expense Restore (shown deleted)', table: 'expenses', page: 'expensesPanel', business: true,
    act: async page => { await page.click('#deletedExpensesWrap .restoreExpenseBtn'); },
    states: ['2026-06-14T00:00:00Z', null], allowed: ['deleted'], target: null,
    get: b => (b.tables.expenses.find(e => e.id === 'e5').deleted_at ? 'deleted' : null),
    set: (b, v) => { b.tables.expenses.find(e => e.id === 'e5').deleted_at = v; },
    norm: v => (v ? 'deleted' : null),
  },
  {
    name: 'feature request Restore (shown deleted)', table: 'feature_requests', page: 'featureRequestsPanel',
    seed: b => { b.tables.feature_requests = [{ id: 'fr-1', title: 'SYNTHETIC request', description: null, priority: 'normal', status: 'requested', requested_at: '2026-09-20T00:00:00Z', deleted_at: '2026-09-21T00:00:00Z' }]; },
    act: async page => { await page.click('#deletedFeatureRequestsWrap .restoreFeatureRequestBtn'); },
    states: ['2026-09-21T00:00:00Z', null], allowed: ['deleted'], target: null,
    get: b => (b.tables.feature_requests[0].deleted_at ? 'deleted' : null),
    set: (b, v) => { b.tables.feature_requests[0].deleted_at = v; },
    norm: v => (v ? 'deleted' : null),
  },
];

for (const c of CASES) {
  for (const actual of c.states) {
    test(`${c.name}: shown as allowed, actually ${JSON.stringify(actual)}`, async ({ page, backend }) => {
      if (c.business) seedBusiness(backend); else c.seed(backend);
      enableWrites(backend, [c.table]);
      await page.clock.setFixedTime(NOW);
      await login(page);
      await open(page, c.page);
      c.set(backend, actual);
      const norm = c.norm || (v => v);
      await c.act(page);
      const ok = c.allowed.includes(norm(actual));
      if (ok) await expect.poll(() => c.get(backend)).toEqual(c.target);
      else {
        await expect(page.locator('#dashError')).toBeVisible();
        expect(c.get(backend)).toEqual(norm(actual));
        await expect(page.locator('#toastHost .toast.ok')).toHaveCount(0);
      }
    });
  }
}

test('feature request: a double click moves it one step, not two', async ({ page, backend }) => {
  backend.tables.feature_requests = [{ id: 'fr-1', title: 'SYNTHETIC request', description: null, priority: 'normal', status: 'requested', requested_at: '2026-09-20T00:00:00Z', deleted_at: null }];
  enableWrites(backend, ['feature_requests']);
  await login(page);
  await open(page, 'featureRequestsPanel');
  const btn = page.locator('#featureRequestsWrap [data-id="fr-1"] .frAdvanceBtn');
  await btn.dblclick();
  await expect.poll(() => backend.tables.feature_requests[0].status).toBe('in_progress');
  await page.waitForLoadState('networkidle');
  expect(backend.tables.feature_requests[0].status).toBe('in_progress');
});
