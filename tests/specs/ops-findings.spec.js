// Tests only (no dashboard change): findings from the 2026-10-04 operations
// review (docs/ops/other-fixes-review.md). Synthetic data; the mock answers
// every request and nothing leaves the test browser.
//
// For each finding:
//   "current behaviour" pins down today's result (passes now);
//   "wanted" asserts the fixed behaviour and is marked test.fail() until the
//   fix lands — Playwright then reports it, and test.fail() is removed.

const { test, expect, login, gotoPage, OWNER_USER } = require('../helpers/dashboard');

const writes = (backend, table) => backend.tableWrites().filter(r => r.table === table);
const reads = (backend, table) => backend.requests.filter(r => r.method === 'GET' && r.table === table);
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

// ---------------------------------------------------------- approval queue race
test.describe('Approval Queue: deciding a request that someone else already decided', () => {
  test.beforeEach(async ({ page, backend }) => {
    backend.tables.approval_requests = [
      { id: 'ap-1', action_type: 'refund_cancellation_review', summary: 'SYNTHETIC pending request', status: 'pending', created_at: '2026-09-20T00:00:00Z' },
    ];
    await login(page);
    await open(page, 'approvalsPanel');
  });

  test('current behaviour: the decision is written with no "still pending" condition', async ({ page, backend }) => {
    await page.locator('.approvalRow[data-id="ap-1"] .approveBtn').click();
    await confirmPassword(page);
    await expect.poll(() => writes(backend, 'approval_requests').length).toBe(1);
    expect(filtersOf(writes(backend, 'approval_requests')[0])).toEqual({ id: 'eq.ap-1' });
  });

  test('current behaviour: a stale page overwrites a decision made elsewhere (approved → denied)', async ({ page, backend }) => {
    backend.tables.approval_requests[0].status = 'approved'; // decided in another tab after this page loaded
    await page.locator('.approvalRow[data-id="ap-1"] .denyBtn').click();
    await confirmPassword(page);
    await expect.poll(() => backend.tables.approval_requests[0].status).toBe('denied');
  });

  test('wanted: the update only applies while the request is still pending', async ({ page, backend }) => {
    test.fail(true, 'Fix pending: conditional update (Task-v2 pattern) — docs/ops/other-fixes-review.md');
    await page.locator('.approvalRow[data-id="ap-1"] .approveBtn').click();
    await confirmPassword(page);
    await expect.poll(() => writes(backend, 'approval_requests').length).toBe(1);
    expect(filtersOf(writes(backend, 'approval_requests')[0])).toMatchObject({ status: 'eq.pending' });
  });
});

// ----------------------------------------------------- purchase order states
function po(id, status, items) {
  return {
    id, po_number: 'PO-' + id.toUpperCase(), status, currency: 'USD', shipping_cost: 15, tax: 5, expense_category: 'packaging',
    ordered_at: null, expected_at: null, received_at: null, payment_status: 'unpaid', notes: null, created_at: '2026-09-01T00:00:00Z',
    suppliers: { name: 'SYNTHETIC Supplier' }, purchase_order_items: items,
  };
}

async function openPo(page, id) {
  await page.locator(`.poItem[data-id="${id}"] .poRow`).click();
  const overlay = page.locator('#inspectorOverlay');
  if (await overlay.evaluate(el => el.classList.contains('open'))) await page.click('#insCloseBtn');
  const box = page.locator(`#poDetail_${id}`);
  await expect(box).toBeVisible();
  return box;
}

test.describe('Purchase orders: Cancel on a stale page, and Cancel confirmation', () => {
  test.beforeEach(async ({ page, backend }) => {
    const items = [{ id: 'line-a', purchase_order_id: 'syn-shipped', product_id: 'prod-a', description: null, sku: 'SYN-A', quantity: 10, unit_cost: 2, quantity_received: 0, landed_unit_cost: null }];
    Object.assign(backend.tables, {
      suppliers: [{ id: 'sup-1', name: 'SYNTHETIC Supplier', supplier_type: 'manufacturer', contact_name: null, email: null, phone: null, notes: null, is_active: true }],
      products: [{ id: 'prod-a', name: 'SYNTHETIC product A', sku: 'SYN-A' }],
      purchase_order_items: items,
      purchase_orders: [po('syn-shipped', 'shipped', items)],
      inventory_lots: [{ id: 'lot-ab1', product_id: 'prod-a', lot_number: 'AB1', purchase_order_id: null, quantity_received: 5, quantity_remaining: 5 }],
    });
    await login(page);
    await open(page, 'purchaseOrdersPanel');
  });

  test('current behaviour: Cancel after the order was received elsewhere turns "received" into "cancelled"', async ({ page, backend }) => {
    const box = await openPo(page, 'syn-shipped');
    backend.tables.purchase_orders[0].status = 'received'; // received in another tab after this page loaded
    await box.locator('.poStatusBtn[data-next="cancelled"]').click();
    await expect.poll(() => backend.tables.purchase_orders[0].status).toBe('cancelled');
    expect(filtersOf(writes(backend, 'purchase_orders')[0])).toEqual({ id: 'eq.syn-shipped' });
  });

  test('current behaviour: one press of Cancel cancels immediately (no confirmation)', async ({ page, backend }) => {
    const box = await openPo(page, 'syn-shipped');
    await box.locator('.poStatusBtn[data-next="cancelled"]').click();
    await expect.poll(() => writes(backend, 'purchase_orders').length).toBe(1);
  });

  test('wanted: a status change only applies from the expected previous status', async ({ page, backend }) => {
    test.fail(true, 'Fix pending: conditional PO status update — docs/ops/other-fixes-review.md');
    const box = await openPo(page, 'syn-shipped');
    await box.locator('.poStatusBtn[data-next="cancelled"]').click();
    await expect.poll(() => writes(backend, 'purchase_orders').length).toBe(1);
    expect(filtersOf(writes(backend, 'purchase_orders')[0])).toHaveProperty('status');
  });

  test('wanted: the first press of Cancel only asks to confirm and sends nothing', async ({ page, backend }) => {
    test.fail(true, 'Fix pending: two-press Cancel confirmation (owner decision) — docs/ops/other-fixes-review.md');
    const box = await openPo(page, 'syn-shipped');
    await box.locator('.poStatusBtn[data-next="cancelled"]').click();
    await page.waitForTimeout(300);
    expect(writes(backend, 'purchase_orders')).toEqual([]);
  });

  // ---- N1: lot numbers are looked up with ilike, so _ and % act as wildcards
  test('current behaviour: a typed lot number is looked up with an unescaped ilike pattern', async ({ page, backend }) => {
    const box = await openPo(page, 'syn-shipped');
    await box.locator('.poLineLot[data-line="line-a"]').fill('A_1');
    await box.locator('.poReceiveBtn').click();
    await expect.poll(() => reads(backend, 'inventory_lots').filter(r => filtersOf(r).lot_number).length).toBeGreaterThan(0);
    const lookup = reads(backend, 'inventory_lots').find(r => filtersOf(r).lot_number);
    expect(filtersOf(lookup).lot_number).toBe('ilike.A_1'); // "_" matches any character, so "AB1" would match
  });

  test('wanted: the lot lookup treats the typed text literally', async ({ page, backend }) => {
    test.fail(true, 'Fix pending: exact lot match (in the R1 receive function) — docs/ops/R1-R5-function-design.md');
    const box = await openPo(page, 'syn-shipped');
    await box.locator('.poLineLot[data-line="line-a"]').fill('A_1');
    await box.locator('.poReceiveBtn').click();
    await expect.poll(() => reads(backend, 'inventory_lots').filter(r => filtersOf(r).lot_number).length).toBeGreaterThan(0);
    const lookup = reads(backend, 'inventory_lots').find(r => filtersOf(r).lot_number);
    expect(filtersOf(lookup).lot_number).not.toMatch(/^ilike\.[^\\]*[_%]/);
  });
});

// ------------------------------------------------------------- legal holds (N6)
test.describe('Legal holds: releasing a hold', () => {
  test.beforeEach(async ({ page, backend }) => {
    backend.tables.legal_holds = [
      { id: 'lh-1', title: 'SYNTHETIC order dispute', description: null, related_type: 'order', related_reference: 'SYN-1001', placed_at: '2026-09-20T00:00:00Z', status: 'active' },
    ];
    await login(page);
    await open(page, 'legalHoldsPanel');
  });

  test('current behaviour: one click releases the hold with no confirmation or password', async ({ page, backend }) => {
    await page.locator('#legalHoldsWrap [data-id="lh-1"] .lhReleaseBtn').click();
    await expect.poll(() => writes(backend, 'legal_holds').length).toBe(1);
    await expect(page.locator('#reauthOverlay')).toBeHidden();
  });

  test('wanted: releasing a legal hold asks for the password first', async ({ page, backend }) => {
    test.fail(true, 'Fix pending (owner decision): password re-check for legal-hold release — docs/ops/other-fixes-review.md N6');
    await page.locator('#legalHoldsWrap [data-id="lh-1"] .lhReleaseBtn').click();
    await expect(page.locator('#reauthOverlay')).toBeVisible({ timeout: 2000 });
    expect(writes(backend, 'legal_holds')).toEqual([]);
  });
});

// ------------------------------------------- returns: stale Approve (N13)
test.describe('Returns: deciding a return on a stale page', () => {
  test.beforeEach(async ({ page, backend }) => {
    backend.tables.returns = [{
      id: 'ret-1', order_id: 'ord-1', order_item_id: 'item-1', reason: 'damaged', status: 'requested', product_condition: null,
      disposition: null, refund_amount: null, approved_at: null, received_at: null, refunded_at: null, notes: null, created_at: '2026-09-20T00:00:00Z',
      orders: { order_number: 'SYN-1001', customer_name: 'SYNTHETIC Customer' }, order_items: { product_name: 'SYNTHETIC product A', sku: 'SYN-A', quantity: 3 },
    }];
    await login(page);
    await open(page, 'returnsPanel');
  });

  test('current behaviour: Approve on a stale page turns a refunded return back into "approved"', async ({ page, backend }) => {
    backend.tables.returns[0].status = 'refunded'; // received, restocked and refunded in another tab
    await page.locator('[data-return-id="ret-1"] .decideReturnBtn[data-next="approved"]').click();
    await expect.poll(() => backend.tables.returns[0].status).toBe('approved'); // Mark Received (restock) is offered again
    expect(filtersOf(writes(backend, 'returns')[0])).toEqual({ id: 'eq.ret-1' });
  });

  test('wanted: Approve/Reject only apply while the return is still "requested"', async ({ page, backend }) => {
    test.fail(true, 'Fix pending: conditional return status updates — docs/ops/other-fixes-review.md N13');
    await page.locator('[data-return-id="ret-1"] .decideReturnBtn[data-next="approved"]').click();
    await expect.poll(() => writes(backend, 'returns').length).toBe(1);
    expect(filtersOf(writes(backend, 'returns')[0])).toMatchObject({ status: 'eq.requested' });
  });
});

// ------------------------------------- recalls: resolve before quarantine (N12)
test.describe('Recalls: "Mark resolved" on a recall whose stock was never quarantined', () => {
  test.beforeEach(async ({ page, backend }) => {
    backend.tables.recalls = [{
      id: 'rc-1', reason: 'SYNTHETIC contamination report', severity: 'high', status: 'initiated', quantity_quarantined: null, resolution: null,
      resolved_at: null, incident_id: null, created_at: '2026-09-20T00:00:00Z', lot_id: 'lot-1', product_id: 'prod-a',
      products: { name: 'SYNTHETIC product A', sku: 'SYN-A' }, inventory_lots: { lot_number: 'L-1' }, incidents: null,
    }];
    backend.tables.inventory_lots = [{ id: 'lot-1', lot_number: 'L-1', product_id: 'prod-a', quantity_remaining: 5, products: { name: 'SYNTHETIC product A', sku: 'SYN-A' } }];
    await login(page);
    await open(page, 'recallsPanel');
  });

  test('current behaviour: one click resolves it with the default note, and Quarantine disappears', async ({ page, backend }) => {
    const row = page.locator('#recallsPanel [data-id="rc-1"]');
    await expect(row.locator('.recallQuarantineBtn')).toBeVisible();
    await row.locator('.recallResolveBtn').click();
    await expect.poll(() => backend.tables.recalls[0].status).toBe('resolved');
    expect(backend.tables.recalls[0].resolution).toBe('Resolved.');
    expect(backend.tables.recalls[0].quantity_quarantined).toBeNull();
    expect(filtersOf(writes(backend, 'recalls')[0])).toEqual({ id: 'eq.rc-1' });
  });

  test('wanted: resolving requires a written note before it sends anything', async ({ page, backend }) => {
    test.fail(true, 'Fix pending (owner decision): require a resolution note / confirm when not quarantined — docs/ops/other-fixes-review.md N12');
    await page.locator('#recallsPanel [data-id="rc-1"] .recallResolveBtn').click();
    await page.waitForTimeout(300);
    expect(writes(backend, 'recalls')).toEqual([]);
  });
});

// ------------------------------------------- adverse events: FDA flag (N11)
test.describe('Adverse events: "Mark reported to FDA"', () => {
  test.beforeEach(async ({ page, backend }) => {
    backend.tables.adverse_event_reports = [{
      id: 'ae-1', product_name: 'SYNTHETIC product A', date_received: '2026-09-28', description: 'SYNTHETIC report', outcome_type: 'other',
      fda_report_deadline: '2026-10-20', fda_reported: false, fda_reported_at: null, reporter_name: null, reporter_contact: null, created_at: '2026-09-28T00:00:00Z',
    }];
    await login(page);
    await open(page, 'adverseEventsPanel');
  });

  test('current behaviour: one click records the report as filed, with no confirmation and no undo button', async ({ page, backend }) => {
    await page.locator('#adverseEventsWrap [data-id="ae-1"] .aeMarkReportedBtn').click();
    await expect.poll(() => backend.tables.adverse_event_reports[0].fda_reported).toBe(true);
    await expect(page.locator('#adverseEventsWrap [data-id="ae-1"] .aeMarkReportedBtn')).toHaveCount(0);
  });

  test('wanted: the first press only asks to confirm and sends nothing', async ({ page, backend }) => {
    test.fail(true, 'Fix pending (owner decision): two-press confirmation for the FDA flag — docs/ops/other-fixes-review.md N11');
    await page.locator('#adverseEventsWrap [data-id="ae-1"] .aeMarkReportedBtn').click();
    await page.waitForTimeout(300);
    expect(writes(backend, 'adverse_event_reports')).toEqual([]);
  });
});

// ------------------------------------- Accounting: unpaged totals (N14)
test.describe('Accounting: "All Time" totals', () => {
  test('current behaviour: orders and expenses are fetched in one unpaged request each (capped by Supabase "Max rows")', async ({ page, backend }) => {
    await login(page);
    await open(page, 'accountingPanel');
    const before = backend.requests.length;
    await page.click('#accountingPanel button[data-range="all"]');
    await expect.poll(() => backend.requests.slice(before).filter(r => r.method === 'GET' && (r.table === 'orders' || r.table === 'expenses')).length).toBe(2);
    for (const r of backend.requests.slice(before).filter(r => r.method === 'GET' && (r.table === 'orders' || r.table === 'expenses'))) {
      const keys = r.params.map(([k]) => k);
      expect(keys).not.toContain('limit');
      expect(keys).not.toContain('offset');
      expect(r.headers['range']).toBeUndefined();
    }
    // When N14 is fixed (database sum or .range() paging), replace this test with one for the new behaviour.
  });
});
