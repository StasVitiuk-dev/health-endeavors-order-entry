// EXT14: the SQL package is classified (docs/ops/sql/MANIFEST.json) and linted
// (tests/tools/sql-lint.js). Each check is proved to catch a planted problem in
// a throwaway copy of the folder. Node-only; no database.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const L = require('../tools/sql-lint');
test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });
const SRC = path.join(__dirname, '..', '..', 'docs', 'ops', 'sql');

function copy() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'he-sql-'));
  fs.cpSync(SRC, dir, { recursive: true });
  return dir;
}
const lintDir = (dir, m) => L.lint(m || JSON.parse(fs.readFileSync(path.join(dir, 'MANIFEST.json'), 'utf8')), L.listSql(dir), dir).problems.join('\n');
const edit = (dir, f, fn) => { const p = path.join(dir, f); fs.writeFileSync(p, fn(fs.readFileSync(p, 'utf8'))); };

test('the real SQL package passes the linter; the install order respects dependencies', () => {
  const { problems, order } = L.lint();
  expect(problems).toEqual([]);
  expect(order.indexOf('10')).toBeLessThan(order.indexOf('21'));
  expect(order.indexOf('19')).toBeLessThan(order.indexOf('27'));
  expect(order.indexOf('25')).toBeLessThan(order.indexOf('29'));
});

test('every change draft has a rollback that points back, and every rollback undoes a known change', () => {
  const m = L.loadManifest();
  for (const c of m.changes.filter(x => x.class === 'PRODUCTION-CHANGE-DRAFT')) {
    const rb = m.changes.find(x => x.id === c.rollback);
    expect(rb && rb.rollbackOf, c.id).toBe(c.id);
  }
});

test('catches: unlisted file, read-only file with a write, write draft with no warning, test file in drafts/', () => {
  const dir = copy();
  try {
    fs.writeFileSync(path.join(dir, 'drafts', '99_DRAFT_new.sql'), '-- PRODUCTION CHANGE - DO NOT RUN WITHOUT THE OWNER\'S APPROVAL\nbegin; insert into x values (1); commit;\n');
    edit(dir, '04_READONLY_E_stock_reconciliation.sql', t => t + '\ndelete from inventory where true;\n');
    edit(dir, 'drafts/18_DRAFT_rollback_po_line_delete_guard.sql', t => t.split('\n').filter(l => !/approval|DO NOT RUN|NOT INSTALLED|NOT FOR PRODUCTION/i.test(l) || l.startsWith('-- @')).join('\n'));
    const out = lintDir(dir);
    expect(out).toMatch(/99_DRAFT_new\.sql: not listed in MANIFEST\.json/);
    expect(out).toMatch(/04_READONLY_E.*read-only file contains a write statement/);
    expect(out).toMatch(/18_DRAFT.*no owner-approval/);
    const m = JSON.parse(fs.readFileSync(path.join(dir, 'MANIFEST.json'), 'utf8'));
    m.local.find(x => x.file.endsWith('14_DRAFT_tests_report_totals.sql')).file = 'drafts/14_DRAFT_tests_report_totals.sql';
    fs.renameSync(path.join(dir, 'local-test/draft-tests/14_DRAFT_tests_report_totals.sql'), path.join(dir, 'drafts/14_DRAFT_tests_report_totals.sql'));
    expect(lintDir(dir, m)).toMatch(/LOCAL-TEST is not allowed in docs\/ops\/sql\/drafts/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('catches: UPDATE/DELETE without WHERE, DROP without IF EXISTS, SECURITY DEFINER, missing search_path, grant to anon, no BEGIN', () => {
  const dir = copy();
  try {
    edit(dir, 'drafts/22_DRAFT_rollback_stock_function_switches.sql', t => t.replace(/delete from public\.feature_flags\s+where[^;]*;/, 'delete from public.feature_flags;'));
    edit(dir, 'drafts/18_DRAFT_rollback_po_line_delete_guard.sql', t => t.replace('drop function if exists', 'drop function'));
    edit(dir, 'drafts/13_DRAFT_report_totals.sql', t => t.replace('security invoker\nset search_path = public, pg_temp', 'security definer'));
    edit(dir, 'drafts/31_DRAFT_rollback_report_totals.sql', t => t.replace('drop function if exists', "update orders set total = 0; grant select on orders to anon; drop function if exists"));
    edit(dir, 'drafts/24_DRAFT_rollback_integrity_constraints.sql', t => t.replace(/^begin;/m, ''));
    const out = lintDir(dir);
    expect(out).toMatch(/22_DRAFT.*DELETE without WHERE/);
    expect(out).toMatch(/18_DRAFT.*DROP without IF EXISTS/);
    expect(out).toMatch(/13_DRAFT.*SECURITY DEFINER is not allowed/);
    expect(out).toMatch(/13_DRAFT.*a function without SET search_path/);
    expect(out).toMatch(/31_DRAFT.*UPDATE without WHERE/);
    expect(out).toMatch(/31_DRAFT.*GRANT to public\/anon/);
    expect(out).toMatch(/24_DRAFT.*missing BEGIN/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('catches: missing rollback, cycle, unknown dependency, unjustified dynamic SQL, header drift', () => {
  const dir = copy();
  try {
    const m = JSON.parse(fs.readFileSync(path.join(dir, 'MANIFEST.json'), 'utf8'));
    const byId = id => m.changes.find(c => c.id === id);
    byId('17').rollback = '99';
    byId('10').dependsOn = ['21'];
    byId('23').dependsOn = ['77'];
    delete byId('19').dynamicSql;
    byId('25').risk = 'MEDIUM';  // the file's generated header still says LOW
    const out = lintDir(dir, m);
    expect(out).toMatch(/17_DRAFT.*no rollback draft/);
    expect(out).toMatch(/dependency cycle: (10 → 21 → 10|21 → 10 → 21)/);
    expect(out).toMatch(/23_DRAFT.*depends on unknown draft 77/);
    expect(out).toMatch(/19_DRAFT.*dynamic SQL/);
    expect(out).toMatch(/25_DRAFT.*metadata header missing or out of date/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
