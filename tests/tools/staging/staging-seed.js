// Synthetic data for the STAGING review page (EXT8, workstream O). Everything
// here is made up; e-mails use example.test. Dates are relative to the moment
// the page opens, so "today", "overdue" and "this month" look current.
// Works in Node (build checks) and in the browser (the review page).

function stagingTables(nowMs) {
  const now = nowMs || Date.now();
  const H = 3600 * 1000, D = 24 * H;
  const at = ms => new Date(now + ms).toISOString();
  const day = ms => at(ms).slice(0, 10);
  const inv = (id, pid, available, threshold) => ({ id, product_id: pid, available, reserved: 0, damaged: 0, sample: 0, wholesale: 0, promotional: 0, returned: 0, recalled: 0, low_stock_threshold: threshold });
  const invA = inv('inv-a', 'prod-a', 3, 10), invB = inv('inv-b', 'prod-b', 48, 12), invC = inv('inv-c', 'prod-c', 20, null);
  const order = (id, num, name, status, total, tax, placed, source, province) => ({ id, order_number: num, customer_name: name, customer_email: id + '@example.test', status, currency: 'USD',
    total, tax_total: tax, subtotal: null, shipping_total: null, placed_at: placed, deleted_at: null, source, raw_data: province ? { shipping_address: { province } } : null, created_at: placed });
  return {
    tasks: [
      { id: 't1', title: 'SYNTHETIC Confirm label proof with the printer', priority: 'high', status: 'open', due_at: at(-2 * D), created_at: at(-6 * D), updated_at: at(-6 * D) },
      { id: 't2', title: 'SYNTHETIC Count lavender lotion stock', priority: 'normal', status: 'in_progress', due_at: at(1 * D), created_at: at(-3 * D), updated_at: at(-1 * D) },
      { id: 't3', title: 'SYNTHETIC Photograph new jar samples', priority: 'normal', status: 'open', due_at: at(4 * D), created_at: at(-1 * D), updated_at: at(-1 * D) },
      { id: 't4', title: 'SYNTHETIC Send invoice copy to accountant', priority: 'low', status: 'done', due_at: at(-1 * D), created_at: at(-5 * D), updated_at: at(-3 * H) },
      { id: 't5', title: 'SYNTHETIC Old supplier follow-up', priority: 'low', status: 'cancelled', due_at: at(-9 * D), created_at: at(-12 * D), updated_at: at(-2 * D) },
    ],
    approval_requests: [
      { id: 'ap1', action_type: 'refund', summary: 'SYNTHETIC Refund $18.00 on order SYN-2003 (damaged jar)', status: 'pending', created_at: at(-26 * H) },
      { id: 'ap2', action_type: 'discount', summary: 'SYNTHETIC Wholesale discount 10% for SYNTHETIC Spa', status: 'pending', created_at: at(-3 * H) },
      { id: 'ap3', action_type: 'refund', summary: 'SYNTHETIC Refund $5.00', status: 'approved', created_at: at(-4 * D) },
    ],
    incidents: [
      { id: 'inc1', incident_number: 'INC-0007', title: 'SYNTHETIC Batch L-0412 cap leaks', severity: 'high', status: 'open', due_at: at(1 * D), created_at: at(-2 * D) },
      { id: 'inc2', incident_number: 'INC-0006', title: 'SYNTHETIC Label typo on 4 oz jar', severity: 'low', status: 'open', due_at: at(6 * D), created_at: at(-5 * D) },
      { id: 'inc3', incident_number: 'INC-0005', title: 'SYNTHETIC Courier delay', severity: 'medium', status: 'resolved', due_at: at(-10 * D), created_at: at(-14 * D) },
    ],
    customer_inquiries: [
      { id: 'q1', customer_name: 'SYNTHETIC Avery', customer_email: 'avery@example.test', channel: 'email', question_text: 'SYNTHETIC Is the lotion safe for sensitive skin?', status: 'needs_review', severity: 'high', ai_draft_reply: 'SYNTHETIC draft: Thank you for asking…', created_at: at(-5 * H) },
      { id: 'q2', customer_name: 'SYNTHETIC Jordan', customer_email: 'jordan@example.test', channel: 'web', question_text: 'SYNTHETIC Where is my order?', status: 'new', severity: null, created_at: at(-2 * H) },
      { id: 'q3', customer_name: 'SYNTHETIC Riley', customer_email: 'riley@example.test', channel: 'email', question_text: 'SYNTHETIC Do you ship to Canada?', status: 'answered', severity: 'low', created_at: at(-3 * D), answered_at: at(-2 * D) },
    ],
    orders: [
      order('o1', 'SYN-2001', 'SYNTHETIC Avery', 'paid', 42.5, 3.4, at(-2 * H), 'shopify', 'Texas'),
      order('o2', 'SYN-2002', 'SYNTHETIC Jordan', 'fulfilled', 88, 7.04, at(-1 * D), 'shopify', 'CA'),
      order('o3', 'SYN-2003', 'SYNTHETIC Riley', 'partially_refunded', 60, 4.8, at(-3 * D), 'shopify', 'california'),
      order('o4', 'SYN-2004', 'SYNTHETIC Casey', 'cancelled', 25, 2, at(-4 * D), 'shopify', 'NY'),
      order('o5', 'MAN-2005', 'SYNTHETIC Spa (wholesale)', 'paid', 320, 0, at(-6 * D), 'manual', null),
      order('o6', 'MAN-2006', 'SYNTHETIC Walk-in', 'paid', 18, 0, at(-1 * D), 'manual', null), // saved without items
    ],
    order_items: [
      { id: 'oi1', order_id: 'o1', sku: 'HE-LAV-8', product_name: 'SYNTHETIC Lavender Lotion 8 oz', quantity: 2, unit_price: 21.25, line_total: 42.5 },
      { id: 'oi2', order_id: 'o2', sku: 'HE-ROSE-4', product_name: 'SYNTHETIC Rose Balm 4 oz', quantity: 4, unit_price: 22, line_total: 88 },
      { id: 'oi3', order_id: 'o3', sku: 'he-lav-8', product_name: 'SYNTHETIC Lavender Lotion 8 oz', quantity: 3, unit_price: 20, line_total: 60 },
      { id: 'oi5', order_id: 'o5', sku: 'HE-CIT-16', product_name: 'SYNTHETIC Citrus Wash 16 oz', quantity: 20, unit_price: 16, line_total: 320 },
    ],
    products: [
      { id: 'prod-a', name: 'SYNTHETIC Lavender Lotion 8 oz', sku: 'HE-LAV-8', is_active: true, status: 'active', cost: 6.5, retail_price: 21.25, wholesale_price: 12, packaging_info: 'SYNTHETIC amber jar', updated_at: at(-10 * D), inventory: invA, inventory_lots: [{ lot_number: 'L-0412', quantity_remaining: 3, received_at: at(-30 * D), expires_at: day(300 * D) }] },
      { id: 'prod-b', name: 'SYNTHETIC Rose Balm 4 oz', sku: 'HE-ROSE-4', is_active: true, status: 'active', cost: 4.25, retail_price: 22, wholesale_price: 13, packaging_info: null, updated_at: at(-20 * D), inventory: invB, inventory_lots: [] },
      { id: 'prod-c', name: 'SYNTHETIC Citrus Wash 16 oz', sku: 'HE-CIT-16', is_active: true, status: 'draft', cost: 5, retail_price: 24, wholesale_price: 16, packaging_info: null, updated_at: at(-2 * D), inventory: invC, inventory_lots: [] },
    ],
    inventory: [invA, invB, invC],
    inventory_adjustments: [
      { id: 'adj1', product_id: 'prod-a', bucket: 'available', change_amount: -2, reason: 'SYNTHETIC sold at market', adjusted_at: at(-1 * D), products: { name: 'SYNTHETIC Lavender Lotion 8 oz', sku: 'HE-LAV-8' } },
    ],
    suppliers: [
      { id: 'sup1', name: 'SYNTHETIC Botanicals Co', supplier_type: 'supplier', contact_name: 'SYNTHETIC Sam', email: 'sam@example.test', phone: null, notes: null, is_active: true },
      { id: 'sup2', name: 'SYNTHETIC Glass Jars Ltd', supplier_type: 'packaging', contact_name: null, email: null, phone: null, notes: null, is_active: true },
    ],
    purchase_orders: [
      { id: 'po1', po_number: 'PO-1031', supplier_id: 'sup2', status: 'ordered', currency: 'USD', shipping_cost: 18, tax: 4.2, expense_category: 'packaging', ordered_at: day(-12 * D), expected_at: day(-3 * D), received_at: null, payment_status: 'unpaid', notes: null, created_at: at(-12 * D), deleted_at: null,
        suppliers: { name: 'SYNTHETIC Glass Jars Ltd' }, purchase_order_items: [{ id: 'pl1', product_id: null, description: 'SYNTHETIC 8 oz amber jars', sku: null, quantity: 500, unit_cost: 0.42, quantity_received: 0, landed_unit_cost: null }] },
      { id: 'po2', po_number: 'PO-1032', supplier_id: 'sup1', status: 'draft', currency: 'USD', shipping_cost: 0, tax: 0, expense_category: 'ingredients', ordered_at: null, expected_at: null, received_at: null, payment_status: 'unpaid', notes: null, created_at: at(-1 * D), deleted_at: null,
        suppliers: { name: 'SYNTHETIC Botanicals Co' }, purchase_order_items: [{ id: 'pl2', product_id: 'prod-a', description: 'SYNTHETIC lavender oil', sku: 'HE-LAV-8', quantity: 40, unit_cost: 3.1, quantity_received: 0, landed_unit_cost: null }] },
    ],
    expenses: [
      { id: 'e1', category: 'packaging', amount: 64.2, expense_date: day(-2 * D), vendor: 'SYNTHETIC Box Co', note: null, receipt_path: null, deleted_at: null, created_at: at(-2 * D) },
      { id: 'e2', category: 'advertising', amount: 45.5, expense_date: day(-8 * D), vendor: 'SYNTHETIC Ads', note: 'SYNTHETIC spring ad', receipt_path: null, deleted_at: null, created_at: at(-8 * D) },
      { id: 'e3', category: 'ingredients', amount: 120, expense_date: day(-15 * D), vendor: 'SYNTHETIC Botanicals Co', note: null, receipt_path: null, deleted_at: null, created_at: at(-15 * D) },
    ],
    returns: [
      { id: 'r1', order_id: 'o3', order_item_id: 'oi3', reason: 'damaged', status: 'requested', product_condition: 'damaged', disposition: null, refund_amount: null, approved_at: null, received_at: null, refunded_at: null, notes: null, created_at: at(-20 * H),
        orders: { order_number: 'SYN-2003', customer_name: 'SYNTHETIC Riley' }, order_items: { product_name: 'SYNTHETIC Lavender Lotion 8 oz', sku: 'he-lav-8', quantity: 3 } },
    ],
    service_status: [
      { id: 's1', service_name: 'Apple Calendar Sync', category: 'calendar', status: 'operational', notes: null, updated_at: at(-1 * D) },
      { id: 's2', service_name: 'SYNTHETIC Shipping labels', category: 'shipping', status: 'degraded', notes: 'SYNTHETIC slow printing', updated_at: at(-3 * H) },
      { id: 's3', service_name: 'SYNTHETIC Payment provider', category: 'payments', status: null, notes: null, updated_at: at(-7 * D) },
    ],
    feature_flags: [{ id: 'ff1', flag_key: 'shopify_order_sync', label: 'Shopify order sync', description: 'SYNTHETIC', enabled: false }],
    system_mode: [{ id: 'sm1', mode: 'NORMAL', reason: null, updated_at: at(-10 * D) }],
  };
}

if (typeof module !== 'undefined') module.exports = { stagingTables };
