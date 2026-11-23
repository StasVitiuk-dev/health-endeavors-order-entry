// EXT15 property tests on the pure helpers (Node, seeded, bounded). Each test
// prints its seed in the failure message so a failure can be replayed.
//   * CSV: random cells (formula starters = + - @ tab CR LF, quotes, commas,
//     Unicode, RTL marks, full-width forms) → an independent RFC 4180 parser
//     reads back exactly the original text, and no cell can start a formula;
//   * dates: in three time zones (spawned with TZ), across DST changes, month
//     and year ends and leap days, the helpers agree with an Intl-based oracle;
//   * database errors: random shapes never crash the explainer and never come
//     out as "undefined" or "[object Object]";
//   * masking: fake tokens, keys and e-mails never survive maskSensitive;
//   * nightly check / money: absent or malformed values are never "PASS" or a
//     real-looking amount.
const base = require('@playwright/test');
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const test = base.test, expect = base.expect;
test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });
const HELPERS = path.join(__dirname, '..', '..', 'assets', 'owner-login-helpers.js');
const loadHelpers = () => { const w = {}; new Function('window', fs.readFileSync(HELPERS, 'utf8'))(w); return w.HE.helpers; };
const H = loadHelpers();

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }
const pick = (r, a) => a[Math.floor(r() * a.length)];
const J = (...p) => p.join('');

// --- CSV --------------------------------------------------------------------
const PIECES = ['=', '+', '-', '@', '\t', '\r', '\n', '"', ',', ';', "'", 'SUM(A1:A9)', 'cmd|\' /C calc\'!A0', 'HYPERLINK("http://x.example")', 'ÿ', 'é', '中文', '‮', '‏', '＝', '＋', '＠', '😀', ' ', 'abc', '12.50', '-3', '+7', '1,234', '$9', '50%', '\u0000'.replace('\u0000', ''), '\\'];
function parseCsvRow(line) { // independent RFC 4180 reader for one record
  const out = []; let i = 0;
  while (i <= line.length) {
    if (line[i] !== '"') throw new Error('every cell is quoted by csvCell');
    let s = ''; i++;
    for (;;) { if (line[i] === '"' && line[i + 1] === '"') { s += '"'; i += 2; } else if (line[i] === '"') { i++; break; } else { s += line[i]; i++; } }
    out.push(s);
    if (i === line.length) break;
    if (line[i] !== ',') throw new Error('expected a comma at ' + i);
    i++;
  }
  return out;
}
for (const seed of [11, 12, 13, 14, 15]) {
  test(`CSV fuzz seed ${seed}: 2,000 random cells read back exactly; none can start a formula`, () => {
    const r = rng(seed);
    for (let n = 0; n < 2000; n++) {
      const cells = Array.from({ length: 1 + Math.floor(r() * 5) }, () => Array.from({ length: Math.floor(r() * 5) }, () => pick(r, PIECES)).join(''));
      const back = parseCsvRow(cells.map(H.csvCell).join(','));
      expect(back.length, `seed ${seed} row ${n}`).toBe(cells.length);
      back.forEach((b, k) => {
        const orig = cells[k];
        const numeric = /^[-+]?\$?[\d,]+(\.\d+)?%?$/.test(orig);
        if (/^[=+\-@\t\r\n＝＋－＠]/.test(orig) && !numeric) expect(b, `seed ${seed}: ${JSON.stringify(orig)}`).toBe("'" + orig);
        else expect(b, `seed ${seed}: ${JSON.stringify(orig)}`).toBe(orig);
        expect(/^[=+\-@\t\r\n＝＋－＠]/.test(b) && !numeric, `formula starter survived: ${JSON.stringify(b)}`).toBe(false);
      });
    }
    expect(H.csvCell(null)).toBe('""');
    expect(H.csvCell(undefined)).toBe('""');
  });
}

// --- dates in real time zones ----------------------------------------------------
const DATE_PROBE = `
const w = {}; new Function('window', require('fs').readFileSync(${JSON.stringify(HELPERS)}, 'utf8'))(w); const H = w.HE.helpers;
const tz = process.env.TZ;
const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
const wd = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' });
const hm = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const bad = [];
// every 37 minutes across 3 years incl. DST changes, month/year ends and 29 Feb 2028
for (let t = Date.UTC(2026, 0, 1); t < Date.UTC(2029, 0, 1); t += 37 * 60000) {
  const d = new Date(t);
  const want = fmt.format(d);
  if (H.localDateString(d) !== want) bad.push('localDateString ' + d.toISOString() + ' ' + H.localDateString(d) + ' != ' + want);
  const mon = H.startOfWeekMonday(d);
  if (wd.format(mon) !== 'Mon' || hm.format(mon) !== '00:00' || mon > d || d - mon >= 8 * 86400000) bad.push('startOfWeekMonday ' + d.toISOString() + ' -> ' + mon.toISOString());
  const today = H.acctRangeStart('today', d);
  if (fmt.format(today) !== want || hm.format(today) !== '00:00') bad.push('today ' + d.toISOString());
  const month = H.acctRangeStart('month', d);
  if (fmt.format(month) !== want.slice(0, 8) + '01' || hm.format(month) !== '00:00') bad.push('month ' + d.toISOString());
  const y = H.taxRangeStart('lastyear', d);
  if (fmt.format(y.start) !== (Number(want.slice(0, 4)) - 1) + '-01-01' || fmt.format(y.end) !== want.slice(0, 4) + '-01-01') bad.push('lastyear ' + d.toISOString());
  if (bad.length > 5) break;
}
console.log(JSON.stringify(bad));`;
for (const tz of ['America/Chicago', 'America/Los_Angeles', 'Pacific/Auckland']) {
  test(`dates in ${tz}: local day, week start, month and tax-year ranges agree with an independent oracle (3 years, DST, leap day)`, () => {
    const out = execFileSync(process.execPath, ['-e', DATE_PROBE], { env: { ...process.env, TZ: tz }, encoding: 'utf8', maxBuffer: 1 << 20 });
    expect(JSON.parse(out)).toEqual([]);
  });
}

// --- database error shapes ---------------------------------------------------------
for (const seed of [21, 22, 23]) {
  test(`database error fuzz seed ${seed}: the explainer never crashes and never says "undefined" or "[object Object]"`, () => {
    const r = rng(seed);
    const parts = ['new row violates row-level security policy for table "orders"', 'permission denied for table tasks', 'JWT expired', 'PGRST301', 'Failed to fetch',
      'duplicate key value violates unique constraint "x_key"', 'violates check constraint "chk"', '', ' ', '<b>html</b>', 'null', '{"a":1}', 'violates foreign key constraint "fk" on table "t"', 'TypeError: Load failed'];
    for (let n = 0; n < 1500; n++) {
      const shape = pick(r, ['string', 'null', 'undefined', 'number', 'concat']);
      const input = shape === 'string' ? pick(r, parts) : shape === 'null' ? null : shape === 'undefined' ? undefined : shape === 'number' ? Math.floor(r() * 1000) : pick(r, parts) + ': ' + pick(r, parts);
      const out = H.explainDbError(input);
      expect(typeof out, `seed ${seed} ${String(input)}`).toBe('string');
      expect(out, `seed ${seed} ${String(input)}`).not.toMatch(/undefined|\[object Object\]/);
      expect(out).not.toMatch(/row-level security policy|permission denied for table/i);
      const err = pick(r, [null, undefined, {}, { message: pick(r, parts) }, { message: 'Failed to fetch', code: '57014' }, 'Failed to fetch', 42]);
      expect(typeof H.isNetworkError(err)).toBe('boolean');
    }
    expect(H.isNetworkError({ message: 'Failed to fetch', code: '42501' })).toBe(false); // a coded database error is not "offline"
  });
}

// --- masking of agent error text ----------------------------------------------------
test('masking: fake tokens, keys and e-mails never survive (2,000 random strings)', () => {
  const r = rng(31);
  const secrets = () => [J('eyJhbGciOiJIUzI1NiJ9', '.', 'eyJzdWIiOiJ4In0', '.', 'sig', 'nature', 'abcdefghijklmnop'), J('gh', 'p_', 'A'.repeat(36)), J('sb_', 'secret_', 'x'.repeat(30)),
    J('service', '_role', '_', 'k'.repeat(30)), J('person', '@', 'customer.example.test'), J('sk_', 'live_', '9'.repeat(24))];
  for (let n = 0; n < 2000; n++) {
    const s = secrets();
    const chosen = s.filter(() => r() < 0.5);
    const text = chosen.map(x => pick(r, ['', 'error: ', 'at ', '(', '"']) + x + pick(r, ['', ' failed', ')', '"', ';'])).join(' ');
    const out = H.maskSensitive(text);
    for (const x of chosen) expect(out, `seed 31 #${n}`).not.toContain(x.slice(0, 20));
    expect(out.length).toBeLessThanOrEqual(301);
  }
});

// --- absent or malformed evidence is never "fine" -------------------------------------
test('nightly check: absent, malformed or negative counts are UNKNOWN, never PASS; no runs is never fine', () => {
  const r = rng(41);
  const junk = [null, undefined, '', ' ', 'abc', NaN, -1, '-2', {}, [], Infinity, '1e999', true];
  for (let n = 0; n < 500; n++) expect(H.nightlyCheckLevel({ section: pick(r, ['F01 stuck work', 'F14 impossible value']), found: pick(r, junk) })).toBe('UNKNOWN');
  expect(H.nightlyCheckLevel(null)).toBe('UNKNOWN');
  expect(H.nightlyCheckLevel({ found: 0 })).toBe('PASS');
  const now = Date.parse('2026-10-12T12:00:00Z');
  expect(H.nightlyOverall(null, null, [], now, 26 * 3600e3)).toBe('NOT VERIFIED');
  expect(H.nightlyOverall({ status: 'ok' }, { started_at: 'not a date' }, [{ found: 0 }], now, 26 * 3600e3)).toBe('STALE');
  expect(H.nightlyOverall({ status: 'ok' }, { started_at: '2026-10-12T06:00:00Z' }, [{ found: 'x' }], now, 26 * 3600e3)).not.toBe('PASS');
});

test('money: malformed amounts show "—", never a real-looking figure', () => {
  for (const bad of [NaN, 'abc', 'Infinity', Infinity, -Infinity, '1e999', '12,50', '$5', {}, [1, 2]]) expect(H.fmtMoney(bad, 'USD'), String(bad)).toBe('—');
  expect(H.fmtMoney('12.50', 'USD')).toBe('$12.50');
  expect(H.fmtMoney(-0.004, 'USD')).toBe('$0.00');
});
