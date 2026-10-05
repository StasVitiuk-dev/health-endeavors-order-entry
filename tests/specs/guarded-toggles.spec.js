// The smaller on/off and status buttons also change a row only from the state
// the page showed, so an old tab can't flip something back.

const { test, expect, login, gotoPage } = require('../helpers/dashboard');

const writes = (backend, table) => backend.tableWrites().filter(r => r.table === table);
const filtersOf = r => Object.fromEntries(r.params.filter(([k]) => k !== 'select'));
async function open(page, id) {
  await gotoPage(page, id);
  await page.waitForLoadState('networkidle');
  const overlay = page.locator('#inspectorOverlay');
  if (await overlay.evaluate(el => el.classList.contains('open'))) await page.click('#insCloseBtn');
}

test.describe('Suppliers: deactivate / reactivate', () => {
  test.beforeEach(async ({ page, backend }) => {
    backend.tables.suppliers = [
      { id: 'sup-1', name: 'SYNTHETIC Active', supplier_type: 'manufacturer', contact_name: null, email: null, phone: null, notes: null, is_active: true },
      { id: 'sup-2', name: 'SYNTHETIC Unset', supplier_type: 'lab', contact_name: null, email: null, phone: null, notes: null, is_active: null },
    ];
    await login(page);
    await open(page, 'suppliersPanel');
  });

  test('deactivating applies only while still active', async ({ page, backend }) => {
    await page.locator('.supRow[data-id="sup-1"] .supToggleBtn').click();
    await expect.poll(() => writes(backend, 'suppliers').length).toBe(1);
    expect(filtersOf(writes(backend, 'suppliers')[0])).toEqual({ id: 'eq.sup-1', is_active: 'is.true' });
    expect(backend.tables.suppliers[0].is_active).toBe(false);
  });

  test('reactivating a supplier stored as empty (null) works, guarded as "not true"', async ({ page, backend }) => {
    await page.locator('.supRow[data-id="sup-2"] .supToggleBtn').click();
    await expect.poll(() => backend.tables.suppliers[1].is_active).toBe(true);
    expect(filtersOf(writes(backend, 'suppliers')[0])).toEqual({ id: 'eq.sup-2', is_active: 'not.is.true' });
  });

  test('a stale page cannot re-activate a supplier deactivated elsewhere', async ({ page, backend }) => {
    backend.tables.suppliers[0].is_active = false; // changed in another tab
    await page.locator('.supRow[data-id="sup-1"] .supToggleBtn').click(); // page still shows "Deactivate"
    await expect(page.locator('#dashError')).toContainText('already changed');
    expect(backend.tables.suppliers[0].is_active).toBe(false);
  });
});

test.describe('Customer inquiries: Mark as answered', () => {
  test.beforeEach(async ({ page, backend }) => {
    const base = { channel: 'email', order_id: null, customer_email: 'syn@example.test', ai_confidence: 0.8, sensitive: false, sensitive_reasons: null, drafted_at: null, answered_at: null };
    backend.tables.customer_inquiries = [{ ...base, id: 'inq-1', customer_name: 'SYNTHETIC', question_text: 'SYNTHETIC question', status: 'drafted', severity: 'low', ai_draft_reply: 'SYNTHETIC draft', created_at: '2026-09-22T00:00:00Z' }];
    backend.tables.orders = [];
    await login(page);
    await open(page, 'inquiriesPanel');
  });

  test('applies only from the status the page showed', async ({ page, backend }) => {
    await page.locator('.inqAnsweredBtn[data-id="inq-1"]').click();
    await expect.poll(() => backend.tables.customer_inquiries[0].status).toBe('answered');
    expect(filtersOf(writes(backend, 'customer_inquiries')[0])).toEqual({ id: 'eq.inq-1', status: 'eq.drafted' });
  });
});

test('an agent switch stored as empty (null) shows on, and pausing it works (guard "not false")', async ({ page, backend }) => {
  const { OWNER_USER } = require('../helpers/dashboard');
  backend.tables.agent_controls = [{ agent_num: 4, enabled: null, updated_by: null, updated_at: null }];
  await login(page);
  await open(page, 'aiPanel');
  const card = page.locator('#agentRegistryWrap .deletedRow[data-agent="4"]');
  await expect(card.locator('.agentToggle')).toBeChecked();
  await card.locator('.slider').click();
  await expect(page.locator('#reauthOverlay')).toBeVisible();
  await page.fill('#reauthPassword', OWNER_USER.password);
  await page.click('#reauthConfirmBtn');
  await expect.poll(() => backend.tables.agent_controls[0].enabled).toBe(false);
  expect(filtersOf(writes(backend, 'agent_controls')[0])).toEqual({ agent_num: 'eq.4', enabled: 'not.is.false' });
});
