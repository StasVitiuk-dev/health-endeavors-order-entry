// State-machine audit (task 3 of the 2026-10-06 session): every status and
// category value the dashboard can write must be one the real database
// accepts. Query A found "denied" (approvals) and Incident / Purchase Order
// document links, both refused by the database; this file makes that class
// of bug fail a test instead of failing in production.
//
// Two layers protect this:
//   1. tests/helpers/db-constraints.js — the mock database refuses any write
//      that breaks a real rule, and every test fails if one happened.
//   2. This file — the value lists themselves (dropdown options, status maps,
//      transition buttons, literal values), checked statically, so a value
//      no test happens to click is still covered.
// Tables whose rules Query A did not cover are listed in
// docs/ops/state-machine-audit.md (waiting for Query C section 9).

const base = require('@playwright/test');
const { load, SOURCE } = require('../helpers/extract-source');
const { ALLOWED, checkWrite } = require('../helpers/db-constraints');
const { buildTables } = require('../fixtures/synthetic-data');
const { seedBusiness } = require('../fixtures/business-data');

const test = base.test;
const expect = base.expect;

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Node-only tests; run once');
});

// Option values of a <select id="…"> written in the HTML.
function optionValues(id) {
  const start = SOURCE.indexOf(`<select id="${id}"`);
  if (start === -1) throw new Error('select not found: ' + id);
  const end = SOURCE.indexOf('</select>', start);
  return [...SOURCE.slice(start, end).matchAll(/value="([^"]*)"/g)].map(m => m[1]).filter(v => v !== '');
}

const M = load([
  'DOCUMENT_LINK_TYPES', 'DOCUMENT_CATEGORY_LABELS', 'PO_STATUS_LABELS', 'PAYMENT_LABELS', 'PO_ALLOWED_FROM',
  'PO_EDITABLE', 'TASK_STATUS_LABELS', 'TASK_NEXT_ACTIONS', 'TASK_ALLOWED_FROM', 'RETURN_STATUS_LABELS',
  'RETURN_CONDITION_LABELS', 'RETURN_DISPOSITION_LABELS',
]);

const subsetOf = (values, allowed) => values.filter(v => !allowed.includes(v));

test.describe('dropdowns only offer values the database accepts', () => {
  const SELECTS = [
    ['prodStatus', 'products', 'status'],
    ['invBucket', 'inventory_adjustments', 'bucket'],
    ['retCondition', 'returns', 'product_condition'],
    ['expCategory', 'expenses', 'category'],
    ['supType', 'suppliers', 'supplier_type'],
    ['poCategory', 'purchase_orders', 'expense_category'],
    ['recallSeverity', 'recalls', 'severity'],
  ];
  for (const [id, table, column] of SELECTS) {
    test(`#${id} → ${table}.${column}`, () => {
      const values = optionValues(id);
      expect(values.length).toBeGreaterThan(0);
      expect(subsetOf(values, ALLOWED[table][column])).toEqual([]);
    });
  }

  test('document categories are exactly the database list (none refused, none missing)', () => {
    expect(Object.keys(M.DOCUMENT_CATEGORY_LABELS).sort()).toEqual([...ALLOWED.documents.category].sort());
  });
  test('document link types are a subset of documents.related_type', () => {
    expect(subsetOf(M.DOCUMENT_LINK_TYPES, ALLOWED.documents.related_type)).toEqual([]);
  });
});

test.describe('status maps and transitions', () => {
  test('purchase orders: labels cover exactly the database statuses; every transition uses valid ones', () => {
    expect(Object.keys(M.PO_STATUS_LABELS).sort()).toEqual([...ALLOWED.purchase_orders.status].sort());
    expect(Object.keys(M.PAYMENT_LABELS).sort()).toEqual([...ALLOWED.purchase_orders.payment_status].sort());
    const used = [...Object.keys(M.PO_ALLOWED_FROM), ...Object.values(M.PO_ALLOWED_FROM).flat(), ...M.PO_EDITABLE];
    expect(subsetOf(used, ALLOWED.purchase_orders.status)).toEqual([]);
  });
  test('purchase orders: no status moves backwards (received and cancelled are final)', () => {
    for (const [to, from] of Object.entries(M.PO_ALLOWED_FROM)) {
      expect(from, `nothing may leave "received" (to ${to})`).not.toContain('received');
      expect(from, `nothing may leave "cancelled" (to ${to})`).not.toContain('cancelled');
      expect(from).not.toContain(to);
    }
  });
  test('tasks: labels, next-step buttons and allowed-from lists use valid statuses; cancelled is final, done only reopens', () => {
    expect(subsetOf(Object.keys(M.TASK_STATUS_LABELS), ALLOWED.tasks.status)).toEqual([]);
    const buttons = Object.entries(M.TASK_NEXT_ACTIONS).flatMap(([from, list]) => [from, ...list.map(a => a.to)]);
    expect(subsetOf(buttons, ALLOWED.tasks.status)).toEqual([]);
    const allowed = [...Object.keys(M.TASK_ALLOWED_FROM), ...Object.values(M.TASK_ALLOWED_FROM).flat()];
    expect(subsetOf(allowed, ALLOWED.tasks.status)).toEqual([]);
    // EXT7: the only way out of "done" is Reopen (back to open); nothing leaves "cancelled".
    for (const [to, from] of Object.entries(M.TASK_ALLOWED_FROM)) {
      if (to !== 'open') expect(from).not.toContain('done');
      expect(from).not.toContain('cancelled');
    }
    expect(M.TASK_ALLOWED_FROM.open).toEqual(['done']);
    // every button has a matching database-side guard
    for (const list of Object.values(M.TASK_NEXT_ACTIONS)) for (const a of list) expect(M.TASK_ALLOWED_FROM[a.to]).toBeTruthy();
  });
  test('returns: labels match the database lists', () => {
    expect(Object.keys(M.RETURN_STATUS_LABELS).sort()).toEqual([...ALLOWED.returns.status].sort());
    expect(Object.keys(M.RETURN_CONDITION_LABELS).sort()).toEqual([...ALLOWED.returns.product_condition].sort());
    expect(Object.keys(M.RETURN_DISPOSITION_LABELS).sort()).toEqual([...ALLOWED.returns.disposition].sort());
  });
});

test.describe('literal values written in the code', () => {
  test('every data-next="…" button value on the return and purchase-order pages is a valid status', () => {
    const values = [...SOURCE.matchAll(/data-next="([a-z_]+)"/g)].map(m => m[1]);
    expect(values.length).toBeGreaterThan(5);
    const valid = [...ALLOWED.returns.status, ...ALLOWED.purchase_orders.status];
    expect(subsetOf(values, valid)).toEqual([]);
  });
  test('approval decisions are valid approval_requests statuses', () => {
    const values = [...SOURCE.matchAll(/decideApproval\(\w+,\s*'([a-z_]+)'\)/g)].map(m => m[1]);
    expect(values.sort()).toEqual(['approved', 'rejected']);
    expect(subsetOf(values, ALLOWED.approval_requests.status)).toEqual([]);
  });
  test('status/bucket literals in guarded updates and inserts on constrained tables are valid', () => {
    // updateIfUnchanged('table', id, { …status: 'x'… }, { …status: 'y'… })
    const bad = [];
    for (const m of SOURCE.matchAll(/updateIfUnchanged\('([a-z_]+)'([\s\S]{0,400}?)\);/g)) {
      const table = m[1];
      if (!ALLOWED[table]) continue;
      for (const [col, values] of Object.entries(ALLOWED[table])) {
        for (const lit of m[2].matchAll(new RegExp(`\\b${col}:\\s*'([a-zA-Z_]+)'`, 'g'))) {
          if (!values.includes(lit[1])) bad.push(`${table}.${col}=${lit[1]}`);
        }
      }
    }
    // .from('table').insert({ … bucket: 'x' … })
    for (const m of SOURCE.matchAll(/from\('([a-z_]+)'\)\s*\.(?:insert|update|upsert)\(\{([\s\S]{0,600}?)\}\)/g)) {
      const table = m[1];
      if (!ALLOWED[table]) continue;
      for (const [col, values] of Object.entries(ALLOWED[table])) {
        for (const lit of m[2].matchAll(new RegExp(`\\b${col}:\\s*'([a-zA-Z_]+)'`, 'g'))) {
          if (!values.includes(lit[1])) bad.push(`${table}.${col}=${lit[1]}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });
});

test.describe('the synthetic test data itself obeys the database rules', () => {
  test('no fixture row holds a value the database would refuse', () => {
    const tables = buildTables();
    const bad = [];
    for (const [table, rows] of Object.entries(tables)) bad.push(...checkWrite(table, rows));
    expect(bad).toEqual([]);
  });
  test('no row of the "realistic business" fixture holds a refused value either', () => {
    const b = { tables: {}, rpc: {} };
    seedBusiness(b);
    const bad = [];
    for (const [table, rows] of Object.entries(b.tables)) if (Array.isArray(rows)) bad.push(...checkWrite(table, rows));
    expect(bad).toEqual([]);
  });
  test('control: the checker refuses "denied", an Incident link and negative stock', () => {
    expect(checkWrite('approval_requests', { status: 'denied' })).toHaveLength(1);
    expect(checkWrite('documents', { related_type: 'incident' })).toHaveLength(1);
    expect(checkWrite('inventory', { available: -1 })).toHaveLength(1);
    expect(checkWrite('inventory', { recalled: -1 })).toHaveLength(0); // no rule on recalled (Query A)
    expect(checkWrite('returns', { order_id: 'x' }, { isInsert: true })).toHaveLength(1); // reason missing
  });
});

// EXT5 (workstream 5): one machine-readable source (tests/fixtures/state-machines.js)
// for both the documentation and these checks.
test.describe('state-machine fixture matches the code and the database', () => {
  const fs = require('fs');
  const path = require('path');
  const { MACHINES, markdown } = require('../fixtures/state-machines');
  const C = load(['TASK_ALLOWED_FROM', 'PO_ALLOWED_FROM', 'FR_NEXT_STATUS', 'PO_EDITABLE']);
  const toFromMap = m => Object.fromEntries(m.transitions.map(([from, to]) => [to, [...from].sort()]));
  const sortVals = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Array.isArray(v) ? [...v].sort() : v]));

  test('tasks and purchase orders: the page\'s allowed-from lists equal the fixture', () => {
    expect(sortVals(C.TASK_ALLOWED_FROM)).toEqual(toFromMap(MACHINES.tasks));
    expect(sortVals(C.PO_ALLOWED_FROM)).toEqual(toFromMap(MACHINES.purchase_orders));
  });
  test('feature requests: the page\'s next-step map equals the fixture', () => {
    expect(C.FR_NEXT_STATUS).toEqual(Object.fromEntries(MACHINES.feature_requests.transitions.map(([from, to]) => [from[0], to])));
  });
  test('every status the fixture lists is exactly the database\'s list (where the database rule is known)', () => {
    for (const m of Object.values(MACHINES)) {
      const allowed = (ALLOWED[m.table] || {})[m.column];
      if (!allowed) continue; // not verified yet (Query C section 9): stated in the notes
      expect([...m.states].sort(), m.table).toEqual([...allowed].sort());
    }
  });
  test('every transition starts and ends in a listed state; terminal states have no way out', () => {
    for (const [name, m] of Object.entries(MACHINES)) {
      for (const [from, to] of m.transitions) {
        expect(m.states, name).toContain(to);
        for (const f of from) expect(m.states, name).toContain(f);
        for (const t of m.terminal) expect(from, `${name}: no move out of terminal ${t}`).not.toContain(t);
      }
    }
  });
  test('each transition\'s "from" condition appears in the page as the condition sent with the write', () => {
    // returns / recalls / approvals / legal holds use literal or shown-status conditions
    expect(SOURCE).toContain("updateIfUnchanged('returns', id, patch, { status: 'requested' })");
    expect(SOURCE).toContain("updateIfUnchanged('returns', id, { status: next, updated_at: new Date().toISOString() }, { status: seen })");
    expect(SOURCE).toMatch(/updateIfUnchanged\('recalls', id, \{\s*status: 'resolved'[\s\S]{0,200}\}, \{ status: seen \}\)/);
  });
  test('docs/ops/STATE_MACHINES.md is generated from the fixture and up to date', () => {
    const doc = fs.readFileSync(path.resolve(__dirname, '..', '..', 'docs', 'ops', 'STATE_MACHINES.md'), 'utf8');
    expect(doc).toBe(markdown() + '\n');
  });
});
