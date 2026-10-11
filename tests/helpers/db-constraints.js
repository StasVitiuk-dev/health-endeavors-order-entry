// The real database's value rules, so the mock refuses what Supabase refuses.
//
// Source: Query A (read-only schema check of the production project, run by
// the owner on 2026-10-05). Only the rules themselves are copied here, not
// any data. Each entry is a CHECK constraint the database enforces:
//   ALLOWED[table][column] = every value the column may hold (null is
//   allowed unless the column is listed in NOT_NULL)
//   NON_NEGATIVE[table] / POSITIVE[table] = columns with a ">= 0" / "> 0" rule
//
// Tables Query A did not cover (incidents, feature_flags, sop_documents, …)
// are not listed: their rules are unknown until a later read-only check
// (Query C section 9). See docs/ops/state-machine-audit.md.
//
// mock-supabase.js calls checkWrite() on every insert / update / upsert. A
// write that breaks a rule gets the same reply the real database gives
// (HTTP 400, code 23514) and is recorded in backend.constraintViolations;
// the shared test setup fails any test that leaves one behind.

const ALLOWED = {
  approval_requests: { status: ['pending', 'approved', 'rejected'] },
  audit_log: { action: ['INSERT', 'UPDATE', 'DELETE'] },
  documents: {
    category: ['contract', 'insurance', 'certification', 'license', 'tax', 'manufacturing_agreement', 'other'],
    related_type: ['supplier', 'general'],
  },
  expenses: {
    category: ['packaging', 'ingredients', 'shipping_supplies', 'advertising', 'software', 'manufacturing', 'other'],
  },
  inventory_adjustments: {
    bucket: ['available', 'reserved', 'damaged', 'sample', 'wholesale', 'promotional', 'returned', 'recalled'],
  },
  products: { status: ['draft', 'active', 'discontinued'] },
  purchase_orders: {
    status: ['draft', 'ordered', 'shipped', 'received', 'cancelled'],
    payment_status: ['unpaid', 'partial', 'paid'],
    expense_category: ['packaging', 'ingredients', 'shipping_supplies', 'advertising', 'software', 'manufacturing', 'other'],
  },
  recalls: {
    status: ['initiated', 'quarantined', 'resolved'],
    severity: ['low', 'normal', 'high', 'critical'],
  },
  returns: {
    status: ['requested', 'approved', 'rejected', 'received', 'refunded', 'closed'],
    disposition: ['restock_available', 'restock_damaged', 'discard'],
    product_condition: ['resalable', 'damaged', 'used', 'unknown'],
  },
  suppliers: { supplier_type: ['supplier', 'manufacturer', 'lab', 'packaging', 'freight', 'other'] },
  tasks: {
    status: ['open', 'in_progress', 'done', 'cancelled'],
    priority: ['low', 'normal', 'high', 'urgent'],
  },
};

// Columns that are NOT NULL in the real schema among the ones above (a write
// of null is refused; leaving the column out of an update is fine).
const NOT_NULL = {
  approval_requests: ['status'], audit_log: ['action'], documents: ['category'], expenses: ['category'],
  inventory_adjustments: ['bucket'], products: ['status'],
  purchase_orders: ['status', 'payment_status', 'expense_category'],
  recalls: ['status', 'severity', 'reason'], returns: ['status', 'reason'],
  suppliers: ['supplier_type'], tasks: ['status', 'priority'],
};

// NOT NULL columns with no default among the ones above: an insert that
// leaves them out is refused by the real database.
const INSERT_REQUIRED = {
  // every NOT NULL column without a default, per Query A (TQ-04, 2026-10-06)
  approval_requests: ['action_type', 'summary'],
  documents: ['title'],
  evidence_locker: ['title'],
  expenses: ['category', 'amount'],
  inventory: ['product_id'],
  inventory_adjustments: ['product_id', 'bucket', 'change_amount'],
  inventory_lots: ['product_id', 'lot_number', 'quantity_received'],
  order_items: ['order_id'],
  orders: ['channel'],
  products: ['name'],
  purchase_order_items: ['purchase_order_id', 'description', 'quantity'],
  purchase_orders: ['supplier_id'],
  recalls: ['lot_id', 'reason'],
  returns: ['order_id', 'reason'],
  suppliers: ['name'],
  tasks: ['title'],
};

// "recalled" has no ">= 0" rule in the real database (Query A), so it is
// deliberately absent here.
const NON_NEGATIVE = {
  inventory: ['available', 'reserved', 'damaged', 'sample', 'wholesale', 'promotional', 'returned'],
};

// Columns with a "> 0" rule.
const POSITIVE = {
  expenses: ['amount'],
  inventory_lots: ['quantity_received'],
  purchase_order_items: ['quantity'],
};

// Returns a list of { table, column, value, constraint } for every rule the
// row(s) in `body` break. Only columns present in a row are checked, like an
// UPDATE that leaves other columns alone.
function checkWrite(table, body, { isInsert = false } = {}) {
  const rows = Array.isArray(body) ? body : (body && typeof body === 'object' ? [body] : []);
  const out = [];
  const allowed = ALLOWED[table] || {};
  const notNull = new Set(NOT_NULL[table] || []);
  const nonNeg = NON_NEGATIVE[table] || [];
  const positive = POSITIVE[table] || [];
  for (const row of rows) {
    for (const [col, values] of Object.entries(allowed)) {
      if (!Object.prototype.hasOwnProperty.call(row, col)) continue;
      const v = row[col];
      if (v == null) continue; // null is handled by NOT_NULL below
      if (!values.includes(v)) out.push({ table, column: col, value: v, constraint: `${table}_${col}_check` });
    }
    for (const col of notNull) {
      if (Object.prototype.hasOwnProperty.call(row, col) && row[col] == null) {
        out.push({ table, column: col, value: null, constraint: `${col} NOT NULL` });
      }
    }
    if (isInsert) {
      for (const col of INSERT_REQUIRED[table] || []) {
        if (row[col] == null) out.push({ table, column: col, value: row[col], constraint: `${col} NOT NULL (no default)` });
      }
    }
    for (const col of positive) {
      if (Object.prototype.hasOwnProperty.call(row, col) && row[col] != null && !(Number(row[col]) > 0)) {
        out.push({ table, column: col, value: row[col], constraint: `${table}_${col}_check` });
      }
    }
    for (const col of nonNeg) {
      if (Object.prototype.hasOwnProperty.call(row, col) && row[col] != null && Number(row[col]) < 0) {
        out.push({ table, column: col, value: row[col], constraint: `${table}_${col}_check` });
      }
    }
  }
  return out;
}

module.exports = { ALLOWED, NOT_NULL, INSERT_REQUIRED, NON_NEGATIVE, POSITIVE, checkWrite };
