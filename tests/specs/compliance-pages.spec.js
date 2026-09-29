// Compliance pages: Quality Control, Adverse Event Reports and Legal Holds.
// What they show with data, and exactly what their buttons send. Verifies
// existing behaviour; synthetic data only (the mock answers every request).

const { test, expect, login, gotoPage, OWNER_USER } = require('../helpers/dashboard');

const writes = (backend, table) => backend.tableWrites().filter(r => r.table === table);
const filtersOf = r => Object.fromEntries(r.params.filter(([k]) => k !== 'select'));

async function open(page, id) {
  await gotoPage(page, id);
  await page.waitForLoadState('networkidle');
  const overlay = page.locator('#inspectorOverlay');
  if (await overlay.evaluate(el => el.classList.contains('open'))) await page.click('#insCloseBtn');
}

// ----------------------------------------------------------- quality control
const incidentInserts = [];

test.describe('Quality Control', () => {
  test.beforeEach(async ({ page, backend }) => {
    Object.assign(backend.tables, {
      products: [{ id: 'prod-a', name: 'SYNTHETIC product A', sku: 'SYN-A' }],
      inventory_lots: [{ id: 'lot-1', lot_number: 'SYN-LOT-1', product_id: 'prod-a', received_at: '2026-09-01T00:00:00Z' }],
      recalls: [{ lot_id: 'lot-1', product_id: 'prod-a', status: 'initiated' }],
      quality_checks: [
        { id: 'qc-fail', check_type: 'packaging_defect', result: 'fail', severity: 'critical', description: 'SYNTHETIC cracked caps', resolution: null, incident_id: null, created_at: '2026-09-20T00:00:00Z', product_id: 'prod-a', lot_id: 'lot-1', products: { name: 'SYNTHETIC product A', sku: 'SYN-A' }, inventory_lots: { lot_number: 'SYN-LOT-1' }, incidents: null },
        { id: 'qc-pass', check_type: 'incoming_inspection', result: 'pass', severity: 'low', description: 'SYNTHETIC all good', resolution: 'Resolved.', incident_id: null, created_at: '2026-09-19T00:00:00Z', product_id: 'prod-a', lot_id: null, products: { name: 'SYNTHETIC product A', sku: 'SYN-A' }, inventory_lots: null, incidents: null },
      ],
    });
    // The incident insert asks for the new id back; answer it here and keep
    // what was sent so the test can check it.
    incidentInserts.length = 0;
    await page.route('**/rest/v1/incidents?select=id', route => {
      if (route.request().method() !== 'POST') return route.fallback();
      incidentInserts.push(JSON.parse(route.request().postData()));
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 'inc-new' }) });
    });
    await login(page);
    await open(page, 'qualityControlPanel');
  });

  test('shows counts, results and the cross-link to an active recall', async ({ page }) => {
    await expect(page.locator('#qcStats')).toContainText('2');
    const fail = page.locator('#qcWrap [data-id="qc-fail"]');
    await expect(fail).toContainText('SYNTHETIC cracked caps');
    await expect(fail).toContainText('lot SYN-LOT-1');
    await expect(fail).toContainText('This batch also has an active recall');
    await expect(fail.locator('.qcEscalateBtn')).toBeVisible();
    await expect(page.locator('#qcWrap [data-id="qc-pass"] .qcResolveBtn')).toHaveCount(0);
  });

  test('logging a check tied to a batch sends exactly the check fields', async ({ page, backend }) => {
    await page.selectOption('#qcType', 'customer_complaint');
    await page.selectOption('#qcResult', 'fail');
    await page.selectOption('#qcSeverity', 'high');
    await page.selectOption('#qcTarget', 'lot:lot-1');
    await page.fill('#qcDescription', 'SYNTHETIC complaint');
    await page.click('#addQcForm button[type=submit]');
    await expect.poll(() => writes(backend, 'quality_checks').length).toBe(1);
    expect(writes(backend, 'quality_checks')[0].body).toEqual({
      check_type: 'customer_complaint', result: 'fail', severity: 'high',
      product_id: 'prod-a', lot_id: 'lot-1', description: 'SYNTHETIC complaint', created_by: OWNER_USER.id,
    });
  });

  test('a critical failure escalates to a product-safety incident and links back to it', async ({ page, backend }) => {
    await page.locator('#qcWrap [data-id="qc-fail"] .qcEscalateBtn').click();
    await expect.poll(() => writes(backend, 'quality_checks').length).toBe(1);
    expect(incidentInserts).toHaveLength(1);
    expect(incidentInserts[0]).toMatchObject({ category: 'product_safety', severity: 'critical', status: 'open', requires_approval: false, created_by: OWNER_USER.id });
    const link = writes(backend, 'quality_checks')[0];
    expect(link.body.incident_id).toBe('inc-new');
    expect(filtersOf(link)).toEqual({ id: 'eq.qc-fail' });
  });

  test('Mark resolved sends only the resolution note and time', async ({ page, backend }) => {
    const row = page.locator('#qcWrap [data-id="qc-fail"]');
    await row.locator('.qcResolutionInput').fill('SYNTHETIC replaced caps');
    await row.locator('.qcResolveBtn').click();
    await expect.poll(() => writes(backend, 'quality_checks').length).toBe(1);
    const [w] = writes(backend, 'quality_checks');
    expect(Object.keys(w.body).sort()).toEqual(['resolution', 'updated_at']);
    expect(w.body.resolution).toBe('SYNTHETIC replaced caps');
  });
});

// ---------------------------------------------------- adverse event reports
test.describe('Adverse Event Reports', () => {
  test.use({ timezoneId: 'America/Chicago' });
  test.beforeEach(async ({ page, backend }) => {
    const future = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
    Object.assign(backend.tables, {
      adverse_event_reports: [
        { id: 'ae-open', product_name: 'SYNTHETIC lotion', date_received: '2026-09-20', description: 'SYNTHETIC rash reported', outcome_type: 'required_medical_intervention', fda_report_deadline: future, fda_reported: false, fda_reported_at: null, reporter_name: null, reporter_contact: null, created_at: '2026-09-20T00:00:00Z' },
        { id: 'ae-late', product_name: 'SYNTHETIC lotion', date_received: '2026-08-01', description: 'SYNTHETIC old report', outcome_type: 'other', fda_report_deadline: '2026-08-21', fda_reported: false, fda_reported_at: null, reporter_name: null, reporter_contact: null, created_at: '2026-08-01T00:00:00Z' },
      ],
    });
    await login(page);
    await open(page, 'adverseEventsPanel');
  });

  test('shows days left, and overdue reports as overdue', async ({ page }) => {
    await expect(page.locator('#adverseEventsWrap [data-id="ae-open"]')).toContainText('days left');
    await expect(page.locator('#adverseEventsWrap [data-id="ae-late"]')).toContainText('OVERDUE');
  });

  test('logging a report sends exactly the report fields (the deadline is left to the database)', async ({ page, backend }) => {
    await page.fill('#aeProduct', 'SYNTHETIC lotion');
    await page.fill('#aeDateReceived', '2026-09-25');
    await page.fill('#aeDescription', 'SYNTHETIC itching');
    await page.click('#adverseEventsPanel form button[type=submit]');
    await expect.poll(() => writes(backend, 'adverse_event_reports').length).toBe(1);
    expect(writes(backend, 'adverse_event_reports')[0].body).toEqual({
      product_name: 'SYNTHETIC lotion', date_received: '2026-09-25', description: 'SYNTHETIC itching',
      outcome_type: null, reporter_name: null, reporter_contact: null, created_by: OWNER_USER.id,
    });
  });

  test('"Mark reported to FDA" sends only the reported flag and time', async ({ page, backend }) => {
    await page.locator('#adverseEventsWrap [data-id="ae-open"] .aeMarkReportedBtn').click();
    await expect.poll(() => writes(backend, 'adverse_event_reports').length).toBe(1);
    const [w] = writes(backend, 'adverse_event_reports');
    expect(Object.keys(w.body).sort()).toEqual(['fda_reported', 'fda_reported_at']);
    expect(w.body.fda_reported).toBe(true);
    expect(filtersOf(w)).toEqual({ id: 'eq.ae-open' });
  });
});

// --------------------------------------------------------------- legal holds
test.describe('Legal Holds', () => {
  test.beforeEach(async ({ page, backend }) => {
    backend.tables.legal_holds = [
      { id: 'lh-1', title: 'SYNTHETIC order dispute', description: null, related_type: 'order', related_reference: 'SYN-1001', placed_at: '2026-09-20T00:00:00Z', status: 'active' },
      { id: 'lh-2', title: 'SYNTHETIC released hold', description: null, related_type: null, related_reference: null, placed_at: '2026-09-01T00:00:00Z', status: 'released', released_at: '2026-09-10T00:00:00Z' },
    ];
    await login(page);
    await open(page, 'legalHoldsPanel');
  });

  test('only active holds are in the active list', async ({ page }) => {
    await expect(page.locator('#legalHoldsWrap')).toContainText('SYNTHETIC order dispute');
    await expect(page.locator('#legalHoldsWrap')).toContainText('Reference: SYN-1001');
    await expect(page.locator('#legalHoldsWrap')).not.toContainText('SYNTHETIC released hold');
  });

  test('placing a hold sends exactly the hold fields', async ({ page, backend }) => {
    await page.fill('#lhTitle', 'SYNTHETIC new hold');
    await page.click('#addLegalHoldForm button[type=submit]');
    await expect.poll(() => writes(backend, 'legal_holds').length).toBe(1);
    expect(writes(backend, 'legal_holds')[0].body).toEqual({
      title: 'SYNTHETIC new hold', description: null, related_type: null, related_reference: null, placed_by: OWNER_USER.id,
    });
  });

  test('releasing a hold records released, when and by whom (nothing is deleted)', async ({ page, backend }) => {
    await page.locator('#legalHoldsWrap [data-id="lh-1"] .lhReleaseBtn').click();
    await expect.poll(() => writes(backend, 'legal_holds').length).toBe(1);
    const [w] = writes(backend, 'legal_holds');
    expect(w.method).toBe('PATCH');
    expect(Object.keys(w.body).sort()).toEqual(['released_at', 'released_by', 'status']);
    expect(w.body.status).toBe('released');
    expect(filtersOf(w)).toEqual({ id: 'eq.lh-1' });
  });
});
