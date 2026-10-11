// EXT7 (workstreams A/E): write paths that had no or thin stale-tab tests:
// Business Continuity status, the SOP "agent may reference" switch and adding
// a supplier. Each change applies only from what the page showed, an old tab
// is told and shown the real state, and nothing unknown is shown as fine.
// Synthetic data only.

const { test, expect, login, gotoPage } = require('../helpers/dashboard');
const { enableWrites } = require('../helpers/stateful-backend');

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'write logic; run once'); });

const writes = (backend, table) => backend.tableWrites().filter(r => r.table === table);
const filtersOf = r => Object.fromEntries(r.params.filter(([k]) => k !== 'select'));
async function open(page, id) {
  await gotoPage(page, id);
  await page.waitForLoadState('networkidle');
  const overlay = page.locator('#inspectorOverlay');
  if (await overlay.evaluate(el => el.classList.contains('open'))) await page.click('#insCloseBtn');
}

test.describe('Business Continuity status', () => {
  test.beforeEach(async ({ backend }) => {
    backend.tables.service_status = [
      { id: 'svc-1', service_name: 'SYNTHETIC Email', category: 'comms', status: 'operational', notes: null, updated_at: '2026-10-01T10:00:00Z' },
      { id: 'svc-2', service_name: 'SYNTHETIC Printer', category: 'office', status: 'maintenance', notes: null, updated_at: '2026-10-01T10:00:00Z' },
      { id: 'svc-3', service_name: 'SYNTHETIC Phone', category: 'comms', status: null, notes: null, updated_at: '2026-10-01T10:00:00Z' },
    ];
  });
  const select = (page, id) => page.locator(`.continuityStatusSelect[data-id="${id}"]`);

  test('a change applies only while the status is still the one shown', async ({ page, backend }) => {
    await login(page);
    await open(page, 'continuityPanel');
    await select(page, 'svc-1').selectOption('down');
    await expect.poll(() => writes(backend, 'service_status').length).toBe(1);
    const w = writes(backend, 'service_status')[0];
    expect(w.body.status).toBe('down');
    expect(filtersOf(w)).toEqual({ id: 'eq.svc-1', status: 'eq.operational' });
    await expect(select(page, 'svc-1')).toHaveValue('down');
  });

  test('stale tab: changed elsewhere meanwhile, nothing is overwritten and the real status shows', async ({ page, backend }) => {
    await login(page);
    await open(page, 'continuityPanel');
    backend.tables.service_status[0].status = 'degraded'; // another tab
    await select(page, 'svc-1').selectOption('down');
    await expect(page.locator('#dashError')).toContainText('changed');
    expect(backend.tables.service_status[0].status).toBe('degraded');
    await expect(select(page, 'svc-1')).toHaveValue('degraded');
  });

  test('an unknown or missing status is shown as Unknown, never as Operational', async ({ page, backend }) => {
    await login(page);
    await open(page, 'continuityPanel');
    await expect(select(page, 'svc-2').locator('option:checked')).toHaveText('Unknown (maintenance)');
    await expect(select(page, 'svc-3').locator('option:checked')).toHaveText('Unknown (not set)');
    const stats = page.locator('#continuityStats');
    await expect(stats.locator('.stat', { hasText: 'Operational' }).locator('.num')).toHaveText('1');
    await expect(stats.locator('.stat', { hasText: 'Unknown / not set' }).locator('.num')).toHaveText('2');
    // Choosing a real status from Unknown is guarded on the unknown value.
    await select(page, 'svc-2').selectOption('operational');
    await expect.poll(() => writes(backend, 'service_status').length).toBe(1);
    expect(filtersOf(writes(backend, 'service_status')[0])).toEqual({ id: 'eq.svc-2', status: 'eq.maintenance' });
    await select(page, 'svc-3').selectOption('down');
    await expect.poll(() => writes(backend, 'service_status').length).toBe(2);
    expect(filtersOf(writes(backend, 'service_status')[1])).toEqual({ id: 'eq.svc-3', status: 'is.null' });
  });
});

test.describe('SOP "agent may reference" switch', () => {
  test.beforeEach(async ({ backend }) => {
    backend.tables.sop_documents = [
      { id: 'sop-1', title: 'SYNTHETIC Returns procedure', category: 'service', content: 'SYNTHETIC steps', updated_at: '2026-10-01T10:00:00Z', agent_visible: false },
    ];
  });
  const toggle = page => page.locator('.sopAgentToggle[data-id="sop-1"]');

  test('turning it on applies only while it is still off', async ({ page, backend }) => {
    await login(page);
    await open(page, 'sopsPanel');
    await page.locator('#sopsPanel details summary').first().click();
    await page.locator('#sopsPanel .switch:has(.sopAgentToggle[data-id="sop-1"]) .slider').click();
    await expect.poll(() => writes(backend, 'sop_documents').length).toBe(1);
    expect(filtersOf(writes(backend, 'sop_documents')[0])).toEqual({ id: 'eq.sop-1', agent_visible: 'not.is.true' });
    expect(backend.tables.sop_documents[0].agent_visible).toBe(true);
  });

  test('stale tab: already turned on elsewhere, the page re-reads and shows it ON (not off)', async ({ page, backend }) => {
    await login(page);
    await open(page, 'sopsPanel');
    backend.tables.sop_documents[0].agent_visible = true; // another tab
    await page.locator('#sopsPanel details summary').first().click();
    await page.locator('#sopsPanel .switch:has(.sopAgentToggle[data-id="sop-1"]) .slider').click();
    await expect(page.locator('#dashError')).toContainText('changed');
    await page.waitForLoadState('networkidle');
    await expect(toggle(page)).toBeChecked();
    expect(backend.tables.sop_documents[0].agent_visible).toBe(true);
  });
});

test.describe('Adding a supplier', () => {
  test.beforeEach(async ({ backend }) => {
    backend.tables.suppliers = [
      { id: 'sup-1', name: 'SYNTHETIC Botanicals', supplier_type: 'manufacturer', contact_name: null, email: null, phone: null, notes: null, is_active: true },
    ];
    enableWrites(backend, ['suppliers']);
  });

  test('a new name is added once', async ({ page, backend }) => {
    await login(page);
    await open(page, 'suppliersPanel');
    await page.fill('#supName', 'SYNTHETIC Glassworks');
    await page.click('#addSupplierForm button[type=submit]');
    await expect.poll(() => backend.tables.suppliers.length).toBe(2);
    await expect(page.locator('#supName')).toHaveValue('');
  });

  test('the same name in any case (e.g. after a lost reply) asks first; "Cancel" adds nothing', async ({ page, backend }) => {
    await login(page);
    await open(page, 'suppliersPanel');
    const messages = [];
    page.on('dialog', d => { messages.push(d.message()); d.dismiss(); });
    await page.fill('#supName', 'synthetic botanicals');
    await page.click('#addSupplierForm button[type=submit]');
    await expect.poll(() => messages.length).toBe(1);
    expect(messages[0]).toContain('already exists');
    await page.waitForLoadState('networkidle');
    expect(backend.tables.suppliers).toHaveLength(1);
    expect(writes(backend, 'suppliers')).toHaveLength(0);
  });

  test('a name with % or _ is matched literally, not as a pattern', async ({ page, backend }) => {
    await login(page);
    await open(page, 'suppliersPanel');
    let dialogs = 0;
    page.on('dialog', d => { dialogs++; d.dismiss(); });
    await page.fill('#supName', 'SYNTHETIC%');
    await page.click('#addSupplierForm button[type=submit]');
    await expect.poll(() => backend.tables.suppliers.length).toBe(2);
    expect(dialogs).toBe(0);
  });
});
