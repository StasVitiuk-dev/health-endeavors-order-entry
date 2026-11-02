// EXT15: malformed rows, huge strings and large attention lists.
//   * rows with missing ids/names, broken dates and amounts, unknown statuses
//     and wrong types render without a script error, and nothing on screen says
//     "NaN", "Invalid Date", "undefined", "null" or "[object Object]";
//   * a 50,000-character name does not freeze a page;
//   * 5,000 overdue tasks: Home's check counts all of them but draws a bounded list;
//   * a malformed agent record is never shown as healthy.
const { test, expect, login, gotoPage } = require('../helpers/dashboard');
const { NOW, seedBusiness } = require('../fixtures/business-data');

test.use({ timezoneId: 'America/Chicago', locale: 'en-US' });
const BAD_TEXT = /\bNaN\b|Invalid Date|\bundefined\b|\[object Object\]|\$NaN/;

function mangle(rows, r) {
  const junk = [null, '', 'not-a-date', '2026-13-45', 'abc', -1, 1e21, {}, [], true, 'WEIRD_STATUS'];
  let i = 0;
  return rows.map(row => {
    const out = { ...row };
    for (const k of Object.keys(out)) {
      if (k === 'id' && (i++ % 7)) continue; // keep most ids so pages still have rows to click
      if ((i++ % 3) === 0) out[k] = junk[(i * 7) % junk.length];
    }
    return out;
  });
}

test('malformed rows on every page: no script error and no NaN / Invalid Date / undefined on screen', async ({ page, backend }) => {
  test.setTimeout(300000);
  seedBusiness(backend);
  backend.allowImpossibleData = true; backend.expectViolations = true; backend.allowUnguardedState = true;
  for (const t of ['orders', 'tasks', 'products', 'inventory', 'incidents', 'approval_requests', 'expenses', 'returns', 'suppliers', 'purchase_orders', 'customer_inquiries'])
    if (Array.isArray(backend.tables[t])) backend.tables[t] = backend.tables[t].concat(mangle(backend.tables[t].slice(0, 4), t.length));
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.clock.setFixedTime(NOW);
  await login(page);
  const ids = await page.locator('#sidebarGroups .sidebarLink[data-page]').evaluateAll(els => [...new Set(els.map(e => e.getAttribute('data-page')))]);
  const shown = [];
  for (const id of ids) {
    await gotoPage(page, id);
    await page.waitForLoadState('networkidle');
    const text = await page.locator(`section#${id}`).innerText().catch(() => '');
    const m = BAD_TEXT.exec(text);
    if (m) shown.push(`${id}: …${text.slice(Math.max(0, m.index - 40), m.index + 30).replace(/\s+/g, ' ')}…`);
  }
  expect(errors).toEqual([]);
  expect(shown).toEqual([]);
});

test('a 50,000-character product name and task title: pages draw in reasonable time and stay usable', async ({ page, backend }) => {
  const huge = 'SYNTHETIC ' + 'W'.repeat(50000);
  backend.tables.products = (backend.tables.products || []).concat([{ id: 'prod-huge', name: huge, sku: 'SYN-HUGE', is_active: true, low_stock_threshold: 5, created_at: '2026-10-01T00:00:00Z' }]);
  backend.tables.tasks = (backend.tables.tasks || []).concat([{ id: 'task-huge', title: huge, status: 'open', priority: 'normal', due_at: null, created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z' }]);
  await login(page);
  for (const id of ['tasksPanel', 'inventoryPanel']) {
    const t0 = Date.now();
    await gotoPage(page, id);
    await page.waitForLoadState('networkidle');
    expect(Date.now() - t0, id).toBeLessThan(8000);
  }
  // still responsive: a click on another page works at once
  const t1 = Date.now();
  await gotoPage(page, 'attentionPanel');
  expect(Date.now() - t1).toBeLessThan(5000);
});

test('5,000 overdue tasks: the Home check counts them all, and the drawn list stays bounded', async ({ page, backend }) => {
  test.setTimeout(240000);
  const many = Array.from({ length: 5000 }, (_, i) => ({ id: 'task-od-' + i, title: 'SYNTHETIC overdue ' + i, status: 'open', priority: 'normal', due_at: '2026-01-01T00:00:00Z', created_at: '2025-12-01T00:00:00Z', updated_at: '2025-12-01T00:00:00Z' }));
  backend.tables.tasks = many;
  backend.maxRows = 1000; // the real database's per-reply limit
  await page.clock.setFixedTime(NOW);
  const t0 = Date.now();
  await login(page);
  await page.waitForLoadState('networkidle');
  const homeMs = Date.now() - t0;
  const home = await page.locator('#attentionPanel').innerText();
  expect(home).toMatch(/5,?000|1,?000\+|at least 1,?000/); // the count, or an honest "1,000+" when capped
  const rows = await page.locator('#attentionPanel tr, #attentionPanel li, #attentionPanel .attnRow').count();
  expect(rows, 'Home draws a bounded list').toBeLessThan(400);
  test.info().annotations.push({ type: 'scale', description: `5,000 overdue tasks: Home ready in ${homeMs} ms, ${rows} rows drawn` });
});

test('an agent whose switch value is not a clear on/off is Unknown, never Enabled — even with a fresh run', async ({ page, backend }) => {
  const fresh = new Date(Date.now() - 10 * 60000).toISOString();
  backend.rpc.get_agent_cron_status = ['agent_4_retail_wholesale', 'agent_5_shipping_tracking', 'agent_6_customer_notifications'].map(j => ({ jobname: j, schedule: '5 * * * *', active: true }));
  backend.tables.agent_controls = [
    { agent_num: 4, enabled: 'yes', last_run_status: 'ok', last_run_at: fresh, updated_by: null, updated_at: null },
    { agent_num: 5, enabled: null, last_run_status: 'ok', last_run_at: fresh, updated_by: null, updated_at: null },
    { agent_num: 6, enabled: 1, last_run_status: 'ok', last_run_at: fresh, updated_by: null, updated_at: null },
  ];
  await login(page);
  await gotoPage(page, 'aiPanel');
  await page.waitForLoadState('networkidle');
  const text = await page.locator('#agentRegistryWrap').innerText();
  for (const name of ['Retail/Wholesale Agent', 'Shipping/Tracking Agent', 'Customer Notification Agent']) {
    const i = text.indexOf(name);
    expect(i, name).toBeGreaterThan(-1);
    const chunk = text.slice(i, i + 400);
    expect(chunk, name).toContain('Unknown');
    expect(chunk, name).not.toMatch(/\bEnabled\b|Dry run/);
  }
});

test('AI page: if this month\'s spend cannot be read, it shows "?" — never "$0.00 spent, full cap remaining"', async ({ page, backend }) => {
  backend.tables.ai_decision_log = [{ id: 'ai-1', agent_key: 'customer_service_agent', output_summary: 'SYNTHETIC', confidence: 0.9, escalated_to_human: false, cost_usd: 12.5, created_at: new Date().toISOString() }];
  const original = backend.handleRest.bind(backend);
  // only the month-total read (select=id,cost_usd) fails; the recent list still loads
  backend.handleRest = (route, entry) => (entry.table === 'ai_decision_log' && entry.method === 'GET' && /select=id%2Ccost_usd|select=id,cost_usd/.test(route.request().url()))
    ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'SYNTHETIC outage' }) })
    : original(route, entry);
  await login(page);
  await gotoPage(page, 'aiPanel');
  const stats = page.locator('#aiSpendStats');
  await expect(stats.locator('.stat', { hasText: 'Spent this month' })).toContainText('?');
  await expect(stats.locator('.stat', { hasText: 'Spent this month' })).toContainText('could not be read');
  await expect(stats.locator('.stat', { hasText: 'Remaining this month' })).toContainText('?');
  await expect(stats).not.toContainText('$0.00');
});
