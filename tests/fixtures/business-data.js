// Synthetic business data for the page-level tests (Orders, Expenses,
// Accounting, Tax, Inventory, Returns). Everything here is made up.
//
// The tests that use it freeze the browser clock at NOW in the
// America/Chicago time zone, so "today", "this year" and the expected totals
// below never drift. Keep the expected numbers in the spec in sync if you
// change anything here.

const NOW = new Date('2026-06-15T15:00:00Z'); // 10:00 in Chicago, Monday
const iso = ms => new Date(NOW.getTime() + ms).toISOString();
const H = 3600 * 1000, D = 24 * H;

function seedBusiness(backend) {
  const invA = { product_id: 'prod-a', available: 3, reserved: 1, damaged: 2, sample: 0, wholesale: 0, promotional: 0, returned: 0, recalled: 0, low_stock_threshold: 5 };
  const invB = { product_id: 'prod-b', available: 50, reserved: 0, damaged: 0, sample: 4, wholesale: 0, promotional: 0, returned: 0, recalled: 0, low_stock_threshold: null };
  Object.assign(backend.tables, {
    orders: [
      { id: 'o1', order_number: 'SYN-1001', customer_name: 'SYNTHETIC Customer One', customer_email: 'one@example.test', status: 'paid', currency: 'USD', total: 100, tax_total: 8, placed_at: iso(-1 * H), deleted_at: null, source: 'shopify', raw_data: { shipping_address: { province: 'TX' } } },
      { id: 'o2', order_number: 'SYN-1002', customer_name: 'SYNTHETIC Customer Two', customer_email: 'two@example.test', status: 'cancelled', currency: 'USD', total: 50, tax_total: 4, placed_at: iso(-2 * D), deleted_at: null, source: 'shopify', raw_data: null },
      { id: 'o3', order_number: 'SYN-1003', customer_name: 'SYNTHETIC Customer One', customer_email: 'one@example.test', status: 'partially_refunded', currency: 'USD', total: 80, tax_total: 6, placed_at: iso(-3 * D), deleted_at: null, source: 'shopify', raw_data: { shipping_address: { province: 'CA' } } },
      { id: 'o4', order_number: 'SYN-1004', customer_name: 'SYNTHETIC Customer Three', customer_email: 'three@example.test', status: 'refunded', currency: 'USD', total: 40, tax_total: 3, placed_at: iso(-20 * D), deleted_at: null, source: 'shopify', raw_data: null },
      { id: 'o5', order_number: 'SYN-1005', customer_name: 'SYNTHETIC Customer Four', customer_email: 'four@example.test', status: 'fulfilled', currency: 'USD', total: 200, tax_total: 16, placed_at: '2025-11-10T18:00:00Z', deleted_at: null, source: 'shopify', raw_data: null },
      { id: 'o6', order_number: 'SYN-0999', customer_name: 'SYNTHETIC Deleted Customer', customer_email: 'deleted@example.test', status: 'paid', currency: 'USD', total: 30, tax_total: 0, placed_at: iso(-40 * D), deleted_at: iso(-1 * D), source: 'manual', raw_data: null },
    ],
    order_items: [
      { id: 'oi1', order_id: 'o1', sku: 'SYN-A', product_name: 'SYNTHETIC product A', quantity: 2 },
      { id: 'oi2', order_id: 'o1', sku: 'SYN-X', product_name: 'SYNTHETIC unlisted item', quantity: 1 },
      { id: 'oi3', order_id: 'o3', sku: 'SYN-B', product_name: 'SYNTHETIC product B', quantity: 1 },
      { id: 'oi4', order_id: 'o5', sku: 'SYN-A', product_name: 'SYNTHETIC product A', quantity: 5 },
    ],
    products: [
      { id: 'prod-a', name: 'SYNTHETIC product A', sku: 'SYN-A', is_active: true, status: 'active', cost: 2, retail_price: 10, wholesale_price: 6, packaging_info: null, inventory: invA, inventory_lots: [] },
      { id: 'prod-b', name: 'SYNTHETIC product B', sku: 'SYN-B', is_active: true, status: 'active', cost: 5, retail_price: 20, wholesale_price: 12, packaging_info: 'SYNTHETIC jar', inventory: invB, inventory_lots: [] },
    ],
    inventory: [invA, invB],
    inventory_adjustments: [],
    expenses: [
      { id: 'e1', category: 'packaging', amount: 30, expense_date: '2026-06-15', vendor: 'SYNTHETIC Box Co', note: null, receipt_path: 'synthetic-receipt.pdf', deleted_at: null },
      { id: 'e2', category: 'advertising', amount: 45.5, expense_date: '2026-06-02', vendor: '=SYNTHETIC formula vendor', note: 'SYNTHETIC ad', receipt_path: null, deleted_at: null },
      { id: 'e3', category: 'ingredients', amount: 100, expense_date: '2026-05-20', vendor: null, note: null, receipt_path: null, deleted_at: null },
      { id: 'e4', category: 'software', amount: 12, expense_date: '2025-12-31', vendor: 'SYNTHETIC SaaS', note: null, receipt_path: null, deleted_at: null },
      { id: 'e5', category: 'other', amount: 999, expense_date: '2026-06-01', vendor: 'SYNTHETIC deleted', note: null, receipt_path: null, deleted_at: iso(-1 * D) },
    ],
    returns: ['requested', 'approved', 'rejected', 'received'].map((status, i) => ({
      id: 'ret-' + status, order_id: 'o1', order_item_id: 'oi1', reason: 'damaged', status, product_condition: 'resalable',
      disposition: status === 'received' ? 'restock_available' : null, refund_amount: null, approved_at: null, received_at: null,
      refunded_at: null, notes: null, created_at: iso(-(i + 1) * H),
      orders: { order_number: 'SYN-1001', customer_name: 'SYNTHETIC Customer One' },
      order_items: { product_name: 'SYNTHETIC product A', sku: 'SYN-A', quantity: 1 },
    })),
  });
}

module.exports = { NOW, seedBusiness };
