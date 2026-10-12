// Stale-tab / double-click audit (2026-10-06): actions that could create a
// duplicate or silently overwrite newer data, found by reviewing every write
// in owner-login.html. Each test fails on the code before the fix.

const { test, expect, login, gotoPage } = require('../helpers/dashboard');

const writes = (backend, table) => backend.tableWrites().filter(r => r.table === table);

test.describe('reminders: one click or Enter = one reminder', () => {
  test.beforeEach(async ({ page, backend }) => {
    backend.tables.manual_attention_items = [];
    backend.delayMs.manual_attention_items = 600; // a slow save, so a second press lands mid-save
    await login(page);
  });

  test('"Add reminder": a double click adds it once', async ({ page, backend }) => {
    await gotoPage(page, 'attentionPanel');
    await page.fill('#reminderTitle', 'SYNTHETIC reminder');
    await page.locator('#addReminderForm button[type=submit]').dblclick();
    await page.waitForTimeout(1500);
    expect(writes(backend, 'manual_attention_items').filter(r => r.method === 'POST')).toHaveLength(1);
  });

  test('"Add reminder": Enter twice adds it once', async ({ page, backend }) => {
    await gotoPage(page, 'attentionPanel');
    await page.fill('#reminderTitle', 'SYNTHETIC reminder');
    await page.press('#reminderTitle', 'Enter');
    await page.press('#reminderTitle', 'Enter');
    await page.waitForTimeout(1500);
    expect(writes(backend, 'manual_attention_items').filter(r => r.method === 'POST')).toHaveLength(1);
  });

  test('quick add (Cmd+N): Enter twice adds it once', async ({ page, backend }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'keyboard shortcut; desktop only');
    await page.keyboard.press('ControlOrMeta+n');
    await expect(page.locator('#quickAddInput')).toBeFocused();
    await page.keyboard.type('SYNTHETIC quick reminder');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1500);
    expect(writes(backend, 'manual_attention_items').filter(r => r.method === 'POST')).toHaveLength(1);
  });
});

test.describe('recalls: "Escalate to Incident" at most once', () => {
  let incidentInserts;
  test.beforeEach(async ({ page, backend }) => {
    Object.assign(backend.tables, {
      products: [{ id: 'prod-a', name: 'SYNTHETIC product A', sku: 'SYN-A' }],
      inventory_lots: [{ id: 'lot-1', lot_number: 'SYN-LOT-1', product_id: 'prod-a', quantity_received: 10, quantity_remaining: 10 }],
      recalls: [{
        id: 'rc-1', lot_id: 'lot-1', product_id: 'prod-a', status: 'initiated', severity: 'high', reason: 'SYNTHETIC recall',
        quantity_quarantined: null, resolution: null, resolved_at: null, incident_id: null, created_at: '2026-09-20T00:00:00Z',
        products: { name: 'SYNTHETIC product A', sku: 'SYN-A' }, inventory_lots: { lot_number: 'SYN-LOT-1' }, incidents: null,
      }],
    });
    incidentInserts = [];
    await page.route(url => new URL(url).pathname.endsWith('/rest/v1/incidents'), route => {
      if (route.request().method() !== 'POST') return route.fallback();
      incidentInserts.push(JSON.parse(route.request().postData()));
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 'inc-new', incident_number: 'INC-NEW' }) });
    });
    await login(page);
    await gotoPage(page, 'recallsPanel');
    await page.waitForLoadState('networkidle');
    const overlay = page.locator('#inspectorOverlay');
    if (await overlay.evaluate(el => el.classList.contains('open'))) await page.click('#insCloseBtn');
  });

  test('links the new incident only while the recall is still unlinked', async ({ page, backend }) => {
    await page.locator('.recallEscalateBtn').click();
    await expect.poll(() => writes(backend, 'recalls').length).toBe(1);
    expect(incidentInserts).toHaveLength(1);
    const link = writes(backend, 'recalls')[0];
    expect(link.body.incident_id).toBe('inc-new');
    expect(Object.fromEntries(link.params.filter(([k]) => k !== 'select'))).toEqual({ id: 'eq.rc-1', incident_id: 'is.null' });
  });

  test('a recall escalated meanwhile in another tab creates no second incident', async ({ page, backend }) => {
    backend.tables.recalls[0].incident_id = 'inc-elsewhere';
    await page.locator('.recallEscalateBtn').click();
    await expect(page.locator('#dashError')).toContainText('already changed');
    expect(incidentInserts).toHaveLength(0);
    expect(backend.tables.recalls[0].incident_id).toBe('inc-elsewhere');
  });
});
