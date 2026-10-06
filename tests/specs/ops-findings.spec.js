// Tests only (no dashboard change): findings from the 2026-10-04 operations
// review (docs/ops/other-fixes-review.md). Synthetic data; the mock answers
// every request and nothing leaves the test browser.
//
// Most findings were fixed on 2026-10-05 (branch
// claude/platform-overnight-implementation); their tests now pin the fixed
// behaviour. Anything still open keeps a "wanted" test marked test.fail().

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

  test('the update only applies while the request still has the status the page showed', async ({ page, backend }) => {
    await page.locator('.approvalRow[data-id="ap-1"] .approveBtn').click();
    await confirmPassword(page);
    await expect.poll(() => writes(backend, 'approval_requests').length).toBe(1);
    expect(filtersOf(writes(backend, 'approval_requests')[0])).toEqual({ id: 'eq.ap-1', status: 'eq.pending' });
    expect(backend.tables.approval_requests[0].status).toBe('approved');
  });

  test('a stale page cannot overwrite a decision made elsewhere (stays approved, page says so)', async ({ page, backend }) => {
    backend.tables.approval_requests[0].status = 'approved'; // decided in another tab after this page loaded
    await page.locator('.approvalRow[data-id="ap-1"] .denyBtn').click();
    await confirmPassword(page);
    await expect(page.locator('#dashError')).toContainText('already changed');
    expect(backend.tables.approval_requests[0].status).toBe('approved');
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

  test('Cancel after the order was received elsewhere is refused; it stays received', async ({ page, backend }) => {
    const box = await openPo(page, 'syn-shipped');
    backend.tables.purchase_orders[0].status = 'received'; // received in another tab after this page loaded
    const cancel = box.locator('.poStatusBtn[data-next="cancelled"]');
    await cancel.click();
    await cancel.click(); // second press confirms
    await expect(page.locator('#dashError')).toContainText('already changed');
    expect(backend.tables.purchase_orders[0].status).toBe('received');
    expect(filtersOf(writes(backend, 'purchase_orders')[0])).toEqual({ id: 'eq.syn-shipped', status: 'in.(draft,ordered,shipped)', deleted_at: 'is.null' });
  });

  test('the first press of Cancel only asks to confirm and sends nothing', async ({ page, backend }) => {
    const box = await openPo(page, 'syn-shipped');
    await box.locator('.poStatusBtn[data-next="cancelled"]').click();
    await page.waitForTimeout(300);
    expect(writes(backend, 'purchase_orders')).toEqual([]);
    await expect(box.locator('.poStatusBtn[data-next="cancelled"]')).toHaveText('Really cancel this order?');
  });

  // ---- N1: lot numbers were looked up with ilike, so _ and % acted as wildcards
  test('a typed lot number is matched literally (_ and % escaped)', async ({ page, backend }) => {
    const box = await openPo(page, 'syn-shipped');
    await box.locator('.poLineLot[data-line="line-a"]').fill('A_1');
    await box.locator('.poReceiveBtn').click();
    await expect.poll(() => reads(backend, 'inventory_lots').filter(r => filtersOf(r).lot_number).length).toBeGreaterThan(0);
    const lookup = reads(backend, 'inventory_lots').find(r => filtersOf(r).lot_number);
    expect(filtersOf(lookup).lot_number).toBe('ilike.A\\_1');
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

  test('releasing asks for the password first; Cancel sends nothing', async ({ page, backend }) => {
    await page.locator('#legalHoldsWrap [data-id="lh-1"] .lhReleaseBtn').click();
    await expect(page.locator('#reauthOverlay')).toBeVisible();
    await page.click('#reauthCancelBtn');
    await page.waitForTimeout(300);
    expect(writes(backend, 'legal_holds')).toEqual([]);
  });

  test('with the password, only an active hold is released', async ({ page, backend }) => {
    await page.locator('#legalHoldsWrap [data-id="lh-1"] .lhReleaseBtn').click();
    await confirmPassword(page);
    await expect.poll(() => writes(backend, 'legal_holds').length).toBe(1);
    expect(filtersOf(writes(backend, 'legal_holds')[0])).toEqual({ id: 'eq.lh-1', status: 'eq.active' });
    expect(backend.tables.legal_holds[0].status).toBe('released');
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

  test('Approve on a stale page cannot re-open a refunded return', async ({ page, backend }) => {
    backend.tables.returns[0].status = 'refunded'; // received, restocked and refunded in another tab
    await page.locator('[data-return-id="ret-1"] .decideReturnBtn[data-next="approved"]').click();
    await expect(page.locator('#dashError')).toContainText('already changed');
    expect(backend.tables.returns[0].status).toBe('refunded');
    expect(filtersOf(writes(backend, 'returns')[0])).toEqual({ id: 'eq.ret-1', status: 'eq.requested' });
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

  test('resolving needs a written note; without one nothing is sent', async ({ page, backend }) => {
    await page.locator('#recallsPanel [data-id="rc-1"] .recallResolveBtn').click();
    await expect(page.locator('#dashError')).toContainText('Write what resolved this recall');
    expect(writes(backend, 'recalls')).toEqual([]);
  });

  test('with a note, a never-quarantined recall needs a second press, and the update is conditional', async ({ page, backend }) => {
    const row = page.locator('#recallsPanel [data-id="rc-1"]');
    await row.locator('.recallResolutionInput').fill('SYNTHETIC: supplier confirmed false alarm');
    await row.locator('.recallResolveBtn').click();
    await expect(row.locator('.recallResolveBtn')).toHaveText('Stock never quarantined — resolve anyway?');
    expect(writes(backend, 'recalls')).toEqual([]);
    await row.locator('.recallResolveBtn').click();
    await expect.poll(() => backend.tables.recalls[0].status).toBe('resolved');
    expect(backend.tables.recalls[0].resolution).toBe('SYNTHETIC: supplier confirmed false alarm');
    expect(filtersOf(writes(backend, 'recalls')[0])).toEqual({ id: 'eq.rc-1', status: 'eq.initiated' });
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

  test('the first press only asks to confirm and sends nothing', async ({ page, backend }) => {
    const btn = page.locator('#adverseEventsWrap [data-id="ae-1"] .aeMarkReportedBtn');
    await btn.click();
    await expect(btn).toHaveText('Confirm: filed with FDA?');
    await page.waitForTimeout(300);
    expect(writes(backend, 'adverse_event_reports')).toEqual([]);
  });

  test('the second press sets the flag only if it is not already set', async ({ page, backend }) => {
    const btn = page.locator('#adverseEventsWrap [data-id="ae-1"] .aeMarkReportedBtn');
    await btn.click();
    await btn.click();
    await expect.poll(() => backend.tables.adverse_event_reports[0].fda_reported).toBe(true);
    expect(filtersOf(writes(backend, 'adverse_event_reports')[0])).toEqual({ id: 'eq.ae-1', fda_reported: 'not.is.true' });
  });
});

// ------------------------------------- Accounting: unpaged totals (N14)
// Fixed 2026-10-05: totals are read a page at a time with an exact count.
// Full coverage (row caps of 1,000 and 400, short reads) is in report-totals.spec.js.
