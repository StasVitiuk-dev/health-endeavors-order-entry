// Admin pages that change how the business and its agents behave: Feature
// Flags, System Mode, Business Rules and the Approval Queue. Every change
// must ask for your password first, and send only the expected fields.
// Verifies existing behaviour; synthetic data only (the mock answers all).

const { test, expect, login, gotoPage, OWNER_USER } = require('../helpers/dashboard');

const writes = (backend, table) => backend.tableWrites().filter(r => !table || r.table === table);
const filtersOf = r => Object.fromEntries(r.params.filter(([k]) => k !== 'select'));

function seed(backend, mode = 'NORMAL') {
  Object.assign(backend.tables, {
    feature_flags: [{ id: 'ff-1', flag_key: 'shopify_order_sync', label: 'SYNTHETIC Shopify Order Sync', description: 'SYNTHETIC flag', enabled: false }],
    system_mode: [{ id: true, mode, changed_at: '2026-09-01T00:00:00Z', changed_by: null }],
    business_rules: [
      { id: 'br-refund', rule_key: 'refund_review_threshold_usd', label: 'SYNTHETIC Refund review', description: 'SYNTHETIC', config: { amount: 100 }, is_active: true },
      { id: 'br-ship', rule_key: 'shipping_delay_threshold_days', label: 'SYNTHETIC Shipping delay', description: 'SYNTHETIC', config: { days: 5 }, is_active: true },
      { id: 'br-custom', rule_key: 'synthetic_custom_rule', label: 'SYNTHETIC Custom rule', description: 'SYNTHETIC', config: { x: 1 }, is_active: true },
    ],
    approval_requests: [
      { id: 'ap-1', action_type: 'refund_cancellation_review', summary: 'SYNTHETIC pending request', status: 'pending', created_at: '2026-09-20T00:00:00Z' },
      { id: 'ap-2', action_type: 'refund_cancellation_review', summary: 'SYNTHETIC finished request', status: 'approved', created_at: '2026-09-19T00:00:00Z' },
    ],
  });
}

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

// ------------------------------------------------------------ feature flags
test.describe('Feature Flags', () => {
  test.beforeEach(async ({ page, backend }) => { seed(backend); await login(page); await open(page, 'flagsPanel'); });

  test('turning a flag on asks for the password; Cancel leaves it off and sends nothing', async ({ page, backend }) => {
    const toggle = page.locator('.flagRow[data-id="ff-1"] .flagToggle');
    page.once('dialog', d => d.accept()); // the launch-blocked confirmation (see below)
    await page.locator('.flagRow[data-id="ff-1"] .slider').click();
    await expect(page.locator('#reauthOverlay')).toBeVisible();
    await page.click('#reauthCancelBtn');
    await expect(toggle).not.toBeChecked();
    expect(writes(backend)).toEqual([]);
  });

  test('with the password, only the "enabled" field of that flag is sent', async ({ page, backend }) => {
    page.once('dialog', d => d.accept()); // the launch-blocked confirmation (see below)
    await page.locator('.flagRow[data-id="ff-1"] .slider').click();
    await confirmPassword(page);
    await expect.poll(() => writes(backend, 'feature_flags').length).toBe(1);
    const [w] = writes(backend, 'feature_flags');
    expect(w.body).toEqual({ enabled: true });
    // Only flips the flag from the state this page showed (off → on).
    expect(filtersOf(w)).toEqual({ id: 'eq.ff-1', enabled: 'not.is.true' });
  });
});

// Shopify Order Sync is launch-blocked (R9): the page says so, and turning it
// ON takes an explicit extra confirmation before the password prompt.
test.describe('Feature Flags: launch-blocked Shopify Order Sync', () => {
  test.beforeEach(async ({ page, backend }) => { seed(backend); await login(page); await open(page, 'flagsPanel'); });

  test('the flag is labelled as blocked until launch checks, with the reason', async ({ page }) => {
    const row = page.locator('.flagRow[data-id="ff-1"]');
    await expect(row.locator('.flagBlockedBadge')).toHaveText('Blocked until launch checks');
    await expect(row.locator('.flagBlockedReason')).toContainText('R1–R4');
  });

  test('declining the extra confirmation sends nothing and asks no password', async ({ page, backend }) => {
    let message = '';
    page.once('dialog', d => { message = d.message(); d.dismiss(); });
    await page.locator('.flagRow[data-id="ff-1"] .slider').click();
    await page.waitForTimeout(300);
    expect(message).toContain('Turn it ON anyway?');
    await expect(page.locator('#reauthOverlay')).toBeHidden();
    await expect(page.locator('.flagRow[data-id="ff-1"] .flagToggle')).not.toBeChecked();
    expect(writes(backend)).toEqual([]);
  });
});

// -------------------------------------------------------------- system mode
test.describe('System Mode', () => {
  test('a non-normal mode shows its banner on every page', async ({ page, backend }) => {
    seed(backend, 'LIMITED_AI');
    await login(page);
    await expect(page.locator('#systemModeBanner')).toBeVisible();
    await expect(page.locator('#systemModeBanner')).toContainText('Limited AI');
    await open(page, 'tasksPanel');
    await expect(page.locator('#systemModeBanner')).toBeVisible();
  });

  test('Normal mode shows no banner', async ({ page, backend }) => {
    seed(backend);
    await login(page);
    await open(page, 'flagsPanel');
    await expect(page.locator('#systemModeWrap')).toContainText('Normal');
    await expect(page.locator('#systemModeBanner')).toBeHidden();
  });

  test('changing to No AI (with password) records the mode and also pauses Agent #7 only', async ({ page, backend }) => {
    seed(backend);
    await login(page);
    await open(page, 'flagsPanel');
    await page.selectOption('#systemModeSelect', 'NO_AI');
    await page.click('#systemModeChangeBtn');
    await confirmPassword(page);
    await expect.poll(() => writes(backend, 'agent_controls').length).toBe(1);
    const mode = writes(backend, 'system_mode');
    expect(mode).toHaveLength(1);
    expect(Object.keys(mode[0].body).sort()).toEqual(['changed_at', 'changed_by', 'mode']);
    expect(mode[0].body.mode).toBe('NO_AI');
    // Only from the mode this page showed, so an old tab can't undo a change.
    expect(filtersOf(mode[0])).toEqual({ id: 'eq.true', mode: 'eq.NORMAL' });
    expect(filtersOf(writes(backend, 'agent_controls')[0])).toEqual({ agent_num: 'eq.7' });
    expect(writes(backend, 'agent_controls')[0].body.enabled).toBe(false);
    expect(writes(backend, 'feature_flags')).toEqual([]);
  });

  test('Emergency asks for an extra confirmation; saying no changes nothing', async ({ page, backend }) => {
    seed(backend);
    await login(page);
    await open(page, 'flagsPanel');
    await page.selectOption('#systemModeSelect', 'EMERGENCY');
    page.once('dialog', d => { expect(d.message()).toContain('does NOT log anyone out'); d.dismiss(); });
    await page.click('#systemModeChangeBtn');
    await confirmPassword(page);
    await page.waitForTimeout(300);
    expect(writes(backend)).toEqual([]);
  });

  test('Emergency, confirmed, also switches off Shopify Order Sync and pauses Agent #7', async ({ page, backend }) => {
    seed(backend);
    await login(page);
    await open(page, 'flagsPanel');
    await page.selectOption('#systemModeSelect', 'EMERGENCY');
    page.once('dialog', d => d.accept());
    await page.click('#systemModeChangeBtn');
    await confirmPassword(page);
    await expect.poll(() => writes(backend, 'agent_controls').length).toBe(1);
    expect(writes(backend, 'system_mode')[0].body.mode).toBe('EMERGENCY');
    const flag = writes(backend, 'feature_flags');
    expect(flag).toHaveLength(1);
    expect(flag[0].body.enabled).toBe(false);
    expect(filtersOf(flag[0])).toEqual({ flag_key: 'eq.shopify_order_sync' });
  });

  // MU-06 (2026-10-06): the follow-up switches must really happen, or the
  // page must say so. Row-level security refuses with "0 rows", no error.
  async function goEmergency(page) {
    await page.selectOption('#systemModeSelect', 'EMERGENCY');
    page.once('dialog', d => d.accept());
    await page.click('#systemModeChangeBtn');
    await confirmPassword(page);
  }
  const zeroRowsOn = (page, table) => page.route(url => new URL(url).pathname.endsWith('/rest/v1/' + table), route =>
    route.request().method() === 'PATCH' ? route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }) : route.fallback());

  // EXT4 (workstream Q): the protective steps run even when the mode itself
  // could not be recorded (refused / changed elsewhere / connection lost).
  const modeFault = {
    'changed in another tab': (page, backend) => { backend.tables.system_mode[0].mode = 'NO_AI'; },
    'refused with a server error': page => page.route(url => new URL(url).pathname.endsWith('/rest/v1/system_mode'), route =>
      route.request().method() === 'PATCH' ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Synthetic server error' }) }) : route.fallback()),
    'reply lost (outcome unknown)': page => page.route(url => new URL(url).pathname.endsWith('/rest/v1/system_mode'), route =>
      route.request().method() === 'PATCH' ? route.abort('connectionreset') : route.fallback()),
  };
  for (const [name, inject] of Object.entries(modeFault)) {
    test(`Emergency when the mode is ${name}: Order Sync is still switched off and Agent #7 paused; no success message`, async ({ page, backend }) => {
      seed(backend);
      backend.tables.feature_flags[0].enabled = true;
      backend.tables.agent_controls = [{ agent_num: 7, enabled: true }];
      await login(page);
      await open(page, 'flagsPanel');
      await inject(page, backend);
      await goEmergency(page);
      await expect(page.locator('#dashError')).toContainText('Emergency mode was NOT confirmed');
      await expect(page.locator('#dashError')).toContainText('switched off anyway');
      await expect(page.locator('.toast', { hasText: 'System mode changed to' })).toHaveCount(0);
      expect(writes(backend, 'feature_flags').some(w => w.body.enabled === false)).toBe(true);
      expect(writes(backend, 'agent_controls').some(w => w.body.enabled === false)).toBe(true);
    });
  }

  test('Normal when the mode changed in another tab: nothing else is touched', async ({ page, backend }) => {
    seed(backend, 'EMERGENCY');
    await login(page);
    await open(page, 'flagsPanel');
    backend.tables.system_mode[0].mode = 'NO_AI';
    await page.selectOption('#systemModeSelect', 'NORMAL');
    await page.click('#systemModeChangeBtn');
    await confirmPassword(page);
    await expect(page.locator('#dashError')).toContainText('changed');
    expect(writes(backend, 'feature_flags')).toEqual([]);
    expect(writes(backend, 'agent_controls')).toEqual([]);
  });

  test('Emergency: if Shopify Order Sync could not really be switched off, the page says so (no success message)', async ({ page, backend }) => {
    seed(backend);
    backend.tables.agent_controls = [{ agent_num: 7, enabled: true }];
    await login(page);
    await open(page, 'flagsPanel');
    await zeroRowsOn(page, 'feature_flags');
    await goEmergency(page);
    await expect(page.locator('#dashError')).toContainText('Shopify Order Sync could NOT be switched off');
    await expect(page.locator('.toast', { hasText: 'System mode changed to' })).toHaveCount(0);
  });

  test('Emergency: if Agent #7 could not really be paused, the page says so', async ({ page, backend }) => {
    seed(backend);
    backend.tables.agent_controls = [{ agent_num: 7, enabled: true }];
    await login(page);
    await open(page, 'flagsPanel');
    await zeroRowsOn(page, 'agent_controls');
    await goEmergency(page);
    await expect(page.locator('#dashError')).toContainText('Agent #7 (Customer Service) could NOT be paused');
  });

  test('Emergency: if the flag table has no who/when columns, Order Sync is still switched off (X3-17 fallback)', async ({ page, backend }) => {
    seed(backend);
    backend.tables.feature_flags[0].enabled = true;
    backend.tables.agent_controls = [{ agent_num: 7, enabled: false }];
    await login(page);
    await open(page, 'flagsPanel');
    let first = true;
    // First switch-off attempt (with updated_by / updated_at) is refused the way
    // PostgREST refuses an unknown column; the retry without them goes through.
    await page.route(url => new URL(url).pathname.endsWith('/rest/v1/feature_flags'), route => {
      if (route.request().method() !== 'PATCH') return route.fallback();
      const body = JSON.parse(route.request().postData() || '{}');
      if (first && 'updated_by' in body) {
        first = false;
        return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST204', message: "Could not find the 'updated_by' column of 'feature_flags' in the schema cache" }) });
      }
      return route.fallback();
    });
    await goEmergency(page);
    await expect(page.locator('.toast', { hasText: 'System mode changed to Emergency' })).toBeVisible();
    await expect(page.locator('#dashError')).toBeHidden();
    const flagWrites = writes(backend, 'feature_flags');
    expect(flagWrites.map(w => Object.keys(w.body).sort().join(','))).toContain('enabled');
  });

  test('Emergency: when both follow-ups really happen, it reports success and no error', async ({ page, backend }) => {
    seed(backend);
    backend.tables.agent_controls = [{ agent_num: 7, enabled: true }];
    await login(page);
    await open(page, 'flagsPanel');
    await goEmergency(page);
    await expect(page.locator('.toast', { hasText: 'System mode changed to Emergency' })).toBeVisible();
    await expect(page.locator('#dashError')).toBeHidden();
  });

  test('cancelling the password prompt changes nothing', async ({ page, backend }) => {
    seed(backend);
    await login(page);
    await open(page, 'flagsPanel');
    await page.selectOption('#systemModeSelect', 'NO_AI');
    await page.click('#systemModeChangeBtn');
    await page.click('#reauthCancelBtn');
    await page.waitForTimeout(300);
    expect(writes(backend)).toEqual([]);
  });
});

// ----------------------------------------------------------- business rules
test.describe('Business Rules', () => {
  test.beforeEach(async ({ page, backend }) => { seed(backend); await login(page); await open(page, 'businessRulesPanel'); });
  const row = (page, id) => page.locator(`#businessRulesWrap .flagRow[data-id="${id}"]`);

  test('saving a threshold asks for the password and sends only config + who changed it', async ({ page, backend }) => {
    await row(page, 'br-refund').locator('.ruleValueInput').fill('250');
    await row(page, 'br-refund').locator('.ruleSaveBtn').click();
    await confirmPassword(page);
    await expect.poll(() => writes(backend, 'business_rules').length).toBe(1);
    const [w] = writes(backend, 'business_rules');
    expect(Object.keys(w.body).sort()).toEqual(['config', 'updated_by']);
    expect(w.body.config).toEqual({ amount: 250 });
    // Only while the rule still has the settings this page showed (MU-14)
    expect(filtersOf(w)).toEqual({ id: 'eq.br-refund', config: 'eq.{"amount":100}' });
  });

  test('a rule changed elsewhere since the page loaded is not overwritten (MU-14)', async ({ page, backend }) => {
    const before = JSON.parse(JSON.stringify(backend.tables.business_rules.find(r => r.id === 'br-refund').config));
    backend.tables.business_rules.find(r => r.id === 'br-refund').config = { amount: 999 }; // another tab saved
    await row(page, 'br-refund').locator('.ruleValueInput').fill('250');
    await row(page, 'br-refund').locator('.ruleSaveBtn').click();
    await confirmPassword(page);
    await expect(page.locator('#dashError')).toContainText('changed');
    expect(backend.tables.business_rules.find(r => r.id === 'br-refund').config).toEqual({ amount: 999 });
    expect(before).not.toEqual({ amount: 999 });
  });

  test('two saves in a row from the same page both go through', async ({ page, backend }) => {
    for (const v of ['250', '300']) {
      await row(page, 'br-refund').locator('.ruleValueInput').fill(v);
      await row(page, 'br-refund').locator('.ruleSaveBtn').click();
      await confirmPassword(page);
      await expect(row(page, 'br-refund').locator('.ruleSaveBtn')).toBeHidden();
    }
    expect(backend.tables.business_rules.find(r => r.id === 'br-refund').config).toEqual({ amount: 300 });
    await expect(page.locator('#dashError')).toBeHidden();
  });

  test('a shipping delay of 0 is refused before any password prompt', async ({ page, backend }) => {
    await row(page, 'br-ship').locator('.ruleValueInput').fill('0');
    await row(page, 'br-ship').locator('.ruleSaveBtn').click();
    await expect(page.locator('#dashError')).toContainText('whole number from 1 to 365');
    await expect(page.locator('#reauthOverlay')).toBeHidden();
    expect(writes(backend)).toEqual([]);
  });

  test('a rule with an unfamiliar shape is edited as raw settings; invalid text is refused', async ({ page, backend }) => {
    const box = row(page, 'br-custom').locator('.ruleConfigJson');
    await expect(box).toHaveValue('{"x":1}');
    await box.fill('{"x": 1,');
    await row(page, 'br-custom').locator('.ruleSaveBtn').click();
    await expect(page.locator('#dashError')).toContainText("isn't valid JSON");
    expect(writes(backend)).toEqual([]);
  });

  test('switching a rule off asks for the password and sends only is_active + who changed it', async ({ page, backend }) => {
    await row(page, 'br-refund').locator('.slider').click();
    await confirmPassword(page);
    await expect.poll(() => writes(backend, 'business_rules').length).toBe(1);
    const [w] = writes(backend, 'business_rules');
    expect(w.body).toEqual({ is_active: false, updated_by: OWNER_USER.id });
  });
});

// ------------------------------------------------------------ approval queue
test.describe('Approval Queue', () => {
  test.beforeEach(async ({ page, backend }) => { seed(backend); await login(page); await open(page, 'approvalsPanel'); });

  test('only pending requests are listed', async ({ page }) => {
    await expect(page.locator('#approvalsWrap .approvalRow')).toHaveCount(1);
    await expect(page.locator('#approvalsWrap')).toContainText('SYNTHETIC pending request');
    await expect(page.locator('#approvalsWrap')).not.toContainText('SYNTHETIC finished request');
  });

  test('Approve asks for the password and records status, reviewer and time', async ({ page, backend }) => {
    await page.click('#approvalsWrap .approveBtn');
    await confirmPassword(page);
    await expect.poll(() => writes(backend, 'approval_requests').length).toBe(1);
    const [w] = writes(backend, 'approval_requests');
    expect(Object.keys(w.body).sort()).toEqual(['reviewed_at', 'reviewed_by', 'status']);
    expect(w.body.status).toBe('approved');
    // Only while the request still has the status this page showed, so a
    // decision made elsewhere is never overwritten.
    expect(filtersOf(w)).toEqual({ id: 'eq.ap-1', status: 'eq.pending' });
  });

  test('Deny with Cancel on the password prompt changes nothing', async ({ page, backend }) => {
    await page.click('#approvalsWrap .denyBtn');
    await page.click('#reauthCancelBtn');
    await page.waitForTimeout(300);
    expect(writes(backend)).toEqual([]);
  });
});
