// Unit tests for small calculation and formatting helpers inside
// owner-login.html. They run in Node (no browser) on the functions copied out
// of the page by helpers/extract-source.js, so they check the real code.
// These only need to run once, so they are skipped for the iPhone project.

const base = require('@playwright/test');
const { load } = require('../helpers/extract-source');

const test = base.test;
const expect = base.expect;

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Node-only tests; run once');
});

const H = load([
  'esc', 'fmtMoney', 'CLOSED_WORDS', 'isClosedStatus', 'isOverdue', 'classifyOrderStatus',
  'poLinesTotal', 'poGrandTotal', 'fmtAccountNumber', 'deviceLabel', 'timeAgo',
  'startOfWeekMonday', 'rollupReports', 'BUSINESS_RULE_WHOLE_NUMBER_LIMITS', 'businessRuleValueError',
  'TAX_CATEGORY_MAP', 'fmtDateOnly',
]);

test.describe('esc (HTML escaping)', () => {
  test('drops bidi override/isolate characters that could reverse displayed text (SE-09)', () => {
    expect(H.esc('invoice\u202Efdp.exe')).toBe('invoicefdp.exe');
    expect(H.esc('a\u2066b\u2069c\u202Ad\u202Ce')).toBe('abcde');
    expect(H.esc('Café 👩‍👩‍👧 日本')).toBe('Café 👩‍👩‍👧 日本'); // ordinary text and joined emoji unchanged
  });
  test('escapes the five HTML special characters', () => {
    expect(H.esc(`<img src=x onerror="a('b')">&`)).toBe('&lt;img src=x onerror=&quot;a(&#39;b&#39;)&quot;&gt;&amp;');
  });
  test('null and undefined become empty text; numbers become text', () => {
    expect(H.esc(null)).toBe('');
    expect(H.esc(undefined)).toBe('');
    expect(H.esc(0)).toBe('0');
  });
});

test.describe('fmtMoney', () => {
  test('formats US dollars with cents', () => {
    expect(H.fmtMoney(1234.5, 'USD')).toBe('$1,234.50');
    expect(H.fmtMoney(0)).toBe('$0.00');
    expect(H.fmtMoney(null)).toBe('$0.00');
    expect(H.fmtMoney('12.345', 'USD')).toBe('$12.35');
  });
  test('an unknown currency code falls back to a plain $ amount', () => {
    expect(H.fmtMoney(5, 'NOT-A-CURRENCY')).toBe('$5.00');
  });
  test('negative amounts keep their sign', () => {
    expect(H.fmtMoney(-20, 'USD')).toBe('-$20.00');
  });
});

test.describe('status helpers', () => {
  test('closed words are recognised regardless of case', () => {
    expect(H.isClosedStatus('Done')).toBe(true);
    expect(H.isClosedStatus('CANCELLED')).toBe(true);
    expect(H.isClosedStatus('in_progress')).toBe(false);
    expect(H.isClosedStatus(null)).toBe(false);
  });
  test('overdue only when the due date is past and the item is still open', () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    const future = new Date(Date.now() + 86400000).toISOString();
    expect(H.isOverdue(past, 'open')).toBe(true);
    expect(H.isOverdue(past, 'done')).toBe(false);
    expect(H.isOverdue(future, 'open')).toBe(false);
    expect(H.isOverdue(null, 'open')).toBe(false);
  });
  test('order status classification used by Accounting and Tax', () => {
    expect(H.classifyOrderStatus('cancelled')).toEqual({ isCancelled: true, isRefund: false, isPartialRefund: false });
    expect(H.classifyOrderStatus('refunded')).toEqual({ isCancelled: false, isRefund: true, isPartialRefund: false });
    expect(H.classifyOrderStatus('partially_refunded')).toEqual({ isCancelled: false, isRefund: true, isPartialRefund: true });
    expect(H.classifyOrderStatus('paid')).toEqual({ isCancelled: false, isRefund: false, isPartialRefund: false });
    expect(H.classifyOrderStatus(null)).toEqual({ isCancelled: false, isRefund: false, isPartialRefund: false });
  });
});

test.describe('purchase order totals', () => {
  const po = { shipping_cost: '15', tax: 5, purchase_order_items: [{ quantity: 50, unit_cost: 2 }, { quantity: 20, unit_cost: '5' }, { quantity: 3, unit_cost: null }] };
  test('lines total = sum of quantity × unit cost', () => {
    expect(H.poLinesTotal(po)).toBe(200);
  });
  test('grand total adds shipping and tax', () => {
    expect(H.poGrandTotal(po)).toBe(220);
    expect(H.poGrandTotal({})).toBe(0);
  });
});

test.describe('small formatters', () => {
  test('9-digit account numbers get dashes; others are left alone', () => {
    expect(H.fmtAccountNumber(123456789)).toBe('123-456-789');
    expect(H.fmtAccountNumber('12345')).toBe('12345');
    expect(H.fmtAccountNumber(null)).toBe('');
  });
  test('device labels from user agents', () => {
    expect(H.deviceLabel('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1')).toBe('iPhone · Safari');
    expect(H.deviceLabel('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0 Safari/537.36')).toBe('Mac · Chrome');
    expect(H.deviceLabel('Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/120.0 Safari/537.36 Edg/120.0')).toBe('Windows PC · Edge');
    expect(H.deviceLabel('')).toBe('Unknown device');
  });
  test('time ago', () => {
    const ago = ms => new Date(Date.now() - ms).toISOString();
    expect(H.timeAgo(ago(10 * 1000))).toBe('just now');
    expect(H.timeAgo(ago(60 * 1000))).toBe('1 minute ago');
    expect(H.timeAgo(ago(5 * 3600 * 1000))).toBe('5 hours ago');
    expect(H.timeAgo(ago(3 * 86400 * 1000))).toBe('3 days ago');
    expect(H.timeAgo(null)).toBe(null);
  });
  test('date-only values are shown on their own calendar day', () => {
    expect(H.fmtDateOnly('2026-05-20')).toContain('20');
    expect(H.fmtDateOnly('not a date')).toBe('—');
    expect(H.fmtDateOnly(null)).toBe('—');
  });
});

test.describe('report rollups', () => {
  test('week starts on Monday (Sunday belongs to the week before)', () => {
    const sunday = new Date(2026, 8, 27); // Sun 27 Sep 2026
    const monday = H.startOfWeekMonday(sunday);
    expect([monday.getFullYear(), monday.getMonth(), monday.getDate(), monday.getDay()]).toEqual([2026, 8, 21, 1]);
    const wednesday = H.startOfWeekMonday(new Date(2026, 8, 30));
    expect(wednesday.getDate()).toBe(28);
  });
  test('daily reports are summed per group, newest group first', () => {
    const reports = [
      { report_date: '2026-09-01', orders_count: 2, revenue: '10.5', ai_cost: 0.25 },
      { report_date: '2026-09-15', orders_count: 1, revenue: 4 },
      { report_date: '2026-08-31', orders_count: 5, revenue: 100 },
    ];
    const byMonth = H.rollupReports(reports, d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'), () => 'label');
    expect(byMonth.map(g => [g.sortKey, g.orders_count, g.revenue])).toEqual([['2026-09', 3, 14.5], ['2026-08', 5, 100]]);
    expect(byMonth[0].ai_cost).toBe(0.25);
  });
});

test.describe('business rule limits', () => {
  test('shipping delay must be a whole number from 1 to 365', () => {
    const check = v => H.businessRuleValueError('shipping_delay_threshold_days', 'Shipping delay', { days: v });
    expect(check(7)).toBe('');
    expect(check(0)).toContain('whole number from 1 to 365');
    expect(check(366)).toContain('whole number');
    expect(check(2.5)).toContain('whole number');
    expect(check('7')).toContain('whole number');
  });
  test('rules without a limit are always accepted', () => {
    expect(H.businessRuleValueError('refund_review_threshold_usd', 'Refund', { amount: -5 })).toBe('');
  });
});

test.describe('tax categories', () => {
  test('ingredients, packaging and manufacturing count as cost of goods; the rest as operating', () => {
    const cogs = Object.keys(H.TAX_CATEGORY_MAP).filter(k => H.TAX_CATEGORY_MAP[k].group === 'cogs').sort();
    expect(cogs).toEqual(['ingredients', 'manufacturing', 'packaging']);
  });
  test('every expense category on the Add Expense form has a tax category', () => {
    const { SOURCE } = require('../helpers/extract-source');
    const form = SOURCE.slice(SOURCE.indexOf('id="expCategory"'), SOURCE.indexOf('id="expAmount"'));
    const values = [...form.matchAll(/<option value="([a-z_]+)"/g)].map(m => m[1]);
    expect(values.length).toBeGreaterThan(3);
    for (const v of values) expect(H.TAX_CATEGORY_MAP[v], v).toBeTruthy();
  });
});

// Moved to assets/owner-login-helpers.js on 2026-10-06 (modularization step 3).
test.describe('error and upload helpers', () => {
  const E = load(['isNetworkError', 'boolGuard', 'noRowsChanged', 'staleMessage', 'explainDbError', 'UPLOAD_MAX_BYTES', 'uploadProblem']);
  test('isNetworkError: a missing reply, not a database refusal', () => {
    expect(E.isNetworkError({ message: 'TypeError: Failed to fetch' })).toBe(true);
    expect(E.isNetworkError({ message: 'Failed to fetch', code: '23514' })).toBe(false);
    expect(E.isNetworkError({ message: 'new row violates check constraint' })).toBe(false);
  });
  test('noRowsChanged: empty or missing reply means nothing changed', () => {
    expect(E.noRowsChanged([])).toBe(true);
    expect(E.noRowsChanged(null)).toBe(true);
    expect(E.noRowsChanged([{ id: 1 }])).toBe(false);
  });
  test('explainDbError adds plain words to permission and expired-session text, once', () => {
    const rls = E.explainDbError('Could not save: new row violates row-level security policy for table "x"');
    expect(rls).toContain('only the Owner or an Administrator can do it');
    expect(E.explainDbError(rls)).toBe(rls);
    expect(E.explainDbError('JWT expired')).toContain('Sign in again');
    expect(E.explainDbError('Something else')).toBe('Something else');
    // internal names are replaced (MU-09)
    expect(rls).not.toContain('row-level security policy');
    expect(rls).not.toContain('"x"');
    expect(E.explainDbError('new row for relation "documents" violates check constraint "documents_category_check"')).toBe('a value the database does not accept');
    expect(E.explainDbError('permission denied for table inventory')).toContain('only the Owner or an Administrator');
    expect(E.explainDbError('permission denied for table inventory')).not.toContain('inventory');
    expect(E.explainDbError('duplicate key value violates unique constraint "products_sku_unique"')).toBe('that value is already used by another record');
    expect(E.explainDbError(null)).toBe('');
  });
  test('explainDbError: gateway pages, cut-off replies and rate limits (EXT4)', () => {
    const page = E.explainDbError('Could not save: <!DOCTYPE html><html><body><h1>502 Bad Gateway</h1></body></html>');
    expect(page).toMatch(/^Could not save — The server sent back an error page/);
    expect(page).toContain('cannot tell whether');
    expect(page).not.toMatch(/<|Bad Gateway/);
    const cut = E.explainDbError('Could not save: [{"id":"x","sta');
    expect(cut).toBe('Could not save — The server’s reply was cut off, so the dashboard cannot tell whether this was saved. Wait a minute, reload the page and check before trying again.');
    expect(E.explainDbError('Could not save: {"a":1}')).toBe('Could not save: {"a":1}'); // a whole value is left alone
    expect(E.explainDbError('Agent [3] is off')).toBe('Agent [3] is off');
    expect(E.explainDbError('Could not save: Too Many Requests')).toBe('Could not save — The server is busy right now (too many requests). Nothing was changed by this step. Wait a minute, then try again.');
    for (const t of [page, cut]) expect(E.explainDbError(t)).toBe(t); // idempotent
  });
  test('uploadProblem: size limit and blocked types', () => {
    expect(E.uploadProblem(null)).toBe(null);
    expect(E.uploadProblem({ name: 'a.pdf', size: 1000 })).toBe(null);
    expect(E.uploadProblem({ name: 'a.pdf', size: E.UPLOAD_MAX_BYTES + 1 })).toContain('limit is 50 MB');
    for (const n of ['x.html', 'X.HTM', 'a.svg', 'run.js', 'setup.exe']) expect(E.uploadProblem({ name: n, size: 10 })).toContain('can’t be uploaded');
    expect(E.uploadProblem({ name: 'photo.jpeg', size: 10 })).toBe(null);
  });
  test('boolGuard and staleMessage', () => {
    expect(E.boolGuard(true)).toBe(true);
    expect(E.boolGuard(false)).toEqual({ notIs: true });
    expect(E.staleMessage('That order')).toMatch(/^That order was already changed/);
  });
});

// Moved on 2026-10-06 (modularization step 2c).
test.describe('upload names and two-press confirmation', () => {
  const U = load(['safeStorageName', 'uploadStamp', 'confirmSecondPress']);
  test('safeStorageName: no folders, no dot runs or hidden names, ≤ 100 chars, extension kept', () => {
    expect(U.safeStorageName('../../etc/passwd.pdf')).toBe('etc_passwd.pdf');
    expect(U.safeStorageName('.hidden')).toBe('hidden');
    expect(U.safeStorageName('')).toBe('file');
    const long = U.safeStorageName('A'.repeat(300) + '.jpeg');
    expect(long.length).toBe(100);
    expect(long.endsWith('.jpeg')).toBe(true);
  });
  test('uploadStamp: two calls in the same millisecond differ', () => {
    const a = U.uploadStamp(), b = U.uploadStamp();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^\d+-[a-z0-9]+$/);
  });
  test('confirmSecondPress: first press arms and relabels, second press confirms', () => {
    const btn = { dataset: {}, textContent: 'Cancel' };
    expect(U.confirmSecondPress(btn, 'Really?')).toBe(false);
    expect(btn.textContent).toBe('Really?');
    expect(U.confirmSecondPress(btn, 'Really?')).toBe(true);
  });
});

test.describe('numberInputError (typed numbers, X3-05/06)', () => {
  const N = load(['numberInputError']);
  const E = (raw, o) => N.numberInputError(raw, o);
  test('a blank box is refused unless blank is allowed (it used to save as 0)', () => {
    expect(E('', { label: 'Amount' })).toBe('Amount is empty. Enter a number.');
    expect(E('   ', { label: 'Amount' })).toContain('empty');
    expect(E('', { allowBlank: true })).toBe('');
  });
  test('not-a-number, infinity, negatives, huge values and fractions are refused', () => {
    expect(E('abc', { label: 'X' })).toBe('X must be a number.');
    expect(E('1e400', { label: 'X' })).toBe('X must be a number.');
    expect(E('Infinity', { label: 'X' })).toBe('X must be a number.');
    expect(E('-5', { label: 'Tax' })).toBe('Tax cannot be less than 0.');
    expect(E('0', { label: 'Amount', minExclusive: true })).toBe('Amount must be more than 0.');
    expect(E('20000000', { label: 'Shipping', max: 10000000 })).toBe('Shipping is too large (more than 10,000,000).');
    expect(E('2.7', { label: 'Amount', min: -100, integer: true })).toBe('Amount must be a whole number.');
  });
  test('ordinary values pass', () => {
    for (const [v, o] of [['12.50', {}], ['0', {}], ['-3', { min: -100, integer: true }], ['1000000', { max: 1000000 }], [' 7 ', { integer: true }]]) {
      expect(E(v, o), v).toBe('');
    }
  });
});

test.describe('explainDbError: dropped connection (EXT3)', () => {
  const X = load(['explainDbError']);
  test('Chrome, Safari and Firefox network failures say the outcome is unknown, not the raw browser text', () => {
    for (const raw of ['Could not change that rule: TypeError: Failed to fetch', 'Could not change that rule: Load failed', 'Could not change that rule: NetworkError when attempting to fetch resource.']) {
      const t = X.explainDbError(raw);
      expect(t).toContain('cannot tell whether this was saved');
      expect(t).toContain('Could not change that rule');
      expect(t).not.toMatch(/Failed to fetch|Load failed|NetworkError/);
    }
  });
  test('a message that already explains the uncertainty is left alone', () => {
    const t = 'That expense may or may not have been saved: Failed to fetch';
    expect(X.explainDbError(t)).toBe(t);
  });
});

test.describe('date ranges (step 2d): Central-time boundaries', () => {
  // The business runs on Central time; the browser computes ranges on its own
  // calendar. Pin this Node worker to Chicago for these checks.
  const prevTz = process.env.TZ;
  test.beforeAll(() => { process.env.TZ = 'America/Chicago'; });
  test.afterAll(() => { if (prevTz === undefined) delete process.env.TZ; else process.env.TZ = prevTz; });
  const D = load(['localDateString', 'acctRangeStart', 'taxRangeStart']);
  test('localDateString gives the Central date, not the UTC date, on a US evening', () => {
    expect(D.localDateString(new Date('2026-06-15T04:30:00Z'))).toBe('2026-06-14'); // 23:30 CDT on June 14
    expect(D.localDateString(new Date('2026-06-15T05:30:00Z'))).toBe('2026-06-15');
  });
  test('"This Month" starts at local midnight on the 1st (05:00Z in summer, 06:00Z in winter)', () => {
    expect(D.acctRangeStart('month', new Date('2026-06-15T15:00:00Z')).toISOString()).toBe('2026-06-01T05:00:00.000Z');
    expect(D.acctRangeStart('month', new Date('2026-01-20T15:00:00Z')).toISOString()).toBe('2026-01-01T06:00:00.000Z');
    expect(D.acctRangeStart('all', new Date())).toBeNull();
  });
  test('"Today" late in the evening is still today (not tomorrow in UTC)', () => {
    expect(D.acctRangeStart('today', new Date('2026-06-15T04:30:00Z')).toISOString()).toBe('2026-06-14T05:00:00.000Z');
  });
  test('Tax years run from local midnight on Jan 1; "Last Year" ends where "This Year" starts', () => {
    const now = new Date('2026-06-15T15:00:00Z');
    expect(D.taxRangeStart('year', now).start.toISOString()).toBe('2026-01-01T06:00:00.000Z');
    const last = D.taxRangeStart('lastyear', now);
    expect(last.start.toISOString()).toBe('2025-01-01T06:00:00.000Z');
    expect(last.end.toISOString()).toBe(D.taxRangeStart('year', now).start.toISOString());
    expect(D.taxRangeStart('all', now)).toEqual({ start: null, end: null });
  });
  // EXT4 timezone contract (docs/ops/TIMEZONE_CONTRACT.md).
  test('daylight-saving days: the calendar day never jumps or repeats', () => {
    expect(D.localDateString(new Date('2026-03-08T07:30:00Z'))).toBe('2026-03-08'); // 01:30 CST, before the jump
    expect(D.localDateString(new Date('2026-03-08T08:30:00Z'))).toBe('2026-03-08'); // 03:30 CDT, after it
    expect(D.localDateString(new Date('2026-11-01T05:30:00Z'))).toBe('2026-11-01'); // 00:30 CDT
    expect(D.localDateString(new Date('2026-11-02T05:30:00Z'))).toBe('2026-11-01'); // 23:30 CST, same day
    expect(D.acctRangeStart('today', new Date('2026-11-02T05:30:00Z')).toISOString()).toBe('2026-11-01T05:00:00.000Z'); // midnight was still CDT
    expect(D.acctRangeStart('today', new Date('2026-03-09T04:00:00Z')).toISOString()).toBe('2026-03-08T06:00:00.000Z'); // midnight was still CST
  });
  test('"Last 7 days" keeps the wall-clock time across a DST change and gives the right first day', () => {
    expect(D.localDateString(D.acctRangeStart('week', new Date('2026-10-07T02:00:00Z')))).toBe('2026-09-29'); // 21:00 CDT Oct 6
    const w = D.acctRangeStart('week', new Date('2026-11-03T18:00:00Z')); // 12:00 CST Nov 3
    expect(D.localDateString(w)).toBe('2026-10-27');
    expect(w.getHours()).toBe(12);
  });
  test('leap day, 11:59 pm and midnight, month and year ends', () => {
    expect(D.localDateString(new Date('2028-03-01T05:30:00Z'))).toBe('2028-02-29'); // 23:30 CST Feb 29
    expect(D.localDateString(new Date('2028-02-29T05:30:00Z'))).toBe('2028-02-28');
    expect(D.acctRangeStart('month', new Date('2028-02-29T18:00:00Z')).toISOString()).toBe('2028-02-01T06:00:00.000Z');
    expect(D.localDateString(new Date('2026-07-01T04:59:59Z'))).toBe('2026-06-30'); // 23:59:59 CDT
    expect(D.localDateString(new Date('2026-07-01T05:00:00Z'))).toBe('2026-07-01'); // midnight CDT
    const nye = new Date('2027-01-01T05:59:00Z'); // 23:59 CST Dec 31 2026
    expect(D.localDateString(nye)).toBe('2026-12-31');
    expect(D.taxRangeStart('year', nye).start.toISOString()).toBe('2026-01-01T06:00:00.000Z');
    expect(D.taxRangeStart('year', new Date('2027-01-01T06:00:00Z')).start.toISOString()).toBe('2027-01-01T06:00:00.000Z');
  });
});

test.describe('maskSensitive (agent error text, F3-06)', () => {
  const M = load(['maskSensitive']);
  test('e-mail addresses and long token-like strings are masked; ordinary words stay', () => {
    expect(M.maskSensitive('send failed for jane.doe@example.test: apikey=FAKETOKENabcdefghijklmnopqrstuvwxyz0123 rejected'))
      .toBe('send failed for [email]: [token] rejected');
    expect(M.maskSensitive('Timeout after 30 s calling the shipping API')).toBe('Timeout after 30 s calling the shipping API');
  });
  test('long text is capped at 300 characters', () => {
    expect(M.maskSensitive('x '.repeat(400)).length).toBe(301);
    expect(M.maskSensitive(null)).toBe('');
  });
});

