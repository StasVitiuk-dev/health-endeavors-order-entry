// Odd-input probe for the pure operations modules (invoice, reports, inventory,
// views, intake, suppliers). Every exported function is called with empty,
// missing and malformed values. A function may REFUSE (return a reason), but it
// must not throw and must not hang: these modules render inside the dashboard,
// where a crash blanks a section and a hang freezes the page. Found on Nov 14:
// the print-layout paginate() looped forever on a bad page size, and several
// functions crashed on a list containing an empty row.
// Node-only; each module runs in its own short-lived process with a time limit.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { test, expect } = require('@playwright/test');

const ROOT = path.resolve(__dirname, '..', '..');
const DIRS = ['assets/invoice', 'assets/reports', 'assets/inventory', 'assets/views', 'assets/intake', 'assets/suppliers'];
const FILES = DIRS.flatMap(d => fs.readdirSync(path.join(ROOT, d)).filter(f => f.endsWith('.js')).map(f => d + '/' + f));
// Deliberate, documented throws (a programming error, not a data problem).
const ALLOWED = [/^he-saved-views\.js createViewStore\(.*unknown view panel/];

const PROBE = `
const mod = require(process.argv[1]);
const name = require('path').basename(process.argv[1]);
const odd = [undefined, null, 0, -1, NaN, '', 'x', [], {}, [null], [{}], { a: 1 }, '2026-13-45', true, 1e21, '\\u{1F642}', [[]], { length: 3 }];
const out = [];
for (const [fnName, fn] of Object.entries(mod)) {
  if (typeof fn !== 'function') continue;
  const seen = new Set();
  const call = (args, label) => { process.stderr.write('CALL ' + fnName + '(' + label + ')\\n'); try { fn(...args); } catch (e) { const k = name + ' ' + fnName + '(' + label + '): ' + String(e.message).slice(0, 80); if (!seen.has(String(e.message))) { seen.add(String(e.message)); out.push(k); } } };
  call([], 'no args');
  for (const a of odd) { const j = typeof a === 'number' ? String(a) : JSON.stringify(a); call([a], j); call([a, a], 'x2 ' + j); call([a, a, a], 'x3 ' + j); }
  call([{}, [], {}], '{},[],{}'); call([[], {}, []], '[],{},[]');
}
process.stdout.write(JSON.stringify(out));
`;

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'Node-only; run once'); });

test('the probe covers every pure operations module', () => {
  expect(FILES.length).toBeGreaterThanOrEqual(12);
  for (const must of ['assets/invoice/he-invoice.js', 'assets/reports/he-reconcile.js', 'assets/reports/he-ops-anomaly.js', 'assets/reports/he-report-export.js']) expect(FILES).toContain(must);
});

for (const file of FILES) {
  test(`${file}: no function throws or hangs on empty, missing or malformed input`, () => {
    let stdout = '', hungAt = null;
    try {
      stdout = execFileSync(process.execPath, ['-e', PROBE, path.join(ROOT, file)], { timeout: 20000, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 32 * 1024 * 1024 });
    } catch (e) {
      const calls = String(e.stderr || '').trim().split('\n');
      hungAt = (e.killed || e.signal) ? 'timed out at ' + calls[calls.length - 1] : 'probe process failed: ' + String(e.message).slice(0, 200);
    }
    expect(hungAt, hungAt || '').toBeNull();
    const throwsFound = JSON.parse(stdout).filter(line => !ALLOWED.some(re => re.test(line)));
    expect(throwsFound).toEqual([]);
  });
}

test('the example-lead generator has a ceiling and ignores a nonsense count', () => {
  const F = require('../../assets/sales/he-sales-fixtures.js');
  expect(F.leads().length).toBe(12);
  expect(F.leads(0).length).toBe(12);
  expect(F.leads(-3).length).toBe(12);
  expect(F.leads('x').length).toBe(12);
  expect(F.leads(2.9).length).toBe(2);
  expect(F.leads(1e21).length).toBe(200000);
  expect(JSON.stringify(F.leads(24))).toBe(JSON.stringify(F.leads(24)));
});

test('print layout: a bad page size falls back to the default instead of looping', () => {
  const I = require('../../assets/invoice/he-invoice.js');
  const rows = Array.from({ length: 50 }, (_, i) => i);
  for (const bad of [0, -1, NaN, 1.5, '5', [null], {}, Infinity]) expect(I.paginate(rows, bad).length).toBe(3);   // 22 per page -> 3 pages
  expect(I.paginate(rows, 10).length).toBe(5);
  expect(I.paginate(null, 10)).toEqual([[]]);
  expect(I.paginate('not a list', 10)).toEqual([[]]);
});
