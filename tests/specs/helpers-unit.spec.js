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
