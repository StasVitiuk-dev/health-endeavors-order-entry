// EXT6 (workstream 11 / 24): a static safety check over every database DRAFT
// the owner may one day install (docs/ops/sql/drafts, install and rollback
// files; the local test files are excluded). A tripwire, not a proof: it
// catches the classic mistakes in functions and permissions before review.
// Node-only, no browser, no database.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

const DIR = path.resolve(__dirname, '..', '..', 'docs', 'ops', 'sql', 'drafts');
const INSTALLS = ['10_DRAFT_stock_functions.sql', '13_DRAFT_report_totals.sql', '17_DRAFT_po_line_delete_guard.sql', '19_DRAFT_request_keys.sql', '21_DRAFT_stock_function_switches.sql', '23_DRAFT_integrity_constraints.sql'];
const ROLLBACKS = { '10_DRAFT_stock_functions.sql': '11_DRAFT_rollback_stock_functions.sql',
  '17_DRAFT_po_line_delete_guard.sql': '18_DRAFT_rollback_po_line_delete_guard.sql',
  '19_DRAFT_request_keys.sql': '20_DRAFT_rollback_request_keys.sql',
  '21_DRAFT_stock_function_switches.sql': '22_DRAFT_rollback_stock_function_switches.sql',
  '23_DRAFT_integrity_constraints.sql': '24_DRAFT_rollback_integrity_constraints.sql' };
const ALL = fs.readdirSync(DIR).filter(f => /^\d\d_DRAFT_.*\.sql$/.test(f) && !/_tests?_/.test(f));

// Remove comments and quoted text so words inside them are not mistaken for SQL.
function code(sql) {
  return sql.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
}
function outsideFunctions(sql) { // top-level statements only (function bodies removed)
  return sql.replace(/\$(\w*)\$[\s\S]*?\$\1\$/g, '$$ body $$');
}
function functions(sql) { // each "create ... function ... as $tag$ ... $tag$" block
  const out = [];
  const re = /create\s+(or\s+replace\s+)?function\s+([\w.]+)\s*\(([\s\S]*?)\$(\w*)\$([\s\S]*?)\$\4\$/gi;
  let m;
  while ((m = re.exec(sql))) out.push({ name: m[2], header: m[3], body: m[5] });
  return out;
}

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'Node-only; run once'); });

test('the list of drafts is the one this check knows (a new draft must be added here on purpose)', () => {
  expect(ALL.sort()).toEqual([...INSTALLS, ...Object.values(ROLLBACKS)].sort());
});

for (const f of ALL) {
  test(`${f}: one transaction, nothing given to anonymous visitors, row-level security untouched`, () => {
    const sql = outsideFunctions(code(fs.readFileSync(path.join(DIR, f), 'utf8'))).toLowerCase();
    expect(sql, 'starts a transaction').toMatch(/^\s*begin\s*;/);
    expect(sql.trim(), 'ends with commit').toMatch(/commit\s*;$/);
    expect(sql, 'no grant to anon / public').not.toMatch(/grant\s[^;]*\bto\s+[^;]*\b(anon|public)\b/);
    expect(sql, 'row-level security never switched off').not.toMatch(/disable\s+row\s+level\s+security|no\s+force\s+row\s+level/);
    expect(sql, 'policies never created, changed or dropped').not.toMatch(/\b(create|alter|drop)\s+policy\b/);
    expect(sql, 'no table or schema is dropped').not.toMatch(/\bdrop\s+(table|schema)\b/);
    // The one allowed delete (EXT9): the switches rollback removes exactly the
    // five stock_fn_* rows its install added, nothing else.
    const allowed = f === '22_DRAFT_rollback_stock_function_switches.sql'
      ? sql.replace(/delete from public\.feature_flags\s+where flag_key in \('stock_fn_receive_po', 'stock_fn_recall', 'stock_fn_return', 'stock_fn_adjust', 'stock_fn_delete_product'\);/, '')
      : sql;
    expect(allowed, 'no data deleted or truncated').not.toMatch(/\btruncate\b|^\s*delete\s+from\b/m);
  });

  test(`${f}: every function pins its search path; elevated (definer) functions are not used`, () => {
    const sql = code(fs.readFileSync(path.join(DIR, f), 'utf8'));
    for (const fn of functions(sql)) {
      expect(fn.header.toLowerCase(), `${fn.name} sets search_path`).toMatch(/set\s+search_path\s*=\s*public\s*,\s*pg_temp/);
      expect(fn.header.toLowerCase(), `${fn.name} runs with the caller's rights`).not.toMatch(/security\s+definer/);
    }
  });

  test(`${f}: dynamic SQL only through format() with safe placeholders`, () => {
    const sql = code(fs.readFileSync(path.join(DIR, f), 'utf8'));
    const executes = (sql.match(/\bexecute\s+(?!function\b|procedure\b|on\b)[^;]*/gi) || []);
    for (const e of executes) {
      expect(e, 'built with format()').toMatch(/^execute\s+format\s*\(/i);
      const template = (e.match(/format\s*\(\s*'((?:[^']|'')*)'/i) || [])[1] || '';
      expect(template, 'names quoted with %I, values with %L or $n (never %s)').not.toMatch(/%s/);
    }
  });
}

for (const [install, rollback] of Object.entries(ROLLBACKS)) {
  test(`${install} names its rollback file, and the rollback exists`, () => {
    expect(fs.readFileSync(path.join(DIR, install), 'utf8')).toContain(rollback);
    expect(fs.existsSync(path.join(DIR, rollback))).toBe(true);
  });
}

test('every function a draft creates is revoked from everyone and granted only to signed-in staff (or not at all)', () => {
  for (const f of INSTALLS) {
    const sql = code(fs.readFileSync(path.join(DIR, f), 'utf8')).toLowerCase();
    for (const fn of functions(sql)) {
      const name = fn.name.replace(/^public\./, '');
      expect(sql, `${f}: ${name} revoked from public`).toMatch(new RegExp(`revoke\\s+all\\s+on\\s+function\\s+public\\.${name}\\b[^;]*from\\s+public`));
      const grants = sql.match(new RegExp(`grant\\s+execute\\s+on\\s+function\\s+public\\.${name}\\b[^;]*;`, 'g')) || [];
      for (const g of grants) expect(g, `${f}: ${name} granted to authenticated only`).toMatch(/to\s+authenticated\s*;$/);
    }
  }
});
