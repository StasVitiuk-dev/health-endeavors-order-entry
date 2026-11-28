// FIX 3 (installed in production Nov 27, 2026; docs/ops/PRODUCTION_CHANGE_LOG.md) took away the
// right of signed-in staff to run seven functions that only the scheduled jobs use, and kept
// three for staff. A dashboard page that called one of the seven would work in these mocked tests
// but be refused on the live site. This node-only check reads both lists from the FIX 3 SQL in the
// change log (so they cannot drift) and fails if any dashboard page or program names one of the
// seven, or calls one of the ten that staff may not run. Nothing is run anywhere.

const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

const ROOT = path.resolve(__dirname, '..', '..');

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'Node-only; run once'); });

// The first ```sql block of the FIX 3 change-log entry is the fix as the owner ran it.
function fix3Sql() {
  const log = fs.readFileSync(path.join(ROOT, 'docs', 'ops', 'PRODUCTION_CHANGE_LOG.md'), 'utf8');
  const start = log.indexOf('## 2026-11-27 · FIX 3');
  expect(start, 'FIX 3 entry in the change log').toBeGreaterThan(-1);
  const rest = log.slice(start);
  const next = rest.indexOf('\n## ', 4);
  const entry = next === -1 ? rest : rest.slice(0, next);
  const m = entry.match(/```sql\n([\s\S]*?)```/);
  expect(m, 'FIX 3 SQL block').toBeTruthy();
  return m[1];
}

function lists(sql) {
  const jobOnly = new Set(), staff = new Set();
  for (const m of sql.matchAll(/^revoke execute on function public\.(\w+)\([^)]*\)\s+from public, anon, authenticated;/gm)) jobOnly.add(m[1]);
  for (const m of sql.matchAll(/^grant\s+execute on function public\.(\w+)\([^)]*\)\s+to authenticated;/gm)) staff.add(m[1]);
  return { jobOnly, staff };
}

// Every page and program the browser loads: the six pages and everything under assets/.
function dashboardFiles() {
  const out = fs.readdirSync(ROOT).filter(f => f.endsWith('.html')).map(f => path.join(ROOT, f));
  const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p); else if (/\.(js|html)$/.test(e.name)) out.push(p);
  } };
  walk(path.join(ROOT, 'assets'));
  return out;
}

// Function names used in .rpc('name' …) calls, and every quoted word, in one file's text.
function rpcNames(text) { return [...text.matchAll(/\.rpc\(\s*(['"`])(\w+)\1/g)].map(m => m[2]); }
function mentions(text, name) { return new RegExp('\\b' + name + '\\b').test(text); }

test('the FIX 3 lists are read from the change log: 7 job-only, 3 kept for staff', () => {
  const { jobOnly, staff } = lists(fix3Sql());
  expect([...jobOnly].sort()).toEqual(['check_adverse_event_deadlines', 'check_break_glass_usage', 'check_stale_privacy_deletion_requests',
    'detect_unusual_activity', 'escalate_overdue_tasks', 'generate_daily_report', 'raise_activity_alert']);
  expect([...staff].sort()).toEqual(['generate_account_number', 'log_customer_data_access', 'record_alert']);
});

test('the matcher finds a planted call (so a green result means something)', () => {
  const planted = "await supabase.rpc('raise_activity_alert', { a: 1 }); const x = \"escalate_overdue_tasks\";";
  expect(rpcNames(planted)).toEqual(['raise_activity_alert']);
  expect(mentions(planted, 'escalate_overdue_tasks')).toBe(true);
  expect(mentions('my_escalate_overdue_tasks_v2', 'escalate_overdue_tasks')).toBe(false);
});

test('no dashboard page or program names a function only the scheduled jobs may run', () => {
  const { jobOnly } = lists(fix3Sql());
  const files = dashboardFiles();
  expect(files.length).toBeGreaterThan(10);
  const found = [];
  for (const f of files) {
    const text = fs.readFileSync(f, 'utf8');
    for (const name of jobOnly) if (mentions(text, name)) found.push(path.relative(ROOT, f) + ': ' + name);
  }
  expect(found, 'staff are refused these on the live site since FIX 3').toEqual([]);
});

test('of the ten FIX 3 functions, the dashboard calls only ones staff may run', () => {
  const { jobOnly, staff } = lists(fix3Sql());
  const calls = new Set();
  for (const f of dashboardFiles()) for (const n of rpcNames(fs.readFileSync(f, 'utf8'))) if (jobOnly.has(n) || staff.has(n)) calls.add(n);
  for (const n of calls) expect(staff.has(n), n).toBe(true);
  // Today: only the privacy log on the customer pages (assets/app/he-data.js).
  expect([...calls]).toContain('log_customer_data_access');
});
