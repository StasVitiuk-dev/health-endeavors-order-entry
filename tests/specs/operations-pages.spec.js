// Operations pages: agent pause switches, Active Sessions and Customer
// Inquiries. Every switch and log-out asks for your password first; each
// action sends only its own fields. Verifies existing behaviour; synthetic
// data only (the mock answers every request). Nothing here changes a real
// agent setting: the "database" is the local mock.

const { test, expect, login, gotoPage, OWNER_USER } = require('../helpers/dashboard');

const writes = (backend, table) => backend.tableWrites().filter(r => r.table === table);
const filtersOf = r => Object.fromEntries(r.params.filter(([k]) => k !== 'select'));

async function open(page, id) {
  await gotoPage(page, id);
  await page.waitForLoadState('networkidle');
  const overlay = page.locator('#inspectorOverlay');
  if (await overlay.evaluate(el => el.classList.contains('open'))) await page.click('#insCloseBtn');
}

async function confirmPassword(page) {
  await expect(page.locator('#reauthOverlay')).toBeVisible();
  await page.fill('#reauthPassword', OWNER_USER.password);
  await page.click('#reauthConfirmBtn');
  await expect(page.locator('#reauthOverlay')).toBeHidden();
}

// ------------------------------------------------------ agent pause switches
test.describe('agent pause switches (mock only)', () => {
  test.beforeEach(async ({ page, backend }) => {
    backend.tables.agent_controls = [1, 4, 5, 6, 7].map(n => ({ agent_num: n, enabled: n !== 7, updated_by: null, updated_at: null }));
    await login(page);
    await open(page, 'aiPanel');
  });

  test('a paused agent shows a banner on every page', async ({ page }) => {
    await expect(page.locator('#pausedAgentsBanner')).toBeVisible();
    await expect(page.locator('#pausedAgentsBanner')).toContainText('#7 Customer Service Agent');
    await open(page, 'tasksPanel');
    await expect(page.locator('#pausedAgentsBanner')).toBeVisible();
  });

  test('pausing an agent asks for the password; Cancel leaves it on and sends nothing', async ({ page, backend }) => {
    const card = page.locator('#agentRegistryWrap .deletedRow', { hasText: '#4 —' });
    await card.locator('.slider').click();
    await page.click('#reauthCancelBtn');
    await expect(card.locator('.agentToggle')).toBeChecked();
    expect(writes(backend, 'agent_controls')).toEqual([]);
  });

  test('with the password, only that agent\'s on/off, who and when are sent', async ({ page, backend }) => {
    const card = page.locator('#agentRegistryWrap .deletedRow', { hasText: '#4 —' });
    await card.locator('.slider').click();
    await confirmPassword(page);
    await expect.poll(() => writes(backend, 'agent_controls').length).toBe(1);
    const [w] = writes(backend, 'agent_controls');
    expect(Object.keys(w.body).sort()).toEqual(['enabled', 'updated_at', 'updated_by']);
    expect(w.body).toMatchObject({ enabled: false, updated_by: OWNER_USER.id });
    // Only flips the switch this page showed (on → paused).
    expect(filtersOf(w)).toEqual({ agent_num: 'eq.4', enabled: 'is.true' });
  });
});

// ------------------------------------------------------------ active sessions
test.describe('Active Sessions', () => {
  test.beforeEach(async ({ page, backend }) => {
    backend.rpc.list_my_sessions = [
      { session_id: 'sess-here', user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15', created_at: '2026-09-20T00:00:00Z', last_active: '2026-09-29T00:00:00Z', ip_address: '192.0.2.1', is_current: true },
      { session_id: 'sess-phone', user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1', created_at: '2026-09-21T00:00:00Z', last_active: '2026-09-28T00:00:00Z', ip_address: '192.0.2.2', is_current: false },
    ];
    await login(page);
    await open(page, 'sessionsPanel');
  });

  test('lists devices by friendly name; this device has no log-out button', async ({ page }) => {
    await expect(page.locator('.sessionRow[data-id="sess-here"]')).toContainText('Mac · Safari');
    await expect(page.locator('.sessionRow[data-id="sess-here"]')).toContainText('This device');
    await expect(page.locator('.sessionRow[data-id="sess-here"] .logoutSessionBtn')).toHaveCount(0);
    await expect(page.locator('.sessionRow[data-id="sess-phone"]')).toContainText('iPhone · Safari');
  });

  test('logging out another device asks for the password, then asks the database for exactly that session', async ({ page, backend }) => {
    await page.click('.sessionRow[data-id="sess-phone"] .logoutSessionBtn');
    await confirmPassword(page);
    await expect.poll(() => backend.requests.filter(r => r.rpc === 'revoke_my_session').length).toBe(1);
    expect(backend.requests.find(r => r.rpc === 'revoke_my_session').body).toEqual({ target_session_id: 'sess-phone' });
  });

  test('Cancel on the password prompt logs nothing out', async ({ page, backend }) => {
    await page.click('.sessionRow[data-id="sess-phone"] .logoutSessionBtn');
    await page.click('#reauthCancelBtn');
    await page.waitForTimeout(300);
    expect(backend.requests.filter(r => r.rpc === 'revoke_my_session')).toEqual([]);
  });
});

// --------------------------------------------------------- customer inquiries
test.describe('Customer Inquiries', () => {
  test.beforeEach(async ({ page, backend }) => {
    const base = { channel: 'email', order_id: null, customer_email: 'syn@example.test', ai_confidence: 0.8, sensitive: false, sensitive_reasons: null, drafted_at: null, answered_at: null };
    backend.tables.customer_inquiries = [
      { ...base, id: 'inq-low', customer_name: 'SYNTHETIC Low', question_text: 'SYNTHETIC where is my order', status: 'drafted', severity: 'low', ai_draft_reply: 'SYNTHETIC draft A', created_at: '2026-09-22T00:00:00Z' },
      { ...base, id: 'inq-high', customer_name: 'SYNTHETIC High', question_text: 'SYNTHETIC I had a reaction', status: 'needs_review', severity: 'high', sensitive: true, sensitive_reasons: 'health/safety', ai_draft_reply: 'SYNTHETIC draft B', created_at: '2026-09-20T00:00:00Z' },
      { ...base, id: 'inq-new', customer_name: 'SYNTHETIC New', question_text: 'SYNTHETIC question', status: 'new', severity: null, ai_draft_reply: null, created_at: '2026-09-23T00:00:00Z' },
    ];
    backend.tables.orders = [];
    await login(page);
    await open(page, 'inquiriesPanel');
  });

  test('worst severity is listed first; a flagged question shows why; no draft means no Save/Copy', async ({ page }) => {
    const rows = page.locator('#inquiriesWrap .approvalRow');
    await expect(rows.first()).toContainText('SYNTHETIC High');
    await expect(rows.first()).toContainText('Flagged for review: health/safety');
    const newRow = page.locator('#inquiriesWrap .approvalRow[data-id="inq-new"]');
    await expect(newRow.locator('.inqSaveBtn')).toHaveCount(0);
    await expect(newRow).toContainText('No draft yet');
  });

  test('Save edits sends only the edited draft text', async ({ page, backend }) => {
    const row = page.locator('#inquiriesWrap .approvalRow[data-id="inq-low"]');
    await row.locator('.inqDraftText').fill('SYNTHETIC edited draft');
    await row.locator('.inqSaveBtn').click();
    await expect.poll(() => writes(backend, 'customer_inquiries').length).toBe(1);
    const [w] = writes(backend, 'customer_inquiries');
    expect(w.body).toEqual({ ai_draft_reply: 'SYNTHETIC edited draft' });
    expect(filtersOf(w)).toEqual({ id: 'eq.inq-low' });
  });

  test('Mark as answered records only the status and time (nothing is sent to the customer)', async ({ page, backend }) => {
    await page.locator('#inquiriesWrap .approvalRow[data-id="inq-low"] .inqAnsweredBtn').click();
    await expect.poll(() => writes(backend, 'customer_inquiries').length).toBe(1);
    const [w] = writes(backend, 'customer_inquiries');
    expect(Object.keys(w.body).sort()).toEqual(['answered_at', 'status']);
    expect(w.body.status).toBe('answered');
  });

  test('changing severity sends only the severity', async ({ page, backend }) => {
    await page.locator('#inquiriesWrap .inqSeveritySelect[data-id="inq-new"]').selectOption('medium');
    await expect.poll(() => writes(backend, 'customer_inquiries').length).toBe(1);
    expect(writes(backend, 'customer_inquiries')[0].body).toEqual({ severity: 'medium' });
  });
});
