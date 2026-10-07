// EXT8 (workstream C): "Checks: what needs a look". The decision logic is a
// pure helper (attentionFindings) tested here without a browser; the page
// tests check reading, unknown states, links and hiding. Synthetic data only.

const fs = require('fs');
const path = require('path');
const { test, expect, login, gotoPage } = require('../helpers/dashboard');

const src = fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'owner-login-helpers.js'), 'utf8');
const win = {}; new Function('window', src)(win);
const { attentionFindings } = win.HE.helpers;
const NOW = Date.parse('2026-10-07T15:00:00Z');
const ok = rows => ({ ok: true, rows });
const keys = fs_ => fs_.map(f => f.key + ':' + f.level + ':' + f.count);

test.describe('attentionFindings (pure)', () => {
  test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });

  test('nothing wrong: only the honest "backups not verified here" line', () => {
    expect(keys(attentionFindings({ inventory: ok([]), openTasks: ok([]), pendingApprovals: ok([]) }, NOW))).toEqual(['backups:info:null']);
  });

  test('a failed read is UNKNOWN, never a zero', () => {
    const f = attentionFindings({ pendingApprovals: { ok: false, error: 'x' } }, NOW);
    expect(f[0]).toMatchObject({ key: 'pendingApprovals', level: 'unknown', count: null });
    expect(f[0].title).toContain('could not check');
  });

  test('each rule, exactly', () => {
    const f = attentionFindings({
      inventory: ok([{ available: -1, low_stock_threshold: null }, { available: 3, low_stock_threshold: 5 }, { available: 5, low_stock_threshold: 5 }, { available: 9, damaged: 0, low_stock_threshold: 2 }]),
      receivedPOs: ok([{ purchase_order_items: [{ product_id: 'p', quantity: 4, quantity_received: 4 }] }, { purchase_order_items: [{ product_id: 'p', quantity: 4, quantity_received: 3 }, { product_id: null, quantity: 1, quantity_received: 0 }] }]),
      poExpenses: ok([{ note: 'Purchase order PO-1' }, { note: 'Purchase order PO-1' }, { note: 'Purchase order PO-2' }]),
      openTasks: ok([{ due_at: '2026-10-06T00:00:00Z' }, { due_at: '2026-10-08T00:00:00Z' }, { due_at: null }]),
      pendingApprovals: ok([{ created_at: '2026-10-01T00:00:00Z' }, { created_at: '2026-09-01T00:00:00Z' }]),
      openIncidents: ok([{ severity: 'Critical', created_at: '2026-10-02T00:00:00Z' }, { severity: 'low', created_at: '2026-10-03T00:00:00Z' }]),
      waitingQuestions: ok([{ status: 'needs_review', created_at: '2026-10-05T00:00:00Z' }, { status: 'new', created_at: '2026-10-04T00:00:00Z' }]),
      openPOs: ok([{ status: 'shipped', expected_at: '2026-10-01' }, { status: 'ordered', expected_at: '2026-10-07' }, { status: 'ordered', expected_at: null }]),
      openReturns: ok([{ status: 'requested', created_at: '2026-10-06T00:00:00Z' }]),
      ordersWithoutItems: ok([{ placed_at: '2026-10-01T00:00:00Z' }]),
      services: ok([{ status: 'operational' }, { status: 'maintenance' }, { status: null }, { status: 'down' }]),
      agentsPaused: ok([{ num: 7 }]),
      orderSyncFlag: ok([{ flag_key: 'shopify_order_sync', enabled: false }]),
    }, NOW);
    expect(keys(f).sort()).toEqual([
      'agentsPaused:info:1', 'backups:info:null', 'duplicatePoExpense:critical:1', 'lateDeliveries:action:1', 'lowStock:action:1',
      'negativeStock:critical:1', 'orderSyncOff:info:1', 'ordersWithoutItems:action:1', 'otherIncidents:info:1', 'overdueTasks:action:1',
      'pendingApprovals:action:2', 'questionsToReview:action:2', 'receivedNotStocked:critical:1', 'returnsWaiting:action:1',
      'servicesDown:action:1', 'unknownServices:info:2', 'urgentIncidents:action:1',
    ].sort());
    expect(f.find(x => x.key === 'pendingApprovals').oldest).toBe('2026-09-01T00:00:00Z');
    // critical first, then unknown, action, info
    const order = f.map(x => x.level);
    expect(order).toEqual([...order].sort((a, b) => ['critical', 'unknown', 'action', 'info'].indexOf(a) - ['critical', 'unknown', 'action', 'info'].indexOf(b)));
  });

  test('order sync ON (or flag missing) is not listed', () => {
    expect(keys(attentionFindings({ orderSyncFlag: ok([{ enabled: true }]) }, NOW))).toEqual(['backups:info:null']);
    expect(keys(attentionFindings({ orderSyncFlag: ok([]) }, NOW))).toEqual(['backups:info:null']);
  });
});

test.describe('Checks card on the home page', () => {
  test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'page logic; run once'); });
  const card = page => page.locator('#attnChecksWrap');
  const row = (page, key) => page.locator(`#attnChecksWrap .attnCheck[data-key="${key}"]`);

  test('shows to-dos from the synthetic data, with Open links to the right page', async ({ page }) => {
    await login(page);
    await expect(row(page, 'overdueTasks')).toContainText('Overdue tasks: 1');
    await row(page, 'overdueTasks').getByRole('button', { name: 'Open' }).click();
    await expect(page.locator('section#tasksPanel')).toHaveClass(/activePage/);
  });

  test('a received purchase order with a line not in stock is a red data problem that cannot be hidden', async ({ page, backend }) => {
    backend.tables.purchase_orders = [{ id: 'po-r', po_number: 'PO-R', status: 'received', supplier_id: null, currency: 'USD', shipping_cost: 0, tax: 0, payment_status: 'unpaid',
      created_at: '2026-09-01T00:00:00Z', deleted_at: null, purchase_order_items: [{ id: 'l1', product_id: 'p1', quantity: 5, quantity_received: 2 }] }];
    await login(page);
    await expect(row(page, 'receivedNotStocked')).toContainText('Data problem');
    await expect(row(page, 'receivedNotStocked').getByRole('button', { name: /Hide/ })).toHaveCount(0);
  });

  test('one failed read shows "could not check" for that check only', async ({ page }) => {
    await page.context().route(/\/rest\/v1\/approval_requests\?.*status=not\.in/, r => r.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"synthetic"}' }));
    await login(page);
    await expect(row(page, 'pendingApprovals')).toContainText('Could not check');
    await expect(row(page, 'overdueTasks')).toContainText('Overdue tasks: 1');
  });

  test('"Hide until it changes" hides a to-do on this device; it comes back when the number changes', async ({ page, backend }) => {
    await login(page);
    await row(page, 'overdueTasks').getByRole('button', { name: 'Hide until it changes' }).click();
    await expect(row(page, 'overdueTasks')).toHaveCount(0);
    await expect(card(page)).toContainText('1 hidden until they change');
    backend.tables.tasks.push({ id: 'task-late-2', title: 'SYNTHETIC late two', priority: 'normal', status: 'open', due_at: '2026-01-01T00:00:00Z', created_at: '2026-01-01T00:00:00Z' });
    await page.reload();
    await expect(row(page, 'overdueTasks')).toContainText('Overdue tasks: 2');
  });

  test('backups are always shown as not verified, never as fine', async ({ page }) => {
    await login(page);
    await expect(row(page, 'backups')).toContainText('Backups: not verified here');
    await row(page, 'backups').locator('summary').click();
    await expect(row(page, 'backups')).toContainText('UNKNOWN');
  });
});

test('the backups line cannot be hidden', async ({ page }, ti) => {
  test.skip(ti.project.name !== 'desktop', 'run once');
  await login(page);
  await expect(page.locator('#attnChecksWrap .attnCheck[data-key="backups"]')).toHaveCount(1);
  await expect(page.locator('#attnChecksWrap .attnCheck[data-key="backups"] button')).toHaveCount(0);
});
